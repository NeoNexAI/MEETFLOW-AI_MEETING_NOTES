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

  it("formats gigabytes", () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe("1.00 GB");
  });
});

describe("formatRelativeDate", () => {
  it("returns 'Just now' for very recent timestamps", () => {
    expect(formatRelativeDate(Date.now() - 5_000)).toBe("Just now");
  });

  it("returns minutes for sub-hour ranges", () => {
    expect(formatRelativeDate(Date.now() - 5 * 60_000)).toBe("5m ago");
  });

  it("returns hours for sub-day ranges", () => {
    expect(formatRelativeDate(Date.now() - 3 * 3_600_000)).toBe("3h ago");
  });

  it("returns days for sub-week ranges", () => {
    expect(formatRelativeDate(Date.now() - 2 * 86_400_000)).toBe("2d ago");
  });

  it("falls back to a locale date for older timestamps", () => {
    const old = formatRelativeDate(Date.now() - 30 * 86_400_000);
    expect(old).not.toMatch(/ago|Just now/);
  });
});
