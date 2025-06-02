import { createResource, For, Match, Suspense, Switch, useContext } from "solid-js";
import { AdminContext } from "../lib/admin/context";
import { A } from "@solidjs/router";
import { Upload } from "../Icons";

export const InstallTheme = () => {
    return (<p>Install Theme</p>);
};

export const Themes = () => {
    const adminCtx = useContext(AdminContext)!;

    const [themes] = createResource(() => adminCtx.fetchThemes());
    return (
        <div class="container mt-4">
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
                            <div class="card p-3">
                                <table class="table table-hover m-0">
                                    <thead>
                                        <tr>
                                            <th scope="col">#</th>
                                            <th scope="col">Version</th>
                                            <th scope="col">Name</th>
                                            <th scope="col">Installed At</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <For each={themes()}>
                                            {(theme) => (
                                                <tr>
                                                    <td>{theme.id}</td>
                                                    <td>{theme.version}</td>
                                                    <td>{theme.name}</td>
                                                    <td>{theme.createdAt}</td>
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
    );
};
