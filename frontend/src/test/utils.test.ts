import { describe, it, expect } from "vitest";
import {
  formatDuration,
  truncate,
  formatBytes,
  formatRelativeDate,
} from "@/lib/utils";

describe("formatDuration", () => {
  it("formats seconds under a minute", () => {
    expect(formatDuration(45)).toBe("00:45");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration(125)).toBe("02:05");
  });

  it("formats hours correctly", () => {
    expect(formatDuration(3723)).toBe("1:02:03");
  });

  it("handles zero", () => {
    expect(formatDuration(0)).toBe("00:00");
  });
});

describe("truncate", () => {
  it("returns short strings unchanged", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  it("truncates long strings with ellipsis", () => {
    expect(truncate("hello world", 8)).toBe("hello wo…");
  });
});

describe("formatBytes", () => {
  it("formats bytes", () => {
    expect(formatBytes(512)).toBe("512 B");
  });

  it("formats kilobytes", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
  });

  it("formats megabytes", () => {
    expect(formatBytes(1024 * 1024 * 77)).toBe("77.0 MB");
  });
});
