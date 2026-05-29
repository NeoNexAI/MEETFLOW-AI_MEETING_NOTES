use serde::{Deserialize, Serialize};

use crate::db::models::{ActionItem, Summary};
use crate::error::MeetflowError;

use super::client::LlmClient;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateSummaryRequest {
    pub meeting_id: String,
    pub transcript: String,
    pub meeting_title: String,
    pub duration_sec: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateSummaryResponse {
    pub executive_summary: String,
    pub action_items: Vec<ActionItem>,
    pub topics: Vec<String>,
    pub sentiment: String,
    pub score: i64,
}

// ─── Summary generation ───────────────────────────────────────────────────────

pub async fn generate_summary(
    client: &LlmClient,
    req: &GenerateSummaryRequest,
) -> Result<GenerateSummaryResponse, MeetflowError> {
    let system = SUMMARY_SYSTEM_PROMPT;

    let user = format!(
        "Meeting: {title}\nDuration: {duration}\n\nTranscript:\n{transcript}",
        title = req.meeting_title,
        duration = req
            .duration_sec
            .map(|s| format!("{} min", s / 60))
            .unwrap_or_else(|| "unknown".to_string()),
        transcript = truncate_transcript(&req.transcript, 12_000),
    );

    let raw = client.complete(system, &user).await?;

    parse_summary_response(&raw)
        .map_err(|e| MeetflowError::Llm(format!("Failed to parse summary JSON: {e}")))
}

fn truncate_transcript(text: &str, max_chars: usize) -> &str {
    if text.len() <= max_chars {
        return text;
    }
    // Back off to a valid UTF-8 char boundary so we never slice through a
    // multi-byte character (e.g. accented Spanish text would otherwise panic),
    // then cut at the last word boundary to avoid splitting a word.
    let mut end = max_chars;
    while end > 0 && !text.is_char_boundary(end) {
        end -= 1;
    }
    let cut = &text[..end];
    cut.rfind(char::is_whitespace)
        .map(|i| &text[..i])
        .unwrap_or(cut)
}

fn parse_summary_response(raw: &str) -> Result<GenerateSummaryResponse, serde_json::Error> {
    // Models often wrap JSON in prose or ```json fences. Extract the outermost
    // {...} object directly — this ignores fences (which sit outside the braces)
    // and is panic-safe even when the closing fence is missing.
    let json_str = match (raw.find('{'), raw.rfind('}')) {
        (Some(start), Some(end)) if end > start => &raw[start..=end],
        _ => raw.trim(),
    };

    serde_json::from_str(json_str)
}

const SUMMARY_SYSTEM_PROMPT: &str = r#"You are a meeting intelligence assistant. Analyze meeting transcripts and return a structured JSON summary.

Return ONLY valid JSON with this exact structure:
{
  "executiveSummary": "2-4 sentence summary of what was discussed and decided",
  "actionItems": [
    {"text": "action description", "assignee": "person name or null", "due": "YYYY-MM-DD or null", "done": false}
  ],
  "topics": ["topic 1", "topic 2"],
  "sentiment": "positive" | "neutral" | "negative",
  "score": 0-100
}

Score rubric: 100 = short, focused, clear decisions + action items. Deduct for: no action items (-20), vague outcomes (-15), very long without resolution (-10).
Extract action items only when explicitly agreed in the meeting.
Keep executiveSummary concise and factual."#;

/// Convert a `GenerateSummaryResponse` to the DB `Summary` model.
pub fn to_db_summary(
    response: GenerateSummaryResponse,
    meeting_id: String,
    provider: String,
    model: String,
) -> Summary {
    Summary {
        id: uuid::Uuid::new_v4().to_string(),
        meeting_id,
        executive_summary: Some(response.executive_summary),
        action_items: response.action_items,
        topics: response.topics,
        sentiment: Some(response.sentiment),
        score: Some(response.score),
        provider,
        model,
        created_at: chrono::Utc::now().timestamp_millis(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const VALID_JSON: &str = r#"{
        "executiveSummary": "Discussed Q1 launch and budget.",
        "actionItems": [
            {"text": "Ana drafts mockups", "assignee": "Ana", "due": "2026-06-01", "done": false}
        ],
        "topics": ["launch", "budget"],
        "sentiment": "positive",
        "score": 85
    }"#;

    #[test]
    fn parses_bare_json() {
        let r = parse_summary_response(VALID_JSON).expect("should parse");
        assert_eq!(r.score, 85);
        assert_eq!(r.sentiment, "positive");
        assert_eq!(r.action_items.len(), 1);
        assert_eq!(r.action_items[0].assignee.as_deref(), Some("Ana"));
        assert_eq!(r.topics, vec!["launch", "budget"]);
    }

    #[test]
    fn parses_json_wrapped_in_markdown_fence() {
        let fenced = format!("Here is the summary:\n```json\n{VALID_JSON}\n```\nDone.");
        let r = parse_summary_response(&fenced).expect("should parse fenced json");
        assert_eq!(r.executive_summary, "Discussed Q1 launch and budget.");
    }

    #[test]
    fn does_not_panic_on_unclosed_fence() {
        // Regression: previously `raw[start+7..end]` panicked when the closing
        // fence was missing (find("```json") == rfind("```")).
        let unclosed = format!("```json\n{VALID_JSON}");
        let r = parse_summary_response(&unclosed).expect("should still parse");
        assert_eq!(r.score, 85);
    }

    #[test]
    fn errors_on_non_json() {
        assert!(parse_summary_response("no json here").is_err());
    }

    #[test]
    fn truncate_keeps_short_text_intact() {
        assert_eq!(truncate_transcript("hello world", 100), "hello world");
    }

    #[test]
    fn truncate_cuts_on_word_boundary() {
        let out = truncate_transcript("alpha beta gamma delta", 13);
        // 13 chars -> "alpha beta ga"; cut back to last whitespace -> "alpha beta"
        assert_eq!(out, "alpha beta");
        assert!(out.len() <= 13);
    }

    #[test]
    fn truncate_does_not_panic_on_multibyte_boundary() {
        // "café" repeated — 'é' is 2 bytes; a byte-index cut could land mid-char.
        let text = "café ".repeat(50);
        for limit in 1..text.len() {
            let _ = truncate_transcript(&text, limit); // must never panic
        }
    }
}
