use std::collections::HashMap;

use axum::{
    extract::{Request, State},
    http::StatusCode,
    response::Html,
    Extension,
};
use base::{
    models::HttpError,
    schema::{content_values, contents, model_fields, models, pages},
    types::Pool,
    AppState,
};
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use matchit::{Match, Router};
use plugin::PluginHost;
use serde::de::DeserializeOwned;
use tera::{from_value, to_value, Tera, Value};

pub async fn default_handler(
    State(state): State<AppState>,
    Extension(plugin_host): Extension<PluginHost>,
    req: Request,
) -> Result<(StatusCode, Html<String>), HttpError> {
    let url = req
        .uri()
        .path_and_query()
        .map(|pq| pq.as_str())
        .unwrap_or("/");

    let pages = pages::table
        .select((pages::id, pages::path, pages::template))
        .load::<(i32, String, String)>(&mut state.pool.get().await?)
        .await?;

    let mut router = Router::new();

    pages.into_iter().for_each(|(id, path, template)| {
        if let Err(e) = router.insert(&path, template) {
            log::warn!("Failed to add path {path} of page {id} due to {e:?}");
        }
    });

    let mut renderer = Tera::new(&format!(
        "{}/themes/default/**/*.html",
        state.config.storage_dir
    ))
    .inspect_err(|e| log::warn!("Failed to parse templates, {e:?}"))
    .map_err(|_| HttpError::internal_server_error("failed_parsing_templates"))?;

    let Ok(Match {
        params,
        value: template,
    }) = router.at(url)
    else {
        let not_found = renderer
            .render("__404__.html", &tera::Context::new())
            .inspect_err(|e| log::warn!("Failed to parse templates, {e:?}"))
            .map_err(|_| HttpError::internal_server_error("failed_parsing_templates"))?;

        return Ok((StatusCode::NOT_FOUND, Html(not_found)));
    };

    let params: HashMap<String, String> =
        HashMap::from_iter(params.iter().map(|(k, v)| (k.to_string(), v.to_string())));
    let template = template.clone();

    build_renderer(&mut renderer, params, state.pool.clone(), plugin_host)
        .inspect_err(|e| log::warn!("Failed to build renderer, {e:?}"))
        .map_err(|_| HttpError::internal_server_error("failed_building_renderer"))?;

    let context = tera::Context::new();

    let res = tokio::runtime::Handle::current()
        .spawn_blocking(move || renderer.render(&template, &context))
        .await
        .unwrap();

    match res {
        Ok(html) => Ok((StatusCode::OK, Html(html))),
        Err(e) => Ok((
            StatusCode::INTERNAL_SERVER_ERROR,
            Html(format!("Failed to render page, {e:?}")),
        )),
    }
}

fn get_value<T: DeserializeOwned>(args: &HashMap<String, Value>, k: &str) -> Option<T> {
    args.get(k).cloned().and_then(|v| from_value::<T>(v).ok())
}

fn build_renderer(
    renderer: &mut Tera,
    params: HashMap<String, String>,
    pool: Pool,
    plugin_host: PluginHost,
) -> Result<(), &'static str> {
    renderer.register_function(
        "url_param",
        move |args: &HashMap<String, Value>| -> tera::Result<Value> {
            match args.get("param") {
                Some(val) => match from_value::<String>(val.clone()) {
                    Ok(v) => Ok(to_value(params.get(&v)).unwrap()),
                    Err(_) => Err("oops".into()),
                },
                None => Err("oops".into()),
            }
        },
    );

    {
        let pool = pool.clone();

        renderer.register_function(
            "get_content",
            move |args: &HashMap<String, Value>| -> tera::Result<Value> {
                let get_string = |k: &str| get_value::<String>(args, k);

                let (model, field, value) = match (
                    get_string("model"),
                    get_string("field"),
                    get_string("value"),
                ) {
                    (Some(model), Some(field), Some(value)) => (model, field, value),
                    _ => return Err("invalid args".into()),
                };

                let pool = pool.clone();

                let values: Result<HashMap<String, Option<String>>, HttpError> =
                    tokio::runtime::Handle::current().block_on(async move {
                        let mut conn = pool.get().await?;

                        let model_field = model_fields::table
                            .select(model_fields::id)
                            .inner_join(models::table)
                            .filter(
                                model_fields::model_id
                                    .eq(models::id)
                                    .and(model_fields::name.eq(field))
                                    .and(models::name.eq(model)),
                            )
                            .first::<i32>(&mut conn)
                            .await?;

                        let content = contents::table
                            .select(contents::id)
                            .inner_join(content_values::table)
                            .filter(
                                content_values::model_field_id
                                    .eq(model_field)
                                    .and(content_values::value.eq(value)),
                            )
                            .first::<i32>(&mut conn)
                            .await?;

                        let values = content_values::table
                            .inner_join(model_fields::table)
                            .filter(content_values::content_id.eq(content))
                            .select((model_fields::name, content_values::value))
                            .load::<(String, Option<String>)>(&mut conn)
                            .await?;

                        Ok(HashMap::from_iter(values.into_iter()))
                    });

                values
                    .map(|v| to_value(v).unwrap())
                    .map_err(|e| format!("failed to get content, {e:?}").into())
            },
        );
    }

    {
        let pool = pool.clone();

        renderer.register_function(
            "get_contents",
            move |args: &HashMap<String, Value>| -> tera::Result<Value> {
                let (model, fields) = match (
                    get_value::<String>(args, "model"),
                    get_value::<Vec<String>>(args, "fields"),
                ) {
                    (Some(model), Some(fields)) => (model, fields),
                    _ => return Err("invalid args".into()),
                };

                let pool = pool.clone();

                let values: Result<Vec<HashMap<String, Option<String>>>, HttpError> =
                    tokio::runtime::Handle::current().block_on(async move {
                        let mut conn = pool.get().await?;

                        let values = contents::table
                            .inner_join(models::table)
                            .inner_join(content_values::table.inner_join(model_fields::table))
                            .filter(models::name.eq(&model))
                            .filter(model_fields::name.eq_any(&fields))
                            .select((contents::id, model_fields::name, content_values::value))
                            .limit(10)
                            .load::<(i32, String, Option<String>)>(&mut conn)
                            .await?;

                        let mut contents: Vec<HashMap<String, Option<String>>> = vec![];
                        let mut indices: Vec<i32> = vec![];

                        for (id, name, value) in values {
                            if let Some(i) = indices
                                .iter()
                                .enumerate()
                                .find(|(_, val)| **val == id)
                                .map(|(i, _)| i)
                            {
                                contents[i].insert(name, value);
                            } else {
                                indices.push(id);
                                contents.push(HashMap::from([(name, value)]));
                            }
                        }

                        Ok(contents)
                    });

                values
                    .map(|v| to_value(v).unwrap())
                    .map_err(|e| format!("failed to get content, {e:?}").into())
            },
        );
    }

    {
        renderer.register_function(
            "call_plugin",
            move |args: &HashMap<String, Value>| -> tera::Result<Value> {
                let (plugin, fn_id, opts) = match (
                    get_value::<String>(args, "plugin"),
                    get_value::<String>(args, "fn_id"),
                    get_value::<Vec<String>>(args, "opts"),
                ) {
                    (Some(plugin), Some(fn_id), Some(opts)) => (plugin, fn_id, opts),
                    _ => return Err("invalid args".into()),
                };

                let plugin_host = plugin_host.clone();

                let values: Result<String, HttpError> =
                    tokio::runtime::Handle::current().block_on(async move {
                        plugin_host
                            .run_render_handler(&plugin, &fn_id, &opts)
                            .await
                            .inspect_err(|e| log::warn!("failed to run render handler, {e:?}"))
                            .map_err(|_| {
                                HttpError::internal_server_error("failed_running_render_plugin")
                            })
                    });

                values
                    .map(|v| to_value(v).unwrap())
                    .map_err(|e| format!("failed to get content, {e:?}").into())
            },
        );
    }

    Ok(())
}
