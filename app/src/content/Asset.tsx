import { createResource, For, Match, Suspense, Switch, useContext } from "solid-js";
import { ContentContext } from "../lib/content/context";
import { A } from "@solidjs/router";
import { PlusLg } from "../Icons";

export const Assets = () => {
    const contentCtx = useContext(ContentContext)!;

    const [assets] = createResource(() => contentCtx.fetchAssets());

    return (
        <div class="container py-4 px-md-4">
            <div class="d-flex align-items-center mb-4">
                <div class="flex-grow-1">
                    <h1>Assets</h1>
                </div>
                <A class="btn btn-outline-primary icon-link" href="/assets/create">
                    <PlusLg viewBox="0 0 16 16" />
                    Create Asset
                </A>
            </div>
            <div class="card p-3">
                <Suspense>
                    <Switch>
                        <Match when={assets.error}>
                            <span>Error: {assets.error.message}</span>
                        </Match>
                        <Match when={assets() && assets()!.currentPage === 1 && assets()!.items.length === 0}>
                            <span>No asset exists yet</span>
                        </Match>
                        <Match when={assets() && assets()!.items.length === 0}>
                            <span>No assets</span>
                        </Match>
                        <Match when={assets()}>
                            {(assets) => (
                                <For each={assets().items}>
                                    {(asset) => (
                                        <span>{asset.name}</span>
                                    )}
                                </For>
                            )}
                        </Match>
                    </Switch>
                </Suspense>
            </div>
        </div>
    );
};

export const Asset = () => {
    return (<p>Asset</p>);
}
