use axum::{
    extract::{Query, State},
    Extension, Json,
};
use base::{
    config::Options,
    responses::HttpError,
    runtime::IntoSendFuture,
    schema::themes,
    utils::{LocationKind, ResourceKind},
    AppState,
};
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use opendal::ErrorKind;
use ui::Render;

use crate::{
    requests::{FilterNamespace, FilterPath, UpdateTemplate},
    responses::{Template, TemplateDetail},
};

pub async fn fetch_templates(
    State(state): State<AppState>,
    Query(query): Query<FilterNamespace>,
) -> Result<Json<Vec<Template>>, HttpError> {
    let mut templates = vec![];

    let locations: &[LocationKind] = if let Some(namespace) = query.namespace {
        let exists = diesel::dsl::select(diesel::dsl::exists(
            themes::table.filter(themes::id.eq(namespace.inner())),
        ))
        .get_result::<bool>(&mut state.pool.get().await?)
        .await?;

        if !exists {
            return Err(HttpError::conflict("namespace_not_found"));
        }

        &[
            LocationKind::Global,
            LocationKind::Theme {
                namespace: namespace.clone(),
            },
            LocationKind::User { namespace },
        ]
    } else {
        &[LocationKind::Global]
    };

    for location in locations {
        let dir = base::utils::location(&location, ResourceKind::Template);
        let Ok(entries) = state
            .storage
            .list_with(&dir)
            .recursive(true)
            .into_send_future()
            .await
            .inspect_err(|e| log::debug!("Failed to read directory {dir:?} {e:?}"))
        else {
            continue;
        };

        let prefix = format!("{}/", dir);

        templates.extend(entries.into_iter().filter_map(|entry| {
            if !entry.path().ends_with(".html") {
                return None;
            }

            entry.path().strip_prefix(&prefix).map(|p| Template {
                path: p.to_string(),
                location: location.clone(),
            })
        }));
    }

    Ok(Json(templates))
}

pub async fn fetch_template(
    State(state): State<AppState>,
    Query(location): Query<LocationKind>,
    Query(query): Query<FilterPath>,
) -> Result<Json<TemplateDetail>, HttpError> {
    match &location {
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

    let location = base::utils::location(&location, ResourceKind::Template);
    let path = format!("{location}/{}", query.path.inner());

    let buf = match state.storage.read(&path).into_send_future().await {
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
        path: query.path.into_inner(),
        template,
    }))
}

pub async fn create_template(
    State(state): State<AppState>,
    Extension(options): Extension<Options>,
    Extension(render): Extension<Render>,
    Json(req): Json<UpdateTemplate>,
) -> Result<(), HttpError> {
    let (reload, location) = if let Some(namespace) = req.namespace {
        let exists = diesel::dsl::select(diesel::dsl::exists(
            themes::table.filter(themes::id.eq(namespace.inner())),
        ))
        .get_result::<bool>(&mut state.pool.get().await?)
        .await?;

        if !exists {
            return Err(HttpError::conflict("namespace_not_found"));
        }

        (
            namespace.inner() == &*options.theme(),
            LocationKind::User { namespace },
        )
    } else {
        (true, LocationKind::Global)
    };

    let location = base::utils::location(&location, ResourceKind::Template);
    let path = format!("{location}/{}", req.path.inner());

    async {
        state
            .storage
            .writer_with(&path)
            .if_not_exists(true)
            .await?
            .write(req.template)
            .await
    }
    .into_send_future()
    .await
    .map_err(|e| {
        if e.kind() == ErrorKind::ConditionNotMatch {
            return HttpError::not_found("template_already_exists");
        }

        HttpError::internal_server_error("failed_writing_template")
    })?;

    // TODO handle invalid template case before writing the received template

    if reload {
        render
            .reload(&state.storage, &options.template_locations())
            .await
            .inspect_err(|e| log::warn!("Failed to reload render, {e:?}"))
            .map_err(|_| HttpError::unprocessable_entity("invalid_template"))?;
    }

    Ok(())
}

pub async fn update_template(
    State(state): State<AppState>,
    Extension(options): Extension<Options>,
    Extension(render): Extension<Render>,
    Json(req): Json<UpdateTemplate>,
) -> Result<(), HttpError> {
    let (reload, location) = if let Some(namespace) = req.namespace {
        let exists = diesel::dsl::select(diesel::dsl::exists(
            themes::table.filter(themes::id.eq(namespace.inner())),
        ))
        .get_result::<bool>(&mut state.pool.get().await?)
        .await?;

        if !exists {
            return Err(HttpError::conflict("namespace_not_found"));
        }

        (
            namespace.inner() == &*options.theme(),
            LocationKind::User { namespace },
        )
    } else {
        (true, LocationKind::Global)
    };

    let location = base::utils::location(&location, ResourceKind::Template);
    let path = format!("{location}/{}", req.path.inner());

    state
        .storage
        .write(&path, req.template)
        .into_send_future()
        .await
        .inspect_err(|e| log::error!("Failed to write template at path {path}, {e:?}"))
        .map_err(|_| HttpError::internal_server_error("failed_writing_template"))?;

    // TODO handle invalid template case before writing the received template

    if reload {
        render
            .reload(&state.storage, &options.template_locations())
            .await
            .inspect_err(|e| log::warn!("Failed to reload render, {e:?}"))
            .map_err(|_| HttpError::unprocessable_entity("invalid_template"))?;
    }

    Ok(())
}

pub async fn delete_template(
    State(state): State<AppState>,
    Extension(options): Extension<Options>,
    Extension(render): Extension<Render>,
    Query(namespace): Query<FilterNamespace>,
    Query(query): Query<FilterPath>,
) -> Result<(), HttpError> {
    let (reload, location) = if let Some(namespace) = namespace.namespace {
        let exists = diesel::dsl::select(diesel::dsl::exists(
            themes::table.filter(themes::id.eq(namespace.inner())),
        ))
        .get_result::<bool>(&mut state.pool.get().await?)
        .await?;

        if !exists {
            return Err(HttpError::conflict("namespace_not_found"));
        }

        (
            namespace.inner() == &*options.theme(),
            LocationKind::User { namespace },
        )
    } else {
        (true, LocationKind::Global)
    };

    let location = base::utils::location(&location, ResourceKind::Template);
    let path = format!("{location}/{}", query.path.inner());

    state
        .storage
        .delete(&path)
        .into_send_future()
        .await
        .inspect_err(|e| log::error!("Failed to remove template at path {path}, {e:?}"))
        .map_err(|_| HttpError::internal_server_error("failed_deleting_resource"))?;

    if reload {
        render
            .reload(&state.storage, &options.template_locations())
            .await
            .inspect_err(|e| log::warn!("Failed to reload render, {e:?}"))
            .map_err(|_| HttpError::unprocessable_entity("invalid_template"))?;
    }

    Ok(())
}
