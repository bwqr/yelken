import { createContext, createSignal, type Accessor, type Context, type Setter } from "solid-js";
import { PaginationRequest } from '../models';
import type { Asset, Content, ContentDetails, ContentStage, Field, Locale, Model, Options } from "./models";
import type { CreateContent, CreateModel } from "./requests";
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

    createModel(model: CreateModel): Promise<void>;
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

    async createModel(model: CreateModel): Promise<void> {
        await Api.post('/content/model', model);

        return this.loadModels();
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

        return Api.get(`/content/contents?${params.toString()}`)
    }

    async fetchContent(id: number): Promise<ContentDetails> {
        return Api.get(`/content/content/${id}`)
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
        return Api.get('/content/models');
    }

    static async fetchOptions(): Promise<Options> {
        return Api.get('/content/options');
    }
}
