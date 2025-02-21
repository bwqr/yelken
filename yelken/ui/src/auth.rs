use leptos::ev::SubmitEvent;
use leptos::prelude::*;
use leptos::task::spawn_local;
use leptos_router::components::*;
use leptos_router::path;

use shared::auth::Token;

use crate::Config;

#[cfg(not(feature = "web"))]
fn save_token_and_redirect(_base: &str, _token: &str) {
    unimplemented!();
}

#[cfg(feature = "web")]
fn save_token_and_redirect(base: &str, token: &str) {
    use wasm_bindgen::JsCast;

    let window = web_sys::window().unwrap();

    let week = 60 * 60 * 24 * 7;

    window
        .document()
        .unwrap()
        .dyn_ref::<web_sys::HtmlDocument>()
        .unwrap()
        .set_cookie(&format!(
            "yelken_token={}; SameSite=Strict; Path={}/; Max-Age={}",
            token, base, week
        ))
        .unwrap();

    window
        .local_storage()
        .unwrap()
        .unwrap()
        .set_item("token", token)
        .unwrap();

    web_sys::window()
        .unwrap()
        .location()
        .assign(&format!("{}/", base))
        .unwrap();
}

#[cfg(not(feature = "web"))]
async fn login(_api_url: &str, _email: String, _password: String) -> Result<Token, ()> {
    unimplemented!()
}

#[cfg(feature = "web")]
async fn login(api_url: &str, email: String, password: String) -> Result<Token, ()> {
    use shared::auth::Login;

    reqwest::Client::new()
        .post(format!("{}/api/auth/login", api_url))
        .json(&Login { email, password })
        .send()
        .await
        .map_err(|_| ())?
        .json()
        .await
        .map_err(|_| ())
}

#[derive(Clone, Debug, PartialEq)]
enum ValidationError {
    Email,
    Password,
}

#[component]
fn Login() -> impl IntoView {
    let config = expect_context::<Config>();

    let (email, set_email) = signal("".to_string());
    let (password, set_password) = signal("".to_string());

    let in_progress = RwSignal::new(false);

    let validation_errors = RwSignal::new(Vec::<ValidationError>::new());

    let on_submit = move |ev: SubmitEvent| {
        ev.prevent_default();

        if in_progress.get_untracked() {
            return;
        }

        validation_errors.set(vec![]);

        if email.read_untracked().trim().len() == 0 {
            validation_errors.update(|errors| errors.push(ValidationError::Email));
        }

        if password.read_untracked().trim().len() == 0 {
            validation_errors.update(|errors| errors.push(ValidationError::Password));
        }

        if validation_errors.read_untracked().len() > 0 {
            return;
        }

        in_progress.set(true);

        let config = config.clone();
        let email = email.get_untracked();
        let password = password.get_untracked();

        spawn_local(async move {
            match login(&config.api_url, email, password).await {
                Ok(token) => save_token_and_redirect(&config.base, &token.token),
                Err(e) => log::error!("Error is received, {e:?}"),
            };

            in_progress.set(false);
        });
    };

    view! {
        <div class="container-fluid">
            <div class="row">
                <div class="d-none col-md-4 vh-100 d-md-flex justify-content-center align-items-center bg-primary">
                    <div>
                        <h2 class="text-white">"Yelken"</h2>
                        <p class="text-white">"Login to manage your site"</p>
                    </div>
                </div>
                <div class="col vh-100 d-flex justify-content-center align-items-center flex-column">
                    <h2 class="mb-2">"Login"</h2>
                    <form on:submit=on_submit>
                        <div class="form-group mb-4">
                            <label for="login-email" class="mb-1">"Email"</label>
                            <input
                                id="login-email"
                                type="email"
                                class="form-control"
                                placeholder="Email"
                                name="email"
                                bind:value=(email, set_email)
                            />
                            <Show when=move || { validation_errors.read().contains(&ValidationError::Email) }>
                                <small class="text-danger">"Please enter your email"</small>
                            </Show>
                        </div>
                        <div class="form-group mb-4">
                            <label for="login-password" class="mb-1">"Password"</label>
                            <input
                                id="login-password"
                                type="password"
                                class="form-control"
                                placeholder="Password"
                                name="password"
                                bind:value=(password, set_password)
                            />
                            <Show when=move || { validation_errors.read().contains(&ValidationError::Password) }>
                                <small class="text-danger">"Please enter your password"</small>
                            </Show>
                        </div>
                        <button
                            type="submit"
                            class="btn btn-primary w-100 form-group"
                            disabled=in_progress
                        >
                            "Login"
                        </button>
                    </form>
                </div>
            </div>
        </div>
    }
}

#[component]
pub fn Auth(config: Config) -> impl IntoView {
    let base = format!("{}/auth", config.base);

    provide_context(config);

    view! {
        <Router base>
            <Routes fallback=|| "Auth route not found.">
                <Route path=path!("login") view=Login/>
            </Routes>
        </Router>
    }
}
