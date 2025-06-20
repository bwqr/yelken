export enum LocationKind {
    User = 'user',
    Global = 'global',
    Theme = 'theme',
}

export type LocationKind2 = { kind: LocationKind.Global, namespace?: undefined } | { kind: LocationKind.Theme | LocationKind.User, namespace: string };

export namespace LocationKind2 {
    export function toSearchParams(location: LocationKind2): URLSearchParams {
        const searchParams = new URLSearchParams();

        searchParams.append('kind', location.kind);

        if (location.namespace) {
            searchParams.append('namespace', location.namespace);
        }

        return searchParams;
    }

    export function fromParams(locationKind: string | undefined, namespace: string | undefined): LocationKind2 | undefined {
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
}

export enum Permission {
    Admin = 'admin',
    ContentRead = 'content.read',
    ContentWrite = 'content.write',
    UserRead = 'user.read',
    UserWrite = 'user.write',
}

export enum UserState {
    Enabled = 'enabled',
    Disabled = 'disabled',
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
}

export interface Role {
    id: number,
    name: string,
}

export interface RoleDetail extends Role {
    permissions: Permission[],
}

export interface User {
    id: number,
    roleId: number | null,
    username: string,
    name: string,
    state: UserState,
}

export interface UserDetail extends User {
    email: string,
    permissions: Permission[];
}
