use std::{future::Future, sync::Arc};

use leptos::prelude::*;
use leptos_router::hooks::use_params_map;
use shared::plugin::Plugin;

use crate::Config;

pub trait PluginResource: Send + 'static {
    fn fetch_plugins(&self) -> impl Future<Output = Result<Vec<Plugin>, String>> + Send;
}

struct PluginStore {
    plugins: RwSignal<Vec<Plugin>>,
}

impl PluginStore {
    fn new(plugins: Vec<Plugin>) -> Self {
        Self {
            plugins: RwSignal::new(plugins),
        }
    }

    fn plugins(&self) -> ReadSignal<Vec<Plugin>> {
        self.plugins.read_only()
    }
}

#[component]
pub fn PluginNav<P: PluginResource>(plugin_resource: P) -> impl IntoView {
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
                        <p class="mt-2">"Plugins"</p>
                        <hr/>
                        <ul class="navbar-nav">
                            {move || plugins.iter().filter_map(|plugin| {
                                let Some(menus) = &plugin.menus else {
                                    return None;
                                };

                                Some(view! {
                                    <li class="nav-item">
                                        <a class="nav-link d-block ps-3 pe-5 py-2" rel="external" href=format!("{}/plugin/{}", config.base, plugin.id)>
                                            {plugin.name.clone()}
                                        </a>
                                        <ul>
                                            {menus.iter().map(|menu| view! {
                                                <li>
                                                    <a rel="external" href=format!("{}/plugin/{}/{}", config.base, plugin.id, menu.path)>
                                                        {menu.name.clone()}
                                                    </a>
                                                </li>
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

#[component]
fn Plugins() -> impl IntoView {
    let plugin_store = expect_context::<Arc<PluginStore>>();
    view! {
        { move || plugin_store.plugins().get().iter().map(|plugin| view! { <p>"Plugin " {plugin.name.clone()}</p>}).collect_view()}
    }
}

#[component]
pub fn PluginManager<T: PluginResource>(plugin_resource: T) -> impl IntoView {
    let plugins = OnceResource::new(async move { plugin_resource.fetch_plugins().await });

    view! {
        <Suspense fallback=move || view! { <p>"Loading"</p> }>
            {move || Suspend::new(async move {
                let plugins = match plugins.await {
                    Ok(plugins) => plugins,
                    Err(e) => return view! { <p>"Failed to load plugins " {format!("{e:?}")}</p> }.into_any()
                };

                provide_context(Arc::new(PluginStore::new(plugins)));

                view! { <Plugins></Plugins> }.into_any()
            })}
        </Suspense>
    }
}

#[component]
pub fn Plugin() -> impl IntoView {
    let params = use_params_map();

    let plugin = move || params.read().get("plugin");

    view! {
        <p>"Plugin Page " {move || plugin()}</p>
    }
}
