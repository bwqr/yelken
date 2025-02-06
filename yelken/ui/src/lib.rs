use leptos::prelude::*;

#[component]
pub fn SimpleCounter(initial_value: i32) -> impl IntoView {
    log::info!("Hey from Simple Counter with value {initial_value}");

    // create a reactive signal with the initial value
    let (value, set_value) = signal(initial_value);

    // create event handlers for our buttons
    // note that `value` and `set_value` are `Copy`, so it's super easy to move them into closures
    let clear = move |_| set_value.set(0);
    let decrement = move |_| *set_value.write() -= 1;
    let increment = move |_| *set_value.write() += 1;

    view! {
        <div>
            <button class="btn" on:click=clear>"Clear"</button>
            <button class="btn" on:click=decrement>"-1"</button>
            <span>"Value: "{value}"!"</span>
            <button class="btn" on:click=increment>"+1"</button>
        </div>
    }
}
