use std::sync::Arc;

use leptos::prelude::*;
use leptos_router::components::*;
use leptos_router::path;

mod auth;
mod config;
mod dashboard;
mod user;

pub use auth::{Auth, AuthProps};
pub use config::Config;
pub use user::UserAction;

use dashboard::Dashboard;
use user::UserStore;

#[component(transparent)]
fn BackgroundServices<T: UserAction + 'static>(
    user_action: T,
    children: ChildrenFn,
) -> impl IntoView {
    let user = OnceResource::new(async move { user_action.fetch_user().await });
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
pub fn App<T: UserAction + 'static>(config: Config, user_action: T) -> impl IntoView {
    let base = config.base.clone();

    provide_context(config);

    view! {
        <Router base>
            <nav>
                <ul>
                    <li><A href="/">"Dashboard"</A></li>
                    <li><A href="/plugins">"Plugin Manager"</A></li>
                    <li><A href="/settings">"Settings"</A></li>
                    <li><A href="/about">"About"</A></li>
                </ul>
            </nav>
            <main>
                <BackgroundServices user_action>
                    <Routes fallback=|| "Not found.">
                        <ParentRoute path=path!("") view=Outlet>
                            <Route path=path!("") view=Dashboard/>
                        </ParentRoute>
                    </Routes>
                </BackgroundServices>
            </main>
        </Router>
    }
}
