"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  Trash2,
  Download,
  Loader2,
  Sparkles,
  CheckSquare,
  Tag,
  TrendingUp,
  Clock,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn, formatDuration, formatRelativeDate } from "@/lib/utils";
import {
  useMeeting,
  useTranscript,
  useSummary,
  useNote,
  useSaveNote,
  useDeleteMeeting,
  useUpdateMeetingTitle,
  useGenerateSummary,
  useExportMarkdown,
} from "@/hooks/useMeetings";
import { getSetting } from "@/lib/tauri";
import type { LlmConfig, LlmProvider } from "@/lib/tauri";

// ─── Action Items list ────────────────────────────────────────────────────────

function ActionItemList({ items }: { items: { text: string; assignee: string | null; due: string | null; done: boolean }[] }) {
  if (!items.length) return <p className="text-sm text-[var(--text-tertiary)]">No action items found.</p>;
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
            {item.due && (
              <span className="text-[var(--text-tertiary)] ml-2">· {item.due}</span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

// ─── Summary tab ─────────────────────────────────────────────────────────────

function SummaryTab({ meetingId, title, durationSec }: { meetingId: string; title: string; durationSec: number | null }) {
  const t = useTranslations("meetings.detail.summary");
  const { data: transcript } = useTranscript(meetingId);
  const { data: summary, isLoading } = useSummary(meetingId);
  const generateMutation = useGenerateSummary(meetingId);

  const handleGenerate = async () => {
    if (!transcript?.content) return;
    // Load config from settings
    let config: LlmConfig;
    try {
      const raw = await getSetting("llm_config");
      config = raw ? (JSON.parse(raw) as LlmConfig) : {
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
    generateMutation.mutate({ transcript: transcript.content, title, durationSec, config });
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
          Regenerate
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

// ─── Notes tab ────────────────────────────────────────────────────────────────

function NotesTab({ meetingId }: { meetingId: string }) {
  const t = useTranslations("meetings.detail.notes");
  const { data: note } = useNote(meetingId);
  const save = useSaveNote(meetingId);
  const [content, setContent] = React.useState<string>(note?.content ?? "");
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (note?.content !== undefined) {
      setContent(note.content);
    }
  }, [note?.content]);

  const handleChange = (val: string) => {
    setContent(val);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      save.mutate(val);
    }, 800);
  };

  return (
    <div className="flex flex-col h-full gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--text-tertiary)]">
          {save.isPending ? "Saving…" : save.isSuccess ? t("autosaved") : ""}
        </span>
      </div>
      <textarea
        value={content}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={t("placeholder")}
        className={cn(
          "flex-1 w-full bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] resize-none focus:outline-none leading-relaxed",
          "min-h-[400px]"
        )}
      />
    </div>
  );
}

// ─── Transcript tab ───────────────────────────────────────────────────────────

function TranscriptTab({ meetingId }: { meetingId: string }) {
  const { data: transcript, isLoading } = useTranscript(meetingId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading…
      </div>
    );
  }

  if (!transcript) {
    return (
      <p className="text-sm text-[var(--text-tertiary)]">
        No transcript available. Transcription runs after you stop recording.
      </p>
    );
  }

  // Transcript row exists but content is empty — whisper-rs stub (v0.1)
  if (!transcript.content) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="w-10 h-10 rounded-xl bg-[var(--bg-elevated)] flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-[var(--text-tertiary)]" />
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--text-secondary)]">
            Transcription not yet available
          </p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1 max-w-xs">
            Local Whisper integration is coming in v0.2.{" "}
            Audio is saved — the file will be transcribed automatically on upgrade.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {transcript.segments.length > 0 ? (
        transcript.segments.map((seg, i) => (
          <div key={i} className="flex gap-3 text-sm">
            <span className="text-[var(--text-tertiary)] font-mono text-xs shrink-0 mt-0.5 w-14">
              {Math.floor(seg.start / 60)}:{String(Math.floor(seg.start % 60)).padStart(2, "0")}
            </span>
            <div className="flex-1">
              {seg.speaker && (
                <span className="text-[var(--accent)] text-xs font-medium mr-1.5">
                  {seg.speaker}:
                </span>
              )}
              <span className="text-[var(--text-primary)]">{seg.text}</span>
            </div>
          </div>
        ))
      ) : (
        <p className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">
          {transcript.content}
        </p>
      )}
    </div>
  );
}

// ─── Static params (required by output: "export" with dynamic routes) ────────

export function generateStaticParams() {
  // Returns an empty array — meeting IDs are resolved client-side via useParams().
  // Next.js will generate a static shell that hydrates in the Tauri webview.
  return [];
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MeetingDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations("meetings");
  const meetingId = params.id;

  const { data: meeting, isLoading } = useMeeting(meetingId);
  const deleteMutation = useDeleteMeeting();
  const updateTitle = useUpdateMeetingTitle();
  const exportMarkdown = useExportMarkdown();

  const [showDelete, setShowDelete] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  const handleStartEdit = () => {
    setTitleDraft(meeting?.title ?? "");
    setEditingTitle(true);
  };

  const handleSaveTitle = () => {
    if (titleDraft.trim() && meeting) {
      updateTitle.mutate({ id: meeting.id, title: titleDraft.trim() });
    }
    setEditingTitle(false);
  };

  const handleDelete = async () => {
    await deleteMutation.mutateAsync(meetingId);
    setShowDelete(false);
    router.push("/meetings");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 animate-spin text-[var(--text-tertiary)]" />
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-sm text-[var(--text-tertiary)]">Meeting not found.</p>
        <Button variant="ghost" size="sm" onClick={() => router.push("/meetings")}>
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
      </div>
    );
  }

  const dateStr = formatRelativeDate(meeting.startedAt);
  const durationStr = meeting.durationSec ? formatDuration(meeting.durationSec) : null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header ── */}
      <div className="px-4 pt-3 pb-3 border-b border-[var(--border-subtle)] shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => router.push("/meetings")}
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            {editingTitle ? (
              <Input
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={handleSaveTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveTitle();
                  if (e.key === "Escape") setEditingTitle(false);
                }}
                className="h-7 text-sm font-semibold py-0"
              />
            ) : (
              <button
                onClick={handleStartEdit}
                className="text-sm font-semibold text-[var(--text-primary)] truncate hover:text-[var(--accent)] transition-colors text-left w-full"
              >
                {meeting.title}
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => exportMarkdown.mutate(meetingId)}
              disabled={exportMarkdown.isPending}
              aria-label="Export Markdown"
            >
              <Download className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setShowDelete(true)}
              className="text-[var(--error)] hover:text-[var(--error)] hover:bg-[var(--error)]/10"
              aria-label="Delete meeting"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-[var(--text-tertiary)]">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {dateStr}
          </span>
          {durationStr && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {durationStr}
            </span>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex-1 overflow-hidden flex flex-col px-4 pt-3 pb-0">
        <Tabs defaultValue="summary" className="flex flex-col flex-1 overflow-hidden">
          <TabsList className="shrink-0 mb-1 self-start">
            <TabsTrigger value="summary">{t("detail.tabs.summary")}</TabsTrigger>
            <TabsTrigger value="transcript">{t("detail.tabs.transcript")}</TabsTrigger>
            <TabsTrigger value="notes">{t("detail.tabs.notes")}</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="pb-6">
                <SummaryTab
                  meetingId={meetingId}
                  title={meeting.title}
                  durationSec={meeting.durationSec}
                />
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="transcript" className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="pb-6">
                <TranscriptTab meetingId={meetingId} />
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="notes" className="flex-1 overflow-hidden flex flex-col">
            <NotesTab meetingId={meetingId} />
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Delete dialog ── */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("delete.title")}</DialogTitle>
            <DialogDescription>{t("delete.description")}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setShowDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              loading={deleteMutation.isPending}
            >
              {t("delete.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
