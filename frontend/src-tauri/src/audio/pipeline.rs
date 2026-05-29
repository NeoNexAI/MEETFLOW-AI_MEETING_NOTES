use std::{
    path::PathBuf,
    sync::{
        mpsc::{self, SyncSender},
        Arc, Mutex,
    },
    time::{Duration, Instant},
};

use tokio::sync::watch;

use crate::error::MeetflowError;

use super::capture::{AudioBuffer, CaptureStream};

/// State shared between the recording pipeline and Tauri command handlers.
#[derive(Debug)]
pub struct RecordingState {
    pub meeting_id: String,
    pub started_at: Instant,
    #[allow(dead_code)]
    pub audio_path: PathBuf,
    pub is_paused: bool,
    /// Wall-clock instant when the current pause began (None if not paused).
    pub paused_at: Option<Instant>,
    /// Total seconds already spent paused (from completed pause spans).
    pub total_paused_secs: u64,
}

/// Commands sent to the pipeline worker.
pub enum PipelineCommand {
    Pause,
    Resume,
    Stop,
}

/// Handle to an active recording pipeline.
/// Drop to stop recording immediately (prefer sending `Stop` for clean shutdown).
pub struct RecordingHandle {
    pub state: Arc<Mutex<RecordingState>>,
    /// Synchronous sender — cpal streams are !Send, so the pipeline runs on a
    /// std thread rather than a tokio task.
    pub cmd_tx: SyncSender<PipelineCommand>,
    #[allow(dead_code)]
    pub buffer: AudioBuffer,
}

impl RecordingHandle {
    /// Active recording duration in seconds, excluding time spent paused.
    pub fn elapsed_seconds(&self) -> u64 {
        self.state
            .lock()
            .map(|s| {
                let wall = s.started_at.elapsed().as_secs();
                let current_pause = s.paused_at.map(|p| p.elapsed().as_secs()).unwrap_or(0);
                wall.saturating_sub(s.total_paused_secs + current_pause)
            })
            .unwrap_or(0)
    }
}

/// Orchestrates microphone capture, VAD (basic energy), and WAV saving.
pub struct RecordingPipeline;

impl RecordingPipeline {
    /// Start a new recording. Returns a handle for controlling it.
    pub async fn start(
        meeting_id: String,
        audio_path: PathBuf,
        transcript_tx: watch::Sender<String>,
    ) -> Result<RecordingHandle, MeetflowError> {
        let buffer: AudioBuffer = Arc::new(Mutex::new(Vec::new()));
        let buffer_clone = buffer.clone();

        let state = Arc::new(Mutex::new(RecordingState {
            meeting_id: meeting_id.clone(),
            started_at: Instant::now(),
            audio_path: audio_path.clone(),
            is_paused: false,
            paused_at: None,
            total_paused_secs: 0,
        }));

        // cpal Stream is !Send, so we use std::sync::mpsc and a std thread
        // rather than tokio::spawn (which requires Send).
        let (cmd_tx, cmd_rx) = mpsc::sync_channel::<PipelineCommand>(8);

        // Spawn the audio writer on a dedicated OS thread
        let state_clone = state.clone();
        let path_clone = audio_path.clone();

        std::thread::spawn(move || {
            let spec = hound::WavSpec {
                channels: 1,
                sample_rate: 16_000,
                bits_per_sample: 16,
                sample_format: hound::SampleFormat::Int,
            };

            // Start the microphone stream (lives on this thread for its entire lifetime)
            let _stream = match CaptureStream::start_microphone(buffer_clone.clone()) {
                Ok(s) => s,
                Err(e) => {
                    tracing::error!("Failed to start microphone: {e}");
                    let _ = transcript_tx.send(format!("[Error: {e}]"));
                    return;
                }
            };

            // Create WAV writer — always initialized here or we return early
            let mut writer = match hound::WavWriter::create(&path_clone, spec) {
                Ok(w) => w,
                Err(e) => {
                    tracing::error!("Failed to create WAV file: {e}");
                    return;
                }
            };

            let mut last_flush = Instant::now();

            loop {
                // Check for commands (non-blocking)
                if let Ok(cmd) = cmd_rx.try_recv() {
                    match cmd {
                        PipelineCommand::Pause => {
                            if let Ok(mut s) = state_clone.lock() {
                                if !s.is_paused {
                                    s.is_paused = true;
                                    s.paused_at = Some(Instant::now());
                                }
                            }
                        }
                        PipelineCommand::Resume => {
                            if let Ok(mut s) = state_clone.lock() {
                                if s.is_paused {
                                    if let Some(paused_at) = s.paused_at.take() {
                                        s.total_paused_secs += paused_at.elapsed().as_secs();
                                    }
                                    s.is_paused = false;
                                }
                            }
                        }
                        PipelineCommand::Stop => break,
                    }
                }

                let is_paused = state_clone.lock().map(|s| s.is_paused).unwrap_or(false);

                if !is_paused {
                    // Drain buffer and write to WAV
                    let samples = {
                        // Recover from a poisoned mutex instead of panicking the
                        // audio-write thread (which would abort the whole app in
                        // release builds, where panic = "abort").
                        let mut buf = buffer_clone
                            .lock()
                            .unwrap_or_else(|poisoned| poisoned.into_inner());
                        buf.drain(..).collect::<Vec<f32>>()
                    };

                    for sample in &samples {
                        let s16 = (sample.clamp(-1.0, 1.0) * 32767.0) as i16;
                        let _ = writer.write_sample(s16);
                    }

                    // Auto-flush every 30 seconds for crash recovery
                    if last_flush.elapsed() > Duration::from_secs(30) {
                        let _ = writer.flush();
                        last_flush = Instant::now();
                    }
                }

                std::thread::sleep(Duration::from_millis(50));
            }

            // Finalize WAV file
            if let Err(e) = writer.finalize() {
                tracing::error!("Failed to finalize WAV: {e}");
            }

            tracing::info!("Recording pipeline stopped for meeting {meeting_id}");
        });

        Ok(RecordingHandle {
            state,
            cmd_tx,
            buffer,
        })
    }
}
