use axum::{extract::State, response::Html, routing::get, Router};

use crate::AppState;

pub fn router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/editor", get(show_editor))
        .with_state(state)
}

async fn show_editor(State(state): State<AppState>) -> Html<String> {
    let text = match state
        .plugin_host
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
