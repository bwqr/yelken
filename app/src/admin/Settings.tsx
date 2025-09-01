import { createEffect, createResource, createSignal, For, Match, Switch, useContext } from "solid-js";
import { AdminContext } from "../lib/admin/context";
import ProgressSpinner from "../components/ProgressSpinner";
import { createStore } from "solid-js/store";
import { AlertContext } from "../lib/alert";
import { FloppyFill } from "../Icons";
import { LocaleContext } from "../lib/i18n";
import { OptionKey } from "../lib/admin/models";

export const Settings = () => {
    function buildOptions(values: Record<string, string>): Record<OptionKey, string> {
        return Object.values(OptionKey).reduce((map, key) => {
            map[key] = typeof values[key] === 'string' ? values[key] : '';

            return map;
        }, {} as Record<OptionKey, string>);
    }

    const adminCtx = useContext(AdminContext)!;
    const alertCtx = useContext(AlertContext)!;
    const localeCtx = useContext(LocaleContext)!;

    const i18n = localeCtx.i18n.settings;

    const [siteOptions, { mutate }] = createResource(() => adminCtx.fetchSiteOptions().then(buildOptions));

    const [editOptions, setEditOptions] = createStore(buildOptions({}));

    createEffect(() => {
        const opts = siteOptions();

        if (opts) {
            setEditOptions(Object.assign({}, opts));
        }
    });

    const [inProgress, setInProgress] = createSignal(undefined as OptionKey | undefined);

    const updateSiteOptions = (key: OptionKey, value: string) => {
        if (inProgress() !== undefined) {
            return;
        }

        setInProgress(key);

        adminCtx.updateSiteOption({ key, value })
            .then(() => {
                alertCtx.success(i18n.actions.optionUpdated(i18n.siteOptions[key]()))

                mutate({ ...editOptions })
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
            <h1 class="mb-5">{localeCtx.i18n.nav.links.settings()}</h1>
            <Switch>
                <Match when={siteOptions.loading}>
                    <p class="icon-link justify-content-center w-100"><ProgressSpinner show={true} /> {localeCtx.i18n.common.loading()} ...</p>
                </Match>
                <Match when={siteOptions.error}>
                    <p class="text-danger-emphasis text-center">{localeCtx.i18n.common.loadingItemError(i18n.labels.siteOptions())}: <strong>{siteOptions.error.message}</strong></p>
                </Match>
                <Match when={siteOptions()}>
                    {(siteOptions) => (

                        <div class="row g-4">
                            <div class="offset-md-3 col-md-6">
                                <div class="border rounded p-3">

                                    <h5>{i18n.labels.siteOptions()}</h5>

                                    <hr />

                                    <table class="table table-borderless w-100 m-0" style="table-layout: fixed;">
                                        <tbody>
                                            <For each={Object.values(OptionKey)}>
                                                {(key) => (
                                                    <tr>
                                                        <td style="width: 25%;">{i18n.siteOptions[key]()}</td>
                                                        <td class="py-1">
                                                            <div class="input-group" role="group">
                                                                <input
                                                                    type="text"
                                                                    class="form-control float-end"
                                                                    placeholder={i18n.siteOptions[key]()}
                                                                    value={editOptions[key]}
                                                                    onInput={(ev) => setEditOptions(key, ev.target.value)}
                                                                />
                                                                <button
                                                                    type="button"
                                                                    class="btn icon-link py-0 px-2"
                                                                    classList={{ 'btn-primary': editOptions[key] !== siteOptions()[key] }}
                                                                    onClick={() => updateSiteOptions(key, editOptions[key])}
                                                                    disabled={inProgress() === key || editOptions[key] === siteOptions()[key]}
                                                                >
                                                                    <ProgressSpinner show={inProgress() === key} small={true} />
                                                                    <FloppyFill viewBox="0 0 16 16" />
                                                                    {localeCtx.i18n.common.actions.save()}
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </For>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </Match>
            </Switch>
        </div>
    );
}
