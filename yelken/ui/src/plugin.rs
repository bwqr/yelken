use std::{future::Future, sync::Arc};

use leptos::prelude::*;
use shared::plugin::Plugin;

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
