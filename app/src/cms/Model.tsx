import { createEffect, createMemo, createSignal, For, onCleanup, Show, useContext } from "solid-js";
import { CMSContext } from "../lib/cms/context";
import { Model as ModelModel, type ModelField } from "../lib/cms/models";
import { A, useNavigate, useParams } from "@solidjs/router";
import { createStore, unwrap } from "solid-js/store";
import type { CreateModelField } from "../lib/cms/requests";
import { HttpError, ValidationErrors } from "../lib/api";
import { FloppyFill, PencilSquare, PlusLg, PlusSquareDotted, ThreeDotsVertical, Trash, XLg } from "../Icons";
import { CommonContext } from "../lib/context";
import { AlertContext } from "../lib/alert";
import { dropdownClickListener } from "../lib/utils";
import { Dynamic } from "solid-js/web";
import ProgressSpinner from "../components/ProgressSpinner";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import { LocaleContext } from "../lib/i18n";

const ModelFieldModal = (props: {
    close: () => void;
    create: (field: CreateModelField) => Promise<void> | void;
    restrictEdit?: boolean,
    initial?: CreateModelField
}) => {
    enum ValidationError {
        Key,
        Name,
        Field
    }

    const alertCtx = useContext(AlertContext)!;
    const cmsContext = useContext(CMSContext)!;
    const localeCtx = useContext(LocaleContext)!;

    const i18n = localeCtx.i18n.model;

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
        const req = {
            key: store.key.trim(),
            name: store.name.trim(),
            desc: store.desc?.trim() || null,
            fieldId: store.fieldId!,
            localized: store.localized,
            multiple: store.multiple,
            required: store.required,
        };

        if (req.key.length === 0) {
            errors.add(ValidationError.Key);
        }

        if (req.name.length === 0) {
            errors.add(ValidationError.Name);
        }

        if (req.fieldId === undefined) {
            errors.add(ValidationError.Field);
        }

        setValidationErrors(errors);

        if (errors.size > 0) {
            return;
        }

        const promise = props.create(req);

        if (promise instanceof Promise) {
            setInProgress(true);

            promise
                .catch((e) => {
                    const msg = e.message in i18n.serverErrors ? i18n.serverErrors[e.message as keyof typeof i18n.serverErrors] : e.message;

                    if (e instanceof HttpError) {
                        setServerError(msg);
                    } else {
                        alertCtx.fail(msg);
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
                            <h1 class="modal-title fs-5" id="createModelFieldModalLabel">{props.initial ? i18n.actions.editField() : i18n.actions.addField()}</h1>
                        </div>
                        <div class="modal-body">
                            <div class="mb-4">
                                <label for="modelFieldName" class="form-label">{localeCtx.i18n.common.labels.name()}</label>
                                <input
                                    type="text"
                                    id="modelFieldName"
                                    class="form-control"
                                    classList={{ 'is-invalid': validationErrors().has(ValidationError.Name) }}
                                    name="name"
                                    placeholder={localeCtx.i18n.common.labels.name()}
                                    value={store.name}
                                    onInput={(ev) => setStore('name', ev.target.value)}
                                />
                                <Show when={validationErrors().has(ValidationError.Name)}>
                                    <small class="invalid-feedback">{i18n.validationErrors.name()}.</small>
                                </Show>
                            </div>

                            <div class="mb-4">
                                <label for="modelFieldKey" class="form-label">{localeCtx.i18n.common.labels.key()}</label>
                                <input
                                    type="text"
                                    id="modelFieldKey"
                                    class="form-control"
                                    classList={{ 'is-invalid': validationErrors().has(ValidationError.Key) }}
                                    name="key"
                                    placeholder={localeCtx.i18n.common.labels.key()}
                                    value={store.key}
                                    onInput={(ev) => setStore('key', ev.target.value)}
                                    disabled={props.restrictEdit}
                                />
                                <Show when={validationErrors().has(ValidationError.Key)}>
                                    <small class="invalid-feedback">{i18n.validationErrors.key()}.</small>
                                </Show>
                            </div>

                            <div class="mb-4">
                                <label for="modelFieldDesc" class="form-label">{localeCtx.i18n.common.labels.description()} <small class="text-secondary">({localeCtx.i18n.common.labels.optional()})</small></label>
                                <textarea
                                    id="modelFieldDesc"
                                    class="form-control"
                                    rows="2"
                                    placeholder={localeCtx.i18n.common.labels.description()}
                                    value={store.desc ?? ''}
                                    onChange={(ev) => setStore('desc', ev.target.value)}
                                ></textarea>
                            </div>

                            <div class="mb-4">
                                <label for="modelFieldId" class="form-label">{i18n.labels.field()}</label>
                                <select
                                    id="modelFieldId"
                                    class="form-select"
                                    classList={{ 'is-invalid': validationErrors().has(ValidationError.Field) }}
                                    name="fieldId"
                                    value={store.fieldId ?? ''}
                                    onChange={(ev) => setStore('fieldId', parseInt(ev.target.value))}
                                    disabled={props.restrictEdit}
                                >
                                    <option value="" disabled selected>{i18n.actions.selectField()}</option>
                                    <For each={cmsContext.fields()}>
                                        {(field) => (
                                            <option value={field.id}>{field.key in i18n.fields ? i18n.fields[field.key as keyof typeof i18n.fields]() : field.name}</option>
                                        )}
                                    </For>
                                </select>
                                <Show when={validationErrors().has(ValidationError.Field)}>
                                    <small class="invalid-feedback">{i18n.validationErrors.selectField()}.</small>
                                </Show>
                            </div>
                            <div class="form-check mb-3">
                                <input class="form-check-input" type="checkbox" checked={store.localized} onChange={(ev) => setStore('localized', ev.target.checked)} id="modelFieldLocalized" />
                                <label class="form-check-label" for="modelFieldLocalized">
                                    {i18n.fieldFeatures.localized()}
                                </label>
                            </div>
                            <div class="form-check mb-3">
                                <input class="form-check-input" type="checkbox" checked={store.multiple} onChange={(ev) => setStore('multiple', ev.target.checked)} id="modelFieldMultiple" />
                                <label class="form-check-label" for="modelFieldMultiple">
                                    {i18n.fieldFeatures.multiple()}
                                </label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" checked={store.required} onChange={(ev) => setStore('required', ev.target.checked)} id="modelFieldRequired" />
                                <label class="form-check-label" for="modelFieldRequired">
                                    {i18n.fieldFeatures.required()}
                                </label>
                            </div>
                            <Show when={serverError()}>
                                <div class="mb-2">
                                    <small class="text-danger-emphasis">{serverError()}</small>
                                </div>
                            </Show>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-outline-danger" onClick={close} disabled={inProgress()}>{localeCtx.i18n.common.actions.discard()}</button>
                            <button type="submit" class="btn btn-primary icon-link" disabled={inProgress()}>
                                <ProgressSpinner show={inProgress()} />
                                <Dynamic component={props.initial ? FloppyFill : PlusLg} viewBox="0 0 16 16" />
                                {props.initial ? localeCtx.i18n.common.actions.save() : localeCtx.i18n.common.actions.add()}
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
    const commonCtx = useContext(CommonContext)!;
    const cmsContext = useContext(CMSContext)!;
    const localeCtx = useContext(LocaleContext)!;
    const navigate = useNavigate();

    const i18n = localeCtx.i18n.model;

    const [key, setKey] = createSignal('');
    const [name, setName] = createSignal('');
    const [desc, setDesc] = createSignal('');
    const [themeScoped, setThemeScoped] = createSignal(false);
    const [fields, setFields] = createStore([] as CreateModelField[]);
    const [showModal, setShowModal] = createSignal(false as CreateModelField | boolean);

    const [inProgress, setInProgress] = createSignal(false);

    const [validationErrors, setValidationErrors] = createSignal(new Set<ValidationError>());
    const [serverValidationErrors, setServerValidationErrors] = createSignal(undefined as ValidationErrors<'name' | 'key' | 'modelFields'> | undefined);
    const [serverError, setServerError] = createSignal(undefined as string | undefined);

    const onSubmit = (ev: SubmitEvent) => {
        ev.preventDefault();

        if (inProgress()) {
            return;
        }

        setServerError(undefined);

        const errors = new Set<ValidationError>();
        const req = {
            namespace: themeScoped() ? commonCtx.options().theme : null,
            key: key().trim(),
            name: name().trim(),
            desc: desc().trim() || null,
            modelFields: unwrap(fields),
        };

        if (req.key.length < 3) {
            errors.add(ValidationError.Key);
        }

        if (req.name.length < 3) {
            errors.add(ValidationError.Name);
        }

        if (req.modelFields.length === 0) {
            errors.add(ValidationError.Field);
        }

        setValidationErrors(errors);

        if (errors.size > 0) {
            return;
        }

        setInProgress(true);

        cmsContext.createModel(req)
            .then(async (model) => {
                await cmsContext.loadModels();

                alertCtx.success(i18n.actions.modelCreated(req.name));

                navigate(`/models/view/${model.urlPath()}`, { replace: true });
            })
            .catch((e) => {
                const msg = e.message in i18n.serverErrors ? i18n.serverErrors[e.message as keyof typeof i18n.serverErrors] : e.message;

                if (e instanceof HttpError) {
                    setServerError(msg);
                } else if (e instanceof ValidationErrors) {
                    setServerValidationErrors(e);
                } else {
                    alertCtx.fail(msg);
                }
            })
            .finally(() => setInProgress(false));
    };

    return (
        <div class="container py-4 px-md-4">
            <h2 class="mb-5">{i18n.actions.createModel()}</h2>

            <div class="row">
                <form class="offset-md-3 col-md-6" onSubmit={onSubmit}>
                    <div class="border rounded p-3 mb-4">
                        <div class="mb-4">
                            <label for="modelName" class="form-label">{localeCtx.i18n.common.labels.name()}</label>
                            <input
                                type="text"
                                class="form-control"
                                classList={{ 'is-invalid': validationErrors().has(ValidationError.Name) }}
                                id="modelName"
                                name="name"
                                placeholder={localeCtx.i18n.common.labels.name()}
                                value={name()}
                                onInput={(ev) => setName(ev.target.value)}
                            />
                            <Show when={validationErrors().has(ValidationError.Name)}>
                                <small class="invalid-feedback">{i18n.validationErrors.name()}.</small>
                            </Show>
                        </div>

                        <div class="mb-4">
                            <label for="modelKey" class="form-label">{localeCtx.i18n.common.labels.key()}</label>
                            <input
                                type="text"
                                class="form-control"
                                classList={{ 'is-invalid': validationErrors().has(ValidationError.Key) }}
                                id="modelKey"
                                name="key"
                                placeholder={localeCtx.i18n.common.labels.key()}
                                value={key()}
                                onInput={(ev) => setKey(ev.target.value)}
                            />
                            <Show when={validationErrors().has(ValidationError.Key)}>
                                <small class="invalid-feedback">{i18n.validationErrors.key()}.</small>
                            </Show>
                        </div>

                        <div class="mb-4">
                            <label for="modelDesc" class="form-label">{localeCtx.i18n.common.labels.description()} <small class="text-secondary">({localeCtx.i18n.common.labels.optional()})</small></label>
                            <textarea
                                id="modelDesc"
                                class="form-control"
                                placeholder={localeCtx.i18n.common.labels.description()}
                                rows="3"
                                value={desc()}
                                onChange={(ev) => setDesc(ev.target.value)}
                            ></textarea>
                        </div>

                        <label class="form-label">{localeCtx.i18n.common.labels.namespace()}</label>
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
                                <label class="form-check-label" for="modelScopeGlobal">{localeCtx.i18n.common.labels.global()}</label>
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
                                <label class="form-check-label" for="modelScopeTheme">{i18n.labels.activeTheme()} ({commonCtx.options().theme})</label>
                            </div>
                        </div>
                    </div>

                    <hr />

                    <div class="mb-4">
                        <div class="d-flex align-items-center">
                            <h5 class="flex-grow-1 m-0">{i18n.labels.fields()}</h5>
                            <button
                                type="button"
                                class="btn btn-secondary icon-link justify-content-center"
                                classList={{ 'btn-warning': validationErrors().has(ValidationError.Field) }}
                                onClick={() => setShowModal(true)}
                            >
                                <PlusSquareDotted viewBox="0 0 16 16" />
                                {i18n.actions.addField()}
                            </button>
                        </div>
                        <Show when={validationErrors().has(ValidationError.Field)}>
                            <small class="text-danger-emphasis mt-2">{i18n.validationErrors.field()}.</small>
                        </Show>
                    </div>

                    <For each={fields}>
                        {(mf, idx) => {
                            const fieldName = () => {
                                const field = cmsContext.fields().find((f) => f.id === mf.fieldId)
                                if (!field) {
                                    return '-';
                                }

                                return field.key in i18n.fields ? i18n.fields[field.key as keyof typeof i18n.fields]() : field.name;
                            };

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
                                        <li class="list-group-item">{fieldName()}</li>

                                        {(() => {
                                            const features = [];
                                            if (mf.localized) {
                                                features.push(i18n.fieldFeatures.localized());
                                            }

                                            if (mf.required) {
                                                features.push(i18n.fieldFeatures.required());
                                            }

                                            if (mf.multiple) {
                                                features.push(i18n.fieldFeatures.multiple());
                                            }

                                            const text = features.join(' - ');

                                            return text.length === 0 ? (<></>) : (<li class="list-group-item">{features.join(' - ')}</li>);
                                        })()}
                                    </ul>
                                    <Show when={serverValidationErrors()?.fieldMessages.get('modelFields')?.[idx()]}>
                                        {(errors) => (
                                            <div class="card-footer text-body-secondary">
                                                <For each={Object.values(errors())}>
                                                    {(error) => <small class="text-danger-emphasis">{error}</small>}
                                                </For>
                                            </div>
                                        )}
                                    </Show>
                                </div>
                            );
                        }}
                    </For>

                    <Show when={serverError()}>
                        <div class="mb-2">
                            <small class="text-danger-emphasis">{serverError()}</small>
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
                            {localeCtx.i18n.common.actions.create()}
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
    const cmsContext = useContext(CMSContext)!;
    const localeCtx = useContext(LocaleContext)!;

    const i18n = localeCtx.i18n.model;

    return (
        <div class="container py-4 px-md-4">
            <div class="d-flex align-items-center mb-5">
                <h1 class="flex-grow-1 m-0">{localeCtx.i18n.nav.links.models()}</h1>
                <A class="btn btn-outline-primary icon-link" href="/models/create">
                    <PlusLg viewBox="0 0 16 16" />
                    {i18n.actions.createModel()}
                </A>
            </div>

            <Show when={cmsContext.models().length > 0} fallback={
                <p class="text-secondary text-center">{i18n.noModel()}.</p>
            }>
                <div class="row">
                    <div class="offset-md-3 col-md-6">
                        <table class="table table-hover border shadow-sm">
                            <thead>
                                <tr>
                                    <th></th>
                                    <th scope="col">#</th>
                                    <th scope="col">{localeCtx.i18n.common.labels.namespace()}</th>
                                    <th scope="col">{localeCtx.i18n.common.labels.name()}</th>
                                    <th scope="col">{localeCtx.i18n.common.labels.createdAt()}</th>
                                </tr>
                            </thead>
                            <tbody>
                                <For each={cmsContext.models()}>
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
                                            <td>{localeCtx.dateFormat().format(model.createdAt)}</td>
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
    const cmsContext = useContext(CMSContext)!;
    const localeCtx = useContext(LocaleContext)!;
    const params = useParams();
    const navigate = useNavigate();

    const i18n = localeCtx.i18n.model;

    const model = createMemo(() => cmsContext.models().find(ModelModel.searchWithParams(params.namespace, params.key)));

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

        return cmsContext.deleteModel(m.id)
            .then(() => cmsContext.loadModels())
            .then(() => {
                setDeletingModel(false);

                alertCtx.success(i18n.actions.modelDeleted(m.name));

                navigate('/models', { replace: true });
            });
    }

    const saveDetails = () => {
        const m = model();

        if (inProgress() !== undefined || !m) {
            return;
        }

        const errors = new Set<ValidationError>();
        const req = {
            name: modelDetails.name.trim(),
            desc: modelDetails.desc.trim() || null,
        };

        if (req.name.length === 0) {
            errors.add(ValidationError.Name);
        }

        setValidationErrors(errors);

        if (errors.size > 0) {
            return;
        }

        setInProgress(Action.UpdateDetails);

        cmsContext.updateModelDetails(
            m.id,
            req,
        )
            .then(() => cmsContext.loadModels())
            .then(() => {
                setEditingDetails(false);

                alertCtx.success(i18n.actions.modelUpdated(modelDetails.name));
            })
            .catch((e) => alertCtx.fail(translateError(e.message)))
            .finally(() => setInProgress(undefined));
    }

    const saveField = async (id: number, updatedField: CreateModelField) => {
        return cmsContext.updateModelField(id, {
            name: updatedField.name,
            desc: updatedField.desc,
            localized: updatedField.localized,
            required: updatedField.required,
            multiple: updatedField.multiple,
        })
            .then(() => cmsContext.loadModels())
            .then(() => {
                setEditingField(undefined);

                alertCtx.success(i18n.actions.fieldUpdated(updatedField.name));
            });
    };

    const createField = async (newField: CreateModelField) => {
        const m = model();

        if (!m) {
            return;
        }

        return cmsContext.createModelField(m.id, newField)
            .then(() => cmsContext.loadModels())
            .then(() => {
                setCreatingField(false);

                alertCtx.success(i18n.actions.fieldCreated(newField.name));
            });
    };

    const deleteField = async (modelField: ModelField) => {
        return cmsContext.deleteModelField(modelField.id)
            .then(() => cmsContext.loadModels())
            .then(() => {
                setDeletingField(undefined);

                alertCtx.success(i18n.actions.fieldDeleted(modelField.name));
            });
    };

    const translateError = (e: string) => {
        return (e in i18n.serverErrors)
            ? i18n.serverErrors[e as keyof typeof i18n.serverErrors]()
            : e;
    };

    return (
        <div class="container py-4 px-md-4">
            <Show when={model()} fallback={
                <p class="text-secondary text-center">{i18n.modelNotFound(params.key)}.</p>
            }>
                {(model) => (
                    <>
                        <div class="d-flex align-items-center mb-5">
                            <div class="flex-grow-1">
                                <h2 class="m-0">{model().name}</h2>
                                <small>{i18n.model()}</small>
                            </div>
                            <div class="dropdown mx-2">
                                <button class="btn icon-link px-1" on:click={(ev) => { ev.stopPropagation(); setDropdown(!dropdown()); }}>
                                    <ThreeDotsVertical viewBox="0 0 16 16" />
                                </button>
                                <ul id="model-detail-dropdown" class="dropdown-menu mt-1 shadow" style="right: 0;" classList={{ 'show': dropdown() }}>
                                    <li>
                                        <button class="dropdown-item text-danger icon-link py-2" onClick={() => setDeletingModel(true)}>
                                            <Trash viewBox="0 0 16 16" />
                                            {localeCtx.i18n.common.actions.delete()}
                                        </button>
                                    </li>
                                </ul>
                            </div>
                        </div>

                        <div class="row g-4">
                            <div class="offset-md-1 col-md-4">
                                <div class="border rounded p-3">
                                    <div class="d-flex justify-content-center">
                                        <h5 class="flex-grow-1 m-0">{localeCtx.i18n.common.labels.details()}</h5>
                                        <Show when={editingDetails()} fallback={
                                            <button type="button" class="btn icon-link py-0 px-1" onClick={() => setEditingDetails(true)}>
                                                <PencilSquare viewBox="0 0 16 16" />
                                                {localeCtx.i18n.common.actions.edit()}
                                            </button>
                                        }>
                                            <button
                                                type="button"
                                                class="btn text-danger icon-link py-0 px-1"
                                                onClick={() => setEditingDetails(false)}
                                            >
                                                {localeCtx.i18n.common.actions.discard()}
                                            </button>
                                            <button
                                                type="button"
                                                class="btn icon-link py-0 px-1 ms-2"
                                                onClick={saveDetails}
                                                disabled={inProgress() === Action.UpdateDetails}
                                            >
                                                <ProgressSpinner show={inProgress() === Action.UpdateDetails} small={true} />
                                                <FloppyFill viewBox="0 0 16 16" />
                                                {localeCtx.i18n.common.actions.save()}
                                            </button>
                                        </Show>
                                    </div>

                                    <hr />

                                    <table class="table table-borderless w-100 m-0" style="table-layout: fixed">
                                        <tbody>
                                            <tr>
                                                <td style="width: 35%">{localeCtx.i18n.common.labels.name()}</td>
                                                <td class="text-end" classList={{ 'py-1': editingDetails() }}>
                                                    <Show when={editingDetails()} fallback={model().name}>
                                                        <input
                                                            id="modelName"
                                                            type="text"
                                                            class="form-control float-end"
                                                            classList={{ 'is-invalid': validationErrors().has(ValidationError.Name) }}
                                                            name="name"
                                                            value={modelDetails.name}
                                                            onInput={(ev) => setModelDetails('name', ev.target.value)}
                                                        />
                                                    </Show>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td>{localeCtx.i18n.common.labels.key()}</td>
                                                <td class="text-end" classList={{ 'py-1': editingDetails() }}>
                                                    <Show when={editingDetails()} fallback={model().key}>
                                                        <input
                                                            id="modelKey"
                                                            type="text"
                                                            class="form-control float-end"
                                                            name="key"
                                                            value={model().key}
                                                            disabled
                                                        />
                                                    </Show>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td>{localeCtx.i18n.common.labels.namespace()}</td>
                                                <td class="text-end" classList={{ 'py-1': editingDetails() }}>
                                                    <Show when={editingDetails()} fallback={model().namespace ?? '-'}>
                                                        <input
                                                            id="modelNamespace"
                                                            type="text"
                                                            class="form-control float-end"
                                                            name="namespace"
                                                            value={model().namespace ?? '-'}
                                                            disabled
                                                        />
                                                    </Show>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td>{localeCtx.i18n.common.labels.description()}</td>
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
                                        <h5 class="flex-grow-1 m-0">{i18n.labels.fields()}</h5>
                                        <button type="button" class="btn icon-link py-0 px-1" onClick={() => setCreatingField(true)}>
                                            <PlusSquareDotted viewBox="0 0 16 16" />
                                            {i18n.actions.addField()}
                                        </button>
                                    </div>

                                    <hr />

                                    <For each={model().fields}>
                                        {(mf) => {
                                            const fieldName = () => {
                                                const field = cmsContext.fields().find((f) => f.id === mf.fieldId)
                                                if (!field) {
                                                    return '-';
                                                }

                                                return field.key in i18n.fields ? i18n.fields[field.key as keyof typeof i18n.fields]() : field.name;
                                            };


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
                                                        <li class="list-group-item">{fieldName()}</li>

                                                        {(() => {
                                                            const features = [];
                                                            if (mf.localized) {
                                                                features.push(i18n.fieldFeatures.localized());
                                                            }

                                                            if (mf.required) {
                                                                features.push(i18n.fieldFeatures.required());
                                                            }

                                                            if (mf.multiple) {
                                                                features.push(i18n.fieldFeatures.multiple());
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
                        restrictEdit={true}
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
                    message={<p>{i18n.actions.confirmDeleteModel(model()?.name ?? '')}?</p>}
                    close={() => setDeletingModel(false)}
                    confirm={deleteModel}
                />
            </Show>
            <Show when={deletingField()}>
                {(field) => (
                    <DeleteConfirmModal
                        message={<p>{i18n.actions.confirmDeleteField(field().name)}?</p>}
                        close={() => setDeletingField(undefined)}
                        confirm={() => deleteField(field())}
                    />
                )}
            </Show>
        </div>
    );
};
