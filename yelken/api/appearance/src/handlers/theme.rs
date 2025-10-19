use std::str::FromStr;

use axum::{
    extract::{Multipart, Path, State},
    Extension, Json,
};
use base::{
    config::Options,
    db::Pool,
    models::{NamespaceSource, Theme},
    responses::HttpError,
    runtime::IntoSendFuture,
    schema::{namespaces, options, themes},
    services::SafePath,
    utils::{LocationKind, ResourceKind},
    AppState,
};
use diesel::{
    prelude::*,
    result::{DatabaseErrorKind, Error},
};
use diesel_async::{scoped_futures::ScopedFutureExt, AsyncConnection, RunQueryDsl};
use opendal::Operator;
use rand::{distr::Alphanumeric, rng, Rng};

use crate::requests::UpdateTheme;
use crate::{L10n, Render};

pub async fn fetch_themes(State(state): State<AppState>) -> Result<Json<Vec<Theme>>, HttpError> {
    themes::table
        .order(themes::created_at.asc())
        .load::<Theme>(&mut state.pool.get().await?)
        .await
        .map(Json)
        .map_err(Into::into)
}

pub async fn activate_theme(
    State(state): State<AppState>,
    Extension(options): Extension<Options>,
    Extension(render): Extension<Render>,
    Extension(l10n): Extension<L10n>,
    Json(req): Json<UpdateTheme>,
) -> Result<(), HttpError> {
    let mut conn = state.pool.get().await?;

    let theme = themes::table
        .filter(themes::id.eq(req.theme))
        .select(themes::id)
        .first::<String>(&mut conn)
        .await?;

    let effected_row: usize = diesel::update(options::table)
        .filter(options::namespace.is_null().and(options::key.eq("theme")))
        .set(options::value.eq(&theme))
        .execute(&mut conn)
        .await?;

    if effected_row == 0 {
        diesel::insert_into(options::table)
            .values((options::key.eq("theme"), options::value.eq(&theme)))
            .execute(&mut conn)
            .await?;
    }

    options.set_theme(theme.into());

    l10n.reload(
        &state.storage,
        &options.locale_locations(),
        &options.locales(),
        options.default_locale(),
    )
    .await;

    render
        .reload(&state.storage, &options.template_locations())
        .await
        .inspect_err(|e| log::warn!("Failed to reload render, {e:?}"))
        .map_err(|_| HttpError::unprocessable_entity("invalid_template"))?;

    Ok(())
}

pub async fn uninstall_theme(
    State(state): State<AppState>,
    Extension(options): Extension<Options>,
    Path(theme): Path<String>,
) -> Result<(), HttpError> {
    if theme == &*options.theme() {
        return Err(HttpError::conflict("cannot_delete_active_theme"));
    }

    let theme = themes::table
        .filter(themes::id.eq(theme))
        .select(themes::id)
        .first::<String>(&mut state.pool.get().await?)
        .await?;

    let namespace = SafePath::from_str(&theme)
        .inspect_err(|e| log::error!("Failed to parse theme as safe path, {e:?}"))
        .map_err(|_| HttpError::internal_server_error("invalid_theme_id"))?;

    let locations = [
        ["themes", &theme].join("/"),
        base::utils::location(
            &LocationKind::User {
                namespace: namespace.clone(),
            },
            ResourceKind::Locale,
        ),
        base::utils::location(&LocationKind::User { namespace }, ResourceKind::Template),
    ];

    state
        .pool
        .get()
        .await?
        .transaction(|conn| {
            async move {
                diesel::delete(namespaces::table)
                    .filter(
                        namespaces::key
                            .eq(&theme)
                            .and(namespaces::source.eq(NamespaceSource::Theme)),
                    )
                    .execute(conn)
                    .await
                    .map_err(|e| {
                        if let Error::DatabaseError(DatabaseErrorKind::ForeignKeyViolation, _) = &e
                        {
                            return HttpError::conflict("namespace_being_used");
                        }

                        e.into()
                    })?;

                for location in locations {
                    let entries = state
                        .storage
                        .list_with(&location)
                        .recursive(true)
                        .into_send_future()
                        .await
                        .inspect_err(|e| {
                            log::warn!("Failed to list theme files for path {location}, {e:?}")
                        })
                        .map_err(|_| HttpError::internal_server_error("io_error"))?;

                    state
                        .storage
                        .delete_iter(entries)
                        .into_send_future()
                        .await
                        .inspect_err(|e| {
                            log::warn!("Failed to delete theme files for path {location}, {e:?}")
                        })
                        .map_err(|_| HttpError::internal_server_error("io_error"))?;
                }

                diesel::delete(themes::table)
                    .filter(themes::id.eq(theme))
                    .execute(&mut state.pool.get().await?)
                    .await?;

                Result::<(), HttpError>::Ok(())
            }
            .scope_boxed()
        })
        .await
        .map_err(Into::into)
}

pub async fn install_theme(
    State(state): State<AppState>,
    Extension(options): Extension<Options>,
    mut multipart: Multipart,
) -> Result<Json<Theme>, HttpError> {
    let field = multipart
        .next_field()
        .await
        .map_err(|_| HttpError::bad_request("invalid_multipart"))?
        .ok_or(HttpError::bad_request("missing_field_in_multipart"))?;

    let name = field
        .name()
        .ok_or(HttpError::bad_request("missing_field_in_multipart"))?;

    if name != "theme" {
        return Err(HttpError::bad_request("missing_field_in_multipart"));
    }

    let archive = field
        .bytes()
        .await
        .map_err(|_| HttpError::bad_request("invalid_multipart"))?
        .to_vec();

    let tmp_theme_dir = (0..32)
        .map(|_| rng().sample(Alphanumeric) as char)
        .collect::<String>();

    let result = install(
        &state.pool,
        &state.storage,
        &state.tmp_storage,
        &archive,
        tmp_theme_dir.clone(),
        format!("{}", options.default_locale()),
    )
    .await;

    if let Err(e) = state
        .tmp_storage
        .remove_all(&tmp_theme_dir)
        .into_send_future()
        .await
    {
        log::warn!(
            "Failed to remove tmp theme dir during installation cleanup, {tmp_theme_dir}, {e:?}"
        );
    }

    result.map(Json)
}

async fn install(
    pool: &Pool,
    storage: &Operator,
    tmp_storage: &Operator,
    archive: &[u8],
    tmp_dir: String,
    default_locale: String,
) -> Result<Theme, HttpError> {
    store::extract_archive(archive, tmp_storage, &tmp_dir)
        .await
        .map_err(|e| {
            HttpError::internal_server_error("failed_extracting_archive")
                .with_context(e.to_string())
        })?;

    let theme = store::install_theme(
        &mut *pool.get().await?,
        tmp_storage,
        &tmp_dir,
        storage,
        default_locale,
    )
    .await?;

    Ok(theme)
}
