import { createEffect, createResource, createSignal, For, Match, Show, Suspense, Switch, useContext } from "solid-js";
import { AdminContext } from "../lib/admin/context";
import { A, useParams, useSearchParams } from "@solidjs/router";
import type { LocationKind } from "../lib/admin/models";
import { FloppyFill } from "../Icons";
import { AlertContext } from "../lib/context";

export const Templates = () => {
    const adminCtx = useContext(AdminContext)!;

    const [templates] = createResource(() => adminCtx.fetchTemplates());

    return (
        <Suspense fallback={<p>Loading...</p>}>
            <Switch>
                <Match when={templates.error}>
                    <span>Error: {templates.error.message}</span>
                </Match>
                <Match when={templates()}>
                    {(templates) => (
                        <For each={templates()}>
                            {(template) => (<A href={`/template/${template.kind}?path=${encodeURIComponent(template.path)}`}>{template.path} - {template.kind}</A>)}
                        </For>
                    )}
                </Match>
            </Switch>
        </Suspense>
    );
};

export const Template = () => {
    let editorRef: HTMLElement | undefined = undefined;

    const alertCtx = useContext(AlertContext)!;
    const adminCtx = useContext(AdminContext)!;
    const [searchParams] = useSearchParams();
    const params = useParams();

    const [template] = createResource(async () => adminCtx.fetchTemplate(decodeURIComponent(searchParams.path as string ?? ''), params.kind as LocationKind));
    const [editor] = createResource(async () => {
        const [ace, mode] = await Promise.all([import('ace-code'), import('ace-code/src/mode/nunjucks')]);
        const editor = ace.edit(editorRef);

        editor.session.setMode(new mode.Mode());

        return editor;
    })

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

        setInProgress(true);

        adminCtx.updateTemplate(t.path, t.kind, e.getValue())
            .then(() => alertCtx.success('Template is updated successfully'))
            .catch((e) => alertCtx.fail(e.message))
            .finally(() => setInProgress(false));
    }

    return (
        <div class="p-3 d-flex flex-column flex-grow-1 gap-3">
            <div class="d-flex">
                <div class="flex-grow-1"></div>
                <button class="btn btn-primary icon-link" onClick={save} disabled={inProgress()}>
                    <Show when={inProgress()}>
                        <div class="spinner-border" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                    </Show>
                    <FloppyFill />
                    Save
                </button>
            </div>
            <div class="row flex-grow-1">
                <div class="col-md-3">
                    <Suspense fallback={<p>Loading...</p>}>
                        <Switch>
                            <Match when={template.error}>
                                <span>Error: {template.error.message}</span>
                            </Match>
                            <Match when={template()}>
                                {(template) => (
                                    <p>{template().path}</p>
                                )}
                            </Match>
                        </Switch>
                    </Suspense>
                </div>
                <div class="col-md-9">
                    <Suspense fallback={<p>Loading Editor...</p>}>
                        <Switch>
                            <Match when={editor.error}>
                                <span>Failed to load editor: {editor.error.message}</span>
                            </Match>
                            <Match when={editor()}>
                                <></>
                            </Match>
                        </Switch>
                    </Suspense>
                    <div class="h-100" ref={editorRef}></div>
                </div>
            </div>
        </div>
    );
};
