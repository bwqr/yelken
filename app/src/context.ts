import { Accessor, Context, createContext, createSignal, Setter } from "solid-js";
import { Content, ContentStage, ContentDetails, CreateContent, CreateModel, Field, Locale, Model, User } from "./models";
import { Api } from "./api";

export interface AlertStore {
    success(title: string): void;
    fail(title: string): void;
}

export const AlertContext: Context<AlertStore | undefined> = createContext();

export interface UserStore {
    user: Accessor<User>,
}

export const UserContext: Context<UserStore | undefined> = createContext();

export class UserService implements UserStore {
    public user: Accessor<User>;

    constructor(user: User) {
        [this.user] = createSignal(user);
    }

    public static async fetchUser(): Promise<User> {
        return Api.get('/user/profile');
    }
}

export interface ContentStore {
    fields: Accessor<Field[]>;
    models: Accessor<Model[]>;
    locales: Accessor<Locale[]>;

    activeLocales(): Locale[];

    loadFields(): Promise<void>;
    loadLocales(): Promise<void>;
    loadModels(): Promise<void>;

    fetchContents(modelId: number): Promise<Content[]>;
    fetchContent(contentId: number): Promise<ContentDetails>;

    createModel(model: CreateModel): Promise<void>;
    createContent(model: CreateContent): Promise<void>;

    updateContentStage(contentId: number, stage: ContentStage): Promise<void>;
}

export const ContentContext: Context<ContentStore | undefined> = createContext();

export class ContentService implements ContentStore {
    fields: Accessor<Field[]>;
    private setFields: Setter<Field[]>;

    models: Accessor<Model[]>;
    private setModels: Setter<Model[]>;

    locales: Accessor<Locale[]>;
    private setLocales: Setter<Locale[]>;

    constructor() {
        [this.models, this.setModels] = createSignal([] as Model[]);
        [this.fields, this.setFields] = createSignal([] as Field[]);
        [this.locales, this.setLocales] = createSignal([] as Locale[]);
    }

    activeLocales(): Locale[] {
        return this.locales().filter(l => !l.disabled);
    }

    async createModel(model: CreateModel): Promise<void> {
        await Api.post('/content/model', model);

        return this.loadModels();
    }

    async createContent(content: CreateContent): Promise<void> {
        return Api.post('/content/content', content);
    }

    async loadFields(): Promise<void> {
        this.setFields(await Api.get('/content/fields'));
    }

    async loadLocales(): Promise<void> {
        this.setLocales(await Api.get('/content/locales'));
    }

    async loadModels(): Promise<void> {
        this.setModels(await Api.get('/content/models'));
    }

    async fetchContents(modelId: number): Promise<Content[]> {
        return Api.get(`/content/contents?modelId=${modelId}`)
    }

    async fetchContent(contentId: number): Promise<ContentDetails> {
        return Api.get(`/content/content/${contentId}`)
    }

    async updateContentStage(contentId: number, stage: ContentStage): Promise<void> {
        return Api.put(`/content/content/${contentId}/stage`, { stage });
    }
}
