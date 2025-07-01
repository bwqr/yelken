import { createEffect, createResource, createSignal, For, Match, Show, Switch, useContext } from "solid-js";
import { AppearanceContext } from "../lib/appearance/context";
import { type Page as PageModel } from "../lib/appearance/models";
import { FloppyFill, PencilSquare, PlusLg, XLg } from "../Icons";
import { A, useNavigate, useParams, useSearchParams } from "@solidjs/router";
import { HttpError } from "../lib/api";
import { AlertContext, CommonContext } from "../lib/context";
import { createMemo } from "solid-js";
import ProgressSpinner from "../components/ProgressSpinner";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import { createStore } from "solid-js/store";

interface PageGroup {
    key: string,
    name: string,
    desc: string | null,
    pages: {
        path: string,
        template: string,
        locale: string | null
    }[]
}

export const CreatePage = () => {
    function unique<T>(list: T[]): T[] {
        return list.filter((el, idx) => list.findIndex((e) => e === el) === idx);
    }

    enum ValidationError {
        Name,
        Key,
        Path,
        Template,
        Locale,
    }

    const appearanceCtx = useContext(AppearanceContext)!;
    const alertCtx = useContext(AlertContext)!;
    const commonCtx = useContext(CommonContext)!;
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const creatingEntry = searchParams.key !== undefined && searchParams.name !== undefined;
    const [name, setName] = createSignal(searchParams.name ? decodeURIComponent(searchParams.name as string) : '');
    const [key, setKey] = createSignal(searchParams.key ? decodeURIComponent(searchParams.key as string) : '');
    const [desc, setDesc] = createSignal(searchParams.desc ? decodeURIComponent(searchParams.desc as string) : '');
    const [path, setPath] = createSignal('');
    const [namespace, setNamespace] = createSignal(undefined as string | undefined);
    const [template, setTemplate] = createSignal('');
    const [locale, setLocale] = createSignal('');

    const [templates] = createResource(namespace, (namespace) => appearanceCtx.fetchTemplates(namespace || undefined).then((templates) => unique(templates)));
    const [themes] = createResource(() => appearanceCtx.fetchThemes());

    createEffect(() => {
        // Set the namespace when themes resource is loaded since select's options depend it to be loaded.
        if (themes()) {
            setNamespace(searchParams.namespace ? decodeURIComponent(searchParams.namespace as string) : '');
        }
    })

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
            name: name().trim(),
            key: key().trim(),
            desc: desc().trim() || null,
            path: path().trim(),
            namespace: namespace()?.trim() || null,
            template: template().trim(),
            locale: locale().trim() || null,
        };

        if (req.name.length === 0) {
            errors.add(ValidationError.Name);
        }

        if (req.key.length === 0) {
            errors.add(ValidationError.Key);
        }

        if (req.path.length === 0) {
            errors.add(ValidationError.Path);
        }

        if (creatingEntry && !req.locale) {
            errors.add(ValidationError.Locale);
        }

        setValidationErrors(errors);

        if (errors.size > 0) {
            return;
        }

        setInProgress(true);

        appearanceCtx.createPage(req)
            .then(() => {
                alertCtx.success(`Page "${req.name}" is created successfully`);

                const url = req.namespace ? `/pages/view/${req.namespace}/${req.key}` : `/pages/view/${req.key}`

                navigate(url, { replace: true });
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
            <h2 class="mb-5">Create Page</h2>

            <div class="row m-0">
                <form class="offset-md-4 col-md-4 p-3 card" onSubmit={onSubmit}>
                    <div class="mb-4">
                        <label for="pageName" class="form-label">Name</label>
                        <input
                            id="pageName"
                            type="text"
                            name="name"
                            placeholder="Name"
                            class="form-control"
                            classList={{ 'is-invalid': validationErrors().has(ValidationError.Name) }}
                            value={name()}
                            onChange={(ev) => setName(ev.target.value)}
                            disabled={creatingEntry}
                        />
                        <Show when={validationErrors().has(ValidationError.Name)}>
                            <small class="invalid-feedback">Please specify a name for page.</small>
                        </Show>
                    </div>

                    <div class="mb-4">
                        <label for="pageKey" class="form-label">Key</label>
                        <input
                            id="pageKey"
                            type="text"
                            name="key"
                            placeholder="Key"
                            class="form-control"
                            classList={{ 'is-invalid': validationErrors().has(ValidationError.Key) }}
                            value={key()}
                            onChange={(ev) => setKey(ev.target.value)}
                            disabled={creatingEntry}
                        />
                        <Show when={validationErrors().has(ValidationError.Key)}>
                            <small class="invalid-feedback">Please specify a key for page.</small>
                        </Show>
                    </div>

                    <div class="mb-4">
                        <label for="pageDesc" class="form-label">Description <small class="text-secondary">(optional)</small></label>
                        <textarea
                            id="pageDesc"
                            class="form-control"
                            rows="2"
                            value={desc()}
                            onChange={(ev) => setDesc(ev.target.value)}
                            disabled={creatingEntry}
                        ></textarea>
                    </div>

                    <div class="mb-4">
                        <label for="pagePath" class="form-label">Path</label>
                        <input
                            id="pagePath"
                            type="text"
                            name="path"
                            placeholder="Path"
                            class="form-control"
                            classList={{ 'is-invalid': validationErrors().has(ValidationError.Path) }}
                            value={path()}
                            onChange={(ev) => setPath(ev.target.value)}
                        />
                        <Show when={validationErrors().has(ValidationError.Path)}>
                            <small class="invalid-feedback">Please specify a path for page.</small>
                        </Show>
                    </div>

                    <div class="mb-4">
                        <label for="pageNamespace" class="form-label">Namespace</label>
                        <select
                            id="pageNamespace"
                            name="namespace"
                            class="form-select"
                            value={namespace()}
                            onChange={(ev) => setNamespace(ev.target.value)}
                            disabled={templates.loading || creatingEntry}
                        >
                            <Switch>
                                <Match when={themes.loading}>
                                    <option value="" disabled selected>Loading...</option>
                                </Match>
                                <Match when={themes.error}><></></Match>
                                <Match when={themes()}>
                                    {(themes) => (
                                        <>
                                            <option value="">Global</option>
                                            <For each={themes()}>
                                                {(theme) => (<option value={theme.id}>{theme.name}{commonCtx.options().theme === theme.id ? ' (Active Theme)' : ''}</option>)}
                                            </For>
                                        </>
                                    )}
                                </Match>
                            </Switch>
                        </select>
                        <Show when={themes.error}>
                            <small class="text-danger">Error while fetching themes: <strong>{themes.error.message}</strong></small>
                        </Show>
                    </div>

                    <div class="mb-4">
                        <label for="pageTemplate" class="form-label">Template</label>
                        <select
                            id="pageTemplate"
                            name="template"
                            class="form-select"
                            classList={{ 'is-invalid': validationErrors().has(ValidationError.Template) }}
                            value={template()}
                            onChange={(ev) => setTemplate(ev.target.value)}
                        >
                            <Switch>
                                <Match when={templates.loading}>
                                    <option value="" disabled selected>Loading...</option>
                                </Match>
                                <Match when={templates.error}><></></Match>
                                <Match when={templates()}>
                                    {(templates) => (
                                        <>
                                            <option value="" disabled selected>Select a template</option>
                                            <For each={templates()}>
                                                {(template) => (<option value={template.path}>{template.path}</option>)}
                                            </For>
                                        </>
                                    )}
                                </Match>
                            </Switch>
                        </select>
                        <Show when={validationErrors().has(ValidationError.Template)}>
                            <small class="invalid-feedback">Please select a template.</small>
                        </Show>
                        <Show when={templates.error}>
                            <small class="text-danger">Error while fetching templates: <strong>{templates.error.message}</strong></small>
                        </Show>
                    </div>

                    <div class="mb-4">
                        <label for="pageLocale" class="form-label">Locale</label>
                        <select
                            id="pageLocale"
                            name="locale"
                            class="form-select"
                            classList={{ 'is-invalid': validationErrors().has(ValidationError.Locale) }}
                            value={locale()}
                            onChange={(ev) => setLocale(ev.target.value)}
                        >
                            <option value="" selected disabled={creatingEntry}>Not localized</option>
                            <For each={commonCtx.activeLocales()}>
                                {(locale) => (
                                    <option value={locale.key}>{locale.name}</option>
                                )}
                            </For>
                        </select>
                        <Show when={validationErrors().has(ValidationError.Locale)}>
                            <small class="invalid-feedback">Please specify a locale for page.</small>
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
                            style="max-width: 10rem;"
                            class="btn btn-primary icon-link justify-content-center w-100"
                            disabled={inProgress()}
                        >
                            <ProgressSpinner show={inProgress()} />
                            <PlusLg viewBox="0 0 16 16" />
                            Create
                        </button>
                    </div>
                </form>
            </div>
        </div >
    );
};

function groupPages(pages: PageModel[]): PageGroup[] {
    const map = pages.reduce((group, page) => {
        if (!group.has(page.key)) {
            group.set(page.key, { key: page.key, name: page.name, desc: page.desc, pages: [] });
        }

        group.get(page.key)!.pages.push({ path: page.path, template: page.template, locale: page.locale });

        return group;
    }, new Map<string, PageGroup>())

    return Array.from(map.values());
}

export const Pages = () => {
    const appearanceCtx = useContext(AppearanceContext)!;
    const commonCtx = useContext(CommonContext)!;
    const [searchParams, setSearchParams] = useSearchParams();

    const namespace = createMemo(() => searchParams.namespace as string | undefined);
    const [globalPages] = createResource(() => appearanceCtx.fetchPages().then(groupPages))
    const [pages] = createResource(namespace, (namespace) => appearanceCtx.fetchPages(namespace).then(groupPages));
    const [themes] = createResource(() => appearanceCtx.fetchThemes());

    createEffect(() => {
        if (!namespace()) {
            setSearchParams({ namespace: commonCtx.options().theme }, { replace: true });
        }
    });

    return (
        <div class="container py-4 px-md-4">
            <div class="d-flex align-items-center mb-5">
                <h1 class="flex-grow-1 m-0">Pages</h1>
                <A class="btn btn-outline-primary icon-link" href="/pages/create">
                    <PlusLg viewBox="0 0 16 16" />
                    Create Page
                </A>
            </div>

            <div class="row">
                <div class="offset-md-3 col-md-6">
                    <div class="d-flex align-items-center">
                        <h5 class="flex-grow-1">Theme Scoped Pages</h5>

                        <Switch>
                            <Match when={themes.loading}>
                                <p class="icon-link justify-content-center w-100"><ProgressSpinner show={true} /> Loading Themes ...</p>
                            </Match>
                            <Match when={themes.error}>
                                <p class="text-danger-emphasis text-center">Error while fetching themes: <strong>{themes.error.message}</strong></p>
                            </Match>
                            <Match when={themes()}>
                                {(themes) => (
                                    <select
                                        class="form-select w-auto"
                                        disabled={pages.loading}
                                        value={namespace() ?? ''}
                                        onChange={(ev) => setSearchParams({ namespace: ev.target.value })}
                                    >
                                        <For each={themes()}>
                                            {(theme) => (<option value={theme.id}>{theme.name}{commonCtx.options().theme === theme.id ? ' (Active Theme)' : ''}</option>)}
                                        </For>
                                    </select>
                                )}
                            </Match>
                        </Switch>
                    </div>

                    <hr />

                    <Switch>
                        <Match when={pages.loading}>
                            <p class="icon-link justify-content-center w-100"><ProgressSpinner show={true} /> Loading ...</p>
                        </Match>
                        <Match when={pages.error}>
                            <p class="text-danger-emphasis text-center">Error while fetching pages: <strong>{pages.error.message}</strong></p>
                        </Match>
                        <Match when={pages()?.length === 0}>
                            <p class="text-secondary text-center">There is no page for the <strong>{namespace()}</strong> theme to display yet. You can create a new one by using <strong>Create Page</strong> button.</p>
                        </Match>
                        <Match when={pages()}>
                            {(pages) => (
                                <table class="table border shadow-sm w-100" style="table-layout: fixed;">
                                    <thead>
                                        <tr>
                                            <th style="width: 5%;"></th>
                                            <th scope="col" style="width: 25%;">Name</th>
                                            <th scope="col" style="width: 25%;">Key</th>
                                            <th scope="col" style="width: 55%;">Paths</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <For each={pages()}>
                                            {(group) => (
                                                <tr>
                                                    <td></td>
                                                    <td><A href={`/pages/view/${namespace() ? `${namespace()}/${group.key}` : group.key}`}>{group.name}</A></td>
                                                    <td>{group.key}</td>
                                                    <td>
                                                        <For each={group.pages}>
                                                            {(page) => (<p class="m-0">{page.path} ({page.locale ? `${page.locale}` : '-'})</p>)}
                                                        </For>
                                                    </td>
                                                </tr>
                                            )}
                                        </For>
                                    </tbody>
                                </table>
                            )}
                        </Match>
                    </Switch>

                    <h5 class="mt-5">Global Pages</h5>
                    <hr />

                    <Switch>
                        <Match when={globalPages.loading}>
                            <p class="icon-link justify-content-center w-100"><ProgressSpinner show={true} /> Loading ...</p>
                        </Match>
                        <Match when={globalPages.error}>
                            <p class="text-danger-emphasis text-center">Error while fetching global pages: <strong>{globalPages.error.message}</strong></p>
                        </Match>
                        <Match when={globalPages()?.length === 0}>
                            <p class="text-secondary text-center">There is no <strong>global</strong> page to display.</p>
                        </Match>
                        <Match when={globalPages()}>
                            {(pages) => (
                                <table class="table border shadow-sm w-100" style="table-layout: fixed;">
                                    <thead>
                                        <tr>
                                            <th style="width: 5%;"></th>
                                            <th scope="col" style="width: 25%;">Name</th>
                                            <th scope="col" style="width: 25%;">Key</th>
                                            <th scope="col" style="width: 55%;">Paths</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <For each={pages()}>
                                            {(group) => (
                                                <tr>
                                                    <td></td>
                                                    <td><A href={`/pages/view/${group.key}`}>{group.name}</A></td>
                                                    <td>{group.key}</td>
                                                    <td>
                                                        <For each={group.pages}>
                                                            {(page) => (<p class="m-0">{page.path} ({page.locale ? `${page.locale}` : '-'})</p>)}
                                                        </For>
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
        </div >
    );
};

export const Page = () => {
    enum Action {
        UpdateDetails,
    }

    enum ValidationError {
        Name,
    }

    const alertCtx = useContext(AlertContext)!;
    const appearanceCtx = useContext(AppearanceContext)!;
    const commonCtx = useContext(CommonContext)!;
    const params = useParams();
    const navigate = useNavigate();

    const namespace = createMemo(() => params.namespace as string | undefined);
    const [group, { mutate }] = createResource(() => ({ key: params.key, namespace: namespace() }), ({ key, namespace }) => appearanceCtx.fetchPage(key, namespace).then((pages) => {
        const group = groupPages(pages);

        if (group.length === 0) {
            return undefined;
        }

        return group[0];
    }));

    const [deleting, setDeleting] = createSignal(undefined as { key: string, path: string, locale: string | null, namespace?: string } | undefined);

    const [inProgress, setInProgress] = createSignal(undefined as Action | undefined);

    const [pageDetails, setPageDetails] = createStore({ name: '', desc: '' });
    const [editingDetails, setEditingDetails] = createSignal(false);

    createEffect(() => setPageDetails({ name: group()?.name ?? '', desc: group()?.desc ?? '' }));

    const [validationErrors, setValidationErrors] = createSignal(new Set<ValidationError>());

    const updateDetails = () => {
        const g = group();

        if (inProgress() !== undefined || !g) {
            return;
        }

        const errors = new Set<ValidationError>();
        const req = { name: pageDetails.name.trim(), desc: pageDetails.desc.trim() || null };

        if (req.name.length === 0) {
            errors.add(ValidationError.Name);
        }

        setValidationErrors(errors);

        if (errors.size > 0) {
            return;
        }

        setInProgress(Action.UpdateDetails);

        appearanceCtx.updatePage(
            g.key,
            req,
            namespace(),
        )
            .then(() => {
                setEditingDetails(false);

                alertCtx.success(`Page "${req.name}" is updated successfully`);

                mutate({ ...g, name: req.name, desc: req.desc });
            })
            .catch((e) => alertCtx.fail(e.message))
            .finally(() => setInProgress(undefined));
    };

    const deletePage = async (key: string, path: string, locale: string | null, namespace?: string) => {
        return appearanceCtx.deletePage(key, locale, namespace)
            .then(() => {
                setDeleting(undefined);

                alertCtx.success(`Page entry "${path} (${locale ?? '-'})" is deleted successfully`);

                const g = group();

                if (!g) {
                    return;
                }

                if (g.pages.length === 1) {
                    navigate('/pages', { replace: true });
                } else {
                    mutate({ ...g, pages: g.pages.filter((p) => p.locale !== locale) });
                }
            });
    };

    return (
        <div class="container py-4 px-md-4">
            <Switch>
                <Match when={group.loading}>
                    <p class="icon-link justify-content-center w-100"><ProgressSpinner show={true} /> Loading ...</p>
                </Match>
                <Match when={group.error}>
                    <p class="text-danger-emphasis text-center">Error while fetching page: <strong>{group.error.message}</strong></p>
                </Match>
                <Match when={group.state === 'ready' && group() === undefined}>
                    <p class="text-secondary text-center">Could not find the page with key {params.key}.</p>
                </Match>
                <Match when={group()}>
                    {(group) => (
                        <>
                            <div class="mb-5">
                                <h2 class="m-0">{group().name}</h2>
                                <small>Page</small>
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
                                                        <Show when={editingDetails()} fallback={group().name}>
                                                            <input
                                                                id="pageName"
                                                                type="text"
                                                                class="form-control float-end"
                                                                classList={{ 'is-invalid': validationErrors().has(ValidationError.Name) }}
                                                                name="name"
                                                                value={pageDetails.name}
                                                                onInput={(ev) => setPageDetails('name', ev.target.value)}
                                                            />
                                                        </Show>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td style="width: 25%">Key</td>
                                                    <td class="text-end" classList={{ 'py-1': editingDetails() }}>
                                                        <Show when={editingDetails()} fallback={group().key}>
                                                            <input
                                                                id="pageKey"
                                                                type="text"
                                                                class="form-control float-end"
                                                                name="key"
                                                                value={group().key}
                                                                disabled
                                                            />
                                                        </Show>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td style="width: 25%">Namespace</td>
                                                    <td class="text-end" classList={{ 'py-1': editingDetails() }}>
                                                        <Show when={editingDetails()} fallback={namespace() ?? '-'}>
                                                            <input
                                                                id="pageNamespace"
                                                                type="text"
                                                                class="form-control float-end"
                                                                name="namespace"
                                                                value={namespace() ?? '-'}
                                                                disabled
                                                            />
                                                        </Show>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td style="width: 25%">Description</td>
                                                    <td class="text-end" classList={{ 'py-1': editingDetails() }}>
                                                        <Show when={editingDetails()} fallback={group().desc ?? '-'}>
                                                            <textarea
                                                                id="pageDesc"
                                                                class="form-control"
                                                                rows="3"
                                                                value={pageDetails.desc}
                                                                onInput={(ev) => setPageDetails('desc', ev.target.value)}
                                                            ></textarea>
                                                        </Show>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td>Localized</td>
                                                    <td class="text-end">{group().pages.find((p) => p.locale) ? 'Yes' : 'No'}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div class="offset-md-1 col-md-5">
                                    <div class="border rounded p-3">
                                        <div class="d-flex align-items-center">
                                            <h5 class="flex-grow-1 m-0">Entries</h5>
                                            <Show when={group().pages.length < commonCtx.activeLocales().length && group().pages.find((p) => p.locale)}>
                                                <A
                                                    href={`/pages/create?key=${group().key}&name=${encodeURIComponent(group().name)}${group().desc ? `&desc=${encodeURIComponent(group().desc as string)}` : ''}${namespace() ? `&namespace=${namespace()}` : ''}`}
                                                    class="btn icon-link"
                                                >
                                                    <PlusLg viewBox="0 0 16 16" />
                                                    Create Entry
                                                </A>
                                            </Show>
                                        </div>

                                        <hr />

                                        <table class="table w-100">
                                            <thead>
                                                <tr>
                                                    <th scope="col">Path</th>
                                                    <th scope="col">Locale</th>
                                                    <th scope="col">Template</th>
                                                    <th></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <For each={group().pages}>
                                                    {(page) => (
                                                        <tr>
                                                            <td>{page.path}</td>
                                                            <td>{page.locale ?? '-'}</td>
                                                            <td>{page.template}</td>
                                                            <td class="text-end">
                                                                <button
                                                                    class="btn text-danger icon-link px-1"
                                                                    onClick={() => setDeleting({ key: group().key, path: page.path, locale: page.locale, namespace: namespace() })}
                                                                >
                                                                    <XLg viewBox="0 0 16 16" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </For>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </Match>
            </Switch>

            <Show when={deleting()}>
                {(deleting) => (
                    <DeleteConfirmModal
                        message={
                            <p>Are you sure about deleting the page entry <strong>{deleting().path} ({deleting().locale ?? '-'})</strong>? This action will also delete the page if the entry is the last one.</p>
                        }
                        close={() => setDeleting(undefined)}
                        confirm={() => deletePage(deleting().key, deleting().path, deleting().locale, deleting().namespace)}
                    />
                )}
            </Show>
        </div >
    );
}
