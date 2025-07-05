import { A, Navigate, useNavigate, useParams, useSearchParams } from "@solidjs/router";
import { CMSContext } from "../lib/cms/context";
import { createEffect, createMemo, createResource, createSignal, For, type JSX, Match, onCleanup, Show, Switch, useContext } from "solid-js";
import { HttpError } from "../lib/api";
import { createStore, unwrap } from "solid-js/store";
import { ContentStage, FieldKind, Model, type ContentValue, type ModelField } from "../lib/cms/models";
import { Dynamic } from "solid-js/web";
import type { CreateContentValue } from "../lib/cms/requests";
import { AlertContext, CommonContext } from "../lib/context";
import { Bookmark, CheckCircleFill, FloppyFill, Images, PencilSquare, PlusLg, PlusSquareDotted, FileEarmarkFill, ThreeDotsVertical, Trash, XLg } from "../Icons";
import { PickAsset } from "./Asset";
import { PaginationRequest } from "../lib/models";
import { Pagination } from "../components/Pagination";
import { dropdownClickListener } from "../lib/utils";
import ProgressSpinner from "../components/ProgressSpinner";
import * as config from '../lib/config';
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import ProfileIcon from "../components/ProfileIcon";

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
    const commonCtx = useContext(CommonContext)!;
    const cmsCtx = useContext(CMSContext)!;

    const [store, setStore] = createStore(props.initial ?? {
        value: '',
        locale: '',
    });

    const [inProgress, setInProgress] = createSignal(false);
    const [validationErrors, setValidationErrors] = createSignal(new Set<ValidationError>());
    const [serverError, setServerError] = createSignal(undefined as string | undefined);

    const [showPickAsset, setShowPickAsset] = createSignal(false);

    const field = () => cmsCtx.fields().find((f) => f.id === props.modelField.fieldId);

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
                                        <div class="mb-4">
                                            <label for="modelFieldName" class="form-label">Field Name</label>
                                            <input
                                                id="modelFieldName"
                                                name="modelFieldName"
                                                type="text"
                                                class="form-control"
                                                value={props.modelField.name}
                                                disabled
                                            />
                                        </div>
                                        <div>
                                            <label for="modelFieldValue" class="form-label">Value</label>
                                            <Switch fallback={<p>Unsupported field</p>}>
                                                <Match when={field().kind === FieldKind.Asset}>
                                                    <Show when={store.value}>
                                                        <div class="mb-2" style="height: 6rem">
                                                            <Show when={imageFile(store.value)} fallback={
                                                                <FileEarmarkFill class="d-block m-auto w-auto h-100 text-secondary-emphasis" viewBox="0 0 16 16" />
                                                            }>
                                                                <img
                                                                    class="d-block m-auto w-auto"
                                                                    src={config.resolveURL(config.API_URL, `/assets/content/${store.value}`)}
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
                                                        disabled
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
                                                <Match when={field().kind === FieldKind.Multiline}>
                                                    <textarea
                                                        id="modelFieldValue"
                                                        name="modelFieldValue"
                                                        class="form-control"
                                                        classList={{ 'is-invalid': validationErrors().has(ValidationError.Value) }}
                                                        rows="5"
                                                        value={store.value}
                                                        onInput={(ev) => setStore('value', ev.target.value)}
                                                    ></textarea>
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
                                                </Match>
                                            </Switch>
                                            <Show when={validationErrors().has(ValidationError.Value)}>
                                                <small class="invalid-feedback">Please specify a value for {props.modelField.name}.</small>
                                            </Show>
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
                                                    <For each={commonCtx.activeLocales()}>
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
    const models = useContext(CMSContext)!.models();

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
    const cmsCtx = useContext(CMSContext)!;
    return (
        <div class="container py-4 px-md-4">
            <Show when={cmsCtx.models()[0]} fallback={
                <p class="text-secondary text-center">A <strong>Model</strong> needs to be created first to create a <strong>Content</strong>. You can create a new model in <A href="/models">Models</A> page.</p>
            }>
                {(model) => (<Navigate href={`/contents/by-model/${model().urlPath()}`} />)}
            </Show>
        </div>
    );
};

export const ContentsByModel = () => {
    const cmsCtx = useContext(CMSContext)!;
    const [searchParams, setSearchParams] = useSearchParams();
    const params = useParams();

    const pagination = createMemo(() => PaginationRequest.fromParams(searchParams.page, searchParams.perPage));

    const model = createMemo(() => cmsCtx.models().find(Model.searchWithParams(params.namespace, params.key)));

    const [contents] = createResource(
        () => model() ? { model: model()!, pagination: pagination() } : undefined,
        ({ model, pagination }) => cmsCtx.fetchContents(model.id, pagination)
    );

    return (
        <div class="container py-4 px-md-4">
            <div class="d-flex align-items-center mb-5">
                <h1 class="flex-grow-1 m-0">Contents</h1>
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
                    <p class="text-danger-emphasis text-center">Error while fetching contents: <strong>{contents.error.message}</strong></p>
                </Match>
                <Match when={contents() && contents()!.currentPage === 1 && contents()!.items.length === 0}>
                    <p class="text-secondary text-center">There is no content for the <strong>{model()?.name}</strong> model to display yet. You can create a new one by using <strong>Create Content</strong> button.</p>
                </Match>
                <Match when={contents()}>
                    {(contents) => (
                        <div class="row">
                            <div class="offset-md-2 col-md-8">
                                <Show when={contents().items.length > 0} fallback={
                                    <p class="text-secondary text-center mb-4">There is no content to display for <strong>page {searchParams.page}</strong>.</p>
                                }>
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
                                </Show>

                                <Pagination
                                    totalPages={contents().totalPages}
                                    page={contents().currentPage}
                                    perPage={pagination().perPage}
                                    pageChange={(page) => setSearchParams({ page: page.toString() })}
                                />
                            </div>
                        </div>
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
    const commonCtx = useContext(CommonContext)!;
    const cmsCtx = useContext(CMSContext)!;
    const params = useParams();
    const navigate = useNavigate();

    const locales = commonCtx.activeLocales();
    const model = createMemo(() => cmsCtx.models().find(Model.searchWithParams(params.namespace, params.key)));

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

        cmsCtx.createContent({
            name: name(),
            modelId: model()!.id,
            values: Object.values(unwrap(values)).flat(),
        })
            .then((content) => {
                alertCtx.success(`Content "${content.name}" is created successfully`);

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
            <h2 class="mb-5">Create Content</h2>

            <div class="row">
                <Show when={model()} fallback={
                    <p class="text-secondary text-center">Could not find the model with key <strong>{params.key}</strong>.</p>
                }>
                    {(model) => (
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

                            <h5 class="mb-4">Values</h5>

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
                                                            const field = () => cmsCtx.fields().find((f) => f.id === mf.fieldId);

                                                            return (
                                                                <li class="list-group-item d-flex align-items-center">
                                                                    <Switch fallback={
                                                                        <p
                                                                            class="flex-grow-1 m-0 overflow-hidden text-nowrap"
                                                                            style="text-overflow: ellipsis"
                                                                        >
                                                                            {value.value}
                                                                        </p>

                                                                    }>
                                                                        <Match when={field()?.kind === FieldKind.Asset}>
                                                                            <Show when={imageFile(value.value)} fallback={
                                                                                <FileEarmarkFill class="d-block m-auto w-auto h-100 text-secondary-emphasis" viewBox="0 0 16 16" />
                                                                            }>
                                                                                <div class="flex-grow-1">
                                                                                    <img
                                                                                        class=""
                                                                                        src={config.resolveURL(config.API_URL, `/assets/content/${value.value}`)}
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
                                <div class="mb-2">
                                    <small class="text-danger">{serverError()}</small>
                                </div>
                            </Show>

                            <div class="d-flex justify-content-center">
                                <button
                                    type="submit"
                                    style="max-width: 10rem;"
                                    class="btn btn-primary icon-link justify-content-center w-100"
                                    disabled={inProgress()}
                                >
                                    <ProgressSpinner show={inProgress()} />
                                    <PlusLg viewBox="0 0 16 16" />
                                    Create
                                </button>
                            </div>
                        </form>
                    )}
                </Show>
            </div>

            <Show when={showContentValueModal()}>
                {(value) => (
                    <ContentValueModal
                        initial={value().initial ? { ...value().initial! } : undefined}
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
        UpdateDetails,
        UpdateStage,
    }

    enum ValidationError {
        Name,
    }

    const alertCtx = useContext(AlertContext)!;
    const commonCtx = useContext(CommonContext)!;
    const cmsCtx = useContext(CMSContext)!;
    const params = useParams();
    const navigate = useNavigate();

    const [content, { mutate }] = createResource(() => parseInt(params.id), (id: number) => cmsCtx.fetchContent(id));
    const model = () => cmsCtx.models().find((m) => m.id === content()?.content.modelId);

    const [contentDetails, setContentDetails] = createStore({ name: '' });
    const [editingDetails, setEditingDetails] = createSignal(false);

    createEffect(() => setContentDetails({ name: content()?.content.name ?? '' }));

    const [creatingValue, setCreatingValue] = createSignal(undefined as ModelField | undefined);
    const [editingValue, setEditingValue] = createSignal(undefined as { modelField: ModelField, value: ContentValue } | undefined);

    const [deletingContent, setDeletingContent] = createSignal(false);
    const [deletingValue, setDeletingValue] = createSignal(undefined as ContentValue | undefined);

    const [inProgress, setInProgress] = createSignal(undefined as Action | undefined);

    const [validationErrors, setValidationErrors] = createSignal(new Set<ValidationError>());

    const [dropdown, setDropdown] = createSignal(false);
    onCleanup(dropdownClickListener('content-detail-dropdown', () => setDropdown(false), () => !deletingContent()));

    const [showStageDropdown, setShowStageDropdown] = createSignal(false);
    onCleanup(dropdownClickListener('stage-detail-dropdown', () => setShowStageDropdown(false), () => inProgress() === undefined));

    const updateStage = () => {
        const c = content();

        if (inProgress() !== undefined || c === undefined) {
            return;
        }

        const stage = c.content.stage === ContentStage.Published ? ContentStage.Draft : ContentStage.Published;
        setInProgress(Action.UpdateStage);

        cmsCtx.updateContentStage(c.content.id, stage)
            .then(() => {
                setShowStageDropdown(false);

                alertCtx.success(stage === ContentStage.Published ? `Content "${c.content.name}" is published` : `Content "${c.content.name}" is marked as draft`);

                mutate({ ...c, content: { ...c.content, stage } });
            })
            .catch((e) => alertCtx.fail(e.message))
            .finally(() => setInProgress(undefined));
    };

    const saveDetails = () => {
        const c = content();

        if (inProgress() !== undefined || !c) {
            return;
        }

        const errors = new Set<ValidationError>();

        if (contentDetails.name.trim().length === 0) {
            errors.add(ValidationError.Name);
        }

        setValidationErrors(errors);

        if (errors.size > 0) {
            return;
        }

        setInProgress(Action.UpdateDetails);

        cmsCtx.updateContentDetails(
            c.content.id,
            contentDetails.name.trim(),
        )
            .then(() => {
                setEditingDetails(false);

                alertCtx.success(`Content "${contentDetails.name}" is updated successfully`);

                mutate({ ...c, content: { ...c.content, name: contentDetails.name.trim() } })
            })
            .catch((e) => alertCtx.fail(e.message))
            .finally(() => setInProgress(undefined));
    };

    const createValue = (value: CreateContentValue) => {
        const c = content();
        const modelField = model()?.fields.find((mf) => mf.id === value.modelFieldId);

        if (!c) {
            return;
        }

        return cmsCtx.createContentValue(c.content.id, value)
            .then((value) => {
                setCreatingValue(undefined);

                alertCtx.success(`Value for field "${modelField?.name ?? '-'}" is created successfully`);

                mutate({ ...c, values: [...c.values, value] });
            });
    };

    const saveValue = (id: number, value: CreateContentValue) => {
        const c = content();
        const modelField = model()?.fields.find((mf) => mf.id === value.modelFieldId);

        if (!c) {
            return;
        }

        return cmsCtx.updateContentValue(id, value)
            .then(() => {
                setEditingValue(undefined);

                alertCtx.success(`Value for field "${modelField?.name ?? '-'}" is updated successfully`);

                const idx = c.values.findIndex((v) => v.id === id);
                if (idx > -1) {
                    const values = [...c.values];

                    values[idx] = { ...values[idx], ...value };

                    mutate({ ...c, values });
                }
            });
    };

    const deleteContent = () => {
        const c = content();
        const m = model();

        if (!c) {
            return;
        }

        cmsCtx.deleteContent(c.content.id)
            .then(() => {
                setDeletingContent(false);

                alertCtx.success(`Content "${c.content.name}" is deleted successfully`);

                if (m) {
                    navigate(`/contents/by-model/${m.urlPath()}`, { replace: true });
                }
            });
    }

    const deleteValue = async (value: ContentValue) => {
        const c = content();
        const modelField = model()?.fields.find((mf) => mf.id === value.modelFieldId);

        return cmsCtx.deleteContentValue(value.id)
            .then(() => {
                setDeletingValue(undefined);

                alertCtx.success(`Value for "${modelField?.name ?? '-'}" field is deleted successfully`);

                if (c) {
                    mutate({ ...c, values: c.values.filter((v) => v.id !== value.id) })
                }
            });
    }

    const contentStyle = () => content()?.content.stage === ContentStage.Published ?
        { color: 'success', icon: CheckCircleFill } :
        { color: 'secondary', icon: Bookmark };

    return (
        <div class="container py-4 px-md-4">
            <Switch>
                <Match when={content.loading}>
                    <p class="icon-link justify-content-center w-100"><ProgressSpinner show={true} /> Loading ...</p>
                </Match>
                <Match when={content.error}>
                    <p class="text-danger-emphasis text-center">Error while fetching content: <strong>{content.error.message}</strong></p>
                </Match>
                <Match when={content.state === 'ready' && content() === undefined}>
                    <p class="text-secondary text-center">Could not find the content with id {params.id}.</p>
                </Match>
                <Match when={content()}>
                    {(content) => (
                        <>
                            <div class="d-flex align-items-center mb-5">
                                <div class="flex-grow-1">
                                    <h2 class="m-0">{content().content.name}</h2>
                                    <small>Content</small>
                                </div>
                                <div class="dropdown mx-2">
                                    <button class="btn icon-link px-1" on:click={(ev) => { ev.stopPropagation(); setDropdown(!dropdown()); }}>
                                        <ThreeDotsVertical viewBox="0 0 16 16" />
                                    </button>
                                    <ul id="content-detail-dropdown" class="dropdown-menu mt-1 shadow" classList={{ 'show': dropdown() }} style="right: 0;">
                                        <li>
                                            <button class="dropdown-item text-danger icon-link py-2" onClick={() => setDeletingContent(true)}>
                                                <Trash viewBox="0 0 16 16" />
                                                Delete
                                            </button>
                                        </li>
                                    </ul>
                                </div>
                                <div class="dropdown">
                                    <div class="btn-group">
                                        <button type="button" class={`btn icon-link btn-outline-${contentStyle().color}`} disabled>
                                            <ProgressSpinner show={inProgress() === Action.UpdateStage} />
                                            <Dynamic component={contentStyle().icon} viewBox="0 0 17 17" />
                                            <Switch>
                                                <Match when={content()?.content.stage === ContentStage.Draft}>Draft</Match>
                                                <Match when={content()?.content.stage === ContentStage.Published}>Published</Match>
                                            </Switch>
                                        </button>
                                        <button
                                            type="button"
                                            class={`btn btn-outline-${contentStyle().color} dropdown-toggle dropdown-toggle-split`}
                                            on:click={(ev) => { ev.stopPropagation(); setShowStageDropdown(!showStageDropdown()); }}
                                            aria-expanded={showStageDropdown()}
                                        >
                                            <span class="visually-hidden">Toggle Dropdown</span>
                                        </button>
                                    </div>
                                    <ul id="stage-detail-dropdown" class="dropdown-menu mt-1 show shadow" classList={{ 'show': showStageDropdown() }} style="right: 0;">
                                        <li>
                                            <button class="dropdown-item py-2" onClick={updateStage} disabled={inProgress() !== undefined}>
                                                <Switch>
                                                    <Match when={content()?.content.stage === ContentStage.Draft}>Publish</Match>
                                                    <Match when={content()?.content.stage === ContentStage.Published}>Mark as Draft</Match>
                                                </Switch>
                                            </button>
                                        </li>
                                    </ul>
                                </div>
                            </div>

                            <div class="row g-4">
                                <div class="offset-md-1 col-md-4">
                                    <div class="border rounded p-3">
                                        <div class="d-flex justify-content-center">
                                            <h5 class="flex-grow-1 m-0">Details</h5>
                                            <Show when={editingDetails()} fallback={
                                                <button type="button" class="btn icon-link py-0 px-1" onClick={() => setEditingDetails(true)}>
                                                    <PencilSquare viewBox="0 0 16 16" />
                                                    Edit
                                                </button>
                                            }>
                                                <button
                                                    type="button"
                                                    class="btn text-danger icon-link py-0 px-1"
                                                    onClick={() => setEditingDetails(false)}
                                                >
                                                    Discard
                                                </button>
                                                <button
                                                    type="button"
                                                    class="btn icon-link py-0 px-1 ms-2"
                                                    onClick={saveDetails}
                                                    disabled={inProgress() === Action.UpdateDetails}
                                                >
                                                    <ProgressSpinner show={inProgress() === Action.UpdateDetails} small={true} />
                                                    <FloppyFill viewBox="0 0 16 16" />
                                                    Save
                                                </button>
                                            </Show>
                                        </div>

                                        <hr />

                                        <table class="table table-borderless w-100 m-0" style="table-layout: fixed">
                                            <tbody>
                                                <tr>
                                                    <td style="width: 35%">Name</td>
                                                    <td class="text-end" classList={{ 'py-1': editingDetails() }}>
                                                        <Show when={editingDetails()} fallback={content().content.name}>
                                                            <input
                                                                id="modelName"
                                                                type="text"
                                                                class="form-control float-end"
                                                                classList={{ 'is-invalid': validationErrors().has(ValidationError.Name) }}
                                                                name="name"
                                                                value={contentDetails.name}
                                                                onInput={(ev) => setContentDetails('name', ev.target.value)}
                                                            />
                                                        </Show>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td>Model</td>
                                                    <td class="text-end" classList={{ 'py-1': editingDetails() }}>
                                                        <Show when={editingDetails()} fallback={model()?.title() ?? '-'}>
                                                            <input
                                                                type="text"
                                                                class="form-control float-end"
                                                                value={model()?.title() ?? '-'}
                                                                disabled
                                                            />
                                                        </Show>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td>Stage</td>
                                                    <td class="text-end py-1">
                                                        <p class="icon-link m-0">
                                                            <Dynamic component={contentStyle().icon} class={`text-${contentStyle().color}`} viewBox="0 0 17 17" />
                                                            <Switch>
                                                                <Match when={content().content.stage === ContentStage.Draft}>Draft</Match>
                                                                <Match when={content().content.stage === ContentStage.Published}>Published</Match>
                                                            </Switch>
                                                        </p>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td>Created By</td>
                                                    <td class="text-end py-1">
                                                        <p class="icon-link m-0">
                                                            <ProfileIcon name={content().user?.name ?? '-'} />
                                                            {content().user?.name ?? '-'}
                                                        </p>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                <div class="offset-md-1 col-md-5">
                                    <div class="border rounded p-3">
                                        <h5>Values</h5>

                                        <hr />

                                        <For each={model()?.fields ?? []}>
                                            {(mf) => {
                                                const locales = commonCtx.activeLocales();
                                                const field = createMemo(() => cmsCtx.fields().find((f) => f.id === mf.fieldId));
                                                const values = createMemo(() => content().values.filter((v) => v.modelFieldId === mf.id));

                                                return (
                                                    <>
                                                        <div class="card mb-4">
                                                            <div class="card-header d-flex align-items-center">
                                                                <h5 class="flex-grow-1 m-0">{mf.name}</h5>
                                                                <Show when={(mf.localized && values().length < locales.length) || mf.multiple || values().length === 0}>
                                                                    <button
                                                                        type="button"
                                                                        class="btn btn-sm btn-secondary icon-link justify-content-center"
                                                                        onClick={() => setCreatingValue(mf)}
                                                                    >
                                                                        <PlusSquareDotted viewBox="0 0 16 16" />
                                                                        Add value
                                                                    </button>
                                                                </Show>
                                                            </div>
                                                            <ul class="list-group list-group-flush">
                                                                <For each={values()}>
                                                                    {(value) => (
                                                                        <li class="list-group-item d-flex align-items-center">
                                                                            <Switch fallback={
                                                                                <p
                                                                                    class="flex-grow-1 m-0 overflow-hidden text-nowrap"
                                                                                    style="text-overflow: ellipsis"
                                                                                >
                                                                                    {/* Truncate the value to not display very long texts even though overflowing part is hidden with ellipsis. */}
                                                                                    {value.value.slice(0, 80)}
                                                                                </p>

                                                                            }>
                                                                                <Match when={field()?.kind === FieldKind.Asset}>
                                                                                    <Show when={imageFile(value.value)} fallback={
                                                                                        <FileEarmarkFill class="d-block m-auto w-auto h-100 text-secondary-emphasis" viewBox="0 0 16 16" />
                                                                                    }>
                                                                                        <div class="flex-grow-1">
                                                                                            <img
                                                                                                class=""
                                                                                                src={config.resolveURL(config.API_URL, `/assets/content/${value.value}`)}
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
                                                                                onClick={() => setEditingValue({ modelField: mf, value })}
                                                                            >
                                                                                <PencilSquare viewBox="0 0 16 16" />
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                class="btn text-danger icon-link p-1 ms-2"
                                                                                onClick={() => setDeletingValue(value)}
                                                                            >
                                                                                <XLg viewBox="0 0 16 16" />
                                                                            </button>
                                                                        </li>
                                                                    )}
                                                                </For>
                                                            </ul>
                                                        </div>
                                                    </>
                                                );
                                            }}
                                        </For>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </Match>
            </Switch>

            <Show when={editingValue()}>
                {(value) => (
                    <ContentValueModal
                        close={() => setEditingValue(undefined)}
                        create={(updatedValue) => saveValue(value().value.id, updatedValue)}
                        modelField={value().modelField}
                        initial={{ ...value().value, locale: value().value.locale ?? undefined }}
                    />
                )}
            </Show>

            <Show when={creatingValue()}>
                {(modelField) => (
                    <ContentValueModal
                        close={() => setCreatingValue(undefined)}
                        create={(value) => createValue(value)}
                        modelField={modelField()}
                    />
                )}
            </Show>

            <Show when={deletingContent()}>
                <DeleteConfirmModal
                    message={<p>Are you sure about deleting the content <strong>{content()?.content.name}</strong>?</p>}
                    close={() => setDeletingContent(false)}
                    confirm={deleteContent}
                />
            </Show>

            <Show when={deletingValue()}>
                {(value) => {
                    const modelField = model()?.fields.find((mf) => mf.id === value().modelFieldId);

                    return (
                        <DeleteConfirmModal
                            message={<p>Are you sure about deleting the value for field <strong>{modelField?.name ?? '-'}</strong>?</p>}
                            close={() => setDeletingValue(undefined)}
                            confirm={() => deleteValue(value())}
                        />
                    )
                }}
            </Show>
        </div>
    );
};
