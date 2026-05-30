//! Tauri commands for the freemium license (Pro tier) activation flow.

use tauri::State;

use crate::db::DbPool;
use crate::error::MeetflowError;
use crate::licensing::{verify_license_key, Entitlements, Tier};

/// Setting key under which the activated license token is stored.
const LICENSE_SETTING_KEY: &str = "license_key";

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
