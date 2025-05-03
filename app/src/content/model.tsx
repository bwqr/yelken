import { createSignal, For, Show } from "solid-js";
import { ContentContext } from "../context";
import { A, useNavigate, useParams } from "@solidjs/router";
import { createStore, unwrap } from "solid-js/store";
import { CreateModelField } from "../models";
import { HttpError } from "../api";

const CreateModelFieldModal = (props: { close: () => void; create: (field: CreateModelField) => void; }) => {
    enum ValidationError {
        Name,
        Field
    }

    const contentCtx = ContentContext.ctx();

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
                            <form onSubmit={(e) => { e.preventDefault(); createField(); }}>
                                <div class="mb-3">
                                    <label for="modelFieldName" class="form-label">Name</label>
                                    <input value={name()} onInput={(e) => setName(e.target.value)} type="text" class="form-control" id="modelFieldName" />
                                    <Show when={validationErrors().has(ValidationError.Name)}>
                                        <small class="text-danger">Please enter name</small>
                                    </Show>
                                </div>
                                <div class="mb-3">
                                    <label for="modelFieldId" class="form-label">Field</label>
                                    <select
                                        id="modelFieldId"
                                        class="form-select"
                                        value={fieldId()}
                                        onChange={(e) => setFieldId(parseInt(e.target.value))}
                                    >
                                        <option disabled selected>Select a field</option>
                                        <For each={contentCtx.fields()}>
                                            {(field) => (
                                                <option value={field.id}> {field.name}</option>
                                            )}
                                        </For>
                                    </select>
                                    <Show when={validationErrors().has(ValidationError.Field)}>
                                        <small class="text-danger">Please select a field</small>
                                    </Show>
                                </div>
                                <div class="form-check mb-2">
                                    <input class="form-check-input" type="checkbox" checked={localized()} onChange={(e) => setLocalized(e.target.checked)} id="modelFieldLocalized" />
                                    <label class="form-check-label" for="modelFieldLocalized">
                                        Localized
                                    </label>
                                </div>
                                <div class="form-check mb-2">
                                    <input class="form-check-input" type="checkbox" checked={multiple()} onChange={(e) => setMultiple(e.target.checked)} id="modelFieldMultiple" />
                                    <label class="form-check-label" for="modelFieldMultiple">
                                        Multiple
                                    </label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" checked={required()} onChange={(e) => setRequired(e.target.checked)} id="modelFieldRequired" />
                                    <label class="form-check-label" for="modelFieldRequired">
                                        Required
                                    </label>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" onClick={props.close}>Close</button>
                            <button type="button" class="btn btn-primary" onClick={createField}>Save changes</button>
                        </div >
                    </div >
                </div >
            </div >

            <div class="modal-backdrop fade show"></div>
        </>
    );
};

export const CreateModel = () => {
    enum ValidationError {
        Name,
        Field,
    }

    const contentCtx = ContentContext.ctx();
    const navigate = useNavigate();

    const [name, setName] = createSignal('');
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

        contentCtx.createModel({ name: name(), modelFields: unwrap(fields), themeScoped: false })
            .then(() => navigate('/content/models'))
            .catch(e => {
                if (e instanceof HttpError) {
                    setServerError(e.error);
                } else {
                    throw e;
                }
            })
            .finally(() => setInProgress(false));

        ;
    };

    return (
        <div class="container">
            <h3>Create Model</h3>
            <form class="d-block m-auto" style="max-width: 400px;" onSubmit={onSubmit}>
                <div class="mb-3">
                    <label for="modelName" class="form-label">Model Name</label>
                    <input type="text" class="form-control" id="modelName" name="name" value={name()} onInput={ev => setName(ev.target.value)} />
                    <Show when={validationErrors().has(ValidationError.Name)}>
                        <small class="text-danger">Please enter a name</small>
                    </Show>
                </div>

                <For each={fields}>
                    {(field) => (
                        <div class="border rounded p-2 border-2 border-black mb-3" style="border-style: dashed !important;">
                            <p>{field.name} <button type="button" onClick={() => setFields(fields.filter(f => f !== field))}>x</button></p>
                        </div>
                    )}
                </For>

                <Show when={validationErrors().has(ValidationError.Field)}>
                    <small class="text-danger">Please add at least one field</small>
                </Show>

                <div class="mb-3">
                    <button type="button" class="btn btn-secondary" onClick={() => setShowModal(true)}>Add field</button>
                </div>

                <div class="mb-3">
                    <button type="submit" class="btn btn-primary" disabled={inProgress()}>Create</button>
                </div>

                <Show when={serverError()}>
                    <small class="text-danger">{serverError()}</small>
                </Show>
            </form>

            <Show when={showModal()}>
                <CreateModelFieldModal
                    create={field => { setFields(fields.length, field); setShowModal(false) }}
                    close={() => setShowModal(false)}
                />
            </Show>
        </div>
    );
};

export const Models = () => {
    const contentCtx = ContentContext.ctx();

    return (
        <div class="container">
            <div class="d-flex mb-4">
                <div class="flex-grow-1">
                    <h3>Models</h3>
                </div>
                <A href="/content/create-model" class="btn btn-primary">Create new model</A>
            </div>

            <div class="d-block m-auto p-3" style="max-width: 400px;">
                <table class="table align-middle fs-6">
                    <thead>
                        <tr class="text-start text-gray-500 fs-7 text-uppercase" role="row">
                            <th><span class="">Name</span></th>
                            <th><span class=""># Fields</span></th>
                        </tr>
                    </thead>
                    <tbody class="fw-bold text-gray-600">
                        <For each={contentCtx.models()}>
                            {model => (
                                <tr>
                                    <td>
                                        <A href={model.namespace ? `/content/model/${model.namespace}/${model.name}` : `/content/model/${model.name}`}>
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
        </div >
    );
};

export const Model = () => {
    const contentCtx = ContentContext.ctx();
    const params = useParams();

    const model = () => {
        const namespace = params.namespace === undefined ? null : decodeURIComponent(params.namespace);
        const name = decodeURIComponent(params.name);

        return contentCtx.models().find(m => m.namespace === namespace && m.name === name);
    }

    return (
        <Show when={model()}>
            {m => (
                <div class="container">
                    <div class="d-block m-auto" style="max-width: 400px;">
                        <h4>{m().name}</h4>

                        <For each={m().fields}>
                            {mf => {
                                const field = contentCtx.fields().find(f => f.id === mf.fieldId);

                                if (field === undefined) {
                                    return <></>;
                                }

                                return (
                                    <div class="border rounded p-2 border-2 border-black mb-3" style="border-style: dashed !important;">
                                        <p>{mf.name} <br /> <span>{field.name}</span></p>
                                    </div>
                                );
                            }}
                        </For>
                    </div>
                </div>
            )}
        </Show>
    );
};
