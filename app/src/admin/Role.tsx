import { A, useNavigate, useParams } from "@solidjs/router";
import { FloppyFill, PencilSquare, PlusLg, ThreeDotsVertical, Trash } from "../Icons";
import { createEffect, createResource, createSignal, For, Match, onCleanup, Show, Switch, useContext } from "solid-js";
import { AdminContext } from "../lib/admin/context";
import { AlertContext } from "../lib/context";
import { HttpError } from "../lib/api";
import { type Role as RoleModel } from "../lib/admin/models";
import { dropdownClickListener } from "../lib/utils";
import ProgressSpinner from "../components/ProgressSpinner";
import { createStore } from "solid-js/store";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import { Permission } from "../lib/models";

export const CreateRole = () => {
    enum ValidationError {
        Name,
        Key,
    }

    const adminCtx = useContext(AdminContext)!;
    const alertCtx = useContext(AlertContext)!;
    const navigate = useNavigate();

    const [name, setName] = createSignal('');
    const [key, setKey] = createSignal('');
    const [desc, setDesc] = createSignal('');

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
        const req = { name: name().trim(), key: key().trim(), desc: desc().trim() || null };

        if (req.name.length === 0) {
            errors.add(ValidationError.Name);
        }

        if (req.key.length === 0) {
            errors.add(ValidationError.Key);
        }

        setValidationErrors(errors);

        if (errors.size > 0) {
            return;
        }

        setInProgress(true);

        adminCtx.createRole(req)
            .then((role) => {
                alertCtx.success(`Role "${req.name}" is created successfully`);

                navigate(`/roles/view/${role.key}`, { replace: true });
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
            <h2 class="mb-5">Create Role</h2>
            <div class="row">
                <form class="offset-md-4 col-md-4" onSubmit={onSubmit}>
                    <div class="border rounded p-3">
                        <div class="mb-4">
                            <label for="roleName" class="form-label">Name</label>
                            <input
                                id="roleName"
                                type="text"
                                name="name"
                                placeholder="Name of role"
                                class="form-control"
                                classList={{ 'is-invalid': validationErrors().has(ValidationError.Name) }}
                                value={name()}
                                onChange={(ev) => setName(ev.target.value)}
                            />
                            <Show when={validationErrors().has(ValidationError.Name)}>
                                <small class="invalid-feedback">Please specify a name for role.</small>
                            </Show>
                        </div>
                        <div class="mb-4">
                            <label for="roleKey" class="form-label">Key</label>
                            <input
                                id="roleKey"
                                type="text"
                                name="key"
                                placeholder="Reference key"
                                class="form-control"
                                classList={{ 'is-invalid': validationErrors().has(ValidationError.Key) }}
                                value={key()}
                                onChange={(ev) => setKey(ev.target.value)}
                            />
                            <Show when={validationErrors().has(ValidationError.Key)}>
                                <small class="invalid-feedback">Please specify a key for role.</small>
                            </Show>
                        </div>
                        <div class="mb-4">
                            <label for="roleDesc" class="form-label">Description <small class="text-secondary">(optional)</small></label>
                            <textarea
                                id="roleDesc"
                                name="desc"
                                class="form-control"
                                rows="3"
                                value={desc()}
                                onChange={(ev) => setDesc(ev.target.value)}
                            ></textarea>
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
                                Create
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export const Role = () => {
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

    const [role, { mutate }] = createResource(() => params.key, (key) => adminCtx.fetchRole(key));

    const [inProgress, setInProgress] = createSignal(undefined as Action | undefined);

    const [details, setDetails] = createStore({ name: '', desc: '' });
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
        const r = role();

        setDetails({ name: r?.name, desc: r?.desc ?? '' })

        setPermissions(
            Object.values(Permission)
                .reduce(
                    (perms, perm) => {
                        perms[perm] = r?.permissions.includes(perm) ?? false;

                        return perms;
                    },
                    {} as Record<Permission, boolean>
                )
        );
    });

    const [deleting, setDeleting] = createSignal(false);

    const [dropdown, setDropdown] = createSignal(false);
    onCleanup(dropdownClickListener('role-detail-dropdown', () => setDropdown(false), () => !deleting()));

    const [validationErrors, setValidationErrors] = createSignal(new Set<ValidationError>());

    const updateDetails = () => {
        const r = role();

        if (inProgress() !== undefined || !r) {
            return;
        }

        const errors = new Set<ValidationError>();
        const req = { name: details.name.trim(), desc: details.desc.trim() || null };

        if (req.name.length === 0) {
            errors.add(ValidationError.Name);
        }

        setValidationErrors(errors);

        if (errors.size > 0) {
            return;
        }

        setInProgress(Action.UpdateDetails);

        adminCtx.updateRole(r.key, req)
            .then(() => {
                setEditingDetails(false);

                alertCtx.success(`Role "${req.name}" is updated successfully`)

                mutate({ ...r, name: req.name, desc: req.desc });
            })
            .catch((e) => alertCtx.fail(e.message))
            .finally(() => setInProgress(undefined));
    }

    const updatePermissions = () => {
        const r = role();

        if (inProgress() !== undefined || !r) {
            return;
        }

        setInProgress(Action.UpdatePermissions);

        const newPermissions = Object.entries(permissions).filter(([_, value]) => value).map(([perm, _]) => perm as Permission);

        adminCtx.updateRolePermission(r.id, newPermissions)
            .then(() => {
                setEditingPermissions(false);

                alertCtx.success(`Permissions of "${r.name}" role are updated successfully`)

                mutate({ ...r, permissions: newPermissions });
            })
            .catch((e) => alertCtx.fail(e.message))
            .finally(() => setInProgress(undefined));
    };

    const deleteRole = async (role: RoleModel) => {
        return adminCtx.deleteRole(role.key)
            .then(() => {
                setDeleting(false);

                alertCtx.success(`Role "${role.name}" is deleted successfully`);

                navigate('/roles', { replace: true });
            });
    };

    return (
        <div class="container py-4 px-md-4">
            <Switch>
                <Match when={role.loading}>
                    <p class="icon-link justify-content-center w-100"><ProgressSpinner show={true} /> Loading ...</p>
                </Match>
                <Match when={role.error}>
                    <p class="text-danger-emphasis text-center">Error while fetching role: <strong>{role.error.message}</strong></p>
                </Match>
                <Match when={role.state === 'ready' && role() === undefined}>
                    <p class="text-secondary text-center">Could not find the role with key {params.key}.</p>
                </Match>
                <Match when={role()}>
                    {(role) => (
                        <>
                            <div class="d-flex align-items-center mb-5">
                                <div class="flex-grow-1">
                                    <h2 class="m-0">{role().name}</h2>
                                    <small>Role</small>
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
                                                    <td style="width: 35%">Name</td>
                                                    <td class="text-end" classList={{ 'py-1': editingDetails() }}>
                                                        <Show when={editingDetails()} fallback={role().name}>
                                                            <input
                                                                id="roleName"
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
                                                    <td>Key</td>
                                                    <td class="text-end" classList={{ 'py-1': editingDetails() }}>
                                                        <Show when={editingDetails()} fallback={role().key}>
                                                            <input
                                                                id="roleKey"
                                                                type="text"
                                                                class="form-control float-end"
                                                                name="key"
                                                                value={role().key}
                                                                disabled
                                                            />
                                                        </Show>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td>Description</td>
                                                    <td class="text-end" classList={{ 'py-1': editingDetails() }}>
                                                        <Show when={editingDetails()} fallback={role().desc ?? '-'}>
                                                            <textarea
                                                                id="modelDesc"
                                                                class="form-control"
                                                                rows="2"
                                                                value={details.desc}
                                                                onInput={(ev) => setDetails('desc', ev.target.value)}
                                                            ></textarea>
                                                        </Show>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div class="offset-md-1 col-md-5">
                                    <div class="border rounded p-3">
                                        <div class="d-flex align-items-center">
                                            <h5 class="flex-grow-1 m-0">Permissions</h5>
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
                                                            <td><label for={`perm-${perm}`}>{perm}</label></td>
                                                            <td class="text-end">
                                                                <input
                                                                    id={`perm-${perm}`}
                                                                    class="form-check-input"
                                                                    type="checkbox"
                                                                    checked={editingPermissions() ? permissions[value] : role().permissions.includes(value)}
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
                                    message={<p>Are you sure about deleting the role <strong>{role().name}</strong>?</p>}
                                    close={() => setDeleting(false)}
                                    confirm={() => deleteRole(role())}
                                />
                            </Show>
                        </>
                    )}
                </Match>
            </Switch>
        </div>
    );
};

export const Roles = () => {
    const adminCtx = useContext(AdminContext)!;

    const [roles] = createResource(() => adminCtx.fetchRoles());

    return (
        <div class="container py-4 px-md-4">
            <div class="d-flex align-items-center mb-5">
                <h1 class="flex-grow-1 m-0">Roles</h1>
                <A class="btn btn-outline-primary icon-link" href="/roles/create">
                    <PlusLg viewBox="0 0 16 16" />
                    Create Role
                </A>
            </div>
            <Switch>
                <Match when={roles.loading}>
                    <p class="icon-link justify-content-center w-100"><ProgressSpinner show={true} /> Loading ...</p>
                </Match>
                <Match when={roles.error}>
                    <p class="text-danger-emphasis text-center">Error while fetching roles: <strong>{roles.error.message}</strong></p>
                </Match>
                <Match when={roles()?.length === 0}>
                    <p class="text-secondary text-center">There is no role to display yet. You can create a new one by using <strong>Create Role</strong> button.</p>
                </Match>
                <Match when={roles()}>
                    {(roles) => (
                        <div class="row">
                            <div class="offset-md-4 col-md-4">
                                <table class="table table-hover border shadow-sm">
                                    <thead>
                                        <tr>
                                            <th></th>
                                            <th scope="col">Name</th>
                                            <th scope="col">Key</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <For each={roles()}>
                                            {(role) => (
                                                <tr>
                                                    <td></td>
                                                    <td><A href={`/roles/view/${role.key}`}>{role.name}</A></td>
                                                    <td>{role.key}</td>
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
