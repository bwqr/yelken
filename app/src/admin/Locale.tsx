import { createSignal, For, Match, onCleanup, Show, Suspense, Switch, useContext } from "solid-js";
import { ContentContext } from "../lib/content/context";
import { ThreeDotsVertical } from "../Icons";
import { AdminContext } from "../lib/admin/context";
import { AlertContext } from "../lib/context";

enum Actions {
    UpdateState,
    SetDefault,
}

export const Locales = () => {
    const contentCtx = useContext(ContentContext)!;
    const adminCtx = useContext(AdminContext)!;
    const alertCtx = useContext(AlertContext)!;

    const [item, setItem] = createSignal(undefined as string | undefined);
    const [inProgress, setInProgress] = createSignal(undefined as undefined | Actions);

    const dropdownRemove = (ev: Event) => {
        if (inProgress() !== undefined) {
            return;
        }

        let close = true;
        let target = ev.target;

        while (target) {
            if (!(target instanceof HTMLElement)) {
                break;
            }

            if (target.id === 'locale-quick-action') {
                close = false;
                break;
            }

            target = target.parentElement;
        }

        if (close) {
            setItem(undefined);
        }
    };

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

    return (
        <div class="container mt-4">
            <div class="d-flex align-items-center mb-4">
                <div class="flex-grow-1">
                    <h1>Locales</h1>
                </div>
            </div>

            <Suspense>
                <Switch>
                    <Match when={contentCtx.locales()}>
                        {(locales) => (
                            <div class="row m-0">
                                <div class="offset-md-3 col-md-6 card p-3">
                                    <table class="table table-hover m-0">
                                        <thead>
                                            <tr>
                                                <th scope="col">Name</th>
                                                <th scope="col">Key</th>
                                                <th scope="col">State</th>
                                                <th scope="col"></th>
                                                <th scope="col"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <For each={locales()}>
                                                {(locale) => (
                                                    <tr>
                                                        <td>{locale.name}</td>
                                                        <td>{locale.key}</td>
                                                        <td>
                                                            <span
                                                                class="badge p-2 border"
                                                                classList={{ 'border-success text-success': !locale.disabled, 'border-danger text-danger': locale.disabled }}
                                                            >
                                                                {locale.disabled ? 'Disabled' : 'Enabled'}
                                                            </span>
                                                        </td>
                                                        <td class="text-center">
                                                            <Show when={locale.key === contentCtx.options().defaultLocale}>
                                                                <span class="badge ms-2 border border-link text-light-emphasis p-2">Default</span>
                                                            </Show>
                                                        </td>
                                                        <td class="dropdown text-end">
                                                            <button class="btn icon-link" on:click={(ev) => { ev.stopPropagation(); setItem(locale.key) }}>
                                                                <ThreeDotsVertical />
                                                            </button>
                                                            <Show when={item() === locale.key}>
                                                                <ul class="dropdown-menu show" id="locale-quick-action">
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
                                                                    <Show when={locale.key !== contentCtx.options().defaultLocale && !locale.disabled}>
                                                                        <li>
                                                                            <button
                                                                                class="dropdown-item icon-link"
                                                                                disabled={inProgress() === Actions.SetDefault}
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
