export interface User {
    id: number;
    name: string;
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
    fields: [ModelField];
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
