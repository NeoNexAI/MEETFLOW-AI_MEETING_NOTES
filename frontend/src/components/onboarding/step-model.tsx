"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { listen } from "@tauri-apps/api/event";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useLicense } from "@/hooks/useLicense";
import { downloadWhisperModel, listWhisperModels, type ModelStatus } from "@/lib/tauri";

type DownloadState = "idle" | "downloading" | "done" | "error";

export function StepModel({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
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
                    <Badge variant="default" className="text-[10px]">
                      {t("badges.recommended")}
                    </Badge>
                  )}
                  {model.badge === "best_value" && (
                    <Badge variant="secondary" className="text-[10px]">
                      {t("badges.best_value")}
                    </Badge>
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
