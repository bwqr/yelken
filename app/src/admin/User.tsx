import { createResource, createSignal, For, Match, onCleanup, Show, Suspense, Switch, useContext } from "solid-js";
import { AdminContext } from "../lib/admin/context";
import { A, useNavigate, useParams } from "@solidjs/router";
import { ArrowRight, FloppyFill, PlusLg, ThreeDotsVertical, Trash } from "../Icons";
import { AlertContext } from "../lib/context";
import { HttpError } from "../lib/api";
import { dropdownClickListener } from "../lib/utils";
import { Permission, UserState } from "../lib/admin/models";

export const CreateUser = () => {
    enum ValidationError {
        Name,
        Email,
        Password,
        PasswordMismatch,
    }

    const adminCtx = useContext(AdminContext)!;
    const alertCtx = useContext(AlertContext)!;
    const navigate = useNavigate();

    const [name, setName] = createSignal('');
    const [email, setEmail] = createSignal('');
    const [password, setPassword] = createSignal('');
    const [passwordConfirm, setPasswordConfirm] = createSignal('');

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

        if (name().trim().length === 0) {
            errors.add(ValidationError.Name);
        }

        if (email().trim().length === 0) {
            errors.add(ValidationError.Email);
        }

        if (password().trim().length === 0) {
            errors.add(ValidationError.Password);
        }

        if (passwordConfirm() !== password()) {
            errors.add(ValidationError.PasswordMismatch);
        }

        setValidationErrors(errors);

        if (errors.size > 0) {
            return;
        }

        setInProgress(true);

        adminCtx.createUser(name(), email(), password())
            .then(() => {
                alertCtx.success('User is created successfully');
                navigate('/users');
            })
            .catch((e) => {
                if (e instanceof HttpError) {
                    setServerError(e.error);
                } else {
                    alertCtx.fail(e.message);
                }
            })
            .finally(() => setInProgress(false));
    }

    return (
        <div class="container py-4 px-md-4">
            <div class="d-flex align-items-center mb-4">
                <h2>Create User</h2>
            </div>
            <div class="row m-0">
                <form class="offset-md-4 col-md-4 p-3 card" onSubmit={onSubmit}>
                    <div class="form-floating mb-4">
                        <input
                            id="userName"
                            type="text"
                            name="name"
                            placeholder="Name"
                            class="form-control"
                            classList={{ 'is-invalid': validationErrors().has(ValidationError.Name) }}
                            value={name()}
                            onChange={(ev) => setName(ev.target.value)}
                        />
                        <label for="userName" class="form-label">Name</label>
                        <Show when={validationErrors().has(ValidationError.Name)}>
                            <small class="invalid-feedback">Please specify a name for user.</small>
                        </Show>
                    </div>

                    <div class="form-floating mb-4">
                        <input
                            id="userEmail"
                            type="email"
                            name="name"
                            placeholder="Email"
                            class="form-control"
                            classList={{ 'is-invalid': validationErrors().has(ValidationError.Email) }}
                            value={email()}
                            onChange={(ev) => setEmail(ev.target.value)}
                        />
                        <label for="userEmail" class="form-label">Email</label>
                        <Show when={validationErrors().has(ValidationError.Email)}>
                            <small class="invalid-feedback">Please specify a email for user.</small>
                        </Show>
                    </div>

                    <div class="form-floating mb-4">
                        <input
                            id="userPassword"
                            type="password"
                            name="password"
                            placeholder="Name"
                            class="form-control"
                            classList={{ 'is-invalid': validationErrors().has(ValidationError.Password) }}
                            value={password()}
                            onChange={(ev) => setPassword(ev.target.value)}
                        />
                        <label for="userPassword" class="form-label">Password</label>
                        <Show when={validationErrors().has(ValidationError.Password)}>
                            <small class="invalid-feedback">Please specify a password for user.</small>
                        </Show>
                    </div>

                    <div class="form-floating mb-4">
                        <input
                            id="userPasswordConfirm"
                            type="password"
                            name="password"
                            placeholder="Name"
                            class="form-control"
                            classList={{ 'is-invalid': validationErrors().has(ValidationError.PasswordMismatch) }}
                            value={passwordConfirm()}
                            onChange={(ev) => setPasswordConfirm(ev.target.value)}
                        />
                        <label for="userPasswordConfirm" class="form-label">Password Confirm</label>
                        <Show when={validationErrors().has(ValidationError.PasswordMismatch)}>
                            <small class="invalid-feedback">Does not match the password.</small>
                        </Show>
                    </div>

                    <Show when={serverError()}>
                        <small class="text-danger mb-3">{serverError()}</small>
                    </Show>

                    <div class="d-flex justify-content-center">
                        <button type="submit" class="btn btn-primary icon-link justify-content-center mw-100" style="width: 250px;" disabled={inProgress()}>
                            <Show when={inProgress()}>
                                <div class="spinner-border" role="status">
                                    <span class="visually-hidden">Loading...</span>
                                </div>
                            </Show>
                            <PlusLg viewBox="0 0 16 16" />
                            Add
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export const User = () => {
    enum Action {
        Update,
        Delete,
    }

    const adminCtx = useContext(AdminContext)!;
    const alertCtx = useContext(AlertContext)!;
    const navigate = useNavigate();

    const params = useParams();

    const [permissions, setPermissions] = createSignal([] as Permission[]);
    const [role, setRole] = createSignal(undefined as number | undefined);
    const [userState, setUserState] = createSignal(undefined as UserState | undefined);

    const [inProgress, setInProgress] = createSignal(undefined as Action | undefined);

    const [dropdown, setDropdown] = createSignal(false);

    onCleanup(dropdownClickListener('user-detail-dropdown', () => setDropdown(false), () => inProgress() === undefined));

    const [userAndRoles] = createResource(() => Promise.all([adminCtx.fetchUser(params.username), adminCtx.fetchRoles()]).then(([user, roles]) => {
        setRole(user?.roleId ?? undefined);
        setPermissions(user?.permissions ?? []);
        setUserState(user?.state ?? undefined);

        return { user, roles };
    }));

    const save = () => {
        const user = userAndRoles()?.user;
        const roleId = role() ?? null;
        const state = userState()

        if (inProgress() !== undefined || !user || state === undefined) {
            return;
        }

        setInProgress(Action.Update);

        Promise.all([adminCtx.updateUserPermission(user.id, permissions()), adminCtx.updateUserRole(user.id, roleId), adminCtx.updateUserState(user.id, state)])
            .then(() => alertCtx.success(`User ${user.name} is updated successfully`))
            .catch((e) => alertCtx.fail(e.message))
            .finally(() => setInProgress(undefined));
    };

    const deleteUser = () => {
        const u = userAndRoles()?.user;

        if (inProgress() !== undefined || !u) {
            return;
        }

        setInProgress(Action.Delete);

        adminCtx.deleteUser(u.id)
            .then(() => {
                alertCtx.success('User is deleted successfully');
                navigate('/users');
            })
            .catch((e) => alertCtx.fail(e.message))
            .finally(() => setInProgress(undefined));
    };

    return (
        <div class="container py-4 px-md-4">
            <Suspense fallback={<p>Loading...</p>}>
                <div class="d-flex align-items-center mb-4">
                    <div class="flex-grow-1">
                        <h2 class="m-0">{userAndRoles()?.user?.name ?? '-'}</h2>
                        <small>Role</small>
                    </div>
                    <div class="dropdown">
                        <button class="btn icon-link ms-2" on:click={(ev) => { ev.stopPropagation(); setDropdown(!dropdown()); }}>
                            <ThreeDotsVertical viewBox="0 0 16 16" />
                        </button>
                        <Show when={dropdown()}>
                            <ul id="role-detail-dropdown" class="dropdown-menu mt-1 show shadow" style="right: 0;">
                                <li>
                                    <button class="dropdown-item text-danger icon-link py-2" onClick={deleteUser}>
                                        <Show when={inProgress() === Action.Delete}>
                                            <div class="spinner-border" role="status">
                                                <span class="visually-hidden">Loading...</span>
                                            </div>
                                        </Show>
                                        <Trash viewBox="0 0 16 16" />
                                        Delete
                                    </button>
                                </li>
                            </ul>
                        </Show>
                    </div>
                    <button class="btn btn-primary icon-link ms-2" onClick={save} disabled={inProgress() !== undefined}>
                        <Show when={inProgress() === Action.Update}>
                            <div class="spinner-border" role="status">
                                <span class="visually-hidden">Loading...</span>
                            </div>
                        </Show>
                        <FloppyFill viewBox="0 0 16 16" />
                        Save
                    </button>
                </div>
                <div class="row m-0">
                    <Switch>
                        <Match when={userAndRoles.state === 'ready' && userAndRoles()?.user === undefined}>
                            <span>Could not find the user with id {params.id}.</span>
                        </Match>
                        <Match when={userAndRoles()}>
                            {(userAndRoles) => (
                                <>
                                    <div class="offset-md-4 col-md-4 p-3 mb-4 card">
                                        <h5>Details</h5>

                                        <hr />

                                        <table>
                                            <tbody>
                                                <tr>
                                                    <td class="p-2">Name</td>
                                                    <td class="text-end">{userAndRoles().user!.name}</td>
                                                </tr>
                                                <tr>
                                                    <td class="p-2">Email</td>
                                                    <td class="text-end">{userAndRoles().user!.email}</td>
                                                </tr>
                                                <tr>
                                                    <td class="p-2">State</td>
                                                    <td class="text-end">
                                                        <select
                                                            class="form-select float-end"
                                                            style="width: unset;"
                                                            value={userState()}
                                                            onChange={(ev) => setUserState(ev.target.value as UserState)}
                                                        >
                                                            <For each={Object.entries(UserState)}>
                                                                {([name, value]) => (<option value={value}>{name}</option>)}
                                                            </For>
                                                        </select>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td class="p-2">Role</td>
                                                    <td>
                                                        <select
                                                            class="form-select float-end"
                                                            style="width: unset;"
                                                            value={role() ?? ''}
                                                            onChange={(ev) => setRole(isNaN(parseInt(ev.target.value)) ? undefined : parseInt(ev.target.value))}
                                                        >
                                                            <option value="">-- No role --</option>
                                                            <For each={userAndRoles().roles}>
                                                                {(role) => (<option value={role.id}>{role.name}</option>)}
                                                            </For>
                                                        </select>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>

                                    <div class="offset-md-4 col-md-4 p-3 card">
                                        <h5>Explicit Permissions</h5>

                                        <hr />

                                        <table>
                                            <tbody>
                                                <For each={Object.entries(Permission)}>
                                                    {([perm, value]) => (
                                                        <tr>
                                                            <td class="p-2">{perm}</td>
                                                            <td class="p-2 text-end">
                                                                <input
                                                                    class="form-check-input"
                                                                    type="checkbox"
                                                                    checked={permissions().includes(value)}
                                                                    onChange={() => setPermissions(permissions().includes(value) ? permissions().filter((p) => p !== value) : [...permissions(), value])}
                                                                />
                                                            </td>
                                                        </tr>
                                                    )}
                                                </For>
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}
                        </Match>
                    </Switch>
                </div>
            </Suspense>
        </div>
    );
};

export const Users = () => {
    const adminCtx = useContext(AdminContext)!;
    const [usersAndRoles] = createResource(() => Promise.all([adminCtx.fetchUsers(), adminCtx.fetchRoles()]).then(([users, roles]) => ({ users, roles })));

    return (
        <div class="container py-4 px-md-4">
            <div class="d-flex align-items-center mb-4">
                <div class="flex-grow-1">
                    <h1>Users</h1>
                </div>
                <A class="btn btn-outline-primary icon-link" href="/users/create">
                    <PlusLg viewBox="0 0 16 16" />
                    Add User
                </A>
            </div>

            <div class="row m-0">
                <Suspense>
                    <Switch>
                        <Match when={usersAndRoles.error}>
                            <span>Error: {usersAndRoles.error.message}</span>
                        </Match>
                        <Match when={usersAndRoles()}>
                            {(usersAndRoles) => (
                                <div class="offset-md-4 col-md-4 card p-3">
                                    <Show when={usersAndRoles().users.length > 0} fallback={<p class="m-0">No users exists yet.</p>}>
                                        <table class="table table-hover m-0">
                                            <thead>
                                                <tr>
                                                    <th scope="col">Name</th>
                                                    <th scope="col">Role</th>
                                                    <th scope="col"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <For each={usersAndRoles().users}>
                                                    {(user) => (
                                                        <tr>
                                                            <td>{user.name}</td>
                                                            <td>{usersAndRoles().roles.find((r) => r.id === user.roleId)?.name ?? '-'}</td>
                                                            <td class="text-end">
                                                                <A href={`/users/view/${user.username}`} class="icon-link">
                                                                    Details
                                                                    <ArrowRight viewBox="0 0 16 16" />
                                                                </A>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </For>
                                            </tbody>
                                        </table>
                                    </Show>
                                </div>
                            )}
                        </Match>
                    </Switch>
                </Suspense>
            </div>
        </div>
    );
};
