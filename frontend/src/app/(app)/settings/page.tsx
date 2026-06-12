"use client";

import React, { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { listen } from "@tauri-apps/api/event";
import { useLicense } from "@/hooks/useLicense";
import {
  FolderOpen,
  Trash2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Github,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  getSetting,
  setSetting,
  getAppDataDir,
  deleteAllData,
  testLlmConnection,
  listOllamaModels,
  getAudioDevices,
  listWhisperModels,
  downloadWhisperModel,
  getLicenseStatus,
  activateLicense,
  deactivateLicense,
  type AudioDeviceInfo,
  type ModelStatus,
  type LicenseStatus,
  type LlmConfig,
  type LlmProvider,
  defaultLlmConfig,
} from "@/lib/tauri";
import { SETTINGS_KEYS } from "@/lib/settings-keys";
import { toast } from "sonner";

/**
 * Stripe Payment Link for the Pro upgrade. Replace with the operator's real
 * Payment Link before release (see docs/playbooks/release.md). After purchase,
 * the buyer receives a license key by email and pastes it below.
 */
const STRIPE_CHECKOUT_URL = "https://buy.stripe.com/test_meetflow_pro";

export default function SettingsPage() {
  const t = useTranslations("settings");
  const tc = useTranslations("common.button");
  const locale = useLocale();
  const { entitlements } = useLicense();
  const [tab, setTab] = useState("general");

  const CLOUD_PROVIDER_VALUES: LlmProvider[] = [
    "claude",
    "open_ai",
    "groq",
    "open_router",
    "mistral",
  ];

  // ── Audio + Transcription state ──
  const [audioDevices, setAudioDevices] = useState<AudioDeviceInfo[]>([]);
  const [inputDevice, setInputDevice] = useState("");
  const [models, setModels] = useState<ModelStatus[]>([]);
  const [activeModel, setActiveModel] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);

  // ── Licensing (freemium) state ──
  const [license, setLicense] = useState<LicenseStatus | null>(null);
  const [licenseKey, setLicenseKey] = useState("");
  const [activating, setActivating] = useState(false);

  const refreshModels = () => {
    listWhisperModels().then(setModels).catch(() => {});
  };

  useEffect(() => {
    getAudioDevices()
      .then((d) => setAudioDevices(d.filter((x) => x.kind === "input")))
      .catch(() => {});
    getSetting(SETTINGS_KEYS.audioInputDevice).then((v) => setInputDevice(v ?? "")).catch(() => {});
    getSetting(SETTINGS_KEYS.whisperModel).then((v) => setActiveModel(v ?? "")).catch(() => {});
    getLicenseStatus().then(setLicense).catch(() => {});
    refreshModels();
  }, []);

  // Refresh the model list when a download finishes or fails.
  useEffect(() => {
    const done = listen("model-download-complete", () => {
      setDownloading(null);
      refreshModels();
      toast.success(t("transcription.downloaded"));
    });
    const err = listen<{ error?: string }>("model-download-error", (e) => {
      setDownloading(null);
      toast.error(e.payload?.error ?? "Download failed");
    });
    return () => {
      done.then((u) => u());
      err.then((u) => u());
    };
  }, [t]);

  const changeLanguage = (next: string) => {
    localStorage.setItem("meetflow-locale", next);
    window.dispatchEvent(new CustomEvent("meetflow:locale", { detail: next }));
  };

  const changeInputDevice = (name: string) => {
    setInputDevice(name);
    void setSetting(SETTINGS_KEYS.audioInputDevice, name).catch(() => {});
  };

  const changeActiveModel = (id: string) => {
    setActiveModel(id);
    void setSetting(SETTINGS_KEYS.whisperModel, id).catch(() => {});
  };

  const handleDownloadModel = (id: string) => {
    setDownloading(id);
    downloadWhisperModel(id).catch((e) => {
      setDownloading(null);
      toast.error(`${e}`);
    });
  };

  const handleActivate = async () => {
    setActivating(true);
    try {
      const status = await activateLicense(licenseKey);
      setLicense(status);
      setLicenseKey("");
      toast.success(t("plan.activated"));
    } catch {
      toast.error(t("plan.invalid"));
    } finally {
      setActivating(false);
    }
  };

  const handleDeactivate = async () => {
    try {
      await deactivateLicense();
      setLicense(await getLicenseStatus());
    } catch (e) {
      toast.error(`${e}`);
    }
  };
  const [dataDir, setDataDir] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [llmConfig, setLlmConfig] = useState<LlmConfig>(defaultLlmConfig());
  const [testState, setTestState] = useState<"idle" | "testing" | "ok" | "failed">("idle");
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);

  useEffect(() => {
    getAppDataDir().then(setDataDir).catch(() => {});
    getSetting(SETTINGS_KEYS.llmConfig)
      .then((raw) => {
        if (raw) setLlmConfig(JSON.parse(raw) as LlmConfig);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (llmConfig.provider === "ollama") {
      listOllamaModels(llmConfig.baseUrl ?? undefined)
        .then(setOllamaModels)
        .catch(() => setOllamaModels([]));
    }
  }, [llmConfig.provider, llmConfig.baseUrl]);

  const saveConfig = async (updated: LlmConfig) => {
    setLlmConfig(updated);
    await setSetting(SETTINGS_KEYS.llmConfig, JSON.stringify(updated)).catch(() => {});
  };

  const handleTest = async () => {
    setTestState("testing");
    try {
      await testLlmConnection(llmConfig);
      setTestState("ok");
    } catch {
      setTestState("failed");
    }
  };

  const handleDeleteAll = async () => {
    setDeleting(true);
    try {
      await deleteAllData();
      toast.success("All data deleted");
      setDeleteDialog(false);
    } catch (e) {
      toast.error(`Failed to delete data: ${e}`);
    } finally {
      setDeleting(false);
    }
  };

  const CLOUD_PROVIDERS: { value: LlmProvider; label: string; models: string[] }[] = [
    { value: "claude", label: "Anthropic Claude", models: ["claude-opus-4-5", "claude-sonnet-4-5", "claude-haiku-3-5"] },
    { value: "open_ai", label: "OpenAI", models: ["gpt-4o", "gpt-4o-mini"] },
    { value: "groq", label: "Groq", models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"] },
    { value: "open_router", label: "OpenRouter", models: ["openai/gpt-4o", "anthropic/claude-3.5-sonnet"] },
    { value: "mistral", label: "Mistral AI", models: ["mistral-large-latest", "mistral-small-latest"] },
    { value: "ollama", label: "Local Ollama", models: ollamaModels },
    { value: "custom", label: "Custom endpoint", models: [] },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-5 pt-4 pb-3 border-b border-[var(--border-subtle)] shrink-0">
        <h1 className="text-base font-semibold text-[var(--text-primary)]">{t("title")}</h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        <Tabs value={tab} onValueChange={setTab} className="flex flex-col">
          <div className="px-5 pt-3 border-b border-[var(--border-subtle)]">
            <TabsList className="gap-0.5">
              <TabsTrigger value="general">{t("tabs.general")}</TabsTrigger>
              <TabsTrigger value="audio">{t("tabs.audio")}</TabsTrigger>
              <TabsTrigger value="transcription">{t("tabs.transcription")}</TabsTrigger>
              <TabsTrigger value="ai">{t("tabs.ai")}</TabsTrigger>
              <TabsTrigger value="plan">{t("tabs.plan")}</TabsTrigger>
              <TabsTrigger value="privacy">{t("tabs.privacy")}</TabsTrigger>
              <TabsTrigger value="about">{t("tabs.about")}</TabsTrigger>
            </TabsList>
          </div>

          {/* ── General ── */}
          <TabsContent value="general" className="px-5 py-5 space-y-5">
            <section className="space-y-3">
              <label className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                {t("general.language")}
              </label>
              <Select value={locale} onValueChange={changeLanguage}>
                <SelectTrigger className="max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                </SelectContent>
              </Select>
            </section>
          </TabsContent>

          {/* ── Audio ── */}
          <TabsContent value="audio" className="px-5 py-5 space-y-5">
            <section className="space-y-3">
              <label className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                {t("audio.microphone")}
              </label>
              <Select
                value={inputDevice || "__default__"}
                onValueChange={(v) => changeInputDevice(v === "__default__" ? "" : v)}
              >
                <SelectTrigger className="max-w-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__default__">{t("audio.default_device")}</SelectItem>
                  {audioDevices.map((d) => (
                    <SelectItem key={d.id} value={d.name}>
                      {d.name}
                      {d.isDefault ? ` (${t("audio.default_device")})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-[var(--text-tertiary)]">{t("audio.hint")}</p>
            </section>
          </TabsContent>

          {/* ── Transcription ── */}
          <TabsContent value="transcription" className="px-5 py-5 space-y-5">
            <section className="space-y-3">
              <label className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                {t("transcription.download_models")}
              </label>
              <div className="space-y-2">
                {models.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        {m.displayName}
                      </p>
                      <p className="text-xs text-[var(--text-tertiary)]">
                        {m.sizeMb} MB · {m.accuracy}
                      </p>
                    </div>
                    {m.downloaded ? (
                      <Badge variant="secondary">{t("transcription.downloaded")}</Badge>
                    ) : m.requiresPro && !entitlements.largeModels ? (
                      <Badge variant="default">Pro</Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        loading={downloading === m.id}
                        disabled={downloading !== null}
                        onClick={() => handleDownloadModel(m.id)}
                      >
                        {tc("download")}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <Separator />

            <section className="space-y-3">
              <label className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                {t("transcription.model")}
              </label>
              <Select
                value={activeModel || "__auto__"}
                onValueChange={(v) => changeActiveModel(v === "__auto__" ? "" : v)}
              >
                <SelectTrigger className="max-w-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__auto__">{t("transcription.auto_detect")}</SelectItem>
                  {models
                    .filter((m) => m.downloaded)
                    .map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.displayName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </section>
          </TabsContent>

          {/* ── AI & Summaries ── */}
          <TabsContent value="ai" className="px-5 py-5 space-y-5">
            <section className="space-y-3">
              <label className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                {t("ai.provider")}
              </label>
              <Select
                value={llmConfig.provider}
                onValueChange={(v) => saveConfig({ ...llmConfig, provider: v as LlmProvider })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLOUD_PROVIDERS.map((p) => {
                    const locked =
                      CLOUD_PROVIDER_VALUES.includes(p.value) && !entitlements.cloudLlm;
                    return (
                      <SelectItem key={p.value} value={p.value} disabled={locked}>
                        {p.label}
                        {locked ? " · Pro" : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </section>

            {llmConfig.provider !== "custom" && (
              <section className="space-y-3">
                <label className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                  {t("ai.model")}
                </label>
                {llmConfig.provider === "ollama" && ollamaModels.length > 0 ? (
                  <Select
                    value={llmConfig.model}
                    onValueChange={(v) => saveConfig({ ...llmConfig, model: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ollamaModels.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={llmConfig.model}
                    onChange={(e) => saveConfig({ ...llmConfig, model: e.target.value })}
                    placeholder="Model name"
                  />
                )}
              </section>
            )}

            {llmConfig.provider !== "ollama" && (
              <section className="space-y-3">
                <label className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                  API Key
                </label>
                <Input
                  type="password"
                  value={llmConfig.apiKey ?? ""}
                  onChange={(e) => saveConfig({ ...llmConfig, apiKey: e.target.value || null })}
                  placeholder="sk-…"
                />
              </section>
            )}

            {(llmConfig.provider === "ollama" || llmConfig.provider === "custom") && (
              <section className="space-y-3">
                <label className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                  Base URL
                </label>
                <Input
                  value={llmConfig.baseUrl ?? ""}
                  onChange={(e) => saveConfig({ ...llmConfig, baseUrl: e.target.value || null })}
                  placeholder="http://localhost:11434"
                />
              </section>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleTest}
              loading={testState === "testing"}
              className="gap-2"
            >
              {testState === "ok" && <CheckCircle2 className="w-3.5 h-3.5 text-[var(--success)]" />}
              {testState === "failed" && <XCircle className="w-3.5 h-3.5 text-[var(--error)]" />}
              {t("ai.test")}
            </Button>
          </TabsContent>

          {/* ── Plan & licensing ── */}
          <TabsContent value="plan" className="px-5 py-5 space-y-5">
            <section className="flex items-center justify-between rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  {license?.tier === "pro" ? t("plan.current_pro") : t("plan.current_free")}
                </p>
                {license?.email && (
                  <p className="text-xs text-[var(--text-tertiary)]">{license.email}</p>
                )}
              </div>
              <Badge variant={license?.tier === "pro" ? "default" : "secondary"}>
                {license?.tier === "pro" ? "Pro" : "Free"}
              </Badge>
            </section>

            {license?.tier === "pro" ? (
              <section className="space-y-3">
                <Button variant="outline" size="sm" onClick={handleDeactivate}>
                  {t("plan.deactivate")}
                </Button>
              </section>
            ) : (
              <>
                <section className="space-y-2">
                  <p className="text-sm text-[var(--text-secondary)]">{t("plan.upgrade_hint")}</p>
                  <a href={STRIPE_CHECKOUT_URL} target="_blank" rel="noopener noreferrer">
                    <Button variant="default" size="sm" className="gap-2">
                      {t("plan.upgrade")}
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </a>
                </section>

                <Separator />

                <section className="space-y-3">
                  <label className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                    {t("plan.key_label")}
                  </label>
                  <div className="flex gap-2">
                    <Input
                      value={licenseKey}
                      onChange={(e) => setLicenseKey(e.target.value)}
                      placeholder={t("plan.key_placeholder")}
                      className="flex-1 font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      loading={activating}
                      disabled={!licenseKey.trim()}
                      onClick={handleActivate}
                    >
                      {t("plan.activate")}
                    </Button>
                  </div>
                </section>
              </>
            )}
          </TabsContent>

          {/* ── Privacy ── */}
          <TabsContent value="privacy" className="px-5 py-5 space-y-5">
            <section className="space-y-2">
              <label className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                {t("privacy.data_location")}
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded px-2.5 py-1.5 truncate text-[var(--text-secondary)]">
                  {dataDir ?? "…"}
                </code>
                <Button variant="outline" size="icon-sm" aria-label="Open folder">
                  <FolderOpen className="w-3.5 h-3.5" />
                </Button>
              </div>
            </section>

            <Separator />

            <section className="space-y-3">
              <label className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                Danger zone
              </label>
              <div className="rounded-xl border border-[var(--error)]/30 p-4 space-y-2">
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {t("privacy.delete_all.label")}
                </p>
                <p className="text-xs text-[var(--text-tertiary)]">
                  {t("privacy.delete_all.confirm_description")}
                </p>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteDialog(true)}
                  className="gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {t("privacy.delete_all.label")}
                </Button>
              </div>
            </section>
          </TabsContent>

          {/* ── About ── */}
          <TabsContent value="about" className="px-5 py-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center">
                <Info className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">MeetFlow</p>
                <p className="text-xs text-[var(--text-tertiary)]">v0.1.0 · MIT License</p>
              </div>
            </div>
            <div className="space-y-2">
              <a
                href="https://github.com/JonatanGhub/MEETFLOW-AI_MEETING_NOTES"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-[var(--accent)] hover:underline"
              >
                <Github className="w-4 h-4" />
                {t("about.github")}
                <ExternalLink className="w-3 h-3 opacity-50" />
              </a>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("privacy.delete_all.confirm_title")}</DialogTitle>
            <DialogDescription>{t("privacy.delete_all.confirm_description")}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDeleteDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteAll} loading={deleting}>
              {t("privacy.delete_all.confirm_button")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
