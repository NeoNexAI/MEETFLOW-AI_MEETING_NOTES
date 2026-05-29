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
    },
];
