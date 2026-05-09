use std::path::PathBuf;

use tauri::Manager as _;

use crate::error::MeetflowError;

/// Resolves the base app data directory.
/// Windows: `%APPDATA%\com.meetflow.app\`
/// macOS:   `~/Library/Application Support/com.meetflow.app/`
pub fn app_data_dir(app: &tauri::AppHandle) -> Result<PathBuf, MeetflowError> {
    app.path()
        .app_data_dir()
        .map_err(|e| MeetflowError::Storage(e.to_string()))
}

/// Path to the SQLite database file.
#[allow(dead_code)]
pub fn db_path(app: &tauri::AppHandle) -> Result<PathBuf, MeetflowError> {
    Ok(app_data_dir(app)?.join("meetflow.db"))
}

/// Path to the directory where Whisper models are stored.
pub fn models_dir(app: &tauri::AppHandle) -> Result<PathBuf, MeetflowError> {
    let dir = app_data_dir(app)?.join("models");
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}

/// Path to the directory where audio recordings are stored.
pub fn recordings_dir(app: &tauri::AppHandle) -> Result<PathBuf, MeetflowError> {
    let dir = app_data_dir(app)?.join("recordings");
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}

/// Path to the directory where exported files are temporarily staged.
pub fn exports_dir(app: &tauri::AppHandle) -> Result<PathBuf, MeetflowError> {
    let dir = app_data_dir(app)?.join("exports");
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}
