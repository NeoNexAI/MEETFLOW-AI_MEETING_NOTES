use std::sync::Arc;

use tauri::AppHandle;

use crate::error::MeetflowError;
use crate::storage;
use crate::whisper::{download, ModelCatalogEntry, MODEL_CATALOG};

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
            .timeout(std::time::Duration::from_secs(600)) // 10 min for large models
            .build()
            .map_err(|e| MeetflowError::Http(e.to_string()))?,
    );

    let path = download::download_model(app, entry, client).await?;
    Ok(path.to_string_lossy().to_string())
}

/// Cancel an in-progress download.
/// NOTE: Simple implementation — just deletes the partial file.
/// A proper cancellation token will be added in a future phase.
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
