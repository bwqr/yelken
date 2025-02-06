use axum::{
    extract::Request,
    http::Method,
    response::{Html, IntoResponse, Response},
    Extension, Router,
};

use base::AppState;
use leptos::{config::LeptosOptions, prelude::RenderHtml};
use plugin::PluginHost;

pub fn router(state: AppState) -> Router<AppState> {
    Router::new()
        .fallback(handle_req)
        .with_state(state)
}

async fn handle_req(req: Request) -> Response {
    if req.method() != Method::GET {
        return "Method not allowed".into_response();
    }

    let options = LeptosOptions::builder().site_pkg_dir("assets/yelken").output_name("yelken").build();

    Html(ui::shell(options).to_html()).into_response()
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
