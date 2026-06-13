pub mod models;
pub mod schema;
pub mod search;

use std::{path::Path, sync::Mutex};

use rusqlite::Connection;

use crate::error::MeetflowError;

/// Thread-safe SQLite connection wrapper.
/// Stored in Tauri's managed state as `DbPool`.
pub struct DbPool(pub Mutex<Connection>);

/// Open (or create) the SQLite database and run all migrations.
pub fn init(db_path: &Path) -> Result<DbPool, MeetflowError> {
    let conn = Connection::open(db_path)?;

    // Performance pragmas — safe for single-writer desktop use
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA synchronous  = NORMAL;
         PRAGMA foreign_keys = ON;
         PRAGMA cache_size   = -4096;", // 4 MB page cache
    )?;

    schema::run_migrations(&conn)?;

    tracing::info!("Database initialized at {}", db_path.display());
    Ok(DbPool(Mutex::new(conn)))
}
