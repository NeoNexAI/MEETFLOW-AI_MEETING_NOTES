"use client";

import React, { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Loader2,
  Server,
  Settings2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  listOllamaModels,
  setSetting,
  testLlmConnection,
  type LlmConfig,
  type LlmProvider,
} from "@/lib/tauri";
import { SETTINGS_KEYS } from "@/lib/settings-keys";

type AiMode = "local" | "cloud" | "custom";

const CLOUD_PROVIDERS: { value: LlmProvider; label: string; models: string[] }[] = [
  { value: "claude", label: "Anthropic Claude", models: ["claude-opus-4-5", "claude-sonnet-4-5", "claude-haiku-3-5"] },
  { value: "open_ai", label: "OpenAI", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"] },
  { value: "groq", label: "Groq (free tier, fast)", models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"] },
  { value: "open_router", label: "OpenRouter", models: ["openai/gpt-4o", "anthropic/claude-3.5-sonnet", "google/gemini-flash-1.5"] },
  { value: "mistral", label: "Mistral AI", models: ["mistral-large-latest", "mistral-small-latest"] },
];

export function StepAiProvider({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const t = useTranslations("onboarding.ai_provider");
  const tc = useTranslations("common.button");
  const [mode, setMode] = useState<AiMode>("local");
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [ollamaDetected, setOllamaDetected] = useState<boolean | null>(null);
  const [selectedModel, setSelectedModel] = useState("llama3.2");
  const [cloudProvider, setCloudProvider] = useState<LlmProvider>("claude");
  const [apiKey, setApiKey] = useState("");
  const [customUrl, setCustomUrl] = useState("http://localhost:1234/v1");
  const [customModel, setCustomModel] = useState("local-model");
  const [testState, setTestState] = useState<"idle" | "testing" | "ok" | "failed">("idle");

  useEffect(() => {
    // Auto-detect Ollama
    setOllamaDetected(null);
    listOllamaModels()
      .then((models) => {
        setOllamaDetected(true);
        setOllamaModels(models);
        if (models.length > 0) setSelectedModel(models[0]);
      })
      .catch(() => {
        setOllamaDetected(false);
      });
  }, []);

  const handleTest = async () => {
    setTestState("testing");
    const config = buildConfig();
    try {
      await testLlmConnection(config);
      setTestState("ok");
    } catch {
      setTestState("failed");
    }
  };

  const buildConfig = (): LlmConfig => {
    if (mode === "local") {
      return { provider: "ollama", model: selectedModel, apiKey: null, baseUrl: null, maxTokens: 2048, temperature: 0.3 };
    }
    if (mode === "cloud") {
      const providerData = CLOUD_PROVIDERS.find((p) => p.value === cloudProvider)!;
      return { provider: cloudProvider, model: providerData.models[0], apiKey: apiKey || null, baseUrl: null, maxTokens: 2048, temperature: 0.3 };
    }
    return { provider: "custom", model: customModel, apiKey: null, baseUrl: customUrl, maxTokens: 2048, temperature: 0.3 };
  };

  const handleFinish = async () => {
    const config = buildConfig();
    await setSetting(SETTINGS_KEYS.llmConfig, JSON.stringify(config));
    onNext();
  };

  const MODES: { key: AiMode; icon: React.ComponentType<{ className?: string }>; label: string; description: string }[] = [
    { key: "local", icon: Server, label: t("modes.local.label"), description: t("modes.local.description") },
    { key: "cloud", icon: Cloud, label: t("modes.cloud.label"), description: t("modes.cloud.description") },
    { key: "custom", icon: Settings2, label: t("modes.custom.label"), description: t("modes.custom.description") },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">{t("title")}</h2>
        <p className="text-sm text-[var(--text-secondary)] mt-1">{t("subtitle")}</p>
      </div>

      {/* Mode selector */}
      <div className="grid grid-cols-3 gap-2">
        {MODES.map(({ key, icon: Icon, label, description }) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            className={cn(
              "flex flex-col items-center gap-2 p-3.5 rounded-xl border text-center transition-all",
              mode === key
                ? "border-[var(--accent)] bg-[var(--accent-subtle)]"
                : "border-[var(--border-default)] bg-[var(--bg-elevated)] hover:border-[var(--border-strong)]"
            )}
          >
            <Icon className={cn("w-5 h-5", mode === key ? "text-[var(--accent)]" : "text-[var(--text-tertiary)]")} />
            <span className="text-xs font-semibold text-[var(--text-primary)]">{label}</span>
            <span className="text-[10px] text-[var(--text-tertiary)] leading-snug">{description}</span>
          </button>
        ))}
      </div>

      {/* Mode-specific config */}
      {mode === "local" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            {ollamaDetected === null && <Loader2 className="w-4 h-4 animate-spin text-[var(--text-tertiary)]" />}
            {ollamaDetected === true && <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />}
            {ollamaDetected === false && <XCircle className="w-4 h-4 text-[var(--error)]" />}
            <span className="text-[var(--text-secondary)]">
              {ollamaDetected === null
                ? t("modes.local.detecting")
                : ollamaDetected
                ? t("modes.local.detected")
                : t("modes.local.not_found")}
            </span>
            {ollamaDetected === false && (
              <a
                href="https://ollama.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent)] text-xs hover:underline ml-2"
              >
                {t("modes.local.install_cta")}
              </a>
            )}
          </div>
          {ollamaDetected && ollamaModels.length > 0 && (
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger>
                <SelectValue placeholder={t("model_placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {ollamaModels.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {mode === "cloud" && (
        <div className="space-y-3">
          <Select value={cloudProvider} onValueChange={(v) => setCloudProvider(v as LlmProvider)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CLOUD_PROVIDERS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={t("modes.cloud.api_key_placeholder")}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleTest}
            loading={testState === "testing"}
            className="gap-2"
          >
            {testState === "ok" && <CheckCircle2 className="w-3.5 h-3.5 text-[var(--success)]" />}
            {testState === "failed" && <XCircle className="w-3.5 h-3.5 text-[var(--error)]" />}
            {testState === "ok" ? t("modes.cloud.ok") : testState === "failed" ? t("modes.cloud.failed") : t("modes.cloud.test")}
          </Button>
        </div>
      )}

      {mode === "custom" && (
        <div className="space-y-3">
          <Input
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            placeholder={t("modes.custom.url_placeholder")}
          />
          <Input
            value={customModel}
            onChange={(e) => setCustomModel(e.target.value)}
            placeholder={t("modes.custom.model_label")}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleTest}
            loading={testState === "testing"}
            className="gap-2"
          >
            {testState === "ok" && <CheckCircle2 className="w-3.5 h-3.5 text-[var(--success)]" />}
            {testState === "failed" && <XCircle className="w-3.5 h-3.5 text-[var(--error)]" />}
            {t("modes.custom.test")}
          </Button>
        </div>
      )}

      <div className="flex gap-3 justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="w-4 h-4" /> {tc("back")}
        </Button>
        <Button onClick={handleFinish} className="gap-2">
          Start using MeetFlow
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
