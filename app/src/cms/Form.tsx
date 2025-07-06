import { createResource, For, Match, Switch, useContext } from "solid-js";
import { CMSContext } from "../lib/cms/context";
import { PlusLg } from "../Icons";
import { A } from "@solidjs/router";
import ProgressSpinner from "../components/ProgressSpinner";

export const Forms = () => {
    const cmsCtx = useContext(CMSContext)!;

    const [forms] = createResource(() => cmsCtx.fetchForms());

    return (
        <div class="container py-4 px-md-4">
            <div class="d-flex align-items-center mb-5">
                <h1 class="flex-grow-1 m-0">Forms</h1>
                <A class="btn btn-outline-primary icon-link" href="/forms/create">
                    <PlusLg viewBox="0 0 16 16" />
                    Create Form
                </A>
            </div>
            <Switch>
                <Match when={forms.loading}>
                    <p class="icon-link justify-content-center w-100"><ProgressSpinner show={true} /> Loading ...</p>
                </Match>
                <Match when={forms.error}>
                    <p class="text-danger-emphasis text-center">Error while fetching forms: <strong>{forms.error.message}</strong></p>
                </Match>
                <Match when={forms()?.length === 0}>
                    <p class="text-secondary text-center">There is no theme installed yet. You can install a new one by using <strong>Install Theme</strong> button.</p>
                </Match>
                <Match when={forms()}>
                    {(forms) => (
                        <div class="row m-0">
                            <div class="offset-md-3 col-md-6">
                                <table class="table table-hover border shadow-sm w-100">
                                    <thead>
                                        <tr>
                                            <th></th>
                                            <th scope="col">ID</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <For each={forms()}>
                                            {(form) => (
                                                <tr>
                                                    <td></td>
                                                    <td>{form.id}</td>
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
        </div>
    );
};
