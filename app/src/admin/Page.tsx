import { createResource, For, Match, Suspense, Switch, useContext } from "solid-js";
import { AdminContext } from "../lib/admin/context";

export const Pages = () => {
    const adminCtx = useContext(AdminContext)!;

    const [pages] = createResource(() => adminCtx.fetchPages());

    return (
        <div class="container py-4 px-md-4">
            <div class="d-flex align-items-center mb-4">
                <div class="flex-grow-1">
                    <h1>Pages</h1>
                </div>
                {/*
                <A class="btn btn-outline-primary icon-link" href="/themes/install">
                    <Upload viewBox="0 0 16 16" />
                    Install Theme
                </A>
                */}
            </div>

            <Suspense>
                <Switch>
                    <Match when={pages.error}>
                        <span>Error: {pages.error.message}</span>
                    </Match>
                    <Match when={pages()}>
                        {(pages) => (
                            <div class="card p-3">
                                <table class="table table-hover m-0">
                                    <thead>
                                        <tr>
                                            <th scope="col">Namespace</th>
                                            <th scope="col">Name</th>
                                            <th scope="col">Locale</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <For each={pages()}>
                                            {(page) => (
                                                <tr>
                                                    <td>{page.namespace}</td>
                                                    <td>{page.name}</td>
                                                    <td>{page.locale}</td>
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
