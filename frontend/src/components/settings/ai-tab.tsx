"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLicense } from "@/hooks/useLicense";
import {
  defaultLlmConfig,
  getSetting,
  listOllamaModels,
  setSetting,
  testLlmConnection,
  type LlmConfig,
  type LlmProvider,
} from "@/lib/tauri";
import { SETTINGS_KEYS } from "@/lib/settings-keys";
import { SummaryOptionsSection } from "@/components/settings/summary-options";

const CLOUD_PROVIDER_VALUES: LlmProvider[] = [
  "claude",
  "open_ai",
  "groq",
  "open_router",
  "mistral",
];

export function AiTab() {
  const t = useTranslations("settings");
  const { entitlements } = useLicense();
  const [llmConfig, setLlmConfig] = useState<LlmConfig>(defaultLlmConfig());
  const [testState, setTestState] = useState<"idle" | "testing" | "ok" | "failed">("idle");
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);

  useEffect(() => {
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

  const providers: { value: LlmProvider; label: string }[] = [
    { value: "claude", label: "Anthropic Claude" },
    { value: "open_ai", label: "OpenAI" },
    { value: "groq", label: "Groq" },
    { value: "open_router", label: "OpenRouter" },
    { value: "mistral", label: "Mistral AI" },
    { value: "ollama", label: "Local Ollama" },
    { value: "custom", label: "Custom endpoint" },
  ];

  return (
    <>
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
            {providers.map((p) => {
              const locked = CLOUD_PROVIDER_VALUES.includes(p.value) && !entitlements.cloudLlm;
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
                {ollamaModels.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
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

      <SummaryOptionsSection />
    </>
  );
}
