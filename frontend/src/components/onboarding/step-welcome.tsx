"use client";

import { useTranslations } from "next-intl";
import { ChevronRight, Shield, WifiOff, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export function StepWelcome({ onNext }: { onNext: () => void }) {
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
        <h1 className="text-3xl font-bold gradient-brand-text mb-3">{tCommon("name")}</h1>
        <p className="text-[var(--text-secondary)] max-w-sm leading-relaxed">{t("title")}</p>
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
