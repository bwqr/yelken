export interface PaginationRequest {
    perPage?: number,
    page?: number,
}

export namespace PaginationRequest {
    export function fromParams(page: string | string[] | undefined, perPage: string | string[] | undefined): PaginationRequest {
        return {
            page: (typeof page === 'string' ? parseInt(page) : undefined) || undefined,
            perPage: (typeof perPage === 'string' ? parseInt(perPage) : undefined) || undefined,
        };
    }

    export function toSearchParams(pagination: PaginationRequest): URLSearchParams {
        const searchParams = new URLSearchParams();

        if (pagination.page !== undefined) {
            searchParams.append('page', pagination.page.toString());
        }

        if (pagination.perPage !== undefined) {
            searchParams.append('perPage', pagination.perPage.toString());
        }

        return searchParams;
    }
}


export interface Pagination<T> {
    perPage: number,
    currentPage: number,
    totalPages: number,
    totalItems: number,
    items: T[],
}

export enum LocationKind {
    User = 'user',
    Global = 'global',
    Theme = 'theme',
}

export type Location = { kind: LocationKind.Global, namespace?: undefined } | { kind: LocationKind.Theme | LocationKind.User, namespace: string };

export namespace Location {
    export function toSearchParams(location: Location): URLSearchParams {
        const searchParams = new URLSearchParams();

        searchParams.append('kind', location.kind);

        if (location.namespace) {
            searchParams.append('namespace', location.namespace);
        }

        return searchParams;
    }

    export function fromParams(locationKind: string | undefined, namespace: string | undefined): Location | undefined {
        const kind = Object.entries(LocationKind).find((k) => k[1] === locationKind)?.[1];

        if (kind === undefined) {
            return undefined
        }

        if (kind === LocationKind.Global) {
            return { kind };
        }

        if (namespace === undefined) {
            return undefined;
        }

        return { kind, namespace };
    }

    export function urlPath(location: Location): string {
        return location.kind === LocationKind.Global ? `${location.kind}` : `${location.kind}/${location.namespace}`;
    }
}

export enum Permission {
    Admin = 'admin',
    CMSRead = 'cms.read',
    AssetWrite = 'asset.write',
    ContentWrite = 'content.write',
    ModelWrite = 'model.write',
    AppearanceRead = 'appearance.read',
    PageWrite = 'page.write',
    TemplateWrite = 'template.write',
    ThemeWrite = 'theme.write',
}

export interface Locale {
    key: string,
    name: string,
    disabled: boolean,
}

export interface Options {
    theme: string,
    defaultLocale: string,
}

export enum NamespaceSource {
    Theme = 'theme',
    Plugin = 'plugin',
}

export interface Namespace {
    key: string,
    source: NamespaceSource,
}
