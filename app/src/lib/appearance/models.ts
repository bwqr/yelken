import { Location } from "../models";

export enum PageKind {
    Asset = 'asset',
    Template = 'template',
}

export interface Page {
    id: number,
    namespace: string | null,
    key: string,
    name: string,
    desc: string | null,
    path: string,
    kind: PageKind,
    value: string,
    locale: string | null,
    createdAt: string,
}

export interface Template {
    path: string,
    location: Location,
}

export interface TemplateDetail {
    path: string,
    template: string,
}

export interface Theme {
    id: string,
    version: string,
    name: string,
    createdAt: string,
}
