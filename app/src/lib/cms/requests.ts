export interface CreateModelField {
    fieldId: number,
    key: string,
    name: string,
    desc: string | null,
    localized: boolean,
    multiple: boolean,
    required: boolean,
}

export interface UpdateModelField {
    name: string,
    desc: string | null,
    localized: boolean,
    multiple: boolean,
    required: boolean,
}

export interface CreateModel {
    namespace: string | null,
    key: string,
    name: string,
    desc: string | null,
    modelFields: CreateModelField[],
}

export interface CreateContentValue {
    modelFieldId: number,
    locale?: string,
    value: string,
}

export interface CreateContent {
    name: string,
    modelId: number,
    values: CreateContentValue[],
}
