use std::sync::Arc;

use axum::{
    body::Body,
    extract::{Request, State},
    http::{header, Method},
    middleware,
    response::{Html, IntoResponse, Redirect, Response},
    Extension, Router,
};
use futures::StreamExt;
use hydration_context::{SharedContext, SsrSharedContext};
use leptos::prelude::{provide_context, Owner, RenderHtml};
use leptos_router::location::RequestUrl;

use app::Config;
use base::{models::AuthUser, AppState};
use plugin::PluginHost;
use resources::{ContentContext, PluginContext, UserContext};

mod resources;

const APP_ROOT: &str = "/yk/app";

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
        .nest("/auth", Router::new().fallback(handle_auth_req))
        .fallback(handle_req)
        .layer(Extension(Arc::new(index_html)))
        .layer(middleware::from_fn_with_state(
            state,
            base::middlewares::try_auth_from_cookie,
        ))
}

async fn handle_auth_req(
    State(state): State<AppState>,
    Extension(index_html): Extension<Arc<IndexHtml>>,
    req: Request,
) -> Response {
    let url = req
        .uri()
        .path_and_query()
        .map(|pq| pq.as_str())
        .unwrap_or("/");

    let config = Config::new(APP_ROOT.to_string(), state.config.api_origin.clone());

    let body = Owner::new_root(None).with(move || {
        provide_context(RequestUrl::new(&format!("{}/auth{}", APP_ROOT, url)));

        app::Auth(app::AuthProps { config }).to_html()
    });

    Html(format!(
        "{}{}{}{}",
        index_html.head, index_html.body, body, index_html.tail
    ))
    .into_response()
}

async fn handle_req(
    State(state): State<AppState>,
    Extension(plugin_host): Extension<PluginHost>,
    Extension(index_html): Extension<Arc<IndexHtml>>,
    auth_user: Option<AuthUser>,
    req: Request,
) -> Response {
    if req.method() != Method::GET {
        return "Method not allowed".into_response();
    }

    let Some(auth_user) = auth_user else {
        return Redirect::to(&format!("{}/auth/login", APP_ROOT)).into_response();
    };

    let url = req
        .uri()
        .path_and_query()
        .map(|pq| pq.as_str())
        .unwrap_or("/");

    let config = Config::new(APP_ROOT.to_string(), state.config.api_origin.clone());

    let shared_context = Arc::new(SsrSharedContext::new());

    let mut body = Owner::new_root(Some(
        Arc::clone(&shared_context) as Arc<dyn SharedContext + Send + Sync>
    ))
    .with(move || {
        provide_context(RequestUrl::new(&format!("{}{}", APP_ROOT, url)));

        app::App(app::AppProps {
            config,
            user_resource: UserContext::new(auth_user),
            plugin_resource: PluginContext::new(plugin_host, state.clone()),
            content_resource: ContentContext::new(state.clone()),
        })
        .to_html_stream_in_order()
    });

    body.push_sync(&index_html.head);
    body.push_sync(&index_html.body);

    let mut resp = Body::from_stream(
        body.chain(
            shared_context
                .pending_data()
                .unwrap()
                .map(|chunk| format!("<script>{chunk}</script>")),
        )
        .chain(futures::stream::once(
            async move { index_html.tail.clone() },
        ))
        .map(|body| -> Result<String, &str> { Ok(body) }),
    )
    .into_response();

    resp.headers_mut().insert(
        header::CONTENT_TYPE,
        "text/html; charset=utf-8".parse().unwrap(),
    );

    resp
}
