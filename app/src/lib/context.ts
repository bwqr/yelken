import type { Accessor, Context, Setter } from 'solid-js';
import { createContext, createSignal } from "solid-js";
import type { Locale, Options } from './models';
import { Api } from './api';

export interface AlertStore {
    success(title: string): void;
    fail(title: string): void;
}

export const AlertContext: Context<AlertStore | undefined> = createContext();

export interface BaseStore {
    options: Accessor<Options>;
    loadOptions(): Promise<void>;

    locales: Accessor<Locale[]>,
    loadLocales(): Promise<void>;
    activeLocales(): Locale[];
}

export const BaseContext: Context<BaseStore | undefined> = createContext();

export class BaseService implements BaseStore {
    locales: Accessor<Locale[]>;
    private setLocales: Setter<Locale[]>;

    options: Accessor<Options>;
    private setOptions: Setter<Options>;

    constructor(locales: Locale[], options: Options) {
        [this.locales, this.setLocales] = createSignal(locales);
        [this.options, this.setOptions] = createSignal(options);
    }

    activeLocales(): Locale[] {
        return this.locales().filter((l) => !l.disabled);
    }

    async loadLocales(): Promise<void> {
        this.setLocales(await BaseService.fetchLocales());
    }

    async loadOptions(): Promise<void> {
        this.setOptions(await BaseService.fetchOptions());
    }

    static async fetchLocales(): Promise<Locale[]> {
        return Api.get('/content/locales');
    }

    static async fetchOptions(): Promise<Options> {
        return Api.get('/content/options');
    }
}
