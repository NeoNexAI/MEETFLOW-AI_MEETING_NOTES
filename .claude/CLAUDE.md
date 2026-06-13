# CLAUDE.md — MeetFlow Repo Instructions

> Instrucciones específicas para agentes IA trabajando en este repositorio.
> Complementa (no reemplaza) `~/.claude/CLAUDE.md` (perfil global) y
> `C:\Users\jonat\CLAW.D.LABS AI AGENCY\CLAUDE.md` (constitución empresa).

---

## 1. Identidad del producto

- **Nombre**: MeetFlow
- **Bundle id**: `com.meetflow.app`
- **Tipo**: App de escritorio Windows (macOS post-v0.2)
- **Modelo**: Open Source (MIT), gratuita, distribuida como `.exe` en GitHub Releases
- **Diferenciador**: AI Agent Executor post-reunión + UX ultra-dark premium + 100% local-first

---

## 2. Stack técnico (FIJADO — no cambiar sin HITL)

```
Desktop shell:    Tauri v2 (Rust)
Frontend:         Next.js 14 + TypeScript 5 (strict) + React 18
UI:               shadcn/ui + Radix + Tailwind CSS 3.4
State:            React Context + Zustand (global complejo)
Editor notas:     BlockNote
Forms:            React Hook Form + Zod
HTTP:             Fetch + TanStack Query
i18n:             next-intl (EN + ES desde v0.1)
Iconos:           Lucide React
Animaciones:      Framer Motion (sparingly)
Toasts:           Sonner

Audio capture:    cpal + WASAPI (Windows)
Transcripción:    whisper-rs (whisper.cpp bindings)
VAD/Diarización:  sherpa-rs (sherpa-onnx, ONNX-based)  — desde v0.2
LLM clientes:     reqwest (Rust nativo) → Ollama / Claude / OpenAI / Groq / OpenRouter
DB:               rusqlite + tokio (async wrappers donde necesario)
Token storage:    tauri-plugin-store (cifrado nativo OS)
Audio export:     hound (WAV)

Package mgr:      pnpm (frontend), cargo (Rust)
Build:            Tauri CLI → NSIS installer (.exe)
CI/CD:            GitHub Actions (Windows-latest, matrix macOS desde v0.3)
Testing:          Vitest (unit) + Playwright (e2e) + cargo test (Rust)
```

**Decisión arquitectónica clave (2026-05-02):** NO hay backend Python/FastAPI.
Todo el backend vive en Rust dentro de `frontend/src-tauri/`. Razones: simplifica
packaging, reduce binario, elimina runtime Python sidecar, menos superficie de bugs.

---

## 3. Estructura de carpetas

```
meetflow/
├── .claude/
│   ├── CLAUDE.md            # ← este archivo
│   ├── settings.json        # permisos + hooks (commited)
│   ├── settings.local.json  # local (gitignored)
│   └── commands/            # /dev /build /test /release /design-check
├── frontend/
│   ├── src/                 # Next.js + React
│   │   ├── app/             # App Router routes
│   │   ├── components/      # UI components
│   │   ├── hooks/           # Custom hooks
│   │   ├── lib/             # Utils, API clients, store
│   │   ├── messages/        # i18n EN/ES
│   │   └── styles/          # globals.css con CSS vars
│   ├── src-tauri/
│   │   ├── src/
│   │   │   ├── main.rs
│   │   │   ├── lib.rs
│   │   │   ├── audio/       # capture, devices, pipeline
│   │   │   ├── whisper/     # engine, model manager, transcription
│   │   │   ├── llm/         # Ollama, Claude, OpenAI clients
│   │   │   ├── db/          # SQLite schema + migrations
│   │   │   ├── commands/    # #[tauri::command] handlers
│   │   │   └── storage/     # paths, models, recordings
│   │   ├── Cargo.toml
│   │   └── tauri.conf.json
│   └── package.json
├── docs/
│   ├── policies/            # security baseline, install log
│   └── playbooks/           # release, troubleshooting
├── .github/
│   ├── workflows/
│   └── ISSUE_TEMPLATE/
├── README.md
├── PRIVACY.md
├── TERMS.md
├── CHANGELOG.md
├── CONTRIBUTING.md
└── LICENSE                  # MIT
```

---

## 4. Reglas de código

### TypeScript
- `strict: true` siempre. Cero `any`. Si necesitas escape, usa `unknown` + type guards.
- Funciones < 50 líneas. Archivos < 500 líneas. Si excedes, refactoriza.
- `interface` para contratos públicos, `type` para uniones/utilidades.
- Imports absolutos vía `@/` alias (configurado en `tsconfig.json` + `next.config.js`).
- Nunca strings hardcodeados en JSX → siempre `t('namespace.key')`.

### Rust
- `clippy::all` activo: el CI corre `cargo clippy --all-features -- -D warnings` y
  falla ante cualquier warning. (`clippy::pedantic` queda como objetivo opcional,
  no forzado en CI para evitar ruido de lints muy estrictos.)
- `Result<T, MeetflowError>` propagado con `?`. Cero `.unwrap()` en código de producción.
- `tracing` para logging estructurado, no `println!`.
- Cada `#[tauri::command]` documentado con doc comments + JSDoc en el wrapper TS.

### General
- Tests primero (TDD) para lógica de negocio crítica (audio pipeline, LLM, DB).
- Coverage target: >80% (Vitest) y >80% (cargo test) para módulos core.
- Commits convencionales: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`.

---

## 5. Comandos de desarrollo

```bash
# Desde frontend/
pnpm install                  # instalar deps frontend
pnpm tauri dev                # arranca app en dev (HMR)
pnpm tauri build              # build release con NSIS installer
pnpm test                     # vitest unit tests
pnpm test:e2e                 # playwright e2e
pnpm lint                     # eslint
pnpm type-check               # tsc --noEmit

# Desde frontend/src-tauri/
cargo test                    # Rust unit tests
cargo clippy -- -D warnings   # lint Rust
cargo fmt                     # formato Rust
```

Slash commands disponibles: `/dev`, `/build`, `/test`, `/release`, `/design-check`.

---

## 6. Design system (NO improvisar)

Paleta CSS vars en `frontend/src/styles/globals.css`. Ver MASTER_PLAN §4.2.
Resumen no-negociable:

```
--bg-base:        #09090B    --accent:         #818CF8
--bg-surface:     #111113    --accent-hover:   #6366F1
--bg-elevated:    #18181B    --recording:      #EF4444
--text-primary:   #FAFAFA    Font:             Geist / Inter
--text-secondary: #A1A1AA
```

Componentes shadcn customizados en `frontend/src/components/ui/`. Cualquier
nuevo componente que se cree DEBE consumir estas vars vía Tailwind, nunca
colores hex hardcodeados en JSX.

---

## 7. i18n — reglas

- Todo string visible vive en `frontend/src/messages/{en,es}.json`.
- Keys jerárquicas: `onboarding.welcome.title`, `recording.button.start`.
- Al añadir una key nueva → añadir EN y ES en el mismo commit.
- Slash command `/translate` sincroniza claves faltantes entre idiomas.

---

## 8. Privacy & Security (alineado con CLAW.D constitution §5)

1. **Nunca** enviar audio, transcript ni notas a un servidor externo sin acción
   explícita del usuario (botón "Send to Claude", "Export to Notion", etc.).
2. **Nunca** API keys en código ni `.env` sin cifrado. Usar `tauri-plugin-store`
   con cifrado OS-level (DPAPI en Windows).
3. **Nunca** OAuth con client_secret en cliente. Solo PKCE.
4. **Siempre** modelos Whisper desde HuggingFace oficial (`huggingface.co/ggerganov/whisper.cpp`).
5. **Siempre** verificar checksum SHA256 post-descarga de modelos.
6. **Siempre** PRIVACY.md y TERMS.md actualizados antes de cada release.
7. **HITL obligatorio** para: commits a `main`, releases, modificar `.claude/settings.json`.

Los hooks `Edit|Write` están limitados a prettier (sin `tsc` por performance).
Type-check se ejecuta con `pnpm type-check` o slash command `/check`.

---

## 9. Roadmap MVP (acordado 2026-05-02)

| Versión | Scope | Tiempo estimado |
|---|---|---|
| **v0.1** | Recording + Whisper + Ollama/Claude summary + Meetings list + Notes editor + Export Markdown + Onboarding 3 pasos | 10-12 días |
| **v0.2** | + Diarización (sherpa-onnx) + Google OAuth + Notion + Slack + AI Agent Executor (Claude only) | +15 días |
| **v0.3** | + Microsoft + Linear + Analytics dashboard + macOS DMG + resto integraciones Tier 3 | +10 días |

---

## 10. Reuse técnico

PrivFlow-AInotes (proyecto anterior) **no existe**. Este es un build desde cero.
Como referencia técnica externa, consultar:
- whisper.cpp ejemplos: github.com/ggerganov/whisper.cpp/tree/master/examples
- Tauri v2 audio: github.com/tauri-apps/plugins-workspace
- shadcn/ui registry: ui.shadcn.com

---

## 11. Al iniciar sesión en este workspace

1. Leer este archivo (auto).
2. Leer `docs/status.md` → ⚡ SIGUIENTE ACCIÓN.
3. `git status` → estado actual del árbol.
4. Comprobar `.claude/settings.local.json` para overrides locales.

## 12. Al cerrar sesión

- Actualizar `docs/status.md` con la siguiente acción concreta.
- Si se tomaron decisiones técnicas → registrar en `docs/decisions/ADR-NNN.md`.
- Si se rompió algo → anotar en `docs/playbooks/troubleshooting.md`.

---

## Log de versiones

- **v1** — 2026-05-02 — instrucciones iniciales del repo MeetFlow. Stack fijado, MVP cortado a v0.1.
