import type { Permission } from "../admin/models";

export enum UserState {
    Enabled = 'enabled',
    Disabled = 'disabled',
}

export enum LoginKind {
    Email = 'email',
    Cloud = 'cloud',
}

export interface User {
    id: number,
    roleId: number | null,
    username: string,
    name: string,
    email: string,
    state: UserState,
    loginKind: LoginKind,
    createdAt: string,
    permissions: Permission[],
}
