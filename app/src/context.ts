import { Accessor, Context, ContextProviderComponent, createContext, createSignal, Setter, useContext } from "solid-js";
import { CreateContent, CreateModel, Field, Locale, Model, User } from "./models";
import { Api } from "./api";

export class UserContext {
    private static _ctx: Context<UserContext | undefined> | undefined = undefined;

    public user: Accessor<User>;
    private setUser: Setter<User>;

    private constructor(user: User) {
        [this.user, this.setUser] = createSignal(user);
    }

    public static create(user: User): [UserContext, ContextProviderComponent<UserContext>] {
        if (UserContext._ctx !== undefined) {
            throw ('UserContext is already created');
        }

        UserContext._ctx = createContext();

        return [new UserContext(user), UserContext._ctx.Provider];
    }

    public static ctx(): UserContext {
        if (UserContext._ctx === undefined) {
            throw ('UserContext is not created');
        }

        return useContext(UserContext._ctx!)!;
    }

    public static async fetchUser(): Promise<User> {
        return Api.get('/user/profile');
    }
}

export class ContentContext {
    private static _ctx: Context<ContentContext | undefined> | undefined = undefined;

    fields: Accessor<Field[]>;
    private setFields: Setter<Field[]>;

    models: Accessor<Model[]>;
    private setModels: Setter<Model[]>;

    locales: Accessor<Locale[]>;
    private setLocales: Setter<Locale[]>;

    private constructor() {
        [this.models, this.setModels] = createSignal([] as Model[]);
        [this.fields, this.setFields] = createSignal([] as Field[]);
        [this.locales, this.setLocales] = createSignal([] as Locale[]);
    }

    static create(): [ContentContext, ContextProviderComponent<ContentContext>] {
        if (ContentContext._ctx !== undefined) {
            throw ('UserContext is already created');
        }

        ContentContext._ctx = createContext();

        return [new ContentContext(), ContentContext._ctx.Provider];
    }

    static ctx(): ContentContext {
        if (ContentContext._ctx === undefined) {
            throw ('ContentContext is not created');
        }

        return useContext(ContentContext._ctx!)!;
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
}
