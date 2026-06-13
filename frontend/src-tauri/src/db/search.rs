//! Full-text search across meetings (title), transcripts, summaries and notes,
//! backed by SQLite FTS5 (bundled with rusqlite). One indexed row per meeting,
//! maintained explicitly via [`reindex_meeting`] at write points — simpler and
//! more robust than multi-table FTS triggers.

use rusqlite::Connection;
use serde::Serialize;

use crate::error::MeetflowError;

/// A search result row surfaced to the UI.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    pub meeting_id: String,
    pub title: String,
    pub started_at: i64,
    /// Highlighted snippet from the best-matching field.
    pub snippet: String,
}

/// Rebuild the FTS row for a single meeting from its current title, transcript,
/// summary and notes. Idempotent: deletes any existing row first. Call after any
/// write that changes searchable text (title, transcript, summary, note).
pub fn reindex_meeting(conn: &Connection, meeting_id: &str) -> Result<(), MeetflowError> {
    let title: String = conn
        .query_row(
            "SELECT title FROM meetings WHERE id = ?1",
            [meeting_id],
            |r| r.get(0),
        )
        .unwrap_or_default();

    // Concatenate the searchable body from the related tables. Missing rows are fine.
    let transcript: String = conn
        .query_row(
            "SELECT content FROM transcripts WHERE meeting_id = ?1",
            [meeting_id],
            |r| r.get(0),
        )
        .unwrap_or_default();
    let summary: String = conn
        .query_row(
            "SELECT COALESCE(executive_summary, '') FROM summaries WHERE meeting_id = ?1",
            [meeting_id],
            |r| r.get(0),
        )
        .unwrap_or_default();
    let notes: String = conn
        .query_row(
            "SELECT content FROM notes WHERE meeting_id = ?1",
            [meeting_id],
            |r| r.get(0),
        )
        .unwrap_or_default();

    let body = format!("{transcript}\n{summary}\n{notes}");

    conn.execute(
        "DELETE FROM search_index WHERE meeting_id = ?1",
        [meeting_id],
    )?;
    conn.execute(
        "INSERT INTO search_index (meeting_id, title, body) VALUES (?1, ?2, ?3)",
        rusqlite::params![meeting_id, title, body],
    )?;
    Ok(())
}

/// Remove a meeting from the search index (FTS5 is not covered by FK cascade).
pub fn remove_from_index(conn: &Connection, meeting_id: &str) -> Result<(), MeetflowError> {
    conn.execute(
        "DELETE FROM search_index WHERE meeting_id = ?1",
        [meeting_id],
    )?;
    Ok(())
}

/// Backfill the index for every meeting (used by the migration that introduces it).
pub fn reindex_all(conn: &Connection) -> Result<(), MeetflowError> {
    let ids: Vec<String> = {
        let mut stmt = conn.prepare("SELECT id FROM meetings")?;
        let rows = stmt.query_map([], |r| r.get::<_, String>(0))?;
        rows.filter_map(Result::ok).collect()
    };
    for id in ids {
        reindex_meeting(conn, &id)?;
    }
    Ok(())
}

/// Turn a raw user query into a safe FTS5 MATCH expression.
///
/// FTS5 has its own operator syntax (`"`, `*`, `(`, `:`, `AND`/`OR`/`NOT`…); a
/// raw user string can trigger a syntax error. We tokenize on whitespace, drop
/// FTS-significant characters from each token, and emit prefix queries joined by
/// implicit AND. Returns `None` when nothing usable remains (caller returns no hits).
pub fn build_fts_query(raw: &str) -> Option<String> {
    let mut terms: Vec<String> = Vec::new();
    for word in raw.split_whitespace() {
        let cleaned: String = word
            .chars()
            .filter(|c| c.is_alphanumeric() || *c == '_' || *c == '-')
            .collect();
        if !cleaned.is_empty() {
            // Quote to be safe, then prefix-match: "term"*
            terms.push(format!("\"{cleaned}\"*"));
        }
    }
    if terms.is_empty() {
        None
    } else {
        Some(terms.join(" "))
    }
}

/// Run a full-text search, returning ranked hits (best match first).
pub fn search(
    conn: &Connection,
    raw_query: &str,
    limit: usize,
) -> Result<Vec<SearchHit>, MeetflowError> {
    let Some(match_expr) = build_fts_query(raw_query) else {
        return Ok(Vec::new());
    };

    let mut stmt = conn.prepare(
        "SELECT s.meeting_id, m.title, m.started_at,
                snippet(search_index, 2, '[', ']', '…', 12) AS snip
         FROM search_index s
         JOIN meetings m ON m.id = s.meeting_id
         WHERE search_index MATCH ?1
         ORDER BY bm25(search_index)
         LIMIT ?2",
    )?;

    let hits = stmt
        .query_map(rusqlite::params![match_expr, limit as i64], |row| {
            Ok(SearchHit {
                meeting_id: row.get(0)?,
                title: row.get(1)?,
                started_at: row.get(2)?,
                snippet: row.get(3)?,
            })
        })?
        .filter_map(Result::ok)
        .collect();

    Ok(hits)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_conn() -> Connection {
        let conn = Connection::open_in_memory().expect("open");
        crate::db::schema::run_migrations(&conn).expect("migrations");
        conn
    }

    fn add_meeting(conn: &Connection, id: &str, title: &str) {
        conn.execute(
            "INSERT INTO meetings (id, title, started_at) VALUES (?1, ?2, 1000)",
            rusqlite::params![id, title],
        )
        .unwrap();
    }

    fn add_transcript(conn: &Connection, id: &str, content: &str) {
        conn.execute(
            "INSERT INTO transcripts (id, meeting_id, content) VALUES (?1, ?2, ?3)",
            rusqlite::params![format!("t-{id}"), id, content],
        )
        .unwrap();
    }

    #[test]
    fn build_fts_query_sanitizes_and_prefixes() {
        assert_eq!(build_fts_query("budget"), Some("\"budget\"*".into()));
        assert_eq!(
            build_fts_query("q1 planning"),
            Some("\"q1\"* \"planning\"*".into())
        );
        // FTS operators / punctuation are stripped, never passed through raw.
        assert_eq!(
            build_fts_query("  \"OR\" (x):  "),
            Some("\"OR\"* \"x\"*".into())
        );
        assert_eq!(build_fts_query("   "), None);
        assert_eq!(build_fts_query("***"), None);
    }

    #[test]
    fn finds_meeting_by_transcript_content() {
        let conn = test_conn();
        add_meeting(&conn, "m1", "Weekly sync");
        add_transcript(
            &conn,
            "m1",
            "We discussed the marketing budget and Q1 launch.",
        );
        reindex_meeting(&conn, "m1").unwrap();

        let hits = search(&conn, "budget", 10).unwrap();
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].meeting_id, "m1");
        assert!(hits[0].snippet.contains("budget") || hits[0].snippet.contains('['));
    }

    #[test]
    fn finds_meeting_by_title() {
        let conn = test_conn();
        add_meeting(&conn, "m1", "Roadmap planning");
        reindex_meeting(&conn, "m1").unwrap();
        assert_eq!(search(&conn, "roadmap", 10).unwrap().len(), 1);
    }

    #[test]
    fn prefix_matching_works() {
        let conn = test_conn();
        add_meeting(&conn, "m1", "");
        add_transcript(&conn, "m1", "discussing onboarding improvements");
        reindex_meeting(&conn, "m1").unwrap();
        // "onboard" should prefix-match "onboarding"
        assert_eq!(search(&conn, "onboard", 10).unwrap().len(), 1);
    }

    #[test]
    fn no_match_returns_empty() {
        let conn = test_conn();
        add_meeting(&conn, "m1", "Standup");
        add_transcript(&conn, "m1", "nothing relevant here");
        reindex_meeting(&conn, "m1").unwrap();
        assert!(search(&conn, "zzzznonexistent", 10).unwrap().is_empty());
    }

    #[test]
    fn reindex_reflects_updated_content_without_duplicating() {
        let conn = test_conn();
        add_meeting(&conn, "m1", "Sync");
        add_transcript(&conn, "m1", "alpha");
        reindex_meeting(&conn, "m1").unwrap();
        // Update transcript content and reindex again.
        conn.execute(
            "UPDATE transcripts SET content = 'omega' WHERE meeting_id = 'm1'",
            [],
        )
        .unwrap();
        reindex_meeting(&conn, "m1").unwrap();

        assert!(
            search(&conn, "alpha", 10).unwrap().is_empty(),
            "stale term gone"
        );
        assert_eq!(search(&conn, "omega", 10).unwrap().len(), 1);
        // Exactly one indexed row (no duplication).
        let count: i64 = conn
            .query_row(
                "SELECT count(*) FROM search_index WHERE meeting_id='m1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn remove_from_index_deletes_row() {
        let conn = test_conn();
        add_meeting(&conn, "m1", "Sync");
        add_transcript(&conn, "m1", "findme");
        reindex_meeting(&conn, "m1").unwrap();
        remove_from_index(&conn, "m1").unwrap();
        assert!(search(&conn, "findme", 10).unwrap().is_empty());
    }

    #[test]
    fn raw_query_with_fts_operators_does_not_error() {
        let conn = test_conn();
        add_meeting(&conn, "m1", "Sync");
        add_transcript(&conn, "m1", "safe content");
        reindex_meeting(&conn, "m1").unwrap();
        // These would be FTS5 syntax errors if passed raw — must not panic/err.
        for q in ["\"", "AND OR", "*(", "foo: bar", ")("] {
            assert!(search(&conn, q, 10).is_ok());
        }
    }
}
