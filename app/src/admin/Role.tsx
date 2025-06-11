import { A, useNavigate, useParams } from "@solidjs/router";
import { ArrowRight, FloppyFill, PlusLg, ThreeDotsVertical, Trash } from "../Icons";
import { createResource, createSignal, For, Match, onCleanup, Show, Suspense, Switch, useContext } from "solid-js";
import { AdminContext } from "../lib/admin/context";
import { AlertContext } from "../lib/context";
import { HttpError } from "../lib/api";
import { Permission } from "../lib/admin/models";
import { dropdownClickListener } from "../lib/utils";

export const CreateRole = () => {
    enum ValidationError {
        Name,
    }

    const adminCtx = useContext(AdminContext)!;
    const alertCtx = useContext(AlertContext)!;
    const navigate = useNavigate();

    const [name, setName] = createSignal('');

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

        setValidationErrors(errors);

        if (errors.size > 0) {
            return;
        }

        setInProgress(true);

        adminCtx.createRole(name())
            .then((role) => {
                alertCtx.success('Role is created successfully');
                navigate(`/roles/view/${role.id}`, { replace: true });
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
                <h2>Create Role</h2>
            </div>
            <div class="row m-0">
                <form class="offset-md-4 col-md-4 p-3 card" onSubmit={onSubmit}>
                    <div class="form-floating mb-4">
                        <input
                            id="roleName"
                            type="text"
                            name="name"
                            placeholder="Name"
                            class="form-control"
                            classList={{ 'is-invalid': validationErrors().has(ValidationError.Name) }}
                            value={name()}
                            onChange={(ev) => setName(ev.target.value)}
                        />
                        <label for="roleName" class="form-label">Name</label>
                        <Show when={validationErrors().has(ValidationError.Name)}>
                            <small class="invalid-feedback">Please specify a name for role.</small>
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
                            Create
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export const Role = () => {
    enum Action {
        Update,
        Delete,
    }

    const adminCtx = useContext(AdminContext)!;
    const alertCtx = useContext(AlertContext)!;
    const navigate = useNavigate();

    const params = useParams();

    const [inProgress, setInProgress] = createSignal(undefined as Action | undefined);

    const [dropdown, setDropdown] = createSignal(false);

    onCleanup(dropdownClickListener('role-detail-dropdown', () => setDropdown(false), () => inProgress() === undefined));

    const [role, { mutate }] = createResource(() => parseInt(params.id), (id) => adminCtx.fetchRole(id));

    const save = () => {
        const r = role();

        if (inProgress() !== undefined || !r) {
            return;
        }

        setInProgress(Action.Update);

        adminCtx.updateRolePermission(r.id, r.permissions)
            .then(() => alertCtx.success('Role permissions are updated successfully'))
            .catch((e) => alertCtx.fail(e.message))
            .finally(() => setInProgress(undefined));
    };

    const deleteRole = () => {
        const r = role();

        if (inProgress() !== undefined || !r) {
            return;
        }

        setInProgress(Action.Delete);

        adminCtx.deleteRole(r.id)
            .then(() => {
                alertCtx.success('Role is deleted successfully');
                navigate(-1);
            })
            .catch((e) => alertCtx.fail(e.message))
            .finally(() => setInProgress(undefined));
    };

    return (
        <div class="container py-4 px-md-4">
            <Suspense fallback={<p>Loading...</p>}>
                <div class="d-flex align-items-center mb-4">
                    <div class="flex-grow-1">
                        <h2 class="m-0">{role()?.name ?? '-'}</h2>
                        <small>Role</small>
                    </div>
                    <div class="dropdown mx-2">
                        <button class="btn icon-link px-1" on:click={(ev) => { ev.stopPropagation(); setDropdown(!dropdown()); }}>
                            <ThreeDotsVertical viewBox="0 0 16 16" />
                        </button>
                        <Show when={dropdown()}>
                            <ul id="role-detail-dropdown" class="dropdown-menu mt-1 show shadow" style="right: 0;">
                                <li>
                                    <button class="dropdown-item text-danger icon-link py-2" onClick={deleteRole}>
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
                        <Match when={role.state === 'ready' && role() === undefined}>
                            <span>Could not find the role with id {params.id}.</span>
                        </Match>
                        <Match when={role()}>
                            {(role) => (
                                <>
                                    <div class="offset-md-4 col-md-4 p-3 mb-4 card">
                                        <h5>Details</h5>

                                        <hr />
                                        <table>
                                            <tbody>
                                                <tr>
                                                    <td>Name</td>
                                                    <td class="text-end">{role().name}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>

                                    <div class="offset-md-4 col-md-4 p-3 card">
                                        <h5>Permissions</h5>

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
                                                                    checked={role().permissions.includes(value)}
                                                                    onChange={() => {
                                                                        mutate({
                                                                            ...role(),
                                                                            permissions: role().permissions.includes(value) ? role().permissions.filter((p) => p !== value) : [...role().permissions, value]
                                                                        })
                                                                    }}
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

export const Roles = () => {
    const adminCtx = useContext(AdminContext)!;
    const [roles] = createResource(() => adminCtx.fetchRoles());

    return (
        <div class="container py-4 px-md-4">
            <div class="d-flex align-items-center mb-4">
                <div class="flex-grow-1">
                    <h1>Roles</h1>
                </div>
                <A class="btn btn-outline-primary icon-link" href="/roles/create">
                    <PlusLg viewBox="0 0 16 16" />
                    Create Role
                </A>
            </div>

            <div class="row m-0">
                <Suspense>
                    <Switch>
                        <Match when={roles.error}>
                            <span>Error: {roles.error.message}</span>
                        </Match>
                        <Match when={roles()}>
                            {(roles) => (
                                <div class="offset-md-4 col-md-4 card p-3">
                                    <Show when={roles().length > 0} fallback={<p class="m-0">No role exists yet.</p>}>
                                        <table class="table table-hover m-0">
                                            <thead>
                                                <tr>
                                                    <th scope="col">Name</th>
                                                    <th scope="col"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <For each={roles()}>
                                                    {(role) => (
                                                        <tr>
                                                            <td>{role.name}</td>
                                                            <td class="text-end">
                                                                <A href={`/roles/view/${role.id}`} class="icon-link">
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
