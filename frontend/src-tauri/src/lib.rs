mod audio;
mod commands;
mod db;
mod error;
pub mod licensing;
mod llm;
mod storage;
mod whisper;

use commands::audio::ActiveRecording;
pub use commands::whisper::WhisperModelCache;

/// Application entry point — called from `main.rs`.
pub fn run() {
    // Structured logging: MEETFLOW_LOG env var controls level (default: info).
    // e.g. MEETFLOW_LOG=debug for verbose output during development.
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_env("MEETFLOW_LOG")
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    tauri::Builder::default()
        // ── Plugins ───────────────────────────────────────────────────────
        .plugin(tauri_plugin_store::Builder::default().build())
        // ── Managed state ─────────────────────────────────────────────────
        .manage(ActiveRecording(std::sync::Mutex::new(None)))
        .manage(WhisperModelCache::new())
        // ── Setup: init DB + ensure storage dirs exist ────────────────────
        .setup(|app| {
            use tauri::Manager as _;
            let app_data = storage::app_data_dir(app.handle())?;
            std::fs::create_dir_all(&app_data)?;

            // Open / migrate the SQLite database
            let db_path = app_data.join("meetflow.db");
            let pool = db::init(&db_path)?;
            app.manage(pool);

            // Ensure subdirectories exist (models, recordings, exports)
            storage::models_dir(app.handle())?;
            storage::recordings_dir(app.handle())?;
            storage::exports_dir(app.handle())?;

            tracing::info!("MeetFlow started — data dir: {}", app_data.display());
            Ok(())
        })
        // ── Tauri commands ─────────────────────────────────────────────────
        // Use full sub-module paths so generate_handler! can resolve the
        // hidden __cmd__* and __tauri_command_name_* symbols produced by
        // #[tauri::command] at the point of definition.
        .invoke_handler(tauri::generate_handler![
            // Audio
            commands::audio::get_audio_devices,
            commands::audio::start_recording,
            commands::audio::stop_recording,
            commands::audio::pause_recording,
            commands::audio::resume_recording,
            commands::audio::get_recording_status,
            // Meetings
            commands::meetings::list_meetings,
            commands::meetings::get_meeting,
            commands::meetings::update_meeting_title,
            commands::meetings::delete_meeting,
            commands::meetings::get_transcript,
            commands::meetings::get_summary,
            commands::meetings::get_note,
            commands::meetings::save_note,
            commands::meetings::export_meeting_markdown,
            commands::meetings::export_meeting_json,
            // Settings
            commands::settings::get_setting,
            commands::settings::set_setting,
            commands::settings::get_app_data_dir,
            commands::settings::delete_all_data,
            // Whisper models + transcription
            commands::whisper::list_whisper_models,
            commands::whisper::get_downloaded_models,
            commands::whisper::download_whisper_model,
            commands::whisper::cancel_whisper_download,
            commands::whisper::transcribe_meeting,
            // LLM
            commands::llm::test_llm_connection,
            commands::llm::generate_meeting_summary,
            commands::llm::list_ollama_models,
            // Licensing (freemium)
            commands::license::get_license_status,
            commands::license::activate_license,
            commands::license::deactivate_license,
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| {
            // Log and exit non-zero instead of panicking: with panic = "abort"
            // in release a panic produces an opaque crash, whereas a logged
            // exit is diagnosable from the user's log file.
            tracing::error!("fatal: MeetFlow failed to start: {e}");
            std::process::exit(1);
        });
}
