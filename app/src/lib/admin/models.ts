export enum LocationKind {
    Global = 'global',
    Theme = 'theme',
    User = 'user',
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

export interface TemplateDetails extends Template {
    template: string,
}

export interface Theme {
    id: string,
    version: string,
    name: string,
    createdAt: string,
}
