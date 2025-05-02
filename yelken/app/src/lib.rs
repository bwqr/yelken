use std::sync::Arc;

use content::ContentRoutes;
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

#[cfg(feature = "web")]
pub use resource::BaseResource;

#[cfg(feature = "web")]
mod resource {
    use std::future::Future;

    use crate::Config;
    use reqwest::StatusCode;
    use serde::de::DeserializeOwned;
    use serde::Serialize;

    #[derive(Clone)]
    pub struct BaseResource {
        config: Config,
    }

    impl BaseResource {
        pub fn new(config: Config) -> Self {
            Self { config }
        }

        pub fn get<T: DeserializeOwned + Send>(
            &self,
            url: &str,
        ) -> impl Future<Output = Result<T, String>> {
            let url = format!("{}{url}", self.config.api_url);
            let login = format!("{}/auth/login", self.config.base);

            async move {
                let window = web_sys::window().unwrap();

                let token = window
                    .local_storage()
                    .unwrap()
                    .unwrap()
                    .get_item("token")
                    .unwrap()
                    .unwrap_or("".to_string());

                let resp = reqwest::Client::new()
                    .get(url)
                    .header(reqwest::header::AUTHORIZATION, format!("Bearer {token}"))
                    .send()
                    .await
                    .map_err(|err| format!("{err:?}"))?;

                if let Err(err) = resp.error_for_status_ref() {
                    if let Some(StatusCode::UNAUTHORIZED) = err.status() {
                        window.location().assign(&login).unwrap();
                    }

                    let body = resp.text().await.map_err(|e| format!("{e:?}"))?;

                    return Err(format!("{body}"));
                }

                resp.json().await.map_err(|err| format!("{err:?}"))
            }
        }

        pub fn post<Req: Serialize, Resp: DeserializeOwned>(
            &self,
            url: &str,
            req: Req,
        ) -> impl Future<Output = Result<Resp, String>> {
            let url = format!("{}{url}", self.config.api_url);
            let login = format!("{}/auth/login", self.config.base);

            async move {
                let window = web_sys::window().unwrap();

                let token = window
                    .local_storage()
                    .unwrap()
                    .unwrap()
                    .get_item("token")
                    .unwrap()
                    .unwrap_or("".to_string());

                let resp = reqwest::Client::new()
                    .post(url)
                    .json(&req)
                    .header(reqwest::header::AUTHORIZATION, format!("Bearer {token}"))
                    .send()
                    .await
                    .map_err(|err| format!("{err:?}"))?;

                if let Err(err) = resp.error_for_status_ref() {
                    if let Some(StatusCode::UNAUTHORIZED) = err.status() {
                        window.location().assign(&login).unwrap();
                    }

                    let body = resp.text().await.map_err(|e| format!("{e:?}"))?;

                    return Err(format!("{body}"));
                }

                resp.json().await.map_err(|err| format!("{err:?}"))
            }
        }
    }
}

#[component(transparent)]
fn BackgroundServices(children: ChildrenFn) -> impl IntoView {
    let base_resource = expect_context::<BaseResource>();
    let content_resource = expect_context::<Arc<dyn ContentResource>>();
    let user_resource = expect_context::<Arc<dyn UserResource>>();

    let content_store = ContentStore::new(base_resource, content_resource);

    let fields = OnceResource::new(content_store.load_fields());
    let models = OnceResource::new(content_store.load_models());
    let user = OnceResource::new(user_resource.fetch_user());

    let children = StoredValue::new(children);

    view! {
        <Suspense fallback=move || view! { <p>"Loading"</p> }>
            {move || {
                let user_resource = user_resource.clone();

                Suspend::new(async move {
                    let Ok(user) = user.await.inspect_err(|e| log::warn!("Failed to load user, {e:?}")) else {
                        return view! { <p>"Failed to load user"</p> }.into_any();
                    };

                    if let Err(e) = fields.await {
                        log::warn!("Failed to load fields, {e:?}");

                        return view! { <p>"Failed to load fields"</p> }.into_any();
                    };

                    if let Err(e) = models.await {
                        log::warn!("Failed to load models, {e:?}");

                        return view! { <p>"Failed to load models"</p> }.into_any();
                    };

                    provide_context(content_store);
                    provide_context(UserStore::new(user, user_resource));

                    view! {{children.read_value()()}}.into_any()
                })
        }}
        </Suspense>
    }
}

#[component]
pub fn App<U: UserResource, P: PluginResource, C: ContentResource>(
    config: Config,
    base_resource: BaseResource,
    user_resource: U,
    plugin_resource: P,
    content_resource: C,
) -> impl IntoView {
    let base = config.base.clone();

    provide_context(config);
    provide_context(base_resource);
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
                                    <ContentRoutes/>
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
