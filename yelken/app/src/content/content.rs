use super::ContentStore;
use leptos::prelude::*;

#[component]
pub fn Contents() -> impl IntoView {
    let content_store = expect_context::<ContentStore>();

    view! {
        <div class="p-2">
            <p>"Models"</p>
            { move || content_store.models().get().iter().map(|model| view! { <p>{model.name.clone()}</p> }).collect_view() }
        </div>
    }
}
