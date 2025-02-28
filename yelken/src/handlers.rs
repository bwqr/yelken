use axum::{
    extract::{Request, State},
    response::{Html, IntoResponse},
    Extension,
};
use base::{models::HttpError, schema::pages, AppState};
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use plugin::PluginHost;

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
) -> Result<Page, HttpError> {
    let mut conn = state.pool.get().await?;

    let url = req
        .uri()
        .path_and_query()
        .map(|pq| pq.as_str())
        .unwrap_or("/");

    let pages = pages::table
        .select((pages::id, pages::paths))
        .load::<(i32, String)>(&mut conn)
        .await?;

    let Some(page_id) = pages
        .into_iter()
        .find(|(_, paths)| paths.find(url).is_some())
        .map(|(id, _)| id)
    else {
        return Err(HttpError::not_found("page_not_found"));
    };

    let content = pages::table
        .select(pages::content)
        .filter(pages::id.eq(page_id))
        .first::<String>(&mut conn)
        .await?;

    if let Err(e) = plugin_host.run_pre_load_handlers(&url).await {
        log::warn!("Failed to run some preload handlers, {e:?}");
    };

    let (head, body, scripts) = match plugin_host
        .run_loading_handlers(&url, ("".to_string(), content.clone(), "".to_string()))
        .await
    {
        Ok(page) => page,
        Err(e) => {
            log::warn!("Failed to run some loading handlers, {e:?}");
            ("".to_string(), content, "".to_string())
        }
    };

    Ok(Page {
        head,
        body,
        scripts,
    })
}
