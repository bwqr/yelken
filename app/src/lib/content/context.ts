import { createContext, createSignal, type Accessor, type Context, type Setter } from "solid-js";
import { PaginationRequest } from '../models';
import { Content, Model, type ModelResponse, type Asset, type ContentDetails, type ContentStage, type Field, type Locale, type Options, type ModelField, type ContentResponse, type ContentDetailsResponse } from "./models";
import type { CreateContent, CreateModel, CreateModelField, UpdateModelField } from "./requests";
import { Api } from "../api";
import type { Pagination } from "../models";

export interface ContentStore {
    fields: Accessor<Field[]>;
    models: Accessor<Model[]>;
    options: Accessor<Options>;
    locales: Accessor<Locale[]>;

    activeLocales(): Locale[];

    loadFields(): Promise<void>;
    loadLocales(): Promise<void>;
    loadModels(): Promise<void>;
    loadOptions(): Promise<void>;

    fetchAssets(pagination?: PaginationRequest): Promise<Pagination<Asset>>;
    fetchAsset(id: number): Promise<Asset | undefined>;
    deleteAsset(id: number): Promise<void>;

    fetchContents(modelId: number, pagination?: PaginationRequest): Promise<Pagination<Content>>;
    fetchContent(id: number): Promise<ContentDetails>;
    createContent(model: CreateContent): Promise<Content>;
    updateContentStage(id: number, stage: ContentStage): Promise<void>;
    deleteContent(id: number): Promise<void>;

    createModel(model: CreateModel): Promise<Model>;
    createModelField(id: number, req: CreateModelField): Promise<ModelField>;
    updateModelDetails(id: number, name: string, desc: string | null): Promise<void>;
    updateModelField(id: number, req: UpdateModelField): Promise<void>;
    deleteModel(id: number): Promise<void>;
    deleteModelField(id: number): Promise<void>;
}

export const ContentContext: Context<ContentStore | undefined> = createContext();

export class ContentService implements ContentStore {
    fields: Accessor<Field[]>;
    private setFields: Setter<Field[]>;

    models: Accessor<Model[]>;
    private setModels: Setter<Model[]>;

    options: Accessor<Options>;
    private setOptions: Setter<Options>;

    locales: Accessor<Locale[]>;
    private setLocales: Setter<Locale[]>;

    constructor(models: Model[], fields: Field[], options: Options, locales: Locale[]) {
        [this.models, this.setModels] = createSignal(models);
        [this.fields, this.setFields] = createSignal(fields);
        [this.options, this.setOptions] = createSignal(options);
        [this.locales, this.setLocales] = createSignal(locales);
    }

    activeLocales(): Locale[] {
        return this.locales().filter((l) => !l.disabled);
    }

    async createModel(request: CreateModel): Promise<Model> {
        return Api.post<CreateModel, ModelResponse>('/content/model', request).then(Model.fromResponse);
    }

    async createModelField(id: number, req: CreateModelField): Promise<ModelField> {
        return Api.post(`/content/model/${id}/field`, req);
    }

    async updateModelDetails(id: number, name: string, desc: string | null): Promise<void> {
        return Api.put(`/content/model/${id}`, { name, desc });
    }

    async updateModelField(id: number, req: UpdateModelField): Promise<void> {
        return Api.put(`/content/model-field/${id}`, req);
    }

    async deleteModel(id: number): Promise<void> {
        return Api.delete(`/content/model/${id}`);
    }

    async deleteModelField(id: number): Promise<void> {
        return Api.delete(`/content/model-field/${id}`);
    }

    async createContent(content: CreateContent): Promise<Content> {
        return Api.post('/content/content', content);
    }

    async loadFields(): Promise<void> {
        this.setFields(await ContentService.fetchFields());
    }

    async loadLocales(): Promise<void> {
        this.setLocales(await ContentService.fetchLocales());
    }

    async loadModels(): Promise<void> {
        this.setModels(await ContentService.fetchModels());
    }

    async loadOptions(): Promise<void> {
        this.setOptions(await ContentService.fetchOptions());
    }

    async fetchAssets(pagination?: PaginationRequest): Promise<Pagination<Asset>> {
        const params = pagination ? PaginationRequest.toSearchParams(pagination).toString() : '';

        let url = '/content/assets';

        if (params.length > 0) {
            url = `${url}?${params}`;
        }

        return Api.get(url);
    }

    async fetchAsset(id: number): Promise<Asset | undefined> {
        return Api.get<Asset>(`/content/asset/${id}`).catch(Api.handleNotFound);
    }

    async deleteAsset(id: number): Promise<void> {
        return Api.delete(`/content/asset/${id}`);
    }

    async fetchContents(modelId: number, pagination?: PaginationRequest): Promise<Pagination<Content>> {
        const params = pagination ? PaginationRequest.toSearchParams(pagination) : new URLSearchParams();

        params.append('modelId', modelId.toString());

        return Api.get<Pagination<ContentResponse>>(`/content/contents?${params.toString()}`)
            .then((pg) => ({ ...pg, items: pg.items.map(Content.fromResponse) }))
    }

    async fetchContent(id: number): Promise<ContentDetails> {
        return Api.get<ContentDetailsResponse>(`/content/content/${id}`)
            .then((resp) => ({ ...resp, content: Content.fromResponse(resp.content) }));
    }

    async updateContentStage(id: number, stage: ContentStage): Promise<void> {
        return Api.put(`/content/content/${id}/stage`, { stage });
    }

    async deleteContent(id: number): Promise<void> {
        return Api.delete(`/content/content/${id}`);
    }

    static async fetchFields(): Promise<Field[]> {
        return Api.get('/content/fields');
    }

    static async fetchLocales(): Promise<Locale[]> {
        return Api.get('/content/locales');
    }

    static async fetchModels(): Promise<Model[]> {
        return Api.get<ModelResponse[]>('/content/models').then((models) => models.map(Model.fromResponse));
    }

    static async fetchOptions(): Promise<Options> {
        return Api.get('/content/options');
    }
}
