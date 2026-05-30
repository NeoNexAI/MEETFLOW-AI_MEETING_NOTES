# MeetFlow — Auditoría de Producción & Roadmap a Release

_Última actualización: 2026-05-29 · Rama: `claude/production-readiness-audit-US4MB`_

> Documento vivo. Estado de tareas: ✅ hecho · 🚧 en progreso · ⬜ pendiente.

---

## 1. Resumen ejecutivo

MeetFlow es una **app de escritorio local-first** (Tauri v2 + Next.js 15 + Rust),
no un SaaS. Graba reuniones, transcribe localmente con whisper.cpp y resume con
Ollama local o una API cloud que aporta el propio usuario. El núcleo es y seguirá
siendo **gratuito y open source (MIT)**; sobre él se construye un **tier Pro de
pago** (modelo freemium — ver `ADR-002`).

El flujo principal (grabar → transcribir → resumir → notas → export) **funciona**
y compila limpio. El trabajo de esta fase ha sido **endurecer v0.1 hasta un release
público creíble**: arreglar bloqueadores de CI/correctitud, cerrar deuda de
seguridad/privacidad, completar Settings, y sentar la base freemium.

**Estado del producto:** v0.1 ~70% → objetivo: v0.1.0 publicable.

---

## 2. Estado actual detectado (verificado)

| Área | Estado | Evidencia |
|---|---|---|
| Frontend type-check | ✅ verde | `pnpm type-check` 0 errores |
| Frontend lint | ✅ verde | `pnpm lint` 0 warnings (`next lint` deprecado en Next 15) |
| Frontend unit tests | ✅ 9/9 | `pnpm test` (vitest) |
| i18n EN/ES | ✅ paridad 201/201 | script de paridad |
| Backend Rust | ✅ arquitectura sólida | 35 comandos Tauri, whisper-rs real |
| CI (Rust clippy) | 🔴→✅ | `cargo clippy -- -D warnings` fallaba (2 errores preexistentes) → corregido |
| `pnpm-lock.yaml` | ✅ presente | ya commiteado en `4c36dcd` (Next 15 upgrade) |
| Tests Rust | ⬜ 0 | no existían |
| E2E Playwright | ⬜ 0 | script existe, sin tests |

---

## 3. Hallazgos y deuda (con severidad)

### Bloqueadores corregidos en esta fase
- 🔴 **CI Rust rojo**: `cargo clippy --all-features -- -D warnings` fallaba con 2 errores
  preexistentes (`new_without_default`, `ptr_arg` en `commands/whisper.rs`). **✅ corregido**
  (añadido `impl Default`, firmas `&Path`). Verificado: clippy/check/fmt/test en verde local.
- 🔴 **Checksums Whisper inválidos** (small=SHA1/40c, medium/large=16c) → el modelo
  *recomendado* nunca se instalaba. **✅ verificación robusta (len==64 o skip con warning).**
- 🟠 **3 `unwrap()/expect()`** en producción (bucle de audio, init LLM, run()). **✅ saneados.**
- 🟡 **Strings i18n hardcodeados** ("Back" ×2, "Regenerate", placeholder). **✅ corregidos.**
- 🟡 **Sin error boundaries** React. **✅ `global-error.tsx` + `(app)/error.tsx`.**

### Deuda en curso / pendiente (esta fase)
- 🟠 **API keys en texto plano** en SQLite (contradice CLAUDE.md §8). → mover a almacén local segregado. 🚧
- 🟡 **Settings incompleto** (3 tabs). Faltan General (idioma/tema), Audio (selección mic), Transcription (gestión modelos). 🚧
- 🟡 **README sobre-promete**: BlockNote (es textarea), export PDF/JSON (solo MD). → alinear o implementar. 🚧
- 🟡 **Sin tests Rust ni e2e** (CLAUDE.md exige >80%). 🚧
- 🟡 **Freemium**: sin entitlements ni activación. → módulo de licencias + UI Upgrade. 🚧

### Diferido a v0.2 / v0.3 (NO bloquea release)
- Diarización (sherpa-onnx), OAuth (Google/MS/Notion/Slack/Linear), AI Agent Executor,
  dashboard de Analytics, macOS, export PDF, resampling de audio con `rubato`,
  descargas reanudables, progreso durante inferencia Whisper.

---

## 4. Roadmap a producción (por fases)

### Fase 1 — Estabilización & CI verde ✅ (esta entrega)
- ✅ Fix 2 errores de clippy que tenían el CI Rust en rojo
- ✅ Fix checksums Whisper
- ✅ Saneo de `unwrap/expect`
- ✅ i18n hardcodeados + error boundaries

### Fase 2 — Seguridad, privacidad & honestidad de producto ✅
- ✅ Cifrado en reposo (AES-256-GCM) de `llm_config` (API keys) con migración de
  valores legacy en texto plano; clave local en `secret.key`. `storage::secrets`.
- ✅ Alinear README con la realidad (notas autosaved; export = Markdown, PDF/JSON planned)
- ⬜ Migrar `next lint` → ESLint CLI (Next 16-ready)
- ⬜ Futuro: clave de cifrado en OS keychain/DPAPI (hoy junto a la DB)

### Fase 3 — Completar UX v0.1 🚧
- ✅ Settings: tab **General** con selector de idioma EN/ES (cambio en vivo vía evento)
- ⬜ Settings: tab Audio (selección de micrófono — el comando ya existe)
- ⬜ Settings: tab Transcription (gestión de modelos Whisper)
- ⬜ Notas: BlockNote real (o JSON export como alternativa de valor)

### Fase 4 — Freemium / monetización ✅ (ver ADR-002)
- ✅ Módulo `licensing` Rust: `Tier` free/Pro + `Entitlements` (6 tests)
- ✅ Activación por clave de licencia firmada Ed25519, verificación 100% offline
- ✅ Comandos `get/activate/deactivate_license` + wrappers TS
- ✅ UI Settings → Plan: estado, activación, enlace de checkout (Stripe Payment Link)
- ✅ Herramienta operador `examples/gen_license.rs` + runbook `docs/playbooks/release.md`
- ✅ Gating de entitlements con **enforcement en backend** (no solo UI):
  resumen con provider cloud y descarga de modelos `requires_pro` rechazados en
  tier Free; UI muestra candados "Pro" en Settings (IA, Transcription) y onboarding.
- ⬜ Webhook Stripe → emisión/email de clave (backend mínimo del operador)
- ✅ Export JSON estructurado (Pro, `advanced_export`) — comando + UI gated
- ⬜ Gating de `integrations` (cuando lleguen las integraciones v0.2)
- ⬜ Export PDF (planned)

### Fase 5 — Testing & calidad 🚧
- ✅ Tests unitarios Rust: **27 tests** — summary parser/truncate, secrets
  (AES-GCM), licensing (Ed25519), LLM providers (is_cloud/base_url/default/serde),
  catálogo Whisper (ids únicos, modelo free, checksums 64-hex, URLs oficiales).
- ✅ Tests frontend: **15 tests** (utils: duración, bytes, truncate, fechas relativas).
- ⬜ Playwright e2e: diferido — frágil contra Tauri en el CI actual
  (requiere tauri-driver/WebKitGTK). Se prioriza cobertura unitaria fiable.
- ⬜ Cobertura formal >80% (medir con tarpaulin/coverage en CI)

> Bugs de correctitud detectados y corregidos al escribir los tests:
> - `parse_summary_response` paniqueaba con un fence ```` ```json ```` sin cierre
>   (`raw[start+7..end]` con `start>end`). Ahora extrae el objeto `{…}` directamente.
> - `truncate_transcript` paniqueaba al cortar a mitad de un carácter UTF-8
>   multibyte (acentos ES). Ahora retrocede a un límite de carácter válido.

### Fase 6 — Distribución ⬜
- ⬜ Pinear checksums SHA256 reales de modelos (runbook)
- ⬜ Firma de código + clave de actualización Tauri
- ⬜ Tag `v0.1.0` → workflow `release.yml` → instalador NSIS en GitHub Releases
- ⬜ README con GIF demo

---

## 5. Decisiones tomadas autónomamente
- **ADR-001 manda sobre el master plan**: v0.1 = scope recortado; OAuth/agente/analytics → v0.2+.
- **Modelo freemium** (decisión del CEO): núcleo OSS gratis + Pro de pago. Detalle en `ADR-002`.
- **Activación offline por licencia firmada** en lugar de auth/servidor → preserva el local-first.
- **Windows-only** para el primer release (ADR-001 §4).
- **Verificación de checksum tolerante**: digest de 64 chars verifica; otro valor → skip con warning (evita romper modelos por placeholders), con tarea de release para pinear los reales.

## 6. Limitaciones del entorno de esta sesión
- Entorno Linux en la nube: se verifica por `type-check`/`lint`/`vitest`/`cargo check|clippy|test`.
  El **instalador NSIS y la prueba de audio/hardware** se producen en Windows vía `release.yml`
  o en la máquina del operador. No se construye el `.exe` aquí.
