use std::path::PathBuf;

use crate::db::models::TranscriptSegment;
use crate::error::MeetflowError;

/// Wrapper around whisper.cpp via whisper-rs.
/// This struct is NOT Send+Sync so it must be used from a dedicated thread.
///
/// Note: whisper-rs is NOT added to Cargo.toml yet because it requires
/// MSVC + cmake to build. It will be added in the next phase once the
/// build toolchain is verified. This file defines the interface.
#[allow(dead_code)]
pub struct WhisperEngine {
    /// Path to the loaded .bin model file.
    pub model_path: PathBuf,
    // whisper_rs::WhisperContext goes here once the crate is added
}

#[allow(dead_code)]
impl WhisperEngine {
    /// Load a whisper model from disk.
    pub fn load(model_path: PathBuf) -> Result<Self, MeetflowError> {
        if !model_path.exists() {
            return Err(MeetflowError::Transcription(format!(
                "Model not found: {}",
                model_path.display()
            )));
        }

        // TODO: initialize whisper-rs context
        // let ctx = whisper_rs::WhisperContext::new_with_params(
        //     model_path.to_str().unwrap(),
        //     WhisperContextParameters::default(),
        // ).map_err(|e| MeetflowError::Transcription(e.to_string()))?;

        tracing::info!("Whisper model loaded: {}", model_path.display());
        Ok(Self { model_path })
    }

    /// Transcribe a WAV file (16 kHz, mono, f32).
    /// Returns full text and timestamped segments.
    pub fn transcribe(
        &self,
        audio_samples: &[f32],
        language: Option<&str>,
    ) -> Result<TranscribeResult, MeetflowError> {
        // TODO: implement with whisper-rs
        // let mut state = self.ctx.create_state().map_err(...)
        // state.full(params, audio_samples).map_err(...)

        tracing::warn!("whisper-rs not yet linked — returning empty transcript");
        let _ = (audio_samples, language); // suppress unused warnings
        Ok(TranscribeResult {
            text: String::new(),
            segments: Vec::new(),
            language: "en".to_string(),
        })
    }
}

/// Output of a transcription run.
#[allow(dead_code)]
#[derive(Debug, Clone)]
pub struct TranscribeResult {
    pub text: String,
    pub segments: Vec<TranscriptSegment>,
    pub language: String,
}
