import { createEffect, createMemo, createResource, createSignal, For, Match, onCleanup, Show, Switch, useContext } from "solid-js";
import { FloppyFill, PencilSquare, PlusLg, ThreeDotsVertical, Trash } from "../Icons";
import { AdminContext } from "../lib/admin/context";
import { AlertContext, BaseContext } from "../lib/context";
import { dropdownClickListener } from "../lib/utils";
import { A, useNavigate, useParams } from "@solidjs/router";
import { HttpError } from "../lib/api";
import { LocationKind, Location } from "../lib/admin/models";
import ProgressSpinner from "../components/ProgressSpinner";
import type { Locale as LocaleModel } from "../lib/models";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import { createStore } from "solid-js/store";

export const CreateLocale = () => {
    enum ValidationError {
        Name,
        Key
    }

    const alertCtx = useContext(AlertContext)!;
    const baseCtx = useContext(BaseContext)!;
    const adminCtx = useContext(AdminContext)!;
    const navigate = useNavigate();

    const [name, setName] = createSignal('');
    const [key, setKey] = createSignal('');

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
        const req = { name: name().trim(), key: key().trim() };

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

        adminCtx.createLocale(req)
            .then(() => baseCtx.loadLocales())
            .then(() => {
                alertCtx.success(`Locale "${req.name}" is created successfully`);

                navigate(`/locales/view/${req.key}`, { replace: true });
            })
            .catch((e) => {
                if (e instanceof HttpError) {
                    setServerError(e.message);
                } else {
                    alertCtx.fail(e.message);
                }
            })
            .finally(() => setInProgress(false));
    }

    return (
        <div class="container py-4 px-md-4">
            <h2 class="mb-5">Create Locale</h2>
            <div class="row">
                <form class="offset-md-4 col-md-4" onSubmit={onSubmit}>
                    <div class="border rounded p-3">
                        <div class="mb-4">
                            <label for="localeName" class="form-label">Name</label>
                            <input
                                type="text"
                                id="localeName"
                                class="form-control"
                                classList={{ 'is-invalid': validationErrors().has(ValidationError.Name) }}
                                name="name"
                                placeholder="Name of locale, e.g. English"
                                value={name()}
                                onInput={(ev) => setName(ev.target.value)}
                            />
                            <Show when={validationErrors().has(ValidationError.Name)}>
                                <small class="invalid-feedback">Please enter name.</small>
                            </Show>
                        </div>

                        <div class="mb-4">
                            <label for="localeKey" class="form-label">Key</label>
                            <input
                                type="text"
                                id="localeKey"
                                class="form-control"
                                classList={{ 'is-invalid': validationErrors().has(ValidationError.Key) }}
                                name="key"
                                placeholder="Key of locale, e.g. en"
                                value={key()}
                                onInput={(ev) => setKey(ev.target.value)}
                            />
                            <Show when={validationErrors().has(ValidationError.Key)}>
                                <small class="invalid-feedback">Please enter key for locale.</small>
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

export const LocaleResource = () => {
    let editorRef: HTMLElement | undefined = undefined;

    const adminCtx = useContext(AdminContext)!;
    const alertCtx = useContext(AlertContext)!;
    const baseCtx = useContext(BaseContext)!;
    const params = useParams();

    const location = createMemo(() => Location.fromParams(params.kind, params.namespace));
    const locale = createMemo(() => baseCtx.locales().find((l) => l.key === params.key));

    const [resource] = createResource(
        () => {
            const lc = locale();
            const lt = location();

            if (lc && lt) {
                return { locale: lc, location: lt };
            }

            return undefined;
        },
        ({ locale, location }) => adminCtx.fetchLocaleResource(locale.key, location).then((resource) => resource ?? { resource: '' })
    );

    const [editor] = createResource(async () => import('ace-code').then((ace) => ace.edit(editorRef)));

    createEffect(() => {
        const r = resource();
        const e = editor();

        if (r && e) {
            e.setValue(r.resource);

            e.setReadOnly(location()?.kind === LocationKind.Theme);
        }
    });

    const [inProgress, setInProgress] = createSignal(false);

    const save = () => {
        const lc = locale();
        const lt = location();
        const e = editor();

        if (inProgress() || !lc || !lt || !e) {
            return;
        }

        if (lt.kind === LocationKind.Theme) {
            alertCtx.fail('Cannot modify theme\'s own resource');

            return;
        }

        setInProgress(true);

        adminCtx.updateLocaleResource(lc.key, e.getValue(), lt.namespace)
            .then(() => alertCtx.success(`Translations of "${lc.name}" locale is updated successfully`))
            .catch((e) => alertCtx.fail(e.message))
            .finally(() => setInProgress(false));
    };

    return (
        <div class="container d-flex flex-column flex-grow-1 py-4 px-md-4">
            <Switch>
                <Match when={!locale()}>
                    <p class="text-secondary text-center">Could not find the locale with key <strong>{params.key}</strong>.</p>
                </Match>
                <Match when={!location()}>
                    <p class="text-secondary text-center">Unknown kind <strong>{params.kind}</strong> found in path or the namespace missing.</p>
                </Match>
                <Match when={editor.loading || resource.loading}>
                    <p class="icon-link justify-content-center w-100"><ProgressSpinner show={true} /> Loading ...</p>
                </Match>
                <Match when={editor.error || resource.error}>
                    <p class="text-danger-emphasis text-center">Error while setting up editor: <strong>{editor.error?.message} {resource.error?.message}</strong></p>
                </Match>
                <Match when={locale() && location() ? { locale: locale()!, location: location()! } : undefined}>
                    {(localeAndLocation) => (
                        <>
                            <div class="d-flex align-items-center mb-4">
                                <div class="flex-grow-1">
                                    <h2 class="m-0">{localeAndLocation().locale.name}</h2>
                                    <Switch>
                                        <Match when={localeAndLocation().location.kind === LocationKind.Global}>
                                            <small>Global Translations</small>
                                        </Match>
                                        <Match when={localeAndLocation().location.kind === LocationKind.Theme}>
                                            <small>Theme's <strong>({localeAndLocation().location.namespace})</strong> Translations</small>
                                        </Match>
                                        <Match when={localeAndLocation().location.kind === LocationKind.User}>
                                            <small>Theme <strong>({localeAndLocation().location.namespace})</strong> Scoped Translations</small>
                                        </Match>
                                    </Switch>
                                </div>

                                <button class="btn btn-primary icon-link ms-2" onClick={save} disabled={inProgress() || localeAndLocation().location.kind === LocationKind.Theme}>
                                    <ProgressSpinner show={inProgress()} />
                                    <FloppyFill viewBox="0 0 16 16" />
                                    Save
                                </button>
                            </div>
                            <Show when={localeAndLocation().location.kind === LocationKind.Theme}>
                                <div class="alert alert-primary" role="alert">
                                    Theme's translations cannot be modified. You need to override their values either globally or scoped to each theme.
                                </div>
                            </Show>
                        </>
                    )}
                </Match>
            </Switch>

            <div class="flex-grow-1 w-100" ref={editorRef} classList={{ 'd-none': !locale() || !location() }}></div>
        </div>
    );
}

export const Locale = () => {
    enum Action {
        UpdateDetails,
    }

    enum ValidationError {
        Name,
    }

    const alertCtx = useContext(AlertContext)!;
    const adminCtx = useContext(AdminContext)!;
    const baseCtx = useContext(BaseContext)!;
    const navigate = useNavigate();
    const params = useParams();

    const locale = createMemo(() => baseCtx.locales().find((l) => l.key === params.key));
    const [themes] = createResource(() => adminCtx.fetchThemes());

    const [localeDetails, setLocaleDetails] = createStore({ name: '' });
    const [editingDetails, setEditingDetails] = createSignal(false);

    createEffect(() => setLocaleDetails({ name: locale()?.name }));

    const [deletingLocale, setDeletingLocale] = createSignal(false);

    const [inProgress, setInProgress] = createSignal(undefined as Action | undefined);

    const [validationErrors, setValidationErrors] = createSignal(new Set<ValidationError>());

    const [dropdown, setDropdown] = createSignal(false);
    onCleanup(dropdownClickListener('locale-detail-dropdown', () => setDropdown(false), () => !deletingLocale()));

    const updateDetails = () => {
        const l = locale();

        if (inProgress() !== undefined || !l) {
            return;
        }

        const errors = new Set<ValidationError>();
        const req = { name: localeDetails.name.trim() };

        if (req.name.length === 0) {
            errors.add(ValidationError.Name);
        }

        setValidationErrors(errors);

        if (errors.size > 0) {
            return;
        }

        setInProgress(Action.UpdateDetails);

        adminCtx.updateLocale(
            l.key,
            req
        )
            .then(() => baseCtx.loadLocales())
            .then(() => {
                setEditingDetails(false);

                alertCtx.success(`Locale "${req.name}" is updated successfully`);
            })
            .catch((e) => alertCtx.fail(e.message))
            .finally(() => setInProgress(undefined));
    };

    const deleteLocale = async (locale: LocaleModel) => {
        return adminCtx.deleteLocale(locale.key)
            .then(() => baseCtx.loadLocales())
            .then(() => {
                setDeletingLocale(false);

                alertCtx.success(`Locale "${locale.name}" is deleted successfully`);

                navigate('/locales', { replace: true });
            });
    }

    return (
        <div class="container py-4 px-md-4">
            <Show when={locale()} fallback={
                <p class="text-secondary text-center">Could not find the locale with key <strong>{params.key}</strong>.</p>
            }>
                {(locale) => (
                    <>
                        <div class="d-flex align-items-center mb-5">
                            <div class="flex-grow-1">
                                <h2 class="m-0">{locale().name}</h2>
                                <small>Locale</small>
                            </div>
                            <div class="dropdown mx-2">
                                <button class="btn icon-link px-1" on:click={(ev) => { ev.stopPropagation(); setDropdown(!dropdown()); }}>
                                    <ThreeDotsVertical viewBox="0 0 16 16" />
                                </button>
                                <ul id="locale-detail-dropdown" class="dropdown-menu mt-1 shadow" style="right: 0;" classList={{ 'show': dropdown() }}>
                                    <li>
                                        <button class="dropdown-item text-danger icon-link py-2" onClick={() => setDeletingLocale(true)}>
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

                                    <table class="table table-borderless w-100 m-0">
                                        <tbody>
                                            <tr>
                                                <td style="width: 25%">Name</td>
                                                <td class="text-end" classList={{ 'py-1': editingDetails() }}>
                                                    <Show when={editingDetails()} fallback={locale().name}>
                                                        <input
                                                            id="localeName"
                                                            type="text"
                                                            class="form-control float-end w-auto"
                                                            classList={{ 'is-invalid': validationErrors().has(ValidationError.Name) }}
                                                            name="name"
                                                            value={localeDetails.name}
                                                            onInput={(ev) => setLocaleDetails('name', ev.target.value)}
                                                        />
                                                    </Show>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td>Key</td>
                                                <td class="text-end" classList={{ 'py-1': editingDetails() }}>
                                                    <Show when={editingDetails()} fallback={locale().key}>
                                                        <input
                                                            id="localeKey"
                                                            type="text"
                                                            class="form-control float-end w-auto"
                                                            name="key"
                                                            value={locale().key}
                                                            disabled={true}
                                                        />
                                                    </Show>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div class="offset-md-1 col-md-5">
                                <div class="border rounded p-3">
                                    <h5 class="m-0">Translations</h5>

                                    <hr />

                                    <Switch>
                                        <Match when={themes.loading}>
                                            <p class="icon-link justify-content-center w-100"><ProgressSpinner show={true} /> Loading Resources ...</p>
                                        </Match>
                                        <Match when={themes.error}>
                                            <p class="text-danger-emphasis text-center">Error while fetching themes: <strong>{themes.error.message}</strong></p>
                                        </Match>
                                        <Match when={themes()}>
                                            {(themes) => (
                                                <table class="table w-100">
                                                    <tbody>
                                                        <tr>
                                                            <td>Global</td>
                                                            <td></td>
                                                            <td class="text-end">
                                                                <A href={`/locales/resource/${locale().key}/${LocationKind.Global}`} class="icon-link">
                                                                    <PencilSquare viewBox="0 0 16 16" />
                                                                </A>
                                                            </td>
                                                        </tr>
                                                        <For each={themes()}>
                                                            {(theme) => (
                                                                <tr>
                                                                    <td>
                                                                        <Show when={baseCtx.options().theme === theme.id} fallback={theme.id}>
                                                                            <strong>
                                                                                {theme.id}
                                                                                &nbsp
                                                                                (Active Theme)
                                                                            </strong>
                                                                        </Show>
                                                                    </td>
                                                                    <td>
                                                                        <A href={`/locales/resource/${locale().key}/${LocationKind.Theme}/${theme.id}`} class="mx-3">
                                                                            Theme's Translations
                                                                        </A>
                                                                    </td>
                                                                    <td class="text-end">
                                                                        <A href={`/locales/resource/${locale().key}/${LocationKind.User}/${theme.id}`} class="icon-link">
                                                                            <PencilSquare viewBox="0 0 16 16" />
                                                                        </A>
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
                        </div>
                        <Show when={deletingLocale()}>
                            <DeleteConfirmModal
                                message={<p>Are you sure about deleting the locale <strong>{locale().name} ({locale().key})</strong>?</p>}
                                close={() => setDeletingLocale(false)}
                                confirm={() => deleteLocale(locale())}
                            />
                        </Show>
                    </>
                )}
            </Show >
        </div >
    );
};

export const Locales = () => {
    enum Action {
        UpdateState,
        SetDefault,
    }

    const adminCtx = useContext(AdminContext)!;
    const alertCtx = useContext(AlertContext)!;
    const baseCtx = useContext(BaseContext)!

    const [item, setItem] = createSignal(undefined as string | undefined);

    const [inProgress, setInProgress] = createSignal(undefined as Action | undefined);

    onCleanup(dropdownClickListener('locale-quick-action', () => setItem(undefined), () => inProgress() === undefined));

    const updateLocaleState = (locale: LocaleModel, disabled: boolean) => {
        if (inProgress() !== undefined) {
            return;
        }

        setInProgress(Action.UpdateState);

        adminCtx.updateLocaleState(locale.key, disabled)
            .then(() => baseCtx.loadLocales())
            .then(() => {
                setItem(undefined);

                alertCtx.success(`Locale "${locale.name}" is ${disabled ? 'disabled' : 'enabled'} successfully`);
            })
            .catch((e) => alertCtx.fail(e.message))
            .finally(() => setInProgress(undefined));
    };

    const setLocaleDefault = (locale: LocaleModel) => {
        if (inProgress() !== undefined) {
            return;
        }

        setInProgress(Action.SetDefault);

        adminCtx.setLocaleDefault(locale.key)
            .then(() => baseCtx.loadOptions())
            .then(() => {
                setItem(undefined);

                alertCtx.success(`Locale "${locale.name}" is set as default successfully`);
            })
            .catch((e) => alertCtx.fail(e.message))
            .finally(() => setInProgress(undefined));
    };

    return (
        <div class="container py-4 px-md-4">
            <div class="d-flex align-items-center mb-5">
                <h1 class="flex-grow-1 m-0">Locales</h1>
                <A class="btn btn-outline-primary icon-link" href="/locales/create">
                    <PlusLg viewBox="0 0 16 16" />
                    Create Locale
                </A>
            </div>

            <Show when={baseCtx.locales().length > 0} fallback={
                <p class="text-secondary text-center">There is no locale to display yet. You can create a new one by using <strong>Create Locale</strong> button.</p>
            }>
                <div class="row">
                    <div class="offset-md-3 col-md-6">
                        <table class="table table-hover border shadow-sm">
                            <thead>
                                <tr>
                                    <th></th>
                                    <th scope="col">Name</th>
                                    <th scope="col">Key</th>
                                    <th></th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                <For each={baseCtx.locales()}>
                                    {(locale) => (
                                        <tr>
                                            <td></td>
                                            <td>
                                                <A href={`/locales/view/${locale.key}`}>
                                                    {locale.name}
                                                </A>
                                            </td>
                                            <td>{locale.key}</td>
                                            <td class="text-center">
                                                <Show when={locale.key === baseCtx.options().defaultLocale}>
                                                    <span class="badge border rounded-pill border-success text-success ms-2">Default</span>
                                                </Show>
                                                <Show when={locale.disabled}>
                                                    <span class="badge border rounded-pill border-danger text-danger ms-2">Disabled</span>
                                                </Show>
                                            </td>
                                            <td class="dropdown text-end">
                                                <button class="btn icon-link px-1" on:click={(ev) => { ev.stopPropagation(); setItem(item() !== locale.key ? locale.key : undefined) }}>
                                                    <ThreeDotsVertical viewBox="0 0 16 16" />
                                                </button>
                                                <Show when={item() === locale.key}>
                                                    <ul class="dropdown-menu show" id="locale-quick-action" style="right: 0">
                                                        <li>
                                                            <button
                                                                class="dropdown-item icon-link"
                                                                disabled={inProgress() === Action.SetDefault || locale.key === baseCtx.options().defaultLocale || locale.disabled}
                                                                on:click={(ev) => { ev.stopPropagation(); setLocaleDefault(locale); }}
                                                            >
                                                                <ProgressSpinner show={inProgress() === Action.SetDefault} />
                                                                Set as Default
                                                            </button>
                                                        </li>
                                                        <Show when={locale.key !== baseCtx.options().defaultLocale}>
                                                            <li>
                                                                <button
                                                                    class="dropdown-item icon-link"
                                                                    disabled={inProgress() === Action.UpdateState}
                                                                    on:click={(ev) => { ev.stopPropagation(); updateLocaleState(locale, !locale.disabled); }}
                                                                >
                                                                    <ProgressSpinner show={inProgress() === Action.UpdateState} />
                                                                    {locale.disabled ? 'Enable' : 'Disable'}
                                                                </button>
                                                            </li>
                                                        </Show>
                                                    </ul>
                                                </Show>
                                            </td>
                                        </tr>
                                    )}
                                </For>
                            </tbody>
                        </table>
                    </div>
                </div>
            </Show>
        </div>
    );
};
