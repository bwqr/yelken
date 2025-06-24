import { createEffect, createResource, createSignal, For, Match, onCleanup, Show, Switch, useContext } from "solid-js";
import { AdminContext } from "../lib/admin/context";
import { A, useNavigate, useParams } from "@solidjs/router";
import { FloppyFill, PencilSquare, PlusLg, ThreeDotsVertical, Trash } from "../Icons";
import { AlertContext } from "../lib/context";
import { HttpError } from "../lib/api";
import { dropdownClickListener } from "../lib/utils";
import { Permission, type User as UserModel } from "../lib/admin/models";
import ProgressSpinner from "../components/ProgressSpinner";
import { createStore } from "solid-js/store";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import { UserState } from "../lib/user/models";

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
        const req = { name: name().trim(), email: email().trim(), password: password() };

        if (req.name.length === 0) {
            errors.add(ValidationError.Name);
        }

        if (req.email.length === 0) {
            errors.add(ValidationError.Email);
        }

        if (req.password.length === 0) {
            errors.add(ValidationError.Password);
        }

        if (passwordConfirm() !== req.password) {
            errors.add(ValidationError.PasswordMismatch);
        }

        setValidationErrors(errors);

        if (errors.size > 0) {
            return;
        }

        setInProgress(true);

        adminCtx.createUser(req)
            .then((user) => {
                alertCtx.success(`User "${req.name}" is created successfully`);

                navigate(`/users/view/${user.username}`, { replace: true });
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
            <h2 class="mb-5">Create User</h2>

            <div class="row">
                <form class="offset-md-4 col-md-4" onSubmit={onSubmit}>
                    <div class="border rounded p-3">
                        <div class="mb-4">
                            <label for="userName" class="form-label">Name</label>
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
                            <Show when={validationErrors().has(ValidationError.Name)}>
                                <small class="invalid-feedback">Please specify a name for user.</small>
                            </Show>
                        </div>

                        <div class="mb-4">
                            <label for="userEmail" class="form-label">Email</label>
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
                            <Show when={validationErrors().has(ValidationError.Email)}>
                                <small class="invalid-feedback">Please specify a email for user.</small>
                            </Show>
                        </div>

                        <div class="mb-4">
                            <label for="userPassword" class="form-label">Password</label>
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
                            <Show when={validationErrors().has(ValidationError.Password)}>
                                <small class="invalid-feedback">Please specify a password for user.</small>
                            </Show>
                        </div>

                        <div class="mb-4">
                            <label for="userPasswordConfirm" class="form-label">Password Confirm</label>
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
                            <Show when={validationErrors().has(ValidationError.PasswordMismatch)}>
                                <small class="invalid-feedback">Does not match the password.</small>
                            </Show>
                        </div>

                        <Show when={serverError()}>
                            <div class="mb-2">
                                <small class="text-danger">{serverError()}</small>
                            </div>
                        </Show>

                        <div class="d-flex justify-content-center">
                            <button
                                type="submit"
                                class="btn btn-primary icon-link justify-content-center w-100"
                                style="max-width: 10rem;"
                                disabled={inProgress()}
                            >
                                <ProgressSpinner show={inProgress()} />
                                <PlusLg viewBox="0 0 16 16" />
                                Add
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export const User = () => {
    enum Action {
        UpdateDetails,
        UpdatePermissions,
    }

    enum ValidationError {
        Name,
    }

    const adminCtx = useContext(AdminContext)!;
    const alertCtx = useContext(AlertContext)!;
    const navigate = useNavigate();

    const params = useParams();

    const [user, { mutate }] = createResource(() => params.username, (username) => adminCtx.fetchUser(username));
    const [roles] = createResource(() => adminCtx.fetchRoles());

    const [details, setDetails] = createStore({ name: '', state: UserState.Enabled, roleId: null as number | null });
    const [editingDetails, setEditingDetails] = createSignal(false);

    const [permissions, setPermissions] = createStore(
        Object.values(Permission)
            .reduce(
                (perms, perm) => {
                    perms[perm] = false;
                    return perms;
                },
                {} as Record<Permission, boolean>
            )
    );
    const [editingPermissions, setEditingPermissions] = createSignal(false);

    createEffect(() => {
        const u = user();

        setDetails({ name: u?.name ?? '', state: u?.state ?? UserState.Enabled, roleId: u?.roleId ?? null })

        setPermissions(
            Object.values(Permission)
                .reduce(
                    (perms, perm) => {
                        perms[perm] = u?.permissions.includes(perm) ?? false;

                        return perms;
                    },
                    {} as Record<Permission, boolean>
                )
        );
    })

    const [inProgress, setInProgress] = createSignal(undefined as Action | undefined);

    const [deleting, setDeleting] = createSignal(false);

    const [dropdown, setDropdown] = createSignal(false);
    onCleanup(dropdownClickListener('user-detail-dropdown', () => setDropdown(false), () => !deleting()));

    const [validationErrors, setValidationErrors] = createSignal(new Set<ValidationError>());

    const updateDetails = () => {
        const u = user();

        if (inProgress() !== undefined || !u) {
            return;
        }

        const errors = new Set<ValidationError>();
        const req = { name: details.name.trim(), state: details.state, roleId: details.roleId };

        if (req.name.length === 0) {
            errors.add(ValidationError.Name);
        }

        setValidationErrors(errors);

        if (errors.size > 0) {
            return;
        }

        setInProgress(Action.UpdateDetails);

        adminCtx.updateUser(u.id, req)
            .then(() => {
                setEditingDetails(false);

                alertCtx.success(`User "${req.name}" is updated successfully`)

                mutate({ ...u, name: req.name, state: req.state, roleId: req.roleId });
            })
            .catch((e) => alertCtx.fail(e.message))
            .finally(() => setInProgress(undefined));
    };

    const updatePermissions = () => {
        const u = user();

        if (inProgress() !== undefined || !u) {
            return;
        }

        setInProgress(Action.UpdatePermissions);

        const newPermissions = Object.entries(permissions).filter(([_, value]) => value).map(([perm, _]) => perm as Permission);

        adminCtx.updateUserPermission(u.id, newPermissions)
            .then(() => {
                setEditingPermissions(false);

                alertCtx.success(`Permissions of "${u.name}" user are updated successfully`)

                mutate({ ...u, permissions: newPermissions });
            })
            .catch((e) => alertCtx.fail(e.message))
            .finally(() => setInProgress(undefined));
    };

    const deleteUser = async (user: UserModel) => {
        return adminCtx.deleteUser(user.id)
            .then(() => {
                setDeleting(false);

                alertCtx.success(`User "${user.name}" is deleted successfully`);

                navigate('/users', { replace: true });
            });
    };

    return (
        <div class="container py-4 px-md-4">
            <Switch>
                <Match when={user.loading}>
                    <p class="icon-link justify-content-center w-100"><ProgressSpinner show={true} /> Loading ...</p>
                </Match>
                <Match when={user.error}>
                    <p class="text-danger-emphasis text-center">Error while fetching user: <strong>{user.error.message}</strong></p>
                </Match>
                <Match when={user.state === 'ready' && user() === undefined}>
                    <p class="text-secondary text-center">Could not find the user with username {params.username}.</p>
                </Match>
                <Match when={user()}>
                    {(user) => (
                        <>
                            <div class="d-flex align-items-center mb-5">
                                <div class="flex-grow-1">
                                    <h2 class="m-0">{user().name}</h2>
                                    <small>User</small>
                                </div>
                                <div class="dropdown">
                                    <button class="btn icon-link px-1" on:click={(ev) => { ev.stopPropagation(); setDropdown(!dropdown()); }}>
                                        <ThreeDotsVertical viewBox="0 0 16 16" />
                                    </button>
                                    <ul id="locale-detail-dropdown" class="dropdown-menu mt-1 shadow" style="right: 0;" classList={{ 'show': dropdown() }}>
                                        <li>
                                            <button class="dropdown-item text-danger icon-link py-2" onClick={() => setDeleting(true)}>
                                                <Trash viewBox="0 0 16 16" />
                                                Delete
                                            </button>
                                        </li>
                                    </ul>
                                </div>
                            </div>

                            <div class="row g-4">
                                <div class="offset-md-1 col-md-4">
                                    <div class="border rounded p-3">
                                        <div class="d-flex justify-content-center">
                                            <h5 class="flex-grow-1 m-0">Details</h5>
                                            <Show when={editingDetails()} fallback={
                                                <button type="button" class="btn icon-link py-0 px-1" onClick={() => setEditingDetails(true)}>
                                                    <PencilSquare viewBox="0 0 16 16" />
                                                    Edit
                                                </button>
                                            }>
                                                <button
                                                    type="button"
                                                    class="btn text-danger icon-link py-0 px-1"
                                                    onClick={() => setEditingDetails(false)}
                                                >
                                                    Discard
                                                </button>
                                                <button
                                                    type="button"
                                                    class="btn icon-link py-0 px-1 ms-2"
                                                    onClick={updateDetails}
                                                    disabled={inProgress() === Action.UpdateDetails}
                                                >
                                                    <ProgressSpinner show={inProgress() === Action.UpdateDetails} small={true} />
                                                    <FloppyFill viewBox="0 0 16 16" />
                                                    Save
                                                </button>
                                            </Show>
                                        </div>

                                        <hr />

                                        <table class="table table-borderless w-100 m-0" style="table-layout: fixed;">
                                            <tbody>
                                                <tr>
                                                    <td style="width: 25%">Name</td>
                                                    <td class="text-end" classList={{ 'py-1': editingDetails() }}>
                                                        <Show when={editingDetails()} fallback={user().name}>
                                                            <input
                                                                id="userName"
                                                                type="text"
                                                                class="form-control float-end w-auto"
                                                                classList={{ 'is-invalid': validationErrors().has(ValidationError.Name) }}
                                                                name="name"
                                                                value={details.name}
                                                                onInput={(ev) => setDetails('name', ev.target.value)}
                                                            />
                                                        </Show>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td>Email</td>
                                                    <td class="text-end" classList={{ 'py-1': editingDetails() }}>
                                                        <Show when={editingDetails()} fallback={user().email}>
                                                            <input
                                                                id="userEmail"
                                                                type="email"
                                                                class="form-control float-end w-auto"
                                                                name="email"
                                                                value={user().email}
                                                                disabled={true}
                                                            />
                                                        </Show>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td>State</td>
                                                    <td class="text-end" classList={{ 'py-1': editingDetails() }}>
                                                        <Show when={editingDetails()} fallback={user().state}>
                                                            <select
                                                                class="form-select float-end"
                                                                style="width: unset;"
                                                                value={details.state}
                                                                onChange={(ev) => setDetails('state', ev.target.value as UserState)}
                                                            >
                                                                <For each={Object.entries(UserState)}>
                                                                    {([name, value]) => (<option value={value}>{name}</option>)}
                                                                </For>
                                                            </select>
                                                        </Show>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td>Role</td>
                                                    <td class="text-end" classList={{ 'py-1': editingDetails() }}>
                                                        <Switch>
                                                            <Match when={roles.loading}>
                                                                <p class="icon-link justify-content-end w-100 m-0"><ProgressSpinner show={true} /> Loading Roles ...</p>
                                                            </Match>
                                                            <Match when={roles.error}>
                                                                <p class="text-danger-emphasis text-end m-0">Error while fetching roles: <strong>{roles.error.message}</strong></p>
                                                            </Match>
                                                            <Match when={roles()}>
                                                                {(roles) => (
                                                                    <Show when={editingDetails()} fallback={roles().find((r) => r.id === user().roleId)?.name ?? '-'}>
                                                                        <select
                                                                            class="form-select float-end"
                                                                            style="width: unset;"
                                                                            value={details.roleId ?? ''}
                                                                            onChange={(ev) => setDetails('roleId', isNaN(parseInt(ev.target.value)) ? null : parseInt(ev.target.value))}
                                                                        >
                                                                            <option value="">-- No role --</option>
                                                                            <For each={roles()}>
                                                                                {(role) => (<option value={role.id}>{role.name}</option>)}
                                                                            </For>
                                                                        </select>
                                                                    </Show>
                                                                )}
                                                            </Match>
                                                        </Switch>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div class="offset-md-1 col-md-5">
                                    <div class="border rounded p-3">
                                        <div class="d-flex align-items-center">
                                            <h5 class="flex-grow-1 m-0">Explicit Permissions</h5>
                                            <Show when={editingPermissions()} fallback={
                                                <button type="button" class="btn icon-link py-0 px-1" onClick={() => setEditingPermissions(true)}>
                                                    <PencilSquare viewBox="0 0 16 16" />
                                                    Edit
                                                </button>
                                            }>
                                                <button
                                                    type="button"
                                                    class="btn text-danger icon-link py-0 px-1"
                                                    onClick={() => setEditingPermissions(false)}
                                                >
                                                    Discard
                                                </button>
                                                <button
                                                    type="button"
                                                    class="btn icon-link py-0 px-1 ms-2"
                                                    onClick={updatePermissions}
                                                    disabled={inProgress() === Action.UpdatePermissions}
                                                >
                                                    <ProgressSpinner show={inProgress() === Action.UpdatePermissions} small={true} />
                                                    <FloppyFill viewBox="0 0 16 16" />
                                                    Save
                                                </button>
                                            </Show>
                                        </div>

                                        <hr />

                                        <table class="table w-100 m-0">
                                            <tbody>
                                                <For each={Object.entries(Permission)}>
                                                    {([perm, value]) => (
                                                        <tr>
                                                            <td>{perm}</td>
                                                            <td class="text-end">
                                                                <input
                                                                    class="form-check-input"
                                                                    type="checkbox"
                                                                    checked={editingPermissions() ? permissions[value] : user().permissions.includes(value)}
                                                                    onChange={() => setPermissions(value, !permissions[value])}
                                                                    disabled={!editingPermissions()}
                                                                />
                                                            </td>
                                                        </tr>
                                                    )}
                                                </For>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                            <Show when={deleting()}>
                                <DeleteConfirmModal
                                    message={<p>Are you sure about deleting the user <strong>{user().name} ({user().username})</strong>?</p>}
                                    close={() => setDeleting(false)}
                                    confirm={() => deleteUser(user())}
                                />
                            </Show>
                        </>
                    )}
                </Match>
            </Switch>
        </div>
    );
};

export const Users = () => {
    const adminCtx = useContext(AdminContext)!;

    const [usersAndRoles] = createResource(() => Promise.all([adminCtx.fetchUsers(), adminCtx.fetchRoles()]).then(([users, roles]) => ({ users, roles })));

    return (
        <div class="container py-4 px-md-4">
            <div class="d-flex align-items-center mb-5">
                <h1 class="flex-grow-1 m-0">Users</h1>
                <A class="btn btn-outline-primary icon-link" href="/users/create">
                    <PlusLg viewBox="0 0 16 16" />
                    Add User
                </A>
            </div>

            <Switch>
                <Match when={usersAndRoles.loading}>
                    <p class="icon-link justify-content-center w-100"><ProgressSpinner show={true} /> Loading ...</p>
                </Match>
                <Match when={usersAndRoles.error}>
                    <p class="text-danger-emphasis text-center">Error while fetching users: <strong>{usersAndRoles.error.message}</strong></p>
                </Match>
                <Match when={usersAndRoles()?.users.length === 0}>
                    <p class="text-secondary text-center">There is no user to display yet. You can create a new one by using <strong>Create User</strong> button.</p>
                </Match>
                <Match when={usersAndRoles()}>
                    {(usersAndRoles) => (
                        <div class="row">
                            <div class="offset-md-4 col-md-4">
                                <table class="table table-hover border shadow-sm">
                                    <thead>
                                        <tr>
                                            <th></th>
                                            <th scope="col">Name</th>
                                            <th scope="col">Role</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <For each={usersAndRoles().users}>
                                            {(user) => (
                                                <tr>
                                                    <td></td>
                                                    <td>
                                                        <A href={`/users/view/${user.username}`} class="icon-link">{user.name}</A>
                                                    </td>
                                                    <td>{usersAndRoles().roles.find((r) => r.id === user.roleId)?.name ?? '-'}</td>
                                                    <td>
                                                        <Show when={user.state === UserState.Disabled}>
                                                            <span class="badge border rounded-pill border-danger text-danger ms-2">Disabled</span>
                                                        </Show>
                                                    </td>
                                                </tr>
                                            )}
                                        </For>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </Match>
            </Switch>
        </div>
    );
};
