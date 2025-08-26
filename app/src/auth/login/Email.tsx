import { createSignal, Show, useContext } from "solid-js";
import { Api, HttpError } from "../../lib/api";
import config from "../../lib/config";
import { LocaleContext } from "../../lib/i18n";

export default function() {
    enum ValidationError {
        Email,
        Password,
    }

    const localeCtx = useContext(LocaleContext)!;

    const [email, setEmail] = createSignal('');
    const [password, setPassword] = createSignal('');

    const [inProgress, setInProgress] = createSignal(false);
    const [validationErrors, setValidationErrors] = createSignal(new Set<ValidationError>());
    const [serverError, setServerError] = createSignal(undefined as string | undefined);

    const onSubmit = (ev: SubmitEvent) => {
        ev.preventDefault();

        if (inProgress()) {
            return;
        }

        setServerError(undefined);

        const errors = new Set<ValidationError>();

        if (email().trim().length === 0) {
            errors.add(ValidationError.Email);
        }

        if (password().trim().length === 0) {
            errors.add(ValidationError.Password);
        }

        setValidationErrors(errors);

        if (errors.size > 0) {
            return;
        }

        setInProgress(true);

        Api.post<{ email: string; password: string }, { token: string }>(
            '/auth/login',
            { email: email(), password: password() }
        )
            .then((token) => {
                localStorage.setItem('token', token.token);

                window.location.assign(config.baseURL);
            })
            .catch((e) => {
                if (e instanceof HttpError) {
                    setServerError(e.error);
                } else {
                    throw e;
                }
            })
            .finally(() => setInProgress(false));
    }

    return (
        <div class="container-fluid w-100">
            <div class="row">
                <div class="col-lg-6 d-flex flex-column justify-content-center align-items-center" style="min-height: 100vh">
                    <form onSubmit={onSubmit} style="width: 28rem;">
                        <div class="mb-4 text-center">
                            <h3>Log into Yelken</h3>
                            <small class="text-secondary">Yelken CMS</small>
                        </div>
                        <div class="mb-4">
                            <label for="login-email" class="mb-2">Email</label>
                            <input
                                id="login-email"
                                type="email"
                                class="form-control"
                                classList={{ 'is-invalid': validationErrors().has(ValidationError.Email) }}
                                placeholder="Email"
                                name="email"
                                value={email()}
                                onInput={(e) => setEmail(e.target.value)}
                            />
                            <Show when={validationErrors().has(ValidationError.Email)}>
                                <small class="text-danger">Please enter your email</small>
                            </Show>
                        </div>
                        <div class="form-group mb-4">
                            <label for="login-password" class="mb-2">Password</label>
                            <input
                                id="login-password"
                                type="password"
                                class="form-control"
                                classList={{ 'is-invalid': validationErrors().has(ValidationError.Password) }}
                                placeholder="Password"
                                name="password"
                                value={password()}
                                onInput={(e) => setPassword(e.target.value)}
                            />
                            <Show when={validationErrors().has(ValidationError.Password)}>
                                <small class="text-danger">Please enter your password</small>
                            </Show>
                        </div>


                        <div>
                            <Show when={serverError()}>
                                <small class="text-danger">{serverError()}</small>
                            </Show>

                            <button
                                type="submit"
                                class="btn btn-primary icon-link justify-content-center w-100 py-2"
                                disabled={inProgress()}
                            >
                                <Show when={inProgress()}>
                                    <div class="spinner-border" role="status">
                                        <span class="visually-hidden">Loading...</span>
                                    </div>
                                </Show>
                                {localeCtx.i18n.auth.login.login()}
                            </button>
                        </div>
                    </form>
                </div>
                <div class="col-lg-6 d-none d-lg-flex flex-column justify-content-center align-items-center" style="background: var(--custom-bg)">
                    <a class="py-3" rel="external" href="/">
                        <img class="img-fluid" src="/assets/images/logo-blue.png" width="160px" alt="Yelken" />
                    </a>
                    <div style="flex-grow: 1"></div>
                    <h2 class="text-primary mb-4">Yelken</h2>
                    <p class="text-primary">Login to manage your site.</p>
                    <div style="flex-grow: 2"></div>
                </div>
            </div>
        </div>
    );
};
