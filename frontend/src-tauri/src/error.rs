use serde::Serialize;
use thiserror::Error;

/// Application-wide error type.
/// All Tauri commands return `Result<T, MeetflowError>` so errors serialize
/// cleanly to the frontend as `{ code, message }`.
#[derive(Debug, Error, Serialize)]
#[serde(tag = "code", content = "message")]
pub enum MeetflowError {
    #[error("Database error: {0}")]
    Db(String),

    #[error("Audio error: {0}")]
    Audio(String),

    #[error("Transcription error: {0}")]
    #[allow(dead_code)]
    Transcription(String),

    #[error("LLM error: {0}")]
    Llm(String),

    #[error("Storage error: {0}")]
    Storage(String),

    #[error("IO error: {0}")]
    Io(String),

    #[error("HTTP error: {0}")]
    Http(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Invalid input: {0}")]
    #[allow(dead_code)]
    InvalidInput(String),
}

// ─── Conversions ───────────────────────────────────────────────────────────────

impl From<rusqlite::Error> for MeetflowError {
    fn from(e: rusqlite::Error) -> Self {
        MeetflowError::Db(e.to_string())
    }
}

impl From<std::io::Error> for MeetflowError {
    fn from(e: std::io::Error) -> Self {
        MeetflowError::Io(e.to_string())
    }
}

impl From<reqwest::Error> for MeetflowError {
    fn from(e: reqwest::Error) -> Self {
        MeetflowError::Http(e.to_string())
    }
}

impl From<anyhow::Error> for MeetflowError {
    fn from(e: anyhow::Error) -> Self {
        MeetflowError::Io(e.to_string())
    }
}

// Tauri v2 has: impl<T: Serialize> From<T> for InvokeError
// MeetflowError derives Serialize, so that blanket impl covers us.
// No manual From impl needed (a manual one would conflict).
