"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { CheckSquare, Loader2, Sparkles, Tag, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useGenerateSummary, useSummary, useTranscript } from "@/hooks/useMeetings";
import { defaultSummaryOptions, getSetting } from "@/lib/tauri";
import type { LlmConfig, LlmProvider, SummaryOptions } from "@/lib/tauri";
import { SETTINGS_KEYS } from "@/lib/settings-keys";

function ActionItemList({
  items,
}: {
  items: { text: string; assignee: string | null; due: string | null; done: boolean }[];
}) {
  if (!items.length)
    return <p className="text-sm text-[var(--text-tertiary)]">No action items found.</p>;
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5 text-sm">
          <CheckSquare className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="text-[var(--text-primary)]">{item.text}</span>
            {item.assignee && (
              <span className="text-[var(--text-tertiary)] ml-2">— {item.assignee}</span>
            )}
            {item.due && <span className="text-[var(--text-tertiary)] ml-2">· {item.due}</span>}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function SummaryTab({
  meetingId,
  title,
  durationSec,
}: {
  meetingId: string;
  title: string;
  durationSec: number | null;
}) {
  const t = useTranslations("meetings.detail.summary");
  const { data: transcript } = useTranscript(meetingId);
  const { data: summary, isLoading } = useSummary(meetingId);
  const generateMutation = useGenerateSummary(meetingId);

  const handleGenerate = async () => {
    if (!transcript?.content) return;
    let config: LlmConfig;
    try {
      const raw = await getSetting(SETTINGS_KEYS.llmConfig);
      config = raw
        ? (JSON.parse(raw) as LlmConfig)
        : {
            provider: "ollama" as LlmProvider,
            model: "llama3.2",
            apiKey: null,
            baseUrl: null,
            maxTokens: 2048,
            temperature: 0.3,
          };
    } catch {
      config = {
        provider: "ollama" as LlmProvider,
        model: "llama3.2",
        apiKey: null,
        baseUrl: null,
        maxTokens: 2048,
        temperature: 0.3,
      };
    }
    let options: SummaryOptions;
    try {
      const rawOpts = await getSetting(SETTINGS_KEYS.summaryOptions);
      options = rawOpts ? (JSON.parse(rawOpts) as SummaryOptions) : defaultSummaryOptions();
    } catch {
      options = defaultSummaryOptions();
    }
    generateMutation.mutate({ transcript: transcript.content, title, durationSec, config, options });
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading…
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="w-12 h-12 rounded-xl bg-[var(--accent-subtle)] flex items-center justify-center">
          <Sparkles className="w-6 h-6 text-[var(--accent)]" />
        </div>
        <div className="text-center">
          <p className="text-sm text-[var(--text-secondary)]">{t("empty")}</p>
          {!transcript?.content && (
            <p className="text-xs text-[var(--text-tertiary)] mt-1">
              Transcript needed before generating a summary.
            </p>
          )}
        </div>
        <Button
          onClick={handleGenerate}
          disabled={!transcript?.content || generateMutation.isPending}
          loading={generateMutation.isPending}
          className="gap-2"
        >
          <Sparkles className="w-4 h-4" />
          {generateMutation.isPending ? t("generating") : t("generate")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Score + sentiment */}
      <div className="flex items-center gap-3">
        {summary.score !== null && (
          <div className="flex items-center gap-1.5 bg-[var(--bg-elevated)] rounded-lg px-3 py-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {summary.score}/100
            </span>
          </div>
        )}
        {summary.sentiment && (
          <Badge
            variant={
              summary.sentiment === "positive"
                ? "success"
                : summary.sentiment === "negative"
                ? "destructive"
                : "secondary"
            }
          >
            {summary.sentiment}
          </Badge>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleGenerate}
          disabled={generateMutation.isPending}
          loading={generateMutation.isPending}
          className="ml-auto text-xs"
        >
          <Sparkles className="w-3.5 h-3.5" />
          {t("regenerate")}
        </Button>
      </div>

      {/* Executive summary */}
      {summary.executiveSummary && (
        <section>
          <h3 className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-2">
            {t("executive")}
          </h3>
          <p className="text-sm text-[var(--text-primary)] leading-relaxed">
            {summary.executiveSummary}
          </p>
        </section>
      )}

      {/* Topics */}
      {summary.topics.length > 0 && (
        <section>
          <h3 className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-2">
            {t("topics")}
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {summary.topics.map((topic) => (
              <Badge key={topic} variant="outline" className="gap-1">
                <Tag className="w-2.5 h-2.5" />
                {topic}
              </Badge>
            ))}
          </div>
        </section>
      )}

      {/* Action items */}
      {summary.actionItems.length > 0 && (
        <section>
          <h3 className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-2">
            {t("action_items")}
          </h3>
          <ActionItemList items={summary.actionItems} />
        </section>
      )}
    </div>
  );
}
