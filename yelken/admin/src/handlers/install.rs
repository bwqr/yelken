use std::path::{Path, PathBuf};

use axum::{
    extract::{Multipart, State},
    http::StatusCode,
};
use base::{responses::HttpError, schema::themes, AppState};
use bytes::Buf;
use diesel::{
    prelude::*,
    result::{DatabaseErrorKind, Error},
};
use diesel_async::RunQueryDsl;
use serde::Deserialize;

#[derive(Clone, Debug, Deserialize)]
struct ThemeConfig {
    id: String,
    version: String,
    name: String,
}

fn bad_request(error: &'static str) -> HttpError {
    HttpError {
        code: StatusCode::BAD_REQUEST,
        error,
        context: None,
    }
}

pub async fn install_theme(
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> Result<(), HttpError> {
    let tmp_theme_dir: PathBuf = [&state.config.storage_dir, "tmp", "some-random-chars"]
        .iter()
        .collect();

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

    let mut reader = field
        .bytes()
        .await
        .map_err(|_| bad_request("invalid_multipart"))?
        .reader();

    tokio::runtime::Handle::current()
        .spawn_blocking(move || {
            struct Guard(PathBuf);

            impl Drop for Guard {
                fn drop(&mut self) {
                    let _ = std::fs::remove_dir_all(&self.0);
                }
            }

            let _guard = Guard(tmp_theme_dir.clone());

            let mut theme_config: Option<ThemeConfig> = None;

            while let Some(mut file) = zip::read::read_zipfile_from_stream(&mut reader)
                .map_err(|_| HttpError::internal_server_error("failed_reading_zip"))?
            {
                let Some(outpath) = file.enclosed_name() else {
                    return Err(HttpError::unprocessable_entity("invalid_zip_archive"));
                };

                if !file.is_file() {
                    continue;
                }

                if !(outpath.starts_with("templates/")
                    || outpath
                        .parent()
                        .map(|p| p == AsRef::<Path>::as_ref("locales"))
                        .unwrap_or(false)
                    || outpath == AsRef::<Path>::as_ref("Yelken.json"))
                {
                    log::warn!("Unexpected file found in archive, {outpath:?}");

                    continue;
                }

                if let Some(parent) = outpath.parent() {
                    let mut dir = tmp_theme_dir.clone();
                    dir.push(parent);

                    std::fs::create_dir_all(dir)
                        .inspect_err(|e| log::warn!("Failed to create dirs {e:?}"))
                        .map_err(|_| HttpError::internal_server_error("io_error"))?;
                }

                let mut dest_file_path = tmp_theme_dir.clone();
                dest_file_path.push(&outpath);

                {
                    let mut dest_file = std::fs::File::create(&dest_file_path)
                        .inspect_err(|e| log::warn!("Failed to create file {e:?}"))
                        .map_err(|_| HttpError::internal_server_error("io_error"))?;

                    std::io::copy(&mut file, &mut dest_file)
                        .inspect_err(|e| log::warn!("Failed to write file {e:?}"))
                        .map_err(|_| HttpError::internal_server_error("io_error"))?;
                }

                if outpath == AsRef::<Path>::as_ref("Yelken.json") {
                    let dest_file = std::fs::File::open(&dest_file_path)
                        .inspect_err(|e| log::warn!("Failed to read Yelken.json, {e:?}"))
                        .map_err(|_| HttpError::internal_server_error("io_error"))?;

                    theme_config =
                        Some(serde_json::from_reader(&dest_file).map_err(|_| {
                            HttpError::unprocessable_entity("invalid_manifest_file")
                        })?)
                }
            }

            let theme_config =
                theme_config.ok_or(HttpError::unprocessable_entity("no_manifest_file"))?;

            log::info!("ThemeConfig {theme_config:?}");

            let pool = state.pool.clone();
            let config = theme_config.clone();
            tokio::runtime::Handle::current().block_on(async move {
                diesel::insert_into(themes::table)
                    .values((
                        themes::id.eq(config.id),
                        themes::name.eq(config.name),
                        themes::version.eq(config.version),
                    ))
                    .execute(&mut pool.get().await?)
                    .await
                    .map_err(|e| {
                        if let Error::DatabaseError(DatabaseErrorKind::UniqueViolation, _) = &e {
                            return HttpError::conflict("theme_already_exists");
                        }

                        e.into()
                    })?;

                Result::<(), HttpError>::Ok(())
            })?;

            std::fs::rename(
                tmp_theme_dir,
                [&state.config.storage_dir, "themes", &theme_config.id]
                    .iter()
                    .collect::<PathBuf>(),
            )
            .inspect_err(|e| log::warn!("Failed to rename folder, {e:?}"))
            .map_err(|_| HttpError::internal_server_error("io_error"))?;

            Ok(())
        })
        .await
        .map_err(|_| HttpError::internal_server_error("blocking_error"))??;

    Ok(())
}
