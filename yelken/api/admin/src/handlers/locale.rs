use appearance::L10n;
use axum::{
    extract::{Path, Query, State},
    Extension, Json,
};
use base::{
    config::Options,
    models::Locale,
    responses::HttpError,
    runtime::IntoSendFuture,
    schema::{locales, options, themes},
    utils::{LocationKind, ResourceKind},
    AppState,
};
use diesel::{
    prelude::*,
    result::{DatabaseErrorKind, Error},
};
use diesel_async::RunQueryDsl;
use fluent::FluentResource;
use opendal::ErrorKind;
use unic_langid::LanguageIdentifier;

use crate::{
    requests::{
        CreateLocale, FilterNamespace, UpdateDefaultLocale, UpdateLocale, UpdateLocaleResource,
        UpdateLocaleState,
    },
    responses::LocaleResource,
};

pub async fn create_locale(
    State(state): State<AppState>,
    Extension(options): Extension<Options>,
    Extension(l10n): Extension<L10n>,
    Json(req): Json<CreateLocale>,
) -> Result<Json<Locale>, HttpError> {
    if req.key.parse::<LanguageIdentifier>().is_err() {
        return Err(HttpError::unprocessable_entity("invalid_locale_key"));
    }

    let mut conn = state.pool.get().await?;

    let locale = diesel::insert_into(locales::table)
        .values((locales::key.eq(req.key), locales::name.eq(req.name)))
        .get_result::<Locale>(&mut conn)
        .await
        .map_err(|e| {
            if let Error::DatabaseError(DatabaseErrorKind::UniqueViolation, _) = &e {
                return HttpError::conflict("locale_key_already_exists");
            }

            e.into()
        })?;

    options.set_locales(Options::load_locales(&mut conn).await?);

    l10n.reload(
        &state.storage,
        &options.locale_locations(),
        &options.locales(),
        options.default_locale(),
    )
    .await;

    Ok(Json(locale))
}

pub async fn update_locale(
    State(state): State<AppState>,
    Path(locale_key): Path<String>,
    Json(req): Json<UpdateLocale>,
) -> Result<(), HttpError> {
    let effected_row: usize = diesel::update(locales::table)
        .filter(locales::key.eq(locale_key))
        .set(locales::name.eq(req.name))
        .execute(&mut state.pool.get().await?)
        .await?;

    if effected_row == 0 {
        return Err(HttpError::not_found("locale_not_found"));
    }

    Ok(())
}

pub async fn update_locale_state(
    State(state): State<AppState>,
    Extension(options): Extension<Options>,
    Extension(l10n): Extension<L10n>,
    Path(locale_key): Path<String>,
    Json(req): Json<UpdateLocaleState>,
) -> Result<(), HttpError> {
    if req.disabled && format!("{}", options.default_locale()) == locale_key {
        return Err(HttpError::conflict("cannot_disable_default_locale"));
    }

    let mut conn = state.pool.get().await?;

    let effected_row = diesel::update(locales::table)
        .filter(locales::key.eq(locale_key))
        .set(locales::disabled.eq(req.disabled))
        .execute(&mut conn)
        .await?;

    if effected_row == 0 {
        return Err(HttpError::not_found("locale_not_found"));
    }

    options.set_locales(Options::load_locales(&mut conn).await?);

    l10n.reload(
        &state.storage,
        &options.locale_locations(),
        &options.locales(),
        options.default_locale(),
    )
    .await;

    Ok(())
}

pub async fn delete_locale(
    State(state): State<AppState>,
    Extension(options): Extension<Options>,
    Extension(l10n): Extension<L10n>,
    Path(locale_key): Path<String>,
) -> Result<(), HttpError> {
    if format!("{}", options.default_locale()) == locale_key {
        return Err(HttpError::conflict("cannot_delete_default_locale"));
    }

    let mut conn = state.pool.get().await?;

    let effected_row = diesel::delete(locales::table)
        .filter(locales::key.eq(&locale_key))
        .execute(&mut conn)
        .await
        .map_err(|e| {
            if let Error::DatabaseError(DatabaseErrorKind::ForeignKeyViolation, _) = &e {
                return HttpError::conflict("locale_being_used");
            }

            e.into()
        })?;

    if effected_row == 0 {
        return Err(HttpError::not_found("locale_not_found"));
    }

    // TODO consider removing resources belonging to this locale

    options.set_locales(Options::load_locales(&mut conn).await?);

    l10n.reload(
        &state.storage,
        &options.locale_locations(),
        &options.locales(),
        options.default_locale(),
    )
    .await;

    Ok(())
}

pub async fn fetch_locale_resource(
    State(state): State<AppState>,
    Path(locale_key): Path<String>,
    Query(query): Query<LocationKind>,
) -> Result<Json<LocaleResource>, HttpError> {
    match &query {
        LocationKind::User { namespace } | LocationKind::Theme { namespace } => {
            let exists = diesel::dsl::select(diesel::dsl::exists(
                themes::table.filter(themes::id.eq(namespace.inner())),
            ))
            .get_result::<bool>(&mut state.pool.get().await?)
            .await?;

            if !exists {
                return Err(HttpError::conflict("namespace_not_found"));
            }
        }
        LocationKind::Global => {}
    };

    let locale_key = locales::table
        .filter(locales::key.eq(locale_key))
        .select(locales::key)
        .first::<String>(&mut state.pool.get().await?)
        .await
        .optional()?
        .ok_or_else(|| HttpError::not_found("locale_not_found"))?;

    let location = base::utils::location(&query, ResourceKind::Locale);
    let path = format!("{location}/{locale_key}.ftl");

    let buf = match state.storage.read(&path).into_send_future().await {
        Ok(buf) => buf,
        Err(e) if e.kind() == ErrorKind::NotFound => {
            return Err(HttpError::not_found("resource_not_found"))
        }
        Err(e) => {
            log::warn!("Failed to read resource at path {}, {e:?}", path);

            return Err(HttpError::internal_server_error("failed_to_read_resource"));
        }
    };

    let Ok(resource) = String::from_utf8(buf.to_bytes().to_vec())
        .inspect_err(|e| log::warn!("Failed to read resource as string {e:?}"))
    else {
        return Err(HttpError::internal_server_error("invalid_locale_file"));
    };

    Ok(Json(LocaleResource { resource }))
}

pub async fn update_locale_resource(
    State(state): State<AppState>,
    Extension(options): Extension<Options>,
    Extension(l10n): Extension<L10n>,
    Path(locale_key): Path<String>,
    Query(query): Query<FilterNamespace>,
    Json(req): Json<UpdateLocaleResource>,
) -> Result<(), HttpError> {
    let location = if let Some(namespace) = query.namespace {
        let exists = diesel::dsl::select(diesel::dsl::exists(
            themes::table.filter(themes::id.eq(namespace.inner())),
        ))
        .get_result::<bool>(&mut state.pool.get().await?)
        .await?;

        if !exists {
            return Err(HttpError::conflict("namespace_not_found"));
        }

        LocationKind::User { namespace }
    } else {
        LocationKind::Global
    };

    if let Err(e) = FluentResource::try_new(req.resource.clone()) {
        log::debug!("Failed to parse fluent resource successfully, {e:?}");

        return Err(HttpError::unprocessable_entity("invalid_fluent_resource"));
    }

    let locale_key = locales::table
        .filter(locales::key.eq(locale_key))
        .select(locales::key)
        .first::<String>(&mut state.pool.get().await?)
        .await
        .optional()?
        .ok_or_else(|| HttpError::not_found("locale_not_found"))?;

    let location = base::utils::location(&location, ResourceKind::Locale);
    let path = format!("{location}/{locale_key}.ftl");

    state
        .storage
        .write(&path, req.resource)
        .into_send_future()
        .await
        .inspect_err(|e| log::error!("Failed to write resource at path {path}, {e:?}"))
        .map_err(|_| HttpError::internal_server_error("failed_writing_resource"))?;

    l10n.reload(
        &state.storage,
        &options.locale_locations(),
        &options.locales(),
        options.default_locale(),
    )
    .await;

    Ok(())
}

pub async fn delete_locale_resource(
    State(state): State<AppState>,
    Extension(options): Extension<Options>,
    Extension(l10n): Extension<L10n>,
    Path(locale_key): Path<String>,
    Query(query): Query<FilterNamespace>,
) -> Result<(), HttpError> {
    let location = if let Some(namespace) = query.namespace {
        let exists = diesel::dsl::select(diesel::dsl::exists(
            themes::table.filter(themes::id.eq(namespace.inner())),
        ))
        .get_result::<bool>(&mut state.pool.get().await?)
        .await?;

        if !exists {
            return Err(HttpError::conflict("namespace_not_found"));
        }

        LocationKind::User { namespace }
    } else {
        LocationKind::Global
    };

    let locale_key = locales::table
        .filter(locales::key.eq(locale_key))
        .select(locales::key)
        .first::<String>(&mut state.pool.get().await?)
        .await
        .optional()?
        .ok_or_else(|| HttpError::not_found("locale_not_found"))?;

    let location = base::utils::location(&location, ResourceKind::Locale);
    let path = format!("{location}/{locale_key}.ftl");

    state
        .storage
        .delete(&path)
        .into_send_future()
        .await
        .inspect_err(|e| log::error!("Failed to remove locale resource at path {path}, {e:?}"))
        .map_err(|_| HttpError::internal_server_error("failed_deleting_resource"))?;

    l10n.reload(
        &state.storage,
        &options.locale_locations(),
        &options.locales(),
        options.default_locale(),
    )
    .await;

    Ok(())
}

pub async fn update_default_locale(
    State(state): State<AppState>,
    Extension(options): Extension<Options>,
    Extension(l10n): Extension<L10n>,
    Json(req): Json<UpdateDefaultLocale>,
) -> Result<(), HttpError> {
    let mut conn = state.pool.get().await?;

    let locale_key: LanguageIdentifier = req
        .locale
        .parse()
        .map_err(|_| HttpError::unprocessable_entity("invalid_locale_key"))?;

    let (locale, disabled) = locales::table
        .filter(locales::key.eq(req.locale))
        .select((locales::key, locales::disabled))
        .first::<(String, bool)>(&mut conn)
        .await?;

    if disabled {
        return Err(HttpError::conflict("locale_disabled"));
    }

    let effected_row: usize = diesel::update(options::table)
        .filter(
            options::namespace
                .is_null()
                .and(options::key.eq("default_locale")),
        )
        .set(options::value.eq(&locale))
        .execute(&mut conn)
        .await?;

    if effected_row == 0 {
        diesel::insert_into(options::table)
            .values((
                options::key.eq("default_locale"),
                options::value.eq(&locale),
            ))
            .execute(&mut conn)
            .await?;
    }

    options.set_default_locale(locale_key);

    l10n.reload(
        &state.storage,
        &options.locale_locations(),
        &options.locales(),
        options.default_locale(),
    )
    .await;

    Ok(())
}
