use axum::Router;
use base::AppState;

mod handlers;

#[cfg(feature = "oauth")]
pub async fn fetch_cloud_app_owner() -> anyhow::Result<handlers::oauth::UserInfo> {
    use anyhow::Context;

    #[derive(serde::Serialize)]
    struct AppOwnerRequest<'a> {
        client_id: &'a str,
        client_secret: &'a str,
    }

    let cloud_app_owner_endpoint = std::env::var("YELKEN_CLOUD_OAUTH_APP_OWNER_ENDPOINT")
        .context("YELKEN_CLOUD_OAUTH_APP_OWNER_ENDPOINT is not defined")?;

    let auth_config = handlers::oauth::AuthConfig::from_env()?;

    let client = reqwest::ClientBuilder::default().build().unwrap();

    let resp = client
        .post(&cloud_app_owner_endpoint)
        .form(&AppOwnerRequest {
            client_id: &auth_config.cloud.client_id,
            client_secret: &auth_config.cloud.client_secret,
        })
        .send()
        .await
        .context("Failed to connect to cloud for receiving app owner")?
        .error_for_status()
        .context("Fetching app owner failed")?;

    resp.json()
        .await
        .context("Unable to parse response as user info")
}

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
