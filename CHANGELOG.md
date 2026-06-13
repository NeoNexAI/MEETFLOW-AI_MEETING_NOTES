# Changelog

All notable changes to MeetFlow will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-06-13

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
- **API keys encrypted at rest** (AES-256-GCM); on Windows the encryption key is
  further protected with DPAPI (current-user scope).
- **Strict Content-Security-Policy** on the webview (`script-src 'self'`, IPC-only
  `connect-src`, `object-src 'none'`).
- **Pro features enforced in the backend** (not just hidden in the UI): cloud
  providers and large models are rejected on the Free tier.
- **Zero dependency vulnerabilities** (`pnpm audit --prod` + `cargo audit` gated in CI).
- No telemetry; all data stays in the app data directory.

### Fixed
- Robust Whisper model checksum verification (a malformed checksum no longer
  makes the recommended model uninstallable).
- Static export build for the dynamic `/meetings/[id]` route (broke `tauri build`
  after the Next 15 upgrade; now guarded by a CI export-build step).
- Panic-safety: poisoned-mutex recovery in the audio write loop; graceful
  handling of LLM client init and app startup failures; UTF-8-safe transcript
  truncation; fence-tolerant summary JSON parsing.
- Green CI: resolved Rust clippy errors and a CMake cache-poisoning failure on
  the Visual Studio toolchain bump.

### Tests & Quality
- Rust: 30 unit/integration tests (summary parsing, secrets crypto, license
  verification, provider gating, model-catalog invariants, command-level DB tests).
- Frontend: 15 unit tests + React error boundaries; coverage gate in CI.
- No source file exceeds the 500-line limit; settings keys centralized.

### Decisions
- **2026-05-02**: Backend Python/FastAPI eliminated. All backend logic lives in Rust inside Tauri.
- **2026-05-02**: pyannote replaced by `sherpa-onnx` (via `sherpa-rs`) for VAD + speaker diarization.
- **2026-05-02**: Windows-only for v0.1. macOS support deferred to v0.3+.
- **2026-05-02**: MVP scope cut: v0.1 = recording + transcription + summary + notes + export. OAuth integrations move to v0.2.
- **2026-05-29**: Freemium model (ADR-002) — free local core + Pro tier with offline license activation.

### Pre-release notes (operator)
Before tagging the build, complete the machine-bound steps in
`docs/playbooks/release.md`: generate a production Ed25519 license keypair, pin
the real Whisper model SHA-256 checksums, set the real Stripe Payment Link, and
smoke-test the CSP on the first installer build.
