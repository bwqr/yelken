use std::error::Error;

use base::crypto::Crypto;
use base::db::{BatchQuery, Connection};
use base::middlewares::permission::FULL_PERMS;
use base::models::LoginKind;
use base::responses::HttpError;
use base::schema::{fields, locales, options, permissions, users};
use diesel::backend::Backend;
use diesel::prelude::*;
use diesel_async::{AsyncConnection, RunQueryDsl, scoped_futures::ScopedFutureExt};
use diesel_migrations::{EmbeddedMigrations, MigrationHarness, embed_migrations};
use opendal::Operator;
use serde::Deserialize;

#[cfg(feature = "postgres")]
const MIGRATIONS: EmbeddedMigrations = embed_migrations!("../migrations/postgres");
#[cfg(feature = "sqlite")]
const MIGRATIONS: EmbeddedMigrations = embed_migrations!("../migrations/sqlite");

const DEFAULT_LOCALE: (&'static str, &'static str) = ("en", "English");

#[derive(Deserialize)]
pub struct User {
    pub name: String,
    pub email: String,
    pub password: String,
}

pub struct InstallTheme {
    pub src: Operator,
    pub src_dir: String,
    pub dst: Operator,
}

pub fn migrate<DB: Backend>(
    conn: &mut impl MigrationHarness<DB>,
) -> Result<(), Box<dyn Error + Send + Sync + 'static>> {
    conn.run_pending_migrations(MIGRATIONS).map(|_| ())
}

async fn create_defaults(conn: &mut Connection) -> QueryResult<()> {
    diesel::insert_into(locales::table)
        .values((
            locales::key.eq(DEFAULT_LOCALE.0),
            locales::name.eq(DEFAULT_LOCALE.1),
        ))
        .execute(conn)
        .await?;

    diesel::insert_into(options::table)
        .values([(
            options::key.eq("default_locale"),
            options::value.eq(DEFAULT_LOCALE.0),
        )])
        .batched()
        .execute(conn)
        .await?;

    diesel::insert_into(fields::table)
        .values([
            (
                fields::key.eq("text"),
                fields::name.eq("Text"),
                fields::kind.eq("string"),
            ),
            (
                fields::key.eq("multiline"),
                fields::name.eq("Multiline"),
                fields::kind.eq("multiline"),
            ),
            (
                fields::key.eq("integer"),
                fields::name.eq("Number"),
                fields::kind.eq("int"),
            ),
            (
                fields::key.eq("asset"),
                fields::name.eq("Asset"),
                fields::kind.eq("asset"),
            ),
        ])
        .batched()
        .execute(conn)
        .await?;

    Ok(())
}

async fn create_admin_user(conn: &mut Connection, crypto: &Crypto, user: User) -> QueryResult<()> {
    use rand::{Rng, distr::Alphanumeric, rng};

    let username = user
        .name
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .collect::<String>()
        + "_"
        + (0..4)
            .map(|_| rng().sample(Alphanumeric) as char)
            .collect::<String>()
            .as_str();

    let salt: String = (0..32)
        .map(|_| rng().sample(Alphanumeric) as char)
        .collect();

    let password = crypto.sign512(format!("{salt}{}", user.password).as_bytes());

    let user = diesel::insert_into(users::table)
        .values((
            users::username.eq(username),
            users::name.eq(user.name),
            users::email.eq(user.email),
            users::login_kind.eq(LoginKind::Email),
            users::password.eq(format!("{salt}{password}")),
        ))
        .get_result::<base::models::User>(conn)
        .await?;

    diesel::insert_into(permissions::table)
        .values(
            FULL_PERMS
                .into_iter()
                .map(|perm| {
                    (
                        permissions::user_id.eq(user.id),
                        permissions::key.eq(perm.as_str()),
                    )
                })
                .collect::<Vec<_>>(),
        )
        .batched()
        .execute(conn)
        .await?;

    Ok(())
}

pub async fn init(
    conn: &mut Connection,
    crypto: &Crypto,
    defaults: bool,
    admin: Option<User>,
    theme: Option<InstallTheme>,
) -> Result<(), HttpError> {
    conn.transaction(|conn| {
        async move {
            if defaults {
                create_defaults(conn).await?;

                diesel::insert_into(options::table)
                    .values((
                        options::key.eq("setup.defaults_init"),
                        options::value.eq("true"),
                    ))
                    .execute(conn)
                    .await?;
            }

            if let Some(admin) = admin {
                create_admin_user(conn, crypto, admin).await?;

                diesel::insert_into(options::table)
                    .values((
                        options::key.eq("setup.admin_init"),
                        options::value.eq("true"),
                    ))
                    .execute(conn)
                    .await?;
            }

            QueryResult::<()>::Ok(())
        }
        .scope_boxed()
    })
    .await?;

    if let Some(theme) = theme {
        let theme = store::install_theme(
            conn,
            &theme.src,
            &theme.src_dir,
            &theme.dst,
            DEFAULT_LOCALE.0.to_string(),
        )
        .await?;

        diesel::insert_into(options::table)
            .values([(options::key.eq("theme"), options::value.eq(theme.id))])
            .batched()
            .execute(conn)
            .await?;

        diesel::insert_into(options::table)
            .values((
                options::key.eq("setup.theme_init"),
                options::value.eq("true"),
            ))
            .execute(conn)
            .await?;
    }

    Ok(())
}

async fn check_initialized(conn: &mut Connection, key: &str) -> QueryResult<bool> {
    let Some(value) = options::table
        .filter(options::key.eq(key))
        .select(options::value)
        .first::<String>(conn)
        .await
        .optional()?
    else {
        return Ok(false);
    };

    Ok(value == "true")
}

pub async fn check_admin_initialized(conn: &mut Connection) -> QueryResult<bool> {
    check_initialized(conn, "setup.admin_init").await
}

pub async fn check_defaults_initialized(conn: &mut Connection) -> QueryResult<bool> {
    check_initialized(conn, "setup.defaults_init").await
}

pub async fn check_theme_installed(conn: &mut Connection) -> QueryResult<bool> {
    check_initialized(conn, "setup.theme_init").await
}
