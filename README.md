# MeetFlow

> **Privacy-first AI meeting intelligence for your desktop.**
> Record, transcribe and summarize meetings 100% locally. No cloud unless you choose.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Status](https://img.shields.io/badge/status-pre--alpha-red.svg)](#status)
![Platform](https://img.shields.io/badge/platform-windows-blue.svg)

---

## Status

**Pre-alpha — under active construction.** First public release (`v0.1.0`) is being built.
See [CHANGELOG.md](./CHANGELOG.md) for progress.

## What is MeetFlow

A desktop app for professionals who run ≥5 meetings/week and want a private,
organized and actionable record of every one. It captures audio, transcribes
locally with Whisper, and generates AI summaries — without sending your data
to anyone unless you explicitly configure a cloud provider.

## Features (v0.1 MVP)

- 🎙 **Record meetings** — microphone + system audio simultaneously
- 📝 **Local transcription** — whisper.cpp with downloadable models (tiny / small / medium / large-v3-turbo)
- 🧠 **AI summaries** — local Ollama or your own Claude / OpenAI / Groq API key
- 📋 **Action items extraction** — auto-detected from transcript
- 📓 **Notes editor** — write alongside the transcript, autosaved
- 📤 **Export** — Markdown (free) · structured JSON (Pro) · PDF planned
- 🌍 **Multi-language UI** — English + Spanish, switchable in Settings
- 🌑 **Ultra-dark premium design** — Linear/Vercel-inspired, no generic gray dashboards

## Coming in v0.2

- Speaker diarization (sherpa-onnx, fully local)
- Google Calendar / Drive / Docs integration
- Notion + Slack export
- AI Agent Executor — post-meeting automation with Claude tool use

## Tech stack

| Layer | Technology |
|---|---|
| Desktop shell | Tauri v2 (Rust) |
| Frontend | Next.js 15 + TypeScript 5 + shadcn/ui + Tailwind |
| Audio capture | cpal + WASAPI loopback |
| Transcription | whisper-rs (whisper.cpp bindings) |
| LLM clients | reqwest (Rust) → Ollama / Claude / OpenAI / Groq / OpenRouter |
| Database | SQLite (rusqlite) |
| Build | NSIS installer (.exe) via Tauri CLI |

No Python runtime, no Node.js sidecar at runtime. Single ~25 MB installer.

## Privacy

All audio, transcripts and notes stay in `%APPDATA%\MeetFlow\` on your machine.
We do not operate a server and do not collect any telemetry.

If you choose to use a cloud LLM (Claude, OpenAI…) for summaries, only the
transcript text is sent to that provider — never the audio. See [PRIVACY.md](./PRIVACY.md).

## Install

_GitHub Releases will be published once `v0.1.0` ships._

## Build from source

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE) — open source forever.

## Contact

Open an issue: https://github.com/JonatanGhub/MEETFLOW-AI_MEETING_NOTES/issues
