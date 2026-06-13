"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GeneralTab } from "@/components/settings/general-tab";
import { AudioTab } from "@/components/settings/audio-tab";
import { TranscriptionTab } from "@/components/settings/transcription-tab";
import { AiTab } from "@/components/settings/ai-tab";
import { PlanTab } from "@/components/settings/plan-tab";
import { PrivacyTab } from "@/components/settings/privacy-tab";
import { AboutTab } from "@/components/settings/about-tab";

/**
 * Settings shell: tab navigation only. Each tab owns its state, effects and
 * IPC calls in `@/components/settings/*` — keeps this page well under the
 * 500-line file limit and lets tabs load their data lazily on activation.
 */
export default function SettingsPage() {
  const t = useTranslations("settings");
  const [tab, setTab] = useState("general");

  const tabs = [
    { value: "general", label: t("tabs.general"), content: <GeneralTab /> },
    { value: "audio", label: t("tabs.audio"), content: <AudioTab /> },
    { value: "transcription", label: t("tabs.transcription"), content: <TranscriptionTab /> },
    { value: "ai", label: t("tabs.ai"), content: <AiTab /> },
    { value: "plan", label: t("tabs.plan"), content: <PlanTab /> },
    { value: "privacy", label: t("tabs.privacy"), content: <PrivacyTab /> },
    { value: "about", label: t("tabs.about"), content: <AboutTab /> },
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
              {tabs.map(({ value, label }) => (
                <TabsTrigger key={value} value={value}>
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {tabs.map(({ value, content }) => (
            <TabsContent
              key={value}
              value={value}
              className={value === "about" ? "px-5 py-5 space-y-4" : "px-5 py-5 space-y-5"}
            >
              {content}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
