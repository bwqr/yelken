import { createEffect, createMemo, createSignal, For, onCleanup, Show, useContext } from "solid-js";
import { ContentContext } from "../lib/content/context";
import { Model as ModelModel, type ModelField } from "../lib/content/models";
import { A, useNavigate, useParams } from "@solidjs/router";
import { createStore, unwrap } from "solid-js/store";
import type { CreateModelField } from "../lib/content/requests";
import { HttpError } from "../lib/api";
import { FloppyFill, PencilSquare, PlusLg, PlusSquareDotted, ThreeDotsVertical, Trash, XLg } from "../Icons";
import { AlertContext } from "../lib/context";
import { dropdownClickListener } from "../lib/utils";
import { Dynamic } from "solid-js/web";
import ProgressSpinner from "../components/ProgressSpinner";
import DeleteConfirmModal from "../components/DeleteConfirmModal";

const ModelFieldModal = (props: {
    close: () => void;
    create: (field: CreateModelField) => Promise<void> | void;
    initial?: CreateModelField
}) => {
    enum ValidationError {
        Key,
        Name,
        Field
    }

    const alertCtx = useContext(AlertContext)!;
    const contentCtx = useContext(ContentContext)!;

    const [store, setStore] = createStore(props.initial ?? {
        key: '',
        name: '',
        desc: '',
        fieldId: undefined,
        localized: false,
        multiple: false,
        required: false,
    })

    const [inProgress, setInProgress] = createSignal(false);

    const [validationErrors, setValidationErrors] = createSignal(new Set<ValidationError>());
    const [serverError, setServerError] = createSignal(undefined as string | undefined);

    const close = () => {
        if (inProgress()) {
            return;
        }

        props.close();
    }

    const createField = (ev: SubmitEvent) => {
        ev.preventDefault();

        if (inProgress()) {
            return;
        }

        setServerError(undefined);

        const errors = new Set<ValidationError>();

        if (store.key.trim().length === 0) {
            errors.add(ValidationError.Key);
        }

        if (store.name.trim().length === 0) {
            errors.add(ValidationError.Name);
        }

        if (store.fieldId === undefined) {
            errors.add(ValidationError.Field);
        }

        setValidationErrors(errors);

        if (errors.size > 0) {
            return;
        }

        const promise = props.create({
            key: store.key.trim(),
            name: store.name.trim(),
            desc: store.desc && store.desc.trim().length > 0 ? store.desc.trim() : null,
            fieldId: store.fieldId!,
            localized: store.localized,
            multiple: store.multiple,
            required: store.required,
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
            <div class="modal fade show d-block" tabindex="-1" aria-labelledby="createModelFieldModalLabel" aria-hidden="true">
                <div class="modal-dialog">
                    <form class="modal-content" onSubmit={createField}>
                        <div class="modal-header">
                            <h1 class="modal-title fs-5" id="createModelFieldModalLabel">{props.initial ? 'Edit Field' : 'Add Field'}</h1>
                        </div>
                        <div class="modal-body">
                            <div class="mb-4">
                                <label for="modelFieldName" class="form-label">Name</label>
                                <input
                                    type="text"
                                    id="modelFieldName"
                                    class="form-control"
                                    classList={{ 'is-invalid': validationErrors().has(ValidationError.Name) }}
                                    name="name"
                                    value={store.name}
                                    onInput={(ev) => setStore('name', ev.target.value)}
                                />
                                <Show when={validationErrors().has(ValidationError.Name)}>
                                    <small class="invalid-feedback">Please enter name.</small>
                                </Show>
                            </div>

                            <div class="mb-4">
                                <label for="modelFieldKey" class="form-label">Key</label>
                                <input
                                    type="text"
                                    id="modelFieldKey"
                                    class="form-control"
                                    classList={{ 'is-invalid': validationErrors().has(ValidationError.Key) }}
                                    name="key"
                                    value={store.key}
                                    onInput={(ev) => setStore('key', ev.target.value)}
                                />
                                <Show when={validationErrors().has(ValidationError.Key)}>
                                    <small class="invalid-feedback">Please enter key.</small>
                                </Show>
                            </div>

                            <div class="mb-4">
                                <label for="modelFieldDesc" class="form-label">Description <small class="text-secondary">(optional)</small></label>
                                <textarea
                                    id="modelFieldDesc"
                                    class="form-control"
                                    rows="2"
                                    value={store.desc ?? ''}
                                    onChange={(ev) => setStore('desc', ev.target.value)}
                                ></textarea>
                            </div>

                            <div class="mb-4">
                                <label for="modelFieldId" class="form-label">Field</label>
                                <select
                                    id="modelFieldId"
                                    class="form-select"
                                    classList={{ 'is-invalid': validationErrors().has(ValidationError.Field) }}
                                    name="fieldId"
                                    value={store.fieldId ?? ''}
                                    onChange={(ev) => setStore('fieldId', parseInt(ev.target.value))}
                                >
                                    <option value="" disabled selected>Select a field</option>
                                    <For each={contentCtx.fields()}>
                                        {(field) => (
                                            <option value={field.id}>{field.name}</option>
                                        )}
                                    </For>
                                </select>
                                <Show when={validationErrors().has(ValidationError.Field)}>
                                    <small class="invalid-feedback">Please select a field.</small>
                                </Show>
                            </div>
                            <div class="form-check mb-3">
                                <input class="form-check-input" type="checkbox" checked={store.localized} onChange={(ev) => setStore('localized', ev.target.checked)} id="modelFieldLocalized" />
                                <label class="form-check-label" for="modelFieldLocalized">
                                    Localized
                                </label>
                            </div>
                            <div class="form-check mb-3">
                                <input class="form-check-input" type="checkbox" checked={store.multiple} onChange={(ev) => setStore('multiple', ev.target.checked)} id="modelFieldMultiple" />
                                <label class="form-check-label" for="modelFieldMultiple">
                                    Multiple
                                </label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" checked={store.required} onChange={(ev) => setStore('required', ev.target.checked)} id="modelFieldRequired" />
                                <label class="form-check-label" for="modelFieldRequired">
                                    Required
                                </label>
                            </div>
                            <Show when={serverError()}>
                                <div class="mb-2">
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

            <div class="modal-backdrop fade show"></div>
        </>
    );
};

export const CreateModel = () => {
    enum ValidationError {
        Name,
        Key,
        Field,
    }

    const alertCtx = useContext(AlertContext)!;
    const contentCtx = useContext(ContentContext)!;
    const navigate = useNavigate();

    const [key, setKey] = createSignal('');
    const [name, setName] = createSignal('');
    const [desc, setDesc] = createSignal('');
    const [themeScoped, setThemeScoped] = createSignal(false);
    const [fields, setFields] = createStore([] as CreateModelField[]);
    const [showModal, setShowModal] = createSignal(false as CreateModelField | boolean);

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

        if (key().trim().length === 0) {
            errors.add(ValidationError.Key);
        }

        if (name().trim().length === 0) {
            errors.add(ValidationError.Name);
        }

        if (fields.length === 0) {
            errors.add(ValidationError.Field);
        }

        setValidationErrors(errors);

        if (errors.size > 0) {
            return;
        }

        setInProgress(true);

        contentCtx.createModel({
            namespace: themeScoped() ? contentCtx.options().theme : null,
            key: key().trim(),
            name: name().trim(),
            desc: desc().trim().length > 0 ? desc().trim() : null,
            modelFields: unwrap(fields),
        })
            .then(async (model) => {
                await contentCtx.loadModels();

                alertCtx.success(`Model "${model.name}" is created successfully`);

                navigate(`/models/view/${model.urlPath()}`, { replace: true });
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
            <h2 class="mb-5">Create Model</h2>

            <div class="row">
                <form class="offset-md-3 col-md-6" onSubmit={onSubmit}>
                    <div class="border rounded p-3 mb-4">
                        <div class="mb-4">
                            <label for="modelName" class="form-label">Name</label>
                            <input
                                type="text"
                                class="form-control"
                                classList={{ 'is-invalid': validationErrors().has(ValidationError.Name) }}
                                id="modelName"
                                name="name"
                                value={name()}
                                onInput={(ev) => setName(ev.target.value)}
                            />
                            <Show when={validationErrors().has(ValidationError.Name)}>
                                <small class="invalid-feedback">Please enter a name.</small>
                            </Show>
                        </div>

                        <div class="mb-4">
                            <label for="modelKey" class="form-label">Key</label>
                            <input
                                type="text"
                                class="form-control"
                                classList={{ 'is-invalid': validationErrors().has(ValidationError.Key) }}
                                id="modelKey"
                                name="key"
                                value={key()}
                                onInput={(ev) => setKey(ev.target.value)}
                            />
                            <Show when={validationErrors().has(ValidationError.Key)}>
                                <small class="invalid-feedback">Please enter a key.</small>
                            </Show>
                        </div>

                        <div class="mb-4">
                            <label for="modelDesc" class="form-label">Description <small class="text-secondary">(optional)</small></label>
                            <textarea
                                id="modelDesc"
                                class="form-control"
                                rows="3"
                                value={desc()}
                                onChange={(ev) => setDesc(ev.target.value)}
                            ></textarea>
                        </div>

                        <label class="form-label">Namespace</label>
                        <div>
                            <div class="form-check form-check-inline">
                                <input
                                    type="radio"
                                    class="form-check-input"
                                    name="modelScope"
                                    id="modelScopeGlobal"
                                    autocomplete="off"
                                    checked={!themeScoped()}
                                    onChange={() => setThemeScoped(false)}
                                />
                                <label class="form-check-label" for="modelScopeGlobal">Global</label>
                            </div>
                            <div class="form-check form-check-inline">
                                <input
                                    type="radio"
                                    class="form-check-input"
                                    name="modelScope"
                                    id="modelScopeTheme"
                                    autocomplete="off"
                                    checked={themeScoped()}
                                    onChange={() => setThemeScoped(true)}
                                />
                                <label class="form-check-label" for="modelScopeTheme">Active Theme ({contentCtx.options().theme})</label>
                            </div>
                        </div>
                    </div>

                    <hr />

                    <div class="mb-4">
                        <div class="d-flex align-items-center">
                            <h5 class="flex-grow-1 m-0">Fields</h5>
                            <button
                                type="button"
                                class="btn btn-secondary icon-link justify-content-center"
                                classList={{ 'btn-warning': validationErrors().has(ValidationError.Field) }}
                                onClick={() => setShowModal(true)}
                            >
                                <PlusSquareDotted viewBox="0 0 16 16" />
                                Add field
                            </button>
                        </div>
                        <Show when={validationErrors().has(ValidationError.Field)}>
                            <small class="text-danger mt-2">Please add at least one field.</small>
                        </Show>
                    </div>

                    <For each={fields}>
                        {(mf) => {
                            const field = () => contentCtx.fields().find((f) => f.id === mf.fieldId);

                            return (
                                <div class="card mb-4">
                                    <div class="card-header d-flex">
                                        <h5 class="flex-grow-1 m-0">{mf.name} (<small>{mf.key}</small>)</h5>
                                        <button type="button" class="btn icon-link p-1 ms-2" onClick={() => setShowModal(mf)}>
                                            <PencilSquare viewBox="0 0 16 16" />
                                        </button>
                                        <button type="button" class="btn text-danger icon-link p-1 ms-2" onClick={() => setFields(fields.filter((f) => f !== mf))}>
                                            <XLg viewBox="0 0 16 16" />
                                        </button>
                                    </div>
                                    <ul class="list-group list-group-flush">
                                        <li class="list-group-item">{field()?.name}</li>

                                        {(() => {
                                            const features = [];
                                            if (mf.localized) {
                                                features.push('Localized');
                                            }

                                            if (mf.required) {
                                                features.push('Required');
                                            }

                                            if (mf.multiple) {
                                                features.push('Multiple');
                                            }

                                            const text = features.join(' - ');

                                            return text.length === 0 ? (<></>) : (<li class="list-group-item">{features.join(' - ')}</li>);
                                        })()}
                                    </ul>
                                </div>
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
            </div>

            <Show when={showModal()}>
                {(initial) => (
                    <ModelFieldModal
                        initial={typeof initial() === 'object' ? { ...initial() as CreateModelField } : undefined}
                        create={(newField) => {
                            const initialField = initial();

                            if (typeof initialField === 'object') {
                                const idx = fields.findIndex((f) => f === initialField);

                                setFields(idx, newField);
                            } else {
                                setFields(fields.length, newField);
                            }

                            setShowModal(false);
                        }}
                        close={() => setShowModal(false)}
                    />
                )}
            </Show>
        </div>
    );
};

export const Models = () => {
    const contentCtx = useContext(ContentContext)!;

    return (
        <div class="container py-4 px-md-4">
            <div class="d-flex align-items-center mb-5">
                <h1 class="flex-grow-1 m-0">Models</h1>
                <A class="btn btn-outline-primary icon-link" href="/models/create">
                    <PlusLg viewBox="0 0 16 16" />
                    Create Model
                </A>
            </div>

            <Show when={contentCtx.models().length > 0} fallback={
                <p class="text-secondary text-center">There is no model to display yet. You can create a new one by using <strong>Create Model</strong> button.</p>
            }>
                <div class="row">
                    <div class="offset-md-3 col-md-6">
                        <table class="table table-hover border shadow-sm">
                            <thead>
                                <tr>
                                    <th></th>
                                    <th scope="col">#</th>
                                    <th scope="col">Namespace</th>
                                    <th scope="col">Name</th>
                                    <th scope="col">Created At</th>
                                </tr>
                            </thead>
                            <tbody>
                                <For each={contentCtx.models()}>
                                    {(model) => (
                                        <tr>
                                            <td></td>
                                            <td>{model.id}</td>
                                            <td>{model.namespace ? model.namespace : '-'}</td>
                                            <td>
                                                <A href={`/models/view/${model.urlPath()}`}>
                                                    {model.name}
                                                </A>
                                            </td>
                                            <td>{model.createdAt.toDateString()}</td>
                                        </tr>
                                    )}
                                </For>
                            </tbody>
                        </table>
                    </div>
                </div>
            </Show>
        </div>
    );
};

export const Model = () => {
    enum Action {
        UpdateDetails,
    }

    enum ValidationError {
        Name,
    }

    const alertCtx = useContext(AlertContext)!;
    const contentCtx = useContext(ContentContext)!;
    const params = useParams();
    const navigate = useNavigate();

    const model = createMemo(() => contentCtx.models().find(ModelModel.searchWithParams(params.namespace, params.key)));

    const [modelDetails, setModelDetails] = createStore({ name: '', desc: '' });
    const [editingDetails, setEditingDetails] = createSignal(false);

    createEffect(() => setModelDetails({ name: model()?.name ?? '', desc: model()?.desc ?? '' }));

    const [editingField, setEditingField] = createSignal(undefined as ModelField | undefined);
    const [creatingField, setCreatingField] = createSignal(false);

    const [deletingModel, setDeletingModel] = createSignal(false);
    const [deletingField, setDeletingField] = createSignal(undefined as ModelField | undefined);

    const [inProgress, setInProgress] = createSignal(undefined as Action | undefined);

    const [validationErrors, setValidationErrors] = createSignal(new Set<ValidationError>());

    const [dropdown, setDropdown] = createSignal(false);
    onCleanup(dropdownClickListener('model-detail-dropdown', () => setDropdown(false), () => !deletingModel()));

    const deleteModel = () => {
        const m = model();

        if (!m) {
            return;
        }

        return contentCtx.deleteModel(m.id)
            .then(() => contentCtx.loadModels())
            .then(() => {
                setDeletingModel(false);

                alertCtx.success(`Model "${m.name}" is deleted successfully`);

                navigate('/models', { replace: true });
            });
    }

    const saveDetails = () => {
        const m = model();

        if (inProgress() !== undefined || !m) {
            return;
        }

        const errors = new Set<ValidationError>();

        if (modelDetails.name.trim().length === 0) {
            errors.add(ValidationError.Name);
        }

        setValidationErrors(errors);

        if (errors.size > 0) {
            return;
        }

        setInProgress(Action.UpdateDetails);

        contentCtx.updateModelDetails(
            m.id,
            modelDetails.name,
            modelDetails.desc.trim().length > 0 ? modelDetails.desc : null
        )
            .then(() => contentCtx.loadModels())
            .then(() => {
                setEditingDetails(false);

                alertCtx.success(`Model "${modelDetails.name}" is updated successfully`);
            })
            .catch((e) => alertCtx.fail(e.message))
            .finally(() => setInProgress(undefined));
    }

    const saveField = async (id: number, updatedField: CreateModelField) => {
        return contentCtx.updateModelField(id, {
            name: updatedField.name,
            desc: updatedField.desc,
            localized: updatedField.localized,
            required: updatedField.required,
            multiple: updatedField.multiple,
        })
            .then(() => contentCtx.loadModels())
            .then(() => {
                setEditingField(undefined);

                alertCtx.success(`Field "${updatedField.name}" is updated successfully`);
            });
    };

    const createField = async (newField: CreateModelField) => {
        const m = model();

        if (!m) {
            return;
        }

        return contentCtx.createModelField(m.id, newField)
            .then(() => contentCtx.loadModels())
            .then(() => {
                setCreatingField(false);

                alertCtx.success(`Field "${newField.name}" is created successfully`);
            });
    };

    const deleteField = async (modelField: ModelField) => {
        return contentCtx.deleteModelField(modelField.id)
            .then(() => contentCtx.loadModels())
            .then(() => {
                setDeletingField(undefined);

                alertCtx.success(`Field "${modelField.name}" is deleted successfully`);
            });
    }

    return (
        <div class="container py-4 px-md-4">
            <Show when={model()} fallback={
                <p class="text-secondary text-center">Could not find the model with key <strong>{params.key}</strong>.</p>
            }>
                {(model) => (
                    <>
                        <div class="d-flex align-items-center mb-5">
                            <div class="flex-grow-1">
                                <h2 class="m-0">{model().name}</h2>
                                <small>Model</small>
                            </div>
                            <div class="dropdown mx-2">
                                <button class="btn icon-link px-1" on:click={(ev) => { ev.stopPropagation(); setDropdown(!dropdown()); }}>
                                    <ThreeDotsVertical viewBox="0 0 16 16" />
                                </button>
                                <ul id="model-detail-dropdown" class="dropdown-menu mt-1 shadow" style="right: 0;" classList={{ 'show': dropdown() }}>
                                    <li>
                                        <button class="dropdown-item text-danger icon-link py-2" onClick={() => setDeletingModel(true)}>
                                            <Trash viewBox="0 0 16 16" />
                                            Delete
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

                                    <table class="table table-borderless w-100 m-0">
                                        <tbody>
                                            <tr>
                                                <td style="width: 25%">Name</td>
                                                <td class="text-end" classList={{ 'py-1': editingDetails() }}>
                                                    <Show when={editingDetails()} fallback={model().name}>
                                                        <input
                                                            id="modelName"
                                                            type="text"
                                                            class="form-control float-end w-auto"
                                                            classList={{ 'is-invalid': validationErrors().has(ValidationError.Name) }}
                                                            name="name"
                                                            value={modelDetails.name}
                                                            onInput={(ev) => setModelDetails('name', ev.target.value)}
                                                        />
                                                    </Show>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td>Key</td>
                                                <td class="text-end" classList={{ 'py-1': editingDetails() }}>
                                                    <Show when={editingDetails()} fallback={model().key}>
                                                        <input
                                                            id="modelKey"
                                                            type="text"
                                                            class="form-control float-end w-auto"
                                                            name="key"
                                                            value={model().key}
                                                            disabled={true}
                                                        />
                                                    </Show>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td>Description</td>
                                                <td class="text-end" classList={{ 'py-1': editingDetails() }}>
                                                    <Show when={editingDetails()} fallback={model().desc ?? '-'}>
                                                        <textarea
                                                            id="modelDesc"
                                                            class="form-control"
                                                            rows="3"
                                                            value={modelDetails.desc}
                                                            onInput={(ev) => setModelDetails('desc', ev.target.value)}
                                                        ></textarea>
                                                    </Show>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div class="offset-md-1 col-md-5">
                                <div class="border rounded p-3">
                                    <div class="d-flex justify-content-center">
                                        <h5 class="flex-grow-1 m-0">Fields</h5>
                                        <button type="button" class="btn icon-link py-0 px-1" onClick={() => setCreatingField(true)}>
                                            <PlusSquareDotted viewBox="0 0 16 16" />
                                            Add field
                                        </button>
                                    </div>

                                    <hr />

                                    <For each={model().fields}>
                                        {(mf) => {
                                            const field = () => contentCtx.fields().find((f) => f.id === mf.fieldId);

                                            return (
                                                <div class="card mb-4">
                                                    <div class="card-header d-flex">
                                                        <h5 class="flex-grow-1 m-0">{mf.name} (<small>{mf.key}</small>)</h5>
                                                        <button
                                                            type="button"
                                                            class="btn icon-link p-1 ms-2"
                                                            onClick={() => setEditingField(mf)}
                                                        >
                                                            <PencilSquare viewBox="0 0 16 16" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            class="btn text-danger icon-link p-1 ms-2"
                                                            onClick={() => setDeletingField(mf)}
                                                        >
                                                            <XLg viewBox="0 0 16 16" />
                                                        </button>
                                                    </div>
                                                    <ul class="list-group list-group-flush">
                                                        <li class="list-group-item">{field()?.name}</li>

                                                        {(() => {
                                                            const features = [];
                                                            if (mf.localized) {
                                                                features.push('Localized');
                                                            }

                                                            if (mf.required) {
                                                                features.push('Required');
                                                            }

                                                            if (mf.multiple) {
                                                                features.push('Multiple');
                                                            }

                                                            const text = features.join(' - ');

                                                            return text.length === 0 ? (<></>) : (<li class="list-group-item">{features.join(' - ')}</li>);
                                                        })()}
                                                    </ul>
                                                </div>
                                            );
                                        }}
                                    </For>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </Show>
            <Show when={editingField()}>
                {(field) => (
                    <ModelFieldModal
                        close={() => setEditingField(undefined)}
                        create={(updatedField) => saveField(field().id, updatedField)}
                        initial={{ ...field() }}
                    />
                )}
            </Show>
            <Show when={creatingField()}>
                <ModelFieldModal
                    close={() => setCreatingField(false)}
                    create={createField}
                />
            </Show>
            <Show when={deletingModel()}>
                <DeleteConfirmModal
                    message={<p>Are you sure about deleting the model <strong>{model()?.name}</strong>?</p>}
                    close={() => setDeletingModel(false)}
                    confirm={deleteModel}
                />
            </Show>
            <Show when={deletingField()}>
                {(field) => (
                    <DeleteConfirmModal
                        message={<p>Are you sure about deleting the field <strong>{field().name}</strong>?</p>}
                        close={() => setDeletingField(undefined)}
                        confirm={() => deleteField(field())}
                    />
                )}
            </Show>
        </div>
    );
};
