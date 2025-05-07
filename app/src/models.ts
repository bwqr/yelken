export interface User {
    id: number;
    name: string;
}

export interface Locale {
    key: string;
    name: string;
    disabled: boolean;
}

export interface ModelField {
    id: number;
    fieldId: number;
    modelId: number;
    name: string;
    localized: boolean;
    multiple: boolean;
    required: boolean;
}

export interface Model {
    id: number;
    namespace: string | null;
    name: string;
    fields: ModelField[];
}

export interface Field {
    id: number;
    name: string;
    kind: string;
}

export interface CreateModelField {
    fieldId: number;
    name: string;
    localized: boolean;
    multiple: boolean;
    required: boolean;
}

export interface CreateModel {
    name: string;
    modelFields: CreateModelField[];
    themeScoped: boolean;
}

export interface CreateContentValue {
    modelFieldId: number;
    locale?: string;
    value: string;
}

export interface CreateContent {
    name: string;
    modelId: number;
    values: CreateContentValue[];
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
    createdAt: string;
}

export interface ContentValue {
    id: number;
    modelFieldId: number;
    locale: string | null;
    value: string;
}

export interface ContentWithValues {
    content: Content,
    values: ContentValue[],
}
