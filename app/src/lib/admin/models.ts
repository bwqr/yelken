import type { Permission } from "../models";
import type { UserState } from "../user/models";

export interface LocaleResource {
    resource: string,
}

export interface Role {
    id: number,
    name: string,
    key: string,
    desc: string | null,
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
