use tauri::{AppHandle, State};

use crate::db::DbPool;
use crate::error::MeetflowError;
use crate::storage;

/// Setting keys whose value is encrypted at rest (they embed secrets such as
/// the cloud LLM API key). See `storage::secrets` for the threat model.
const SECRET_KEYS: &[&str] = &["llm_config"];

/// Get a settings value by key. Values for [`SECRET_KEYS`] are transparently
/// decrypted; pre-encryption (legacy plaintext) values are returned as-is and
/// get re-encrypted on the next write.
#[tauri::command]
pub fn get_setting(
    app: AppHandle,
    db: State<'_, DbPool>,
    key: String,
) -> Result<Option<String>, MeetflowError> {
    let raw = {
        let conn =
            db.0.lock()
                .map_err(|_| MeetflowError::Db("Lock poisoned".into()))?;
        match conn.query_row(
            "SELECT value FROM settings WHERE key = ?1",
            rusqlite::params![key],
            |row| row.get::<_, String>(0),
        ) {
            Ok(v) => v,
            Err(rusqlite::Error::QueryReturnedNoRows) => return Ok(None),
            Err(e) => return Err(e.into()),
        }
    };

    if SECRET_KEYS.contains(&key.as_str()) {
        match storage::secrets::decrypt(&app, &raw) {
            Ok(plain) => Ok(Some(plain)),
            Err(_) => {
                tracing::debug!(
                    "setting '{key}' stored as legacy plaintext — will re-encrypt on next write"
                );
                Ok(Some(raw))
            }
        }
    } else {
        Ok(Some(raw))
    }
}

/// Set (upsert) a settings value. Values for [`SECRET_KEYS`] are encrypted at
/// rest before being written to the database.
#[tauri::command]
pub fn set_setting(
    app: AppHandle,
    db: State<'_, DbPool>,
    key: String,
    value: String,
) -> Result<(), MeetflowError> {
    let stored = if SECRET_KEYS.contains(&key.as_str()) {
        storage::secrets::encrypt(&app, &value)?
    } else {
        value
    };

    let conn =
        db.0.lock()
            .map_err(|_| MeetflowError::Db("Lock poisoned".into()))?;
    let now = chrono::Utc::now().timestamp_millis();
    conn.execute(
        "INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3)
         ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = ?3",
        rusqlite::params![key, stored, now],
    )?;
    Ok(())
}

/// Return the app data directory path (for display in Settings > Privacy).
#[tauri::command]
pub fn get_app_data_dir(app: AppHandle) -> Result<String, MeetflowError> {
    storage::app_data_dir(&app).map(|p| p.to_string_lossy().to_string())
}

/// Delete all user data: meetings, transcripts, notes, summaries, settings.
/// Audio files on disk are also removed.
#[tauri::command]
pub async fn delete_all_data(app: AppHandle, db: State<'_, DbPool>) -> Result<(), MeetflowError> {
    // Delete DB records
    {
        let conn =
            db.0.lock()
                .map_err(|_| MeetflowError::Db("Lock poisoned".into()))?;
        conn.execute_batch(
            "DELETE FROM summaries;
             DELETE FROM transcripts;
             DELETE FROM notes;
             DELETE FROM meetings;
             DELETE FROM settings;",
        )?;
    }

    // Delete audio files
    let recordings_dir = storage::recordings_dir(&app)?;
    if let Ok(entries) = std::fs::read_dir(&recordings_dir) {
        for entry in entries.flatten() {
            if entry
                .path()
                .extension()
                .map(|e| e == "wav")
                .unwrap_or(false)
            {
                tokio::fs::remove_file(entry.path()).await.ok();
            }
        }
    }

    tracing::info!("All user data deleted");
    Ok(())
}
