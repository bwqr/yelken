use axum::{middleware, routing::get, Router};
use base::AppState;

mod bindings;
mod handlers;
mod host;

pub use handlers::fetch_plugins;
pub use host::PluginHost;

pub fn router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/plugins", get(handlers::fetch_plugins))
        .layer(middleware::from_fn_with_state(
            state,
            base::middlewares::auth,
        ))
}
