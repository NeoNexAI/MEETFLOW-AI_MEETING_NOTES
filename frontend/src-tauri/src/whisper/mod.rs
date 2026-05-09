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
        sha256: "ae85e26e5fa2d0dba4524c66a6ba64cedf6d2588",
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
        sha256: "9c5f0b5c7b6a4e1f",
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
        sha256: "1c3b4e5f6a7b8c9d",
    },
];
