import { createResource, createSignal, For, Match, onCleanup, Show, Switch, useContext } from "solid-js";
import { AdminContext } from "../lib/admin/context";
import { A, useNavigate } from "@solidjs/router";
import { ThreeDotsVertical, Upload } from "../Icons";
import { dropdownClickListener } from "../lib/utils";
import { ContentContext } from "../lib/content/context";
import { AlertContext } from "../lib/context";
import { Api, HttpError } from "../lib/api";
import ProgressSpinner from "../components/ProgressSpinner";
import type { Theme } from "../lib/admin/models";
import DeleteConfirmModal from "../components/DeleteConfirmModal";

interface Manifest {
    id: string,
    version: string,
    name: string,
    models: {
        name: string,
        key: string,
        desc?: string,
        fields: {
            name: string,
            key: string,
            desc?: string,
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
        key: string,
        name: string,
        desc?: string,
        path: string,
        template: string,
        locale?: string,
    }[],
}

export const InstallTheme = () => {
    enum Action {
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

    const [inProgress, setInProgress] = createSignal(undefined as Action | undefined);

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
        setInProgress(Action.Analyze);

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

        setInProgress(Action.Upload);

        const formdata = new FormData();
        formdata.append('theme', theme()!);

        Api.request('/admin/theme/theme', 'POST', { formdata })
            .then(() => {
                alertCtx.success(`Theme "${manifest()?.name}" is installed successfully`);

                navigate('/themes', { replace: true });
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
        <div class="container py-4 px-md-4">
            <div class="d-flex align-items-center mb-5">
                <h2>Install Theme</h2>
            </div>
            <div class="row">
                <form class="offset-md-4 col-md-4" onSubmit={onSubmit}>
                    <div class="border rounded p-3">
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

                        <Show when={inProgress() === Action.Analyze}>
                            <div class="d-flex justify-content-center mb-4">
                                <ProgressSpinner show={true} />
                                <span class="ms-2">Theme is being analyzed.</span>
                            </div>
                        </Show>
                        <Show when={analysisError()}>
                            {(error) => (<small class="text-danger mb-4">Analysis Error: {error()}</small>)}
                        </Show>
                        <Show when={manifest()}>
                            {(manifest) => (
                                <table class="table mb-4 w-100 caption-top" style="table-layout: fixed;">
                                    <caption class="p-0">Theme Details</caption>
                                    <tbody>
                                        <tr>
                                            <td style="width: 25%">ID</td>
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
                            <div class="mb-2">
                                <small class="text-danger">{serverError()}</small>
                            </div>
                        </Show>

                        <div class="d-flex justify-content-center">
                            <button
                                type="submit"
                                class="btn btn-primary icon-link justify-content-center w-100"
                                style="max-width: 10rem;"
                                disabled={inProgress() !== undefined}
                            >
                                <ProgressSpinner show={inProgress() === Action.Upload} />
                                <Upload viewBox="0 0 16 16" />
                                Install
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    )
};

export const Themes = () => {
    enum Action {
        Activate,
    }

    const alertCtx = useContext(AlertContext)!;
    const contentCtx = useContext(ContentContext)!;
    const adminCtx = useContext(AdminContext)!;

    const [item, setItem] = createSignal(undefined as string | undefined);
    const [uninstalling, setUninstalling] = createSignal(undefined as Theme | undefined);

    const [inProgress, setInProgress] = createSignal(undefined as Action | undefined);

    onCleanup(dropdownClickListener('theme-quick-action', () => setItem(undefined), () => !uninstalling()));

    const [themes, { mutate }] = createResource(() => adminCtx.fetchThemes());

    const setThemeActive = (theme: Theme) => {
        if (inProgress() !== undefined) {
            return;
        }

        setInProgress(Action.Activate);

        adminCtx.setThemeActive(theme.id)
            .then(() => contentCtx.loadOptions())
            .then(() => {
                setItem(undefined);

                alertCtx.success(`Theme "${theme.name}" is activated successfully`);
            })
            .catch((e) => alertCtx.fail(e.message))
            .finally(() => setInProgress(undefined));
    };

    const uninstallTheme = async (theme: Theme) => {
        return adminCtx.uninstallTheme(theme.id)
            .then(() => {
                setItem(undefined);
                setUninstalling(undefined);

                alertCtx.success(`Theme "${theme.name}" is uninstalled successfully`);

                mutate(themes()?.filter((t) => t.id !== theme.id) ?? [])
            });
    }

    return (
        <div class="container py-4 px-md-4">
            <div class="d-flex align-items-center mb-5">
                <h1 class="flex-grow-1 m-0">Themes</h1>
                <A class="btn btn-outline-primary icon-link" href="/themes/install">
                    <Upload viewBox="0 0 16 16" />
                    Install Theme
                </A>
            </div>
            <Switch>
                <Match when={themes.loading}>
                    <p class="icon-link justify-content-center w-100"><ProgressSpinner show={true} /> Loading ...</p>
                </Match>
                <Match when={themes.error}>
                    <p class="text-danger-emphasis text-center">Error while fetching themes: <strong>{themes.error.message}</strong></p>
                </Match>
                <Match when={themes()?.length === 0}>
                    <p class="text-secondary text-center">There is no theme installed yet. You can install a new one by using <strong>Install Theme</strong> button.</p>
                </Match>
                <Match when={themes()}>
                    {(themes) => (
                        <div class="row m-0">
                            <div class="offset-md-3 col-md-6">
                                <table class="table table-hover border shadow-sm w-100">
                                    <thead>
                                        <tr>
                                            <th></th>
                                            <th scope="col">ID</th>
                                            <th scope="col">Version</th>
                                            <th scope="col">Name</th>
                                            <th></th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <For each={themes()}>
                                            {(theme) => (
                                                <tr>
                                                    <td></td>
                                                    <td>{theme.id}</td>
                                                    <td>{theme.version}</td>
                                                    <td>{theme.name}</td>
                                                    <td class="text-center">
                                                        <Show when={theme.id === contentCtx.options().theme}>
                                                            <span class="badge rounded-pill border border-success text-success ms-2">Active</span>
                                                        </Show>
                                                    </td>
                                                    <td class="dropdown text-end">
                                                        <button class="btn icon-link px-1" on:click={(ev) => { ev.stopPropagation(); setItem(item() !== theme.id ? theme.id : undefined) }}>
                                                            <ThreeDotsVertical viewBox="0 0 16 16" />
                                                        </button>
                                                        <Show when={item() === theme.id}>
                                                            <ul class="dropdown-menu show" id="theme-quick-action" style="right: 0">
                                                                <li>
                                                                    <button
                                                                        class="dropdown-item icon-link"
                                                                        disabled={inProgress() !== undefined || theme.id === contentCtx.options().theme}
                                                                        on:click={(ev) => { ev.stopPropagation(); setThemeActive(theme); }}
                                                                    >
                                                                        <ProgressSpinner show={inProgress() === Action.Activate} />
                                                                        Activate
                                                                    </button>
                                                                </li>
                                                                <Show when={theme.id !== contentCtx.options().theme}>
                                                                    <li>
                                                                        <button
                                                                            class="dropdown-item icon-link text-danger"
                                                                            disabled={inProgress() !== undefined || theme.id === contentCtx.options().theme}
                                                                            on:click={() => setUninstalling(theme)}
                                                                        >
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
            <Show when={uninstalling()}>
                {(theme) => (
                    <DeleteConfirmModal
                        message={<p>Are you sure about uninstalling the theme <strong>{theme().name} ({theme().id})</strong>?</p>}
                        close={() => setUninstalling(undefined)}
                        confirm={() => uninstallTheme(theme())}
                        confirmText="Uninstall"
                    />
                )}
            </Show>
        </div>
    );
};
