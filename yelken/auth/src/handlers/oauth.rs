use std::{ops::Deref, sync::Arc};

use super::generate_username;
use axum::{
    extract::{Query, State},
    http::{header, HeaderName, StatusCode},
    Extension,
};
use base::{
    crypto::Crypto,
    models::{LoginKind, User},
    responses::HttpError,
    schema::users,
    AppState,
};
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use rand::{distr::Alphanumeric, rng, Rng};
use serde::Deserialize;
use url::Url;

pub(crate) struct OauthProviderConfig {
    pub redirect_endpoint: String,
    pub token_endpoint: String,
    pub client_id: String,
    pub client_secret: String,
}

pub struct AuthConfigInner {
    pub cloud: OauthProviderConfig,
}

#[derive(Clone)]
pub struct AuthConfig(Arc<AuthConfigInner>);

impl AuthConfig {
    pub fn from_env() -> anyhow::Result<Self> {
        use anyhow::Context;

        let cloud_redirect_endpoint = std::env::var("YELKEN_CLOUD_OAUTH_REDIRECT_ENDPOINT")
            .context("YELKEN_CLOUD_OAUTH_REDIRECT_ENDPOINT is not defined")?;
        let cloud_token_endpoint = std::env::var("YELKEN_CLOUD_OAUTH_TOKEN_ENDPOINT")
            .context("YELKEN_CLOUD_OAUTH_TOKEN_ENDPOINT is not defined")?;

        let cloud_client_id = std::env::var("YELKEN_CLOUD_OAUTH_CLIENT_ID")
            .context("YELKEN_CLOUD_OAUTH_CLIENT_ID is not defined")?;
        let cloud_client_secret = std::env::var("YELKEN_CLOUD_OAUTH_CLIENT_SECRET")
            .context("YELKEN_CLOUD_OAUTH_CLIENT_SECRET is not defined")?;

        Ok(Self(Arc::new(AuthConfigInner {
            cloud: OauthProviderConfig {
                redirect_endpoint: cloud_redirect_endpoint,
                token_endpoint: cloud_token_endpoint,
                client_id: cloud_client_id,
                client_secret: cloud_client_secret,
            },
        })))
    }
}

impl Deref for AuthConfig {
    type Target = AuthConfigInner;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

#[derive(Deserialize)]
pub struct RedirectOauthProvider {
    state: String,
}

const STATE_LENGTH: usize = 32;

pub async fn redirect_oauth_provider(
    State(state): State<AppState>,
    crypto: Extension<Crypto>,
    Extension(auth_config): Extension<AuthConfig>,
    Query(query): Query<RedirectOauthProvider>,
) -> Result<(StatusCode, [(HeaderName, String); 1]), HttpError> {
    if query.state.len() != STATE_LENGTH {
        return Err(HttpError::unprocessable_entity("invalid_state_len"));
    }

    let client_state = query.state;
    // Server state is appended to client state as salt
    let server_state: String = (0..STATE_LENGTH)
        .map(|_| rng().sample(Alphanumeric) as char)
        .collect();
    let oauth_state = client_state + server_state.as_str();

    let oauth_state_hash = crypto.sign512(oauth_state.as_bytes());

    let location = Url::parse_with_params(
        &auth_config.cloud.redirect_endpoint,
        &[
            ("client_id", auth_config.cloud.client_id.as_str()),
            (
                "redirect_uri",
                format!("{}/api/auth/oauth/cloud", state.config.backend_origin).as_str(),
            ),
            (
                "state",
                format!("{}{}", oauth_state, oauth_state_hash).as_str(),
            ),
            ("response_type", "code"),
        ],
    )
    .unwrap()
    .into();

    Ok((StatusCode::FOUND, [(header::LOCATION, location)]))
}

#[derive(Deserialize)]
pub struct OauthProviderResponse {
    code: Option<String>,
    state: Option<String>,
    error: Option<String>,
}

pub async fn cloud_oauth(
    State(state): State<AppState>,
    Extension(crypto): Extension<Crypto>,
    Extension(auth_config): Extension<AuthConfig>,
    Query(query): Query<OauthProviderResponse>,
) -> Result<(StatusCode, [(HeaderName, String); 1]), HttpError> {
    #[derive(serde::Serialize)]
    struct UserInfoRequest<'a> {
        code: &'a str,
        client_id: &'a str,
        client_secret: &'a str,
        redirect_uri: &'a str,
    }

    #[derive(serde::Deserialize)]
    struct UserInfo {
        id: String,
        name: String,
        email: String,
    }

    if let Some(error) = query.error {
        return Err(HttpError::unprocessable_entity("oauth_failed").with_context(error));
    }

    let (Some(code), Some(oauth_state)) = (query.code, query.state) else {
        return Err(HttpError::unprocessable_entity("code_or_state_not_found"));
    };

    let Some((oauth_state, oauth_state_hash)) =
        oauth_state.split_at_checked(STATE_LENGTH + STATE_LENGTH)
    else {
        return Err(HttpError::unprocessable_entity("invalid_state"));
    };

    if oauth_state_hash.as_bytes() != crypto.sign512(&oauth_state.as_bytes()).as_bytes() {
        return Err(HttpError::unprocessable_entity("invalid_state"));
    }

    let Some((client_state, _)) = oauth_state.split_at_checked(STATE_LENGTH) else {
        return Err(HttpError::unprocessable_entity("invalid_state"));
    };

    let client = reqwest::ClientBuilder::default().build().unwrap();

    let resp = match client
        .post(&auth_config.cloud.token_endpoint)
        .form(&UserInfoRequest {
            code: &code,
            client_id: &auth_config.cloud.client_id,
            client_secret: &auth_config.cloud.client_secret,
            redirect_uri: format!("{}/api/auth/oauth/cloud", state.config.backend_origin).as_str(),
        })
        .send()
        .await
        .map_err(|_| HttpError::internal_server_error("connection_failed_for_access_token"))?
        .error_for_status()
    {
        Ok(resp) => resp,
        Err(e) => {
            return Err(HttpError::internal_server_error("access_token_failed")
                .with_context(format!("{e:?}")));
        }
    };

    let user_info: UserInfo = match resp.json().await {
        Ok(token) => token,
        Err(e) => {
            return Err(
                HttpError::internal_server_error("invalid_response_received")
                    .with_context(format!("{e:?}")),
            );
        }
    };

    let mut conn = state.pool.get().await?;

    let user_id = match users::table
        .filter(
            users::openid
                .eq(&user_info.id)
                .and(users::login_kind.eq(LoginKind::Cloud)),
        )
        .select((users::id, users::email))
        .first::<(i32, String)>(&mut conn)
        .await
        .optional()?
    {
        Some((user_id, email)) => {
            // Email can change for an openid.
            // Check if it is changed and update it
            if email != user_info.email {
                if let Err(e) = diesel::update(users::table)
                    .filter(users::id.eq(user_id))
                    .set(users::email.eq(&user_info.email))
                    .execute(&mut conn)
                    .await
                {
                    log::error!("Failed to update email of existing google oauth user with id {user_id} where new email is {}, {e:?}", user_info.email);
                }
            }

            user_id
        }
        None => {
            let user = diesel::insert_into(users::table)
                .values((
                    users::username.eq(generate_username(&user_info.name)),
                    users::name.eq(user_info.name),
                    users::email.eq(&user_info.email),
                    users::login_kind.eq(LoginKind::Cloud),
                    users::openid.eq(user_info.id),
                ))
                .get_result::<User>(&mut conn)
                .await?;

            user.id
        }
    };

    let token = crypto.encode(&base::middlewares::auth::Token::new(user_id))?;

    let location = Url::parse_with_params(
        &format!("{}/auth/oauth/login", state.config.frontend_origin),
        &[("token", token.as_str()), ("state", client_state)],
    )
    .unwrap()
    .into();

    Ok((StatusCode::FOUND, [(header::LOCATION, location)]))
}
