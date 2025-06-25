use std::{collections::HashMap, ffi::OsStr, io::Read, str::FromStr};

use axum::{
    extract::{Multipart, Path, State},
    http::StatusCode,
    Extension, Json,
};
use base::{
    config::Options,
    db::{BatchQuery, Pool, PooledConnection},
    middlewares::auth::AuthUser,
    models::{ContentStage, Field, Locale, NamespaceSource, Theme},
    responses::HttpError,
    runtime::{spawn_blocking, IntoSendFuture},
    schema::{
        content_values, contents, fields, locales, model_fields, models, namespaces, pages, themes,
    },
    services::SafePath,
    utils::{LocationKind, ResourceKind},
    AppState,
};
use bytes::Buf;
use diesel::{
    prelude::*,
    result::{DatabaseErrorKind, Error},
};
use diesel_async::{scoped_futures::ScopedFutureExt, AsyncConnection, RunQueryDsl};
use opendal::Operator;
use rand::{distr::Alphanumeric, rng, Rng};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct ContentValue {
    field: String,
    value: String,
    locale: Option<String>,
}

#[derive(Debug, Deserialize)]
struct Content {
    name: String,
    model: String,
    values: Vec<ContentValue>,
}

#[derive(Debug, Deserialize)]
struct ModelField {
    field: String,
    key: String,
    name: String,
    desc: Option<String>,
    localized: Option<bool>,
    multiple: Option<bool>,
    required: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct Model {
    key: String,
    name: String,
    desc: Option<String>,
    fields: Vec<ModelField>,
}

#[derive(Debug, Deserialize)]
struct Page {
    key: String,
    name: String,
    desc: Option<String>,
    path: String,
    template: String,
    locale: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ThemeManifest {
    id: String,
    version: String,
    name: String,
    models: Vec<Model>,
    contents: Vec<Content>,
    pages: Vec<Page>,
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
    user: AuthUser,
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

    let reader = field
        .bytes()
        .await
        .map_err(|_| HttpError::bad_request("invalid_multipart"))?
        .reader();

    let tmp_theme_dir = (0..32)
        .map(|_| rng().sample(Alphanumeric) as char)
        .collect::<String>();

    let result = install(
        &state.pool,
        &state.storage,
        &state.tmp_storage,
        reader,
        tmp_theme_dir.clone(),
        user.id,
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
    reader: impl Read + Send + 'static,
    tmp_dir: String,
    user_id: i32,
    default_locale: String,
) -> Result<Theme, HttpError> {
    let (manifest, files) = {
        let tmp_storage = tmp_storage.clone();
        let extract_dir = tmp_dir.clone();

        spawn_blocking(move || extract_archive(reader, tmp_storage.clone(), extract_dir))
            .await
            .map_err(|_| HttpError::internal_server_error("blocking_error"))
    }??;

    let theme_id = manifest.id.clone();

    let theme = pool
        .get()
        .await?
        .transaction(move |conn| {
            async move { create_theme(conn, manifest, user_id, default_locale).await }.scope_boxed()
        })
        .await?;

    for file in files {
        let src_path = [tmp_dir.as_str(), file.as_str()].join("/");

        let dest_path = ["themes", &theme_id, &file].join("/");

        let file = tmp_storage
            .read(&src_path)
            .into_send_future()
            .await
            .inspect_err(|e| {
                log::warn!("Failed to read file to copy to persistent storage, {src_path}, {e:?}")
            })
            .map_err(|_| HttpError::internal_server_error("io_error"))?;

        storage
            .write(&dest_path, file)
            .into_send_future()
            .await
            .inspect_err(|e| {
                log::warn!("Failed to write file to persistent storage, {dest_path}, {e:?}")
            })
            .map_err(|_| HttpError::internal_server_error("io_error"))?;
    }

    Ok(theme)
}

fn extract_archive(
    mut reader: impl Read,
    tmp_storage: Operator,
    dir: String,
) -> Result<(ThemeManifest, Vec<String>), HttpError> {
    let mut theme_manifest: Option<ThemeManifest> = None;
    let mut files = Vec::new();

    while let Some(file) = zip::read::read_zipfile_from_stream(&mut reader)
        .map_err(|_| HttpError::internal_server_error("failed_reading_zip"))?
    {
        if !file.is_file() {
            continue;
        }

        let outpath = file
            .enclosed_name()
            .ok_or_else(|| HttpError::unprocessable_entity("invalid_file_name"))?;

        if !(outpath.starts_with("assets/")
            || (outpath.starts_with("templates/")
                && outpath
                    .extension()
                    .map(|e| e == AsRef::<OsStr>::as_ref("html"))
                    .unwrap_or(false))
            || outpath
                .parent()
                .map(|p| p == AsRef::<std::path::Path>::as_ref("locales"))
                .unwrap_or(false)
            || outpath == AsRef::<std::path::Path>::as_ref("Yelken.json"))
        {
            log::warn!("Unexpected file found in archive, {outpath:?}");

            continue;
        }

        let outpath = outpath
            .to_str()
            .ok_or_else(|| HttpError::unprocessable_entity("invalid_file_name"))?;

        let bytes = file
            .bytes()
            .collect::<Result<Vec<u8>, std::io::Error>>()
            .inspect_err(|e| log::warn!("Failed to read file bytes {e:?}"))
            .map_err(|_| HttpError::internal_server_error("io_error"))?;

        let dest_file_path = [dir.as_str(), outpath].join("/");

        tmp_storage
            .blocking()
            .write(&dest_file_path, bytes)
            .inspect_err(|e| log::warn!("Failed to write file {e:?}"))
            .map_err(|_| HttpError::internal_server_error("io_error"))?;

        if outpath == "Yelken.json" {
            let dest_file = tmp_storage
                .blocking()
                .read(&dest_file_path)
                .inspect_err(|e| log::warn!("Failed to read Yelken.json, {e:?}"))
                .map_err(|_| HttpError::internal_server_error("io_error"))?;

            theme_manifest = Some(serde_json::from_reader(dest_file).map_err(|e| HttpError {
                code: StatusCode::UNPROCESSABLE_ENTITY,
                error: "invalid_manifest_file",
                context: Some(format!("{e:?}")),
            })?)
        }

        files.push(outpath.to_string());
    }

    let theme_manifest =
        theme_manifest.ok_or(HttpError::unprocessable_entity("no_manifest_file"))?;

    Ok((theme_manifest, files))
}

async fn create_theme(
    conn: &mut PooledConnection,
    manifest: ThemeManifest,
    user_id: i32,
    default_locale: String,
) -> Result<Theme, HttpError> {
    let locales = locales::table.load::<Locale>(conn).await?;

    let theme = diesel::insert_into(themes::table)
        .values((
            themes::id.eq(&manifest.id),
            themes::name.eq(&manifest.name),
            themes::version.eq(&manifest.version),
        ))
        .get_result::<Theme>(conn)
        .await
        .map_err(|e| {
            if let Error::DatabaseError(DatabaseErrorKind::UniqueViolation, _) = &e {
                return HttpError::conflict("theme_already_exists");
            }

            e.into()
        })?;

    diesel::insert_into(namespaces::table)
        .values((
            namespaces::key.eq(&theme.id),
            namespaces::source.eq("theme"),
        ))
        .execute(conn)
        .await?;

    diesel::insert_into(pages::table)
        .values(
            manifest
                .pages
                .into_iter()
                .filter_map(|page| {
                    let locale = page.locale.and_then(|pl| {
                        if pl == "DEFAULT" {
                            Some(default_locale.clone())
                        } else {
                            locales.iter().any(|l| pl == l.key).then_some(pl)
                        }
                    })?;

                    Some((
                        pages::namespace.eq(manifest.id.clone()),
                        pages::key.eq(page.key),
                        pages::name.eq(page.name),
                        pages::desc.eq(page.desc),
                        pages::path.eq(page.path),
                        pages::template.eq(page.template),
                        pages::locale.eq(locale),
                    ))
                })
                .collect::<Vec<_>>(),
        )
        .batched()
        .execute(conn)
        .await?;

    let models = HashMap::<String, base::models::Model>::from_iter(
        diesel::insert_into(models::table)
            .values(
                manifest
                    .models
                    .iter()
                    .map(|model| {
                        (
                            models::namespace.eq(manifest.id.clone()),
                            models::key.eq(model.key.clone()),
                            models::name.eq(model.name.clone()),
                            models::desc.eq(model.desc.clone()),
                        )
                    })
                    .collect::<Vec<_>>(),
            )
            .batched()
            .get_results::<base::models::Model>(conn)
            .await?
            .into_iter()
            .map(|model| (model.key.clone(), model)),
    );

    let fields = HashMap::<String, Field>::from_iter(
        fields::table
            .load::<Field>(conn)
            .await?
            .into_iter()
            .map(|field| (field.key.clone(), field)),
    );

    for model in manifest.models {
        let model_id = models
            .get(&model.key)
            .ok_or(HttpError::internal_server_error("unreachable"))?
            .id;

        let model_fields = model
            .fields
            .iter()
            .map(|model_field| {
                fields
                    .get(&model_field.field)
                    .map(|f| (f.id, model_field))
                    .ok_or_else(|| HttpError {
                        code: StatusCode::UNPROCESSABLE_ENTITY,
                        error: "unknown_field",
                        context: Some(format!("Field {} is not known", model_field.field)),
                    })
            })
            .collect::<Result<Vec<(i32, &ModelField)>, HttpError>>()?;

        let model_fields = HashMap::<String, base::models::ModelField>::from_iter(
            diesel::insert_into(model_fields::table)
                .values(
                    model_fields
                        .iter()
                        .map(|model_field| {
                            (
                                model_fields::model_id.eq(model_id),
                                model_fields::field_id.eq(model_field.0),
                                model_fields::key.eq(model_field.1.key.clone()),
                                model_fields::name.eq(model_field.1.name.clone()),
                                model_fields::desc.eq(model_field.1.desc.clone()),
                                model_fields::localized
                                    .eq(model_field.1.localized.unwrap_or(false)),
                                model_fields::multiple.eq(model_field.1.multiple.unwrap_or(false)),
                                model_fields::required.eq(model_field.1.required.unwrap_or(false)),
                            )
                        })
                        .collect::<Vec<_>>(),
                )
                .batched()
                .get_results::<base::models::ModelField>(conn)
                .await?
                .into_iter()
                .map(|mf| (mf.key.clone(), mf)),
        );

        for content in manifest.contents.iter().filter(|c| c.model == model.key) {
            let values = content
                .values
                .iter()
                .map(|v| {
                    model_fields
                        .get(&v.field)
                        .map(|mf| (mf.id, v))
                        .ok_or_else(|| HttpError {
                            code: StatusCode::UNPROCESSABLE_ENTITY,
                            error: "unknown_field",
                            context: Some(format!(
                                "Field in content value {} is not known",
                                v.field
                            )),
                        })
                })
                .collect::<Result<Vec<(i32, &ContentValue)>, HttpError>>()?;

            let content_id = diesel::insert_into(contents::table)
                .values((
                    contents::model_id.eq(model_id),
                    contents::name.eq(&content.name),
                    contents::stage.eq(ContentStage::Published),
                    contents::created_by.eq(user_id),
                ))
                .get_result::<base::models::Content>(conn)
                .await?
                .id;

            diesel::insert_into(content_values::table)
                .values(
                    values
                        .into_iter()
                        .filter_map(|v| {
                            let locale = v.1.locale.as_ref().and_then(|cl| {
                                if cl == "DEFAULT" {
                                    Some(default_locale.clone())
                                } else {
                                    locales.iter().any(|l| *cl == l.key).then(|| cl.clone())
                                }
                            })?;

                            Some((
                                content_values::content_id.eq(content_id),
                                content_values::model_field_id.eq(v.0),
                                content_values::value.eq(v.1.value.clone()),
                                content_values::locale.eq(locale),
                            ))
                        })
                        .collect::<Vec<_>>(),
                )
                .batched()
                .execute(conn)
                .await?;
        }
    }

    Ok(theme)
}
