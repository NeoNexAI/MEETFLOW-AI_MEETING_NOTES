//! Tauri commands for the freemium license (Pro tier) activation flow.

use tauri::State;

use crate::commands::settings::keys::LICENSE_KEY as LICENSE_SETTING_KEY;
use crate::db::DbPool;
use crate::error::MeetflowError;
use crate::licensing::{verify_license_key, Entitlements, Tier};

/// Current license state surfaced to the UI.
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LicenseStatus {
    pub tier: Tier,
    pub email: Option<String>,
    pub entitlements: Entitlements,
    pub valid: bool,
}

impl LicenseStatus {
    fn free() -> Self {
        Self {
            tier: Tier::Free,
            email: None,
            entitlements: Entitlements::for_tier(Tier::Free),
            valid: true,
        }
    }
}

/// Current entitlements for the installed license (Free if none/invalid).
/// Used by other commands to enforce Pro-only features in the backend.
pub fn current_entitlements(db: &DbPool) -> Entitlements {
    let tier = read_license_key(db)
        .ok()
        .flatten()
        .and_then(|key| verify_license_key(&key).ok())
        .map_or(Tier::Free, |lic| lic.tier);
    Entitlements::for_tier(tier)
}

fn read_license_key(db: &DbPool) -> Result<Option<String>, MeetflowError> {
    let conn =
        db.0.lock()
            .map_err(|_| MeetflowError::Db("Lock poisoned".into()))?;
    match conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        rusqlite::params![LICENSE_SETTING_KEY],
        |row| row.get::<_, String>(0),
    ) {
        Ok(v) => Ok(Some(v)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.into()),
    }
}

/// Get the current license status. Returns the Free tier when no valid license
/// is stored (an invalid/expired stored key degrades gracefully to Free).
#[tauri::command]
pub fn get_license_status(db: State<'_, DbPool>) -> Result<LicenseStatus, MeetflowError> {
    let Some(key) = read_license_key(&db)? else {
        return Ok(LicenseStatus::free());
    };
    match verify_license_key(&key) {
        Ok(license) => Ok(LicenseStatus {
            entitlements: Entitlements::for_tier(license.tier),
            tier: license.tier,
            email: Some(license.email),
            valid: true,
        }),
        Err(_) => Ok(LicenseStatus::free()),
    }
}

/// Activate a license key. Verifies the signature offline; on success persists
/// the key and returns the unlocked status. On failure nothing is stored.
#[tauri::command]
pub fn activate_license(
    db: State<'_, DbPool>,
    key: String,
) -> Result<LicenseStatus, MeetflowError> {
    let license = verify_license_key(key.trim())?;

    {
        let conn =
            db.0.lock()
                .map_err(|_| MeetflowError::Db("Lock poisoned".into()))?;
        let now = chrono::Utc::now().timestamp_millis();
        conn.execute(
            "INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3)
             ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = ?3",
            rusqlite::params![LICENSE_SETTING_KEY, key.trim(), now],
        )?;
    }

    tracing::info!("License activated for {}", license.email);
    Ok(LicenseStatus {
        entitlements: Entitlements::for_tier(license.tier),
        tier: license.tier,
        email: Some(license.email),
        valid: true,
    })
}

/// Remove the stored license, reverting to the Free tier.
#[tauri::command]
pub fn deactivate_license(db: State<'_, DbPool>) -> Result<(), MeetflowError> {
    let conn =
        db.0.lock()
            .map_err(|_| MeetflowError::Db("Lock poisoned".into()))?;
    conn.execute(
        "DELETE FROM settings WHERE key = ?1",
        rusqlite::params![LICENSE_SETTING_KEY],
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    /// In-memory DB with the schema applied, for command-level integration tests.
    fn test_db() -> DbPool {
        let conn = rusqlite::Connection::open_in_memory().expect("open in-memory db");
        crate::db::schema::run_migrations(&conn).expect("migrations");
        DbPool(Mutex::new(conn))
    }

    fn put_license(db: &DbPool, value: &str) {
        let conn = db.0.lock().unwrap();
        conn.execute(
            "INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, 0)
             ON CONFLICT(key) DO UPDATE SET value = ?2",
            rusqlite::params![LICENSE_SETTING_KEY, value],
        )
        .unwrap();
    }

    #[test]
    fn no_license_is_free_tier() {
        let db = test_db();
        let ent = current_entitlements(&db);
        assert!(!ent.cloud_llm);
        assert!(!ent.large_models);
    }

    #[test]
    fn invalid_stored_license_degrades_to_free() {
        let db = test_db();
        put_license(&db, "garbage.not-a-real-token");
        let ent = current_entitlements(&db);
        assert!(!ent.cloud_llm, "an unverifiable key must not unlock Pro");
    }

    #[test]
    fn read_license_key_round_trips_through_db() {
        let db = test_db();
        assert!(read_license_key(&db).unwrap().is_none());
        put_license(&db, "some-token");
        assert_eq!(
            read_license_key(&db).unwrap().as_deref(),
            Some("some-token")
        );
    }
}
