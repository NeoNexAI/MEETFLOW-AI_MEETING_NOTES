"use client";

import React, { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Shield,
  Zap,
  WifiOff,
  Download,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Server,
  Cloud,
  Settings2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useLicense } from "@/hooks/useLicense";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";
import {
  listWhisperModels,
  downloadWhisperModel,
  testLlmConnection,
  listOllamaModels,
  setSetting,
  type ModelStatus,
  type LlmConfig,
  type LlmProvider,
} from "@/lib/tauri";
import { listen } from "@tauri-apps/api/event";

const TOTAL_STEPS = 3;

// ─── Step 1: Welcome ─────────────────────────────────────────────────────────

function StepWelcome({ onNext }: { onNext: () => void }) {
  const t = useTranslations("onboarding.welcome");
  const tCommon = useTranslations("common.app");

  const features = [
    {
      key: "privacy",
      icon: Shield,
      title: t("features.privacy.title"),
      description: t("features.privacy.description"),
    },
    {
      key: "ai",
      icon: Zap,
      title: t("features.ai.title"),
      description: t("features.ai.description"),
    },
    {
      key: "offline",
      icon: WifiOff,
      title: t("features.offline.title"),
      description: t("features.offline.description"),
    },
  ];

  return (
    <div className="flex flex-col items-center gap-8 text-center">
      {/* Logo */}
      <div className="flex items-center justify-center w-20 h-20 rounded-3xl gradient-brand">
        <Zap className="w-10 h-10 text-white" />
      </div>

      <div>
        <h1 className="text-3xl font-bold gradient-brand-text mb-3">
          {tCommon("name")}
        </h1>
        <p className="text-[var(--text-secondary)] max-w-sm leading-relaxed">
          {t("title")}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 w-full max-w-lg">
        {features.map(({ key, icon: Icon, title, description }) => (
          <div
            key={key}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-center"
          >
            <div className="w-9 h-9 rounded-lg bg-[var(--accent-subtle)] flex items-center justify-center">
              <Icon className="w-4.5 h-4.5 text-[var(--accent)]" />
            </div>
            <span className="text-xs font-semibold text-[var(--text-primary)]">{title}</span>
            <span className="text-xs text-[var(--text-tertiary)] leading-snug">{description}</span>
          </div>
        ))}
      </div>

      <Button size="xl" onClick={onNext} className="gap-2 min-w-[200px]">
        {t("cta")}
        <ChevronRight className="w-5 h-5" />
      </Button>
    </div>
  );
}

// ─── Step 2: Model download ───────────────────────────────────────────────────

type DownloadState = "idle" | "downloading" | "done" | "error";

function StepModel({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const t = useTranslations("onboarding.model");
  const tc = useTranslations("common.button");
  const { entitlements } = useLicense();
  const [models, setModels] = useState<ModelStatus[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [, setDownloadState] = useState<DownloadState>("idle");

  useEffect(() => {
    listWhisperModels().then(setModels).catch(() => {});
  }, []);

  useEffect(() => {
    // Listen to download progress events
    const unlisten = listen<{ modelId: string; percent: number }>(
      "model-download-progress",
      (ev) => {
        if (ev.payload.modelId === downloading) {
          setProgress(ev.payload.percent);
        }
      }
    );
    const unlistenDone = listen<{ modelId: string }>("model-download-complete", (ev) => {
      if (ev.payload.modelId === downloading) {
        setDownloadState("done");
        setDownloading(null);
        listWhisperModels().then(setModels).catch(() => {});
      }
    });
    const unlistenErr = listen<{ modelId: string }>("model-download-error", (ev) => {
      if (ev.payload.modelId === downloading) {
        setDownloadState("error");
        setDownloading(null);
      }
    });
    return () => {
      unlisten.then((f) => f());
      unlistenDone.then((f) => f());
      unlistenErr.then((f) => f());
    };
  }, [downloading]);

  const handleDownload = async (modelId: string) => {
    setSelected(modelId);
    setDownloading(modelId);
    setProgress(0);
    setDownloadState("downloading");
    try {
      await downloadWhisperModel(modelId);
    } catch {
      setDownloadState("error");
      setDownloading(null);
    }
  };

  const hasAnyDownloaded = models.some((m) => m.downloaded);

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">{t("title")}</h2>
        <p className="text-sm text-[var(--text-secondary)] mt-1">{t("subtitle")}</p>
      </div>

      <div className="space-y-2">
        {models.map((model) => {
          const isSelected = selected === model.id;
          const isDownloading = downloading === model.id;
          const isDone = model.downloaded;

          return (
            <div
              key={model.id}
              className={cn(
                "flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all",
                isSelected
                  ? "border-[var(--accent)] bg-[var(--accent-subtle)]"
                  : "border-[var(--border-default)] bg-[var(--bg-elevated)] hover:border-[var(--border-strong)]",
                isDone && "cursor-default"
              )}
              onClick={() => !isDone && !isDownloading && setSelected(model.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    {model.displayName}
                  </span>
                  {model.badge === "recommended" && (
                    <Badge variant="default" className="text-[10px]">{t("badges.recommended")}</Badge>
                  )}
                  {model.badge === "best_value" && (
                    <Badge variant="secondary" className="text-[10px]">{t("badges.best_value")}</Badge>
                  )}
                  {isDone && (
                    <Badge variant="success" className="text-[10px]">
                      <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />
                      Ready
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{model.description}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-[var(--text-tertiary)]">
                  <span>{model.sizeMb} MB</span>
                  <span>·</span>
                  <span>Speed: {model.speed}</span>
                  <span>·</span>
                  <span>Accuracy: {model.accuracy}</span>
                </div>
                {isDownloading && (
                  <div className="mt-2">
                    <Progress value={progress} className="h-1" />
                    <span className="text-xs text-[var(--text-tertiary)] mt-0.5">
                      {Math.round(progress)}%
                    </span>
                  </div>
                )}
              </div>

              <div className="shrink-0">
                {isDone ? (
                  <CheckCircle2 className="w-5 h-5 text-[var(--success)]" />
                ) : isDownloading ? (
                  <Loader2 className="w-5 h-5 text-[var(--accent)] animate-spin" />
                ) : model.requiresPro && !entitlements.largeModels ? (
                  <Badge variant="default" className="text-[10px]">
                    Pro
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    variant={isSelected ? "default" : "outline"}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(model.id);
                    }}
                    disabled={!!downloading}
                  >
                    <Download className="w-3.5 h-3.5" />
                    {t("download.start")}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-3 justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="w-4 h-4" /> {tc("back")}
        </Button>
        <Button
          onClick={onNext}
          disabled={!!downloading}
          variant={hasAnyDownloaded ? "default" : "secondary"}
          className="gap-2"
        >
          {hasAnyDownloaded ? "Next" : "Skip for now"}
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Step 3: AI provider ──────────────────────────────────────────────────────

type AiMode = "local" | "cloud" | "custom";

const CLOUD_PROVIDERS: { value: LlmProvider; label: string; models: string[] }[] = [
  { value: "claude", label: "Anthropic Claude", models: ["claude-opus-4-5", "claude-sonnet-4-5", "claude-haiku-3-5"] },
  { value: "open_ai", label: "OpenAI", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"] },
  { value: "groq", label: "Groq (free tier, fast)", models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"] },
  { value: "open_router", label: "OpenRouter", models: ["openai/gpt-4o", "anthropic/claude-3.5-sonnet", "google/gemini-flash-1.5"] },
  { value: "mistral", label: "Mistral AI", models: ["mistral-large-latest", "mistral-small-latest"] },
];

function StepAiProvider({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
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
    listOllamaModels().then((models) => {
      setOllamaDetected(true);
      setOllamaModels(models);
      if (models.length > 0) setSelectedModel(models[0]);
    }).catch(() => {
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
    await setSetting("llm_config", JSON.stringify(config));
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
                  <SelectItem key={m} value={m}>{m}</SelectItem>
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
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
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

// ─── Onboarding shell ─────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const { setOnboardingComplete } = useAppStore();
  const [step, setStep] = useState(1);

  const handleComplete = () => {
    setOnboardingComplete(true);
    router.push("/record");
  };

  const steps = [
    <StepWelcome key="welcome" onNext={() => setStep(2)} />,
    <StepModel key="model" onNext={() => setStep(3)} onBack={() => setStep(1)} />,
    <StepAiProvider key="ai" onNext={handleComplete} onBack={() => setStep(2)} />,
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--bg-base)] px-6 py-10">
      {/* Progress indicator */}
      {step > 1 && (
        <div className="flex items-center gap-1.5 mb-8">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1 rounded-full transition-all duration-300",
                i + 1 <= step ? "bg-[var(--accent)] w-6" : "bg-[var(--border-strong)] w-3"
              )}
            />
          ))}
        </div>
      )}

      {/* Step content */}
      <div className="w-full max-w-lg">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {steps[step - 1]}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
