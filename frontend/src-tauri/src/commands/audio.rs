use std::sync::Mutex;

use tauri::{AppHandle, State};
use tokio::sync::watch;

use crate::audio::{
    devices::{list_input_devices, list_loopback_devices, AudioDeviceInfo},
    pipeline::{PipelineCommand, RecordingHandle, RecordingPipeline},
};
use crate::db::DbPool;
use crate::error::MeetflowError;
use crate::storage;

/// Shared recording handle — one recording at a time.
pub struct ActiveRecording(pub Mutex<Option<RecordingHandle>>);

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordingStatus {
    pub is_recording: bool,
    pub is_paused: bool,
    pub meeting_id: Option<String>,
    pub duration_seconds: u64,
}

/// List available input (microphone) + loopback (system audio) devices.
#[tauri::command]
pub fn get_audio_devices() -> Result<Vec<AudioDeviceInfo>, MeetflowError> {
    let mut devices = list_input_devices()?;
    devices.extend(list_loopback_devices()?);
    Ok(devices)
}

/// Start a new recording session.
/// Creates a meeting row in the DB and starts the audio pipeline.
#[tauri::command]
pub async fn start_recording(
    app: AppHandle,
    title: String,
    db: State<'_, DbPool>,
    active: State<'_, ActiveRecording>,
) -> Result<String, MeetflowError> {
    // Prevent starting a second recording
    {
        let guard = active
            .0
            .lock()
            .map_err(|_| MeetflowError::Audio("Lock poisoned".into()))?;
        if guard.is_some() {
            return Err(MeetflowError::Audio(
                "A recording is already in progress".into(),
            ));
        }
    }

    let meeting_id = uuid::Uuid::new_v4().to_string();
    let started_at = chrono::Utc::now().timestamp_millis();
    let recordings_dir = storage::recordings_dir(&app)?;
    let audio_path = recordings_dir.join(format!("{meeting_id}.wav"));

    // Insert meeting into DB
    {
        let conn =
            db.0.lock()
                .map_err(|_| MeetflowError::Db("Lock poisoned".into()))?;
        conn.execute(
            "INSERT INTO meetings (id, title, started_at, audio_path) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![
                meeting_id,
                title,
                started_at,
                audio_path.to_string_lossy().to_string()
            ],
        )?;
    }

    let (transcript_tx, _transcript_rx) = watch::channel(String::new());

    let handle = RecordingPipeline::start(meeting_id.clone(), audio_path, transcript_tx).await?;

    let mut guard = active
        .0
        .lock()
        .map_err(|_| MeetflowError::Audio("Lock poisoned".into()))?;
    *guard = Some(handle);

    tracing::info!("Recording started: {meeting_id}");
    Ok(meeting_id)
}

/// Stop the active recording and return the meeting ID.
#[tauri::command]
pub async fn stop_recording(
    db: State<'_, DbPool>,
    active: State<'_, ActiveRecording>,
) -> Result<String, MeetflowError> {
    let mut guard = active
        .0
        .lock()
        .map_err(|_| MeetflowError::Audio("Lock poisoned".into()))?;

    let handle = guard
        .take()
        .ok_or_else(|| MeetflowError::Audio("No active recording".into()))?;

    let meeting_id = handle
        .state
        .lock()
        .map(|s| s.meeting_id.clone())
        .unwrap_or_default();
    let duration_sec = handle.elapsed_seconds() as i64;
    let ended_at = chrono::Utc::now().timestamp_millis();

    // Signal pipeline to stop (sync channel — no await needed)
    let _ = handle.cmd_tx.send(PipelineCommand::Stop);

    // Update meeting in DB
    {
        let conn =
            db.0.lock()
                .map_err(|_| MeetflowError::Db("Lock poisoned".into()))?;
        conn.execute(
            "UPDATE meetings SET ended_at = ?1, duration_sec = ?2 WHERE id = ?3",
            rusqlite::params![ended_at, duration_sec, meeting_id],
        )?;
    }

    tracing::info!("Recording stopped: {meeting_id} ({duration_sec}s)");
    Ok(meeting_id)
}

/// Pause the active recording.
#[tauri::command]
pub fn pause_recording(active: State<'_, ActiveRecording>) -> Result<(), MeetflowError> {
    let guard = active
        .0
        .lock()
        .map_err(|_| MeetflowError::Audio("Lock poisoned".into()))?;
    let handle = guard
        .as_ref()
        .ok_or_else(|| MeetflowError::Audio("No active recording".into()))?;
    let _ = handle.cmd_tx.send(PipelineCommand::Pause);
    Ok(())
}

/// Resume a paused recording.
#[tauri::command]
pub fn resume_recording(active: State<'_, ActiveRecording>) -> Result<(), MeetflowError> {
    let guard = active
        .0
        .lock()
        .map_err(|_| MeetflowError::Audio("Lock poisoned".into()))?;
    let handle = guard
        .as_ref()
        .ok_or_else(|| MeetflowError::Audio("No active recording".into()))?;
    let _ = handle.cmd_tx.send(PipelineCommand::Resume);
    Ok(())
}

/// Get current recording status.
#[tauri::command]
pub fn get_recording_status(active: State<'_, ActiveRecording>) -> RecordingStatus {
    let guard = active.0.lock().unwrap_or_else(|p| p.into_inner());
    match guard.as_ref() {
        None => RecordingStatus {
            is_recording: false,
            is_paused: false,
            meeting_id: None,
            duration_seconds: 0,
        },
        Some(handle) => {
            let (meeting_id, is_paused) = handle
                .state
                .lock()
                .map(|s| (s.meeting_id.clone(), s.is_paused))
                .unwrap_or_default();
            RecordingStatus {
                is_recording: true,
                is_paused,
                meeting_id: Some(meeting_id),
                duration_seconds: handle.elapsed_seconds(),
            }
        }
    }
}
