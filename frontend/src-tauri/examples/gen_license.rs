//! Operator tool to mint a MeetFlow Pro license key.
//!
//! Usage:
//!   MEETFLOW_LICENSE_PRIVATE_KEY=<hex-32-bytes> \
//!     cargo run --example gen_license -- <email> [tier=pro|free] [days_valid]
//!
//! Prints the signed license key to stdout. The private key must be the one
//! whose public half is embedded in `licensing::LICENSE_PUBLIC_KEY_HEX`.

use ed25519_dalek::SigningKey;
use meetflow_lib::licensing::{sign_license, License, Tier};

fn main() {
    let priv_hex = std::env::var("MEETFLOW_LICENSE_PRIVATE_KEY")
        .expect("set MEETFLOW_LICENSE_PRIVATE_KEY to the 32-byte hex private key");
    let bytes = hex::decode(priv_hex.trim()).expect("private key must be valid hex");
    let seed: [u8; 32] = bytes
        .try_into()
        .expect("private key must be exactly 32 bytes");
    let signing_key = SigningKey::from_bytes(&seed);

    let args: Vec<String> = std::env::args().collect();
    let email = args.get(1).cloned().unwrap_or_else(|| {
        eprintln!("usage: gen_license <email> [pro|free] [days_valid]");
        std::process::exit(2);
    });
    let tier = match args.get(2).map(String::as_str) {
        Some("free") => Tier::Free,
        _ => Tier::Pro,
    };
    let now = chrono::Utc::now().timestamp();
    let expires_at = args
        .get(3)
        .and_then(|s| s.parse::<i64>().ok())
        .map(|days| now + days * 86_400);

    let license = License {
        email,
        tier,
        issued_at: now,
        expires_at,
    };
    println!("{}", sign_license(&license, &signing_key));
}
