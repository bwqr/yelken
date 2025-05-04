import { createSignal, Show } from "solid-js";
import { Api, HttpError } from "../../api";
import * as config from "../../config";

export default function() {
    enum ValidationError {
        Email,
        Password,
    }

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
            .then(token => {
                localStorage.setItem('token', token.token);

                window.location.assign(config.BASE_URL);
            })
            .catch(e => {
                if (e instanceof HttpError) {
                    setServerError(e.error);
                } else {
                    throw e;
                }
            })
            .finally(() => setInProgress(false));
    }

    return (
        <div class="container-fluid">
            <div class="row">
                <div class="d-none col-md-4 vh-100 d-md-flex justify-content-center align-items-center bg-primary">
                    <div>
                        <h2 class="text-white">Yelken</h2>
                        <p class="text-white">Login to manage your site</p>
                    </div>
                </div>
                <div class="col vh-100 d-flex justify-content-center align-items-center flex-column">
                    <h2 class="mb-2">Login</h2>
                    <form onSubmit={onSubmit}>
                        <div class="form-group mb-4">
                            <label for="login-email" class="mb-1">Email</label>
                            <input
                                id="login-email"
                                type="email"
                                class="form-control"
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
                            <label for="login-password" class="mb-1">Password</label>
                            <input
                                id="login-password"
                                type="password"
                                class="form-control"
                                placeholder="Password"
                                name="password"
                                value={password()}
                                onInput={(e) => setPassword(e.target.value)}
                            />
                            <Show when={validationErrors().has(ValidationError.Password)}>
                                <small class="text-danger">Please enter your password</small>
                            </Show>
                        </div>

                        <Show when={serverError()}>
                            <small class="text-danger">{serverError()}</small>
                        </Show>

                        <button
                            type="submit"
                            class="btn btn-primary w-100 form-group"
                            disabled={inProgress()}
                        >
                            Login
                        </button>
                    </form>
                </div >
            </div >
        </div >
    );
};
