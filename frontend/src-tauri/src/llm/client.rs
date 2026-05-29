use std::sync::Arc;

use serde::{Deserialize, Serialize};

use crate::error::MeetflowError;

use super::providers::{LlmConfig, LlmProvider};

#[derive(Clone)]
pub struct LlmClient {
    http: Arc<reqwest::Client>,
    config: LlmConfig,
}

// ─── OpenAI-compatible request/response ───────────────────────────────────────

#[derive(Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<ChatMessage>,
    max_tokens: u32,
    temperature: f32,
    stream: bool,
}

#[derive(Serialize, Deserialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct ChatResponse {
    choices: Vec<Choice>,
}

#[derive(Deserialize)]
struct Choice {
    message: ChatMessage,
}

// ─── Anthropic-specific request/response ─────────────────────────────────────

#[derive(Serialize)]
struct AnthropicRequest {
    model: String,
    max_tokens: u32,
    messages: Vec<AnthropicMessage>,
    system: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct AnthropicMessage {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct AnthropicResponse {
    content: Vec<AnthropicContent>,
}

#[derive(Deserialize)]
struct AnthropicContent {
    text: String,
}

// ─── Client implementation ────────────────────────────────────────────────────

impl LlmClient {
    pub fn new(config: LlmConfig) -> Self {
        // Building the client only fails if the TLS backend cannot initialise,
        // which is effectively impossible with rustls. Fall back to a default
        // client rather than panicking so a transient init issue never crashes
        // the app.
        let http = Arc::new(
            reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(120))
                .build()
                .unwrap_or_else(|_| reqwest::Client::new()),
        );
        Self { http, config }
    }

    /// Send a prompt and return the assistant's reply.
    pub async fn complete(&self, system: &str, user: &str) -> Result<String, MeetflowError> {
        match self.config.provider {
            LlmProvider::Claude => self.complete_anthropic(system, user).await,
            _ => self.complete_openai_compat(system, user).await,
        }
    }

    // ── OpenAI-compatible (Ollama, OpenAI, Groq, OpenRouter, Mistral, Custom) ──

    async fn complete_openai_compat(
        &self,
        system: &str,
        user: &str,
    ) -> Result<String, MeetflowError> {
        let base = self
            .config
            .provider
            .base_url(self.config.base_url.as_deref());

        let url = if self.config.provider == LlmProvider::Ollama {
            format!("{base}/api/chat")
        } else {
            format!("{base}/v1/chat/completions")
        };

        let body = ChatRequest {
            model: self.config.model.clone(),
            messages: vec![
                ChatMessage {
                    role: "system".into(),
                    content: system.into(),
                },
                ChatMessage {
                    role: "user".into(),
                    content: user.into(),
                },
            ],
            max_tokens: self.config.max_tokens,
            temperature: self.config.temperature,
            stream: false,
        };

        let mut req = self.http.post(&url).json(&body);

        if let Some(ref key) = self.config.api_key {
            req = req.bearer_auth(key);
        }

        let resp = req
            .send()
            .await?
            .error_for_status()
            .map_err(|e| MeetflowError::Llm(e.to_string()))?
            .json::<ChatResponse>()
            .await
            .map_err(|e| MeetflowError::Llm(format!("Failed to parse response: {e}")))?;

        resp.choices
            .into_iter()
            .next()
            .map(|c| c.message.content)
            .ok_or_else(|| MeetflowError::Llm("Empty response from LLM".into()))
    }

    // ── Anthropic (Claude) ────────────────────────────────────────────────────

    async fn complete_anthropic(&self, system: &str, user: &str) -> Result<String, MeetflowError> {
        let key = self
            .config
            .api_key
            .as_deref()
            .ok_or_else(|| MeetflowError::Llm("Anthropic API key not configured".into()))?;

        let body = AnthropicRequest {
            model: self.config.model.clone(),
            max_tokens: self.config.max_tokens,
            system: Some(system.into()),
            messages: vec![AnthropicMessage {
                role: "user".into(),
                content: user.into(),
            }],
        };

        let resp = self
            .http
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", key)
            .header("anthropic-version", "2023-06-01")
            .json(&body)
            .send()
            .await?
            .error_for_status()
            .map_err(|e| MeetflowError::Llm(e.to_string()))?
            .json::<AnthropicResponse>()
            .await
            .map_err(|e| MeetflowError::Llm(format!("Failed to parse Anthropic response: {e}")))?;

        resp.content
            .into_iter()
            .next()
            .map(|c| c.text)
            .ok_or_else(|| MeetflowError::Llm("Empty response from Claude".into()))
    }

    /// Quick connection test.
    ///
    /// For Ollama we use a lightweight GET /api/tags ping (no model inference needed,
    /// responds in < 1 s).  For cloud providers we send a minimal completion request.
    pub async fn test_connection(&self) -> Result<(), MeetflowError> {
        if self.config.provider == LlmProvider::Ollama {
            let base = self
                .config
                .provider
                .base_url(self.config.base_url.as_deref());
            let url = format!("{base}/api/tags");
            self.http
                .get(&url)
                .send()
                .await
                .map_err(|_| {
                    MeetflowError::Llm("Ollama not reachable at the configured URL".into())
                })?
                .error_for_status()
                .map_err(|e| MeetflowError::Llm(e.to_string()))?;
            return Ok(());
        }
        self.complete("You are a test assistant.", "Reply with only the word: ok")
            .await?;
        Ok(())
    }
}
