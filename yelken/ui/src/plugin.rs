use std::{future::Future, pin::Pin, sync::Arc};

use leptos::prelude::*;
use leptos_router::hooks::use_params_map;
use shared::plugin::Plugin;

pub trait PluginResource: Send + Sync + 'static {
    fn fetch_plugins(&self) -> Pin<Box<dyn Future<Output = Result<Vec<Plugin>, String>> + Send>>;
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
fn Plugins() -> impl IntoView {
    let plugin_store = expect_context::<Arc<PluginStore>>();
    view! {
        { move || plugin_store.plugins().get().iter().map(|plugin| view! { <p>"Plugin " {plugin.name.clone()}</p>}).collect_view()}
    }
}

#[component]
pub fn PluginManager() -> impl IntoView {
    let plugin_resource = expect_context::<Arc<dyn PluginResource>>();

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
