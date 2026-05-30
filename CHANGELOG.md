# Changelog

All notable changes to MeetFlow will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-05-30

First public release. Privacy-first desktop meeting notes — record, transcribe
and summarize 100% locally. Freemium: a free local core plus an optional Pro tier.

### Added
- **Recording** — microphone capture (cpal/WASAPI) with pause/resume, crash-safe
  WAV auto-flush, and selectable input device (Settings → Audio).
- **Local transcription** — whisper.cpp via `whisper-rs`, cached context, with a
  downloadable model catalog (tiny/small free; medium/large Pro) and a selectable
  active model (Settings → Transcription).
- **AI summaries** — local Ollama (free) or, with Pro, cloud providers (Claude,
  OpenAI, Groq, OpenRouter, Mistral). Executive summary, action items, topics,
  sentiment and meeting score.
- **Meetings** — list with search, detail view (Summary / Transcript / Notes),
  inline title editing, delete, and autosaved notes.
- **Export** — Markdown (free) and structured JSON (Pro).
- **Onboarding** — welcome, Whisper model download, and AI provider setup.
- **Settings** — General (language EN/ES), Audio, Transcription, AI, Plan,
  Privacy, About.
- **Internationalization** — English + Spanish, switchable at runtime.
- **Freemium licensing** — offline Ed25519-signed license keys verified on-device
  (no phone-home). Free/Pro tiers with entitlements; activation UI in Settings →
  Plan and a Stripe checkout link. Operator key-minting tool (`examples/gen_license`).

### Security & Privacy
- **API keys encrypted at rest** (AES-256-GCM) in the local config.
- **Pro features enforced in the backend** (not just hidden in the UI): cloud
  providers and large models are rejected on the Free tier.
- No telemetry; all data stays in the app data directory.

### Fixed
- Robust Whisper model checksum verification (a malformed checksum no longer
  makes the recommended model uninstallable).
- Panic-safety: poisoned-mutex recovery in the audio write loop; graceful
  handling of LLM client init and app startup failures; UTF-8-safe transcript
  truncation; fence-tolerant summary JSON parsing.
- Green CI: resolved Rust clippy errors that previously failed the pipeline.

### Tests
- Rust: 27 unit tests (summary parsing, secrets crypto, license verification,
  provider gating, model catalog invariants).
- Frontend: 15 unit tests (formatting utilities) + React error boundaries.

### Decisions
- **2026-05-02**: Backend Python/FastAPI eliminated. All backend logic lives in Rust inside Tauri.
- **2026-05-02**: pyannote replaced by `sherpa-onnx` (via `sherpa-rs`) for VAD + speaker diarization.
- **2026-05-02**: Windows-only for v0.1. macOS support deferred to v0.3+.
- **2026-05-02**: MVP scope cut: v0.1 = recording + transcription + summary + notes + export. OAuth integrations move to v0.2.
- **2026-05-29**: Freemium model (ADR-002) — free local core + Pro tier with offline license activation.

### Pre-release notes (operator)
Before tagging the build, complete the two machine-bound steps in
`docs/playbooks/release.md`: generate a production Ed25519 license keypair and
pin the real Whisper model SHA-256 checksums.
