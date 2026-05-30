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
            Self::Ollama => "http://127.0.0.1:11434".to_string(),
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

    /// Whether this is a hosted cloud provider (gated behind the Pro tier).
    /// Local/self-hosted options (Ollama, custom endpoints) are always free.
    pub fn is_cloud(&self) -> bool {
        matches!(
            self,
            Self::Claude | Self::OpenAi | Self::Groq | Self::OpenRouter | Self::Mistral
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cloud_providers_are_gated_local_ones_are_free() {
        for p in [
            LlmProvider::Claude,
            LlmProvider::OpenAi,
            LlmProvider::Groq,
            LlmProvider::OpenRouter,
            LlmProvider::Mistral,
        ] {
            assert!(p.is_cloud(), "{p:?} should be cloud (Pro-gated)");
        }
        assert!(!LlmProvider::Ollama.is_cloud());
        assert!(!LlmProvider::Custom.is_cloud());
    }

    #[test]
    fn custom_base_url_overrides_only_for_custom_provider() {
        assert_eq!(
            LlmProvider::Custom.base_url(Some("http://my-host:9000/v1")),
            "http://my-host:9000/v1"
        );
        // Non-custom providers ignore the override.
        assert_eq!(
            LlmProvider::Claude.base_url(Some("http://ignored")),
            "https://api.anthropic.com"
        );
        // Custom falls back to a sane default when none is given.
        assert_eq!(
            LlmProvider::Custom.base_url(None),
            "http://localhost:1234/v1"
        );
    }

    #[test]
    fn default_config_is_local_ollama() {
        let cfg = LlmConfig::default();
        assert_eq!(cfg.provider, LlmProvider::Ollama);
        assert!(!cfg.provider.is_cloud());
        assert!(cfg.api_key.is_none());
    }

    #[test]
    fn provider_serializes_as_snake_case() {
        let json = serde_json::to_string(&LlmProvider::OpenAi).unwrap();
        assert_eq!(json, "\"open_ai\"");
        let back: LlmProvider = serde_json::from_str("\"open_router\"").unwrap();
        assert_eq!(back, LlmProvider::OpenRouter);
    }
}
