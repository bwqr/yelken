use axum::{response::Html, routing::get, Extension, Router};

use base::AppState;
use plugin::PluginHost;

pub fn router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/editor", get(show_editor))
        .with_state(state)
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
