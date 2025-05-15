use std::error::Error;

use diesel::backend::Backend;
use diesel_migrations::{EmbeddedMigrations, MigrationHarness, embed_migrations};
pub const MIGRATIONS: EmbeddedMigrations = embed_migrations!("../migrations");

pub fn migrate<DB: Backend>(
    conn: &mut impl MigrationHarness<DB>,
) -> Result<(), Box<dyn Error + Send + Sync + 'static>> {
    conn.run_pending_migrations(MIGRATIONS).map(|_| ())
}
