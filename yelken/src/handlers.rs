use std::collections::HashMap;

use axum::{
    extract::{Request, State},
    response::{Html, IntoResponse},
    Extension,
};
use base::{models::HttpError, schema::pages, AppState};
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use matchit::Router;
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
        .select((pages::id, pages::paths, pages::template))
        .load::<(i32, String, String)>(&mut conn)
        .await?;

    let mut router = Router::new();

    pages.into_iter().for_each(|(id, paths, template)| {
        paths.split(";").for_each(|path| {
            if let Err(e) = router.insert(path, template.clone()) {
                log::warn!("Failed to add path {path} of page {id} due to {e:?}");
            }
        })
    });

    let Ok(template) = router.at(url) else {
        return Err(HttpError::not_found("page_not_found"));
    };

    let mut renderer = Tera::new(&format!(
        "{}/themes/default/**/*.html",
        state.config.storage_dir
    ))
    .unwrap();

    renderer.register_function(
        "url_for",
        |args: &HashMap<String, Value>| -> tera::Result<Value> {
            match args.get("name") {
                Some(val) => match from_value::<String>(val.clone()) {
                    Ok(v) => Ok(to_value(format!("/yk-app/{v}")).unwrap()),
                    Err(_) => Err("oops".into()),
                },
                None => Err("oops".into()),
            }
        },
    );

    let context = tera::Context::new();

    Ok(Html(
        renderer
            .render(template.value, &context)
            .unwrap_or_else(|e| format!("Failed to render page, {e:?}")),
    ))
}
