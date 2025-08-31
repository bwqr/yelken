import { createSignal, Show, useContext } from "solid-js";
import { Api, HttpError } from "../../lib/api";
import config from "../../lib/config";
import { LocaleContext } from "../../lib/i18n";
import { AlertContext } from "../../lib/alert";
import ProgressSpinner from "../../components/ProgressSpinner";

export default function() {
    enum ValidationError {
        Email,
        Password,
    }

    const alertCtx = useContext(AlertContext)!;
    const localeCtx = useContext(LocaleContext)!;
    const i18n = localeCtx.i18n.auth.login;

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
        const req = {
            email: email().trim(),
            password: password().trim(),
        }

        if (req.email.length === 0) {
            errors.add(ValidationError.Email);
        }

        if (req.password.length === 0) {
            errors.add(ValidationError.Password);
        }

        setValidationErrors(errors);

        if (errors.size > 0) {
            return;
        }

        setInProgress(true);

        Api.post<{ email: string; password: string }, { token: string }>(
            '/auth/login',
            req
        )
            .then((token) => {
                localStorage.setItem('token', token.token);

                window.location.assign(config.baseURL);
            })
            .catch((e) => {
                const msg = e.message in i18n.serverErrors ? i18n.serverErrors[e.message as keyof typeof i18n.serverErrors] : e.message;

                if (e instanceof HttpError) {
                    setServerError(msg);
                } else {
                    alertCtx.fail(msg);
                }
            })
            .finally(() => setInProgress(false));
    };

    return (
        <div class="container-fluid w-100">
            <div class="row">
                <div class="col-lg-6 d-flex flex-column justify-content-center align-items-center" style="min-height: 100vh">
                    <form id="auth-form" onSubmit={onSubmit}>
                        <div class="mb-4 text-center">
                            <h3>{i18n.title()}</h3>
                            <small class="text-secondary">{i18n.subtitle()}.</small>
                        </div>
                        <div class="mb-4">
                            <label for="login-email" class="mb-2">{i18n.email()}</label>
                            <input
                                id="login-email"
                                type="email"
                                class="form-control"
                                classList={{ 'is-invalid': validationErrors().has(ValidationError.Email) }}
                                placeholder={i18n.email()}
                                name="email"
                                value={email()}
                                onInput={(e) => setEmail(e.target.value)}
                            />
                            <Show when={validationErrors().has(ValidationError.Email)}>
                                <small class="text-danger">{i18n.validationErrors.email()}.</small>
                            </Show>
                        </div>
                        <div class="form-group mb-4">
                            <label for="login-password" class="mb-2">{i18n.password()}</label>
                            <input
                                id="login-password"
                                type="password"
                                class="form-control"
                                classList={{ 'is-invalid': validationErrors().has(ValidationError.Password) }}
                                placeholder={i18n.password()}
                                name="password"
                                value={password()}
                                onInput={(e) => setPassword(e.target.value)}
                            />
                            <Show when={validationErrors().has(ValidationError.Password)}>
                                <small class="text-danger">{i18n.validationErrors.password()}.</small>
                            </Show>
                        </div>

                        <Show when={serverError()}>
                            <div class="mb-2">
                                <small class="text-danger">{serverError()}</small>
                            </div>
                        </Show>

                        <div>
                            <button
                                type="submit"
                                class="btn btn-primary icon-link justify-content-center w-100 py-2"
                                disabled={inProgress()}
                            >
                                <ProgressSpinner show={inProgress()} />
                                {i18n.login()}
                            </button>
                        </div>
                    </form>
                </div>
                <div class="col-lg-6 d-none d-lg-flex flex-column justify-content-center align-items-center" style="background: var(--custom-bg)">
                    <a class="py-3" rel="external" href="/">
                        <img class="img-fluid" src="/assets/images/logo-blue.png" width="160px" alt="Yelken" />
                    </a>
                    <div style="flex-grow: 1"></div>
                    <h2 class="text-primary mb-4">Yelken CMS</h2>
                    <p class="text-primary">{i18n.slogan()}.</p>
                    <div style="flex-grow: 2"></div>
                </div>
            </div>
        </div>
    );
};
