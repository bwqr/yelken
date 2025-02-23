use crate::user::UserStore;
use leptos::prelude::*;
use std::sync::Arc;

#[component]
pub fn Dashboard() -> impl IntoView {
    let user_store = expect_context::<Arc<UserStore>>();

    view! {
        <div>
            <p>"You have logged in " {move || user_store.user().get().name}</p>
        </div>
    }
}
