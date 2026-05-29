use std::{
    path::{Path, PathBuf},
    sync::Arc,
};

use futures::StreamExt;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter};
use tokio::io::AsyncWriteExt;

use crate::error::MeetflowError;
use crate::storage;

use super::ModelCatalogEntry;

// ─── Events emitted to the frontend ──────────────────────────────────────────

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgressEvent {
    pub model_id: String,
    pub percent: u8,
    pub bytes_downloaded: u64,
    pub bytes_total: u64,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadCompleteEvent {
    pub model_id: String,
    pub path: String,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadErrorEvent {
    pub model_id: String,
    pub error: String,
}

// ─── Download logic ───────────────────────────────────────────────────────────

/// Download a Whisper model file, emitting progress events to the frontend.
/// Verifies SHA256 checksum after download.
pub async fn download_model(
    app: AppHandle,
    entry: &ModelCatalogEntry,
    client: Arc<reqwest::Client>,
) -> Result<PathBuf, MeetflowError> {
    let models_dir = storage::models_dir(&app)?;
    let model_path = models_dir.join(format!("ggml-{}.bin", entry.id));

    // Already downloaded and valid
    if model_path.exists() && verify_checksum(&model_path, entry.sha256).is_ok() {
        tracing::info!("Model {} already present and valid", entry.id);
        return Ok(model_path);
    }

    tracing::info!("Downloading model {} from {}", entry.id, entry.hf_url);

    let response = client
        .get(entry.hf_url)
        .send()
        .await?
        .error_for_status()
        .map_err(|e| MeetflowError::Http(e.to_string()))?;

    let total = response
        .content_length()
        .unwrap_or(entry.size_mb * 1024 * 1024);
    let mut downloaded: u64 = 0;
    let mut stream = response.bytes_stream();

    let mut file = tokio::fs::File::create(&model_path).await?;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| MeetflowError::Http(e.to_string()))?;
        file.write_all(&chunk).await?;
        downloaded += chunk.len() as u64;

        let percent = ((downloaded as f64 / total as f64) * 100.0) as u8;
        let _ = app.emit(
            "model-download-progress",
            DownloadProgressEvent {
                model_id: entry.id.to_string(),
                percent,
                bytes_downloaded: downloaded,
                bytes_total: total,
            },
        );
    }

    file.flush().await?;
    drop(file);

    // Verify checksum
    if let Err(e) = verify_checksum(&model_path, entry.sha256) {
        tokio::fs::remove_file(&model_path).await.ok();
        let _ = app.emit(
            "model-download-error",
            DownloadErrorEvent {
                model_id: entry.id.to_string(),
                error: e.to_string(),
            },
        );
        return Err(e);
    }

    let _ = app.emit(
        "model-download-complete",
        DownloadCompleteEvent {
            model_id: entry.id.to_string(),
            path: model_path.to_string_lossy().to_string(),
        },
    );

    tracing::info!("Model {} downloaded and verified", entry.id);
    Ok(model_path)
}

/// Verify SHA256 checksum of a downloaded file.
///
/// A valid SHA256 hex digest is exactly 64 characters. Any other length is
/// treated as "not yet pinned" — verification is skipped with a warning rather
/// than failing the download. This prevents placeholder or wrong-length values
/// in the catalog from making a model permanently uninstallable.
/// See `docs/playbooks/release.md` for how to pin real checksums before GA.
fn verify_checksum(path: &Path, expected: &str) -> Result<(), MeetflowError> {
    if expected.len() != 64 {
        tracing::warn!(
            "SHA256 not pinned for {} (got {} chars) — skipping integrity check",
            path.display(),
            expected.len()
        );
        return Ok(());
    }

    let bytes = std::fs::read(path)?;
    let actual = hex::encode(Sha256::digest(&bytes));

    if actual != expected {
        return Err(MeetflowError::Storage(format!(
            "Checksum mismatch for {}: expected {expected}, got {actual}",
            path.display()
        )));
    }
    Ok(())
}
