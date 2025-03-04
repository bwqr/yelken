use std::sync::Arc;

use crate::{
    i18n::{t, t_string, use_i18n, Locale},
    user::UserStore,
    Config, PluginResource,
};
use leptos::prelude::*;
use leptos_router::components::A;

#[component]
pub fn TopBar() -> impl IntoView {
    let i18n = use_i18n();

    let on_switch = move |_| {
        let new_locale = match i18n.get_locale() {
            Locale::en => Locale::tr,
            Locale::tr => Locale::en,
        };
        i18n.set_locale(new_locale);
    };

    let config = StoredValue::new(expect_context::<Config>());
    let user_store = expect_context::<UserStore>();

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
            <div class="flex-grow-1">
                <button class="btn btn-secondary" on:click=on_switch>{t!(i18n, sidenav.change_lang)}</button>
            </div>

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

#[component]
pub fn SideNav() -> impl IntoView {
    let i18n = use_i18n();

    let links = move || {
        vec![
            ("", t_string!(i18n, sidenav.dashboard)),
            ("models", t_string!(i18n, sidenav.models)),
            ("plugin-manager", t_string!(i18n, sidenav.plugin_manager)),
            ("settings", t_string!(i18n, sidenav.settings)),
        ]
    };

    view! {
        <nav id="sidenav" class="vh-100 text-secondary" style="background-color: #ffdabd;">
            <div class="px-4 py-4 mb-2">
                <A href="/" attr:class="text-decoration-none fs-4 text-secondary-emphasis">"Yelken"</A>
            </div>

            <p class="pe-5 text-secondary ps-3 m-0 text-uppercase" style="font-size: calc(var(--bs-body-font-size) - 0.2rem)"><b>{t!(i18n, sidenav.apps)}</b></p>
            <ul class="navbar-nav mb-4">
                {move || links().into_iter().map(|(href, title)| view! {
                        <li class="nav-item"><A href=href exact=true attr:class="nav-link d-block ps-3 pe-5 py-2">{title}</A></li>
                    })
                    .collect_view()
                }
            </ul>

            <p class="pe-5 text-secondary ps-3 m-0 text-uppercase" style="font-size: calc(var(--bs-body-font-size) - 0.2rem)"><b>{t!(i18n, sidenav.plugins)}</b></p>
            <PluginNav/>
        </nav>
    }
}

#[component]
pub fn PluginNav() -> impl IntoView {
    let plugin_resource = expect_context::<Arc<dyn PluginResource>>();
    let config = expect_context::<Config>();

    let plugins = OnceResource::new(async move { plugin_resource.fetch_plugins().await });

    view! {
        <Suspense fallback=|| "">
            {move || {
                let config = config.clone();

                Suspend::new(async move {
                    let plugins = match plugins.await {
                        Ok(plugins) => plugins,
                        Err(_) => vec![],
                    };

                    if plugins
                        .iter()
                        .find(|plugin| plugin.menus.is_some())
                        .is_none() {
                        return view! { }.into_any();
                    }

                    view! {
                        <ul class="navbar-nav">
                            {move || plugins.iter().filter_map(|plugin| {
                                let Some(menus) = &plugin.menus else {
                                    return None;
                                };

                                let plugin_name = plugin.name.clone();

                                Some(view! {
                                    <li class="nav-item">
                                        <A attr:class="nav-link d-block ps-3 pe-5 py-2" attr:rel="external" exact=true href=format!("{}/plugin/{}", config.base, plugin.id)>
                                            {plugin_name}
                                        </A>
                                        <ul class="navbar-nav">
                                            {menus.iter().map(|menu| {
                                                let menu_name = menu.name.clone();

                                                view! {
                                                    <li>
                                                        <A
                                                            href=format!("{}/plugin/{}/{}", config.base, plugin.id, menu.path)
                                                            attr:class="nav-link d-block ps-5 pe-2 py-2"
                                                            attr:rel="external"
                                                            attr:style="font-size: calc(var(--bs-body-font-size) - 0.1rem)"
                                                        >
                                                            {menu_name}
                                                        </A>
                                                    </li>
                                                }
                                        }).collect_view()}
                                        </ul>
                                    </li>
                                })
                            } ).collect_view()}
                        </ul>
                    }
                    .into_any()
                })
            }}
        </Suspense>
    }
}

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
