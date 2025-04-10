use axum::{
    extract::{Query, State},
    Extension, Json,
};
use base::{config::Options, responses::HttpError, AppState};

use crate::requests::{DeleteTemplate, UpdateTemplate};

pub async fn update_template(
    State(state): State<AppState>,
    Extension(options): Extension<Options>,
    Json(req): Json<UpdateTemplate>,
) -> Result<(), HttpError> {
    let mut path = if req.theme_scoped {
        ["templates", "themes", &options.theme()].join("/")
    } else {
        ["templates", "global"].join("/")
    };

    path.push('/');
    path.push_str(&*req.path.0.to_string_lossy());

    state
        .storage
        .write(&path, req.template)
        .await
        .inspect_err(|e| log::error!("Failed to write template at path {path:?}, {e:?}"))
        .map_err(|_| HttpError::internal_server_error("failed_writing_template"))?;

    Ok(())
}

pub async fn delete_template(
    State(state): State<AppState>,
    Extension(options): Extension<Options>,
    Query(req): Query<DeleteTemplate>,
) -> Result<(), HttpError> {
    let mut path = if req.theme_scoped {
        ["templates", "themes", &options.theme()].join("/")
    } else {
        ["templates", "global"].join("/")
    };

    path.push('/');
    path.push_str(&*req.path.0.to_string_lossy());

    state
        .storage
        .delete(&path)
        .await
        .inspect_err(|e| log::error!("Failed to remove template at path {path:?}, {e:?}"))
        .map_err(|_| HttpError::internal_server_error("failed_deleting_resource"))?;

    Ok(())
}
