"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listMeetings,
  getMeeting,
  getTranscript,
  getSummary,
  getNote,
  saveNote,
  deleteMeeting,
  updateMeetingTitle,
  exportMeetingMarkdown,
  exportMeetingJson,
  generateMeetingSummary,
  transcribeMeeting,
  type LlmConfig,
  type SummaryOptions,
} from "@/lib/tauri";

// ─── Query keys ──────────────────────────────────────────────────────────────

export const meetingKeys = {
  all: ["meetings"] as const,
  list: () => [...meetingKeys.all, "list"] as const,
  detail: (id: string) => [...meetingKeys.all, id] as const,
  transcript: (id: string) => [...meetingKeys.all, id, "transcript"] as const,
  summary: (id: string) => [...meetingKeys.all, id, "summary"] as const,
  note: (id: string) => [...meetingKeys.all, id, "note"] as const,
};

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useMeetingList() {
  return useQuery({
    queryKey: meetingKeys.list(),
    queryFn: () => listMeetings(50, 0),
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });
}

export function useMeeting(id: string) {
  return useQuery({
    queryKey: meetingKeys.detail(id),
    queryFn: () => getMeeting(id),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useTranscript(meetingId: string) {
  return useQuery({
    queryKey: meetingKeys.transcript(meetingId),
    queryFn: () => getTranscript(meetingId),
    enabled: !!meetingId,
    staleTime: 60_000,
  });
}

export function useSummary(meetingId: string) {
  return useQuery({
    queryKey: meetingKeys.summary(meetingId),
    queryFn: () => getSummary(meetingId),
    enabled: !!meetingId,
    staleTime: 60_000,
  });
}

export function useNote(meetingId: string) {
  return useQuery({
    queryKey: meetingKeys.note(meetingId),
    queryFn: () => getNote(meetingId),
    enabled: !!meetingId,
    staleTime: 5_000,
  });
}

export function useSaveNote(meetingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => saveNote(meetingId, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: meetingKeys.note(meetingId) });
    },
  });
}

export function useDeleteMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteMeeting(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: meetingKeys.list() });
      toast.success("Meeting deleted");
    },
    onError: (err) => {
      toast.error(`Failed to delete meeting: ${err}`);
    },
  });
}

export function useUpdateMeetingTitle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      updateMeetingTitle(id, title),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: meetingKeys.detail(id) });
      qc.invalidateQueries({ queryKey: meetingKeys.list() });
    },
  });
}

export function useGenerateSummary(meetingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      transcript,
      title,
      durationSec,
      config,
      options,
    }: {
      transcript: string;
      title: string;
      durationSec: number | null;
      config: LlmConfig;
      options: SummaryOptions;
    }) =>
      generateMeetingSummary(
        { meetingId, transcript, meetingTitle: title, durationSec, options },
        config
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: meetingKeys.summary(meetingId) });
      toast.success("Summary generated");
    },
    onError: (err) => {
      toast.error(`Failed to generate summary: ${err}`);
    },
  });
}

export function useTranscribeMeeting(meetingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (language?: string) => transcribeMeeting(meetingId, language),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: meetingKeys.transcript(meetingId) });
      qc.invalidateQueries({ queryKey: meetingKeys.detail(meetingId) });
    },
  });
}

export function useExportMarkdown() {
  return useMutation({
    mutationFn: (meetingId: string) => exportMeetingMarkdown(meetingId),
    onSuccess: (markdown) => {
      // Download as file
      const blob = new Blob([markdown], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "meeting-notes.md";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Markdown exported");
    },
    onError: (err) => {
      toast.error(`Export failed: ${err}`);
    },
  });
}

export function useExportJson() {
  return useMutation({
    mutationFn: (meetingId: string) => exportMeetingJson(meetingId),
    onSuccess: (json) => {
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "meeting-notes.json";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("JSON exported");
    },
    onError: (err) => {
      toast.error(`Export failed: ${err}`);
    },
  });
}
