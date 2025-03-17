use crate::user::UserStore;
use leptos::prelude::*;

#[component]
pub fn Dashboard() -> impl IntoView {
    let user_store = expect_context::<UserStore>();

    let user = user_store.user();

    view! {
        <div class="p-2">
            <div class="row">
                <div class="col-6">
                    <div class="rounded bg-primary-subtle p-3">
                        <p class="m-0">"You have logged in " {move || user.get().name}</p>
                    </div>
                </div>
                <div class="col-6">
                    <div class="rounded bg-primary-subtle p-3">
                        <p class="m-0">"It is a good day to start"</p>
                    </div>
                </div>
            </div>
        </div>
    }
}
