use std::{collections::HashMap, ffi::OsStr, io::Read, path::PathBuf};

use axum::{
    extract::{Multipart, Path, State},
    http::StatusCode,
    Extension,
};
use base::{
    config::Options,
    models::Field,
    responses::HttpError,
    schema::{content_values, contents, fields, model_fields, models, pages, themes},
    types::Connection,
    AppState,
};
use bytes::Buf;
use diesel::{
    prelude::*,
    result::{DatabaseErrorKind, Error},
};
use diesel_async::{scoped_futures::ScopedFutureExt, AsyncConnection, RunQueryDsl};
use opendal::{Entry, EntryMode, Operator};
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
    name: String,
    field: String,
    localized: Option<bool>,
    multiple: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct Model {
    name: String,
    fields: Vec<ModelField>,
}

#[derive(Debug, Deserialize)]
struct Page {
    name: String,
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

fn bad_request(error: &'static str) -> HttpError {
    HttpError {
        code: StatusCode::BAD_REQUEST,
        error,
        context: None,
    }
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

    let locations = [
        format!("themes/{theme}/"),
        format!("locales/themes/{theme}/"),
        format!("templates/themes/{theme}/"),
    ];

    for location in locations {
        let entries = state
            .storage
            .list_with(&location)
            .recursive(true)
            .await
            .inspect_err(|e| log::warn!("Failed to list theme files for path {location}, {e:?}"))
            .map_err(|_| HttpError::internal_server_error("io_error"))?;

        state
            .storage
            .delete_iter(entries)
            .await
            .inspect_err(|e| log::warn!("Failed to delete theme files for path {location}, {e:?}"))
            .map_err(|_| HttpError::internal_server_error("io_error"))?;
    }

    diesel::delete(themes::table)
        .filter(themes::id.eq(theme))
        .execute(&mut state.pool.get().await?)
        .await?;

    Ok(())
}

pub async fn install_theme(
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> Result<(), HttpError> {
    let field = multipart
        .next_field()
        .await
        .map_err(|_| bad_request("invalid_multipart"))?
        .ok_or(bad_request("missing_field_in_multipart"))?;

    let name = field
        .name()
        .ok_or(bad_request("missing_field_in_multipart"))?;

    if name != "theme" {
        return Err(bad_request("missing_field_in_multipart"));
    }

    let reader = field
        .bytes()
        .await
        .map_err(|_| bad_request("invalid_multipart"))?
        .reader();

    let tmp_theme_dir: PathBuf = {
        let random: String = (0..32)
            .map(|_| rng().sample(Alphanumeric) as char)
            .collect();

        [&state.config.tmp_dir, &random].iter().collect()
    };

    let result = install(
        state.storage.clone(),
        &mut state.pool.get().await?,
        reader,
        tmp_theme_dir.clone(),
    )
    .await;

    if let Err(e) = tokio::fs::remove_dir_all(&tmp_theme_dir).await {
        log::warn!(
            "Failed to remove tmp theme dir during installation cleanup, {tmp_theme_dir:?}, {e:?}"
        );
    }

    result
}

async fn install<'a>(
    storage: Operator,
    conn: &mut Connection<'a>,
    reader: impl Read + Send + 'static,
    dir: PathBuf,
) -> Result<(), HttpError> {
    let extract_dir = dir.clone();
    let (manifest, files) = tokio::runtime::Handle::current()
        .spawn_blocking(move || extract_archive(reader, extract_dir))
        .await
        .map_err(|_| HttpError::internal_server_error("blocking_error"))??;

    let theme_id = manifest.id.clone();

    conn.transaction(|conn| async move { create_theme(conn, manifest).await }.scope_boxed())
        .await?;

    for file in files {
        let mut src_path = dir.clone();
        src_path.push(&file);

        let dest_path = ["themes", &theme_id, &file].join("/");

        log::debug!("Paths are {src_path:?} and {dest_path}");

        let file = tokio::fs::read(&src_path)
            .await
            .inspect_err(|e| {
                log::warn!("Failed to read file to copy to persistent storage, {src_path:?}, {e:?}")
            })
            .map_err(|_| HttpError::internal_server_error("io_error"))?;

        storage
            .write(&dest_path, file)
            .await
            .inspect_err(|e| {
                log::warn!("Failed to write file to persistent storage, {dest_path}, {e:?}")
            })
            .map_err(|_| HttpError::internal_server_error("io_error"))?;
    }

    Ok(())
}

fn extract_archive(
    mut reader: impl Read,
    dir: PathBuf,
) -> Result<(ThemeManifest, Vec<String>), HttpError> {
    let mut theme_manifest: Option<ThemeManifest> = None;
    let mut files = Vec::new();

    while let Some(mut file) = zip::read::read_zipfile_from_stream(&mut reader)
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

        if let Some(parent) = outpath.parent() {
            let mut dir = dir.clone();
            dir.push(parent);

            std::fs::create_dir_all(dir)
                .inspect_err(|e| log::warn!("Failed to create dirs {e:?}"))
                .map_err(|_| HttpError::internal_server_error("io_error"))?;
        }

        let outpath = outpath
            .to_str()
            .ok_or_else(|| HttpError::unprocessable_entity("invalid_file_name"))?;

        let mut dest_file_path = dir.clone();
        dest_file_path.push(outpath);

        {
            let mut dest_file = std::fs::File::create(&dest_file_path)
                .inspect_err(|e| log::warn!("Failed to create file {e:?}"))
                .map_err(|_| HttpError::internal_server_error("io_error"))?;

            std::io::copy(&mut file, &mut dest_file)
                .inspect_err(|e| log::warn!("Failed to write file {e:?}"))
                .map_err(|_| HttpError::internal_server_error("io_error"))?;
        }

        if outpath == "Yelken.json" {
            let dest_file = std::fs::File::open(&dest_file_path)
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

async fn create_theme<'a>(
    conn: &mut Connection<'a>,
    manifest: ThemeManifest,
) -> Result<(), HttpError> {
    diesel::insert_into(themes::table)
        .values((
            themes::id.eq(&manifest.id),
            themes::name.eq(&manifest.name),
            themes::version.eq(&manifest.version),
        ))
        .execute(conn)
        .await
        .map_err(|e| {
            if let Error::DatabaseError(DatabaseErrorKind::UniqueViolation, _) = &e {
                return HttpError::conflict("theme_already_exists");
            }

            e.into()
        })?;

    diesel::insert_into(pages::table)
        .values(
            manifest
                .pages
                .into_iter()
                .map(|page| {
                    (
                        pages::namespace.eq(&manifest.id),
                        pages::name.eq(page.name),
                        pages::path.eq(page.path),
                        pages::template.eq(page.template),
                        pages::locale.eq(page.locale),
                    )
                })
                .collect::<Vec<_>>(),
        )
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
                            models::namespace.eq(&manifest.id),
                            models::name.eq(&model.name),
                        )
                    })
                    .collect::<Vec<_>>(),
            )
            .get_results::<base::models::Model>(conn)
            .await?
            .into_iter()
            .map(|model| (model.name.clone(), model)),
    );

    let fields = HashMap::<String, Field>::from_iter(
        fields::table
            .load::<Field>(conn)
            .await?
            .into_iter()
            .map(|field| (field.name.clone(), field)),
    );

    for model in manifest.models {
        let model_id = models
            .get(&model.name)
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
                                model_fields::localized
                                    .eq(model_field.1.localized.unwrap_or(false)),
                                model_fields::multiple.eq(model_field.1.multiple.unwrap_or(false)),
                                model_fields::name.eq(&model_field.1.name),
                            )
                        })
                        .collect::<Vec<_>>(),
                )
                .get_results::<base::models::ModelField>(conn)
                .await?
                .into_iter()
                .map(|mf| (mf.name.clone(), mf)),
        );

        for content in manifest.contents.iter().filter(|c| c.model == model.name) {
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
                ))
                .get_result::<base::models::Content>(conn)
                .await?
                .id;

            diesel::insert_into(content_values::table)
                .values(
                    values
                        .into_iter()
                        .map(|v| {
                            (
                                content_values::content_id.eq(content_id),
                                content_values::model_field_id.eq(v.0),
                                content_values::value.eq(&v.1.value),
                                content_values::locale.eq(&v.1.locale),
                            )
                        })
                        .collect::<Vec<_>>(),
                )
                .execute(conn)
                .await?;
        }
    }

    Ok(())
}
