use std::sync::Arc;

use content::ContentStore;
use leptos::prelude::*;
use leptos_router::components::*;
use leptos_router::path;

mod auth;
mod config;
mod content;
mod dashboard;
mod nav;
mod plugin;
mod settings;
mod user;

pub use auth::{Auth, AuthProps};
pub use config::Config;
pub use content::ContentResource;
use content::Models;
use plugin::PluginManager;
pub use plugin::PluginResource;
use settings::Settings;
pub use user::UserResource;

use crate::i18n::I18nContextProvider;
use dashboard::Dashboard;
use nav::{SideNav, TopBar};
use plugin::Plugin;
use user::UserStore;

// Load i18n
leptos_i18n::load_locales!();

#[component(transparent)]
fn BackgroundServices(children: ChildrenFn) -> impl IntoView {
    let content_resource = expect_context::<Arc<dyn ContentResource>>();
    let user_resource = expect_context::<Arc<dyn UserResource>>();

    let fields = OnceResource::new(content_resource.fetch_fields());
    let user = OnceResource::new(user_resource.fetch_user());
    let children = StoredValue::new(children);

    view! {
        <Suspense fallback=move || view! { <p>"Loading"</p> }>
            {move || Suspend::new(async move {
                let (user, fields) = match (user.await, fields.await) {
                    (Ok(user), Ok(fields)) => (user, fields),
                    _ => return view! { <p>"Failed to load user "</p> }.into_any()
                };

                provide_context(ContentStore::new(fields));
                provide_context(UserStore::new(user));

                view! {{children.read_value()()}}.into_any()
            })}
        </Suspense>
    }
}

#[component]
pub fn App<U: UserResource, P: PluginResource, C: ContentResource>(
    config: Config,
    user_resource: U,
    plugin_resource: P,
    content_resource: C,
) -> impl IntoView {
    let base = config.base.clone();

    provide_context(config);
    provide_context::<Arc<dyn UserResource>>(Arc::new(user_resource));
    provide_context::<Arc<dyn PluginResource>>(Arc::new(plugin_resource));
    provide_context::<Arc<dyn ContentResource>>(Arc::new(content_resource));

    view! {
        <I18nContextProvider>
            <Router base>
                <div class="d-flex">
                    <SideNav/>

                    <main class="flex-grow-1">
                        <BackgroundServices>
                            <TopBar/>

                            <Routes fallback=|| "Not found.">
                                <ParentRoute path=path!("") view=Outlet>
                                    <Route path=path!("") view=Dashboard/>
                                    <Route path=path!("models") view=Models/>
                                    <Route path=path!("plugin-manager") view=PluginManager/>
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
