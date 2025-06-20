use axum::{
    extract::{Query, State},
    Extension, Json,
};
use base::{
    config::Options, responses::HttpError, runtime::IntoSendFuture, utils::ResourceKind, AppState,
};
use opendal::ErrorKind;
use ui::Render;

use crate::{
    requests::{DeleteTemplate, FilterTemplate, UpdateTemplate},
    responses::{Template, TemplateDetail},
};

pub async fn fetch_templates(
    State(state): State<AppState>,
    Extension(options): Extension<Options>,
) -> Result<Json<Vec<Template>>, HttpError> {
    let mut templates = vec![];

    for location in options.template_locations() {
        let Ok(entries) = state
            .storage
            .list_with(&location)
            .recursive(true)
            .into_send_future()
            .await
            .inspect_err(|e| log::debug!("Failed to read directory {location:?} {e:?}"))
        else {
            continue;
        };

        let prefix = format!("{}/", location);

        templates.extend(entries.into_iter().filter_map(|entry| {
            if !entry.path().ends_with(".html") {
                return None;
            }

            entry.path().strip_prefix(&prefix).map(|p| Template {
                path: p.to_string(),
            })
        }));
    }

    Ok(Json(templates))
}

pub async fn fetch_template(
    State(state): State<AppState>,
    Query(req): Query<FilterTemplate>,
) -> Result<Json<TemplateDetail>, HttpError> {
    let location = base::utils::location(req.kind, ResourceKind::Template);

    let buf = match state
        .storage
        .read(&format!("{}/{}", location, req.path.0))
        .into_send_future()
        .await
    {
        Ok(buf) => buf,
        Err(e) if e.kind() == ErrorKind::NotFound => {
            return Err(HttpError::not_found("template_not_found"))
        }
        Err(e) => {
            log::warn!("Failed to read template {e:?}");

            return Err(HttpError::internal_server_error("failed_to_read_template"));
        }
    };

    let Ok(template) = String::from_utf8(buf.to_bytes().to_vec())
        .inspect_err(|e| log::warn!("Failed to read template as string {e:?}"))
    else {
        return Err(HttpError::internal_server_error("invalid_template_file"));
    };

    Ok(Json(TemplateDetail {
        path: req.path.0,
        template,
    }))
}

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
    path.push_str(&req.path.0);

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
    path.push_str(&req.path.0);

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
