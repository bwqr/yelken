import { A, Navigate, useNavigate, useParams, useSearchParams } from "@solidjs/router";
import { CMSContext } from "../lib/cms/context";
import { createEffect, createMemo, createResource, createSignal, For, type JSX, Match, onCleanup, Show, Switch, useContext } from "solid-js";
import { HttpError } from "../lib/api";
import { createStore, unwrap } from "solid-js/store";
import { ContentStage, FieldKind, Model, type ContentValue, type ModelField } from "../lib/cms/models";
import { Dynamic } from "solid-js/web";
import type { CreateContentValue } from "../lib/cms/requests";
import { CommonContext } from "../lib/context";
import { AlertContext } from "../lib/alert";
import { Bookmark, CheckCircleFill, FloppyFill, Images, PencilSquare, PlusLg, PlusSquareDotted, FileEarmarkFill, ThreeDotsVertical, Trash, XLg } from "../Icons";
import { PickAsset } from "./Asset";
import { PaginationRequest } from "../lib/models";
import { Pagination } from "../components/Pagination";
import { dropdownClickListener } from "../lib/utils";
import ProgressSpinner from "../components/ProgressSpinner";
import config from '../lib/config';
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import ProfileIcon from "../components/ProfileIcon";
import { LocaleContext } from "../lib/i18n";

function imageFile(filename: string): boolean {
    return ['.bmp', '.png', '.ico', '.tif', '.tiff', '.jpeg', '.jpg', '.webp', '.svg', '.gif'].findIndex((ext) => filename.endsWith(ext)) > -1;
}

const ContentValueModal = (props: {
    close: () => void;
    create: (field: CreateContentValue) => Promise<void> | void;
    modelField: ModelField,
    initial?: CreateContentValue
    translateError?: (e: string) => string,
}) => {
    enum ValidationError {
        Value,
        Locale,
    }

    const alertCtx = useContext(AlertContext)!;
    const commonCtx = useContext(CommonContext)!;
    const cmsCtx = useContext(CMSContext)!;
    const localeCtx = useContext(LocaleContext)!;

    const i18n = localeCtx.i18n.content;

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
                    const msg = props.translateError ? props.translateError(e.message) : e.message;

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
            <div class="modal show d-block" tabindex="-1" aria-labelledby="createModelFieldModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <form class="modal-content" onSubmit={createValue}>
                        <div class="modal-header">
                            <h1 class="modal-title fs-5" id="createModelFieldModalLabel">{props.initial ? i18n.actions.editValue() : i18n.actions.addValue()}</h1>
                        </div>
                        <div class="modal-body">
                            <Show when={field()} fallback={<p>{i18n.labels.unknownField()}</p>}>
                                {(field) => (
                                    <>
                                        <div class="mb-4">
                                            <label for="modelFieldName" class="form-label">{i18n.labels.fieldName()}</label>
                                            <input
                                                id="modelFieldName"
                                                name="modelFieldName"
                                                type="text"
                                                placeholder={i18n.labels.fieldName()}
                                                class="form-control"
                                                value={props.modelField.name}
                                                disabled
                                            />
                                        </div>
                                        <div>
                                            <label for="modelFieldValue" class="form-label">{i18n.labels.value()}</label>
                                            <Switch fallback={<p>{i18n.labels.unsupportedField()}</p>}>
                                                <Match when={field().kind === FieldKind.Asset}>
                                                    <Show when={store.value}>
                                                        <div class="mb-2" style="height: 6rem">
                                                            <Show when={imageFile(store.value)} fallback={
                                                                <FileEarmarkFill class="d-block m-auto w-auto h-100 text-secondary-emphasis" viewBox="0 0 16 16" />
                                                            }>
                                                                <img
                                                                    class="d-block m-auto w-auto"
                                                                    src={config.resolveSiteURL(`/assets/content/${store.value}`)}
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
                                                        <small class="invalid-feedback">{i18n.validationErrors.valueAsset(props.modelField.name)}.</small>
                                                    </Show>
                                                    <button
                                                        type="button"
                                                        class="btn btn-secondary icon-link mt-2"
                                                        classList={{ 'btn-warning': validationErrors().has(ValidationError.Value) }}
                                                        onClick={() => setShowPickAsset(true)}
                                                    >
                                                        <Images viewBox="0 0 16 16" />
                                                        {i18n.actions.pickAsset()}
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
                                                <small class="invalid-feedback">{i18n.validationErrors.value(props.modelField.name)}.</small>
                                            </Show>
                                        </div>

                                        <Show when={props.modelField.localized}>
                                            <div class="mt-4">
                                                <label for="modelFieldLocale" class="form-label">{localeCtx.i18n.common.labels.locale()}</label>
                                                <select
                                                    id="modelFieldLocale"
                                                    class="form-select"
                                                    classList={{ 'is-invalid': validationErrors().has(ValidationError.Locale) }}
                                                    name="modelFieldLocale"
                                                    value={store.locale}
                                                    onChange={(ev) => setStore('locale', ev.target.value)}
                                                >
                                                    <option value="" disabled selected>{i18n.actions.selectLocale()}</option>
                                                    <For each={commonCtx.activeLocales()}>
                                                        {(locale) => (
                                                            <option value={locale.key}>{locale.name}</option>
                                                        )}
                                                    </For>
                                                </select>
                                                <Show when={validationErrors().has(ValidationError.Locale)}>
                                                    <small class="invalid-feedback">{i18n.validationErrors.locale()}.</small>
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
};

export const ContentRoot = (props: { children?: JSX.Element }) => {
    const localeCtx = useContext(LocaleContext)!;
    const models = useContext(CMSContext)!.models();

    return (
        <div class="d-flex flex-grow-1">
            <nav id="second-nav" class="h-100" style="width: 13rem; border-right: 1px solid #d8d8d8">
                <p class="ps-3 mt-4 mb-2 text-uppercase"><b>{localeCtx.i18n.nav.links.models()}</b></p>
                <Show when={models.length > 0} fallback={
                    <p class="ps-3 mt-4 mb-2 text-secondary">{localeCtx.i18n.content.noModelFound()}</p>
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
};

export const Contents = () => {
    const cmsCtx = useContext(CMSContext)!;
    const localeCtx = useContext(LocaleContext)!;

    return (
        <div class="container py-4 px-md-4">
            <Show when={cmsCtx.models()[0]} fallback={
                <p class="text-secondary text-center">{localeCtx.i18n.content.noModel()}.</p>
            }>
                {(model) => (<Navigate href={`/contents/by-model/${model().urlPath()}`} />)}
            </Show>
        </div>
    );
};

export const ContentsByModel = () => {
    const cmsCtx = useContext(CMSContext)!;
    const localeCtx = useContext(LocaleContext)!;
    const [searchParams, setSearchParams] = useSearchParams();
    const params = useParams();

    const i18n = localeCtx.i18n.content;

    const pagination = createMemo(() => PaginationRequest.fromParams(searchParams.page, searchParams.perPage));

    const model = createMemo(() => cmsCtx.models().find(Model.searchWithParams(params.namespace, params.key)));

    const [contents] = createResource(
        () => model() ? { model: model()!, pagination: pagination() } : undefined,
        ({ model, pagination }) => cmsCtx.fetchContents(model.id, pagination)
    );

    return (
        <div class="container py-4 px-md-4">
            <div class="d-flex align-items-center mb-5">
                <h1 class="flex-grow-1 m-0">{localeCtx.i18n.nav.links.contents()}</h1>
                <Show when={model()}>
                    {(m) => (
                        <A class="btn btn-outline-primary icon-link" href={`/contents/create/${m().urlPath()}`}>
                            <PlusLg viewBox="0 0 16 16" />
                            {i18n.actions.createContent()}
                        </A>
                    )}
                </Show>
            </div>

            <Switch>
                <Match when={!model()}>
                    <p class="text-secondary text-center">{localeCtx.i18n.model.modelNotFound(params.key)}.</p>
                </Match>
                <Match when={contents.loading}>
                    <p class="icon-link justify-content-center w-100"><ProgressSpinner show={true} /> {localeCtx.i18n.common.loading()} ...</p>
                </Match>
                <Match when={contents.error}>
                    <p class="text-danger-emphasis text-center">{localeCtx.i18n.common.loadingItemError(localeCtx.i18n.nav.links.contents())}: <strong>{contents.error.message}</strong></p>
                </Match>
                <Match when={contents() && contents()!.currentPage === 1 && contents()!.items.length === 0}>
                    <p class="text-secondary text-center">{i18n.noContent(model()?.name ?? '')}.</p>
                </Match>
                <Match when={contents()}>
                    {(contents) => (
                        <div class="row">
                            <div class="offset-md-2 col-md-8">
                                <Show when={contents().items.length > 0} fallback={
                                    <p class="text-secondary text-center mb-4">{i18n.noContentForPage(searchParams.page as string)}.</p>
                                }>
                                    <table class="table table-hover mb-4 border shadow-sm">
                                        <thead>
                                            <tr>
                                                <th></th>
                                                <th scope="col">#</th>
                                                <th scope="col">{localeCtx.i18n.common.labels.name()}</th>
                                                <th scope="col">{i18n.labels.stage()}</th>
                                                <th scope="col">{localeCtx.i18n.common.labels.createdAt()}</th>
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
                                                        <td>{localeCtx.dateFormat().format(content.createdAt)}</td>
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
    const localeCtx = useContext(LocaleContext)!;
    const params = useParams();
    const navigate = useNavigate();

    const i18n = localeCtx.i18n.content;

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
        const req = {
            name: name().trim(),
            modelId: model()!.id,
            values: Object.values(unwrap(values)).flat(),
        };

        if (req.name.length === 0) {
            errors.add(ValidationError.Name);
        }

        setValidationErrors(errors);

        if (errors.size > 0) {
            return;
        }

        setInProgress(true);

        cmsCtx.createContent(req)
            .then((content) => {
                alertCtx.success(i18n.actions.contentCreated(content.name));

                navigate(`/contents/view/${content.id}`, { replace: true });
            })
            .catch((e) => {
                const msg = translateError(e.message);

                if (e instanceof HttpError) {
                    setServerError(msg);
                } else {
                    alertCtx.fail(msg);
                }
            })
            .finally(() => setInProgress(false));
    };

    const translateError = (e: string) => {
        return (e in i18n.serverErrors)
            ? i18n.serverErrors[e as keyof typeof i18n.serverErrors]()
            : e;
    };

    return (
        <div class="container py-4 px-md-4">
            <h2 class="mb-5">{i18n.actions.createContent()}</h2>

            <div class="row">
                <Show when={model()} fallback={
                    <p class="text-secondary text-center">{localeCtx.i18n.model.modelNotFound(params.key)}.</p>
                }>
                    {(model) => (
                        <form class="offset-md-3 col-md-6" onSubmit={onSubmit}>
                            <div class="border rounded p-3 mb-4">
                                <div class="mb-4">
                                    <label for="contentName" class="form-label">{localeCtx.i18n.common.labels.name()}</label>
                                    <input
                                        type="text"
                                        id="contentName"
                                        class="form-control"
                                        classList={{ 'is-invalid': validationErrors().has(ValidationError.Name) }}
                                        name="contentName"
                                        placeholder={localeCtx.i18n.common.labels.name()}
                                        value={name()}
                                        onInput={(ev) => setName(ev.target.value)}
                                    />
                                    <Show when={validationErrors().has(ValidationError.Name)}>
                                        <small class="invalid-feedback">{i18n.validationErrors.name()}.</small>
                                    </Show>
                                </div>

                                <div class="mb-4">
                                    <label for="modelName" class="form-label">{i18n.labels.model()}</label>
                                    <input
                                        type="text"
                                        id="modelName"
                                        class="form-control"
                                        name="modelName"
                                        placeholder={i18n.labels.model()}
                                        value={model().title()}
                                        disabled
                                    />
                                </div>
                            </div>

                            <hr />

                            <h5 class="mb-4">{i18n.labels.values()}</h5>

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
                                                            {i18n.actions.addValue()}
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
                                                                                        src={config.resolveSiteURL(`/assets/content/${value.value}`)}
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
                        translateError={translateError}
                    />
                )}
            </Show>
        </div >
    );
};

export const Content = () => {
    enum Action {
        UpdateDetails,
        UpdateStage,
    }

    enum ValidationError {
        Name,
    }

    enum Dropdown {
        Details,
        Stage,
    }

    const alertCtx = useContext(AlertContext)!;
    const commonCtx = useContext(CommonContext)!;
    const cmsCtx = useContext(CMSContext)!;
    const localeCtx = useContext(LocaleContext)!;
    const params = useParams();
    const navigate = useNavigate();

    const i18n = localeCtx.i18n.content;

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

    const [dropdown, setDropdown] = createSignal(undefined as Dropdown | undefined);
    onCleanup(dropdownClickListener('content-detail-dropdown', () => dropdown() === Dropdown.Details && setDropdown(undefined), () => !deletingContent()));
    onCleanup(dropdownClickListener('stage-detail-dropdown', () => dropdown() === Dropdown.Stage && setDropdown(undefined), () => inProgress() === undefined));

    const updateStage = () => {
        const c = content();

        if (inProgress() !== undefined || c === undefined) {
            return;
        }

        const stage = c.content.stage === ContentStage.Published ? ContentStage.Draft : ContentStage.Published;
        setInProgress(Action.UpdateStage);

        cmsCtx.updateContentStage(c.content.id, stage)
            .then(() => {
                setDropdown(undefined);

                alertCtx.success(stage === ContentStage.Published ? i18n.actions.published(c.content.name) : i18n.actions.markedDraft(c.content.name));

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
        const req = { name: contentDetails.name.trim() };

        if (req.name.length === 0) {
            errors.add(ValidationError.Name);
        }

        setValidationErrors(errors);

        if (errors.size > 0) {
            return;
        }

        setInProgress(Action.UpdateDetails);

        cmsCtx.updateContentDetails(
            c.content.id,
            req.name,
        )
            .then(() => {
                setEditingDetails(false);

                alertCtx.success(i18n.actions.contentUpdated(req.name));

                mutate({ ...c, content: { ...c.content, name: req.name } })
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

                alertCtx.success(i18n.actions.valueCreated(modelField?.name ?? '-'));

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

                alertCtx.success(i18n.actions.valueUpdated(modelField?.name ?? '-'));

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

                alertCtx.success(i18n.actions.contentDeleted(c.content.name));

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

                alertCtx.success(i18n.actions.valueDeleted(modelField?.name ?? '-'));

                if (c) {
                    mutate({ ...c, values: c.values.filter((v) => v.id !== value.id) })
                }
            });
    }

    const contentStyle = () => content()?.content.stage === ContentStage.Published ?
        { color: 'success', icon: CheckCircleFill } :
        { color: 'secondary', icon: Bookmark };

    const translateError = (e: string) => {
        return (e in i18n.serverErrors)
            ? i18n.serverErrors[e as keyof typeof i18n.serverErrors]()
            : e;
    };

    return (
        <div class="container py-4 px-md-4">
            <Switch>
                <Match when={content.loading}>
                    <p class="icon-link justify-content-center w-100"><ProgressSpinner show={true} /> {localeCtx.i18n.common.loading()} ...</p>
                </Match>
                <Match when={content.error}>
                    <p class="text-danger-emphasis text-center">{localeCtx.i18n.common.loadingItemError(i18n.content())}: <strong>{content.error.message}</strong></p>
                </Match>
                <Match when={content.state === 'ready' && content() === undefined}>
                    <p class="text-secondary text-center">{i18n.contentNotFound(params.id)}.</p>
                </Match>
                <Match when={content()}>
                    {(content) => (
                        <>
                            <div class="d-flex align-items-center mb-5">
                                <div class="flex-grow-1">
                                    <h2 class="m-0">{content().content.name}</h2>
                                    <small>{i18n.content()}</small>
                                </div>
                                <div class="dropdown mx-2">
                                    <button class="btn icon-link px-1" on:click={(ev) => { ev.stopPropagation(); dropdown() === Dropdown.Details ? setDropdown(undefined) : setDropdown(Dropdown.Details); }}>
                                        <ThreeDotsVertical viewBox="0 0 16 16" />
                                    </button>
                                    <ul id="content-detail-dropdown" class="dropdown-menu mt-1 shadow" classList={{ 'show': dropdown() === Dropdown.Details }} style="right: 0;">
                                        <li>
                                            <button class="dropdown-item text-danger icon-link py-2" onClick={() => setDeletingContent(true)}>
                                                <Trash viewBox="0 0 16 16" />
                                                {localeCtx.i18n.common.actions.delete()}
                                            </button>
                                        </li>
                                    </ul>
                                </div>
                                <div class="dropdown">
                                    <div class="btn-group">
                                        <button type="button" class={`btn icon-link btn-outline-${contentStyle().color}`} disabled>
                                            <ProgressSpinner show={inProgress() === Action.UpdateStage} />
                                            <Dynamic component={contentStyle().icon} viewBox="0 0 17 17" />
                                            {i18n.stages[content()?.content.stage ?? ContentStage.Draft]()}
                                        </button>
                                        <button
                                            type="button"
                                            class={`btn btn-outline-${contentStyle().color} dropdown-toggle dropdown-toggle-split`}
                                            on:click={(ev) => { ev.stopPropagation(); dropdown() === Dropdown.Stage ? setDropdown(undefined) : setDropdown(Dropdown.Stage); }}
                                            aria-expanded={dropdown() === Dropdown.Stage}
                                        >
                                            <span class="visually-hidden">Toggle Dropdown</span>
                                        </button>
                                    </div>
                                    <ul id="stage-detail-dropdown" class="dropdown-menu mt-1 show shadow" classList={{ 'show': dropdown() === Dropdown.Stage }} style="right: 0;">
                                        <li>
                                            <button class="dropdown-item py-2" onClick={updateStage} disabled={inProgress() !== undefined}>
                                                <Switch>
                                                    <Match when={content()?.content.stage === ContentStage.Draft}>{i18n.actions.publish()}</Match>
                                                    <Match when={content()?.content.stage === ContentStage.Published}>{i18n.actions.markDraft()}</Match>
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
                                                    <td>{localeCtx.i18n.model.model()}</td>
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
                                                    <td>{localeCtx.i18n.content.labels.stage()}</td>
                                                    <td class="text-end py-1">
                                                        <p class="icon-link m-0">
                                                            <Dynamic component={contentStyle().icon} class={`text-${contentStyle().color}`} viewBox="0 0 17 17" />
                                                            {i18n.stages[content()?.content.stage ?? ContentStage.Draft]()}
                                                        </p>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td>{i18n.labels.createdBy()}</td>
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
                                        <h5>{i18n.labels.values()}</h5>

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
                                                                        {i18n.actions.addValue()}
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
                                                                                                src={config.resolveSiteURL(`/assets/content/${value.value}`)}
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
                    message={<p>{i18n.actions.confirmDelete(content()?.content.name ?? '')}?</p>}
                    close={() => setDeletingContent(false)}
                    confirm={deleteContent}
                    translateError={translateError}
                />
            </Show>

            <Show when={deletingValue()}>
                {(value) => {
                    const modelField = model()?.fields.find((mf) => mf.id === value().modelFieldId);

                    return (
                        <DeleteConfirmModal
                            message={<p>{i18n.actions.confirmDeleteValue(modelField?.name ?? '-')}?</p>}
                            close={() => setDeletingValue(undefined)}
                            confirm={() => deleteValue(value())}
                            translateError={translateError}
                        />
                    )
                }}
            </Show>
        </div>
    );
};
