"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { useQueryClient } from "@tanstack/react-query";
import { meetingKeys, useTranscribeMeeting, useTranscript } from "@/hooks/useMeetings";

export function TranscriptTab({ meetingId }: { meetingId: string }) {
  const { data: transcript, isLoading } = useTranscript(meetingId);
  const transcribe = useTranscribeMeeting(meetingId);
  const qc = useQueryClient();

  // Auto-start transcription when we detect an empty transcript row.
  // Only fires once (when isPending is false and content is empty).
  React.useEffect(() => {
    if (!isLoading && transcript && !transcript.content && !transcribe.isPending) {
      transcribe.mutate(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, transcript?.content]);

  // Listen for the Rust-emitted event so the tab refreshes as soon as
  // transcription finishes, even if the user stays on this tab.
  React.useEffect(() => {
    const unlisten = listen<string>("transcript-ready", (ev) => {
      if (ev.payload === meetingId) {
        qc.invalidateQueries({ queryKey: meetingKeys.transcript(meetingId) });
        qc.invalidateQueries({ queryKey: meetingKeys.detail(meetingId) });
      }
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, [meetingId, qc]);

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
        No transcript found. Record and stop a meeting to generate one.
      </p>
    );
  }

  // Empty transcript = transcription in progress (auto-started above) or failed
  if (!transcript.content) {
    if (transcribe.isError) {
      const msg = String(transcribe.error);
      const noModel = msg.toLowerCase().includes("no whisper model");
      return (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="w-10 h-10 rounded-xl bg-[var(--error)]/10 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-[var(--error)]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--text-secondary)]">
              {noModel ? "No Whisper model downloaded" : "Transcription failed"}
            </p>
            <p className="text-xs text-[var(--text-tertiary)] mt-1 max-w-xs">
              {noModel
                ? "Go to Onboarding → Model step to download a Whisper model."
                : msg}
            </p>
          </div>
          {!noModel && (
            <button
              onClick={() => transcribe.mutate(undefined)}
              className="text-xs text-[var(--accent)] hover:underline"
            >
              Retry
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center px-6">
        <div className="w-12 h-12 rounded-2xl bg-[var(--bg-elevated)] flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-[var(--accent)] animate-spin" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-[var(--text-secondary)]">Transcribing…</p>
          <p className="text-xs text-[var(--text-tertiary)] max-w-xs leading-relaxed">
            Whisper is processing your audio locally.
            The first run loads the model (~10 s); subsequent ones are faster.
          </p>
        </div>
        <p className="text-xs text-[var(--text-tertiary)] bg-[var(--bg-elevated)] px-3 py-1.5 rounded-lg">
          You can navigate freely — transcription continues in the background.
        </p>
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
