use std::collections::HashMap;

use axum::{
    extract::{Request, State},
    response::{Html, IntoResponse},
    Extension,
};
use base::{
    models::HttpError,
    schema::{content_values, contents, model_fields, models, pages},
    AppState,
};
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use matchit::{Match, Router};
use plugin::PluginHost;
use tera::{from_value, to_value, Tera, Value};

pub struct Page {
    head: String,
    body: String,
    scripts: String,
}

impl IntoResponse for Page {
    fn into_response(self) -> axum::response::Response {
        Html(format!(
            "<!DOCTYPE html><html><head>{}</head><body>{}{}</body></html>",
            self.head, self.body, self.scripts
        ))
        .into_response()
    }
}

pub async fn default_handler(
    State(state): State<AppState>,
    Extension(plugin_host): Extension<PluginHost>,
    req: Request,
) -> Result<Html<String>, HttpError> {
    let mut conn = state.pool.get().await?;

    let url = req
        .uri()
        .path_and_query()
        .map(|pq| pq.as_str())
        .unwrap_or("/");

    let pages = pages::table
        .select((pages::id, pages::path, pages::template))
        .load::<(i32, String, String)>(&mut conn)
        .await?;

    let mut router = Router::new();

    pages.into_iter().for_each(|(id, path, template)| {
        if let Err(e) = router.insert(&path, template) {
            log::warn!("Failed to add path {path} of page {id} due to {e:?}");
        }
    });

    let Ok(Match {
        params,
        value: template,
    }) = router.at(url)
    else {
        return Err(HttpError::not_found("page_not_found"));
    };

    let params: HashMap<String, String> =
        HashMap::from_iter(params.iter().map(|(k, v)| (k.to_string(), v.to_string())));
    let template = template.clone();

    let mut renderer = Tera::new(&format!(
        "{}/themes/default/**/*.html",
        state.config.storage_dir
    ))
    .inspect_err(|e| log::warn!("Failed to parse templates, {e:?}"))
    .map_err(|_| HttpError::internal_server_error("failed_parsing_template"))?;

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
        let pool = state.pool.clone();

        renderer.register_function(
            "get_content",
            move |args: &HashMap<String, Value>| -> tera::Result<Value> {
                let get_string = |k: &str| {
                    args.get(k)
                        .cloned()
                        .and_then(|v| from_value::<String>(v).ok())
                };

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

    let context = tera::Context::new();

    let res = tokio::runtime::Handle::current()
        .spawn_blocking(move || renderer.render(&template, &context))
        .await
        .unwrap();

    Ok(Html(res.unwrap_or_else(|e| {
        format!("Failed to render page, {e:?}")
    })))
}
