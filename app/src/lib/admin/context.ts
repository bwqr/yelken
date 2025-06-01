import { createContext, type Context } from "solid-js";
import { Api } from "../api";
import { LocationKind, type Page, type Template, type TemplateDetails } from "./models";

export interface AdminStore {
    fetchPages(): Promise<Page[]>
    fetchTemplates(): Promise<Template[]>
    fetchTemplate(path: string, kind: LocationKind): Promise<TemplateDetails>
    updateTemplate(path: string, kind: LocationKind, template: string): Promise<void>;
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
}
