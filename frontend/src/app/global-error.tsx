"use client";

import { useEffect } from "react";

/**
 * Last-resort error boundary. Catches errors thrown in the root layout itself.
 * Must render its own <html>/<body> because it replaces the root layout.
 * Kept dependency-free (no i18n/providers) since those may be the thing that failed.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to the Tauri/Rust log via the webview console.
    console.error("[MeetFlow] fatal UI error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#09090B",
          color: "#FAFAFA",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 420, padding: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
            Something went wrong
          </h1>
          <p style={{ color: "#A1A1AA", fontSize: 14, marginBottom: 24 }}>
            MeetFlow hit an unexpected error. Your recordings and data are safe
            on disk. Try again, and report this if it keeps happening.
          </p>
          <button
            onClick={() => reset()}
            style={{
              background: "#6366F1",
              color: "#FAFAFA",
              border: "none",
              borderRadius: 8,
              padding: "8px 20px",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
