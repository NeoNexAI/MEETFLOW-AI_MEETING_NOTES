use std::sync::{Arc, Mutex};

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{SampleFormat, SupportedStreamConfig};

use crate::error::MeetflowError;

/// Shared audio buffer: Vec of f32 samples at 16 kHz mono (Whisper format).
pub type AudioBuffer = Arc<Mutex<Vec<f32>>>;

/// An active capture stream. Dropping this stops the capture.
pub struct CaptureStream {
    _stream: cpal::Stream,
    #[allow(dead_code)]
    pub config: SupportedStreamConfig,
}

impl CaptureStream {
    /// Start capturing the default microphone into `buffer`.
    pub fn start_microphone(buffer: AudioBuffer) -> Result<Self, MeetflowError> {
        let host = cpal::default_host();
        let device = host
            .default_input_device()
            .ok_or_else(|| MeetflowError::Audio("No default microphone found".into()))?;

        let config = device
            .default_input_config()
            .map_err(|e| MeetflowError::Audio(e.to_string()))?;

        tracing::debug!(
            "Microphone: {} | {}Hz | {:?}",
            device.name().unwrap_or_default(),
            config.sample_rate().0,
            config.sample_format()
        );

        let stream = build_input_stream(&device, &config, buffer)?;
        stream
            .play()
            .map_err(|e| MeetflowError::Audio(e.to_string()))?;

        Ok(CaptureStream {
            _stream: stream,
            config,
        })
    }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

fn build_input_stream(
    device: &cpal::Device,
    config: &SupportedStreamConfig,
    buffer: AudioBuffer,
) -> Result<cpal::Stream, MeetflowError> {
    let sample_rate = config.sample_rate().0;
    let channels = config.channels() as usize;

    // Resample factor: Whisper wants 16 kHz. Simple decimation for now.
    // TODO(v0.2): replace with proper resampler (rubato crate).
    let target_rate: u32 = 16_000;
    let step = if sample_rate > target_rate {
        (sample_rate / target_rate) as usize
    } else {
        1
    };

    let err_fn = |err| tracing::error!("Audio stream error: {err}");

    let stream = match config.sample_format() {
        SampleFormat::F32 => {
            let buf = buffer.clone();
            device
                .build_input_stream(
                    &config.config(),
                    move |data: &[f32], _| {
                        append_samples_f32(data, channels, step, &buf);
                    },
                    err_fn,
                    None,
                )
                .map_err(|e| MeetflowError::Audio(e.to_string()))?
        }
        SampleFormat::I16 => {
            let buf = buffer.clone();
            device
                .build_input_stream(
                    &config.config(),
                    move |data: &[i16], _| {
                        let f32_data: Vec<f32> = data.iter().map(|&s| s as f32 / 32768.0).collect();
                        append_samples_f32(&f32_data, channels, step, &buf);
                    },
                    err_fn,
                    None,
                )
                .map_err(|e| MeetflowError::Audio(e.to_string()))?
        }
        fmt => {
            return Err(MeetflowError::Audio(format!(
                "Unsupported sample format: {fmt:?}"
            )));
        }
    };

    Ok(stream)
}

/// Down-mix to mono, apply decimation step, push to shared buffer.
fn append_samples_f32(data: &[f32], channels: usize, step: usize, buffer: &AudioBuffer) {
    let mono: Vec<f32> = data
        .chunks(channels)
        .step_by(step)
        .map(|frame| frame.iter().sum::<f32>() / channels as f32)
        .collect();

    if let Ok(mut buf) = buffer.lock() {
        buf.extend_from_slice(&mono);
    }
}
