"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useNote, useSaveNote } from "@/hooks/useMeetings";

export function NotesTab({ meetingId }: { meetingId: string }) {
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
