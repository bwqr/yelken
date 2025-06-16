import { createContext, type Context } from "solid-js";
import { Api, HttpError } from "../api";
import { LocationKind, Permission, UserState, type LocaleResource, type Page, type Role, type RoleDetail, type Template, type TemplateDetail, type Theme, type User, type UserDetail } from "./models";

export interface AdminStore {
    fetchPages(): Promise<Page[]>
    createPage(name: string, path: string, template: string, themeScoped: boolean, locale: string | null): Promise<Page>;

    fetchUsers(): Promise<User[]>;
    fetchUser(username: string): Promise<UserDetail | undefined>;
    createUser(name: string, email: string, password: string): Promise<User>;
    updateUserRole(id: number, roleId: number | null): Promise<void>;
    updateUserState(id: number, userState: UserState): Promise<void>;
    updateUserPermission(id: number, permissions: Permission[]): Promise<void>;
    deleteUser(id: number): Promise<void>;

    fetchRoles(): Promise<Role[]>;
    fetchRole(id: number): Promise<RoleDetail | undefined>;
    createRole(key: string, name: string, desc: string | null): Promise<Role>;
    updateRolePermission(id: number, permissions: Permission[]): Promise<void>;
    deleteRole(id: number): Promise<void>;

    fetchTemplates(): Promise<Template[]>
    fetchTemplate(path: string, kind: LocationKind): Promise<TemplateDetail | undefined>
    updateTemplate(path: string, kind: LocationKind, template: string): Promise<void>;
    deleteTemplate(path: string, kind: LocationKind): Promise<void>;

    fetchThemes(): Promise<Theme[]>,
    setThemeActive(themeId: string): Promise<void>;
    uninstallTheme(themeId: string): Promise<void>;

    fetchLocaleResource(key: string, kind: LocationKind): Promise<LocaleResource | undefined>;
    updateLocaleResource(key: string, kind: LocationKind, resource: string): Promise<void>;
    createLocale(name: string, key: string): Promise<void>;
    deleteLocale(key: string): Promise<void>;
    updateLocaleState(key: string, disabled: boolean): Promise<void>;
    setLocaleDefault(key: string): Promise<void>;
}

export const AdminContext: Context<AdminStore | undefined> = createContext();

export class AdminService implements AdminStore {
    async fetchPages(): Promise<Page[]> {
        return Api.get('/admin/page/pages');
    }

    async createPage(name: string, path: string, template: string, themeScoped: boolean, locale: string | null): Promise<Page> {
        return Api.post('/admin/page', { name, path, template, themeScoped, locale });
    }

    async fetchUsers(): Promise<User[]> {
        return Api.get('/admin/user/users');
    }

    async fetchUser(username: string): Promise<UserDetail | undefined> {
        return Api.get<UserDetail>(`/admin/user/user/${username}`)
            .catch(Api.handleNotFound);
    }

    async createUser(name: string, email: string, password: string): Promise<User> {
        return Api.post('/admin/user', { name, email, password });
    }

    async updateUserRole(id: number, roleId: number | null): Promise<void> {
        return Api.put(`/admin/user/${id}/role`, roleId);
    }

    async updateUserState(id: number, userState: UserState): Promise<void> {
        return Api.put(`/admin/user/${id}/state`, userState);
    }

    async updateUserPermission(id: number, permissions: Permission[]): Promise<void> {
        return Api.post(`/admin/permission/user/${id}`, permissions);
    }

    async deleteUser(id: number): Promise<void> {
        return Api.delete(`/admin/user/${id}`);
    }

    async fetchRoles(): Promise<Role[]> {
        return Api.get('/admin/role/roles');
    }

    async fetchRole(id: number): Promise<RoleDetail | undefined> {
        return Api.get<RoleDetail>(`/admin/role/role/${id}`)
            .catch(Api.handleNotFound);
    }

    async createRole(key: string, name: string, desc: string | null): Promise<Role> {
        return Api.post('/admin/role', { key, name, desc });
    }

    async updateRolePermission(id: number, permissions: Permission[]): Promise<void> {
        return Api.post(`/admin/permission/role/${id}`, permissions);
    }

    async deleteRole(id: number): Promise<void> {
        return Api.delete(`/admin/role/role/${id}`);
    }

    async fetchTemplates(): Promise<Template[]> {
        return Api.get('/admin/template/templates');
    }

    async fetchTemplate(path: string, kind: LocationKind): Promise<TemplateDetail | undefined> {
        return Api.get<TemplateDetail>(`/admin/template/template?path=${encodeURIComponent(path)}&kind=${encodeURIComponent(kind)}`)
            .catch((e) => {
                if ((e instanceof HttpError) && e.error === 'template_not_found') {
                    return undefined;
                }

                throw e;
            });
    }

    async updateTemplate(path: string, kind: LocationKind, template: string): Promise<void> {
        return Api.put(`/admin/template`, { path, themeScoped: kind !== LocationKind.Global, template });
    }

    async deleteTemplate(path: string, kind: LocationKind): Promise<void> {
        return Api.delete(`/admin/template?path=${encodeURIComponent(path)}&themeScoped=${kind !== LocationKind.Global}`);
    }

    async fetchThemes(): Promise<Theme[]> {
        return Api.get('/admin/theme/themes');
    }

    async setThemeActive(themeId: string): Promise<void> {
        return Api.put('/admin/options/theme', { theme: themeId });
    }

    async uninstallTheme(themeId: string): Promise<void> {
        return Api.delete(`/admin/theme/theme/${themeId}`);
    }

    async fetchLocaleResource(key: string, kind: LocationKind): Promise<LocaleResource | undefined> {
        return Api.get<LocaleResource>(`/admin/locale/${key}/resource?kind=${kind}`)
            .catch((e) => {
                if ((e instanceof HttpError) && e.error === 'resource_not_found') {
                    return undefined;
                }

                throw e;
            });
    }

    async updateLocaleResource(key: string, kind: LocationKind, resource: string): Promise<void> {
        return Api.put(`/admin/locale/${key}/resource`, { resource, themeScoped: kind !== LocationKind.Global });
    }

    async createLocale(name: string, key: string): Promise<void> {
        return Api.post('/admin/locale', { name, key });
    }

    async deleteLocale(key: string): Promise<void> {
        return Api.delete(`/admin/locale/${key}`);
    }

    async updateLocaleState(key: string, disabled: boolean): Promise<void> {
        return Api.put(`/admin/locale/${key}/state`, { disabled });
    }

    async setLocaleDefault(key: string): Promise<void> {
        return Api.put(`/admin/options/default-locale`, { locale: key });
    }
}
