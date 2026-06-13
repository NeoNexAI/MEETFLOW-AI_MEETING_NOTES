use rusqlite::params;
use serde_json;
use tauri::State;

use crate::db::{
    models::{ActionItem, Meeting, MeetingCard, Note, Summary, Transcript, TranscriptSegment},
    DbPool,
};
use crate::error::MeetflowError;

/// Return paginated list of meetings, newest first.
#[tauri::command]
pub fn list_meetings(
    db: State<'_, DbPool>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<MeetingCard>, MeetflowError> {
    let conn =
        db.0.lock()
            .map_err(|_| MeetflowError::Db("Lock poisoned".into()))?;
    let limit = limit.unwrap_or(50).min(200);
    let offset = offset.unwrap_or(0);

    let mut stmt = conn.prepare(
        "SELECT m.id, m.title, m.started_at, m.duration_sec,
                s.score,
                (SELECT COUNT(*) FROM json_each(s.action_items) WHERE json_valid(s.action_items)) as ai_count,
                SUBSTR(s.executive_summary, 1, 120) as snippet
         FROM meetings m
         LEFT JOIN summaries s ON s.meeting_id = m.id
         ORDER BY m.started_at DESC
         LIMIT ?1 OFFSET ?2",
    )?;

    let cards = stmt
        .query_map(params![limit, offset], |row| {
            Ok(MeetingCard {
                id: row.get(0)?,
                title: row.get(1)?,
                started_at: row.get(2)?,
                duration_sec: row.get(3)?,
                score: row.get(4)?,
                action_item_count: row.get::<_, i64>(5).unwrap_or(0) as usize,
                summary_snippet: row.get(6)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(cards)
}

/// Get full meeting detail.
#[tauri::command]
pub fn get_meeting(db: State<'_, DbPool>, id: String) -> Result<Meeting, MeetflowError> {
    let conn =
        db.0.lock()
            .map_err(|_| MeetflowError::Db("Lock poisoned".into()))?;
    let meeting = conn
        .query_row(
            "SELECT id, title, started_at, ended_at, duration_sec, audio_path, language, created_at
         FROM meetings WHERE id = ?1",
            params![id],
            |row| {
                Ok(Meeting {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    started_at: row.get(2)?,
                    ended_at: row.get(3)?,
                    duration_sec: row.get(4)?,
                    audio_path: row.get(5)?,
                    language: row.get(6)?,
                    created_at: row.get(7)?,
                })
            },
        )
        .map_err(|_| MeetflowError::NotFound(format!("Meeting {id} not found")))?;

    Ok(meeting)
}

/// Update meeting title.
#[tauri::command]
pub fn update_meeting_title(
    db: State<'_, DbPool>,
    id: String,
    title: String,
) -> Result<(), MeetflowError> {
    let conn =
        db.0.lock()
            .map_err(|_| MeetflowError::Db("Lock poisoned".into()))?;
    conn.execute(
        "UPDATE meetings SET title = ?1 WHERE id = ?2",
        params![title, id],
    )?;
    crate::db::search::reindex_meeting(&conn, &id)?;
    Ok(())
}

/// Delete a meeting and all associated data (CASCADE).
#[tauri::command]
pub fn delete_meeting(db: State<'_, DbPool>, id: String) -> Result<(), MeetflowError> {
    let conn =
        db.0.lock()
            .map_err(|_| MeetflowError::Db("Lock poisoned".into()))?;
    conn.execute("DELETE FROM meetings WHERE id = ?1", params![id])?;
    // FTS5 virtual tables aren't covered by FK cascade — clear the index row.
    crate::db::search::remove_from_index(&conn, &id)?;
    Ok(())
}

/// Get transcript for a meeting.
#[tauri::command]
pub fn get_transcript(
    db: State<'_, DbPool>,
    meeting_id: String,
) -> Result<Option<Transcript>, MeetflowError> {
    let conn =
        db.0.lock()
            .map_err(|_| MeetflowError::Db("Lock poisoned".into()))?;
    let result = conn.query_row(
        "SELECT id, meeting_id, content, segments, word_count, created_at
         FROM transcripts WHERE meeting_id = ?1",
        params![meeting_id],
        |row| {
            let segments_json: String = row.get(3)?;
            let segments: Vec<TranscriptSegment> =
                serde_json::from_str(&segments_json).unwrap_or_default();
            Ok(Transcript {
                id: row.get(0)?,
                meeting_id: row.get(1)?,
                content: row.get(2)?,
                segments,
                word_count: row.get(4)?,
                created_at: row.get(5)?,
            })
        },
    );
    match result {
        Ok(t) => Ok(Some(t)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.into()),
    }
}

/// Get AI summary for a meeting.
#[tauri::command]
pub fn get_summary(
    db: State<'_, DbPool>,
    meeting_id: String,
) -> Result<Option<Summary>, MeetflowError> {
    let conn =
        db.0.lock()
            .map_err(|_| MeetflowError::Db("Lock poisoned".into()))?;
    let result = conn.query_row(
        "SELECT id, meeting_id, executive_summary, action_items, topics, sentiment, score, provider, model, created_at
         FROM summaries WHERE meeting_id = ?1",
        params![meeting_id],
        |row| {
            let action_items_json: String = row.get(3)?;
            let topics_json: String = row.get(4)?;
            let action_items: Vec<ActionItem> =
                serde_json::from_str(&action_items_json).unwrap_or_default();
            let topics: Vec<String> =
                serde_json::from_str(&topics_json).unwrap_or_default();
            Ok(Summary {
                id: row.get(0)?,
                meeting_id: row.get(1)?,
                executive_summary: row.get(2)?,
                action_items,
                topics,
                sentiment: row.get(5)?,
                score: row.get(6)?,
                provider: row.get(7)?,
                model: row.get(8)?,
                created_at: row.get(9)?,
            })
        },
    );
    match result {
        Ok(s) => Ok(Some(s)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.into()),
    }
}

/// Get block-based notes for a meeting.
#[tauri::command]
pub fn get_note(db: State<'_, DbPool>, meeting_id: String) -> Result<Option<Note>, MeetflowError> {
    let conn =
        db.0.lock()
            .map_err(|_| MeetflowError::Db("Lock poisoned".into()))?;
    let result = conn.query_row(
        "SELECT id, meeting_id, content, updated_at FROM notes WHERE meeting_id = ?1",
        params![meeting_id],
        |row| {
            Ok(Note {
                id: row.get(0)?,
                meeting_id: row.get(1)?,
                content: row.get(2)?,
                updated_at: row.get(3)?,
            })
        },
    );
    match result {
        Ok(n) => Ok(Some(n)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.into()),
    }
}

/// Upsert block-based notes for a meeting.
#[tauri::command]
pub fn save_note(
    db: State<'_, DbPool>,
    meeting_id: String,
    content: String,
) -> Result<(), MeetflowError> {
    let conn =
        db.0.lock()
            .map_err(|_| MeetflowError::Db("Lock poisoned".into()))?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp_millis();
    conn.execute(
        "INSERT INTO notes (id, meeting_id, content, updated_at)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(meeting_id) DO UPDATE SET content = ?3, updated_at = ?4",
        params![id, meeting_id, content, now],
    )?;
    crate::db::search::reindex_meeting(&conn, &meeting_id)?;
    Ok(())
}

/// Full-text search across meeting titles, transcripts, summaries and notes.
#[tauri::command]
pub fn search_meetings(
    db: State<'_, DbPool>,
    query: String,
) -> Result<Vec<crate::db::search::SearchHit>, MeetflowError> {
    let conn =
        db.0.lock()
            .map_err(|_| MeetflowError::Db("Lock poisoned".into()))?;
    crate::db::search::search(&conn, &query, 50)
}

/// Export a meeting as Markdown text.
#[tauri::command]
pub fn export_meeting_markdown(
    db: State<'_, DbPool>,
    meeting_id: String,
) -> Result<String, MeetflowError> {
    let conn =
        db.0.lock()
            .map_err(|_| MeetflowError::Db("Lock poisoned".into()))?;

    let meeting: Meeting = conn
        .query_row(
            "SELECT id, title, started_at, ended_at, duration_sec, audio_path, language, created_at
         FROM meetings WHERE id = ?1",
            params![meeting_id],
            |row| {
                Ok(Meeting {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    started_at: row.get(2)?,
                    ended_at: row.get(3)?,
                    duration_sec: row.get(4)?,
                    audio_path: row.get(5)?,
                    language: row.get(6)?,
                    created_at: row.get(7)?,
                })
            },
        )
        .map_err(|_| MeetflowError::NotFound(format!("Meeting {meeting_id} not found")))?;

    let mut md = format!(
        "# {}\n\n**Date:** {}\n**Duration:** {} min\n\n---\n\n",
        meeting.title,
        chrono::DateTime::from_timestamp_millis(meeting.started_at)
            .map(|dt| dt.format("%Y-%m-%d %H:%M").to_string())
            .unwrap_or_default(),
        meeting.duration_sec.unwrap_or(0) / 60
    );

    // Summary section
    let summary_result = conn.query_row(
        "SELECT executive_summary, action_items, topics FROM summaries WHERE meeting_id = ?1",
        params![meeting_id],
        |row| {
            Ok((
                row.get::<_, Option<String>>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        },
    );

    if let Ok((Some(exec), action_json, topics_json)) = summary_result {
        md.push_str("## Summary\n\n");
        md.push_str(&exec);
        md.push_str("\n\n");

        if let Ok(topics) = serde_json::from_str::<Vec<String>>(&topics_json) {
            if !topics.is_empty() {
                md.push_str("**Topics:** ");
                md.push_str(&topics.join(", "));
                md.push_str("\n\n");
            }
        }

        if let Ok(items) = serde_json::from_str::<Vec<ActionItem>>(&action_json) {
            if !items.is_empty() {
                md.push_str("## Action Items\n\n");
                for item in &items {
                    let assignee = item.assignee.as_deref().unwrap_or("—");
                    md.push_str(&format!("- [ ] {} _({})\n", item.text, assignee));
                }
                md.push('\n');
            }
        }
    }

    // Transcript section
    let transcript_result = conn.query_row(
        "SELECT content FROM transcripts WHERE meeting_id = ?1",
        params![meeting_id],
        |row| row.get::<_, String>(0),
    );

    if let Ok(transcript) = transcript_result {
        md.push_str("## Transcript\n\n");
        md.push_str(&transcript);
        md.push('\n');
    }

    Ok(md)
}

/// Export a meeting as structured JSON (Pro feature). Includes meeting metadata,
/// summary (with parsed action items + topics), transcript and notes.
#[tauri::command]
pub fn export_meeting_json(
    db: State<'_, DbPool>,
    meeting_id: String,
) -> Result<String, MeetflowError> {
    // Advanced exports are a Pro-tier feature (Markdown export stays free).
    if !crate::commands::license::current_entitlements(&db).advanced_export {
        return Err(MeetflowError::InvalidInput(
            "JSON export requires MeetFlow Pro. Upgrade in Settings → Plan.".into(),
        ));
    }

    let conn =
        db.0.lock()
            .map_err(|_| MeetflowError::Db("Lock poisoned".into()))?;

    let meeting: Meeting = conn
        .query_row(
            "SELECT id, title, started_at, ended_at, duration_sec, audio_path, language, created_at
         FROM meetings WHERE id = ?1",
            params![meeting_id],
            |row| {
                Ok(Meeting {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    started_at: row.get(2)?,
                    ended_at: row.get(3)?,
                    duration_sec: row.get(4)?,
                    audio_path: row.get(5)?,
                    language: row.get(6)?,
                    created_at: row.get(7)?,
                })
            },
        )
        .map_err(|_| MeetflowError::NotFound(format!("Meeting {meeting_id} not found")))?;

    let summary = conn
        .query_row(
            "SELECT executive_summary, action_items, topics, sentiment, score
             FROM summaries WHERE meeting_id = ?1",
            params![meeting_id],
            |row| {
                Ok((
                    row.get::<_, Option<String>>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, Option<i64>>(4)?,
                ))
            },
        )
        .ok()
        .map(|(exec, actions, topics, sentiment, score)| {
            serde_json::json!({
                "executiveSummary": exec,
                "actionItems": serde_json::from_str::<Vec<ActionItem>>(&actions)
                    .unwrap_or_default(),
                "topics": serde_json::from_str::<Vec<String>>(&topics).unwrap_or_default(),
                "sentiment": sentiment,
                "score": score,
            })
        });

    let transcript: Option<String> = conn
        .query_row(
            "SELECT content FROM transcripts WHERE meeting_id = ?1",
            params![meeting_id],
            |row| row.get(0),
        )
        .ok();

    let notes: Option<String> = conn
        .query_row(
            "SELECT content FROM notes WHERE meeting_id = ?1",
            params![meeting_id],
            |row| row.get(0),
        )
        .ok();

    let date = chrono::DateTime::from_timestamp_millis(meeting.started_at)
        .map(|dt| dt.to_rfc3339())
        .unwrap_or_default();

    let value = serde_json::json!({
        "meeting": {
            "id": meeting.id,
            "title": meeting.title,
            "date": date,
            "durationSec": meeting.duration_sec,
            "language": meeting.language,
        },
        "summary": summary,
        "transcript": transcript,
        "notes": notes,
    });

    serde_json::to_string_pretty(&value)
        .map_err(|e| MeetflowError::InvalidInput(format!("Failed to serialize JSON: {e}")))
}
