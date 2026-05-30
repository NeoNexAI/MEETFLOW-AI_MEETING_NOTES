# MeetFlow — Project Status

_Updated: 2026-05-30_

## ⚡ SIGUIENTE ACCIÓN

**v0.1.0 está lista en código.** Quedan únicamente 2 pasos del operador (requieren
máquina local + secretos) antes de etiquetar el release — ver `docs/playbooks/release.md`:

1. Generar el par de claves Ed25519 de **producción** y sustituir
   `LICENSE_PUBLIC_KEY_HEX` (la clave embebida actual es de bootstrap).
2. Pinear los **checksums SHA-256 reales** de los modelos Whisper en
   `whisper/mod.rs` (hoy van vacíos → verificación omitida con warning).
3. (Opcional) Fijar el Stripe Payment Link real en Settings → Plan.

Después: `git tag v0.1.0 && git push origin v0.1.0` → `release.yml` construye el
instalador NSIS y borra el draft del GitHub Release.

## Estado a 2026-05-30 (verificado)

- Rust: `cargo fmt --check` ✅ · `clippy --all-features -- -D warnings` ✅ · `cargo test` **27/27** ✅
- Frontend: `pnpm type-check` ✅ · `pnpm lint` ✅ · `pnpm test` **15/15** ✅
- i18n EN/ES: paridad de claves ✅
- CI (GitHub Actions, Windows): verde en `main`

## Hitos completados (v0.1)

- [x] Scaffold Tauri v2 + Next.js 15 + Rust backend (31 comandos Tauri)
- [x] Recording (cpal/WASAPI) + pausa/resume + selección de micrófono
- [x] Transcripción local whisper-rs + catálogo de modelos + modelo activo
- [x] Summaries IA (Ollama local / cloud Pro) — exec summary, action items, topics, score
- [x] Meetings: lista + búsqueda + detalle (Summary/Transcript/Notes) + notas autosave
- [x] Export Markdown (free) + JSON estructurado (Pro)
- [x] Onboarding + Settings (General/Audio/Transcription/AI/Plan/Privacy/About)
- [x] i18n EN+ES con selector en vivo
- [x] **Cifrado en reposo de API keys (AES-256-GCM)**
- [x] **Freemium: licencias Ed25519 offline + entitlements + enforcement backend + UI Plan**
- [x] Herramienta operador `examples/gen_license` + runbook `docs/playbooks/release.md`
- [x] Estabilización: fix checksums, panic-safety, CI clippy verde
- [x] Tests: Rust 27 + Frontend 15 + error boundaries
- [x] Diagnóstico + roadmap: `docs/PRODUCTION_READINESS.md`
- [x] ADRs: 001 (stack), 002 (freemium/licensing)

## Pendiente operador (pre-tag)

1. Par de claves de producción + `LICENSE_PUBLIC_KEY_HEX`
2. Pinear SHA-256 reales de modelos Whisper
3. Stripe Payment Link real (opcional para el tag)
4. `git tag v0.1.0` → release NSIS

## Para v0.2 (diferido, no bloquea v0.1)

- Diarización sherpa-onnx (speaker labels)
- OAuth: Google + Notion + Slack + Linear
- AI Agent Executor (acciones post-reunión vía Claude)
- Analytics dashboard · Export PDF · macOS DMG
- Resampling de audio con `rubato` · descargas reanudables · Playwright e2e

## Decisiones registradas

- `docs/decisions/ADR-001-stack.md` — stack (no Python, sherpa-onnx, Windows-first)
- `docs/decisions/ADR-002-freemium-licensing.md` — freemium + activación offline
