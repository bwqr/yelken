use axum::Router;
use base::AppState;

mod handlers;

pub fn router() -> Router<AppState> {
    let router = Router::new();

    #[cfg(feature = "email")]
    let router = {
        use axum::routing::post;
        use handlers::email;

        router.route("/login", post(email::login))
    };

    #[cfg(feature = "oauth")]
    let router = {
        use axum::{routing::get, Extension};
        use handlers::oauth;

        let auth_config = oauth::AuthConfig::from_env().unwrap();

        router
            .route("/oauth/redirect", get(oauth::redirect_oauth_provider))
            .route("/oauth/cloud", get(oauth::cloud_oauth))
            .layer(Extension(auth_config))
    };

    router
}
