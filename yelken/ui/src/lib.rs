use std::sync::Arc;

use leptos::prelude::*;
use leptos_router::components::*;
use leptos_router::path;

mod auth;
mod config;
mod dashboard;
mod plugin;
mod settings;
mod user;

pub use auth::{Auth, AuthProps};
pub use config::Config;
use plugin::PluginManager;
pub use plugin::PluginResource;
use settings::Settings;
pub use user::UserResource;

use dashboard::Dashboard;
use user::UserStore;

#[cfg(not(feature = "web"))]
fn logout(_base: &str) {}

#[cfg(feature = "web")]
fn logout(base: &str) {
    use wasm_bindgen::JsCast;

    let window = web_sys::window().unwrap();

    window
        .document()
        .unwrap()
        .dyn_ref::<web_sys::HtmlDocument>()
        .unwrap()
        .set_cookie(&format!(
            "yelken_token=; SameSite=Strict; Path={}/; Expires=Thu, 01 Jan 1970 00:00:01 GMT",
            base
        ))
        .unwrap();

    window
        .local_storage()
        .unwrap()
        .unwrap()
        .remove_item("token")
        .unwrap();
}

#[component]
fn TopBar() -> impl IntoView {
    let config = expect_context::<Config>();
    let user_store = expect_context::<Arc<UserStore>>();

    let login_link = format!("{}/auth/login", config.base);

    view! {
        <nav class="navbar" style="background: #ddffb5;">
            <div class="flex-grow-1"><a href=login_link on:click=move |_| logout(&config.base) rel="external">"Logout"</a></div>
            <div><p>{move || user_store.user().get().name}</p></div>
        </nav>
    }
}

#[component(transparent)]
fn BackgroundServices<U: UserResource>(user_resource: U, children: ChildrenFn) -> impl IntoView {
    let user = OnceResource::new(async move { user_resource.fetch_user().await });
    let children = StoredValue::new(children);

    view! {
        <Suspense fallback=move || view! { <p>"Loading"</p> }>
            {move || Suspend::new(async move {
                let user = match user.await {
                    Ok(user) => user,
                    Err(e) => return view! { <p>"Failed to load user " {format!("{e:?}")}</p> }.into_any()
                };

                provide_context(Arc::new(UserStore::new(user)));

                view! {{children.read_value()()}}.into_any()
            })}
        </Suspense>
    }
}

#[component]
pub fn App<U: UserResource, P: PluginResource + Clone + Sync>(
    config: Config,
    user_resource: U,
    plugin_resource: P,
) -> impl IntoView {
    let base = config.base.clone();

    provide_context(config);

    let links = vec![
        ("/", "Dashboard"),
        ("/plugin-manager", "Plugin Manager"),
        ("/settings", "Settings"),
    ];

    view! {
        <Router base>
            <div class="d-flex">
                <nav class="vh-100" style="background: #ddffb5;">
                    <div class="px-3 py-2">
                        <A href="/" attr:class="text-decoration-none fs-4">"YELKEN"</A>
                    </div>

                    <ul class="navbar-nav">
                        {
                            links.into_iter().map(|(href, title)| view! {
                                <li class="nav-item"><A href=href attr:class="nav-link d-block ps-3 pe-5 py-2">{title}</A></li>
                            })
                            .collect_view()
                        }
                    </ul>
                </nav>
                <main class="flex-grow-1">
                    <BackgroundServices user_resource>
                        <TopBar/>

                        <Routes fallback=|| "Not found." clone:plugin_resource>
                            <ParentRoute path=path!("") view=Outlet clone:plugin_resource>
                                <Route path=path!("") view=Dashboard/>
                                <Route path=path!("plugin-manager") view=move || view! { <PluginManager plugin_resource=plugin_resource.clone()></PluginManager> }/>
                                <Route path=path!("settings") view=Settings/>
                            </ParentRoute>
                        </Routes>
                    </BackgroundServices>
                </main>
            </div>
        </Router>
    }
}
