import { createContext, type Context } from "solid-js";
import { Api, HttpError } from "../api";
import { type LocaleResource, type Role, type RoleDetail, type User, type UserDetail } from "./models";
import { Location, Permission } from "../models";
import type { UserState } from "../user/models";

export interface AdminStore {
    fetchUsers(): Promise<User[]>;
    fetchUser(username: string): Promise<UserDetail | undefined>;
    createUser(req: { name: string, email: string, password: string }): Promise<User>;
    updateUser(id: number, req: { name: string, state: UserState, roleId: number | null }): Promise<void>;
    updateUserPermission(id: number, permissions: Permission[]): Promise<void>;
    deleteUser(id: number): Promise<void>;

    fetchRoles(): Promise<Role[]>;
    fetchRole(key: string): Promise<RoleDetail | undefined>;
    createRole(req: { name: string, key: string, desc: string | null }): Promise<Role>;
    updateRole(key: string, req: { name: string, desc: string | null }): Promise<void>;
    updateRolePermission(id: number, permissions: Permission[]): Promise<void>;
    deleteRole(key: string): Promise<void>;

    fetchLocaleResource(key: string, location: Location): Promise<LocaleResource | undefined>;
    updateLocaleResource(key: string, resource: string, namespace?: string): Promise<void>;
    createLocale(req: { name: string, key: string }): Promise<void>;
    updateLocale(key: string, req: { name: string }): Promise<void>;
    deleteLocale(key: string): Promise<void>;
    updateLocaleState(key: string, disabled: boolean): Promise<void>;
    setLocaleDefault(key: string): Promise<void>;
}

export const AdminContext: Context<AdminStore | undefined> = createContext();

export class AdminService implements AdminStore {
    async fetchUsers(): Promise<User[]> {
        return Api.get('/admin/user/all');
    }

    async fetchUser(username: string): Promise<UserDetail | undefined> {
        return Api.get<UserDetail>(`/admin/user/view/${username}`)
            .catch(Api.handleNotFound);
    }

    async createUser(req: { name: string, email: string, password: string }): Promise<User> {
        return Api.post('/admin/user/create', req);
    }

    async updateUser(id: number, req: { name: string, state: UserState, roleId: number | null }): Promise<void> {
        return Api.put(`/admin/user/update/${id}`, req);
    }

    async updateUserPermission(id: number, permissions: Permission[]): Promise<void> {
        return Api.post(`/admin/permission/user/${id}/update`, permissions);
    }

    async deleteUser(id: number): Promise<void> {
        return Api.delete(`/admin/user/delete/${id}`);
    }

    async fetchRoles(): Promise<Role[]> {
        return Api.get('/admin/role/all');
    }

    async fetchRole(key: string): Promise<RoleDetail | undefined> {
        return Api.get<RoleDetail>(`/admin/role/view/${key}`)
            .catch(Api.handleNotFound);
    }

    async createRole(req: { name: string, key: string, desc: string | null }): Promise<Role> {
        return Api.post('/admin/role/create', req);
    }

    async updateRole(key: string, req: { name: string; desc: string | null; }): Promise<void> {
        return Api.put(`/admin/role/update/${key}`, req);
    }

    async updateRolePermission(id: number, permissions: Permission[]): Promise<void> {
        return Api.post(`/admin/permission/role/${id}/update`, permissions);
    }

    async deleteRole(key: string): Promise<void> {
        return Api.delete(`/admin/role/delete/${key}`);
    }

    async fetchLocaleResource(key: string, location: Location): Promise<LocaleResource | undefined> {
        const searchParams = Location.toSearchParams(location);

        return Api.get<LocaleResource>(`/admin/locale/resource/${key}?${searchParams.toString()}`)
            .catch((e) => {
                if ((e instanceof HttpError) && e.error === 'resource_not_found') {
                    return undefined;
                }

                throw e;
            });
    }

    async updateLocaleResource(key: string, resource: string, namespace?: string): Promise<void> {
        const searchParams = namespace ? new URLSearchParams({ namespace }).toString() : '';

        return Api.put(`/admin/locale/resource/${key}/update?${searchParams}`, { resource });
    }

    async createLocale(req: { name: string, key: string }): Promise<void> {
        return Api.post('/admin/locale/create', req);
    }

    async updateLocale(key: string, req: { name: string; }): Promise<void> {
        return Api.put(`/admin/locale/update/${key}`, req);
    }

    async deleteLocale(key: string): Promise<void> {
        return Api.delete(`/admin/locale/delete/${key}`);
    }

    async updateLocaleState(key: string, disabled: boolean): Promise<void> {
        return Api.put(`/admin/locale/state/${key}`, { disabled });
    }

    async setLocaleDefault(key: string): Promise<void> {
        return Api.put('/admin/locale/default', { locale: key });
    }
}
