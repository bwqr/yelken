use std::sync::Arc;

use axum::{
    extract::{Request, State},
    http::Method,
    middleware,
    response::{Html, IntoResponse, Response},
    Extension, Router,
};
use leptos::prelude::{provide_context, Owner, RenderHtml};
use leptos_router::location::RequestUrl;

use base::{models::AuthUser, AppState};
use plugin::PluginHost;
use shared::user::User;
use ui::{Config, UserAction};

async fn auth_cookie() {
    //  else if let Some(cookie) = req.headers().get(http::header::COOKIE) {
    //     let Ok(cookie) = cookie.to_str() else {
    //         return Ok(None);
    //     };

    //     let Some(token) = cookie.split_once("yelken_token=").map(|split| split.1) else {
    //         return Ok(None);
    //     };

    //     log::info!("Yelken Token {}", token);

    //     let Some(token) = token.split_once(";").map(|split| split.0) else {
    //         return Ok(None);
    //     };

    //     token
    // }
}

struct UserContext {
    auth_user: Option<AuthUser>,
}

impl UserContext {
    fn new(auth_user: Option<AuthUser>) -> Self {
        Self { auth_user }
    }
}

impl UserAction for UserContext {
    fn fetch_user(&self) -> impl std::future::Future<Output = Result<User, String>> + Send {
        let user = self
            .auth_user
            .as_ref()
            .map(|user| User {
                id: user.id,
                name: user.name.clone(),
            })
            .ok_or("User does not exist".to_string());

        async move { user }
    }
}

struct IndexHtml {
    head: String,
    body: String,
    tail: String,
}

pub fn router(state: AppState) -> Router<AppState> {
    any_spawner::Executor::init_tokio().unwrap();

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
        .layer(Extension(Arc::new(index_html)))
        .layer(middleware::from_fn_with_state(
            state,
            base::middlewares::try_auth,
        ))
}

async fn handle_req(
    State(state): State<AppState>,
    Extension(index_html): Extension<Arc<IndexHtml>>,
    auth_user: Option<AuthUser>,
    req: Request,
) -> Response {
    if req.method() != Method::GET {
        return "Method not allowed".into_response();
    }

    let url = req
        .uri()
        .path_and_query()
        .map(|pq| pq.as_str())
        .unwrap_or("/");

    let config = Config::new("/yk-app".to_string(), state.config.api_origin.clone());

    let body = Owner::new_root(None).with(move || {
        provide_context(RequestUrl::new(&format!("/yk-app{}", url)));

        ui::App(ui::AppProps {
            config,
            user_action: UserContext::new(auth_user),
        })
        .to_html()
    });

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
