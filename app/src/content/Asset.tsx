import { createMemo, createResource, createSignal, For, Match, onCleanup, Show, Suspense, Switch, useContext } from "solid-js";
import { ContentContext } from "../lib/content/context";
import { A, useNavigate, useParams, useSearchParams } from "@solidjs/router";
import { QuestionSquare, ThreeDotsVertical, Trash, Upload } from "../Icons";
import { AlertContext } from "../lib/context";
import { Api, HttpError } from "../lib/api";
import { dropdownClickListener } from "../lib/utils";
import * as config from '../lib/config';
import { type Asset as AssetModel } from '../lib/content/models';
import { PaginationRequest } from "../lib/models";
import { Pagination } from "../components/Pagination";
import { createStore } from "solid-js/store";

export const PickAsset = (props: { close: () => void, pick: (asset: string) => void, }) => {
    const contentCtx = useContext(ContentContext)!;
    const [pagination, setPagination] = createStore<PaginationRequest>({});

    const [assets] = createResource(() => ({ page: pagination.page, perPage: pagination.perPage }), (pagination) => contentCtx.fetchAssets(pagination));

    return (
        <>
            <div class="modal fade show d-block" tabindex="-1" aria-labelledby="createModelFieldModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-xl">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h1 class="modal-title fs-5" id="createModelFieldModalLabel">Pick an Asset</h1>
                        </div>
                        <div class="modal-body">
                            <Suspense fallback={<p>Loading...</p>}>
                                <Switch>
                                    <Match when={assets.error}>
                                        <span>Error: {assets.error}</span>
                                    </Match>
                                    <Match when={assets()}>
                                        {(assets) => (
                                            <>
                                                <div class="row m-0 gap-2 mb-4">
                                                    <For each={assets().items}>
                                                        {(asset) => (
                                                            <div class="col-md-2 col-sm-6 border-start border-end text-center d-flex flex-column" style="word-break: break-word; cursor: pointer;" onClick={() => props.pick(asset.filename)}>
                                                                <Show when={asset.filetype?.startsWith('image')} fallback={<QuestionSquare class="h-100 w-75 m-auto p-2 text-secondary" viewBox="0 0 16 16" />}>
                                                                    <img src={`${config.API_URL}/assets/content/${asset.filename}`} class="card-img p-2" alt={asset.name} />
                                                                </Show>
                                                                <p class="card-text text-center">{asset.name}</p>
                                                            </div>
                                                        )}
                                                    </For>
                                                </div>
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
                            </Suspense>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-outline-danger" onClick={props.close}>Cancel</button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="modal-backdrop fade show"></div>
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
    const navigate = useNavigate();

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

        Api.request<unknown, AssetModel>('/content/assets', 'POST', { formdata })
            .then((asset) => {
                alertCtx.success('Asset is created successfully');
                navigate(`/assets/view/${asset.id}`, { replace: true });
            })
            .catch((e) => {
                if (e instanceof HttpError) {
                    setServerError(e.message);
                } else {
                    alertCtx.fail(e.message);
                }
            })
            .finally(() => setInProgress(undefined));
    }

    return (
        <div class="container py-4 px-md-4">
            <div class="d-flex align-items-center mb-5">
                <h2>Upload Asset</h2>
            </div>
            <div class="row m-0">
                <form class="offset-md-4 col-md-4" onSubmit={onSubmit}>
                    <div class="mb-4">
                        <label for="assetFile" class="form-label">Choose an asset file</label>
                        <input
                            id="assetFile"
                            type="file"
                            class="form-control"
                            classList={{ 'is-invalid': validationErrors().has(ValidationError.Asset) }}
                            disabled={inProgress() !== undefined}
                            onChange={assetChanged}
                        />
                        <Show when={validationErrors().has(ValidationError.Asset)}>
                            <small class="invalid-feedback">Please choose an asset file.</small>
                        </Show>
                    </div>

                    <Show when={inProgress() === Action.Analyze}>
                        <div class="d-flex justify-contents-center mb-4">
                            <div class="spinner-border me-2" role="status">
                                <span class="visually-hidden">Loading...</span>
                            </div>
                            <span>Asset is being analyzed.</span>
                        </div>
                    </Show>
                    <Show when={analysisError()}>
                        {(error) => (<small class="text-danger mb-4">Analysis Error: {error()}</small>)}
                    </Show>
                    <Show when={detail()}>
                        {(detail) => (
                            <table class="table mb-4 w-100 caption-top">
                                <caption>Asset Details</caption>
                                <tbody>
                                    <tr>
                                        <td>Type</td>
                                        <td>{detail().type}</td>
                                    </tr>
                                    <tr>
                                        <td>Size</td>
                                        <td>{Math.ceil(detail().size / 1024)} KB</td>
                                    </tr>
                                </tbody>
                            </table>
                        )}
                    </Show>

                    <div class="mb-4">
                        <img ref={imageEl} class="d-block m-auto" style="max-width: 100%; max-height: 200px" />
                    </div>

                    <Show when={serverError()}>
                        <small class="text-danger mb-4">{serverError()}</small>
                    </Show>

                    <div class="d-flex justify-content-center">
                        <button type="submit" class="btn btn-primary icon-link justify-content-center mw-100" style="width: 250px;" disabled={inProgress() !== undefined}>
                            <Show when={inProgress() !== undefined}>
                                <div class="spinner-border" role="status">
                                    <span class="visually-hidden">Loading...</span>
                                </div>
                            </Show>
                            <Upload viewBox="0 0 16 16" />
                            Upload
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export const Assets = () => {
    const contentCtx = useContext(ContentContext)!;
    const [searchParams, setSearchParams] = useSearchParams();

    const pagination = createMemo(() => PaginationRequest.fromParams(searchParams.page, searchParams.perPage));

    const [assets] = createResource(pagination, (pagination) => contentCtx.fetchAssets(pagination));

    return (
        <div class="container py-4 px-md-4">
            <div class="d-flex align-items-center mb-5">
                <div class="flex-grow-1">
                    <h1>Assets</h1>
                </div>
                <A class="btn btn-outline-primary icon-link" href="/assets/upload">
                    <Upload viewBox="0 0 16 16" />
                    Upload Asset
                </A>
            </div>
            <Suspense>
                <Switch>
                    <Match when={assets.error}>
                        <span>Error: {assets.error.message}</span>
                    </Match>
                    <Match when={assets() && assets()!.currentPage === 1 && assets()!.items.length === 0}>
                        <span>No asset exists yet</span>
                    </Match>
                    <Match when={assets()}>
                        {(assets) => (
                            <>
                                <Show when={assets().items.length > 0} fallback={<span>No assets</span>}>
                                    <div class="row m-0 gap-2 mb-4">
                                        <For each={assets().items}>
                                            {(asset) => (
                                                <div class="col-md-2 col-sm-6 border-start border-end text-center d-flex flex-column" style="word-break: break-word;">
                                                    <Show when={asset.filetype?.startsWith('image')} fallback={<QuestionSquare class="h-100 w-75 m-auto p-2 text-secondary" viewBox="0 0 16 16" />}>
                                                        <A href={`/assets/view/${asset.id}`} class="flex-grow-1">
                                                            <img src={`${config.API_URL}/assets/content/${asset.filename}`} class="card-img p-2" alt={asset.name} />
                                                        </A>
                                                    </Show>
                                                    <A href={`/assets/view/${asset.id}`} class="text-center">
                                                        {asset.name}
                                                    </A>
                                                </div>
                                            )}
                                        </For>
                                    </div>
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
            </Suspense>
        </div>
    );
};

export const Asset = () => {
    enum Action {
        Delete,
    }

    const alertCtx = useContext(AlertContext)!;
    const contentCtx = useContext(ContentContext)!;
    const navigate = useNavigate();

    const params = useParams();

    const [asset] = createResource(() => parseInt(params.id), (id) => contentCtx.fetchAsset(id));

    const [inProgress, setInProgress] = createSignal(undefined as Action | undefined);

    const [dropdown, setDropdown] = createSignal(false);

    onCleanup(dropdownClickListener('asset-detail-dropdown', () => setDropdown(false), () => inProgress() === undefined));

    const deleteAsset = () => {
        const a = asset();

        if (inProgress() !== undefined || !a) {
            return;
        }

        setInProgress(Action.Delete);

        contentCtx.deleteAsset(a.id)
            .then(() => {
                alertCtx.success('Asset is deleted successfully');
                navigate(-1);
            })
            .catch((e) => alertCtx.fail(e.message))
            .finally(() => setInProgress(undefined));
    }

    return (
        <div class="container py-4 px-md-4">
            <Suspense fallback={<p>Loading...</p>}>
                <div class="d-flex align-items-center mb-5">
                    <div class="flex-grow-1">
                        <h2 class="m-0">{asset()?.name ?? '-'}</h2>
                        <small>Asset</small>
                    </div>
                    <div class="dropdown mx-2">
                        <button class="btn icon-link px-1" on:click={(ev) => { ev.stopPropagation(); setDropdown(!dropdown()); }}>
                            <ThreeDotsVertical viewBox="0 0 16 16" />
                        </button>
                        <Show when={dropdown()}>
                            <ul id="role-detail-dropdown" class="dropdown-menu mt-1 show shadow" style="right: 0;">
                                <li>
                                    <button class="dropdown-item text-danger icon-link py-2" onClick={deleteAsset}>
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
                </div>
                <div class="row m-0">
                    <Switch>
                        <Match when={asset.state === 'ready' && asset() === undefined}>
                            <span>Could not find the asset with id {params.id}.</span>
                        </Match>
                        <Match when={asset()}>
                            {(asset) => (
                                <>
                                    <div class="col-md-6">
                                        <Show when={asset().filetype?.startsWith('image')} fallback={<QuestionSquare class="h-100 w-100 text-secondary" style="max-height: 40vh" viewBox="0 0 16 16" />}>
                                            <img src={`${config.API_URL}/assets/content/${asset().filename}`} class="d-block m-auto mw-100" style="max-height: 40vh" alt={asset().name} />
                                        </Show>
                                    </div>
                                    <div class="offset-md-1 col-md-5 px-4">
                                        <h5>Details</h5>

                                        <hr />

                                        <table>
                                            <tbody>
                                                <tr>
                                                    <td class="p-2">Name</td>
                                                    <td class="text-end">{asset().name}</td>
                                                </tr>
                                                <tr>
                                                    <td class="p-2">Type</td>
                                                    <td class="text-end">{asset().filetype}</td>
                                                </tr>
                                                <tr>
                                                    <td class="p-2">Link</td>
                                                    <td class="text-end">
                                                        <a target="_blank" href={`${config.API_URL}/assets/content/${asset().filename}`}>{asset().filename}</a>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}
                        </Match>
                    </Switch>
                </div>
            </Suspense>
        </div>
    );
}
