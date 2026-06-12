"use client";

import { useTranslations } from "next-intl";
import { ExternalLink, Github, Info } from "lucide-react";

export function AboutTab() {
  const t = useTranslations("settings");

  return (
    <>
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
    </>
  );
}
