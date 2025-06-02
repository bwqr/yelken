import { createContext, type Context } from "solid-js";
import { Api } from "../api";
import { LocationKind, type Page, type Template, type TemplateDetails, type Theme } from "./models";

export interface AdminStore {
    fetchPages(): Promise<Page[]>
    fetchTemplates(): Promise<Template[]>
    fetchTemplate(path: string, kind: LocationKind): Promise<TemplateDetails>
    updateTemplate(path: string, kind: LocationKind, template: string): Promise<void>;

    fetchThemes(): Promise<Theme[]>,
    setThemeActive(themeId: string): Promise<void>;
    uninstallTheme(themeId: string): Promise<void>;

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

    async fetchTemplate(path: string, kind: LocationKind): Promise<TemplateDetails> {
        return Api.get(`/admin/template/template?path=${encodeURIComponent(path)}&kind=${encodeURIComponent(kind)}`);
    }

    async updateTemplate(path: string, kind: LocationKind, template: string): Promise<void> {
        return Api.put(`/admin/template`, { path, themeScoped: kind === LocationKind.User, template });
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

    async updateLocaleState(localeKey: string, disabled: boolean): Promise<void> {
        return Api.put(`/admin/locale/${localeKey}/state`, { disabled });
    }

    async setLocaleDefault(localeKey: string): Promise<void> {
        return Api.put(`/admin/options/default-locale`, { locale: localeKey });
    }
}
