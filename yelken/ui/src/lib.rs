mod handlers;
mod l10n;
mod render;

use axum::{middleware, Router};
pub use handlers::serve_page;
pub use l10n::L10n;
pub use render::Render;

use base::AppState;

pub fn router(state: AppState) -> Router<AppState> {
    Router::new().layer(middleware::from_fn_with_state(
        state,
        base::middlewares::auth::from_token,
    ))
}
