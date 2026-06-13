/**
 * Canonical keys for the `settings` table, shared by the TS callers of
 * getSetting/setSetting. Mirrors `settings::keys` in the Rust backend
 * (frontend/src-tauri/src/commands/settings.rs) — keep the two in sync.
 */
export const SETTINGS_KEYS = {
  llmConfig: "llm_config",
  audioInputDevice: "audio_input_device",
  whisperModel: "whisper_model",
  licenseKey: "license_key",
  summaryOptions: "summary_options",
} as const;
