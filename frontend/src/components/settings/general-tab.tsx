"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function GeneralTab() {
  const t = useTranslations("settings");
  const locale = useLocale();

  const changeLanguage = (next: string) => {
    localStorage.setItem("meetflow-locale", next);
    window.dispatchEvent(new CustomEvent("meetflow:locale", { detail: next }));
  };

  return (
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
  );
}
