"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Download,
  FileJson,
  Loader2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDuration, formatRelativeDate } from "@/lib/utils";
import {
  useDeleteMeeting,
  useExportJson,
  useExportMarkdown,
  useMeeting,
  useUpdateMeetingTitle,
} from "@/hooks/useMeetings";
import { useLicense } from "@/hooks/useLicense";
import { SummaryTab } from "@/components/meeting-detail/summary-tab";
import { TranscriptTab } from "@/components/meeting-detail/transcript-tab";
import { NotesTab } from "@/components/meeting-detail/notes-tab";

/**
 * Meeting detail page: header (title editing, exports, delete) + tab shell.
 * Tab contents live in `@/components/meeting-detail/*`, each owning its own
 * data fetching — keeps this file within the 500-line CLAUDE.md limit.
 */
export default function MeetingDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations("meetings");
  const meetingId = params.id;

  const { data: meeting, isLoading } = useMeeting(meetingId);
  const deleteMutation = useDeleteMeeting();
  const updateTitle = useUpdateMeetingTitle();
  const exportMarkdown = useExportMarkdown();
  const exportJson = useExportJson();
  const { entitlements } = useLicense();

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
            {entitlements.advancedExport && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => exportJson.mutate(meetingId)}
                disabled={exportJson.isPending}
                aria-label="Export JSON"
              >
                <FileJson className="w-3.5 h-3.5" />
              </Button>
            )}
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
