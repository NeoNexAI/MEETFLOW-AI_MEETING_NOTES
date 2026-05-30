use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use tauri::{AppHandle, Emitter, State};
use whisper_rs::WhisperContext;

use crate::db::DbPool;
use crate::error::MeetflowError;
use crate::storage;
use crate::whisper::{download, engine::WhisperEngine, ModelCatalogEntry, MODEL_CATALOG};

// ─── Model cache ─────────────────────────────────────────────────────────────

/// Caches the loaded WhisperContext so the model file is only read from disk
/// once. Subsequent transcriptions skip the 1-10s model-load phase entirely.
pub struct WhisperModelCache(pub Mutex<Option<(PathBuf, Arc<WhisperContext>)>>);

impl Default for WhisperModelCache {
    fn default() -> Self {
        Self::new()
    }
}

impl WhisperModelCache {
    pub fn new() -> Self {
        Self(Mutex::new(None))
    }

    /// Return a context for `model_path`, loading from disk only if needed.
    fn get_or_load(&self, model_path: &Path) -> Result<Arc<WhisperContext>, MeetflowError> {
        let mut guard = self
            .0
            .lock()
            .map_err(|_| MeetflowError::Transcription("Model cache lock poisoned".into()))?;

        if let Some((cached_path, ctx)) = &*guard {
            if cached_path.as_path() == model_path {
                tracing::debug!("WhisperContext cache hit: {}", model_path.display());
                return Ok(Arc::clone(ctx));
            }
        }

        tracing::info!("Loading Whisper model from disk: {}", model_path.display());
        let path_str = model_path.to_str().ok_or_else(|| {
            MeetflowError::Transcription("Model path contains non-UTF-8 chars".into())
        })?;
        let ctx = Arc::new(
            WhisperContext::new_with_params(
                path_str,
                whisper_rs::WhisperContextParameters::default(),
            )
            .map_err(|e| MeetflowError::Transcription(format!("Failed to load model: {e}")))?,
        );
        *guard = Some((model_path.to_path_buf(), Arc::clone(&ctx)));
        Ok(ctx)
    }
}

// ─── Commands ────────────────────────────────────────────────────────────────

/// List all models in the catalog with their download status.
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelStatus {
    #[serde(flatten)]
    pub entry: &'static ModelCatalogEntry,
    pub downloaded: bool,
    pub path: Option<String>,
}

#[tauri::command]
pub fn list_whisper_models(app: AppHandle) -> Result<Vec<ModelStatus>, MeetflowError> {
    let models_dir = storage::models_dir(&app)?;
    let statuses = MODEL_CATALOG
        .iter()
        .map(|e| {
            let path = models_dir.join(format!("ggml-{}.bin", e.id));
            let downloaded = path.exists();
            ModelStatus {
                entry: e,
                downloaded,
                path: downloaded.then(|| path.to_string_lossy().to_string()),
            }
        })
        .collect();
    Ok(statuses)
}

/// Return only the IDs of models that are already downloaded.
#[tauri::command]
pub fn get_downloaded_models(app: AppHandle) -> Result<Vec<String>, MeetflowError> {
    let models_dir = storage::models_dir(&app)?;
    let ids = MODEL_CATALOG
        .iter()
        .filter(|e| models_dir.join(format!("ggml-{}.bin", e.id)).exists())
        .map(|e| e.id.to_string())
        .collect();
    Ok(ids)
}

/// Start downloading a Whisper model. Progress events are emitted to the frontend.
/// `model_id` must match a `ModelCatalogEntry.id`.
#[tauri::command]
pub async fn download_whisper_model(
    app: AppHandle,
    model_id: String,
) -> Result<String, MeetflowError> {
    let entry = MODEL_CATALOG
        .iter()
        .find(|e| e.id == model_id)
        .ok_or_else(|| MeetflowError::NotFound(format!("Model '{model_id}' not in catalog")))?;

    let client = Arc::new(
        reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(600))
            .build()
            .map_err(|e| MeetflowError::Http(e.to_string()))?,
    );

    let path = download::download_model(app, entry, client).await?;
    Ok(path.to_string_lossy().to_string())
}

/// Cancel an in-progress download — deletes the partial file.
#[tauri::command]
pub async fn cancel_whisper_download(
    app: AppHandle,
    model_id: String,
) -> Result<(), MeetflowError> {
    let models_dir = storage::models_dir(&app)?;
    let partial = models_dir.join(format!("ggml-{model_id}.bin"));
    if partial.exists() {
        tokio::fs::remove_file(&partial).await?;
        tracing::info!(
            "Cancelled download, removed partial file: {}",
            partial.display()
        );
    }
    Ok(())
}

/// Transcribe a meeting's audio file using the best available Whisper model.
///
/// - `language`: optional BCP-47 code ("es", "en", …). Pass `null` for auto-detect.
///
/// The command returns immediately after kicking off work — the actual inference
/// runs on a `spawn_blocking` thread so Tokio and the IPC layer stay responsive.
/// The frontend receives a `transcript-ready` event when the transcript is ready.
#[tauri::command]
pub async fn transcribe_meeting(
    app: AppHandle,
    db: State<'_, DbPool>,
    model_cache: State<'_, WhisperModelCache>,
    meeting_id: String,
    language: Option<String>,
) -> Result<(), MeetflowError> {
    use rusqlite::OptionalExtension as _;

    // ── 1. DB reads (fast, hold lock briefly) ────────────────────────────────
    let (audio_path, already_transcribed) = {
        let conn =
            db.0.lock()
                .map_err(|_| MeetflowError::Db("Lock poisoned".into()))?;

        let audio_path: Option<String> = conn
            .query_row(
                "SELECT audio_path FROM meetings WHERE id = ?1",
                rusqlite::params![meeting_id],
                |row| row.get(0),
            )
            .optional()?
            .flatten();

        let content: Option<String> = conn
            .query_row(
                "SELECT content FROM transcripts WHERE meeting_id = ?1",
                rusqlite::params![meeting_id],
                |row| row.get(0),
            )
            .optional()?
            .flatten();

        let done = content.map(|c| !c.is_empty()).unwrap_or(false);
        (audio_path, done)
    };

    if already_transcribed {
        tracing::info!("Meeting {meeting_id} already transcribed — skipping");
        return Ok(());
    }

    let audio_path =
        audio_path.ok_or_else(|| MeetflowError::NotFound("Meeting has no audio file".into()))?;

    // ── 2. Resolve model path (async-safe fs check) ───────────────────────────
    // Prefer the active model chosen in Settings → Transcription, if it is
    // actually downloaded; otherwise fall back to the first available model.
    let preferred_model: Option<String> = {
        let conn =
            db.0.lock()
                .map_err(|_| MeetflowError::Db("Lock poisoned".into()))?;
        conn.query_row(
            "SELECT value FROM settings WHERE key = 'whisper_model'",
            [],
            |row| row.get::<_, String>(0),
        )
        .ok()
        .filter(|s| !s.is_empty())
    };
    let models_dir = storage::models_dir(&app)?;
    let model_path = resolve_model_path(&models_dir, preferred_model.as_deref())?;

    // ── 3. Get cached context (loads from disk once, reuses forever after) ────
    let ctx = model_cache.get_or_load(&model_path)?;

    // ── 4. Heavy work on blocking thread pool (WAV read + inference) ─────────
    tracing::info!(
        "Starting transcription for meeting {meeting_id} (model: {}, language: {})",
        model_path.display(),
        language.as_deref().unwrap_or("auto")
    );

    let lang = language.clone();
    let result = tokio::task::spawn_blocking(move || {
        // Read WAV inside the blocking thread — no async executor pressure
        let samples = read_wav_samples(&audio_path)?;
        tracing::info!(
            "WAV loaded: {} samples ({:.1}s)",
            samples.len(),
            samples.len() as f32 / 16_000.0
        );
        WhisperEngine::transcribe_with_ctx(&ctx, &samples, lang.as_deref())
    })
    .await
    .map_err(|e| MeetflowError::Transcription(format!("Thread panicked: {e}")))??;

    // ── 5. Persist transcript ─────────────────────────────────────────────────
    let segments_json = serde_json::to_string(&result.segments)
        .map_err(|e| MeetflowError::Db(format!("Segment serialization failed: {e}")))?;
    let word_count = result.text.split_whitespace().count() as i64;

    {
        let conn =
            db.0.lock()
                .map_err(|_| MeetflowError::Db("Lock poisoned".into()))?;

        conn.execute(
            "UPDATE transcripts SET content = ?1, segments = ?2, word_count = ?3
             WHERE meeting_id = ?4",
            rusqlite::params![result.text, segments_json, word_count, meeting_id],
        )?;

        conn.execute(
            "UPDATE meetings SET language = ?1 WHERE id = ?2",
            rusqlite::params![result.language, meeting_id],
        )?;
    }

    // ── 6. Notify frontend ────────────────────────────────────────────────────
    app.emit("transcript-ready", &meeting_id).ok();
    tracing::info!("Transcription complete for meeting {meeting_id}");
    Ok(())
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/// Resolve which model file to use: the `preferred` model if it is in the
/// catalog and downloaded, otherwise the first available downloaded model.
fn resolve_model_path(
    models_dir: &Path,
    preferred: Option<&str>,
) -> Result<PathBuf, MeetflowError> {
    if let Some(id) = preferred {
        if MODEL_CATALOG.iter().any(|e| e.id == id) {
            let path = models_dir.join(format!("ggml-{id}.bin"));
            if path.exists() {
                tracing::info!("Using selected model: {}", path.display());
                return Ok(path);
            }
            tracing::warn!("Selected model '{id}' not downloaded — falling back");
        }
    }
    find_first_downloaded_model(models_dir)
}

fn find_first_downloaded_model(models_dir: &Path) -> Result<PathBuf, MeetflowError> {
    for entry in MODEL_CATALOG {
        let path = models_dir.join(format!("ggml-{}.bin", entry.id));
        if path.exists() {
            tracing::info!("Using model: {}", path.display());
            return Ok(path);
        }
    }
    Err(MeetflowError::NotFound(
        "No Whisper model found. Download one in Onboarding → Model step.".into(),
    ))
}

fn read_wav_samples(path: &str) -> Result<Vec<f32>, MeetflowError> {
    let mut reader = hound::WavReader::open(path)
        .map_err(|e| MeetflowError::Storage(format!("Cannot open WAV '{path}': {e}")))?;

    let spec = reader.spec();

    let samples: Vec<f32> = match (spec.sample_format, spec.bits_per_sample) {
        (hound::SampleFormat::Int, 16) => reader
            .samples::<i16>()
            .map(|s| s.map(|x| x as f32 / 32_768.0))
            .collect::<Result<_, _>>()
            .map_err(|e| MeetflowError::Storage(e.to_string()))?,

        (hound::SampleFormat::Int, 32) => reader
            .samples::<i32>()
            .map(|s| s.map(|x| x as f32 / 2_147_483_648.0))
            .collect::<Result<_, _>>()
            .map_err(|e| MeetflowError::Storage(e.to_string()))?,

        (hound::SampleFormat::Float, 32) => reader
            .samples::<f32>()
            .collect::<Result<_, _>>()
            .map_err(|e| MeetflowError::Storage(e.to_string()))?,

        (fmt, bits) => {
            return Err(MeetflowError::Storage(format!(
                "Unsupported WAV format: {fmt:?} {bits}-bit"
            )));
        }
    };

    tracing::debug!(
        "WAV spec: {} samples, {}Hz, {}ch",
        samples.len(),
        spec.sample_rate,
        spec.channels
    );

    Ok(samples)
}
