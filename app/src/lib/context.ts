import type { Accessor, Context, Setter } from 'solid-js';
import { createContext, createSignal } from "solid-js";
import type { Locale, Namespace, Options } from './models';
import { Api } from './api';

export interface CommonStore {
    locales: Accessor<Locale[]>,
    loadLocales(): Promise<void>;
    activeLocales(): Locale[];

    namespaces: Accessor<Namespace[]>;
    loadNamespaces(): Promise<void>;

    options: Accessor<Options>;
    loadOptions(): Promise<void>;
}

export const CommonContext: Context<CommonStore | undefined> = createContext();

export class CommonService implements CommonStore {
    locales: Accessor<Locale[]>;
    private setLocales: Setter<Locale[]>;

    options: Accessor<Options>;
    private setOptions: Setter<Options>;

    namespaces: Accessor<Namespace[]>;
    private setNamespaces: Setter<Namespace[]>;

    constructor(locales: Locale[], namespaces: Namespace[], options: Options) {
        [this.locales, this.setLocales] = createSignal(locales);
        [this.namespaces, this.setNamespaces] = createSignal(namespaces);
        [this.options, this.setOptions] = createSignal(options);
    }

    activeLocales(): Locale[] {
        return this.locales().filter((l) => !l.disabled);
    }

    async loadLocales(): Promise<void> {
        this.setLocales(await CommonService.fetchLocales());
    }

    async loadNamespaces(): Promise<void> {
        this.setNamespaces(await CommonService.fetchNamespaces());
    }

    async loadOptions(): Promise<void> {
        this.setOptions(await CommonService.fetchOptions());
    }

    static async fetchLocales(): Promise<Locale[]> {
        return Api.get('/common/locales');
    }

    static async fetchNamespaces(): Promise<Namespace[]> {
        return Api.get('/common/namespaces');
    }

    static async fetchOptions(): Promise<Options> {
        return Api.get('/common/options');
    }
}
