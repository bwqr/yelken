import { type Context, createContext } from "solid-js";
import type { Page, PageKind, Template, TemplateDetail, Theme } from "./models";
import { Location } from "../models";
import { Api, HttpError } from "../api";

export interface AppearanceStore {
    fetchPages(namespace?: string): Promise<Page[]>
    fetchPage(key: string, namespace?: string): Promise<Page[]>;
    createPage(req: { name: string, key: string, desc: string | null, path: string, namespace: string | null, kind: PageKind, value: string, locale: string | null }): Promise<Page>;
    updatePage(key: string, req: { name: string, desc: string | null }, namespace?: string): Promise<void>;
    deletePage(key: string, locale: string | null, namespace?: string): Promise<void>;

    fetchTemplates(namespace?: string): Promise<Template[]>
    fetchTemplate(path: string, kind: Location): Promise<TemplateDetail | undefined>
    createTemplate(path: string, template: string, namespace?: string): Promise<void>;
    updateTemplate(path: string, template: string, namespace?: string): Promise<void>;
    deleteTemplate(path: string, namespace?: string): Promise<void>;

    fetchThemes(): Promise<Theme[]>,
    setThemeActive(themeId: string): Promise<void>;
    uninstallTheme(themeId: string): Promise<void>;
}

export const AppearanceContext: Context<AppearanceStore | undefined> = createContext();

export class AppearanceService implements AppearanceStore {
    async fetchPages(namespace?: string): Promise<Page[]> {
        const searchParams = new URLSearchParams();

        if (namespace) {
            searchParams.append('namespace', namespace);
        }

        return Api.get(`/appearance/page/all?${searchParams.toString()}`);
    }

    async fetchPage(key: string, namespace?: string): Promise<Page[]> {
        const searchParams = new URLSearchParams();

        if (namespace) {
            searchParams.append('namespace', namespace);
        }

        return Api.get(`/appearance/page/view/${key}?${searchParams.toString()}`);
    }

    async createPage(req: { name: string, key: string, desc: string | null, path: string, namespace: string | null, kind: PageKind, value: string, locale: string | null }): Promise<Page> {
        return Api.post('/appearance/page/create', req);
    }

    async updatePage(key: string, req: { name: string; desc: string | null; }, namespace?: string): Promise<void> {
        const searchParams = namespace ? new URLSearchParams({ namespace }).toString() : '';

        return Api.put(`/appearance/page/update/${key}?${searchParams}`, req);
    }

    async deletePage(key: string, locale: string | null, namespace?: string): Promise<void> {
        const searchParams = new URLSearchParams();

        if (locale) {
            searchParams.append('locale', locale);
        }

        if (namespace) {
            searchParams.append('namespace', namespace);
        }

        return Api.delete(`/appearance/page/delete/${key}?${searchParams.toString()}`);
    }

    async fetchTemplates(namespace?: string): Promise<Template[]> {
        const searchParams = new URLSearchParams();

        if (namespace) {
            searchParams.append('namespace', namespace);
        }

        return Api.get(`/appearance/template/all?${searchParams.toString()}`);
    }

    async fetchTemplate(path: string, kind: Location): Promise<TemplateDetail | undefined> {
        const searchParams = Location.toSearchParams(kind);

        searchParams.append('path', path);

        return Api.get<TemplateDetail>(`/appearance/template/view?${searchParams.toString()}`)
            .catch((e) => {
                if ((e instanceof HttpError) && e.error === 'template_not_found') {
                    return undefined;
                }

                throw e;
            });
    }

    async createTemplate(path: string, template: string, namespace?: string): Promise<void> {
        return Api.post('/appearance/template/create', { path, namespace, template });
    }

    async updateTemplate(path: string, template: string, namespace?: string): Promise<void> {
        return Api.put('/appearance/template/update', { path, namespace, template });
    }

    async deleteTemplate(path: string, namespace?: string): Promise<void> {
        const searchParams = new URLSearchParams();

        searchParams.append('path', path);

        if (namespace) {
            searchParams.append('namespace', namespace);
        }

        return Api.delete(`/appearance/template/delete?${searchParams.toString()}`);
    }

    async fetchThemes(): Promise<Theme[]> {
        return Api.get('/appearance/theme/all');
    }

    async setThemeActive(themeId: string): Promise<void> {
        return Api.put('/appearance/theme/activate', { theme: themeId });
    }

    async uninstallTheme(themeId: string): Promise<void> {
        return Api.delete(`/appearance/theme/uninstall/${themeId}`);
    }
}
