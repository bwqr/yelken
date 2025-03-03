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
use plugin::{Plugin, PluginNav};
use user::UserStore;

// Load i18n
leptos_i18n::load_locales!();

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
    let config = StoredValue::new(expect_context::<Config>());
    let user_store = expect_context::<Arc<UserStore>>();

    let (dropdown, set_dropdown) = signal(false);

    #[cfg(feature = "web")]
    {
        use wasm_bindgen::JsCast;
        use web_sys::Event;

        let closure =
            wasm_bindgen::prelude::Closure::<dyn Fn(Event)>::new(move |_| set_dropdown.set(false));

        web_sys::window()
            .unwrap()
            .document()
            .unwrap()
            .add_event_listener_with_callback("click", closure.as_ref().unchecked_ref())
            .unwrap();

        closure.forget();
    }

    view! {
        <nav class="navbar px-4 py-3 mb-4">
            <div class="flex-grow-1"></div>

            <div class="dropdown">
                <button
                    class="btn border border-2 border-primary-subtle"
                    type="button"
                    aria-expanded=move || if dropdown.get() { "true" } else { "false" }
                    on:click=move |e| { e.stop_propagation(); set_dropdown.set(!dropdown.get_untracked()) }
                >
                    {move || user_store.user().get().name}
                </button>

                <Show clone:config when=move || dropdown.get() fallback=|| view! {}>
                    <ul class="dropdown-menu mt-1" style="right: 0;" class:show=dropdown on:click=|e| e.stop_propagation()>
                        <li>
                            <a
                                class="dropdown-item"
                                href=move || config.with_value(|c| format!("{}/auth/login", c.base))
                                on:click=move |_| config.with_value(|c| logout(&c.base))
                                rel="external"
                            >"Logout"</a>
                        </li>
                    </ul>
                </Show>
            </div>
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
    use i18n::*;

    let base = config.base.clone();

    provide_context(config);

    let links = vec![
        ("", "Dashboard"),
        ("plugin-manager", "Plugin Manager"),
        ("settings", "Settings"),
    ];

    view! {
        <I18nContextProvider>
            <Router base>
                <div class="d-flex">
                    <nav id="sidenav" class="vh-100 text-secondary" style="background-color: #ffdabd;">
                        <div class="px-4 py-4 mb-2">
                            <A href="/" attr:class="text-decoration-none fs-4 text-secondary-emphasis">"Yelken"</A>
                        </div>

                        <p class="pe-5 text-secondary ps-3 m-0 text-uppercase" style="font-size: calc(var(--bs-body-font-size) - 0.2rem)"><b>{t!(use_i18n(), main.apps)}</b></p>
                        <ul class="navbar-nav mb-4">
                            {
                                links.into_iter().map(|(href, title)| view! {
                                    <li class="nav-item"><A href=href attr:class="nav-link d-block ps-3 pe-5 py-2">{title}</A></li>
                                })
                                .collect_view()
                            }
                        </ul>

                        <p class="pe-5 text-secondary ps-3 m-0 text-uppercase" style="font-size: calc(var(--bs-body-font-size) - 0.2rem)"><b>{t!(use_i18n(), main.plugins)}</b></p>
                        <PluginNav plugin_resource=plugin_resource.clone()/>
                    </nav>
                    <main class="flex-grow-1">
                        <BackgroundServices user_resource>
                            <TopBar/>

                            <Routes fallback=|| "Not found." clone:plugin_resource>
                                <ParentRoute path=path!("") view=Outlet clone:plugin_resource>
                                    <Route path=path!("") view=Dashboard/>
                                    <Route path=path!("plugin-manager") view=move || view! {
                                        <PluginManager plugin_resource=plugin_resource.clone()></PluginManager>
                                    }/>
                                    <Route path=path!("settings") view=Settings/>
                                    <Route path=path!("plugin/:plugin") view=Plugin/>
                                </ParentRoute>
                            </Routes>
                        </BackgroundServices>
                    </main>
                </div>
            </Router>
        </I18nContextProvider>
    }
}
