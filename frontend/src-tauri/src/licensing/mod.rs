//! Offline, signed license verification for the freemium Pro tier.
//!
//! Licenses are Ed25519-signed tokens verified entirely on-device against an
//! embedded public key — no network call, preserving MeetFlow's local-first
//! promise (see `docs/decisions/ADR-002-freemium-licensing.md`).
//!
//! Token format: `base64url(json(License)) + "." + base64url(signature)`.
//!
//! The operator signs licenses with a private key that never ships in the
//! binary. To issue keys, see `examples/gen_license.rs` and
//! `docs/playbooks/release.md`.

use base64::Engine as _;
use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};

use crate::error::MeetflowError;

/// Ed25519 public key (hex) used to verify license signatures.
///
/// BOOTSTRAP KEY — the operator must regenerate a keypair for production and
/// replace this value (keeping the private key secret). See the release
/// playbook. With the matching private key, `gen_license` mints valid keys.
pub const LICENSE_PUBLIC_KEY_HEX: &str =
    "cd2803f33b7e223bb437ae40ceff29d1611fd43e89254d04ac0f3e807fb34e8c";

/// Subscription tier.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Tier {
    Free,
    Pro,
}

/// What a given tier is allowed to do. The frontend gates Pro-only features on
/// these flags; the source of truth is here.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Entitlements {
    /// Use cloud LLM providers (Claude/OpenAI/Groq/…) for summaries.
    pub cloud_llm: bool,
    /// Use the large Whisper models (medium / large-v3-turbo).
    pub large_models: bool,
    /// Advanced exports (PDF / structured JSON).
    pub advanced_export: bool,
    /// Third-party integrations + AI Agent Executor (v0.2+).
    pub integrations: bool,
}

impl Entitlements {
    /// Entitlements granted by a tier.
    #[must_use]
    pub fn for_tier(tier: Tier) -> Self {
        let pro = matches!(tier, Tier::Pro);
        Self {
            cloud_llm: pro,
            large_models: pro,
            advanced_export: pro,
            integrations: pro,
        }
    }
}

/// Signed license payload.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct License {
    pub email: String,
    pub tier: Tier,
    /// Issue time (unix seconds).
    pub issued_at: i64,
    /// Optional expiry (unix seconds). `None` = perpetual.
    pub expires_at: Option<i64>,
}

/// Sign a license into a key string. Used by the operator's `gen_license` tool
/// and by tests.
#[must_use]
pub fn sign_license(license: &License, signing_key: &SigningKey) -> String {
    let json = serde_json::to_vec(license).unwrap_or_default();
    let sig = signing_key.sign(&json);
    let b64 = base64::engine::general_purpose::URL_SAFE_NO_PAD;
    format!("{}.{}", b64.encode(&json), b64.encode(sig.to_bytes()))
}

/// Verify a license key against the embedded production public key.
pub fn verify_license_key(key: &str) -> Result<License, MeetflowError> {
    let pubkey_bytes: [u8; 32] = hex::decode(LICENSE_PUBLIC_KEY_HEX)
        .ok()
        .and_then(|v| v.try_into().ok())
        .ok_or_else(|| MeetflowError::InvalidInput("invalid embedded public key".into()))?;
    let vk = VerifyingKey::from_bytes(&pubkey_bytes)
        .map_err(|e| MeetflowError::InvalidInput(format!("bad public key: {e}")))?;
    verify_with_pubkey(key, &vk)
}

/// Verify a license key against an explicit public key (testable core).
fn verify_with_pubkey(key: &str, vk: &VerifyingKey) -> Result<License, MeetflowError> {
    let b64 = base64::engine::general_purpose::URL_SAFE_NO_PAD;

    let (payload_b64, sig_b64) = key
        .split_once('.')
        .ok_or_else(|| MeetflowError::InvalidInput("malformed license key".into()))?;

    let json = b64
        .decode(payload_b64)
        .map_err(|_| MeetflowError::InvalidInput("malformed license payload".into()))?;
    let sig_bytes: [u8; 64] = b64
        .decode(sig_b64)
        .ok()
        .and_then(|v| v.try_into().ok())
        .ok_or_else(|| MeetflowError::InvalidInput("malformed license signature".into()))?;

    let signature = Signature::from_bytes(&sig_bytes);
    vk.verify(&json, &signature)
        .map_err(|_| MeetflowError::InvalidInput("license signature does not verify".into()))?;

    let license: License = serde_json::from_slice(&json)
        .map_err(|e| MeetflowError::InvalidInput(format!("bad license payload: {e}")))?;

    if let Some(exp) = license.expires_at {
        if chrono::Utc::now().timestamp() > exp {
            return Err(MeetflowError::InvalidInput("license expired".into()));
        }
    }

    Ok(license)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_keypair() -> SigningKey {
        // Fixed seed → deterministic keypair for tests.
        SigningKey::from_bytes(&[42u8; 32])
    }

    fn license(expires_at: Option<i64>) -> License {
        License {
            email: "buyer@example.com".into(),
            tier: Tier::Pro,
            issued_at: 1_700_000_000,
            expires_at,
        }
    }

    #[test]
    fn valid_license_round_trips() {
        let sk = test_keypair();
        let vk = sk.verifying_key();
        let key = sign_license(&license(None), &sk);
        let parsed = verify_with_pubkey(&key, &vk).expect("should verify");
        assert_eq!(parsed.tier, Tier::Pro);
        assert_eq!(parsed.email, "buyer@example.com");
    }

    #[test]
    fn tampered_payload_is_rejected() {
        let sk = test_keypair();
        let vk = sk.verifying_key();
        let key = sign_license(&license(None), &sk);
        let (_p, sig) = key.split_once('.').unwrap();
        // Swap in a different payload but keep the old signature.
        let forged_payload = base64::engine::general_purpose::URL_SAFE_NO_PAD
            .encode(br#"{"email":"hacker","tier":"pro","issuedAt":0,"expiresAt":null}"#);
        let forged = format!("{forged_payload}.{sig}");
        assert!(verify_with_pubkey(&forged, &vk).is_err());
    }

    #[test]
    fn wrong_key_is_rejected() {
        let sk = test_keypair();
        let key = sign_license(&license(None), &sk);
        let other_vk = SigningKey::from_bytes(&[7u8; 32]).verifying_key();
        assert!(verify_with_pubkey(&key, &other_vk).is_err());
    }

    #[test]
    fn expired_license_is_rejected() {
        let sk = test_keypair();
        let vk = sk.verifying_key();
        let key = sign_license(&license(Some(1)), &sk); // expired in 1970
        assert!(verify_with_pubkey(&key, &vk).is_err());
    }

    #[test]
    fn malformed_key_is_rejected() {
        let vk = test_keypair().verifying_key();
        assert!(verify_with_pubkey("not-a-license", &vk).is_err());
        assert!(verify_with_pubkey("only-one-part", &vk).is_err());
    }

    #[test]
    fn free_and_pro_entitlements_differ() {
        assert!(!Entitlements::for_tier(Tier::Free).cloud_llm);
        assert!(Entitlements::for_tier(Tier::Pro).cloud_llm);
    }
}
