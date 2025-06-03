import { createResource, createSignal, For, Match, onCleanup, Show, Suspense, Switch, useContext } from "solid-js";
import { AdminContext } from "../lib/admin/context";
import { A, useNavigate } from "@solidjs/router";
import { ThreeDotsVertical, Upload } from "../Icons";
import { dropdownClickListener } from "../lib/utils";
import { ContentContext } from "../lib/content/context";
import { AlertContext } from "../lib/context";
import { Api, HttpError } from "../lib/api";

interface Manifest {
    id: string,
    version: string,
    name: string,
    models: {
        name: string,
        fields: {
            name: string,
            field: string,
            localized?: boolean,
            multiple?: boolean,
        }[]
    }[],
    contents: {
        name: string,
        model: string,
        values: {
            field: string,
            value: string,
            locale?: string,
        }[],
    }[],
    pages: {
        name: string,
        path: string,
        template: string,
        locale?: string,
    }[],
}

export const InstallTheme = () => {
    enum Actions {
        Analyze,
        Upload,
    }

    enum ValidationError {
        Theme,
    }

    const alertCtx = useContext(AlertContext)!;
    const navigate = useNavigate();

    const [manifest, setManifest] = createSignal(undefined as Manifest | undefined)
    const [theme, setTheme] = createSignal(undefined as File | undefined);

    const [inProgress, setInProgress] = createSignal(undefined as Actions | undefined);

    const [validationErrors, setValidationErrors] = createSignal(new Set<ValidationError>());
    const [analysisError, setAnalysisError] = createSignal(undefined as string | undefined);
    const [serverError, setServerError] = createSignal(undefined as string | undefined);

    const analyzeTheme = async (theme: File): Promise<Manifest> => {
        const { ZipReader, BlobReader, BlobWriter } = await import('@zip.js/zip.js');

        const reader = new ZipReader(new BlobReader(theme));

        try {
            for await (const entry of reader.getEntriesGenerator()) {
                if (entry.filename === 'Yelken.json' && entry.getData !== undefined) {
                    const data = await entry.getData(new BlobWriter());
                    const text = await data.text();
                    return JSON.parse(text);
                }
            }
        } catch (e) {
            console.error(e);
            throw new Error('Invalid theme file.');
        }

        throw new Error('Could not find manifest file.');
    };

    const themeChanged = (ev: Event & { target: HTMLInputElement }) => {
        const file = ev.target.files?.item(0);

        setTheme(undefined);
        setManifest(undefined);
        setAnalysisError(undefined);

        if (!file) {
            return;
        }

        setTheme(file);
        setInProgress(Actions.Analyze);

        analyzeTheme(file)
            .then((manifest) => setManifest(manifest))
            .catch((e) => setAnalysisError(e.message))
            .finally(() => setInProgress(undefined));
    }

    const onSubmit = (ev: SubmitEvent) => {
        ev.preventDefault();

        if (inProgress() !== undefined) {
            return;
        }

        setServerError(undefined);

        const errors = new Set<ValidationError>();

        if (theme() === undefined) {
            errors.add(ValidationError.Theme);
        }

        setValidationErrors(errors);

        if (errors.size > 0) {
            return;
        }

        setInProgress(Actions.Upload);

        const formdata = new FormData();
        formdata.append('theme', theme()!);

        Api.request('/admin/theme/theme', 'POST', { formdata })
            .then(() => {
                alertCtx.success('Theme is installed successfully');
                navigate('/themes');
            })
            .catch((e) => {
                if (e instanceof HttpError) {
                    setServerError(e.message);
                } else {
                    alertCtx.fail(e.message);
                }
            })
            .finally(() => setInProgress(undefined));
    }

    return (
        <div class="container mt-4 px-md-4">
            <div class="d-flex align-items-center mb-4">
                <h2>Install Theme</h2>
            </div>
            <div class="row m-0">
                <form class="offset-md-4 col-md-4 p-3 card" onSubmit={onSubmit}>
                    <div class="mb-4">
                        <label for="themeFile" class="form-label">Choose a theme file</label>
                        <input
                            id="themeFile"
                            type="file"
                            class="form-control"
                            classList={{ 'is-invalid': validationErrors().has(ValidationError.Theme) }}
                            disabled={inProgress() !== undefined}
                            onChange={themeChanged}
                        />
                        <Show when={validationErrors().has(ValidationError.Theme)}>
                            <small class="invalid-feedback">Please choose a theme file.</small>
                        </Show>
                    </div>

                    <Show when={inProgress() === Actions.Analyze}>
                        <div class="d-flex justify-contents-center mb-4">
                            <div class="spinner-border me-2" role="status">
                                <span class="visually-hidden">Loading...</span>
                            </div>
                            <span>Theme is being analyzed.</span>
                        </div>
                    </Show>
                    <Show when={analysisError()}>
                        {(error) => (<small class="text-danger mb-4">Analysis Error: {error()}</small>)}
                    </Show>
                    <Show when={manifest()}>
                        {(manifest) => (
                            <table class="table mb-4 w-100 caption-top">
                                <caption>Theme Details</caption>
                                <tbody>
                                    <tr>
                                        <td>ID</td>
                                        <td>{manifest().id}</td>
                                    </tr>
                                    <tr>
                                        <td>Version</td>
                                        <td>{manifest().version}</td>
                                    </tr>
                                    <tr>
                                        <td>Name</td>
                                        <td>{manifest().name}</td>
                                    </tr>
                                    <tr>
                                        <td>Models</td>
                                        <td>{manifest().models.map((m) => m.name).join(', ')}</td>
                                    </tr>
                                </tbody>
                            </table>
                        )}
                    </Show>

                    <Show when={serverError()}>
                        <small class="text-danger mb-4">{serverError()}</small>
                    </Show>

                    <div class="d-flex justify-content-center">
                        <button type="submit" class="btn btn-primary icon-link justify-content-center mw-100" style="width: 250px;" disabled={inProgress() !== undefined}>
                            <Show when={inProgress() === Actions.Upload}>
                                <div class="spinner-border" role="status">
                                    <span class="visually-hidden">Loading...</span>
                                </div>
                            </Show>
                            <Upload viewBox="0 0 16 16" />
                            Install
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
};

export const Themes = () => {
    enum Actions {
        Activate,
        Uninstall,
    }

    const alertCtx = useContext(AlertContext)!;
    const contentCtx = useContext(ContentContext)!;
    const adminCtx = useContext(AdminContext)!;

    const [item, setItem] = createSignal(undefined as string | undefined);
    const [inProgress, setInProgress] = createSignal(undefined as Actions | undefined);

    const dropdownRemove = dropdownClickListener('theme-quick-action', () => setItem(undefined), () => inProgress() !== undefined);

    window.document.addEventListener('click', dropdownRemove);
    onCleanup(() => window.document.removeEventListener('click', dropdownRemove));

    const [themes, { refetch }] = createResource(() => adminCtx.fetchThemes());

    const setThemeActive = (id: string) => {
        if (inProgress() !== undefined) {
            return;
        }

        setInProgress(Actions.Activate);

        adminCtx.setThemeActive(id)
            .then(() => contentCtx.loadOptions())
            .then(() => {
                alertCtx.success('Theme is activated successfully');
                setItem(undefined);
            })
            .catch((e) => alertCtx.fail(e.message))
            .finally(() => setInProgress(undefined));
    };

    const uninstallTheme = (id: string) => {
        if (inProgress() !== undefined) {
            return;
        }

        setInProgress(Actions.Uninstall);

        adminCtx.uninstallTheme(id)
            .then(() => refetch())
            .then(() => {
                alertCtx.success('Theme is uninstalled successfully');
                setItem(undefined);
            })
            .catch((e) => alertCtx.fail(e.message))
            .finally(() => setInProgress(undefined));
    }

    return (
        <div class="container mt-4 px-md-4">
            <div class="d-flex align-items-center mb-4">
                <div class="flex-grow-1">
                    <h1>Themes</h1>
                </div>
                <A class="btn btn-outline-primary icon-link" href="/themes/install">
                    <Upload viewBox="0 0 16 16" />
                    Install Theme
                </A>
            </div>

            <Suspense>
                <Switch>
                    <Match when={themes.error}>
                        <span>Error: {themes.error.message}</span>
                    </Match>
                    <Match when={themes()}>
                        {(themes) => (
                            <div class="row m-0">
                                <div class="offset-md-2 col-md-8 card p-3">
                                    <table class="table table-hover m-0">
                                        <thead>
                                            <tr>
                                                <th scope="col">ID</th>
                                                <th scope="col">Version</th>
                                                <th scope="col">Name</th>
                                                <th scope="col"></th>
                                                <th scope="col"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <For each={themes()}>
                                                {(theme) => (
                                                    <tr>
                                                        <td>{theme.id}</td>
                                                        <td>{theme.version}</td>
                                                        <td>{theme.name}</td>
                                                        <td class="text-center">
                                                            <Show when={theme.id === contentCtx.options().theme}>
                                                                <span class="badge rounded-pill border border-link text-light-emphasis">Active</span>
                                                            </Show>
                                                        </td>
                                                        <td class="dropdown text-end">
                                                            <button class="btn icon-link" on:click={(ev) => { ev.stopPropagation(); setItem(item() !== theme.id ? theme.id : undefined) }}>
                                                                <ThreeDotsVertical />
                                                            </button>
                                                            <Show when={item() === theme.id}>
                                                                <ul class="dropdown-menu show" id="theme-quick-action" style="right: 0">
                                                                    <li>
                                                                        <button
                                                                            class="dropdown-item icon-link"
                                                                            disabled={inProgress() !== undefined || theme.id === contentCtx.options().theme}
                                                                            on:click={(ev) => { ev.stopPropagation(); setThemeActive(theme.id); }}
                                                                        >
                                                                            <Show when={inProgress() === Actions.Activate}>
                                                                                <div class="spinner-border" role="status">
                                                                                    <span class="visually-hidden">Loading...</span>
                                                                                </div>
                                                                            </Show>
                                                                            Activate
                                                                        </button>
                                                                    </li>
                                                                    <Show when={theme.id !== contentCtx.options().theme}>
                                                                        <li>
                                                                            <button
                                                                                class="dropdown-item icon-link text-danger"
                                                                                disabled={inProgress() !== undefined || theme.id === contentCtx.options().theme}
                                                                                on:click={(ev) => { ev.stopPropagation(); uninstallTheme(theme.id); }}
                                                                            >
                                                                                <Show when={inProgress() === Actions.Uninstall}>
                                                                                    <div class="spinner-border" role="status">
                                                                                        <span class="visually-hidden">Loading...</span>
                                                                                    </div>
                                                                                </Show>
                                                                                Uninstall
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
                        )}
                    </Match>
                </Switch>
            </Suspense>
        </div>
    );
};
