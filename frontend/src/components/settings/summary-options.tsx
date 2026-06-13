"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { defaultSummaryOptions, getSetting, setSetting } from "@/lib/tauri";
import type { MeetingType, SummaryOptions, SummaryTone } from "@/lib/tauri";
import { SETTINGS_KEYS } from "@/lib/settings-keys";

const MEETING_TYPES: MeetingType[] = [
  "general",
  "one_on_one",
  "standup",
  "sales",
  "retro",
  "interview",
  "brainstorm",
  "planning",
];

const TONES: SummaryTone[] = ["professional", "casual", "concise", "detailed"];

/**
 * Summary personalization: meeting-type template, output tone, and free-form
 * custom instructions. Persisted as JSON under `summary_options`; read at
 * generation time in the meeting-detail Summary tab.
 */
export function SummaryOptionsSection() {
  const t = useTranslations("settings.summary_options");
  const [opts, setOpts] = useState<SummaryOptions>(defaultSummaryOptions());

  useEffect(() => {
    getSetting(SETTINGS_KEYS.summaryOptions)
      .then((raw) => {
        if (raw) setOpts(JSON.parse(raw) as SummaryOptions);
      })
      .catch(() => {});
  }, []);

  const save = (next: SummaryOptions) => {
    setOpts(next);
    void setSetting(SETTINGS_KEYS.summaryOptions, JSON.stringify(next)).catch(() => {});
  };

  return (
    <>
      <Separator />

      <section className="space-y-3">
        <label className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
          {t("meeting_type")}
        </label>
        <Select
          value={opts.meetingType}
          onValueChange={(v) => save({ ...opts, meetingType: v as MeetingType })}
        >
          <SelectTrigger className="max-w-md">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MEETING_TYPES.map((m) => (
              <SelectItem key={m} value={m}>
                {t(`types.${m}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      <section className="space-y-3">
        <label className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
          {t("tone")}
        </label>
        <Select
          value={opts.tone}
          onValueChange={(v) => save({ ...opts, tone: v as SummaryTone })}
        >
          <SelectTrigger className="max-w-md">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TONES.map((tone) => (
              <SelectItem key={tone} value={tone}>
                {t(`tones.${tone}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      <section className="space-y-3">
        <label className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
          {t("custom_instructions")}
        </label>
        <textarea
          value={opts.customInstructions}
          onChange={(e) => save({ ...opts, customInstructions: e.target.value })}
          placeholder={t("custom_placeholder")}
          rows={3}
          className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] resize-none focus:outline-none focus:border-[var(--accent)]"
        />
      </section>
    </>
  );
}
