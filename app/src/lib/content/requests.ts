export interface CreateModelField {
    fieldId: number,
    name: string,
    localized: boolean,
    multiple: boolean,
    required: boolean,
}

export interface CreateModel {
    name: string,
    modelFields: CreateModelField[],
    themeScoped: boolean,
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
