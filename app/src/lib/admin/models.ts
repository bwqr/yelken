export enum LocationKind {
    User = 'user',
    Global = 'global',
    Theme = 'theme',
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
    kind: LocationKind,
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
