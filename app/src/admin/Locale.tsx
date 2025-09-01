import { createEffect, createMemo, createResource, createSignal, For, Match, onCleanup, Show, Switch, useContext } from "solid-js";
import { FloppyFill, PencilSquare, PlusLg, ThreeDotsVertical, Trash } from "../Icons";
import { AdminContext } from "../lib/admin/context";
import { CommonContext } from "../lib/context";
import { AlertContext } from "../lib/alert";
import { dropdownClickListener } from "../lib/utils";
import { A, useNavigate, useParams } from "@solidjs/router";
import { HttpError } from "../lib/api";
import ProgressSpinner from "../components/ProgressSpinner";
import { NamespaceSource, type Locale as LocaleModel, LocationKind, Location } from "../lib/models";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import { createStore } from "solid-js/store";
import { LocaleContext } from "../lib/i18n";

export const CreateLocale = () => {
    enum ValidationError {
        Name,
        Key
    }

    const alertCtx = useContext(AlertContext)!;
    const commonCtx = useContext(CommonContext)!;
    const adminCtx = useContext(AdminContext)!;
    const localeCtx = useContext(LocaleContext)!;
    const navigate = useNavigate();

    const i18n = localeCtx.i18n.locale;

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
            .then(() => commonCtx.loadLocales())
            .then(() => {
                alertCtx.success(i18n.actions.localeCreated(req.name));

                navigate(`/locales/view/${req.key}`, { replace: true });
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
            <h2 class="mb-5">{i18n.actions.createLocale()}</h2>
            <div class="row">
                <form class="offset-md-4 col-md-4" onSubmit={onSubmit}>
                    <div class="border rounded p-3">
                        <div class="mb-4">
                            <label for="localeName" class="form-label">{localeCtx.i18n.common.labels.name()}</label>
                            <input
                                type="text"
                                id="localeName"
                                class="form-control"
                                classList={{ 'is-invalid': validationErrors().has(ValidationError.Name) }}
                                name="name"
                                placeholder={i18n.labels.namePlaceholder()}
                                value={name()}
                                onInput={(ev) => setName(ev.target.value)}
                            />
                            <Show when={validationErrors().has(ValidationError.Name)}>
                                <small class="invalid-feedback">{i18n.validationErrors.name()}.</small>
                            </Show>
                        </div>

                        <div class="mb-4">
                            <label for="localeKey" class="form-label">{localeCtx.i18n.common.labels.key()}</label>
                            <input
                                type="text"
                                id="localeKey"
                                class="form-control"
                                classList={{ 'is-invalid': validationErrors().has(ValidationError.Key) }}
                                name="key"
                                placeholder={i18n.labels.keyPlaceholder()}
                                value={key()}
                                onInput={(ev) => setKey(ev.target.value)}
                            />
                            <Show when={validationErrors().has(ValidationError.Key)}>
                                <small class="invalid-feedback">{i18n.validationErrors.key()}.</small>
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
                                {localeCtx.i18n.common.actions.add()}
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
    const commonCtx = useContext(CommonContext)!;
    const localeCtx = useContext(LocaleContext)!;
    const params = useParams();

    const i18n = localeCtx.i18n.locale;

    const location = createMemo(() => Location.fromParams(params.kind, params.namespace));
    const locale = createMemo(() => commonCtx.locales().find((l) => l.key === params.key));

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
            alertCtx.fail(i18n.cannotModifyThemeResource());

            return;
        }

        setInProgress(true);

        adminCtx.updateLocaleResource(lc.key, e.getValue(), lt.namespace)
            .then(() => alertCtx.success(i18n.actions.translationsUpdated(lc.name)))
            .catch((e) => alertCtx.fail(e.message))
            .finally(() => setInProgress(false));
    };

    return (
        <div class="container d-flex flex-column flex-grow-1 py-4 px-md-4" style="min-height: 100vh">
            <Switch>
                <Match when={!locale()}>
                    <p class="text-secondary text-center">{i18n.localeNotFound(params.key)}.</p>
                </Match>
                <Match when={!location()}>
                    <p class="text-secondary text-center">{i18n.unknownKind(params.kind)}.</p>
                </Match>
                <Match when={editor.loading || resource.loading}>
                    <p class="icon-link justify-content-center w-100"><ProgressSpinner show={true} /> Loading ...</p>
                </Match>
                <Match when={editor.error || resource.error}>
                    <p class="text-danger-emphasis text-center">{localeCtx.i18n.common.loadingItemError(i18n.labels.editor())}: <strong>{editor.error?.message} {resource.error?.message}</strong></p>
                </Match>
                <Match when={locale() && location() ? { locale: locale()!, location: location()! } : undefined}>
                    {(localeAndLocation) => (
                        <>
                            <div class="d-flex align-items-center mb-4">
                                <div class="flex-grow-1">
                                    <h2 class="m-0">{localeAndLocation().locale.name}</h2>
                                    <Switch>
                                        <Match when={localeAndLocation().location.kind === LocationKind.Global}>
                                            <small>{i18n.labels.globalTranslations()}</small>
                                        </Match>
                                        <Match when={localeAndLocation().location.kind === LocationKind.Theme}>
                                            <small>{i18n.labels.themeTranslations(localeAndLocation().location.namespace ?? '-')}</small>
                                        </Match>
                                        <Match when={localeAndLocation().location.kind === LocationKind.User}>
                                            <small>{i18n.labels.themeScopedTranslations(localeAndLocation().location.namespace ?? '-')}</small>
                                        </Match>
                                    </Switch>
                                </div>

                                <button class="btn btn-primary icon-link ms-2" onClick={save} disabled={inProgress() || localeAndLocation().location.kind === LocationKind.Theme}>
                                    <ProgressSpinner show={inProgress()} />
                                    <FloppyFill viewBox="0 0 16 16" />
                                    {localeCtx.i18n.common.actions.save()}
                                </button>
                            </div>
                            <Show when={localeAndLocation().location.kind === LocationKind.Theme}>
                                <div class="alert alert-primary" role="alert">{i18n.cannotModifyThemeResourceInfo()}</div>
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
    const commonCtx = useContext(CommonContext)!;
    const localeCtx = useContext(LocaleContext)!;
    const navigate = useNavigate();
    const params = useParams();

    const i18n = localeCtx.i18n.locale;

    const locale = createMemo(() => commonCtx.locales().find((l) => l.key === params.key));
    const themes = createMemo(() => commonCtx.namespaces().filter((ns) => ns.source === NamespaceSource.Theme));

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
            .then(() => commonCtx.loadLocales())
            .then(() => {
                setEditingDetails(false);

                alertCtx.success(i18n.actions.localeUpdated(req.name));
            })
            .catch((e) => alertCtx.fail(translateError(e.message)))
            .finally(() => setInProgress(undefined));
    };

    const deleteLocale = async (locale: LocaleModel) => {
        return adminCtx.deleteLocale(locale.key)
            .then(() => commonCtx.loadLocales())
            .then(() => {
                setDeletingLocale(false);

                alertCtx.success(i18n.actions.localeDeleted(locale.name));

                navigate('/locales', { replace: true });
            });
    }

    const translateError = (e: string) => {
        return (e in i18n.serverErrors)
            ? i18n.serverErrors[e as keyof typeof i18n.serverErrors]()
            : e;
    };

    return (
        <div class="container py-4 px-md-4">
            <Show when={locale()} fallback={
                <p class="text-secondary text-center">{i18n.localeNotFound(params.key)}.</p>
            }>
                {(locale) => (
                    <>
                        <div class="d-flex align-items-center mb-5">
                            <div class="flex-grow-1">
                                <h2 class="m-0">{locale().name}</h2>
                                <small>{localeCtx.i18n.common.labels.locale()}</small>
                            </div>
                            <div class="dropdown mx-2">
                                <button class="btn icon-link px-1" on:click={(ev) => { ev.stopPropagation(); setDropdown(!dropdown()); }}>
                                    <ThreeDotsVertical viewBox="0 0 16 16" />
                                </button>
                                <ul id="locale-detail-dropdown" class="dropdown-menu mt-1 shadow" style="right: 0;" classList={{ 'show': dropdown() }}>
                                    <li>
                                        <button class="dropdown-item text-danger icon-link py-2" onClick={() => setDeletingLocale(true)}>
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
                                                    <Show when={editingDetails()} fallback={locale().name}>
                                                        <input
                                                            id="localeName"
                                                            type="text"
                                                            class="form-control float-end"
                                                            classList={{ 'is-invalid': validationErrors().has(ValidationError.Name) }}
                                                            name="name"
                                                            value={localeDetails.name}
                                                            onInput={(ev) => setLocaleDetails('name', ev.target.value)}
                                                        />
                                                    </Show>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td>{localeCtx.i18n.common.labels.key()}</td>
                                                <td class="text-end" classList={{ 'py-1': editingDetails() }}>
                                                    <Show when={editingDetails()} fallback={locale().key}>
                                                        <input
                                                            id="localeKey"
                                                            type="text"
                                                            class="form-control float-end"
                                                            name="key"
                                                            value={locale().key}
                                                            disabled
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
                                    <h5 class="m-0">{i18n.labels.translations()}</h5>

                                    <hr />

                                    <table class="table w-100">
                                        <tbody>
                                            <tr>
                                                <td>{localeCtx.i18n.common.labels.global()}</td>
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
                                                            <Show when={commonCtx.options().theme === theme.key} fallback={theme.key}>
                                                                <strong>
                                                                    {theme.key}
                                                                    &nbsp
                                                                    ({localeCtx.i18n.common.labels.activeTheme()})
                                                                </strong>
                                                            </Show>
                                                        </td>
                                                        <td>
                                                            <A href={`/locales/resource/${locale().key}/${LocationKind.Theme}/${theme.key}`} class="mx-3">
                                                                {i18n.labels.themeTranslations2()}
                                                            </A>
                                                        </td>
                                                        <td class="text-end">
                                                            <A href={`/locales/resource/${locale().key}/${LocationKind.User}/${theme.key}`} class="icon-link">
                                                                <PencilSquare viewBox="0 0 16 16" />
                                                            </A>
                                                        </td>
                                                    </tr>
                                                )}
                                            </For>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                        <Show when={deletingLocale()}>
                            <DeleteConfirmModal
                                message={<p>{i18n.actions.confirmDelete(locale().name, locale().key)}?</p>}
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
    const commonCtx = useContext(CommonContext)!
    const localeCtx = useContext(LocaleContext)!;

    const i18n = localeCtx.i18n.locale;

    const [item, setItem] = createSignal(undefined as string | undefined);

    const [inProgress, setInProgress] = createSignal(undefined as Action | undefined);

    onCleanup(dropdownClickListener('locale-quick-action', () => setItem(undefined), () => inProgress() === undefined));

    const updateLocaleState = (locale: LocaleModel, disabled: boolean) => {
        if (inProgress() !== undefined) {
            return;
        }

        setInProgress(Action.UpdateState);

        adminCtx.updateLocaleState(locale.key, disabled)
            .then(() => commonCtx.loadLocales())
            .then(() => {
                setItem(undefined);

                alertCtx.success(disabled ? i18n.actions.localeDisabled(locale.name) : i18n.actions.localeEnabled(locale.name));
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
            .then(() => commonCtx.loadOptions())
            .then(() => {
                setItem(undefined);

                alertCtx.success(i18n.actions.setDefault(locale.name));
            })
            .catch((e) => alertCtx.fail(translateError(e.message)))
            .finally(() => setInProgress(undefined));
    };

    const translateError = (e: string) => {
        return (e in i18n.serverErrors)
            ? i18n.serverErrors[e as keyof typeof i18n.serverErrors]()
            : e;
    };

    return (
        <div class="container py-4 px-md-4">
            <div class="d-flex align-items-center mb-5">
                <h1 class="flex-grow-1 m-0">Locales</h1>
                <A class="btn btn-outline-primary icon-link" href="/locales/create">
                    <PlusLg viewBox="0 0 16 16" />
                    {i18n.actions.createLocale()}
                </A>
            </div>

            <Show when={commonCtx.locales().length > 0} fallback={
                <p class="text-secondary text-center">{i18n.noLocale()}.</p>
            }>
                <div class="row">
                    <div class="offset-md-3 col-md-6">
                        <table class="table table-hover border shadow-sm">
                            <thead>
                                <tr>
                                    <th></th>
                                    <th scope="col">{localeCtx.i18n.common.labels.name()}</th>
                                    <th scope="col">{localeCtx.i18n.common.labels.key()}</th>
                                    <th></th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                <For each={commonCtx.locales()}>
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
                                                <Show when={locale.key === commonCtx.options().defaultLocale}>
                                                    <span class="badge border rounded-pill border-success text-success ms-2">{localeCtx.i18n.common.labels.default()}</span>
                                                </Show>
                                                <Show when={locale.disabled}>
                                                    <span class="badge border rounded-pill border-danger text-danger ms-2">{localeCtx.i18n.common.labels.disabled()}</span>
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
                                                                disabled={inProgress() === Action.SetDefault || locale.key === commonCtx.options().defaultLocale || locale.disabled}
                                                                on:click={(ev) => { ev.stopPropagation(); setLocaleDefault(locale); }}
                                                            >
                                                                <ProgressSpinner show={inProgress() === Action.SetDefault} />
                                                                {i18n.actions.setAsDefault()}
                                                            </button>
                                                        </li>
                                                        <Show when={locale.key !== commonCtx.options().defaultLocale}>
                                                            <li>
                                                                <button
                                                                    class="btn dropdown-item icon-link"
                                                                    classList={{ 'text-danger': !locale.disabled }}
                                                                    disabled={inProgress() === Action.UpdateState}
                                                                    on:click={(ev) => { ev.stopPropagation(); updateLocaleState(locale, !locale.disabled); }}
                                                                >
                                                                    <ProgressSpinner show={inProgress() === Action.UpdateState} />
                                                                    {locale.disabled ? localeCtx.i18n.common.actions.enable() : localeCtx.i18n.common.actions.disable()}
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
