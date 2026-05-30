pub mod download;
pub mod engine;

/// Catalog of downloadable Whisper models.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelCatalogEntry {
    pub id: &'static str,
    pub display_name: &'static str,
    pub description: &'static str,
    pub size_mb: u64,
    pub accuracy: &'static str,
    pub speed: &'static str,
    pub badge: Option<&'static str>,
    pub hf_url: &'static str,
    /// SHA256 hex digest (64 chars) for post-download integrity verification.
    /// An empty string means "not yet pinned" — verification is skipped with a
    /// warning. Pin real digests before GA (see docs/playbooks/release.md).
    pub sha256: &'static str,
    /// Whether downloading/using this model requires the Pro tier.
    pub requires_pro: bool,
}

pub const MODEL_CATALOG: &[ModelCatalogEntry] = &[
    ModelCatalogEntry {
        id: "tiny",
        display_name: "Tiny",
        description: "Fastest, basic accuracy. Good for quick notes.",
        size_mb: 77,
        accuracy: "basic",
        speed: "lightning",
        badge: None,
        hf_url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin",
        sha256: "be07e048e1e599ad46341c8d2a135645097a538221678b7acdd1b1919c6e1b21",
        requires_pro: false,
    },
    ModelCatalogEntry {
        id: "small-q5_1",
        display_name: "Small",
        description: "Great balance of speed and quality.",
        size_mb: 181,
        accuracy: "good",
        speed: "fast",
        badge: Some("recommended"),
        hf_url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small-q5_1.bin",
        // TODO(release): pin real SHA256 (was a 40-char SHA1 that broke downloads).
        sha256: "",
        requires_pro: false,
    },
    ModelCatalogEntry {
        id: "medium-q5_0",
        display_name: "Medium",
        description: "High accuracy, moderate speed.",
        size_mb: 514,
        accuracy: "high",
        speed: "medium",
        badge: None,
        hf_url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium-q5_0.bin",
        // TODO(release): pin real SHA256.
        sha256: "",
        requires_pro: true,
    },
    ModelCatalogEntry {
        id: "large-v3-turbo-q5_0",
        display_name: "Large v3 Turbo",
        description: "Best accuracy, optimized for speed.",
        size_mb: 547,
        accuracy: "best",
        speed: "medium",
        badge: Some("best_value"),
        hf_url:
            "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin",
        // TODO(release): pin real SHA256.
        sha256: "",
        requires_pro: true,
    },
];

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn catalog_is_non_empty_and_has_unique_ids() {
        assert!(!MODEL_CATALOG.is_empty());
        let mut ids: Vec<&str> = MODEL_CATALOG.iter().map(|e| e.id).collect();
        let count = ids.len();
        ids.sort_unstable();
        ids.dedup();
        assert_eq!(ids.len(), count, "model ids must be unique");
    }

    #[test]
    fn at_least_one_free_model_is_available() {
        assert!(
            MODEL_CATALOG.iter().any(|e| !e.requires_pro),
            "Free tier must have at least one usable model"
        );
    }

    #[test]
    fn pinned_checksums_are_64_hex_chars_or_empty() {
        for e in MODEL_CATALOG {
            assert!(
                e.sha256.is_empty() || e.sha256.len() == 64,
                "model {} has an invalid sha256 length ({})",
                e.id,
                e.sha256.len()
            );
        }
    }

    #[test]
    fn all_urls_point_to_official_huggingface_repo() {
        for e in MODEL_CATALOG {
            assert!(
                e.hf_url
                    .starts_with("https://huggingface.co/ggerganov/whisper.cpp/"),
                "model {} uses an unexpected URL: {}",
                e.id,
                e.hf_url
            );
        }
    }
}
