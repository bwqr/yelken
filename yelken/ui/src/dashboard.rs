use std::sync::Arc;
use leptos::prelude::*;
use crate::user::UserStore;

#[component]
pub fn Dashboard() -> impl IntoView {
    let user_store = expect_context::<Arc<UserStore>>();

    view! {
        <div>
            <p>"Dashboard"</p>
            <p>"You have logged in " {move || user_store.user().get().name}</p>
        </div>
    }
}
