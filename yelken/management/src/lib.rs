use std::sync::Arc;

use axum::{
    extract::Request,
    http::Method,
    response::{Html, IntoResponse, Response},
    Extension, Router,
};

use base::AppState;
use leptos::prelude::RenderHtml;
use plugin::PluginHost;

struct IndexHtml {
    head: String,
    body: String,
    tail: String,
}

pub fn router(state: AppState) -> Router<AppState> {
    let index_html = std::fs::read_to_string(format!(
        "{}/assets/yelken/index.html",
        state.config.storage_dir
    ))
    .unwrap();

    let (head, body) = index_html.split_once("<!--YELKEN_META-->").unwrap();
    let (body, tail) = body.split_once("<!--YELKEN_SCRIPTS-->").unwrap();

    let index_html = IndexHtml {
        head: head.trim().to_string(),
        body: body.trim().to_string(),
        tail: tail.trim().to_string(),
    };

    Router::new()
        .fallback(handle_req)
        .with_state(state)
        .layer(Extension(Arc::new(index_html)))
}

async fn handle_req(Extension(index_html): Extension<Arc<IndexHtml>>, req: Request) -> Response {
    if req.method() != Method::GET {
        return "Method not allowed".into_response();
    }

    let body = ui::SimpleCounter(ui::SimpleCounterProps { initial_value: 32 }).to_html();

    Html(format!(
        "{}{}{}{}",
        index_html.head, index_html.body, body, index_html.tail
    ))
    .into_response()
}

async fn show_editor(plugin_host: Extension<PluginHost>) -> Html<String> {
    let text = match plugin_host
        .process_page_load("/admin/editor".to_string(), "".to_string())
        .await
    {
        Ok(resp) => format!(
            "<!DOCTYPE html><html><head>{}</head><body>{}{}</body></html>",
            resp.head.join(""),
            resp.body,
            resp.scripts.join("")
        ),
        Err(e) => format!("Failed to process page load, {e:?}"),
    };

    Html(text)
}
