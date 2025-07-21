use std::error::Error;

use base::middlewares::permission::FULL_PERMS;
use base::models::{LoginKind, NamespaceSource, PageKind};
use base::schema::{
    fields, locales, model_fields, models, namespaces, options, pages, permissions, themes, users,
};
use base::{crypto::Crypto, db::SyncConnection};
use diesel::backend::Backend;
use diesel::prelude::*;
use diesel_migrations::{EmbeddedMigrations, MigrationHarness, embed_migrations};
use serde::Deserialize;

#[cfg(feature = "postgres")]
pub const MIGRATIONS: EmbeddedMigrations = embed_migrations!("../migrations/postgres");
#[cfg(feature = "sqlite")]
pub const MIGRATIONS: EmbeddedMigrations = embed_migrations!("../migrations/sqlite");

#[derive(Deserialize)]
pub struct User {
    pub name: String,
    pub email: String,
    pub password: String,
}

pub fn migrate<DB: Backend>(
    conn: &mut impl MigrationHarness<DB>,
) -> Result<(), Box<dyn Error + Send + Sync + 'static>> {
    conn.run_pending_migrations(MIGRATIONS).map(|_| ())
}

pub fn create_defaults(conn: &mut SyncConnection) -> QueryResult<()> {
    diesel::insert_into(themes::table)
        .values((
            themes::id.eq("default"),
            themes::version.eq("0.1.0"),
            themes::name.eq("Yelken Default Theme"),
        ))
        .execute(conn)?;

    diesel::insert_into(namespaces::table)
        .values((
            namespaces::key.eq("default"),
            namespaces::source.eq(NamespaceSource::Theme),
        ))
        .execute(conn)?;

    diesel::insert_into(locales::table)
        .values((locales::key.eq("en"), locales::name.eq("English")))
        .execute(conn)?;

    diesel::insert_into(options::table)
        .values([
            (options::key.eq("theme"), options::value.eq("default")),
            (options::key.eq("default_locale"), options::value.eq("en")),
        ])
        .execute(conn)?;

    let fields = diesel::insert_into(fields::table)
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
        .get_results::<base::models::Field>(conn)?;

    let model = diesel::insert_into(models::table)
        .values((
            models::namespace.eq(Option::<String>::None),
            models::key.eq("article"),
            models::name.eq("Article"),
        ))
        .get_result::<base::models::Model>(conn)?;

    diesel::insert_into(model_fields::table)
        .values([
            (
                model_fields::model_id.eq(model.id),
                model_fields::field_id.eq(fields[0].id),
                model_fields::key.eq("title"),
                model_fields::name.eq("Title"),
                model_fields::localized.eq(true),
                model_fields::required.eq(true),
            ),
            (
                model_fields::model_id.eq(model.id),
                model_fields::field_id.eq(fields[0].id),
                model_fields::key.eq("content"),
                model_fields::name.eq("Content"),
                model_fields::localized.eq(true),
                model_fields::required.eq(true),
            ),
            (
                model_fields::model_id.eq(model.id),
                model_fields::field_id.eq(fields[0].id),
                model_fields::key.eq("slug"),
                model_fields::name.eq("Slug"),
                model_fields::localized.eq(true),
                model_fields::required.eq(true),
            ),
        ])
        .execute(conn)?;

    diesel::insert_into(pages::table)
        .values([
            (
                pages::namespace.eq("default"),
                pages::key.eq("home"),
                pages::name.eq("Home"),
                pages::path.eq("/"),
                pages::kind.eq(PageKind::Template),
                pages::value.eq("index.html"),
                pages::locale.eq("en"),
            ),
            (
                pages::namespace.eq("default"),
                pages::key.eq("article"),
                pages::name.eq("Article"),
                pages::path.eq("/article/{slug}"),
                pages::kind.eq(PageKind::Template),
                pages::value.eq("article.html"),
                pages::locale.eq("en"),
            ),
        ])
        .execute(conn)?;

    Ok(())
}

pub fn create_admin_user(
    conn: &mut SyncConnection,
    crypto: &Crypto,
    user: User,
) -> QueryResult<()> {
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
        .get_result::<base::models::User>(conn)?;

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
        .execute(conn)
        .unwrap();

    Ok(())
}

pub fn initialize_db(
    conn: &mut SyncConnection,
    crypto: &Crypto,
    defaults: bool,
    admin: Option<User>,
) -> QueryResult<()> {
    conn.transaction(|conn| {
        if defaults {
            create_defaults(conn)?;

            diesel::insert_into(options::table)
                .values((
                    options::key.eq("setup.defaults_init"),
                    options::value.eq("true"),
                ))
                .execute(conn)?;
        }

        if let Some(admin) = admin {
            create_admin_user(conn, crypto, admin)?;

            diesel::insert_into(options::table)
                .values((
                    options::key.eq("setup.admin_init"),
                    options::value.eq("true"),
                ))
                .execute(conn)?;
        }

        Ok(())
    })
}

fn check_initialized(conn: &mut SyncConnection, key: &str) -> QueryResult<bool> {
    let Some(value) = options::table
        .filter(options::key.eq(key))
        .select(options::value)
        .first::<String>(conn)
        .optional()?
    else {
        return Ok(false);
    };

    Ok(value == "true")
}

pub fn check_admin_initialized(conn: &mut SyncConnection) -> QueryResult<bool> {
    check_initialized(conn, "setup.admin_init")
}

pub fn check_defaults_initialized(conn: &mut SyncConnection) -> QueryResult<bool> {
    check_initialized(conn, "setup.defaults_init")
}
