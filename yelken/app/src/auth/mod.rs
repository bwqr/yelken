use leptos::prelude::*;
use leptos_router::components::*;
use leptos_router::path;

use crate::Config;

mod email;
mod oauth;

#[cfg(not(feature = "web"))]
fn save_token_and_redirect(_base: &str, _token: &str) {
    unimplemented!();
}

#[cfg(feature = "web")]
fn save_token_and_redirect(base: &str, token: &str) {
    use wasm_bindgen::JsCast;

    let window = web_sys::window().unwrap();

    let week = 60 * 60 * 24 * 7;

    window
        .document()
        .unwrap()
        .dyn_ref::<web_sys::HtmlDocument>()
        .unwrap()
        .set_cookie(&format!(
            "yelken_token={}; SameSite=Strict; Path={}/; Max-Age={}",
            token, base, week
        ))
        .unwrap();

    window
        .local_storage()
        .unwrap()
        .unwrap()
        .set_item("token", token)
        .unwrap();

    window.location().assign(&format!("{}/", base)).unwrap();
}

#[component]
pub fn Auth(config: Config) -> impl IntoView {
    let base = format!("{}/auth", config.base);

    provide_context(config);

    view! {
        <Router base>
            <Routes fallback=|| "Auth route not found.">
                <Route path=path!("login") view=email::Login/>
                <Route path=path!("oauth/saas") view=oauth::Redirect/>
                <Route path=path!("oauth/login") view=oauth::Login/>
            </Routes>
        </Router>
    }
}
