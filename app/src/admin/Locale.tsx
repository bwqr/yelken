import { createEffect, createMemo, createResource, createSignal, For, onCleanup, Show, useContext } from "solid-js";
import { ContentContext } from "../lib/content/context";
import { FloppyFill, PencilSquare, PlusLg, ThreeDotsVertical } from "../Icons";
import { AdminContext } from "../lib/admin/context";
import { AlertContext } from "../lib/context";
import { dropdownClickListener } from "../lib/utils";
import { A, useNavigate, useParams } from "@solidjs/router";
import { HttpError } from "../lib/api";
import { LocationKind } from "../lib/admin/models";

export const CreateLocale = () => {
    enum ValidationError {
        Name,
        Key
    }

    const alertCtx = useContext(AlertContext)!;
    const contentCtx = useContext(ContentContext)!;
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

        if (name().trim().length === 0) {
            errors.add(ValidationError.Name);
        }

        if (key().trim().length === 0) {
            errors.add(ValidationError.Key);
        }

        setValidationErrors(errors);

        if (errors.size > 0) {
            return;
        }

        setInProgress(true);

        adminCtx.createLocale(name(), key())
            .then(() => contentCtx.loadLocales())
            .then(() => {
                alertCtx.success('Locale is successfully created');
                navigate('/locales');
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
        <div class="container mt-4 px-md-4">
            <div class="d-flex align-items-center mb-4">
                <h2>Create Locale</h2>
            </div>
            <div class="row m-0">
                <form class="offset-md-4 col-md-4 p-3 card" onSubmit={onSubmit}>
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
                        <small class="text-danger mb-4">{serverError()}</small>
                    </Show>

                    <div class="d-flex justify-content-center">
                        <button type="submit" class="btn btn-primary icon-link justify-content-center mw-100" style="width: 250px;" disabled={inProgress()}>
                            <Show when={inProgress()}>
                                <div class="spinner-border" role="status">
                                    <span class="visually-hidden">Loading...</span>
                                </div>
                            </Show>
                            <PlusLg viewBox="0 0 16 16" />
                            Add
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export const Locale = () => {
    let editorRef: HTMLElement | undefined = undefined;

    const alertCtx = useContext(AlertContext)!;
    const adminCtx = useContext(AdminContext)!;
    const contentCtx = useContext(ContentContext)!;
    const params = useParams();

    const [kind, setKind] = createSignal(LocationKind.Theme);
    const locale = createMemo(() => contentCtx.locales().find((l) => l.key === params.key));

    const [inProgress, setInProgress] = createSignal(false);

    const [resource] = createResource(
        () => {
            const l = locale();
            const k = kind();

            if (l && k) {
                return { locale: l, kind: k };
            }

            return undefined;
        },
        ({ locale, kind }) => adminCtx.fetchLocaleResource(locale.key, kind).then((resource) => {
            if (resource === undefined) {
                return { resource: '', kind }
            }

            return resource;
        })
    );

    const [editor] = createResource(async () => {
        const ace = await import('ace-code');

        return ace.edit(editorRef);
    });

    createEffect(() => {
        const r = resource();
        const e = editor();

        if (r && e) {
            e.setValue(r.resource);
        }
    })

    const save = () => {
        const l = locale();
        const r = resource();
        const e = editor();

        if (inProgress() || !l || !e || !r) {
            return;
        }

        if (r.kind === LocationKind.Theme) {
            alertCtx.fail('Cannot modify theme\'s own resource');

            return;
        }

        setInProgress(true);

        adminCtx.updateLocaleResource(l.key, r.kind, e.getValue())
            .then(() => alertCtx.success('Resource is updated successfully'))
            .catch((e) => alertCtx.fail(e.message))
            .finally(() => setInProgress(false));
    }

    return (
        <div class="container d-flex flex-column flex-grow-1 py-4 px-md-4">
            <Show when={!locale()}>
                <p>Could not find the locale {params.key}.</p>
            </Show>

            <Show when={locale()}>
                {(locale) => (
                    <div class="d-flex align-items-center mb-4">
                        <div class="flex-grow-1">
                            <h2 class="m-0">{locale().name}</h2>
                            <small>Translations</small>
                        </div>

                        <select class="form-select" style="width: unset" value={kind()} onChange={(ev) => setKind(ev.target.value as LocationKind)}>
                            <For each={Object.entries(LocationKind)}>
                                {(kind) => (<option value={kind[1]}>{kind[0]}</option>)}
                            </For>
                        </select>

                        <button class="btn btn-primary icon-link ms-2" onClick={save} disabled={inProgress()}>
                            <Show when={inProgress()}>
                                <div class="spinner-border" role="status">
                                    <span class="visually-hidden">Loading...</span>
                                </div>
                            </Show>
                            <FloppyFill />
                            Save
                        </button>
                    </div>
                )}
            </Show >

            <Show when={editor.loading || resource.loading}>
                <span>Loading editor ...</span>
            </Show>

            <div class="flex-grow-1 w-100" ref={editorRef} classList={{ 'd-none': !locale() }}></div>
        </div>
    );
};

export const Locales = () => {
    enum Actions {
        UpdateState,
        SetDefault,
        Delete,
    }

    const contentCtx = useContext(ContentContext)!;
    const adminCtx = useContext(AdminContext)!;
    const alertCtx = useContext(AlertContext)!;

    const [item, setItem] = createSignal(undefined as string | undefined);
    const [inProgress, setInProgress] = createSignal(undefined as Actions | undefined);

    const dropdownRemove = dropdownClickListener('locale-quick-action', () => setItem(undefined), () => inProgress() !== undefined);

    window.document.addEventListener('click', dropdownRemove);
    onCleanup(() => window.document.removeEventListener('click', dropdownRemove));

    const updateLocaleState = (key: string, disabled: boolean) => {
        if (inProgress() !== undefined) {
            return;
        }

        setInProgress(Actions.UpdateState);

        adminCtx.updateLocaleState(key, disabled)
            .then(() => contentCtx.loadLocales())
            .then(() => {
                alertCtx.success(`Locale is ${disabled ? 'disabled' : 'enabled'} successfully`);
                setItem(undefined);
            })
            .catch((e) => alertCtx.fail(e.message))
            .finally(() => setInProgress(undefined));
    };

    const setLocaleDefault = (key: string) => {
        if (inProgress() !== undefined) {
            return;
        }

        setInProgress(Actions.SetDefault);

        adminCtx.setLocaleDefault(key)
            .then(() => contentCtx.loadOptions())
            .then(() => {
                alertCtx.success(`Locale is set as default successfully`);
                setItem(undefined);
            })
            .catch((e) => alertCtx.fail(e.message))
            .finally(() => setInProgress(undefined));
    };

    const deleteLocale = (key: string) => {
        if (inProgress() !== undefined) {
            return;
        }

        setInProgress(Actions.Delete);

        adminCtx.deleteLocale(key)
            .then(() => contentCtx.loadLocales())
            .then(() => {
                alertCtx.success(`Locale is deleted successfully`);
                setItem(undefined);
            })
            .catch((e) => alertCtx.fail(e.message))
            .finally(() => setInProgress(undefined));
    }

    return (
        <div class="container mt-4 px-md-4">
            <div class="d-flex align-items-center mb-4">
                <div class="flex-grow-1">
                    <h1>Locales</h1>
                </div>
                <A class="btn btn-outline-primary icon-link" href="/locales/create">
                    <PlusLg viewBox="0 0 16 16" />
                    Create Locale
                </A>
            </div>

            <div class="row m-0">
                <div class="offset-md-2 col-md-8 card p-3">
                    <table class="table table-hover m-0">
                        <thead>
                            <tr>
                                <th scope="col">Name</th>
                                <th scope="col">Key</th>
                                <th scope="col">State</th>
                                <th scope="col"></th>
                                <th scope="col"></th>
                                <th scope="col"></th>
                            </tr>
                        </thead>
                        <tbody>
                            <For each={contentCtx.locales()}>
                                {(locale) => (
                                    <tr>
                                        <td>{locale.name}</td>
                                        <td>{locale.key}</td>
                                        <td>
                                            <span
                                                class="badge border rounded-pill"
                                                classList={{ 'border-success text-success': !locale.disabled, 'border-danger text-danger': locale.disabled }}
                                            >
                                                {locale.disabled ? 'Disabled' : 'Enabled'}
                                            </span>
                                        </td>
                                        <td class="text-center">
                                            <Show when={locale.key === contentCtx.options().defaultLocale}>
                                                <span class="badge border rounded-pill border-link text-light-emphasis">Default</span>
                                            </Show>
                                        </td>
                                        <td class="text-center">
                                            <A href={`/locales/view/${locale.key}`} class="icon-link text-link">
                                                <PencilSquare />
                                                Translations
                                            </A>
                                        </td>
                                        <td class="dropdown text-end">
                                            <button class="btn icon-link" on:click={(ev) => { ev.stopPropagation(); setItem(item() !== locale.key ? locale.key : undefined) }}>
                                                <ThreeDotsVertical />
                                            </button>
                                            <Show when={item() === locale.key}>
                                                <ul class="dropdown-menu show" id="locale-quick-action" style="right: 0">
                                                    <li>
                                                        <button
                                                            class="dropdown-item icon-link"
                                                            disabled={inProgress() === Actions.SetDefault || locale.key === contentCtx.options().defaultLocale || locale.disabled}
                                                            on:click={(ev) => { ev.stopPropagation(); setLocaleDefault(locale.key); }}
                                                        >
                                                            <Show when={inProgress() === Actions.SetDefault}>
                                                                <div class="spinner-border" role="status">
                                                                    <span class="visually-hidden">Loading...</span>
                                                                </div>
                                                            </Show>
                                                            Set as Default
                                                        </button>
                                                    </li>
                                                    <Show when={locale.key !== contentCtx.options().defaultLocale}>
                                                        <li>
                                                            <button
                                                                class="dropdown-item icon-link"
                                                                disabled={inProgress() === Actions.UpdateState}
                                                                on:click={(ev) => { ev.stopPropagation(); updateLocaleState(locale.key, !locale.disabled); }}
                                                            >
                                                                <Show when={inProgress() === Actions.UpdateState}>
                                                                    <div class="spinner-border" role="status">
                                                                        <span class="visually-hidden">Loading...</span>
                                                                    </div>
                                                                </Show>
                                                                {locale.disabled ? 'Enable' : 'Disable'}
                                                            </button>
                                                        </li>
                                                        <li>
                                                            <button
                                                                class="dropdown-item icon-link text-danger"
                                                                disabled={inProgress() === Actions.Delete}
                                                                on:click={(ev) => { ev.stopPropagation(); deleteLocale(locale.key); }}
                                                            >
                                                                <Show when={inProgress() === Actions.Delete}>
                                                                    <div class="spinner-border" role="status">
                                                                        <span class="visually-hidden">Loading...</span>
                                                                    </div>
                                                                </Show>
                                                                Delete
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
        </div>
    );
};
