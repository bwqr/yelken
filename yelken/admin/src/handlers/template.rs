use axum::{
    extract::{Query, State},
    Extension, Json,
};
use base::{config::Options, responses::HttpError, runtime::IntoSendFuture, AppState};
use ui::Render;

use crate::requests::{DeleteTemplate, UpdateTemplate};

pub async fn update_template(
    State(state): State<AppState>,
    Extension(options): Extension<Options>,
    Extension(render): Extension<Render>,
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
        .into_send_future()
        .await
        .inspect_err(|e| log::error!("Failed to write template at path {path}, {e:?}"))
        .map_err(|_| HttpError::internal_server_error("failed_writing_template"))?;

    // TODO handle invalid template case before writing the received template
    render
        .reload(&state.storage, &options.template_locations())
        .await
        .inspect_err(|e| log::warn!("Failed to reload render, {e:?}"))
        .map_err(|_| HttpError::unprocessable_entity("invalid_template"))?;

    Ok(())
}

pub async fn delete_template(
    State(state): State<AppState>,
    Extension(options): Extension<Options>,
    Extension(render): Extension<Render>,
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
        .into_send_future()
        .await
        .inspect_err(|e| log::error!("Failed to remove template at path {path}, {e:?}"))
        .map_err(|_| HttpError::internal_server_error("failed_deleting_resource"))?;

    render
        .reload(&state.storage, &options.template_locations())
        .await
        .inspect_err(|e| log::warn!("Failed to reload render, {e:?}"))
        .map_err(|_| HttpError::unprocessable_entity("invalid_template"))?;

    Ok(())
}
