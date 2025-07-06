import { createContext, createSignal, type Accessor, type Context, type Setter } from "solid-js";
import { PaginationRequest } from '../models';
import { Content, Model, type ModelResponse, type Asset, type ContentDetails, type ContentStage, type Field, type ModelField, type ContentResponse, type ContentDetailsResponse, type ContentValue, type Form } from "./models";
import type { CreateContent, CreateContentValue, CreateModel, CreateModelField, UpdateModelField } from "./requests";
import { Api } from "../api";
import type { Pagination } from "../models";

export interface CMSStore {
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

    fetchForms(): Promise<Form[]>;
}

export const CMSContext: Context<CMSStore | undefined> = createContext();

export class CMSService implements CMSStore {
    fields: Accessor<Field[]>;
    private setFields: Setter<Field[]>;

    models: Accessor<Model[]>;
    private setModels: Setter<Model[]>;

    constructor(models: Model[], fields: Field[]) {
        [this.models, this.setModels] = createSignal(models);
        [this.fields, this.setFields] = createSignal(fields);
    }

    async createModel(request: CreateModel): Promise<Model> {
        return Api.post<CreateModel, ModelResponse>('/cms/model/create', request).then(Model.fromResponse);
    }

    async createModelField(id: number, req: CreateModelField): Promise<ModelField> {
        return Api.post(`/cms/model/field/${id}/create`, req);
    }

    async updateModelDetails(id: number, name: string, desc: string | null): Promise<void> {
        return Api.put(`/cms/model/update/${id}`, { name, desc });
    }

    async updateModelField(id: number, req: UpdateModelField): Promise<void> {
        return Api.put(`/cms/model/field/${id}/update`, req);
    }

    async deleteModel(id: number): Promise<void> {
        return Api.delete(`/cms/model/delete/${id}`);
    }

    async deleteModelField(id: number): Promise<void> {
        return Api.delete(`/cms/model/field/${id}/delete`);
    }

    async createContent(content: CreateContent): Promise<Content> {
        return Api.post('/cms/content/create', content);
    }

    async createContentValue(id: number, req: CreateContentValue): Promise<ContentValue> {
        return Api.post(`/cms/content/value/${id}/create`, req);
    }

    async loadFields(): Promise<void> {
        this.setFields(await CMSService.fetchFields());
    }

    async loadModels(): Promise<void> {
        this.setModels(await CMSService.fetchModels());
    }

    async fetchAssets(pagination?: PaginationRequest): Promise<Pagination<Asset>> {
        const params = pagination ? PaginationRequest.toSearchParams(pagination).toString() : '';

        let url = '/cms/asset/all';

        if (params.length > 0) {
            url = `${url}?${params}`;
        }

        return Api.get(url);
    }

    async fetchAsset(id: number): Promise<Asset | undefined> {
        return Api.get<Asset>(`/cms/asset/view/${id}`).catch(Api.handleNotFound);
    }

    async updateAsset(id: number, name: string): Promise<void> {
        return Api.put(`/cms/asset/update/${id}`, { name });
    }

    async deleteAsset(id: number): Promise<void> {
        return Api.delete(`/cms/asset/delete/${id}`);
    }

    async fetchContents(modelId: number, pagination?: PaginationRequest): Promise<Pagination<Content>> {
        const params = pagination ? PaginationRequest.toSearchParams(pagination) : new URLSearchParams();

        params.append('modelId', modelId.toString());

        return Api.get<Pagination<ContentResponse>>(`/cms/content/all?${params.toString()}`)
            .then((pg) => ({ ...pg, items: pg.items.map(Content.fromResponse) }))
    }

    async fetchContent(id: number): Promise<ContentDetails | undefined> {
        return Api.get<ContentDetailsResponse>(`/cms/content/view/${id}`)
            .then((resp) => ({ ...resp, content: Content.fromResponse(resp.content) }))
            .catch(Api.handleNotFound);
    }

    async updateContentStage(id: number, stage: ContentStage): Promise<void> {
        return Api.put(`/cms/content/stage/${id}`, { stage });
    }

    async updateContentDetails(id: number, name: string): Promise<void> {
        return Api.put(`/cms/content/update/${id}`, { name });
    }

    async updateContentValue(id: number, req: CreateContentValue): Promise<void> {
        return Api.put(`/cms/content/value/${id}/update`, req);
    }

    async deleteContent(id: number): Promise<void> {
        return Api.delete(`/cms/content/delete/${id}`);
    }

    async deleteContentValue(id: number): Promise<void> {
        return Api.delete(`/cms/content/value/${id}/delete`);
    }

    async fetchForms(): Promise<Form[]> {
        return [{ id: 1, }, { id: 2, }, { id: 3, },];
    }

    static async fetchFields(): Promise<Field[]> {
        return Api.get('/cms/field/all');
    }

    static async fetchModels(): Promise<Model[]> {
        return Api.get<ModelResponse[]>('/cms/model/all').then((models) => models.map(Model.fromResponse));
    }
}
