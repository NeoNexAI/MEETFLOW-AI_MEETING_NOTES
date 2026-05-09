use tauri::State;

use crate::db::DbPool;
use crate::error::MeetflowError;
use crate::llm::{
    client::LlmClient,
    providers::LlmConfig,
    summary::{generate_summary, to_db_summary, GenerateSummaryRequest, GenerateSummaryResponse},
};

/// Test an LLM connection. Returns `Ok(())` on success.
#[tauri::command]
pub async fn test_llm_connection(config: LlmConfig) -> Result<(), MeetflowError> {
    let client = LlmClient::new(config);
    client.test_connection().await
}

/// Generate an AI summary for a meeting and persist it to the DB.
#[tauri::command]
pub async fn generate_meeting_summary(
    req: GenerateSummaryRequest,
    config: LlmConfig,
    db: State<'_, DbPool>,
) -> Result<GenerateSummaryResponse, MeetflowError> {
    let client = LlmClient::new(config.clone());
    let response = generate_summary(&client, &req).await?;

    // Persist to DB
    let summary = to_db_summary(
        GenerateSummaryResponse {
            executive_summary: response.executive_summary.clone(),
            action_items: response.action_items.clone(),
            topics: response.topics.clone(),
            sentiment: response.sentiment.clone(),
            score: response.score,
        },
        req.meeting_id,
        format!("{:?}", config.provider).to_lowercase(),
        config.model,
    );

    {
        let conn =
            db.0.lock()
                .map_err(|_| MeetflowError::Db("Lock poisoned".into()))?;
        let action_items_json = serde_json::to_string(&summary.action_items)
            .map_err(|e| MeetflowError::Llm(e.to_string()))?;
        let topics_json = serde_json::to_string(&summary.topics)
            .map_err(|e| MeetflowError::Llm(e.to_string()))?;

        conn.execute(
            "INSERT INTO summaries
             (id, meeting_id, executive_summary, action_items, topics, sentiment, score, provider, model, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
             ON CONFLICT(meeting_id) DO UPDATE SET
               executive_summary = ?3, action_items = ?4, topics = ?5,
               sentiment = ?6, score = ?7, provider = ?8, model = ?9, created_at = ?10",
            rusqlite::params![
                summary.id,
                summary.meeting_id,
                summary.executive_summary,
                action_items_json,
                topics_json,
                summary.sentiment,
                summary.score,
                summary.provider,
                summary.model,
                summary.created_at,
            ],
        )?;
    }

    Ok(response)
}

/// List models available in a local Ollama instance.
#[tauri::command]
pub async fn list_ollama_models(base_url: Option<String>) -> Result<Vec<String>, MeetflowError> {
    let url = format!(
        "{}/api/tags",
        base_url.as_deref().unwrap_or("http://localhost:11434")
    );

    #[derive(serde::Deserialize)]
    struct OllamaTagsResponse {
        models: Vec<OllamaModel>,
    }
    #[derive(serde::Deserialize)]
    struct OllamaModel {
        name: String,
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| MeetflowError::Http(e.to_string()))?;

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|_| MeetflowError::Llm("Ollama not reachable".into()))?
        .json::<OllamaTagsResponse>()
        .await
        .map_err(|e| MeetflowError::Llm(format!("Failed to parse Ollama response: {e}")))?;

    Ok(response.models.into_iter().map(|m| m.name).collect())
}
