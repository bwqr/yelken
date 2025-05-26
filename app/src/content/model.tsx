import { createMemo, createSignal, For, Show, useContext } from "solid-js";
import { ContentContext } from "../context";
import { A, useNavigate, useParams } from "@solidjs/router";
import { createStore, unwrap } from "solid-js/store";
import type { CreateModelField } from "../models";
import { HttpError } from "../api";
import XLg from 'bootstrap-icons/icons/x-lg.svg';
import PlusSquareDotted from 'bootstrap-icons/icons/plus-square-dotted.svg';
import PlusLg from 'bootstrap-icons/icons/plus-lg.svg';

const CreateModelFieldModal = (props: { close: () => void; create: (field: CreateModelField) => void; }) => {
    enum ValidationError {
        Name,
        Field
    }

    const contentCtx = useContext(ContentContext)!;

    const [name, setName] = createSignal('');
    const [fieldId, setFieldId] = createSignal(undefined as number | undefined);
    const [localized, setLocalized] = createSignal(false);
    const [multiple, setMultiple] = createSignal(false);
    const [required, setRequired] = createSignal(false);

    const [validationErrors, setValidationErrors] = createSignal(new Set<ValidationError>());

    const createField = () => {
        const errors = new Set<ValidationError>();

        if (name().trim().length === 0) {
            errors.add(ValidationError.Name);
        }

        if (fieldId() === undefined) {
            errors.add(ValidationError.Field);
        }

        setValidationErrors(errors);

        if (errors.size > 0) {
            return;
        }

        props.create({
            name: name(),
            fieldId: fieldId()!,
            localized: localized(),
            multiple: multiple(),
            required: required(),
        });
    };

    return (
        <>
            <div class="modal fade show d-block" tabindex="-1" aria-labelledby="createModelFieldModalLabel" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h1 class="modal-title fs-5" id="createModelFieldModalLabel">Add Field</h1>
                        </div>
                        <div class="modal-body">
                            <form onSubmit={(ev) => { ev.preventDefault(); createField(); }}>
                                <div class="mb-4">
                                    <label for="modelFieldName" class="form-label">Name</label>
                                    <input
                                        type="text"
                                        id="modelFieldName"
                                        class="form-control"
                                        classList={{ 'is-invalid': validationErrors().has(ValidationError.Name) }}
                                        name="name"
                                        value={name()}
                                        onInput={(ev) => setName(ev.target.value)}
                                    />
                                    <Show when={validationErrors().has(ValidationError.Name)}>
                                        <small class="invalid-feedback">Please enter name.</small>
                                    </Show>
                                </div>
                                <div class="mb-4">
                                    <label for="modelFieldId" class="form-label">Field</label>
                                    <select
                                        id="modelFieldId"
                                        class="form-select"
                                        classList={{ 'is-invalid': validationErrors().has(ValidationError.Field) }}
                                        name="fieldId"
                                        value={fieldId() ?? ''}
                                        onChange={(ev) => setFieldId(parseInt(ev.target.value))}
                                    >
                                        <option value="" disabled selected>Select a field</option>
                                        <For each={contentCtx.fields()}>
                                            {(field) => (
                                                <option value={field.id}> {field.name}</option>
                                            )}
                                        </For>
                                    </select>
                                    <Show when={validationErrors().has(ValidationError.Field)}>
                                        <small class="invalid-feedback">Please select a field.</small>
                                    </Show>
                                </div>
                                <div class="form-check mb-3">
                                    <input class="form-check-input" type="checkbox" checked={localized()} onChange={(ev) => setLocalized(ev.target.checked)} id="modelFieldLocalized" />
                                    <label class="form-check-label" for="modelFieldLocalized">
                                        Localized
                                    </label>
                                </div>
                                <div class="form-check mb-3">
                                    <input class="form-check-input" type="checkbox" checked={multiple()} onChange={(ev) => setMultiple(ev.target.checked)} id="modelFieldMultiple" />
                                    <label class="form-check-label" for="modelFieldMultiple">
                                        Multiple
                                    </label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" checked={required()} onChange={(ev) => setRequired(ev.target.checked)} id="modelFieldRequired" />
                                    <label class="form-check-label" for="modelFieldRequired">
                                        Required
                                    </label>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-outline-danger" onClick={props.close}>Discard</button>
                            <button type="button" class="btn btn-primary" onClick={createField}>Add Field</button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="modal-backdrop fade show"></div>
        </>
    );
};

export const CreateModel = () => {
    enum ValidationError {
        Name,
        Field,
    }

    enum ModelScope {
        Global,
        Theme,
    }

    const contentCtx = useContext(ContentContext)!;
    const navigate = useNavigate();

    const [name, setName] = createSignal('');
    const [scope, setScope] = createSignal(ModelScope.Global);
    const [fields, setFields] = createStore([] as CreateModelField[]);
    const [showModal, setShowModal] = createSignal(false);

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

        if (fields.length === 0) {
            errors.add(ValidationError.Field);
        }

        setValidationErrors(errors);

        if (errors.size > 0) {
            return;
        }

        setInProgress(true);

        contentCtx.createModel({
            name: name(),
            modelFields: unwrap(fields),
            themeScoped: scope() === ModelScope.Theme
        })
            .then(() => navigate('/model'))
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
        <div class="container mt-4">
            <h2 class="mb-4">Create Model</h2>

            <div class="row">
                <form class="col-md-4" onSubmit={onSubmit}>
                    <div class="mb-4">
                        <label for="modelName" class="form-label">Model Name</label>
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

                    <div class="mb-4" role="group">
                        <label class="form-label">Scope</label>
                        <div class="btn-group w-100">
                            <input
                                type="radio"
                                class="btn-check"
                                name="modelScope"
                                id="modelScopeGlobal"
                                autocomplete="off"
                                checked={scope() === ModelScope.Global}
                                onChange={() => setScope(ModelScope.Global)}
                            />
                            <label class="btn btn-outline-secondary" for="modelScopeGlobal">Global</label>

                            <input
                                type="radio"
                                class="btn-check"
                                name="modelScope"
                                id="modelScopeTheme"
                                autocomplete="off"
                                checked={scope() === ModelScope.Theme}
                                onChange={() => setScope(ModelScope.Theme)}
                            />
                            <label class="btn btn-outline-secondary" for="modelScopeTheme">Theme</label>
                        </div>
                    </div>

                    <label class="form-label">Fields</label>

                    <hr class="mt-0" />

                    <For each={fields}>
                        {(mf) => {
                            const field = contentCtx.fields().find((f) => f.id === mf.fieldId);

                            return (
                                <div class="d-flex border rounded p-2 border-1 border-black mb-3" style="border-style: dashed !important;">
                                    <div class="flex-grow-1">
                                        <p class="m-0">{mf.name}</p>
                                        <small>Field: {field?.name}{mf.localized ? ', Localized' : ''}{mf.multiple ? ', Multiple' : ''}{mf.required ? ', Required' : ''}</small>
                                    </div>
                                    <div>
                                        <button type="button" class="btn btn-outline-danger icon-link p-1" onClick={() => setFields(fields.filter((f) => f !== mf))}>
                                            <XLg viewBox="0 0 16 16" />
                                        </button>
                                    </div>
                                </div>
                            );
                        }}
                    </For>

                    <div class="mb-4 py-1">
                        <button
                            type="button"
                            class="btn btn-outline-secondary icon-link justify-content-center w-100"
                            classList={{ 'btn-outline-danger': validationErrors().has(ValidationError.Field) }}
                            onClick={() => setShowModal(true)}
                        >
                            <PlusSquareDotted viewBox="0 0 16 16" />
                            Add field
                        </button>
                        <Show when={validationErrors().has(ValidationError.Field)}>
                            <small class="text-danger">Please add at least one field.</small>
                        </Show>
                    </div>

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
            </div>

            <Show when={showModal()}>
                <CreateModelFieldModal
                    create={(field) => { setFields(fields.length, field); setShowModal(false) }}
                    close={() => setShowModal(false)}
                />
            </Show>
        </div>
    );
};

export const Models = () => {
    const contentCtx = useContext(ContentContext)!;

    return (
        <div class="container mt-4">
            <div class="d-flex align-items-center mb-4">
                <div class="flex-grow-1">
                    <h1>Models</h1>
                </div>
                <A class="btn btn-outline-primary icon-link" href="/model/create-model">
                    <PlusLg viewBox="0 0 16 16" />
                    Create model
                </A>
            </div>

            <div class="border border-1 border-secondary-subtle rounded p-2 shadow-sm">
                <table class="table table-hover m-0">
                    <thead>
                        <tr>
                            <th scope="col">#</th>
                            <th scope="col">Namespace</th>
                            <th scope="col">Name</th>
                            <th scope="col"># Fields</th>
                        </tr>
                    </thead>
                    <tbody class="table-group-divider">
                        <For each={contentCtx.models()}>
                            {(model) => (
                                <tr>
                                    <td>{model.id}</td>
                                    <td>{model.namespace ? model.namespace : '-'}</td>
                                    <td>
                                        <A href={model.namespace ? `/model/model/${model.namespace}/${model.name}` : `/model/model/${model.name}`}>
                                            {model.name}
                                        </A>
                                    </td>
                                    <td> {model.fields.length} </td>
                                </tr>
                            )}
                        </For>
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export const Model = () => {
    const contentCtx = useContext(ContentContext)!;
    const params = useParams();

    const model = createMemo(() => {
        const namespace = params.namespace === undefined ? null : decodeURIComponent(params.namespace);
        const name = decodeURIComponent(params.name);

        return contentCtx.models().find((m) => m.namespace === namespace && m.name === name);
    });

    return (
        <Show when={model()}>
            {(m) => (
                <div class="container mt-4">
                    <div>
                        <h2 class="m-0">{m().name}</h2>
                        <small>Model</small>
                    </div>

                    <div class="row mt-4">
                        <div class="col-md-4">
                            <label class="form-label">Scope</label>
                            <div class="btn-group w-100 mb-4">
                                <input
                                    type="radio"
                                    class="btn-check"
                                    name="modelScope"
                                    id="modelScopeGlobal"
                                    autocomplete="off"
                                    checked={m().namespace === null}
                                    disabled
                                />
                                <label class="btn btn-outline-secondary" for="modelScopeGlobal">Global</label>

                                <input
                                    type="radio"
                                    class="btn-check"
                                    name="modelScope"
                                    id="modelScopeTheme"
                                    autocomplete="off"
                                    checked={m().namespace !== null}
                                    disabled
                                />
                                <label class="btn btn-outline-secondary" for="modelScopeTheme">Theme{m().namespace !== null ? ` (${m().namespace})` : ''}</label>
                            </div>

                            <label class="form-label">Fields</label>

                            <hr class="mt-0" />

                            <For each={m().fields}>
                                {(mf) => {
                                    const field = contentCtx.fields().find((f) => f.id === mf.fieldId);

                                    return (
                                        <div class="d-flex border rounded p-2 border-1 border-black mb-3">
                                            <div class="flex-grow-1">
                                                <p class="m-0">{mf.name}</p>
                                                <small>Field: {field?.name}{mf.localized ? ', Localized' : ''}{mf.multiple ? ', Multiple' : ''}{mf.required ? ', Required' : ''}</small>
                                            </div>
                                        </div>
                                    );
                                }}
                            </For>
                        </div>
                    </div>
                </div>
            )}
        </Show>
    );
};
