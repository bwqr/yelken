use std::sync::Arc;

use leptos::prelude::*;
use leptos_router::components::*;
use leptos_router::path;

mod auth;
pub mod user;

use auth::AuthRoutes;
use user::UserStore;

#[component]
fn Dashboard() -> impl IntoView {
    let user_store = use_context::<Arc<dyn UserStore>>().expect("UserStore should be provided");

    view! {
        <div>
            <p>"Dashboard"</p>
            {move || if let Some(user) = user_store.user().get() {
                    view !{
                        <p>"You have logged in " {user.name}</p>
                    }
                    .into_any()
                } else {
                    view !{
                        <A href="auth" attr:class="btn btn-primary">"Login"</A>
                    }
                    .into_any()
                }
            }
        </div>
    }
}

#[component]
fn App() -> impl IntoView {
    view! {
        <main>
            <Outlet/>
        </main>
    }
}

#[component]
pub fn Root(user_store: Arc<dyn UserStore>, base: String) -> impl IntoView {
    log::info!("Running App with base {base}");

    provide_context(user_store);

    view! {
        <Router base>
            <Routes fallback=|| "Not found.">
                <AuthRoutes/>

                <ParentRoute path=path!("") view=App>
                    <Route path=path!("") view=Dashboard/>
                </ParentRoute>
            </Routes>
        </Router>
    }
}
