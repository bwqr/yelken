import { createEffect, createResource, createSignal, For, Match, onCleanup, Show, Suspense, Switch, useContext } from "solid-js";
import { AdminContext } from "../lib/admin/context";
import { type Template as Temp, type TemplateDetail } from "../lib/admin/models";
import { A, useSearchParams } from "@solidjs/router";
import { LocationKind } from "../lib/admin/models";
import { FloppyFill, PlusLg, ThreeDotsVertical } from "../Icons";
import { AlertContext } from "../lib/context";
import { dropdownClickListener } from "../lib/utils";

const locationKindOrder = [LocationKind.User, LocationKind.Global, LocationKind.Theme];

export const CreateTemplate = () => {
    return (<p>Create a Template</p>);
};

export const Templates = () => {
    enum Actions {
        Delete,
    }

    const alertCtx = useContext(AlertContext)!;
    const adminCtx = useContext(AdminContext)!;

    const [templates, { refetch }] = createResource(() => adminCtx.fetchTemplates().then((templates) => {
        templates.sort((a, b) => {
            const aIdx = locationKindOrder.indexOf(a.kind)
            const bIdx = locationKindOrder.indexOf(b.kind);

            if (aIdx === bIdx) {
                return a.path < b.path ? -1 : 1;
            }

            return aIdx - bIdx;
        });

        return templates;
    }));

    const [item, setItem] = createSignal(undefined as Temp | undefined);
    const [inProgress, setInProgress] = createSignal(undefined as Actions | undefined);

    onCleanup(dropdownClickListener('template-quick-action', () => setItem(undefined), () => inProgress() === undefined));

    const deleteTemplate = (path: string, kind: LocationKind) => {
        if (inProgress() !== undefined) {
            return;
        }

        setInProgress(Actions.Delete);

        adminCtx.deleteTemplate(path, kind)
            .then(() => refetch())
            .then(() => {
                alertCtx.success('Template is successfully deleted');
                setItem(undefined);
            })
            .catch((e) => alertCtx.fail(e.message))
            .finally(() => setInProgress(undefined));
    };

    return (
        <div class="container py-4 px-md-4">
            <div class="d-flex align-items-center mb-4">
                <div class="flex-grow-1">
                    <h1>Templates</h1>
                </div>
                <A class="btn btn-outline-primary icon-link" href="/templates/create">
                    <PlusLg viewBox="0 0 16 16" />
                    Create Template
                </A>
            </div>

            <div class="row m-0">
                <Suspense>
                    <Switch>
                        <Match when={templates.error}>
                            <span>Error: {templates.error.message}</span>
                        </Match>
                        <Match when={templates()}>
                            {(templates) => (
                                <div class="offset-md-2 col-md-8 card p-3">
                                    <table class="table table-hover m-0">
                                        <thead>
                                            <tr>
                                                <th scope="col">Path</th>
                                                <th scope="col">Scope</th>
                                                <th scope="col"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <For each={templates()}>
                                                {(template) => (
                                                    <tr>
                                                        <td><A href={`/templates/view?kind=${template.kind}&path=${encodeURIComponent(template.path)}`}>{template.path}</A></td>
                                                        <td>{template.kind === LocationKind.Global ? 'Global' : template.kind === LocationKind.Theme ? 'Theme' : 'Theme (modified)'}</td>
                                                        <td class="dropdown text-end">
                                                            <button class="btn icon-link" on:click={(ev) => { ev.stopPropagation(); setItem((item()?.path === template.path && item()?.kind === template.kind) ? undefined : template) }}>
                                                                <ThreeDotsVertical />
                                                            </button>
                                                            <Show when={(item()?.path === template.path && item()?.kind === template.kind)}>
                                                                <ul class="dropdown-menu show" id="template-quick-action" style="right: 0">
                                                                    <li>
                                                                        <button
                                                                            class="dropdown-item icon-link text-danger"
                                                                            disabled={inProgress() === Actions.Delete || template.kind === LocationKind.Theme}
                                                                            on:click={(ev) => { ev.stopPropagation(); deleteTemplate(template.path, template.kind); }}
                                                                        >
                                                                            <Show when={inProgress() === Actions.Delete}>
                                                                                <div class="spinner-border" role="status">
                                                                                    <span class="visually-hidden">Loading...</span>
                                                                                </div>
                                                                            </Show>
                                                                            Delete
                                                                        </button>
                                                                    </li>
                                                                </ul>
                                                            </Show>
                                                        </td>
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
        </div>
    );
};

export const Template = () => {
    let editorRef: HTMLElement | undefined = undefined;

    const alertCtx = useContext(AlertContext)!;
    const adminCtx = useContext(AdminContext)!;
    const [searchParams, setSearchParams] = useSearchParams();

    const [template] = createResource(
        () => ({ path: decodeURIComponent(searchParams.path as string), kind: searchParams.kind as LocationKind }),
        ({ path, kind }) => adminCtx.fetchTemplate(path, kind)
            .then((template) => {
                if (template === undefined && kind !== LocationKind.Theme) {
                    return { path, kind, template: '' } as TemplateDetail;
                }

                return template;
            })
    );

    const [editor] = createResource(async () => {
        const [ace, mode] = await Promise.all([import('ace-code'), import('ace-code/src/mode/nunjucks')]);
        const editor = ace.edit(editorRef);

        editor.session.setMode(new mode.Mode());

        return editor;
    });

    createEffect(() => {
        const t = template();
        const e = editor();

        if (t && e) {
            e.setValue(t.template);
        }
    })

    const [inProgress, setInProgress] = createSignal(false);

    const save = () => {
        const t = template();
        const e = editor();

        if (inProgress() || !e || !t) {
            return;
        }

        if (t.kind === LocationKind.Theme) {
            alertCtx.fail('Cannot modify theme\'s own template');

            return;
        }

        setInProgress(true);

        adminCtx.updateTemplate(t.path, t.kind, e.getValue())
            .then(() => alertCtx.success('Template is updated successfully'))
            .catch((e) => alertCtx.fail(e.message))
            .finally(() => setInProgress(false));
    }

    return (
        <div class="container d-flex flex-column flex-grow-1 py-4 px-md-4">
            <Suspense fallback={<p>Loading...</p>}>
                <Switch >
                    <Match when={template.state === 'ready' && template() === undefined && searchParams.kind === LocationKind.Theme}>
                        <span>Could not find the template {decodeURIComponent(searchParams.path as string)}.</span>
                    </Match>
                    <Match when={template()}>
                        {(template) => (
                            <div class="d-flex align-items-center mb-4">
                                <div class="flex-grow-1">
                                    <h2 class="m-0">{template().path}</h2>
                                    <small>Template</small>
                                </div>

                                <select class="form-select" style="width: unset" value={template().kind} onChange={(ev) => setSearchParams({ kind: ev.target.value })}>
                                    <For each={Object.entries(LocationKind)}>
                                        {(kind) => (<option value={kind[1]}>{kind[0]}</option>)}
                                    </For>
                                </select>

                                <button class="btn btn-primary icon-link ms-2" onClick={save} disabled={inProgress()}>
                                    <Show when={inProgress()}>
                                        <div class="spinner-border" role="status">
                                            <span class="visually-hidden">Loading...</span>
                                        </div>
                                    </Show>
                                    <FloppyFill />
                                    Save
                                </button>
                            </div>
                        )}
                    </Match>
                </Switch>
            </Suspense>

            <div class="flex-grow-1 w-100" ref={editorRef}></div>
        </div >
    );
};
