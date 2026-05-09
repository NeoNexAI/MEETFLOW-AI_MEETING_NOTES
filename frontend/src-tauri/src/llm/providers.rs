use serde::{Deserialize, Serialize};

/// All supported LLM providers.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LlmProvider {
    Ollama,
    Claude,
    OpenAi,
    Groq,
    OpenRouter,
    Mistral,
    Custom,
}

impl LlmProvider {
    /// Base URL for each provider's chat completion endpoint.
    pub fn base_url(&self, custom_url: Option<&str>) -> String {
        match self {
            Self::Ollama => "http://localhost:11434".to_string(),
            Self::Claude => "https://api.anthropic.com".to_string(),
            Self::OpenAi => "https://api.openai.com".to_string(),
            Self::Groq => "https://api.groq.com/openai".to_string(),
            Self::OpenRouter => "https://openrouter.ai/api".to_string(),
            Self::Mistral => "https://api.mistral.ai".to_string(),
            Self::Custom => custom_url.unwrap_or("http://localhost:1234/v1").to_string(),
        }
    }

    /// Whether this provider uses OpenAI-compatible API format.
    #[allow(dead_code)]
    pub fn is_openai_compatible(&self) -> bool {
        matches!(
            self,
            Self::Ollama
                | Self::OpenAi
                | Self::Groq
                | Self::OpenRouter
                | Self::Mistral
                | Self::Custom
        )
    }
}

/// LLM configuration stored in app settings.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmConfig {
    pub provider: LlmProvider,
    pub model: String,
    pub api_key: Option<String>,
    pub base_url: Option<String>, // for Ollama remote / custom
    pub max_tokens: u32,
    pub temperature: f32,
}

impl Default for LlmConfig {
    fn default() -> Self {
        Self {
            provider: LlmProvider::Ollama,
            model: "llama3.2".to_string(),
            api_key: None,
            base_url: None,
            max_tokens: 2048,
            temperature: 0.3,
        }
    }
}
