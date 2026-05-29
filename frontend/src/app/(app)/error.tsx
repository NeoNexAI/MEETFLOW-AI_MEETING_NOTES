"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Error boundary for the main app shell. Recovers a single route segment
 * without taking down the whole window. Sits inside the root layout, so
 * providers (i18n, query client) are still available here.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("common.error");

  useEffect(() => {
    console.error("[MeetFlow] route error:", error);
  }, [error]);

  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--error-subtle)]">
        <AlertTriangle className="h-6 w-6 text-[var(--error)]" />
      </div>
      <div className="max-w-sm space-y-1">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
          {t("title")}
        </h2>
        <p className="text-sm text-[var(--text-secondary)]">{t("description")}</p>
      </div>
      <Button onClick={() => reset()} variant="default" size="sm">
        {t("retry")}
      </Button>
    </div>
  );
}
