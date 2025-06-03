import { createContext, type Context } from "solid-js";
import { Api } from "../api";
import { LocationKind, type LocaleResource, type Page, type Template, type TemplateDetail, type Theme } from "./models";

export interface AdminStore {
    fetchPages(): Promise<Page[]>
    fetchTemplates(): Promise<Template[]>
    fetchTemplate(path: string, kind: LocationKind): Promise<TemplateDetail>
    updateTemplate(path: string, kind: LocationKind, template: string): Promise<void>;

    fetchThemes(): Promise<Theme[]>,
    setThemeActive(themeId: string): Promise<void>;
    uninstallTheme(themeId: string): Promise<void>;

    fetchLocaleResource(key: string, kind: LocationKind): Promise<LocaleResource>;
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

    async fetchTemplates(): Promise<Template[]> {
        return Api.get('/admin/template/templates');
    }

    async fetchTemplate(path: string, kind: LocationKind): Promise<TemplateDetail> {
        return Api.get(`/admin/template/template?path=${encodeURIComponent(path)}&kind=${encodeURIComponent(kind)}`);
    }

    async updateTemplate(path: string, kind: LocationKind, template: string): Promise<void> {
        return Api.put(`/admin/template`, { path, themeScoped: kind !== LocationKind.Global, template });
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

    async fetchLocaleResource(key: string, kind: LocationKind): Promise<LocaleResource> {
        return Api.get(`/admin/locale/${key}/resource?kind=${kind}`);
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
