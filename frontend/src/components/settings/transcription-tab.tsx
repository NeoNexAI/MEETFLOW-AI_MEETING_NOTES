"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { listen } from "@tauri-apps/api/event";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLicense } from "@/hooks/useLicense";
import {
  downloadWhisperModel,
  getSetting,
  listWhisperModels,
  setSetting,
  type ModelStatus,
} from "@/lib/tauri";
import { SETTINGS_KEYS } from "@/lib/settings-keys";

export function TranscriptionTab() {
  const t = useTranslations("settings");
  const tc = useTranslations("common.button");
  const { entitlements } = useLicense();
  const [models, setModels] = useState<ModelStatus[]>([]);
  const [activeModel, setActiveModel] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);

  const refreshModels = () => {
    listWhisperModels().then(setModels).catch(() => {});
  };

  useEffect(() => {
    getSetting(SETTINGS_KEYS.whisperModel)
      .then((v) => setActiveModel(v ?? ""))
      .catch(() => {});
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

  return (
    <>
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
                <p className="text-sm font-medium text-[var(--text-primary)]">{m.displayName}</p>
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
    </>
  );
}
