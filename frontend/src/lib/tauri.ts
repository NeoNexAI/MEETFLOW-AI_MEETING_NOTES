/**
 * Typed wrappers for all Tauri IPC commands.
 *
 * Every function here maps 1-to-1 to a `#[tauri::command]` in Rust.
 * serde_json camelCase serialization is assumed throughout.
 */

import { invoke } from "@tauri-apps/api/core";

// ─── Domain types (mirrors src-tauri/src/db/models.rs) ──────────────────────

export interface Meeting {
  id: string;
  title: string;
  startedAt: number; // Unix ms
  endedAt: number | null;
  durationSec: number | null;
  audioPath: string | null;
  language: string | null;
  createdAt: number;
}

export interface MeetingCard {
  id: string;
  title: string;
  startedAt: number;
  durationSec: number | null;
  score: number | null;
  actionItemCount: number;
  summarySnippet: string | null;
}

export interface TranscriptSegment {
  start: number; // seconds from recording start
  end: number;
  text: string;
  speaker: string | null; // v0.2+ with sherpa-onnx
}

export interface Transcript {
  id: string;
  meetingId: string;
  content: string;
  segments: TranscriptSegment[];
  wordCount: number;
  createdAt: number;
}

export interface ActionItem {
  text: string;
  assignee: string | null;
  due: string | null; // ISO 8601 date
  done: boolean;
}

export interface Summary {
  id: string;
  meetingId: string;
  executiveSummary: string | null;
  actionItems: ActionItem[];
  topics: string[];
  sentiment: string | null;
  score: number | null;
  provider: string;
  model: string;
  createdAt: number;
}

export interface Note {
  id: string;
  meetingId: string;
  content: string; // BlockNote JSON array serialized
  updatedAt: number;
}

// ─── Audio types (mirrors src-tauri/src/audio/devices.rs + commands/audio.rs) ─

export type AudioDeviceKind = "input" | "output";

export interface AudioDeviceInfo {
  id: string;
  name: string;
  isDefault: boolean;
  kind: AudioDeviceKind;
}

export interface RecordingStatus {
  isRecording: boolean;
  isPaused: boolean;
  meetingId: string | null;
  durationSeconds: number;
}

// ─── Whisper types (mirrors src-tauri/src/whisper/mod.rs) ───────────────────

export interface ModelCatalogEntry {
  id: string;
  displayName: string;
  description: string;
  sizeMb: number;
  accuracy: string;
  speed: string;
  badge: string | null;
  hfUrl: string;
  sha256: string;
}

export interface ModelStatus extends ModelCatalogEntry {
  downloaded: boolean;
  path: string | null;
}

// ─── LLM types (mirrors src-tauri/src/llm/providers.rs + summary.rs) ────────

export type LlmProvider =
  | "ollama"
  | "claude"
  | "open_ai"
  | "groq"
  | "open_router"
  | "mistral"
  | "custom";

export interface LlmConfig {
  provider: LlmProvider;
  model: string;
  apiKey: string | null;
  baseUrl: string | null;
  maxTokens: number;
  temperature: number;
}

export const defaultLlmConfig = (): LlmConfig => ({
  provider: "ollama",
  model: "llama3.2",
  apiKey: null,
  baseUrl: null,
  maxTokens: 2048,
  temperature: 0.3,
});

export interface GenerateSummaryRequest {
  meetingId: string;
  transcript: string;
  meetingTitle: string;
  durationSec: number | null;
}

export interface GenerateSummaryResponse {
  executiveSummary: string;
  actionItems: ActionItem[];
  topics: string[];
  sentiment: string;
  score: number;
}

// ─── Audio commands ──────────────────────────────────────────────────────────

export const getAudioDevices = (): Promise<AudioDeviceInfo[]> =>
  invoke("get_audio_devices");

export const startRecording = (title: string): Promise<string> =>
  invoke("start_recording", { title });

export const stopRecording = (): Promise<string> =>
  invoke("stop_recording");

export const pauseRecording = (): Promise<void> =>
  invoke("pause_recording");

export const resumeRecording = (): Promise<void> =>
  invoke("resume_recording");

export const getRecordingStatus = (): Promise<RecordingStatus> =>
  invoke("get_recording_status");

// ─── Meeting commands ────────────────────────────────────────────────────────

export const listMeetings = (
  limit?: number,
  offset?: number,
): Promise<MeetingCard[]> =>
  invoke("list_meetings", { limit: limit ?? null, offset: offset ?? null });

export const getMeeting = (id: string): Promise<Meeting> =>
  invoke("get_meeting", { id });

export const updateMeetingTitle = (id: string, title: string): Promise<void> =>
  invoke("update_meeting_title", { id, title });

export const deleteMeeting = (id: string): Promise<void> =>
  invoke("delete_meeting", { id });

export const getTranscript = (
  meetingId: string,
): Promise<Transcript | null> =>
  invoke("get_transcript", { meetingId });

export const getSummary = (meetingId: string): Promise<Summary | null> =>
  invoke("get_summary", { meetingId });

export const getNote = (meetingId: string): Promise<Note | null> =>
  invoke("get_note", { meetingId });

export const saveNote = (
  meetingId: string,
  content: string,
): Promise<void> => invoke("save_note", { meetingId, content });

export const exportMeetingMarkdown = (meetingId: string): Promise<string> =>
  invoke("export_meeting_markdown", { meetingId });

// ─── Settings commands ───────────────────────────────────────────────────────

export const getSetting = (key: string): Promise<string | null> =>
  invoke("get_setting", { key });

export const setSetting = (key: string, value: string): Promise<void> =>
  invoke("set_setting", { key, value });

export const getAppDataDir = (): Promise<string> =>
  invoke("get_app_data_dir");

export const deleteAllData = (): Promise<void> =>
  invoke("delete_all_data");

// ─── Whisper commands ────────────────────────────────────────────────────────

export const listWhisperModels = (): Promise<ModelStatus[]> =>
  invoke("list_whisper_models");

export const getDownloadedModels = (): Promise<string[]> =>
  invoke("get_downloaded_models");

export const downloadWhisperModel = (modelId: string): Promise<string> =>
  invoke("download_whisper_model", { modelId });

export const cancelWhisperDownload = (modelId: string): Promise<void> =>
  invoke("cancel_whisper_download", { modelId });

export const transcribeMeeting = (
  meetingId: string,
  language?: string,
): Promise<void> =>
  invoke("transcribe_meeting", { meetingId, language: language ?? null });

// ─── LLM commands ────────────────────────────────────────────────────────────

export const testLlmConnection = (config: LlmConfig): Promise<void> =>
  invoke("test_llm_connection", { config });

export const generateMeetingSummary = (
  req: GenerateSummaryRequest,
  config: LlmConfig,
): Promise<GenerateSummaryResponse> =>
  invoke("generate_meeting_summary", { req, config });

export const listOllamaModels = (
  baseUrl?: string,
): Promise<string[]> =>
  invoke("list_ollama_models", { baseUrl: baseUrl ?? null });

// ─── Licensing (freemium, mirrors src-tauri/src/licensing) ──────────────────

export type Tier = "free" | "pro";

export interface Entitlements {
  cloudLlm: boolean;
  largeModels: boolean;
  advancedExport: boolean;
  integrations: boolean;
}

export interface LicenseStatus {
  tier: Tier;
  email: string | null;
  entitlements: Entitlements;
  valid: boolean;
}

/** Get the current license status (Free if none/invalid). */
export const getLicenseStatus = (): Promise<LicenseStatus> =>
  invoke("get_license_status");

/** Verify + activate a license key. Rejects if the key is invalid. */
export const activateLicense = (key: string): Promise<LicenseStatus> =>
  invoke("activate_license", { key });

/** Remove the stored license, reverting to Free. */
export const deactivateLicense = (): Promise<void> =>
  invoke("deactivate_license");
