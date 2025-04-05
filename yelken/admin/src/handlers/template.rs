use std::{io::ErrorKind, path::PathBuf};

use axum::{
    extract::{Query, State},
    Json,
};
use base::{responses::HttpError, AppState};

use crate::requests::{DeleteTemplate, UpdateTemplate};

pub async fn update_template(
    State(state): State<AppState>,
    Json(req): Json<UpdateTemplate>,
) -> Result<(), HttpError> {
    let mut path = if req.theme_scoped {
        [
            &state.config.storage_dir,
            "templates",
            "themes",
            &state.config.theme,
        ]
        .iter()
        .collect::<PathBuf>()
    } else {
        [&state.config.storage_dir, "templates", "global"]
            .iter()
            .collect::<PathBuf>()
    }
    .canonicalize()
    .inspect_err(|e| log::error!("Failed to canonicalize path {e:?}"))
    .map_err(|_| HttpError::internal_server_error("dir_not_found"))?;

    path.push(req.path.0);

    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(&parent)
            .await
            .inspect_err(|e| log::error!("Failed to create parent directory {parent:?}, {e:?}"))
            .map_err(|_| HttpError::internal_server_error("failed_creating_dir"))?;
    }

    tokio::fs::write(&path, req.template)
        .await
        .inspect_err(|e| log::error!("Failed to write template at path {path:?}, {e:?}"))
        .map_err(|_| HttpError::internal_server_error("failed_writing_template"))?;

    Ok(())
}

pub async fn delete_template(
    State(state): State<AppState>,
    Query(req): Query<DeleteTemplate>,
) -> Result<(), HttpError> {
    let mut path = if req.theme_scoped {
        [
            &state.config.storage_dir,
            "templates",
            "themes",
            &state.config.theme,
        ]
        .iter()
        .collect::<PathBuf>()
    } else {
        [&state.config.storage_dir, "templates", "global"]
            .iter()
            .collect::<PathBuf>()
    }
    .canonicalize()
    .inspect_err(|e| log::error!("Failed to canonicalize path {e:?}"))
    .map_err(|_| HttpError::internal_server_error("dir_not_found"))?;

    path.push(req.path.0);

    if let Err(e) = tokio::fs::remove_file(&path).await {
        if e.kind() == ErrorKind::NotFound {
            return Err(HttpError::not_found("template_not_found"));
        }

        log::error!("Failed to remove template at path {path:?}, {e:?}");

        return Err(HttpError::internal_server_error("failed_deleting_resource"));
    }

    Ok(())
}
