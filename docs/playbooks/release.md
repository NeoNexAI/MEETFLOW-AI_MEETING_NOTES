# Release Playbook — MeetFlow

Operator runbook for cutting a release and operating the freemium licensing.

---

## 1. Pre-release checklist

- [ ] `cargo fmt --all -- --check`, `cargo clippy --all-features -- -D warnings`, `cargo test` green.
- [ ] `pnpm type-check`, `pnpm lint`, `pnpm test` green; i18n EN/ES parity.
- [ ] **Pin Whisper SHA256 checksums** (see §2).
- [ ] Replace the **bootstrap license keypair** with a production one (see §3).
- [ ] Set the real **Stripe Payment Link** (see §4).
- [ ] `PRIVACY.md` / `TERMS.md` reviewed.
- [ ] Bump version in `frontend/src-tauri/tauri.conf.json`, `Cargo.toml`, `package.json`, `CHANGELOG.md`.

## 2. Pin Whisper model checksums

`frontend/src-tauri/src/whisper/mod.rs` ships `sha256: ""` for the small/medium/
large models (the original placeholders were invalid). Download each model from
the HuggingFace URL in the catalog and pin the real digest:

```bash
curl -L <hf_url> -o model.bin && sha256sum model.bin
```

Paste the 64-char hex into the catalog entry. A 64-char value is verified after
download; any other length is skipped with a warning.

## 3. Licensing keypair (Ed25519, offline)

Licenses are signed offline; the app verifies them against the public key
embedded in `licensing::LICENSE_PUBLIC_KEY_HEX`. The shipped value is a
**bootstrap** key — generate your own and keep the private half secret.

**Generate a production keypair** (do this once, on a trusted machine):

```bash
# 32 random bytes = private seed; derive the public key.
head -c 32 /dev/urandom | xxd -p -c 64           # -> PRIVATE (hex, keep secret)
# Derive the public key from that seed using the gen tool below, or any Ed25519 lib.
```

Then:
1. Put the **public** hex into `LICENSE_PUBLIC_KEY_HEX` and rebuild.
2. Store the **private** hex in your secret manager (never commit it).

**Mint a license key** for a buyer (after payment):

```bash
MEETFLOW_LICENSE_PRIVATE_KEY=<private-hex> \
  cargo run --example gen_license -- buyer@example.com pro          # perpetual
MEETFLOW_LICENSE_PRIVATE_KEY=<private-hex> \
  cargo run --example gen_license -- buyer@example.com pro 365      # 365-day
```

The printed token is the license key the buyer pastes into
Settings → Plan → Activate.

## 4. Stripe checkout

1. Create a **Payment Link** in Stripe for the Pro product.
2. Set its URL in `STRIPE_CHECKOUT_URL` (`frontend/src/app/(app)/settings/page.tsx`).
3. Add a Stripe **webhook** (`checkout.session.completed`) on your backend that
   runs `gen_license` with the buyer's email and emails them the key.
   (The desktop app never talks to Stripe directly — it only opens the link.)

This keeps the app local-first: no accounts, no phone-home, offline verification.

## 5. Build & publish

Tag `vX.Y.Z` → `.github/workflows/release.yml` builds the Windows NSIS installer
and drafts a GitHub Release. Review the draft, attach notes from `CHANGELOG.md`,
publish.

```bash
git tag v0.1.0 && git push origin v0.1.0
```
