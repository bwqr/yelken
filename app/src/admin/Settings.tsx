import { createEffect, createResource, createSignal, For, Match, Switch, useContext } from "solid-js";
import { AdminContext } from "../lib/admin/context";
import ProgressSpinner from "../components/ProgressSpinner";
import { createStore } from "solid-js/store";
import { AlertContext } from "../lib/alert";
import { FloppyFill } from "../Icons";
import * as theme from "../theme";
import { ChangeLocaleContext, LocaleContext } from "../lib/i18n";
import { BrowserLocale } from "../lib/models";

export const Settings = () => {
    enum OptionKey {
        Name = 'site.name',
        Description = 'site.description',
        Keywords = 'site.keywords',
    }

    function buildOptions(values: Record<string, string>): Record<string, string> {
        return Object.values(OptionKey).reduce((map, key) => {
            map[key] = typeof values[key] === 'string' ? values[key] : '';

            return map;
        }, {} as Record<string, string>);
    }

    const adminCtx = useContext(AdminContext)!;
    const alertCtx = useContext(AlertContext)!;
    const changeLocaleCtx = useContext(ChangeLocaleContext)!;
    const localeCtx = useContext(LocaleContext)!;
    const [siteOptions, { mutate }] = createResource(() => adminCtx.fetchSiteOptions().then(buildOptions));

    const [colorMode, setColorMode] = createSignal(theme.getColorMode() ?? theme.ColorMode.Auto);
    const [changingLocale, setChangingLocale] = createSignal(false);
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
                alertCtx.success(`Site option "${key}" is updated successfully`)
                mutate({ ...editOptions })
            })
            .catch((e) => alertCtx.fail(e.message))
            .finally(() => setInProgress(undefined));
    };

    const changeLocale = (locale: BrowserLocale) => {
        if (changingLocale()) {
            return;
        }

        setChangingLocale(true);

        changeLocaleCtx.setLocale(locale)
            .finally(() => setChangingLocale(false));
    }

    return (
        <div class="container py-4 px-md-4">
            <h1 class="mb-5">Settings</h1>
            <Switch>
                <Match when={siteOptions.loading}>
                    <p class="icon-link justify-content-center w-100"><ProgressSpinner show={true} /> Loading ...</p>
                </Match>
                <Match when={siteOptions.error}>
                    <p class="text-danger-emphasis text-center">Error while fetching users: <strong>{siteOptions.error.message}</strong></p>
                </Match>
                <Match when={siteOptions()}>
                    {(siteOptions) => (

                        <div class="row g-4">
                            <div class="offset-md-3 col-md-6">
                                <div class="border rounded p-3 mb-4">
                                    <h5>Appearance</h5>

                                    <hr />

                                    <table class="table table-borderless w-100 m-0" style="table-layout: fixed;">
                                        <tbody>

                                            <tr>
                                                <td style="width: 25%;">Theme</td>
                                                <td class="py-1">
                                                    <div class="input-group" role="group">
                                                        <select
                                                            class="form-select"
                                                            value={colorMode()}
                                                            onChange={(ev) => setColorMode(ev.target.value as theme.ColorMode)}
                                                        >
                                                            <For each={Object.values(theme.ColorMode)}>
                                                                {(mode) => (
                                                                    <option>{mode}</option>
                                                                )}
                                                            </For>
                                                        </select>
                                                        <button
                                                            type="button"
                                                            class="btn btn-primary icon-link py-0 px-2"
                                                            onClick={() => theme.updateColorMode(colorMode())}
                                                        >
                                                            <FloppyFill viewBox="0 0 16 16" />
                                                            Save
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>

                                            <tr>
                                                <td style="width: 25%;">{localeCtx.i18n.admin.settings.locale()}</td>
                                                <td class="py-1">
                                                    <div class="input-group" role="group">
                                                        <select
                                                            class="form-select"
                                                            value={localeCtx.locale()}
                                                            onChange={(ev) => changeLocale(ev.target.value as BrowserLocale)}
                                                            disabled={changingLocale()}
                                                        >
                                                            <For each={Object.values(BrowserLocale)}>
                                                                {(locale) => (
                                                                    <option value={locale}>{LOCALES[locale]}</option>
                                                                )}
                                                            </For>
                                                        </select>
                                                    </div>
                                                </td>
                                            </tr>

                                        </tbody>
                                    </table>
                                </div>

                                <div class="border rounded p-3">

                                    <h5>Site Options</h5>

                                    <hr />

                                    <table class="table table-borderless w-100 m-0" style="table-layout: fixed;">
                                        <tbody>
                                            <For each={Object.values(OptionKey)}>
                                                {(key) => (
                                                    <tr>
                                                        <td style="width: 25%;">{key}</td>
                                                        <td class="py-1">
                                                            <div class="input-group" role="group">
                                                                <input
                                                                    type="text"
                                                                    class="form-control float-end"
                                                                    placeholder={key}
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
                                                                    Save
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

const LOCALES = {
    [BrowserLocale.English]: 'English',
    [BrowserLocale.Turkish]: 'Türkçe',
};
