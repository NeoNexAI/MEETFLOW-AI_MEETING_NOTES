//! Encryption-at-rest for secret settings (LLM API keys).
//!
//! # Threat model
//!
//! This module encrypts secret setting values (e.g. `llm_config`, which embeds
//! the user's cloud LLM API key) before they are written to the SQLite database,
//! satisfying CLAUDE.md §8 ("nunca API keys en código ni `.env` sin cifrado").
//!
//! What this protects against:
//! - Casual inspection of the SQLite DB file with a generic viewer.
//! - Accidental sharing / leaking of the `meetflow.db` file (e.g. attaching it
//!   to a bug report, or having it picked up by a cloud-sync / backup folder).
//!
//! What this does **NOT** protect against:
//! - An attacker with full read access to the local filesystem. The AES key is
//!   stored at `app_data_dir/secret.key`, right next to the database, so anyone
//!   who can read the DB can also read the key. Proper protection against a
//!   local attacker requires an OS keychain / DPAPI-backed key store, which is
//!   a planned future improvement.
//!
//! Crypto: AES-256-GCM with a random 12-byte nonce per value. The on-disk token
//! format is `"v1:" || base64(nonce || ciphertext)`. The `v1:` prefix lets
//! [`decrypt`] detect the format and lets callers treat prefix-less values as
//! legacy plaintext for backward-compatible migration.

use aes_gcm::aead::{Aead, OsRng};
use aes_gcm::{AeadCore, Aes256Gcm, Key, KeyInit, Nonce};
use base64::Engine as _;
use tauri::AppHandle;

use crate::error::MeetflowError;
use crate::storage;

/// Filename of the persisted AES key inside the app data directory.
const KEY_FILE: &str = "secret.key";

/// Version prefix for the encrypted-token format. Used to distinguish current
/// ciphertext from legacy plaintext values.
const VERSION_PREFIX: &str = "v1:";

/// AES-256-GCM nonce length in bytes (96 bits, the standard GCM nonce size).
const NONCE_LEN: usize = 12;

/// Load the persisted 256-bit AES key, generating and persisting one on first use.
///
/// On unix the key file is created with `0o600` permissions so only the owner
/// can read it.
fn load_or_create_key(app: &AppHandle) -> Result<[u8; 32], MeetflowError> {
    let key_path = storage::app_data_dir(app)?.join(KEY_FILE);

    if key_path.exists() {
        let bytes = std::fs::read(&key_path)?;
        if bytes.len() != 32 {
            return Err(MeetflowError::Storage(format!(
                "secret key file is corrupt: expected 32 bytes, found {}",
                bytes.len()
            )));
        }
        let mut key = [0u8; 32];
        key.copy_from_slice(&bytes);
        return Ok(key);
    }

    // First use: generate a fresh random key and persist it.
    let key = Aes256Gcm::generate_key(&mut OsRng);
    let mut bytes = [0u8; 32];
    bytes.copy_from_slice(key.as_slice());

    if let Some(parent) = key_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&key_path, bytes)?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt as _;
        let perms = std::fs::Permissions::from_mode(0o600);
        std::fs::set_permissions(&key_path, perms)?;
    }

    tracing::info!(
        "Generated new secret encryption key at {}",
        key_path.display()
    );
    Ok(bytes)
}

/// Encrypt `plaintext` with the given 32-byte key, returning a versioned,
/// base64-encoded token (`"v1:" || base64(nonce || ciphertext)`).
fn encrypt_with_key(key: &[u8; 32], plaintext: &str) -> Result<String, MeetflowError> {
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key));
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let ciphertext = cipher
        .encrypt(&nonce, plaintext.as_bytes())
        .map_err(|e| MeetflowError::Storage(format!("encryption failed: {e}")))?;

    let mut combined = Vec::with_capacity(NONCE_LEN + ciphertext.len());
    combined.extend_from_slice(nonce.as_slice());
    combined.extend_from_slice(&ciphertext);

    let encoded = base64::engine::general_purpose::STANDARD.encode(&combined);
    Ok(format!("{VERSION_PREFIX}{encoded}"))
}

/// Decrypt a token produced by [`encrypt_with_key`] using the given 32-byte key.
///
/// Returns an error if the token lacks the `"v1:"` prefix (so callers can treat
/// it as legacy plaintext), or if the token is otherwise malformed / corrupt /
/// fails authentication.
fn decrypt_with_key(key: &[u8; 32], token: &str) -> Result<String, MeetflowError> {
    let Some(encoded) = token.strip_prefix(VERSION_PREFIX) else {
        return Err(MeetflowError::Storage(
            "token is not in encrypted format (missing version prefix); treat as legacy plaintext"
                .into(),
        ));
    };

    let combined = base64::engine::general_purpose::STANDARD
        .decode(encoded)
        .map_err(|e| MeetflowError::Storage(format!("invalid base64 in encrypted token: {e}")))?;

    if combined.len() <= NONCE_LEN {
        return Err(MeetflowError::Storage(
            "encrypted token is too short to contain a nonce + ciphertext".into(),
        ));
    }

    let (nonce_bytes, ciphertext) = combined.split_at(NONCE_LEN);
    let nonce = Nonce::from_slice(nonce_bytes);

    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key));
    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| MeetflowError::Storage(format!("decryption failed: {e}")))?;

    String::from_utf8(plaintext)
        .map_err(|e| MeetflowError::Storage(format!("decrypted bytes are not valid UTF-8: {e}")))
}

/// Encrypt `plaintext` at rest using the app's persisted AES-256-GCM key.
///
/// Returns a versioned base64 token suitable for storing in the database.
pub fn encrypt(app: &AppHandle, plaintext: &str) -> Result<String, MeetflowError> {
    let key = load_or_create_key(app)?;
    encrypt_with_key(&key, plaintext)
}

/// Decrypt a token previously produced by [`encrypt`].
///
/// If the token lacks the `"v1:"` prefix this returns an error so callers can
/// fall back to treating the stored value as legacy plaintext.
pub fn decrypt(app: &AppHandle, token: &str) -> Result<String, MeetflowError> {
    let key = load_or_create_key(app)?;
    decrypt_with_key(&key, token)
}

#[cfg(test)]
mod tests {
    use super::*;

    const TEST_KEY: [u8; 32] = [7u8; 32];

    #[test]
    fn round_trip_recovers_plaintext() {
        let secret = r#"{"provider":"claude","api_key":"sk-ant-secret-123"}"#;
        let token = encrypt_with_key(&TEST_KEY, secret).expect("encrypt");
        assert!(token.starts_with(VERSION_PREFIX));
        assert!(!token.contains("sk-ant-secret-123"));
        let decrypted = decrypt_with_key(&TEST_KEY, &token).expect("decrypt");
        assert_eq!(decrypted, secret);
    }

    #[test]
    fn round_trip_handles_empty_string() {
        let token = encrypt_with_key(&TEST_KEY, "").expect("encrypt");
        let decrypted = decrypt_with_key(&TEST_KEY, &token).expect("decrypt");
        assert_eq!(decrypted, "");
    }

    #[test]
    fn decrypt_of_plaintext_without_prefix_errors() {
        let err = decrypt_with_key(&TEST_KEY, "just plain text, no prefix");
        assert!(err.is_err());
    }

    #[test]
    fn decrypt_of_corrupt_token_errors() {
        let err = decrypt_with_key(&TEST_KEY, "v1:not-valid-base64-@@@");
        assert!(err.is_err());
    }

    #[test]
    fn decrypt_with_wrong_key_errors() {
        let token = encrypt_with_key(&TEST_KEY, "secret").expect("encrypt");
        let wrong_key = [9u8; 32];
        let err = decrypt_with_key(&wrong_key, &token);
        assert!(err.is_err());
    }

    #[test]
    fn decrypt_of_truncated_token_errors() {
        // Valid prefix + valid base64 but too short to hold a nonce.
        let short = base64::engine::general_purpose::STANDARD.encode([0u8; 4]);
        let err = decrypt_with_key(&TEST_KEY, &format!("{VERSION_PREFIX}{short}"));
        assert!(err.is_err());
    }
}
