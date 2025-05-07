import { A, useNavigate, useParams } from "@solidjs/router";
import { AlertContext, ContentContext } from "../context";
import { createEffect, createResource, createSignal, For, JSX, Match, Show, Switch, useContext } from "solid-js";
import { HttpError } from "../api";
import { createStore, unwrap } from "solid-js/store";
import { Content as ContentModel, ContentStage, CreateContentValue } from "../models";

export const ContentRoot = (props: { children?: JSX.Element }) => {
    const models = useContext(ContentContext)!.models();

    return (
        <div class="d-flex flex-grow-1">
            <nav id="second-nav" class="h-100 text-secondary" style="width: 230px; border-right: 1px solid #d8d8d8">
                <p class="text-secondary ps-3 mt-4 mb-2 text-uppercase" style="font-size: calc(var(--bs-body-font-size) - 0.2rem)"><b>Models</b></p>
                <ul class="navbar-nav mb-4">
                    <For each={models}>
                        {model => (
                            <li class="nav-item">
                                <A
                                    href={model.namespace ? `/content/${model.namespace}/${model.name}/contents` : `/content/${model.name}/contents`}
                                    class="nav-link d-block ps-3 pe-4 py-2"
                                >
                                    {model.name}
                                </A>
                            </li>
                        )}
                    </For>
                </ul>
            </nav>
            <main class="flex-grow-1">
                {props.children}
            </main>
        </div>
    );
}

export const Contents = () => {
    const contentCtx = useContext(ContentContext)!;
    const params = useParams();

    const model = () => {
        const namespace = params.namespace === undefined ? null : decodeURIComponent(params.namespace);
        const name = decodeURIComponent(params.name);

        return contentCtx.models().find(m => m.namespace === namespace && m.name === name);
    }

    const [contents, setContents] = createSignal([] as ContentModel[]);

    createEffect(async () => {
        const m = model();
        if (m) {
            setContents(await contentCtx.fetchContents(m.id))
        }
    });

    return (
        <div class="container mt-4">
            <div class="d-flex align-items-center mb-4">
                <div class="flex-grow-1">
                    <h1>Contents</h1>
                </div>
                <Show when={model()}>
                    {m => (
                        <A class="btn btn-outline-primary icon-link" href={m().namespace ? `/content/${m().namespace}/${m().name}/create-content` : `/content/${m().name}/create-content`}>
                            <svg class="bi" viewBox="0 0 16 16" aria-hidden="true">
                                <use href="/node_modules/bootstrap-icons/bootstrap-icons.svg#plus-lg" />
                            </svg>
                            Create content
                        </A>
                    )}
                </Show>
            </div>

            <div class="border border-1 border-secondary-subtle rounded p-2 shadow-sm">
                <table class="table table-hover m-0">
                    <thead>
                        <tr>
                            <th scope="col">#</th>
                            <th scope="col">Name</th>
                            <th scope="col">Stage</th>
                            <th scope="col">Created At</th>
                        </tr>
                    </thead>
                    <tbody class="table-group-divider">
                        <For each={contents()}>
                            {content => (
                                <tr>
                                    <td>{content.id}</td>
                                    <td><A href={`/content/content/${content.id}`}>{content.name}</A></td>
                                    <td>{content.stage}</td>
                                    <td>{content.createdAt}</td>
                                </tr>
                            )}
                        </For>
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export const CreateContent = () => {
    enum ValidationError {
        Name,
        Field,
    }

    const contentCtx = useContext(ContentContext)!;
    const params = useParams();
    const navigate = useNavigate();

    const model = () => {
        const namespace = typeof params.namespace === 'string' ? decodeURIComponent(params.namespace) : null;
        const name = typeof params.name === 'string' ? decodeURIComponent(params.name) : null;

        return contentCtx.models().find(m => m.namespace === namespace && m.name === name);
    };

    const [name, setName] = createSignal('');
    const [values, setValues] = createStore({} as Record<number, CreateContentValue[]>);

    createEffect(() => {
        const m = model();

        if (m === undefined) {
            return;
        }

        setValues(m.fields.reduce((obj, mf) => {
            obj[mf.id] = [];

            return obj;
        }, {} as Record<number, CreateContentValue[]>));
    });

    const [inProgress, setInProgress] = createSignal(false);

    const [validationErrors, setValidationErrors] = createSignal(new Set<ValidationError>());
    const [serverError, setServerError] = createSignal(undefined as string | undefined);

    const onSubmit = (ev: SubmitEvent) => {
        ev.preventDefault();

        if (inProgress()) {
            return;
        }

        setServerError(undefined);

        const errors = new Set<ValidationError>();

        if (name().trim().length === 0) {
            errors.add(ValidationError.Name);
        }

        setValidationErrors(errors);

        if (errors.size > 0) {
            return;
        }

        setInProgress(true);

        contentCtx.createContent({
            name: name(),
            modelId: model()!.id,
            values: Object.values(unwrap(values)).flat(),
        })
            .then(() => {
                const m = model();

                if (m !== undefined) {
                    navigate(m.namespace ? `/content/${m.namespace}/${m.name}/contents` : `/content/${m.name}/contents`)
                }
            })
            .catch(e => {
                if (e instanceof HttpError) {
                    setServerError(e.error);
                } else {
                    throw e;
                }
            })
            .finally(() => setInProgress(false));
    };

    return (
        <div class="container mt-4">
            <h2 class="mb-4">Create Content</h2>

            <div class="row">
                <Show when={model()}>
                    {m => {
                        return (
                            <form class="col-md-4" onSubmit={onSubmit}>
                                <div class="mb-4">
                                    <label for="contentName" class="form-label">Content Name</label>
                                    <input
                                        type="text"
                                        id="contentName"
                                        class="form-control"
                                        classList={{ 'is-invalid': validationErrors().has(ValidationError.Name) }}
                                        name="contentName"
                                        value={name()}
                                        onInput={ev => setName(ev.target.value)}
                                    />
                                    <Show when={validationErrors().has(ValidationError.Name)}>
                                        <small class="invalid-feedback">Please enter a name.</small>
                                    </Show>
                                </div>

                                <div class="mb-4">
                                    <label for="modelName" class="form-label">Model Name</label>
                                    <input
                                        type="text"
                                        id="modelName"
                                        class="form-control"
                                        name="modelName"
                                        value={m().name}
                                        disabled
                                    />
                                </div>

                                <label class="form-label">Fields</label>

                                <hr class="mt-0" />

                                <For each={m().fields}>
                                    {mf => {
                                        const field = contentCtx.fields().find(f => f.id === mf.fieldId);
                                        const locales = contentCtx.activeLocales();

                                        if (field === undefined) {
                                            return (<p>Unsupported field</p>);
                                        }

                                        return (
                                            <div class="mb-3">
                                                <label for={`modelField${mf.id}`} class="form-label">{mf.name}</label>

                                                <For each={values[mf.id]}>
                                                    {(value, idx) => {
                                                        return (
                                                            <div class="d-flex w-100 mb-2">
                                                                <input
                                                                    type={field.name === 'integer' ? 'number' : 'text'}
                                                                    id={`modelField${mf.id}`}
                                                                    style="border-top-right-radius: 0; border-bottom-right-radius: 0;"
                                                                    class="form-control flex-grow-1"
                                                                    name={`modelField${mf.id}`}
                                                                    onInput={ev => setValues(mf.id, idx(), 'value', ev.target.value)}
                                                                />
                                                                <Show when={mf.localized}>
                                                                    <select
                                                                        class="form-select rounded-0"
                                                                        style="width: unset;"
                                                                        value={values[mf.id][idx()].locale}
                                                                        onChange={ev => setValues(mf.id, idx(), 'locale', ev.target.value)}
                                                                    >
                                                                        <For each={locales}>
                                                                            {locale => (<option value={locale.key}>{locale.name}</option>)}
                                                                        </For>
                                                                    </select>
                                                                </Show>
                                                                <button
                                                                    type="button"
                                                                    class="btn btn-outline-danger icon-link"
                                                                    style=" border-top-left-radius: 0; border-bottom-left-radius: 0;"
                                                                    onClick={() => setValues(mf.id, values[mf.id].filter((_, i) => i !== idx()))}>
                                                                    <svg class="bi" viewBox="0 0 16 16" aria-hidden="true">
                                                                        <use href="/node_modules/bootstrap-icons/bootstrap-icons.svg#x-lg" />
                                                                    </svg>
                                                                </button>
                                                            </div>
                                                        );
                                                    }}
                                                </For>

                                                <Show when={(mf.localized && (values[mf.id]?.length ?? 0) < locales.length) || mf.multiple || (values[mf.id]?.length ?? 0) === 0}>
                                                    <button
                                                        type="button"
                                                        class="btn btn-outline-secondary icon-link justify-content-center w-100"
                                                        onClick={() => {
                                                            const locale = mf.localized ? locales[values[mf.id]?.length ?? 0]?.key : undefined;

                                                            setValues(mf.id, values[mf.id].length, { modelFieldId: mf.id, value: '', locale });
                                                        }}
                                                    >
                                                        <svg class="bi" viewBox="0 0 16 16" aria-hidden="true">
                                                            <use href="/node_modules/bootstrap-icons/bootstrap-icons.svg#plus-square-dotted" />
                                                        </svg>
                                                        Add value
                                                    </button>
                                                </Show>
                                            </div>
                                        );
                                    }}
                                </For>

                                <div class="mb-3">
                                    <Show when={serverError()}>
                                        <small class="text-danger">{serverError()}</small>
                                    </Show>
                                    <button type="submit" class="btn btn-primary icon-link justify-content-center w-100" disabled={inProgress()}>
                                        <Show when={inProgress()}>
                                            <div class="spinner-border" role="status">
                                                <span class="visually-hidden">Loading...</span>
                                            </div>
                                        </Show>
                                        <svg class="bi" viewBox="0 0 16 16" aria-hidden="true">
                                            <use href="/node_modules/bootstrap-icons/bootstrap-icons.svg#plus-lg" />
                                        </svg>
                                        Create
                                    </button>
                                </div>
                            </form>
                        );
                    }}
                </Show>
            </div>
        </div >
    );
}

export const Content = () => {
    const alertCtx = useContext(AlertContext)!;
    const contentCtx = useContext(ContentContext)!;
    const params = useParams();

    const [content, { mutate }] = createResource(() => parseInt(params.id), async (id: number) => contentCtx.fetchContent(id));

    const [inProgress, setInProgress] = createSignal(false);

    const updateContentStage = () => {
        const c = content();
        if (inProgress() || c === undefined) {
            return;
        }

        setInProgress(true);

        const stage = c.content.stage === ContentStage.Published ? ContentStage.Draft : ContentStage.Published;

        contentCtx.updateContentStage(c.content.id, stage)
            .then(() => {
                mutate({ ...c, content: { ...c.content, stage } });

                alertCtx.success(stage === ContentStage.Published ? 'Content is published' : 'Content is marked as draft');
            })
            .catch(e => {
                if (e instanceof HttpError) {
                    alertCtx.fail(e.error);
                } else {
                    alertCtx.fail(`${e}`);
                }
            })
            .finally(() => setInProgress(false));
    };

    const contentUpdateClass = () => content()?.content.stage === ContentStage.Published ? 'btn-secondary' : 'btn-primary';
    const contentUpdateIcon = () => content()?.content.stage === ContentStage.Published ? 'bookmark-check' : 'bookmark-check-fill';

    return (
        <div class="container mt-4">
            <Switch>
                <Match when={content.loading}>Loading ...</Match>
                <Match when={content.error}>Error: {content.error}</Match>
                <Match when={content()}>{c => (
                    <>
                        <div class="d-flex align-items-center mb-4">
                            <div class="flex-grow-1">
                                <h2 class="m-0">{c().content.name}</h2>
                                <small>Content</small>
                            </div>
                            <Show when={content()}>
                                {c => (
                                    <button class={`btn icon-link ${contentUpdateClass()}`} onClick={updateContentStage} disabled={inProgress()}>
                                        <Show when={inProgress()}>
                                            <div class="spinner-border" role="status">
                                                <span class="visually-hidden">Loading...</span>
                                            </div>
                                        </Show>
                                        <svg class="bi" viewBox="0 0 16 16" aria-hidden="true">
                                            <use href={`/node_modules/bootstrap-icons/bootstrap-icons.svg#${contentUpdateIcon()}`} />
                                        </svg>
                                        <Switch>
                                            <Match when={c().content.stage === ContentStage.Draft}>Publish</Match>
                                            <Match when={c().content.stage === ContentStage.Published}>Mark as Draft</Match>
                                        </Switch>
                                    </button>
                                )}
                            </Show>
                        </div>
                        <div>
                            <For each={c().values}>
                                {v => (
                                    <p>{v.value}</p>
                                )}
                            </For>
                        </div>
                    </>
                )}</Match>
            </Switch>
        </div>
    );
};
