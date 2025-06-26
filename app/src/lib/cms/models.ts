export interface ModelField {
    id: number,
    fieldId: number,
    modelId: number,
    key: string,
    name: string,
    desc: string | null,
    localized: boolean,
    multiple: boolean,
    required: boolean,
}

export interface ModelResponse {
    id: number,
    namespace: string | null,
    key: string,
    name: string,
    desc: string | null,
    fields: ModelField[],
    createdAt: string,
}

export class Model implements Omit<ModelResponse, 'createdAt'> {
    constructor(
        public id: number,
        public namespace: string | null,
        public key: string,
        public name: string,
        public desc: string | null,
        public fields: ModelField[],
        public createdAt: Date,
    ) { }

    static fromResponse(response: ModelResponse): Model {
        return new Model(
            response.id,
            response.namespace,
            response.key,
            response.name,
            response.desc,
            response.fields,
            new Date(response.createdAt),
        )
    }

    static searchWithParams(namespace: string | string[] | undefined, key: string | string[] | undefined): (model: Model) => boolean {
        return (model) => model.key === key && (namespace ? model.namespace === namespace : model.namespace === null);
    }

    urlPath(): string {
        return this.namespace ? `${this.namespace}/${this.key}` : this.key;
    }

    title(): string {
        return this.namespace ? `${this.name} (${this.namespace})` : this.name;
    }
}

export enum FieldKind {
    String = 'string',
    Integer = 'int',
    Asset = 'asset',
}

export interface Field {
    id: number,
    name: string,
    kind: FieldKind,
}

export enum ContentStage {
    Published = 'published',
    Draft = 'draft',
}

export interface ContentResponse {
    id: number,
    modelId: number,
    name: string,
    stage: ContentStage,
    createdBy: number | null,
    createdAt: string,
    updatedAt: string,
}

export class Content implements Omit<ContentResponse, 'createdAt' | 'updatedAt'> {
    constructor(
        public id: number,
        public modelId: number,
        public name: string,
        public stage: ContentStage,
        public createdBy: number | null,
        public createdAt: Date,
        public updatedAt: Date,
    ) { }

    static fromResponse(response: ContentResponse): Content {
        return new Content(
            response.id,
            response.modelId,
            response.name,
            response.stage,
            response.createdBy,
            new Date(response.createdAt),
            new Date(response.updatedAt),
        )
    }
}

export interface ContentValue {
    id: number,
    modelFieldId: number,
    locale: string | null,
    value: string,
}

export interface ContentDetailsResponse {
    content: ContentResponse,
    values: ContentValue[],
    user: { id: number, name: string } | null,
}

export interface ContentDetails extends Omit<ContentDetailsResponse, 'content'> {
    content: Content,
}

export interface Asset {
    id: number,
    name: string,
    filename: string,
    filetype: string | null,
    createdBy: number | null,
    createdAt: string,
    updatedAt: string,
}
