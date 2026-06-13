//! AI summary personalization: meeting-type templates, output tone, and
//! user custom instructions. All pure prompt-building logic (no I/O) so it is
//! fully unit-testable. This is MeetFlow's answer to Granola/Fathom templates.

use serde::{Deserialize, Serialize};

/// The kind of meeting, which tailors what the summary should emphasize.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum MeetingType {
    #[default]
    General,
    OneOnOne,
    Standup,
    Sales,
    Retro,
    Interview,
    Brainstorm,
    Planning,
}

impl MeetingType {
    /// Extra guidance appended to the system prompt for this meeting type.
    fn guidance(self) -> &'static str {
        match self {
            Self::General => "",
            Self::OneOnOne => {
                "This is a 1:1. Emphasize feedback exchanged, growth/career topics, \
                 blockers raised, and personal commitments by each person."
            }
            Self::Standup => {
                "This is a daily standup. Structure action items around what each \
                 person is working on and any blockers. Keep the summary very short."
            }
            Self::Sales => {
                "This is a sales call. Capture the prospect's pain points, budget and \
                 timeline signals, objections, decision-makers, and clear next steps \
                 to advance the deal."
            }
            Self::Retro => {
                "This is a retrospective. Group insights into what went well, what \
                 didn't, and concrete improvements to try next."
            }
            Self::Interview => {
                "This is an interview. Summarize the candidate's strengths, concerns, \
                 and notable answers; keep an objective, non-biased tone."
            }
            Self::Brainstorm => {
                "This is a brainstorm. Capture the ideas generated (even rough ones) \
                 grouped by theme, and which ones the group wanted to pursue."
            }
            Self::Planning => {
                "This is a planning meeting. Emphasize decisions made, scope, owners, \
                 deadlines, and dependencies."
            }
        }
    }
}

/// The writing tone/style for the generated summary text.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum Tone {
    #[default]
    Professional,
    Casual,
    Concise,
    Detailed,
}

impl Tone {
    fn guidance(self) -> &'static str {
        match self {
            Self::Professional => "Write in a clear, professional business tone.",
            Self::Casual => "Write in a relaxed, friendly, conversational tone.",
            Self::Concise => "Be extremely concise — short phrases, no filler, bullet-style.",
            Self::Detailed => "Be thorough and detailed; preserve nuance and important context.",
        }
    }
}

/// User-configurable summary options, stored as JSON in settings.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SummaryOptions {
    #[serde(default)]
    pub meeting_type: MeetingType,
    #[serde(default)]
    pub tone: Tone,
    /// Free-form extra instructions from the user (e.g. "always write in Spanish",
    /// "highlight risks", "address the summary to my manager"). May be empty.
    #[serde(default)]
    pub custom_instructions: String,
}

const BASE_SYSTEM_PROMPT: &str = r#"You are a meeting intelligence assistant. Analyze meeting transcripts and return a structured JSON summary.

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

/// Build the full system prompt from the base prompt plus the user's options.
/// The JSON contract is always preserved; type/tone/custom only add guidance.
pub fn build_system_prompt(opts: &SummaryOptions) -> String {
    let mut prompt = String::from(BASE_SYSTEM_PROMPT);

    let type_guidance = opts.meeting_type.guidance();
    if !type_guidance.is_empty() {
        prompt.push_str("\n\nMeeting context: ");
        prompt.push_str(type_guidance);
    }

    prompt.push_str("\n\nStyle: ");
    prompt.push_str(opts.tone.guidance());

    let custom = opts.custom_instructions.trim();
    if !custom.is_empty() {
        prompt.push_str(
            "\n\nAdditional user instructions (follow these, but keep the JSON structure): ",
        );
        prompt.push_str(custom);
    }

    prompt
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_options_use_general_professional() {
        let opts = SummaryOptions::default();
        assert_eq!(opts.meeting_type, MeetingType::General);
        assert_eq!(opts.tone, Tone::Professional);
        let p = build_system_prompt(&opts);
        // General adds no meeting-context line, but tone is always present.
        assert!(p.contains("professional business tone"));
        assert!(!p.contains("Meeting context:"));
        assert!(
            p.contains("\"executiveSummary\""),
            "JSON contract preserved"
        );
    }

    #[test]
    fn sales_type_injects_deal_guidance() {
        let opts = SummaryOptions {
            meeting_type: MeetingType::Sales,
            ..Default::default()
        };
        let p = build_system_prompt(&opts);
        assert!(p.contains("Meeting context:"));
        assert!(p.contains("pain points"));
    }

    #[test]
    fn custom_instructions_are_appended_when_present() {
        let opts = SummaryOptions {
            custom_instructions: "  Always write in Spanish.  ".into(),
            ..Default::default()
        };
        let p = build_system_prompt(&opts);
        assert!(p.contains("Additional user instructions"));
        assert!(p.contains("Always write in Spanish."));
    }

    #[test]
    fn blank_custom_instructions_are_ignored() {
        let opts = SummaryOptions {
            custom_instructions: "   ".into(),
            ..Default::default()
        };
        assert!(!build_system_prompt(&opts).contains("Additional user instructions"));
    }

    #[test]
    fn concise_tone_changes_style_line() {
        let opts = SummaryOptions {
            tone: Tone::Concise,
            ..Default::default()
        };
        let p = build_system_prompt(&opts);
        assert!(p.contains("extremely concise"));
        assert!(!p.contains("professional business tone"));
    }

    #[test]
    fn options_round_trip_through_json() {
        let opts = SummaryOptions {
            meeting_type: MeetingType::Standup,
            tone: Tone::Casual,
            custom_instructions: "highlight risks".into(),
        };
        let json = serde_json::to_string(&opts).expect("serialize");
        let back: SummaryOptions = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(back.meeting_type, MeetingType::Standup);
        assert_eq!(back.tone, Tone::Casual);
        assert_eq!(back.custom_instructions, "highlight risks");
    }

    #[test]
    fn missing_fields_deserialize_to_defaults() {
        // Old stored configs / partial payloads must not break.
        let back: SummaryOptions = serde_json::from_str("{}").expect("deserialize empty");
        assert_eq!(back.meeting_type, MeetingType::General);
        assert_eq!(back.tone, Tone::Professional);
        assert!(back.custom_instructions.is_empty());
    }
}
