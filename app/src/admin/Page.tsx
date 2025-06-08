import { createResource, createSignal, For, Match, Show, Suspense, Switch, useContext } from "solid-js";
import { AdminContext } from "../lib/admin/context";
import { Plus, PlusLg } from "../Icons";
import { A, useNavigate } from "@solidjs/router";
import { ContentContext } from "../lib/content/context";
import { HttpError } from "../lib/api";
import { AlertContext } from "../lib/context";

interface PageGroup {
    name: string,
    locales: string[] | undefined,
}

export const CreatePage = () => {
    function unique<T>(list: T[]): T[] {
        return list.filter((el, idx) => list.findIndex((e) => e === el) === idx);
    }

    enum Scope {
        Global,
        Theme
    }

    enum ValidationError {
        Name,
        Path,
        Template,
    }

    const adminCtx = useContext(AdminContext)!;
    const alertCtx = useContext(AlertContext)!;
    const contentCtx = useContext(ContentContext)!;
    const navigate = useNavigate();

    const [name, setName] = createSignal('');
    const [path, setPath] = createSignal('');
    const [template, setTemplate] = createSignal('');
    const [locale, setLocale] = createSignal('');
    const [scope, setScope] = createSignal(Scope.Global);

    const [templates] = createResource(() => adminCtx.fetchTemplates().then((templates) => unique(templates)));

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

        if (path().trim().length === 0) {
            errors.add(ValidationError.Path);
        }

        if (template().trim().length === 0) {
            errors.add(ValidationError.Template);
        }

        setValidationErrors(errors);

        if (errors.size > 0) {
            return;
        }

        setInProgress(true);

        adminCtx.createPage(name(), path(), template(), scope() === Scope.Theme, locale() || null)
            .then(() => {
                alertCtx.success('Page is created successfully');
                navigate('/pages');
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
        <div class="container mt-4 px-md-4">
            <div class="d-flex align-items-center mb-4">
                <h2>Create Page</h2>
            </div>
            <div class="row m-0">
                <form class="offset-md-4 col-md-4 p-3 card" onSubmit={onSubmit}>
                    <div class="form-floating mb-4">
                        <input
                            id="pageName"
                            type="text"
                            name="name"
                            placeholder="Name"
                            class="form-control"
                            classList={{ 'is-invalid': validationErrors().has(ValidationError.Name) }}
                            value={name()}
                            onChange={(ev) => setName(ev.target.value)}
                        />
                        <label for="pageName" class="form-label">Name</label>
                        <Show when={validationErrors().has(ValidationError.Name)}>
                            <small class="invalid-feedback">Please specify a name for page.</small>
                        </Show>
                    </div>

                    <div class="form-floating mb-4">
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
                        <label for="pagePath" class="form-label">Path</label>
                        <Show when={validationErrors().has(ValidationError.Path)}>
                            <small class="invalid-feedback">Please specify a path for page.</small>
                        </Show>
                    </div>

                    <div class="form-floating mb-4">
                        <select
                            id="pageTemplate"
                            name="template"
                            class="form-select"
                            classList={{ 'is-invalid': validationErrors().has(ValidationError.Template) }}
                            value={template()}
                            onChange={(ev) => setTemplate(ev.target.value)}
                        >
                            <Suspense fallback={<option value="" disabled selected>Loading...</option>}>
                                <option value="" disabled selected>Select a template</option>
                                <For each={templates() ?? []}>
                                    {(template) => (
                                        <option value={template.path}>{template.path}</option>
                                    )}
                                </For>
                            </Suspense>
                        </select>
                        <label for="pageTemplate" class="form-label">Template</label>
                        <Show when={validationErrors().has(ValidationError.Template)}>
                            <small class="invalid-feedback">Please select a template.</small>
                        </Show>
                    </div>

                    <div class="mb-4" role="group">
                        <label class="form-label">Scope</label>
                        <div class="btn-group w-100">
                            <input
                                id="pageScopeGlobal"
                                type="radio"
                                name="scope"
                                class="btn-check"
                                autocomplete="off"
                                checked={scope() === Scope.Global}
                                onChange={() => setScope(Scope.Global)}
                            />
                            <label class="btn btn-outline-secondary" for="pageScopeGlobal">Global</label>

                            <input
                                id="pageScopeTheme"
                                type="radio"
                                name="scope"
                                class="btn-check"
                                autocomplete="off"
                                checked={scope() === Scope.Theme}
                                onChange={() => setScope(Scope.Theme)}
                            />
                            <label class="btn btn-outline-secondary" for="pageScopeTheme">Theme</label>
                        </div>
                    </div>

                    <div class="form-floating mb-4">
                        <select
                            id="pageLocale"
                            name="locale"
                            class="form-select"
                            value={locale()}
                            onChange={(ev) => setLocale(ev.target.value)}
                        >
                            <option value="" selected>Not localized</option>
                            <For each={contentCtx.activeLocales()}>
                                {(locale) => (
                                    <option value={locale.key}>{locale.name}</option>
                                )}
                            </For>
                        </select>
                        <label for="pageLocale" class="form-label">Locale</label>
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

export const Pages = () => {
    const adminCtx = useContext(AdminContext)!;
    const contentCtx = useContext(ContentContext)!;

    const [pageGroups] = createResource(() => adminCtx.fetchPages().then((pages) => {
        const map = new Map<string, PageGroup>();

        for (const page of pages) {
            if (!map.has(page.name)) {
                map.set(page.name, { name: page.name, locales: page.locale ? [] : undefined })
            }

            const group = map.get(page.name)!;

            if (group.locales && page.locale) {
                group.locales.push(page.locale);
            }
        }

        return Array.from(map.values());
    }));

    return (
        <div class="container py-4 px-md-4">
            <div class="d-flex align-items-center mb-4">
                <div class="flex-grow-1">
                    <h1>Pages</h1>
                </div>
                <A class="btn btn-outline-primary icon-link" href="/pages/create">
                    <PlusLg viewBox="0 0 16 16" />
                    Create Page
                </A>
            </div>

            <div class="row m-0">
                <Suspense>
                    <Switch>
                        <Match when={pageGroups.error}>
                            <span>Error: {pageGroups.error.message}</span>
                        </Match>
                        <Match when={pageGroups()}>
                            {(pageGroups) => (
                                <div class="offset-md-2 col-md-8 card p-3">
                                    <table class="table table-hover m-0">
                                        <thead>
                                            <tr>
                                                <th scope="col">Name</th>
                                                <th scope="col">Locale</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <For each={pageGroups()}>
                                                {(group) => (
                                                    <tr>
                                                        <td>{group.name}</td>
                                                        <td>
                                                            <Show when={group.locales}>
                                                                {(locales) => (
                                                                    <>
                                                                        {locales().join(', ')}
                                                                        <Show when={locales().length < contentCtx.activeLocales().length}>
                                                                            <A class="icon-link border rounded-circle ms-2 align-middle" style="padding: 0.1rem" href="/pages/create">
                                                                                <Plus viewBox="0 0 16 16" />
                                                                            </A>
                                                                        </Show>
                                                                    </>
                                                                )}
                                                            </Show>
                                                            <Show when={!group.locales}>
                                                                -
                                                            </Show>
                                                        </td>
                                                    </tr>
                                                )}
                                            </For>
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </Match>
                    </Switch>
                </Suspense>
            </div>
        </div>
    );
};
