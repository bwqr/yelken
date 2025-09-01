import { createEffect, createResource, createSignal, For, Match, onCleanup, Show, Switch, useContext } from "solid-js";
import { AdminContext } from "../lib/admin/context";
import { A, useNavigate, useParams } from "@solidjs/router";
import { FloppyFill, PencilSquare, PlusLg, ThreeDotsVertical, Trash } from "../Icons";
import { AlertContext } from "../lib/alert";
import { HttpError } from "../lib/api";
import { dropdownClickListener } from "../lib/utils";
import { type User as UserModel } from "../lib/admin/models";
import ProgressSpinner from "../components/ProgressSpinner";
import { createStore } from "solid-js/store";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import { UserState } from "../lib/user/models";
import { Permission } from "../lib/models";
import { LocaleContext } from "../lib/i18n";

export const CreateUser = () => {
    enum ValidationError {
        Name,
        Email,
        Password,
        PasswordMismatch,
    }

    const adminCtx = useContext(AdminContext)!;
    const alertCtx = useContext(AlertContext)!;
    const localeCtx = useContext(LocaleContext)!;
    const navigate = useNavigate();

    const i18n = localeCtx.i18n.user;

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
                alertCtx.success(i18n.actions.userCreated(req.name));

                navigate(`/users/view/${user.username}`, { replace: true });
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
    }

    return (
        <div class="container py-4 px-md-4">
            <h2 class="mb-5">{i18n.actions.createUser()}</h2>

            <div class="row">
                <form class="offset-md-4 col-md-4" onSubmit={onSubmit}>
                    <div class="border rounded p-3">
                        <div class="mb-4">
                            <label for="userName" class="form-label">{localeCtx.i18n.common.labels.name()}</label>
                            <input
                                id="userName"
                                type="text"
                                name="name"
                                placeholder={localeCtx.i18n.common.labels.name()}
                                class="form-control"
                                classList={{ 'is-invalid': validationErrors().has(ValidationError.Name) }}
                                value={name()}
                                onChange={(ev) => setName(ev.target.value)}
                            />
                            <Show when={validationErrors().has(ValidationError.Name)}>
                                <small class="invalid-feedback">{i18n.validationErrors.name()}.</small>
                            </Show>
                        </div>

                        <div class="mb-4">
                            <label for="userEmail" class="form-label">{i18n.labels.email()}</label>
                            <input
                                id="userEmail"
                                type="email"
                                name="email"
                                placeholder={i18n.labels.email()}
                                class="form-control"
                                classList={{ 'is-invalid': validationErrors().has(ValidationError.Email) }}
                                value={email()}
                                onChange={(ev) => setEmail(ev.target.value)}
                            />
                            <Show when={validationErrors().has(ValidationError.Email)}>
                                <small class="invalid-feedback">{i18n.validationErrors.email()}.</small>
                            </Show>
                        </div>

                        <div class="mb-4">
                            <label for="userPassword" class="form-label">{i18n.labels.password()}</label>
                            <input
                                id="userPassword"
                                type="password"
                                name="password"
                                placeholder={i18n.labels.password()}
                                class="form-control"
                                classList={{ 'is-invalid': validationErrors().has(ValidationError.Password) }}
                                value={password()}
                                onChange={(ev) => setPassword(ev.target.value)}
                            />
                            <Show when={validationErrors().has(ValidationError.Password)}>
                                <small class="invalid-feedback">{i18n.validationErrors.password()}.</small>
                            </Show>
                        </div>

                        <div class="mb-4">
                            <label for="userPasswordConfirm" class="form-label">{i18n.labels.passwordConfirm()}</label>
                            <input
                                id="userPasswordConfirm"
                                type="password"
                                name="password"
                                placeholder={i18n.labels.passwordConfirm()}
                                class="form-control"
                                classList={{ 'is-invalid': validationErrors().has(ValidationError.PasswordMismatch) }}
                                value={passwordConfirm()}
                                onChange={(ev) => setPasswordConfirm(ev.target.value)}
                            />
                            <Show when={validationErrors().has(ValidationError.PasswordMismatch)}>
                                <small class="invalid-feedback">{i18n.validationErrors.passwordConfirm()}.</small>
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
                                {localeCtx.i18n.common.actions.create()}
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
    const localeCtx = useContext(LocaleContext)!;
    const navigate = useNavigate();

    const i18n = localeCtx.i18n.user;

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

                alertCtx.success(i18n.actions.userUpdated(req.name))

                mutate({ ...u, name: req.name, state: req.state, roleId: req.roleId });
            })
            .catch((e) => alertCtx.fail(translateError(e.message)))
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

                alertCtx.success(i18n.actions.permissionsUpdated(u.name))

                mutate({ ...u, permissions: newPermissions });
            })
            .catch((e) => alertCtx.fail(translateError(e.message)))
            .finally(() => setInProgress(undefined));
    };

    const deleteUser = async (user: UserModel) => {
        return adminCtx.deleteUser(user.id)
            .then(() => {
                setDeleting(false);

                alertCtx.success(i18n.actions.userDeleted(user.name));

                navigate('/users', { replace: true });
            });
    };

    const translateError = (e: string) => {
        return (e in i18n.serverErrors)
            ? i18n.serverErrors[e as keyof typeof i18n.serverErrors]()
            : e;
    };

    return (
        <div class="container py-4 px-md-4">
            <Switch>
                <Match when={user.loading}>
                    <p class="icon-link justify-content-center w-100"><ProgressSpinner show={true} /> {localeCtx.i18n.common.loading()} ...</p>
                </Match>
                <Match when={user.error}>
                    <p class="text-danger-emphasis text-center">{localeCtx.i18n.common.loadingItemError(i18n.user())}: <strong>{user.error.message}</strong></p>
                </Match>
                <Match when={user.state === 'ready' && user() === undefined}>
                    <p class="text-secondary text-center">{i18n.userNotFound(params.username)}.</p>
                </Match>
                <Match when={user()}>
                    {(user) => (
                        <>
                            <div class="d-flex align-items-center mb-5">
                                <div class="flex-grow-1">
                                    <h2 class="m-0">{user().name}</h2>
                                    <small>{i18n.user()}</small>
                                </div>
                                <div class="dropdown">
                                    <button class="btn icon-link px-1" on:click={(ev) => { ev.stopPropagation(); setDropdown(!dropdown()); }}>
                                        <ThreeDotsVertical viewBox="0 0 16 16" />
                                    </button>
                                    <ul id="locale-detail-dropdown" class="dropdown-menu mt-1 shadow" style="right: 0;" classList={{ 'show': dropdown() }}>
                                        <li>
                                            <button class="dropdown-item text-danger icon-link py-2" onClick={() => setDeleting(true)}>
                                                <Trash viewBox="0 0 16 16" />
                                                {localeCtx.i18n.common.actions.delete()}
                                            </button>
                                        </li>
                                    </ul>
                                </div>
                            </div>

                            <div class="row g-4">
                                <div class="offset-md-1 col-md-4">
                                    <div class="border rounded p-3">
                                        <div class="d-flex justify-content-center">
                                            <h5 class="flex-grow-1 m-0">{localeCtx.i18n.common.labels.details()}</h5>
                                            <Show when={editingDetails()} fallback={
                                                <button type="button" class="btn icon-link py-0 px-1" onClick={() => setEditingDetails(true)}>
                                                    <PencilSquare viewBox="0 0 16 16" />
                                                    {localeCtx.i18n.common.actions.edit()}
                                                </button>
                                            }>
                                                <button
                                                    type="button"
                                                    class="btn text-danger icon-link py-0 px-1"
                                                    onClick={() => setEditingDetails(false)}
                                                >
                                                    {localeCtx.i18n.common.actions.discard()}
                                                </button>
                                                <button
                                                    type="button"
                                                    class="btn icon-link py-0 px-1 ms-2"
                                                    onClick={updateDetails}
                                                    disabled={inProgress() === Action.UpdateDetails}
                                                >
                                                    <ProgressSpinner show={inProgress() === Action.UpdateDetails} small={true} />
                                                    <FloppyFill viewBox="0 0 16 16" />
                                                    {localeCtx.i18n.common.actions.save()}
                                                </button>
                                            </Show>
                                        </div>

                                        <hr />

                                        <table class="table table-borderless w-100 m-0" style="table-layout: fixed;">
                                            <tbody>
                                                <tr>
                                                    <td style="width: 35%">{localeCtx.i18n.common.labels.name()}</td>
                                                    <td class="text-end" classList={{ 'py-1': editingDetails() }}>
                                                        <Show when={editingDetails()} fallback={user().name}>
                                                            <input
                                                                id="userName"
                                                                type="text"
                                                                class="form-control float-end"
                                                                classList={{ 'is-invalid': validationErrors().has(ValidationError.Name) }}
                                                                name="name"
                                                                value={details.name}
                                                                onInput={(ev) => setDetails('name', ev.target.value)}
                                                            />
                                                        </Show>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td>{i18n.labels.email()}</td>
                                                    <td class="text-end" classList={{ 'py-1': editingDetails() }}>
                                                        <Show when={editingDetails()} fallback={user().email}>
                                                            <input
                                                                id="userEmail"
                                                                type="email"
                                                                class="form-control float-end"
                                                                name="email"
                                                                value={user().email}
                                                                disabled
                                                            />
                                                        </Show>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td>{i18n.labels.state()}</td>
                                                    <td class="text-end" classList={{ 'py-1': editingDetails() }}>
                                                        <Show when={editingDetails()} fallback={i18n.userStates[user().state]()}>
                                                            <select
                                                                class="form-select float-end"
                                                                value={details.state}
                                                                onChange={(ev) => setDetails('state', ev.target.value as UserState)}
                                                            >
                                                                <For each={Object.values(UserState)}>
                                                                    {(state) => (<option value={state}>{i18n.userStates[state]()}</option>)}
                                                                </For>
                                                            </select>
                                                        </Show>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td>{localeCtx.i18n.role.role()}</td>
                                                    <td class="text-end" classList={{ 'py-1': editingDetails() }}>
                                                        <Switch>
                                                            <Match when={roles.loading}>
                                                                <p class="icon-link justify-content-end w-100 m-0"><ProgressSpinner show={true} /> {localeCtx.i18n.common.loadingItem(localeCtx.i18n.nav.links.roles())} ...</p>
                                                            </Match>
                                                            <Match when={roles.error}>
                                                                <p class="text-danger-emphasis text-end m-0">{localeCtx.i18n.common.loadingItemError(localeCtx.i18n.nav.links.roles())}: <strong>{roles.error.message}</strong></p>
                                                            </Match>
                                                            <Match when={roles()}>
                                                                {(roles) => (
                                                                    <Show when={editingDetails()} fallback={roles().find((r) => r.id === user().roleId)?.name ?? '-'}>
                                                                        <select
                                                                            class="form-select float-end"
                                                                            value={details.roleId ?? ''}
                                                                            onChange={(ev) => setDetails('roleId', isNaN(parseInt(ev.target.value)) ? null : parseInt(ev.target.value))}
                                                                        >
                                                                            <option value="">-- {i18n.labels.noRole()} --</option>
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
                                            <h5 class="flex-grow-1 m-0">{i18n.labels.additionalPerms()}</h5>
                                            <Show when={editingPermissions()} fallback={
                                                <button type="button" class="btn icon-link py-0 px-1" onClick={() => setEditingPermissions(true)}>
                                                    <PencilSquare viewBox="0 0 16 16" />
                                                    {localeCtx.i18n.common.actions.edit()}
                                                </button>
                                            }>
                                                <button
                                                    type="button"
                                                    class="btn text-danger icon-link py-0 px-1"
                                                    onClick={() => setEditingPermissions(false)}
                                                >
                                                    {localeCtx.i18n.common.actions.discard()}
                                                </button>
                                                <button
                                                    type="button"
                                                    class="btn icon-link py-0 px-1 ms-2"
                                                    onClick={updatePermissions}
                                                    disabled={inProgress() === Action.UpdatePermissions}
                                                >
                                                    <ProgressSpinner show={inProgress() === Action.UpdatePermissions} small={true} />
                                                    <FloppyFill viewBox="0 0 16 16" />
                                                    {localeCtx.i18n.common.actions.save()}
                                                </button>
                                            </Show>
                                        </div>

                                        <hr />

                                        <table class="table w-100 m-0">
                                            <tbody>
                                                <For each={Object.values(Permission)}>
                                                    {(perm) => (
                                                        <tr>
                                                            <td><label for={`perm-${perm}`}>{localeCtx.i18n.role.permissions[perm]()}</label></td>
                                                            <td class="text-end">
                                                                <input
                                                                    id={`perm-${perm}`}
                                                                    class="form-check-input"
                                                                    type="checkbox"
                                                                    checked={editingPermissions() ? permissions[perm] : user().permissions.includes(perm)}
                                                                    onChange={() => setPermissions(perm, !permissions[perm])}
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
                                    message={<p>{i18n.actions.confirmDelete(user().name, user().username)}?</p>}
                                    close={() => setDeleting(false)}
                                    confirm={() => deleteUser(user())}
                                    translateError={translateError}
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
    const localeCtx = useContext(LocaleContext)!;

    const i18n = localeCtx.i18n.user;

    const [usersAndRoles] = createResource(() => Promise.all([adminCtx.fetchUsers(), adminCtx.fetchRoles()]).then(([users, roles]) => ({ users, roles })));

    return (
        <div class="container py-4 px-md-4">
            <div class="d-flex align-items-center mb-5">
                <h1 class="flex-grow-1 m-0">{i18n.users()}</h1>
                <A class="btn btn-outline-primary icon-link" href="/users/create">
                    <PlusLg viewBox="0 0 16 16" />
                    {i18n.actions.createUser()}
                </A>
            </div>

            <Switch>
                <Match when={usersAndRoles.loading}>
                    <p class="icon-link justify-content-center w-100"><ProgressSpinner show={true} /> {localeCtx.i18n.common.loading()} ...</p>
                </Match>
                <Match when={usersAndRoles.error}>
                    <p class="text-danger-emphasis text-center">{localeCtx.i18n.common.loadingItemError(i18n.users())}: <strong>{usersAndRoles.error.message}</strong></p>
                </Match>
                <Match when={usersAndRoles()?.users.length === 0}>
                    <p class="text-secondary text-center">{i18n.noUser()}.</p>
                </Match>
                <Match when={usersAndRoles()}>
                    {(usersAndRoles) => (
                        <div class="row">
                            <div class="offset-md-4 col-md-4">
                                <table class="table table-hover border shadow-sm">
                                    <thead>
                                        <tr>
                                            <th></th>
                                            <th scope="col">{localeCtx.i18n.common.labels.name()}</th>
                                            <th scope="col">{localeCtx.i18n.role.role()}</th>
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
                                                            <span class="badge border rounded-pill border-danger text-danger ms-2">{localeCtx.i18n.common.labels.disabled()}</span>
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
