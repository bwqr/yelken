use std::sync::Arc;

use axum::{
    extract::{Request, State},
    http::Method,
    middleware,
    response::{Html, IntoResponse, Response},
    Extension, Router,
};
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use leptos::prelude::{
    provide_context, GetUntracked, Owner, ReadSignal, RenderHtml, RwSignal, Write,
};
use leptos_router::location::RequestUrl;

use base::{models::AuthUser, schema::users, AppState};
use plugin::PluginHost;
use ui::user::{User, UserStore};

struct UserContext {
    state: AppState,
    auth_user: AuthUser,
    user_signal: RwSignal<Option<User>>,
}

impl UserContext {
    fn new(state: AppState, auth_user: AuthUser) -> Self {
        Self {
            state,
            auth_user,
            user_signal: RwSignal::new(None),
        }
    }
}

impl UserStore for UserContext {
    fn user(&self) -> ReadSignal<Option<ui::user::User>> {
        if self.user_signal.get_untracked().is_none() {
            *self.user_signal.write() = Some(User {
                id: self.auth_user.id,
                name: self.auth_user.name.clone(),
            });
        }

        self.user_signal.read_only()
    }
}

struct IndexHtml {
    head: String,
    body: String,
    tail: String,
}

pub fn router(state: AppState) -> Router<AppState> {
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
        .with_state(state.clone())
        .layer(Extension(Arc::new(index_html)))
        .layer(middleware::from_fn_with_state(
            state,
            base::middlewares::auth,
        ))
}

async fn handle_req(
    State(state): State<AppState>,
    Extension(index_html): Extension<Arc<IndexHtml>>,
    auth_user: AuthUser,
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

    let body = Owner::new_root(None).with(move || {
        provide_context(RequestUrl::new(&format!("/yk-app{}", url)));

        ui::Root(ui::RootProps {
            base: "/yk-app".to_string(),
            user_store: Arc::new(UserContext::new(state, auth_user)),
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
