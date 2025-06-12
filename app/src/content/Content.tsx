import { A, useNavigate, useParams, useSearchParams } from "@solidjs/router";
import { ContentContext } from "../lib/content/context";
import { createEffect, createMemo, createResource, createSignal, For, type JSX, Match, onCleanup, Show, Suspense, Switch, useContext } from "solid-js";
import { HttpError } from "../lib/api";
import { createStore, unwrap } from "solid-js/store";
import { ContentStage, FieldKind } from "../lib/content/models";
import { Dynamic } from "solid-js/web";
import type { CreateContentValue } from "../lib/content/requests";
import { AlertContext } from "../lib/context";
import { BookmarkCheck, BookmarkCheckFill, FloppyFill, PlusLg, PlusSquareDotted, ThreeDotsVertical, Trash, XLg } from "../Icons";
import { PickAsset } from "./Asset";
import { PaginationRequest } from "../lib/models";
import { Pagination } from "../components/Pagination";
import { dropdownClickListener } from "../lib/utils";

export const ContentRoot = (props: { children?: JSX.Element }) => {
    const models = useContext(ContentContext)!.models();

    return (
        <div class="d-flex flex-grow-1">
            <nav id="second-nav" class="h-100 text-secondary" style="width: 13rem; border-right: 1px solid #d8d8d8">
                <p class="text-secondary ps-3 mt-4 mb-2 text-uppercase" style="font-size: calc(var(--bs-body-font-size) - 0.2rem)"><b>Models</b></p>
                <ul class="navbar-nav mb-4">
                    <For each={models}>
                        {(model) => (
                            <li class="nav-item">
                                <A
                                    href={model.namespace ? `/contents?namespace=${encodeURIComponent(model.namespace)}&name=${encodeURIComponent(model.name)}` : `/contents?name=${encodeURIComponent(model.name)}`}
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
    const [searchParams, setSearchParams] = useSearchParams();

    const pagination = createMemo(() => PaginationRequest.from(searchParams.page, searchParams.perPage));

    const model = createMemo(() => {
        const namespace = searchParams.namespace === undefined ? null : decodeURIComponent(searchParams.namespace as string);
        const name = decodeURIComponent(searchParams.name as string);

        return contentCtx.models().find((m) => m.namespace === namespace && m.name === name);
    });

    const [contents] = createResource(
        () => model() && pagination() ? { model: model()!, pagination: pagination() } : undefined,
        ({ model, pagination }) => contentCtx.fetchContents(model.id, pagination)
    );

    return (
        <div class="container py-4 px-md-4">
            <div class="d-flex align-items-center mb-5">
                <div class="flex-grow-1">
                    <h1>Contents</h1>
                </div>
                <Show when={model()}>
                    {(m) => (
                        <A class="btn btn-outline-primary icon-link" href={m().namespace ? `/content/${m().namespace}/${m().name}/create-content` : `/content/${m().name}/create-content`}>
                            <PlusLg viewBox="0 0 16 16" />
                            Create content
                        </A>
                    )}
                </Show>
            </div>

            <Switch>
                <Match when={!model()}>
                    Choose a model from left
                </Match>
                <Match when={contents.loading}>Loading ...</Match>
                <Match when={contents.error}>Error: {contents.error}</Match>
                <Match when={contents()}>
                    {(contents) => (
                        <>
                            <div class="card p-2 mb-4">
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
                                        <For each={contents().items}>
                                            {(content) => (
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
                            <Pagination
                                totalPages={contents().totalPages}
                                page={contents().currentPage}
                                perPage={pagination().perPage}
                                pageChange={(page) => setSearchParams({ page: page.toString() })}
                            />
                        </>
                    )}
                </Match>
            </Switch>
        </div>
    );
};

export const CreateContent = () => {
    enum ValidationError {
        Name,
        Field,
    }

    const alertCtx = useContext(AlertContext)!;
    const contentCtx = useContext(ContentContext)!;
    const params = useParams();
    const navigate = useNavigate();

    const model = createMemo(() => {
        const namespace = typeof params.namespace === 'string' ? decodeURIComponent(params.namespace) : null;
        const name = typeof params.name === 'string' ? decodeURIComponent(params.name) : null;

        return contentCtx.models().find((m) => m.namespace === namespace && m.name === name);
    });

    const [name, setName] = createSignal('');
    const [values, setValues] = createStore({} as Record<number, CreateContentValue[]>);
    const [showPickAsset, setShowPickAsset] = createSignal(undefined as CreateContentValue | undefined);

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
            .then((content) => {
                alertCtx.success('Content is created successfully');
                navigate(`/content/content/${content.id}`, { replace: true });
            })
            .catch((e) => {
                if (e instanceof HttpError) {
                    setServerError(e.error);
                } else {
                    throw e;
                }
            })
            .finally(() => setInProgress(false));
    };

    return (
        <div class="container py-4 px-md-4">
            <h2 class="mb-4">Create Content</h2>

            <div class="row">
                <Show when={model()}>
                    {(m) => {
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
                                        onInput={(ev) => setName(ev.target.value)}
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
                                    {(mf) => {
                                        const field = contentCtx.fields().find((f) => f.id === mf.fieldId);
                                        const locales = contentCtx.activeLocales();

                                        if (field === undefined) {
                                            return (<p>Unsupported field</p>);
                                        }

                                        return (
                                            <div class="mb-3">
                                                <label for={`modelField-${mf.id}-0`} class="form-label">{mf.name}</label>

                                                <For each={values[mf.id]}>
                                                    {(_, idx) => {
                                                        return (
                                                            <div class="d-flex w-100 mb-2">
                                                                <input
                                                                    id={`modelField-${mf.id}-${idx()}`}
                                                                    style="border-top-right-radius: 0; border-bottom-right-radius: 0;"
                                                                    class="form-control flex-grow-1"
                                                                    name={`modelField-${mf.id}-${idx()}`}
                                                                    type={field.kind === FieldKind.Integer ? 'number' : 'text'}
                                                                    disabled={field.kind === FieldKind.Asset}
                                                                    value={values[mf.id][idx()].value}
                                                                    onInput={(ev) => setValues(mf.id, idx(), 'value', ev.target.value)}
                                                                />
                                                                <Show when={mf.localized}>
                                                                    <select
                                                                        class="form-select rounded-0"
                                                                        name={`modelFieldLocale-${mf.id}-${idx()}`}
                                                                        style="width: unset;"
                                                                        value={values[mf.id][idx()].locale}
                                                                        onChange={(ev) => setValues(mf.id, idx(), 'locale', ev.target.value)}
                                                                    >
                                                                        <For each={locales}>
                                                                            {(locale) => (<option value={locale.key}>{locale.name}</option>)}
                                                                        </For>
                                                                    </select>
                                                                </Show>
                                                                <button
                                                                    type="button"
                                                                    class="btn btn-outline-danger icon-link"
                                                                    style=" border-top-left-radius: 0; border-bottom-left-radius: 0;"
                                                                    onClick={() => setValues(mf.id, values[mf.id].filter((_, i) => i !== idx()))}>
                                                                    <XLg viewBox="0 0 16 16" />
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
                                                            const value = { modelFieldId: mf.id, value: '', locale };

                                                            if (field.kind === FieldKind.Asset) {
                                                                setShowPickAsset(value);
                                                            } else {
                                                                setValues(mf.id, values[mf.id].length, value);
                                                            }
                                                        }}
                                                    >
                                                        <PlusSquareDotted viewBox="0 0 16 16" />
                                                        <Show when={field.kind !== FieldKind.Asset} fallback={<>Choose asset</>}>
                                                            Add value
                                                        </Show>
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
                                        <PlusLg viewBox="0 0 16 16" />
                                        Create
                                    </button>
                                </div>
                            </form>
                        );
                    }}
                </Show>
            </div>

            <Show when={showPickAsset()}>
                {(incompleteValue) => (
                    <PickAsset
                        pick={(asset) => {
                            const value = incompleteValue();
                            value.value = asset;

                            setValues(value.modelFieldId, values[value.modelFieldId].length, value);

                            setShowPickAsset(undefined);
                        }}
                        close={() => setShowPickAsset(undefined)}
                    />
                )}
            </Show>
        </div >
    );
}

export const Content = () => {
    enum Action {
        UpdateStage,
        Delete,
    }

    const alertCtx = useContext(AlertContext)!;
    const contentCtx = useContext(ContentContext)!;
    const params = useParams();
    const navigate = useNavigate();

    const [content, { mutate }] = createResource(() => parseInt(params.id), (id: number) => contentCtx.fetchContent(id));

    const [inProgress, setInProgress] = createSignal(undefined as Action | undefined);

    const [dropdown, setDropdown] = createSignal(false);

    onCleanup(dropdownClickListener('content-detail-dropdown', () => setDropdown(false), () => inProgress() === undefined));

    const updateStage = () => {
        const c = content();

        if (inProgress() !== undefined || c === undefined) {
            return;
        }

        const stage = c.content.stage === ContentStage.Published ? ContentStage.Draft : ContentStage.Published;
        setInProgress(Action.UpdateStage);

        contentCtx.updateContentStage(c.content.id, stage)
            .then(() => {
                mutate({ ...c, content: { ...c.content, stage } });

                alertCtx.success(stage === ContentStage.Published ? 'Content is published' : 'Content is marked as draft');
            })
            .catch((e) => alertCtx.fail(e.message))
            .finally(() => setInProgress(undefined));
    };

    const deleteContent = () => {
        const c = content();

        if (inProgress() !== undefined || c === undefined) {
            return;
        }

        setInProgress(Action.Delete);

        contentCtx.deleteContent(c.content.id)
            .then(() => {
                alertCtx.success('Content is deleted successfully');
                navigate(-1);
            })
            .catch((e) => alertCtx.fail(e.message))
            .finally(() => setInProgress(undefined));
    }

    const contentStyle = () => content()?.content.stage === ContentStage.Published ?
        { button: 'btn-secondary', icon: BookmarkCheck } :
        { button: 'btn-primary', icon: BookmarkCheckFill };

    return (
        <div class="container py-4 px-md-4">
            <Suspense fallback={<p>Loading...</p>}>
                <div class="d-flex align-items-center mb-4">
                    <div class="flex-grow-1">
                        <h2 class="m-0">{content()?.content.name ?? '-'}</h2>
                        <small>Content</small>
                    </div>
                    <div class="dropdown mx-2">
                        <button class="btn icon-link px-1" on:click={(ev) => { ev.stopPropagation(); setDropdown(!dropdown()); }}>
                            <ThreeDotsVertical viewBox="0 0 16 16" />
                        </button>
                        <Show when={dropdown()}>
                            <ul id="content-detail-dropdown" class="dropdown-menu mt-1 show shadow" style="right: 0;">
                                <li>
                                    <button class="dropdown-item text-danger icon-link py-2" onClick={deleteContent}>
                                        <Show when={inProgress() === Action.Delete}>
                                            <div class="spinner-border" role="status">
                                                <span class="visually-hidden">Loading...</span>
                                            </div>
                                        </Show>
                                        <Trash viewBox="0 0 16 16" />
                                        Delete
                                    </button>
                                </li>
                            </ul>
                        </Show>
                    </div>
                    <button class={`btn icon-link ${contentStyle().button}`} onClick={updateStage} disabled={inProgress() !== undefined}>
                        <Show when={inProgress() === Action.UpdateStage}>
                            <div class="spinner-border" role="status">
                                <span class="visually-hidden">Loading...</span>
                            </div>
                        </Show>
                        <Dynamic component={contentStyle().icon} viewBox="0 0 16 16" />
                        <Switch>
                            <Match when={content()?.content.stage === ContentStage.Draft}>Publish</Match>
                            <Match when={content()?.content.stage === ContentStage.Published}>Mark as Draft</Match>
                        </Switch>
                    </button>
                </div>

                <div class="row m-0">
                    <Switch>
                        <Match when={content.state === 'ready' && content() === undefined}>
                            <span>Could not find the content with id {params.id}.</span>
                        </Match>
                        <Match when={content()}>
                            {(content) => (
                                <div class="offset-md-4 col-md-4 p-3 mb-4 card">
                                    <h5>Details</h5>

                                    <hr />
                                    <table>
                                        <tbody>
                                            <tr>
                                                <td>Name</td>
                                                <td class="text-end">{content().content.name}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </Match>
                    </Switch>
                </div>
            </Suspense>
        </div>
    );
};
