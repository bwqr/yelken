import { createEffect, createMemo, createResource, createSignal, For, Match, onCleanup, Show, Switch, useContext } from "solid-js";
import { CMSContext } from "../lib/cms/context";
import { A, useNavigate, useParams, useSearchParams } from "@solidjs/router";
import { FileEarmarkFill, FloppyFill, PencilSquare, ThreeDotsVertical, Trash, Upload } from "../Icons";
import { AlertContext } from "../lib/alert";
import { Api, HttpError } from "../lib/api";
import { dropdownClickListener } from "../lib/utils";
import config from '../lib/config';
import { type Asset as AssetModel } from '../lib/cms/models';
import { PaginationRequest } from "../lib/models";
import { Pagination } from "../components/Pagination";
import { createStore } from "solid-js/store";
import ProgressSpinner from "../components/ProgressSpinner";
import './Asset.scss';
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import { LocaleContext } from "../lib/i18n";

export const PickAsset = (props: { close: () => void, pick: (asset: AssetModel) => void, }) => {
    const cmsContext = useContext(CMSContext)!;
    const localeCtx = useContext(LocaleContext)!;
    const [pagination, setPagination] = createStore<PaginationRequest>({});

    const i18n = localeCtx.i18n.asset;

    const [assets] = createResource(() => ({ page: pagination.page, perPage: pagination.perPage }), (pagination) => cmsContext.fetchAssets(pagination));

    return (
        <>
            <div class="modal show d-block" tabindex="-1" aria-labelledby="createModelFieldModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered modal-xl">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h1 class="modal-title fs-5" id="createModelFieldModalLabel">{i18n.actions.pickAsset()}</h1>
                        </div>
                        <div class="modal-body">
                            <Switch>
                                <Match when={assets.loading}>
                                    <p class="icon-link justify-content-center w-100"><ProgressSpinner show={true} /> {localeCtx.i18n.common.loading()} ...</p>
                                </Match>
                                <Match when={assets.error}>
                                    <p class="text-danger-emphasis text-center">{localeCtx.i18n.common.loadingItemError(localeCtx.i18n.nav.links.assets())}: <strong>{assets.error.message}</strong></p>
                                </Match>
                                <Match when={assets() && assets()!.currentPage === 1 && assets()!.items.length === 0}>
                                    <p class="text-secondary text-center">{i18n.noAsset()}.</p>
                                </Match>
                                <Match when={assets()}>
                                    {(assets) => (
                                        <>
                                            <Show when={assets().items.length > 0} fallback={
                                                <p class="text-secondary text-center mb-4">{i18n.noAssetForPage(pagination.page)}.</p>
                                            }>
                                                <ul class="mb-5 list-unstyled d-flex flex-wrap asset-masonry">
                                                    <For each={assets().items}>
                                                        {(asset) => (
                                                            <li class="p-1 flex-grow-1 d-flex justify-content-center">
                                                                <A href="" class="position-relative h-100 d-flex rounded overflow-hidden" on:click={(ev) => { ev.preventDefault(); props.pick(asset); }}>
                                                                    <Show when={asset.filetype?.startsWith('image')} fallback={
                                                                        <FileEarmarkFill class="w-100 h-100 text-secondary-emphasis" viewBox="0 0 16 16" />
                                                                    }>
                                                                        <img
                                                                            src={config.resolveSiteURL(`/assets/content/${asset.filename}`)}
                                                                            alt={asset.name}
                                                                        />
                                                                    </Show>
                                                                    <small class="text-body bg-secondary-subtle position-absolute text-center w-100 start-0 bottom-0 py-1">{asset.name}</small>
                                                                </A>
                                                            </li>
                                                        )}
                                                    </For>
                                                    <li style="flex-grow: 10"></li>
                                                </ul>
                                            </Show>

                                            <Pagination
                                                totalPages={assets().totalPages}
                                                page={assets().currentPage}
                                                perPage={pagination.perPage}
                                                pageChange={(page) => setPagination('page', page)}
                                            />
                                        </>
                                    )}
                                </Match>
                            </Switch>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-outline-danger" onClick={props.close}>Cancel</button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="modal-backdrop show"></div>
        </>
    );
}

export const UploadAsset = () => {
    interface AssetDetail {
        type: string,
        size: number,
    }

    enum Action {
        Analyze,
        Upload,
    }

    enum ValidationError {
        Asset,
    }

    let imageEl: HTMLImageElement | undefined;

    const alertCtx = useContext(AlertContext)!;
    const localeCtx = useContext(LocaleContext)!;
    const navigate = useNavigate();

    const i18n = localeCtx.i18n.asset;

    const [detail, setDetail] = createSignal(undefined as AssetDetail | undefined);
    const [asset, setAsset] = createSignal(undefined as File | undefined);

    const [inProgress, setInProgress] = createSignal(undefined as Action | undefined);

    const [validationErrors, setValidationErrors] = createSignal(new Set<ValidationError>());
    const [analysisError, setAnalysisError] = createSignal(undefined as string | undefined);
    const [serverError, setServerError] = createSignal(undefined as string | undefined);

    const analyzeAsset = async (asset: File): Promise<AssetDetail> => {
        if (imageEl) {
            imageEl.setAttribute('src', '');
        }

        if (asset.type.startsWith('image')) {
            await new Promise<void>((res) => {
                const reader = new FileReader();

                reader.onload = function(e) {
                    if (imageEl) {
                        imageEl.setAttribute('src', e.target!.result as string);
                    }

                    res();
                };

                reader.readAsDataURL(asset);
            });
        }

        return { type: asset.type || '-', size: asset.size };
    };

    const assetChanged = (ev: Event & { target: HTMLInputElement }) => {
        const file = ev.target.files?.item(0);

        setAsset(undefined);
        setDetail(undefined);
        setAnalysisError(undefined);

        if (!file) {
            return;
        }

        setAsset(file);
        setInProgress(Action.Analyze);

        analyzeAsset(file)
            .then((detail) => setDetail(detail))
            .catch((e) => setAnalysisError(e.message))
            .finally(() => setInProgress(undefined));
    }

    const onSubmit = (ev: SubmitEvent) => {
        ev.preventDefault();

        if (inProgress() !== undefined) {
            return;
        }

        setServerError(undefined);

        const errors = new Set<ValidationError>();

        if (asset() === undefined) {
            errors.add(ValidationError.Asset);
        }

        setValidationErrors(errors);

        if (errors.size > 0) {
            return;
        }

        setInProgress(Action.Upload);

        const formdata = new FormData();
        formdata.append('asset', asset()!);

        Api.request<unknown, AssetModel>('/cms/asset/create', 'POST', { formdata })
            .then((asset) => {
                alertCtx.success(i18n.actions.assetUploaded(asset.name));

                navigate(`/assets/view/${asset.id}`, { replace: true });
            })
            .catch((e) => {
                const msg = e.message in i18n.serverErrors ? i18n.serverErrors[e.message as keyof typeof i18n.serverErrors] : e.message;

                if (e instanceof HttpError) {
                    setServerError(msg);
                } else {
                    alertCtx.fail(msg);
                }
            })
            .finally(() => setInProgress(undefined));
    }

    return (
        <div class="container py-4 px-md-4">
            <h2 class="mb-5">{i18n.actions.uploadAsset()}</h2>

            <div class="row">
                <form class="offset-md-4 col-md-4" onSubmit={onSubmit}>
                    <div class="border rounded p-3">
                        <div class="mb-4">
                            <label for="assetFile" class="form-label">{i18n.actions.chooseAsset()}</label>
                            <input
                                id="assetFile"
                                type="file"
                                class="form-control"
                                classList={{ 'is-invalid': validationErrors().has(ValidationError.Asset) }}
                                disabled={inProgress() !== undefined}
                                onChange={assetChanged}
                            />
                            <Show when={validationErrors().has(ValidationError.Asset)}>
                                <small class="invalid-feedback">{i18n.validationErrors.asset()}.</small>
                            </Show>
                        </div>

                        <Show when={inProgress() === Action.Analyze}>
                            <div class="d-flex justify-content-center mb-4">
                                <ProgressSpinner show={true} />
                                <span class="ms-2">{i18n.analyzingAsset()}.</span>
                            </div>
                        </Show>
                        <Show when={analysisError()}>
                            {(error) => (<small class="text-danger mb-4">{i18n.analysisError()}: {error()}</small>)}
                        </Show>
                        <Show when={detail()}>
                            {(detail) => (
                                <table class="table mb-4 w-100 caption-top" style="table-layout: fixed;">
                                    <caption class="p-0">{i18n.assetDetails()}</caption>
                                    <tbody>
                                        <tr>
                                            <td style="width: 25%">{i18n.labels.type()}</td>
                                            <td>{detail().type}</td>
                                        </tr>
                                        <tr>
                                            <td>{i18n.labels.size()}</td>
                                            <td>{Math.ceil(detail().size / 1024)} KB</td>
                                        </tr>
                                    </tbody>
                                </table>
                            )}
                        </Show>

                        <div classList={{ 'mb-4': detail() !== undefined }}>
                            <img ref={imageEl} class="d-block m-auto" style="max-width: 100%; max-height: 200px" />

                            <Show when={detail()?.type.startsWith('image') === false}>
                                <FileEarmarkFill class="w-100 text-secondary-emphasis" style="max-width: 100%; height: 200px" viewBox="0 0 16 16" />
                            </Show>
                        </div>

                        <Show when={serverError()}>
                            <div class="mb-2">
                                <small class="text-danger">{serverError()}</small>
                            </div>
                        </Show>

                        <div class="d-flex justify-content-center">
                            <button type="submit" class="btn btn-primary icon-link justify-content-center mw-100" style="width: 10rem;" disabled={inProgress() !== undefined}>
                                <ProgressSpinner show={inProgress() === Action.Upload} />
                                <Upload viewBox="0 0 16 16" />
                                {i18n.actions.upload()}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export const Assets = () => {
    const cmsContext = useContext(CMSContext)!;
    const localeCtx = useContext(LocaleContext)!;
    const [searchParams, setSearchParams] = useSearchParams();

    const i18n = localeCtx.i18n.asset;

    const pagination = createMemo(() => PaginationRequest.fromParams(searchParams.page, searchParams.perPage));

    const [assets] = createResource(pagination, (pagination) => cmsContext.fetchAssets(pagination));

    return (
        <div class="container py-4 px-md-4">
            <div class="d-flex align-items-center mb-5">
                <h1 class="flex-grow-1 m-0">{localeCtx.i18n.nav.links.assets()}</h1>
                <A class="btn btn-outline-primary icon-link" href="/assets/upload">
                    <Upload viewBox="0 0 16 16" />
                    {i18n.actions.uploadAsset()}
                </A>
            </div>
            <Switch>
                <Match when={assets.loading}>
                    <p class="icon-link justify-content-center w-100"><ProgressSpinner show={true} /> {localeCtx.i18n.common.loading()} ...</p>
                </Match>
                <Match when={assets.error}>
                    <p class="text-danger-emphasis text-center">{localeCtx.i18n.common.loadingItemError(localeCtx.i18n.nav.links.assets())}: <strong>{assets.error.message}</strong></p>
                </Match>
                <Match when={assets() && assets()!.currentPage === 1 && assets()!.items.length === 0}>
                    <p class="text-secondary text-center">{i18n.noAsset()}. {i18n.canUploadAsset()}.</p>
                </Match>
                <Match when={assets()}>
                    {(assets) => (
                        <>
                            <Show when={assets().items.length > 0} fallback={
                                <p class="text-secondary text-center mb-4">{i18n.noAssetForPage(searchParams.page as string)}.</p>
                            }>
                                <ul class="mb-5 list-unstyled d-flex flex-wrap asset-masonry">
                                    <For each={assets().items}>
                                        {(asset) => (
                                            <li class="p-1 flex-grow-1 d-flex justify-content-center">
                                                <A href={`/assets/view/${asset.id}`} class="position-relative h-100 d-flex rounded overflow-hidden">
                                                    <Show when={asset.filetype?.startsWith('image')} fallback={
                                                        <FileEarmarkFill class="w-100 h-100 text-secondary-emphasis" viewBox="0 0 16 16" />
                                                    }>
                                                        <img
                                                            src={config.resolveSiteURL(`/assets/content/${asset.filename}`)}
                                                            alt={asset.name}
                                                        />
                                                    </Show>
                                                    <small class="text-body bg-secondary-subtle position-absolute text-center w-100 start-0 bottom-0 py-1">{asset.name}</small>
                                                </A>
                                            </li>
                                        )}
                                    </For>
                                    <li style="flex-grow: 10"></li>
                                </ul>
                            </Show>

                            <Pagination
                                totalPages={assets().totalPages}
                                page={assets().currentPage}
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

export const Asset = () => {
    enum Action {
        UpdateDetails,
        Delete,
    }

    enum ValidationError {
        Name,
    }

    const alertCtx = useContext(AlertContext)!;
    const cmsContext = useContext(CMSContext)!;
    const localeCtx = useContext(LocaleContext)!;
    const navigate = useNavigate();

    const params = useParams();

    const i18n = localeCtx.i18n.asset;

    const [asset, { mutate }] = createResource(() => parseInt(params.id), (id) => cmsContext.fetchAsset(id));

    const [assetDetails, setAssetDetails] = createStore({ name: '' });
    const [editingDetails, setEditingDetails] = createSignal(false);

    createEffect(() => setAssetDetails({ name: asset()?.name ?? '' }));

    const [deletingAsset, setDeletingAsset] = createSignal(false);

    const [inProgress, setInProgress] = createSignal(undefined as Action | undefined);

    const [validationErrors, setValidationErrors] = createSignal(new Set<ValidationError>());

    const [dropdown, setDropdown] = createSignal(false);
    onCleanup(dropdownClickListener('asset-detail-dropdown', () => setDropdown(false), () => !deletingAsset()));

    const saveDetails = () => {
        const a = asset();

        if (inProgress() !== undefined || !a) {
            return;
        }

        const errors = new Set<ValidationError>();
        const req = { name: assetDetails.name.trim() };

        if (req.name.length === 0) {
            errors.add(ValidationError.Name);
        }

        setValidationErrors(errors);

        if (errors.size > 0) {
            return;
        }

        setInProgress(Action.UpdateDetails);

        cmsContext.updateAsset(
            a.id,
            req.name,
        )
            .then(() => {
                setEditingDetails(false);

                alertCtx.success(i18n.actions.assetUpdated(req.name));

                mutate({ ...a, name: assetDetails.name.trim() });
            })
            .catch((e) => alertCtx.fail(translateError(e.message)))
            .finally(() => setInProgress(undefined));
    };

    const deleteAsset = () => {
        const a = asset();

        if (!a) {
            return;
        }

        return cmsContext.deleteAsset(a.id)
            .then(() => {
                setDeletingAsset(false);

                alertCtx.success(i18n.actions.assetDeleted(a.name));

                navigate('/assets', { replace: true });
            });
    }

    const translateError = (e: string) => {
        return (e in i18n.serverErrors)
            ? i18n.serverErrors[e as keyof typeof i18n.serverErrors]()
            : e;
    };

    return (
        <div class="container py-4 px-md-4">
            <Switch>
                <Match when={asset.loading}>
                    <p class="icon-link justify-content-center w-100"><ProgressSpinner show={true} /> {localeCtx.i18n.common.loading()} ...</p>
                </Match>
                <Match when={asset.error}>
                    <p class="text-danger-emphasis text-center">{localeCtx.i18n.common.loadingItemError(localeCtx.i18n.nav.links.assets())}: <strong>{asset.error.message}</strong></p>
                </Match>
                <Match when={asset.state === 'ready' && asset() === undefined}>
                    <p class="text-secondary text-center">{i18n.assetNotFound(params.id)}.</p>
                </Match>
                <Match when={asset()}>
                    {(asset) => (
                        <>
                            <div class="d-flex align-items-center mb-5">
                                <div class="flex-grow-1">
                                    <h2 class="m-0">{asset().name}</h2>
                                    <small>{i18n.asset()}</small>
                                </div>
                                <div class="dropdown mx-2">
                                    <button class="btn icon-link px-1" on:click={(ev) => { ev.stopPropagation(); setDropdown(!dropdown()); }}>
                                        <ThreeDotsVertical viewBox="0 0 16 16" />
                                    </button>
                                    <ul id="asset-detail-dropdown" class="dropdown-menu mt-1 shadow" classList={{ 'show': dropdown() }} style="right: 0;">
                                        <li>
                                            <button class="dropdown-item text-danger icon-link py-2" onClick={() => setDeletingAsset(true)}>
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

                                        <table class="table table-borderless w-100 m-0" style="table-layout: fixed;">
                                            <tbody>
                                                <tr>
                                                    <td style="width: 35%">{localeCtx.i18n.common.labels.name()}</td>
                                                    <td class="text-end text-truncate" classList={{ 'py-1': editingDetails() }}>
                                                        <Show when={editingDetails()} fallback={asset().name}>
                                                            <input
                                                                id="assetName"
                                                                type="text"
                                                                class="form-control float-end"
                                                                classList={{ 'is-invalid': validationErrors().has(ValidationError.Name) }}
                                                                name="name"
                                                                value={assetDetails.name}
                                                                onInput={(ev) => setAssetDetails('name', ev.target.value)}
                                                            />
                                                        </Show>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td>{i18n.labels.type()}</td>
                                                    <td class="text-end text-truncate">
                                                        {asset().filetype}
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td>{i18n.labels.link()}</td>
                                                    <td class="text-end text-truncate">
                                                        <a target="_blank" href={config.resolveSiteURL(`/assets/content/${asset().filename}`)}>{asset().filename}</a>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                <div class="offset-md-1 col-md-5">
                                    <Show when={asset().filetype?.startsWith('image')} fallback={
                                        <FileEarmarkFill class="w-100 h-100 text-secondary-emphasis" viewBox="0 0 16 16" />
                                    }>
                                        <img src={config.resolveSiteURL(`/assets/content/${asset().filename}`)} class="d-block m-auto mw-100 rounded img-thumbnail" style="max-height: 80vh" alt={asset().name} />
                                    </Show>
                                </div>
                            </div>
                        </>
                    )}
                </Match>
            </Switch>

            <Show when={deletingAsset()}>
                <DeleteConfirmModal
                    message={<p>{i18n.actions.confirmDelete(asset()?.name ?? '')}?</p>}
                    close={() => setDeletingAsset(false)}
                    confirm={deleteAsset}
                    translateError={translateError}
                />
            </Show>
        </div >
    );
}
