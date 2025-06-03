export enum LocationKind {
    User = 'user',
    Global = 'global',
    Theme = 'theme',
}

export interface Page {
    id: number,
    namespace: string | null,
    name: string,
    path: string,
    template: string,
    locale: string | null,
    createdAt: string,
}

export interface Template {
    path: string,
    kind: LocationKind,
}

export interface TemplateDetail extends Template {
    template: string,
}

export interface Theme {
    id: string,
    version: string,
    name: string,
    createdAt: string,
}

export interface LocaleResource {
    resource: string,
    kind: LocationKind,
}
