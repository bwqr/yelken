use leptos::prelude::*;
use serde::{Deserialize, Serialize};

#[cfg(feature = "web")]
const STATE_KEY: &'static str = "oauth_state";
#[cfg(feature = "web")]
const STATE_LENGTH: usize = 32;

#[derive(Deserialize, Serialize)]
struct State {
    state: String,
    timestamp: f64,
}

#[component]
pub fn Login() -> impl IntoView {
    let (error, _set_error) = signal(Option::<&'static str>::None);

    #[cfg(feature = "web")]
    {
        fn login() -> Result<(), &'static str> {
            use super::save_token_and_redirect;
            use leptos_router::hooks::use_query_map;

            let config = expect_context::<crate::Config>();
            let query = use_query_map();

            let window = web_sys::window().unwrap();

            let item = window
                .local_storage()
                .unwrap()
                .unwrap()
                .get_item(STATE_KEY)
                .unwrap()
                .ok_or("state_not_found")?;

            const TIMEOUT: f64 = (1000 * 60 * 5) as f64;

            let state = serde_json::from_str::<State>(&item).map_err(|_| "invalid_state")?;

            if state.timestamp < (js_sys::Date::new_0().get_time() - TIMEOUT) {
                return Err("expired_state");
            }

            let query_state = query
                .get_untracked()
                .get("state")
                .ok_or("missing_state_in_query")?;

            if query_state != state.state {
                return Err("mismatched_state");
            }

            let token = query
                .get_untracked()
                .get("token")
                .ok_or("missing_token_in_query")?;

            save_token_and_redirect(&config.base, &token);

            Ok(())
        }

        if let Err(e) = login() {
            _set_error.set(Some(e));
        }
    }

    view! {
        <p> { move || error.get() } </p>
    }
}

#[component]
pub fn Redirect() -> impl IntoView {
    #[cfg(feature = "web")]
    {
        fn generate_state(window: &web_sys::Window, len: usize) -> String {
            let dec_to_hex = |byte: u8| format!("{byte:02X}");

            let mut buffer = vec![0u8; len / 2];

            window
                .crypto()
                .unwrap()
                .get_random_values_with_u8_array(&mut buffer)
                .unwrap();

            buffer.into_iter().map(dec_to_hex).collect()
        }

        let config = expect_context::<crate::Config>();

        let window = web_sys::window().unwrap();

        let state = State {
            state: generate_state(&window, STATE_LENGTH),
            timestamp: js_sys::Date::new_0().get_time(),
        };

        window
            .local_storage()
            .unwrap()
            .unwrap()
            .set_item(STATE_KEY, &serde_json::to_string(&state).unwrap())
            .unwrap();

        let redirect = format!(
            "{}/api/auth/oauth/redirect?state={}",
            config.api_url, state.state
        );

        window.location().assign(&redirect).unwrap();
    }

    view! {}
}
