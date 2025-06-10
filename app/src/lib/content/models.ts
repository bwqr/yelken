import type { User } from "../user/model";

export interface Locale {
    key: string,
    name: string,
    disabled: boolean,
}

export interface ModelField {
    id: number,
    fieldId: number,
    modelId: number,
    name: string,
    localized: boolean,
    multiple: boolean,
    required: boolean,
}

export interface Model {
    id: number,
    namespace: string | null,
    name: string,
    fields: ModelField[],
}

export enum FieldKind {
    String = 'string',
    Integer = 'integer',
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

export interface Content {
    id: number,
    modelId: number,
    name: string,
    stage: ContentStage,
    createdBy: number | null,
    createdAt: string,
    updatedAt: string,
}

export interface ContentValue {
    id: number,
    modelFieldId: number,
    locale: string | null,
    value: string,
}

export interface ContentDetails {
    content: Content,
    values: ContentValue[],
    user: User | null,
}

export interface Options {
    theme: string,
    defaultLocale: string,
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
