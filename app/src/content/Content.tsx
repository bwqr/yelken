import { A, Navigate, useNavigate, useParams, useSearchParams } from "@solidjs/router";
import { ContentContext } from "../lib/content/context";
import { createEffect, createMemo, createResource, createSignal, For, type JSX, Match, onCleanup, Show, Suspense, Switch, useContext } from "solid-js";
import { HttpError } from "../lib/api";
import { createStore, unwrap } from "solid-js/store";
import { ContentStage, FieldKind, Model, type ModelField } from "../lib/content/models";
import { Dynamic } from "solid-js/web";
import type { CreateContentValue } from "../lib/content/requests";
import { AlertContext } from "../lib/context";
import { BookmarkCheck, BookmarkCheckFill, FloppyFill, Images, PencilSquare, PlusLg, PlusSquareDotted, QuestionSquare, ThreeDotsVertical, Trash, XLg } from "../Icons";
import { PickAsset } from "./Asset";
import { PaginationRequest } from "../lib/models";
import { Pagination } from "../components/Pagination";
import { dropdownClickListener } from "../lib/utils";
import ProgressSpinner from "../components/ProgressSpinner";
import * as config from '../lib/config';

function imageFile(filename: string): boolean {
    return ['.bmp', '.png', '.ico', '.tif', '.tiff', '.jpeg', '.jpg', '.webp', '.svg', '.gif'].findIndex((ext) => filename.endsWith(ext)) > -1;
}

const ContentValueModal = (props: {
    close: () => void;
    create: (field: CreateContentValue) => Promise<void> | void;
    modelField: ModelField,
    initial?: CreateContentValue
}) => {
    enum ValidationError {
        Value,
        Locale,
    }

    const alertCtx = useContext(AlertContext)!;
    const contentCtx = useContext(ContentContext)!;

    const [store, setStore] = createStore(props.initial ?? {
        value: '',
        locale: '',
    });

    const [inProgress, setInProgress] = createSignal(false);
    const [validationErrors, setValidationErrors] = createSignal(new Set<ValidationError>());
    const [serverError, setServerError] = createSignal(undefined as string | undefined);

    const [showPickAsset, setShowPickAsset] = createSignal(false);

    const field = () => contentCtx.fields().find((f) => f.id === props.modelField.fieldId);

    const close = () => {
        if (inProgress()) {
            return;
        }

        props.close();
    }

    const createValue = (ev: SubmitEvent) => {
        ev.preventDefault();

        if (inProgress()) {
            return;
        }

        setServerError(undefined);

        const errors = new Set<ValidationError>();

        if (store.value.trim().length === 0) {
            errors.add(ValidationError.Value);
        }

        if (props.modelField.localized && store.locale?.length === 0) {
            errors.add(ValidationError.Locale);
        }

        setValidationErrors(errors);

        if (errors.size > 0) {
            return;
        }

        const promise = props.create({
            modelFieldId: props.modelField.id,
            value: store.value.trim(),
            locale: props.modelField.localized ? store.locale : undefined
        });

        if (promise instanceof Promise) {
            setInProgress(true);

            promise
                .catch((e) => {
                    if (e instanceof HttpError) {
                        setServerError(e.error);
                    } else {
                        alertCtx.fail(e.message);
                    }
                })
                .finally(() => setInProgress(false));
        }
    };

    return (
        <>
            <div class="modal show d-block" tabindex="-1" aria-labelledby="createModelFieldModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <form class="modal-content" onSubmit={createValue}>
                        <div class="modal-header">
                            <h1 class="modal-title fs-5" id="createModelFieldModalLabel">{props.initial ? 'Edit Value' : 'Add Value'}</h1>
                        </div>
                        <div class="modal-body">
                            <Show when={field()} fallback={<p>Unknown field</p>}>
                                {(field) => (
                                    <>
                                        <div>
                                            <label for="modelFieldName" class="form-label">{props.modelField.name}</label>
                                            <Switch fallback={<p>Unsupported field</p>}>
                                                <Match when={field().kind === FieldKind.Asset}>
                                                    <Show when={store.value}>
                                                        <div class="mb-2" style="height: 6rem">
                                                            <Show when={imageFile(store.value)} fallback={
                                                                <QuestionSquare class="d-block m-auto w-auto h-100 text-secondary" viewBox="0 0 16 16" />
                                                            }>
                                                                <img
                                                                    class="d-block m-auto w-auto"
                                                                    src={`${config.API_URL}/assets/content/${store.value}`}
                                                                    alt={store.value}
                                                                    style="max-height: 100%;"
                                                                />
                                                            </Show>
                                                        </div>
                                                    </Show>
                                                    <input
                                                        id="modelFieldValue"
                                                        name="modelFieldValue"
                                                        type="text"
                                                        class="form-control"
                                                        classList={{ 'is-invalid': validationErrors().has(ValidationError.Value) }}
                                                        value={store.value}
                                                        disabled={true}
                                                    />
                                                    <Show when={validationErrors().has(ValidationError.Value)}>
                                                        <small class="invalid-feedback">Please pick an asset for {props.modelField.name}.</small>
                                                    </Show>
                                                    <button
                                                        type="button"
                                                        class="btn btn-secondary icon-link mt-2"
                                                        classList={{ 'btn-warning': validationErrors().has(ValidationError.Value) }}
                                                        onClick={() => setShowPickAsset(true)}
                                                    >
                                                        <Images viewBox="0 0 16 16" />
                                                        Pick Asset
                                                    </button>
                                                </Match>
                                                <Match when={field().kind === FieldKind.String || field().kind === FieldKind.Integer}>
                                                    <input
                                                        id="modelFieldValue"
                                                        name="modelFieldValue"
                                                        type={field().kind === FieldKind.Integer ? 'number' : 'text'}
                                                        class="form-control"
                                                        classList={{ 'is-invalid': validationErrors().has(ValidationError.Value) }}
                                                        value={store.value}
                                                        onInput={(ev) => setStore('value', ev.target.value)}
                                                    />
                                                    <Show when={validationErrors().has(ValidationError.Value)}>
                                                        <small class="invalid-feedback">Please enter a value for {props.modelField.name}.</small>
                                                    </Show>
                                                </Match>
                                            </Switch>
                                        </div>

                                        <Show when={props.modelField.localized}>
                                            <div class="mt-4">
                                                <label for="modelFieldLocale" class="form-label">Locale</label>
                                                <select
                                                    id="modelFieldLocale"
                                                    class="form-select"
                                                    classList={{ 'is-invalid': validationErrors().has(ValidationError.Locale) }}
                                                    name="modelFieldLocale"
                                                    value={store.locale}
                                                    onChange={(ev) => setStore('locale', ev.target.value)}
                                                >
                                                    <option value="" disabled selected>Select a locale</option>
                                                    <For each={contentCtx.activeLocales()}>
                                                        {(locale) => (
                                                            <option value={locale.key}>{locale.name}</option>
                                                        )}
                                                    </For>
                                                </select>
                                                <Show when={validationErrors().has(ValidationError.Locale)}>
                                                    <small class="invalid-feedback">Please select a locale.</small>
                                                </Show>
                                            </div>
                                        </Show>
                                    </>
                                )}
                            </Show>

                            <Show when={serverError()}>
                                <div class="mt-2">
                                    <small class="text-danger">{serverError()}</small>
                                </div>
                            </Show>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-outline-danger" onClick={close} disabled={inProgress()}>Discard</button>
                            <button type="submit" class="btn btn-primary icon-link" disabled={inProgress()}>
                                <ProgressSpinner show={inProgress()} />
                                <Dynamic component={props.initial ? FloppyFill : PlusLg} viewBox="0 0 16 16" />
                                {props.initial ? 'Save' : 'Add'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <Show when={showPickAsset()}>
                <PickAsset
                    pick={(asset) => {
                        setStore('value', asset.filename);
                        setShowPickAsset(false);
                    }}
                    close={() => setShowPickAsset(false)}
                />
            </Show>

            <div class="modal-backdrop show"></div>
        </>
    );
}

export const ContentRoot = (props: { children?: JSX.Element }) => {
    const models = useContext(ContentContext)!.models();

    return (
        <div class="d-flex flex-grow-1">
            <nav id="second-nav" class="h-100" style="width: 13rem; border-right: 1px solid #d8d8d8">
                <p class="ps-3 mt-4 mb-2 text-uppercase"><b>Models</b></p>
                <Show when={models.length > 0} fallback={
                    <p class="ps-3 mt-4 mb-2 text-secondary">No model found</p>
                }>
                    <ul class="navbar-nav mb-4 highlight-links">
                        <For each={models}>
                            {(model) => (
                                <li class="nav-item">
                                    <A
                                        href={`/contents/by-model/${model.urlPath()}`}
                                        class="nav-link d-block ps-3 pe-4 py-2"
                                    >
                                        {model.title()}
                                    </A>
                                </li>
                            )}
                        </For>
                    </ul>
                </Show>
            </nav>
            <main class="flex-grow-1">
                {props.children}
            </main>
        </div>
    );
}

export const Contents = () => {
    const contentCtx = useContext(ContentContext)!;
    return (
        <div class="container py-4 px-md-4">
            <Show when={contentCtx.models()[0]} fallback={
                <p class="text-secondary text-center">A <strong>Model</strong> needs to be created first to create a <strong>Content</strong>. You can create a new model in <A href="/models">Models</A> page.</p>
            }>
                {(model) => (<Navigate href={`/contents/by-model/${model().urlPath()}`} />)}
            </Show>
        </div>
    );
};

export const ContentsByModel = () => {
    const contentCtx = useContext(ContentContext)!;
    const [searchParams, setSearchParams] = useSearchParams();
    const params = useParams();

    const pagination = createMemo(() => PaginationRequest.fromParams(searchParams.page, searchParams.perPage));

    const model = createMemo(() => contentCtx.models().find(Model.searchWithParams(params.namespace, params.key)));

    const [contents] = createResource(
        () => model() ? { model: model()!, pagination: pagination() } : undefined,
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
                        <A class="btn btn-outline-primary icon-link" href={`/contents/create/${m().urlPath()}`}>
                            <PlusLg viewBox="0 0 16 16" />
                            Create Content
                        </A>
                    )}
                </Show>
            </div>

            <Switch>
                <Match when={!model()}>
                    <p class="text-secondary text-center">Could not find the model with key <strong>{params.key}</strong>.</p>
                </Match>
                <Match when={contents.loading}>
                    <p class="icon-link justify-content-center w-100"><ProgressSpinner show={true} /> Loading ...</p>
                </Match>
                <Match when={contents.error}>
                    <p class="text-danger">Error while fetching contents: <strong>{contents.error.message}</strong></p>
                </Match>
                <Match when={contents()}>
                    {(contents) => (
                        <Show when={contents().items.length > 0} fallback={
                            <p class="text-secondary text-center">There is no content for the <strong>{model()?.name}</strong> model to display yet. You can create a new one by using <strong>Create Content</strong> button.</p>
                        }>
                            <div class="row">
                                <div class="offset-md-2 col-md-8">
                                    <table class="table table-hover mb-4 border shadow-sm">
                                        <thead>
                                            <tr>
                                                <th></th>
                                                <th scope="col">#</th>
                                                <th scope="col">Name</th>
                                                <th scope="col">Stage</th>
                                                <th scope="col">Created At</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <For each={contents().items}>
                                                {(content) => (
                                                    <tr>
                                                        <td></td>
                                                        <td>{content.id}</td>
                                                        <td><A href={`/contents/view/${content.id}`}>{content.name}</A></td>
                                                        <td>{content.stage}</td>
                                                        <td>{content.createdAt.toDateString()}</td>
                                                    </tr>
                                                )}
                                            </For>
                                        </tbody>
                                    </table>

                                    <Pagination
                                        totalPages={contents().totalPages}
                                        page={contents().currentPage}
                                        perPage={pagination().perPage}
                                        pageChange={(page) => setSearchParams({ page: page.toString() })}
                                    />
                                </div>
                            </div>
                        </Show>
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

    const locales = contentCtx.activeLocales();
    const model = createMemo(() => contentCtx.models().find(Model.searchWithParams(params.namespace, params.key)));

    const [name, setName] = createSignal('');
    const [values, setValues] = createStore({} as Record<number, CreateContentValue[]>);
    const [showContentValueModal, setShowContentValueModal] = createSignal(undefined as { modelField: ModelField, initial?: CreateContentValue } | undefined);

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
                navigate(`/contents/view/${content.id}`, { replace: true });
            })
            .catch((e) => {
                if (e instanceof HttpError) {
                    setServerError(e.error);
                } else {
                    alertCtx.fail(e.message);
                }
            })
            .finally(() => setInProgress(false));
    };

    return (
        <div class="container py-4 px-md-4">
            <h2 class="mb-4">Create Content</h2>

            <div class="row">
                <Show when={model()} fallback={
                    <p class="text-secondary text-center">Could not find the model with key <strong>{params.key}</strong>.</p>
                }>
                    {(model) => {
                        return (
                            <form class="offset-md-3 col-md-6" onSubmit={onSubmit}>
                                <div class="border rounded p-3 mb-4">
                                    <div class="mb-4">
                                        <label for="contentName" class="form-label">Name</label>
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
                                        <label for="modelName" class="form-label">Model</label>
                                        <input
                                            type="text"
                                            id="modelName"
                                            class="form-control"
                                            name="modelName"
                                            value={model().title()}
                                            disabled
                                        />
                                    </div>
                                </div>

                                <hr />

                                <h5 class="mb-4">Fields</h5>

                                <For each={model().fields}>
                                    {(mf) => {

                                        return (
                                            <>
                                                <div class="card mb-4">
                                                    <div class="card-header d-flex align-items-center">
                                                        <h5 class="flex-grow-1 m-0">{mf.name}</h5>
                                                        <Show when={(mf.localized && (values[mf.id]?.length ?? 0) < locales.length) || mf.multiple || (values[mf.id]?.length ?? 0) === 0}>
                                                            <button
                                                                type="button"
                                                                class="btn btn-sm btn-secondary icon-link justify-content-center"
                                                                onClick={() => setShowContentValueModal({ modelField: mf })}
                                                            >
                                                                <PlusSquareDotted viewBox="0 0 16 16" />
                                                                Add value
                                                            </button>
                                                        </Show>
                                                    </div>
                                                    <ul class="list-group list-group-flush">
                                                        <For each={values[mf.id]}>
                                                            {(value) => {
                                                                const field = () => contentCtx.fields().find((f) => f.id === mf.fieldId);

                                                                return (
                                                                    <li class="list-group-item d-flex align-items-center">
                                                                        <Switch fallback={
                                                                            <p
                                                                                class="flex-grow-1 m-0 overflow-hidden"
                                                                                style="text-overflow: ellipsis; white-space: nowrap;"
                                                                            >
                                                                                {value.value}
                                                                            </p>

                                                                        }>
                                                                            <Match when={field()?.kind === FieldKind.Asset}>
                                                                                <Show when={imageFile(value.value)} fallback={
                                                                                    <QuestionSquare class="d-block m-auto w-auto h-100 text-secondary" viewBox="0 0 16 16" />
                                                                                }>
                                                                                    <div class="flex-grow-1">
                                                                                        <img
                                                                                            class=""
                                                                                            src={`${config.API_URL}/assets/content/${value.value}`}
                                                                                            alt={value.value}
                                                                                            style="max-width: 100%; max-height: 5rem;"
                                                                                        />
                                                                                    </div>
                                                                                </Show>
                                                                            </Match>
                                                                        </Switch>
                                                                        <Show when={value.locale}>
                                                                            <small class="ms-2"> ({locales.find((l) => l.key === value.locale)?.name})</small>
                                                                        </Show>
                                                                        <button
                                                                            type="button"
                                                                            class="btn icon-link p-1 ms-2"
                                                                            onClick={() => setShowContentValueModal({ modelField: mf, initial: value })}
                                                                        >
                                                                            <PencilSquare viewBox="0 0 16 16" />
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            class="btn text-danger icon-link p-1 ms-2"
                                                                            onClick={() => setValues(mf.id, values[mf.id].filter((v) => v !== value))}
                                                                        >
                                                                            <XLg viewBox="0 0 16 16" />
                                                                        </button>
                                                                    </li>
                                                                )
                                                            }}
                                                        </For>
                                                    </ul>
                                                </div>
                                            </>
                                        );
                                    }}
                                </For>

                                <Show when={serverError()}>
                                    <small class="text-danger mb-2">{serverError()}</small>
                                </Show>

                                <div class="d-flex justify-content-center">
                                    <button
                                        type="submit"
                                        style="max-width: 10rem;"
                                        class="btn btn-primary icon-link justify-content-center w-100"
                                        disabled={inProgress()}>
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

            <Show when={showContentValueModal()}>
                {(value) => (
                    <ContentValueModal
                        initial={value().initial ? { ...value().initial as CreateContentValue } : undefined}
                        modelField={value().modelField}
                        create={(newValue) => {
                            const initialValue = value().initial;

                            if (initialValue) {
                                const idx = values[newValue.modelFieldId].findIndex((v) => v === initialValue);

                                setValues(newValue.modelFieldId, idx, newValue);
                            } else {
                                setValues(newValue.modelFieldId, values[newValue.modelFieldId].length, newValue);
                            }

                            setShowContentValueModal(undefined);
                        }}
                        close={() => setShowContentValueModal(undefined)}
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

                <div class="row">
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
