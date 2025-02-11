use leptos::prelude::*;
use leptos_router::components::*;
use leptos_router::path;
use leptos_router::MatchNestedRoutes;

#[component]
fn Login() -> impl IntoView {
    view! {
        <p>"Login with me"</p>
    }
}

#[component(transparent)]
pub fn AuthRoutes() -> impl MatchNestedRoutes + Clone {
    view! {
        <ParentRoute path=path!("auth") view=Outlet>
            <Route path=path!("/") view=|| view! { <A href="/auth/login" prop:class="btn btn-primary">"Go to the Login"</A> }/>
            <Route path=path!("/login") view=Login/>
        </ParentRoute>
    }
    .into_inner()
}
