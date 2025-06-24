import { createEffect, createMemo, createResource, createSignal, For, Match, onCleanup, Show, Switch, useContext } from "solid-js";
import { AdminContext } from "../lib/admin/context";
import { Location } from "../lib/admin/models";
import { A, useNavigate, useParams, useSearchParams } from "@solidjs/router";
import { LocationKind } from "../lib/admin/models";
import { FloppyFill, PlusLg, ThreeDotsVertical, Trash } from "../Icons";
import { AlertContext, BaseContext } from "../lib/context";
import { dropdownClickListener } from "../lib/utils";
import ProgressSpinner from "../components/ProgressSpinner";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import { HttpError } from "../lib/api";

const locationKindOrder = [LocationKind.User, LocationKind.Global, LocationKind.Theme];

interface TemplateGroup {
    path: string,
    effectiveLocation: LocationKind,
    locations: Location[],
}

export const CreateTemplate = () => {
    enum ValidationError {
        Path,
        NotHtmlPath,
    }

    const alertCtx = useContext(AlertContext)!;
    const adminCtx = useContext(AdminContext)!;
    const baseCtx = useContext(BaseContext)!;
    const navigate = useNavigate();

    const [path, setPath] = createSignal('');
    const [namespace, setNamespace] = createSignal('');

    const [themes] = createResource(() => adminCtx.fetchThemes());

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
        const req = { path: path().trim(), namespace: namespace().trim() || undefined };

        if (req.path.length === 0) {
            errors.add(ValidationError.Path);
        }

        if (!req.path.endsWith('.html')) {
            errors.add(ValidationError.NotHtmlPath);
        }

        setValidationErrors(errors);

        if (errors.size > 0) {
            return;
        }

        setInProgress(true);

        adminCtx.createTemplate(req.path, '', req.namespace)
            .then(() => {
                alertCtx.success(`Template "${req.path}" is created successfully`);

                let url = req.namespace ? `/templates/resource/${req.namespace}` : '/templates/resource';
                url = `${url}?path=${encodeURIComponent(req.path)}`;

                navigate(url, { replace: true });
            })
            .catch((e) => {
                if (e instanceof HttpError) {
                    setServerError(e.message);
                } else {
                    alertCtx.fail(e.message);
                }
            })
            .finally(() => setInProgress(false));
    };
    return (
        <div class="container py-4 px-md-4">
            <h2 class="mb-5">Create Template</h2>

            <div class="row">
                <form class="offset-md-4 col-md-4" onSubmit={onSubmit}>
                    <div class="border rounded p-3">
                        <div class="mb-4">
                            <label for="templatePath" class="form-label">Path</label>
                            <input
                                type="text"
                                id="templatePath"
                                class="form-control"
                                classList={{ 'is-invalid': validationErrors().has(ValidationError.Path) || validationErrors().has(ValidationError.NotHtmlPath) }}
                                name="path"
                                placeholder="Path of template, e.g. index.html"
                                value={path()}
                                onInput={(ev) => setPath(ev.target.value)}
                            />
                            <Switch>
                                <Match when={validationErrors().has(ValidationError.Path)}>
                                    <small class="invalid-feedback">Please enter a path.</small>
                                </Match>
                                <Match when={validationErrors().has(ValidationError.NotHtmlPath)}>
                                    <small class="invalid-feedback">Template path must end with <strong>.html</strong>.</small>
                                </Match>
                            </Switch>
                        </div>

                        <Switch>
                            <Match when={themes.loading}>
                                <p class="icon-link justify-content-center w-100"><ProgressSpinner show={true} /> Loading Namespaces ...</p>
                            </Match>
                            <Match when={themes.error}>
                                <p class="text-danger-emphasis text-center">Error while fetching namespaces: <strong>{themes.error.message}</strong></p>
                            </Match>
                            <Match when={themes()}>
                                {(themes) => (
                                    <div class="mb-4">
                                        <label for="templateNamespace" class="form-label">Namespace</label>
                                        <select
                                            id="templateNamespace"
                                            class="form-select"
                                            name="namespace"
                                            value={namespace()}
                                            onChange={(ev) => setNamespace(ev.target.value)}
                                        >
                                            <option value="">Global</option>
                                            <For each={themes()}>
                                                {(theme) => (
                                                    <option value={theme.id}>{theme.name}{baseCtx.options().theme === theme.id ? ' (Active Theme)' : ''}</option>
                                                )}
                                            </For>
                                        </select>
                                    </div>
                                )}
                            </Match>
                        </Switch>

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

export const Templates = () => {
    const alertCtx = useContext(AlertContext)!;
    const adminCtx = useContext(AdminContext)!;
    const baseCtx = useContext(BaseContext)!;
    const [searchParams, setSearchParams] = useSearchParams();

    const namespace = createMemo(() => searchParams.namespace as string | undefined);
    const [templates, { refetch }] = createResource(
        () => ({ namespace: namespace() }),
        ({ namespace }) => adminCtx.fetchTemplates(namespace)
            .then((templates) => {
                const map = templates.reduce((map, template) => {
                    if (!map.has(template.path)) {
                        map.set(template.path, { path: template.path, effectiveLocation: template.location.kind, locations: [template.location] });

                        return map;
                    }

                    const group = map.get(template.path)!;

                    const idx = Math.min(locationKindOrder.indexOf(group.effectiveLocation), locationKindOrder.indexOf(template.location.kind));

                    group.effectiveLocation = locationKindOrder[idx];

                    return map;
                }, new Map<string, TemplateGroup>());

                return Array.from(map.values()).toSorted((a, b) => a.path < b.path ? -1 : 1);
            })
    );
    const [themes] = createResource(() => adminCtx.fetchThemes());

    const [item, setItem] = createSignal(undefined as string | undefined);
    const [deleting, setDeleting] = createSignal(undefined as { path: string, namespace?: string } | undefined);

    onCleanup(dropdownClickListener('template-quick-action', () => setItem(undefined), () => !deleting()));

    const deleteTemplate = async (path: string, namespace?: string) => {
        return adminCtx.deleteTemplate(path, namespace)
            .then(() => refetch())
            .then(() => {
                setDeleting(undefined);
                setItem(undefined);

                alertCtx.success(`Template "${path}" is deleted successfully`);
            });
    };

    return (
        <div class="container py-4 px-md-4">
            <div class="d-flex align-items-center mb-5">
                <h1 class="flex-grow-1 m-0">Templates</h1>
                <A class="btn btn-outline-primary icon-link" href="/templates/create">
                    <PlusLg viewBox="0 0 16 16" />
                    Create Template
                </A>
            </div>

            <div class="row">
                <div class="offset-md-3 col-md-6">
                    <Switch>
                        <Match when={themes.loading}>
                            <p class="icon-link justify-content-center w-100"><ProgressSpinner show={true} /> Loading Namespaces ...</p>
                        </Match>
                        <Match when={themes.error}>
                            <p class="text-danger-emphasis text-center">Error while fetching namespaces: <strong>{themes.error.message}</strong></p>
                        </Match>
                        <Match when={themes()}>
                            {(themes) => (
                                <div class="d-flex justify-content-end align-items-center mb-3">
                                    <label class="px-2" for="templateNamespace">Namespace</label>
                                    <select
                                        id="templateNamespace"
                                        class="form-select w-auto"
                                        disabled={templates.loading}
                                        value={namespace() ?? ''}
                                        onChange={(ev) => setSearchParams({ namespace: ev.target.value })}
                                    >
                                        <option value="">Global</option>
                                        <For each={themes()}>
                                            {(theme) => (<option value={theme.id}>{theme.name}{baseCtx.options().theme === theme.id ? ' (Active Theme)' : ''}</option>)}
                                        </For>
                                    </select>
                                </div>
                            )}
                        </Match>
                    </Switch>
                    <Switch>
                        <Match when={templates.loading}>
                            <p class="icon-link justify-content-center w-100"><ProgressSpinner show={true} /> Loading ...</p>
                        </Match>
                        <Match when={templates.error}>
                            <p class="text-danger-emphasis text-center">Error while fetching templates: <strong>{templates.error.message}</strong></p>
                        </Match>
                        <Match when={templates()?.length === 0}>
                            <p class="text-secondary text-center">There is no template for the <strong>{namespace() ?? 'global'}</strong> namespace to display yet. You can create a new one by using <strong>Create Template</strong> button.</p>
                        </Match>
                        <Match when={templates()}>
                            {(templates) => (
                                <table class="table border shadow-sm">
                                    <thead>
                                        <tr>
                                            <th></th>
                                            <th scope="col">Path</th>
                                            <th></th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <For each={templates()}>
                                            {(template) => (
                                                <tr>
                                                    <td></td>
                                                    <td><A href={`/templates/resource${namespace() ? `/${namespace()}` : ''}?path=${encodeURIComponent(template.path)}`}>{template.path}</A></td>
                                                    <td class="text-center">
                                                        <Switch>
                                                            <Match when={template.effectiveLocation === LocationKind.User}><span class="badge rounded-pill text-bg-light">Modified</span></Match>
                                                            <Match when={namespace() && template.effectiveLocation === LocationKind.Global}><span class="badge rounded-pill text-bg-light">Overriden Globally</span></Match>
                                                        </Switch>
                                                    </td>
                                                    <td class="dropdown text-end">
                                                        <button class="btn icon-link px-1" on:click={(ev) => { ev.stopPropagation(); setItem(item() === template.path ? undefined : template.path) }}>
                                                            <ThreeDotsVertical viewBox="0 0 16 16" />
                                                        </button>

                                                        <Show when={(item() === template.path)}>
                                                            <ul class="dropdown-menu show" id="template-quick-action" style="right: 0">
                                                                <li>
                                                                    <button
                                                                        class="dropdown-item icon-link text-danger"
                                                                        disabled={
                                                                            template.effectiveLocation === LocationKind.Theme ||
                                                                            (namespace() !== undefined && template.effectiveLocation === LocationKind.Global)
                                                                        }
                                                                        onClick={() => setDeleting({ path: template.path, namespace: namespace() })}
                                                                    >
                                                                        <Trash viewBox="0 0 16 16" />
                                                                        <Show when={template.effectiveLocation === LocationKind.User} fallback={<>Delete</>}>
                                                                            Revert
                                                                        </Show>
                                                                    </button>
                                                                </li>
                                                            </ul>
                                                        </Show>
                                                    </td>
                                                </tr>
                                            )}
                                        </For>
                                    </tbody>
                                </table>
                            )}
                        </Match>
                    </Switch>
                </div>
            </div>
            <Show when={deleting()}>
                {(deleting) => (
                    <DeleteConfirmModal
                        message={
                            <Show when={namespace()} fallback={
                                <p>Are you sure about deleting the template <strong>{deleting().path}</strong>?</p>
                            }>
                                <p>Are you sure about reverting changes applied on the template <strong>{deleting().path}</strong>?</p>
                            </Show>
                        }
                        close={() => setDeleting(undefined)}
                        confirm={() => deleteTemplate(deleting().path, deleting().namespace)}
                    />
                )}
            </Show>
        </div>
    );
};

export const TemplateResource = () => {
    let editorRef: HTMLElement | undefined = undefined;

    const alertCtx = useContext(AlertContext)!;
    const adminCtx = useContext(AdminContext)!;
    const params = useParams();
    const [searchParams] = useSearchParams();

    const namespace = createMemo(() => params.namespace as string | undefined);
    const path = createMemo(() => searchParams.path ? searchParams.path as string : undefined);
    const [template] = createResource(
        () => ({ path: decodeURIComponent(searchParams.path as string), namespace: namespace() }),
        // When namespace is given, first try to fetch user provided template. If it does not exist, then try theme provided template.
        ({ path, namespace }) => adminCtx.fetchTemplate(path, namespace ? { kind: LocationKind.User, namespace } : { kind: LocationKind.Global })
            .then((template) => template ?? (namespace ? adminCtx.fetchTemplate(path, { kind: LocationKind.Theme, namespace }) : undefined))
    );

    const [editor] = createResource(async () => {
        const [ace, mode] = await Promise.all([import('ace-code'), import('ace-code/src/mode/nunjucks')]);
        const editor = ace.edit(editorRef);

        editor.session.setMode(new mode.Mode());

        return editor;
    });

    createEffect(() => {
        const t = template();
        const e = editor();

        if (t && e) {
            e.setValue(t.template);
        }
    })

    const [inProgress, setInProgress] = createSignal(false);

    const save = () => {
        const t = template();
        const e = editor();

        if (inProgress() || !e || !t) {
            return;
        }

        setInProgress(true);

        adminCtx.updateTemplate(t.path, e.getValue(), namespace())
            .then(() => alertCtx.success(`Template "${t.path}" is updated successfully`))
            .catch((e) => alertCtx.fail(e.message))
            .finally(() => setInProgress(false));
    }

    return (
        <div class="container d-flex flex-column flex-grow-1 py-4 px-md-4">
            <Switch>
                <Match when={!path()}>
                    <p class="text-secondary text-center"><strong>Path</strong> is missing from search parameters.</p>
                </Match>
                <Match when={editor.loading || template.loading}>
                    <p class="icon-link justify-content-center w-100"><ProgressSpinner show={true} /> Loading ...</p>
                </Match>
                <Match when={editor.error || template.error}>
                    <p class="text-danger-emphasis text-center">Error while fetching template: <strong>{editor.error?.message} {template.error?.message}</strong></p>
                </Match>
                <Match when={template.state === 'ready' && template() === undefined}>
                    <p class="text-secondary text-center">Could not find the template with path {path()}.</p>
                </Match>
                <Match when={template()}>
                    {(template) => (
                        <div class="d-flex align-items-center mb-4">
                            <div class="flex-grow-1">
                                <h2 class="m-0">{template().path}</h2>
                                <Show when={namespace()} fallback={<small>Global Template</small>}>
                                    <small>Namespace <strong>({namespace()})</strong> Scoped Template</small>
                                </Show>
                            </div>

                            <button class="btn btn-primary icon-link ms-2" onClick={save} disabled={inProgress()}>
                                <ProgressSpinner show={inProgress()} />
                                <FloppyFill viewBox="0 0 16 16" />
                                Save
                            </button>
                        </div>
                    )}
                </Match>
            </Switch>

            <div class="flex-grow-1 w-100" ref={editorRef} classList={{ 'd-none': !path() }}></div>
        </div>
    );
};
