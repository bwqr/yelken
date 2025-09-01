import { createEffect, createMemo, createResource, createSignal, For, Match, onCleanup, Show, Switch, useContext } from "solid-js";
import { AppearanceContext } from "../lib/appearance/context";
import { Location, LocationKind } from "../lib/models";
import { A, useNavigate, useParams, useSearchParams } from "@solidjs/router";
import { FloppyFill, PlusLg, ThreeDotsVertical, Trash } from "../Icons";
import { CommonContext } from "../lib/context";
import { AlertContext } from "../lib/alert";
import { dropdownClickListener } from "../lib/utils";
import ProgressSpinner from "../components/ProgressSpinner";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import { HttpError, ValidationErrors } from "../lib/api";
import { LocaleContext } from "../lib/i18n";

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
    const appearanceCtx = useContext(AppearanceContext)!;
    const commonCtx = useContext(CommonContext)!;
    const localeCtx = useContext(LocaleContext)!;
    const navigate = useNavigate();

    const i18n = localeCtx.i18n.template;

    const [path, setPath] = createSignal('');
    const [namespace, setNamespace] = createSignal('');

    const [inProgress, setInProgress] = createSignal(false);

    const [validationErrors, setValidationErrors] = createSignal(new Set<ValidationError>());
    const [serverValidationErrors, setServerValidationErrors] = createSignal(undefined as ValidationErrors<'path' | 'namespace'> | undefined);
    const [serverError, setServerError] = createSignal(undefined as string | undefined);

    const onSubmit = (ev: SubmitEvent) => {
        ev.preventDefault();

        if (inProgress()) {
            return;
        }

        setServerValidationErrors(undefined);
        setServerError(undefined);

        const errors = new Set<ValidationError>();
        const req = { path: path().trim(), namespace: namespace().trim() || undefined };

        if (req.path.length < 3 || req.path.startsWith('.html')) {
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

        appearanceCtx.createTemplate(req.path, '', req.namespace)
            .then(() => {
                alertCtx.success(i18n.actions.templateCreated(req.path));

                let url = req.namespace ? `/templates/resource/${req.namespace}` : '/templates/resource';
                url = `${url}?path=${encodeURIComponent(req.path)}`;

                navigate(url, { replace: true });
            })
            .catch((e) => {
                const msg = e.message in i18n.serverErrors ? i18n.serverErrors[e.message as keyof typeof i18n.serverErrors] : e.message;

                if (e instanceof HttpError) {
                    setServerError(msg);
                } else if (e instanceof ValidationErrors) {
                    setServerValidationErrors(e);
                } else {
                    alertCtx.fail(msg);
                }
            })
            .finally(() => setInProgress(false));
    };
    return (
        <div class="container py-4 px-md-4">
            <h2 class="mb-5">{i18n.actions.createTemplate()}</h2>

            <div class="row">
                <form class="offset-md-4 col-md-4" onSubmit={onSubmit}>
                    <div class="border rounded p-3">
                        <div class="mb-4">
                            <label for="templatePath" class="form-label">{i18n.labels.path()}</label>
                            <input
                                type="text"
                                id="templatePath"
                                class="form-control"
                                classList={{
                                    'is-invalid': validationErrors().has(ValidationError.Path)
                                        || validationErrors().has(ValidationError.NotHtmlPath)
                                        || serverValidationErrors()?.fieldMessages.has('path')
                                }}
                                name="path"
                                placeholder={i18n.labels.pathPlaceholder()}
                                value={path()}
                                onInput={(ev) => setPath(ev.target.value)}
                            />
                            <Switch>
                                <Match when={validationErrors().has(ValidationError.Path)}>
                                    <small class="invalid-feedback">{i18n.validationErrors.path()}.</small>
                                </Match>
                                <Match when={validationErrors().has(ValidationError.NotHtmlPath)}>
                                    <small class="invalid-feedback">{i18n.validationErrors.notHtmlPath()}.</small>
                                </Match>
                            </Switch>
                            <Show when={serverValidationErrors()?.fieldMessages.get('path')}>
                                {(messages) => (<For each={messages() as string[]}>{(message) => (<small class="invalid-feedback">{message}</small>)}</For>)}
                            </Show>
                        </div>

                        <div class="mb-4">
                            <label for="templateNamespace" class="form-label">{localeCtx.i18n.common.labels.namespace()}</label>
                            <select
                                id="templateNamespace"
                                class="form-select"
                                classList={{ 'is-invalid': serverValidationErrors()?.fieldMessages.has('namespace') }}
                                name="namespace"
                                value={namespace()}
                                onChange={(ev) => setNamespace(ev.target.value)}
                            >
                                <option value="">{localeCtx.i18n.common.labels.global()}</option>
                                <For each={commonCtx.namespaces()}>
                                    {(namespace) => (
                                        <option value={namespace.key}>{namespace.key}{commonCtx.options().theme === namespace.key ? ` (${localeCtx.i18n.common.labels.activeTheme()})` : ''}</option>
                                    )}
                                </For>
                            </select>
                            <Show when={serverValidationErrors()?.fieldMessages.get('namespace')}>
                                {(messages) => (<For each={messages() as string[]}>{(message) => (<small class="invalid-feedback">{message}</small>)}</For>)}
                            </Show>
                        </div>

                        <Show when={serverError()}>
                            <div class="mb-2">
                                <small class="text-danger-emphasis">{serverError()}</small>
                            </div>
                        </Show>

                        <Show when={serverValidationErrors()?.messages}>
                            {(messages) => (
                                <div class="mb-2">
                                    <For each={messages()}>{(message) => (<small class="text-danger-emphasis">{message}</small>)}</For>
                                </div>
                            )}
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
                                {localeCtx.i18n.common.actions.add()}
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
    const appearanceCtx = useContext(AppearanceContext)!;
    const commonCtx = useContext(CommonContext)!;
    const localeCtx = useContext(LocaleContext)!;
    const [searchParams, setSearchParams] = useSearchParams();

    const i18n = localeCtx.i18n.template;

    const namespace = createMemo(() => searchParams.namespace as string | undefined);
    const [templates, { refetch }] = createResource(
        () => ({ namespace: namespace() }),
        ({ namespace }) => appearanceCtx.fetchTemplates(namespace)
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

    const [item, setItem] = createSignal(undefined as string | undefined);
    const [deleting, setDeleting] = createSignal(undefined as { path: string, namespace?: string } | undefined);

    onCleanup(dropdownClickListener('template-quick-action', () => setItem(undefined), () => !deleting()));

    const deleteTemplate = async (path: string, namespace?: string) => {
        return appearanceCtx.deleteTemplate(path, namespace)
            .then(() => refetch())
            .then(() => {
                setDeleting(undefined);
                setItem(undefined);

                alertCtx.success(i18n.actions.templateDeleted(path));
            });
    };

    return (
        <div class="container py-4 px-md-4">
            <div class="d-flex align-items-center mb-5">
                <h1 class="flex-grow-1 m-0">{localeCtx.i18n.nav.links.templates()}</h1>
                <A class="btn btn-outline-primary icon-link" href="/templates/create">
                    <PlusLg viewBox="0 0 16 16" />
                    {i18n.actions.createTemplate()}
                </A>
            </div>

            <div class="row">
                <div class="offset-md-3 col-md-6">
                    <div class="d-flex justify-content-end align-items-center mb-3">
                        <label class="px-2" for="templateNamespace">{localeCtx.i18n.common.labels.namespace()}</label>
                        <select
                            id="templateNamespace"
                            class="form-select w-auto"
                            disabled={templates.loading}
                            value={namespace() ?? ''}
                            onChange={(ev) => setSearchParams({ namespace: ev.target.value })}
                        >
                            <option value="">{localeCtx.i18n.common.labels.global()}</option>
                            <For each={commonCtx.namespaces()}>
                                {(namespace) => (<option value={namespace.key}>{namespace.key}{commonCtx.options().theme === namespace.key ? ` (${localeCtx.i18n.common.labels.activeTheme()})` : ''}</option>)}
                            </For>
                        </select>
                    </div>
                    <Switch>
                        <Match when={templates.loading}>
                            <p class="icon-link justify-content-center w-100"><ProgressSpinner show={true} /> {localeCtx.i18n.common.loadingItem(localeCtx.i18n.nav.links.templates())} ...</p>
                        </Match>
                        <Match when={templates.error}>
                            <p class="text-danger-emphasis text-center">{localeCtx.i18n.common.loadingItemError(localeCtx.i18n.nav.links.templates())}: <strong>{templates.error.message}</strong></p>
                        </Match>
                        <Match when={templates()?.length === 0}>
                            <p class="text-secondary text-center">{i18n.noTemplateForNamespace(namespace() ?? localeCtx.i18n.common.labels.global())}.</p>
                        </Match>
                        <Match when={templates()}>
                            {(templates) => (
                                <table class="table border shadow-sm">
                                    <thead>
                                        <tr>
                                            <th></th>
                                            <th scope="col">{i18n.labels.path()}</th>
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
                                                            <Match when={template.effectiveLocation === LocationKind.User}><span class="badge rounded-pill text-bg-light">{i18n.labels.modified()}</span></Match>
                                                            <Match when={namespace() && template.effectiveLocation === LocationKind.Global}><span class="badge rounded-pill text-bg-light">{i18n.labels.overridenGlobally()}</span></Match>
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
                                                                        class="btn dropdown-item icon-link text-danger"
                                                                        disabled={
                                                                            template.effectiveLocation === LocationKind.Theme ||
                                                                            (namespace() !== undefined && template.effectiveLocation === LocationKind.Global)
                                                                        }
                                                                        onClick={() => setDeleting({ path: template.path, namespace: namespace() })}
                                                                    >
                                                                        <Trash viewBox="0 0 16 16" />
                                                                        <Show when={template.effectiveLocation === LocationKind.User} fallback={<>{localeCtx.i18n.common.actions.delete()}</>}>
                                                                            {i18n.actions.revert()}
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
                                <p>{i18n.actions.confirmDelete(deleting().path)}?</p>
                            }>
                                <p>{i18n.actions.confirmRevert(deleting().path)}?</p>
                            </Show>
                        }
                        confirmText={namespace() ? i18n.actions.revert() : localeCtx.i18n.common.actions.delete()}
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
    const appearanceCtx = useContext(AppearanceContext)!;
    const localeCtx = useContext(LocaleContext)!;
    const params = useParams();
    const [searchParams] = useSearchParams();

    const i18n = localeCtx.i18n.template;

    const namespace = createMemo(() => params.namespace as string | undefined);
    const path = createMemo(() => searchParams.path ? searchParams.path as string : undefined);
    const [template] = createResource(
        () => ({ path: decodeURIComponent(searchParams.path as string), namespace: namespace() }),
        // When namespace is given, first try to fetch user provided template. If it does not exist, then try theme provided template.
        ({ path, namespace }) => appearanceCtx.fetchTemplate(path, namespace ? { kind: LocationKind.User, namespace } : { kind: LocationKind.Global })
            .then((template) => template ?? (namespace ? appearanceCtx.fetchTemplate(path, { kind: LocationKind.Theme, namespace }) : undefined))
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

        appearanceCtx.updateTemplate(t.path, e.getValue(), namespace())
            .then(() => alertCtx.success(i18n.actions.templateUpdated(t.path)))
            .catch((e) => alertCtx.fail(e.message))
            .finally(() => setInProgress(false));
    }

    return (
        <div class="container d-flex flex-column flex-grow-1 py-4 px-md-4" style="min-height: 100vh">
            <Switch>
                <Match when={!path()}>
                    <p class="text-secondary text-center">{i18n.missingPath()}.</p>
                </Match>
                <Match when={editor.loading || template.loading}>
                    <p class="icon-link justify-content-center w-100"><ProgressSpinner show={true} /> {localeCtx.i18n.common.loading()} ...</p>
                </Match>
                <Match when={editor.error || template.error}>
                    <p class="text-danger-emphasis text-center">{localeCtx.i18n.common.loadingItemError(i18n.template())}: <strong>{editor.error?.message} {template.error?.message}</strong></p>
                </Match>
                <Match when={template.state === 'ready' && template() === undefined}>
                    <p class="text-secondary text-center">{i18n.templateNotFound(path() ?? '')}.</p>
                </Match>
                <Match when={template()}>
                    {(template) => (
                        <div class="d-flex align-items-center mb-4">
                            <div class="flex-grow-1">
                                <h2 class="m-0">{template().path}</h2>
                                <Show when={namespace()} fallback={<small>{i18n.labels.globalTemplate()}</small>}>
                                    <small>{localeCtx.i18n.common.labels.namespace()} <strong>({namespace()})</strong> {i18n.labels.scopedTemplate()}</small>
                                </Show>
                            </div>

                            <button class="btn btn-primary icon-link ms-2" onClick={save} disabled={inProgress()}>
                                <ProgressSpinner show={inProgress()} />
                                <FloppyFill viewBox="0 0 16 16" />
                                {localeCtx.i18n.common.actions.save()}
                            </button>
                        </div>
                    )}
                </Match>
            </Switch>

            <div class="flex-grow-1 w-100" ref={editorRef} classList={{ 'd-none': !path() }}></div>
        </div>
    );
};
