import { createContext, createSignal, type Accessor, type Context, type Setter } from "solid-js";
import { PaginationRequest } from '../models';
import { Content, Model, type ModelResponse, type Asset, type ContentDetails, type ContentStage, type Field, type ModelField, type ContentResponse, type ContentDetailsResponse, type ContentValue } from "./models";
import type { CreateContent, CreateContentValue, CreateModel, CreateModelField, UpdateModelField } from "./requests";
import { Api } from "../api";
import type { Pagination } from "../models";

export interface ContentStore {
    fields: Accessor<Field[]>;
    models: Accessor<Model[]>;

    loadFields(): Promise<void>;
    loadModels(): Promise<void>;

    fetchAssets(pagination?: PaginationRequest): Promise<Pagination<Asset>>;
    fetchAsset(id: number): Promise<Asset | undefined>;
    updateAsset(id: number, name: string): Promise<void>;
    deleteAsset(id: number): Promise<void>;

    fetchContents(modelId: number, pagination?: PaginationRequest): Promise<Pagination<Content>>;
    fetchContent(id: number): Promise<ContentDetails | undefined>;
    createContent(model: CreateContent): Promise<Content>;
    createContentValue(id: number, req: CreateContentValue): Promise<ContentValue>;
    updateContentStage(id: number, stage: ContentStage): Promise<void>;
    updateContentDetails(id: number, name: string): Promise<void>;
    updateContentValue(id: number, req: CreateContentValue): Promise<void>;
    deleteContent(id: number): Promise<void>;
    deleteContentValue(id: number): Promise<void>;

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

    constructor(models: Model[], fields: Field[]) {
        [this.models, this.setModels] = createSignal(models);
        [this.fields, this.setFields] = createSignal(fields);
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

    async createContentValue(id: number, req: CreateContentValue): Promise<ContentValue> {
        return Api.post(`/content/content/${id}`, req);
    }

    async loadFields(): Promise<void> {
        this.setFields(await ContentService.fetchFields());
    }

    async loadModels(): Promise<void> {
        this.setModels(await ContentService.fetchModels());
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

    async updateAsset(id: number, name: string): Promise<void> {
        return Api.put(`/content/asset/${id}`, { name });
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

    async fetchContent(id: number): Promise<ContentDetails | undefined> {
        return Api.get<ContentDetailsResponse>(`/content/content/${id}`)
            .then((resp) => ({ ...resp, content: Content.fromResponse(resp.content) }))
            .catch(Api.handleNotFound);
    }

    async updateContentStage(id: number, stage: ContentStage): Promise<void> {
        return Api.put(`/content/content/${id}/stage`, { stage });
    }

    async updateContentDetails(id: number, name: string): Promise<void> {
        return Api.put(`/content/content/${id}`, { name });
    }

    async updateContentValue(id: number, req: CreateContentValue): Promise<void> {
        return Api.put(`/content/value/${id}`, req);
    }

    async deleteContent(id: number): Promise<void> {
        return Api.delete(`/content/content/${id}`);
    }

    async deleteContentValue(id: number): Promise<void> {
        return Api.delete(`/content/value/${id}`);
    }

    static async fetchFields(): Promise<Field[]> {
        return Api.get('/content/fields');
    }

    static async fetchModels(): Promise<Model[]> {
        return Api.get<ModelResponse[]>('/content/models').then((models) => models.map(Model.fromResponse));
    }
}
