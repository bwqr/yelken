import { createResource, For, Match, Suspense, Switch, useContext } from "solid-js";
import { AdminContext } from "../lib/admin/context";

export const Pages = () => {
    const adminCtx = useContext(AdminContext)!;

    const [pages] = createResource(() => adminCtx.fetchPages());

    return (
        <Suspense fallback={<p>Loading...</p>}>
            <Switch>
                <Match when={pages.error}>
                    <span>Error: {pages.error.message}</span>
                </Match>
                <Match when={pages()}>
                    {(pages) => (
                        <For each={pages()}>
                            {(page) => (<p>{page.name}</p>)}
                        </For>
                    )}
                </Match>
            </Switch>
        </Suspense>
    );
};
