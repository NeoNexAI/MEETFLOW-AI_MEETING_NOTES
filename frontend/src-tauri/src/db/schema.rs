use rusqlite::Connection;

use crate::error::MeetflowError;

/// Run all schema migrations in order.
/// Each migration is idempotent (uses `IF NOT EXISTS` / `IF NOT EXISTS`).
pub fn run_migrations(conn: &Connection) -> Result<(), MeetflowError> {
    conn.execute_batch(MIGRATION_001_INITIAL)?;
    conn.execute_batch(MIGRATION_002_SEARCH)?;
    // Backfill the FTS index for meetings that predate the search feature
    // (no-op on a fresh DB or once already populated).
    crate::db::search::reindex_all(conn)?;
    tracing::debug!("Schema migrations complete");
    Ok(())
}

// ─── Migration 001 — Initial schema ──────────────────────────────────────────

const MIGRATION_001_INITIAL: &str = "
-- Meetings: one row per recorded session
CREATE TABLE IF NOT EXISTS meetings (
    id           TEXT    PRIMARY KEY,          -- UUIDv4
    title        TEXT    NOT NULL DEFAULT '',
    started_at   INTEGER NOT NULL,             -- Unix ms
    ended_at     INTEGER,                      -- NULL while recording
    duration_sec INTEGER,
    audio_path   TEXT,                         -- relative to recordings_dir
    language     TEXT,                         -- detected by Whisper
    created_at   INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

-- Transcripts: one row per meeting (replaced on re-transcription)
CREATE TABLE IF NOT EXISTS transcripts (
    id          TEXT    PRIMARY KEY,
    meeting_id  TEXT    NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    content     TEXT    NOT NULL DEFAULT '',   -- plain text
    segments    TEXT    NOT NULL DEFAULT '[]', -- JSON array of {start,end,text,speaker?}
    word_count  INTEGER NOT NULL DEFAULT 0,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    UNIQUE (meeting_id)
);

-- AI Summaries: one row per meeting + provider combination
CREATE TABLE IF NOT EXISTS summaries (
    id                TEXT    PRIMARY KEY,
    meeting_id        TEXT    NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    executive_summary TEXT,
    action_items      TEXT    NOT NULL DEFAULT '[]', -- JSON [{text, assignee?, due?}]
    topics            TEXT    NOT NULL DEFAULT '[]', -- JSON [string]
    sentiment         TEXT,                          -- positive|neutral|negative
    score             INTEGER,                       -- 0-100
    provider          TEXT    NOT NULL,              -- ollama|claude|openai|groq|...
    model             TEXT    NOT NULL,
    created_at        INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    UNIQUE (meeting_id)
);

-- Notes: BlockNote JSON content, one per meeting
CREATE TABLE IF NOT EXISTS notes (
    id          TEXT    PRIMARY KEY,
    meeting_id  TEXT    NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    content     TEXT    NOT NULL DEFAULT '[]', -- BlockNote JSON blocks
    updated_at  INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    UNIQUE (meeting_id)
);

-- Settings: key-value store for app configuration
CREATE TABLE IF NOT EXISTS settings (
    key        TEXT    PRIMARY KEY,
    value      TEXT    NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_meetings_started_at     ON meetings(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_transcripts_meeting_id  ON transcripts(meeting_id);
CREATE INDEX IF NOT EXISTS idx_summaries_meeting_id    ON summaries(meeting_id);
CREATE INDEX IF NOT EXISTS idx_notes_meeting_id        ON notes(meeting_id);
";

// ─── Migration 002 — Full-text search (FTS5) ─────────────────────────────────

const MIGRATION_002_SEARCH: &str = "
-- One FTS row per meeting: title + concatenated transcript/summary/notes body.
-- Maintained explicitly via db::search::reindex_meeting at write points.
CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
    meeting_id UNINDEXED,
    title,
    body,
    tokenize = 'unicode61 remove_diacritics 2'
);
";
