import { createContext, createSignal, type Accessor, type Context, type Setter } from "solid-js";
import { BrowserLocale } from "./models";
import { chainedTranslator, flatten, resolveTemplate, translator, type ChainedTranslator, type Flatten } from "@solid-primitives/i18n";
import type * as EN from '../i18n/en';

type Dictionary = Flatten<typeof EN>;

export interface LocaleStore {
    locale: Accessor<BrowserLocale>,

    i18n: ChainedTranslator<Dictionary>,
    dateFormat: Accessor<Intl.DateTimeFormat>,
    dateTimeFormat: Accessor<Intl.DateTimeFormat>,
}

export interface ChangeLocaleStore {
    setLocale(locale: BrowserLocale): Promise<void>,
}

export const LocaleContext: Context<LocaleStore | undefined> = createContext();
export const ChangeLocaleContext: Context<ChangeLocaleStore | undefined> = createContext();

export class LocaleService implements LocaleStore, ChangeLocaleStore {
    readonly locale: Accessor<BrowserLocale>;
    private _setLocale: Setter<BrowserLocale>;

    readonly i18n: ChainedTranslator<Dictionary>;
    private activeI18n: Accessor<Dictionary>;
    private setActiveI18n: Setter<Dictionary>;

    readonly dateTimeFormat: Accessor<Intl.DateTimeFormat>;
    private setDateTimeFormat: Setter<Intl.DateTimeFormat>;

    readonly dateFormat: Accessor<Intl.DateTimeFormat>;
    private setDateFormat: Setter<Intl.DateTimeFormat>;

    private constructor(locale: BrowserLocale, activeI18n: Dictionary) {
        [this.locale, this._setLocale] = createSignal(locale);
        [this.activeI18n, this.setActiveI18n] = createSignal(activeI18n);

        this.i18n = chainedTranslator(activeI18n, translator(() => this.activeI18n(), resolveTemplate));

        [this.dateFormat, this.setDateFormat] = createSignal(Intl.DateTimeFormat(locale, {
            dateStyle: 'medium',
        }));

        [this.dateTimeFormat, this.setDateTimeFormat] = createSignal(Intl.DateTimeFormat(locale, {
            dateStyle: 'medium',
            timeStyle: 'short',
        }));
    }

    async setLocale(locale: BrowserLocale): Promise<void> {
        const i18n = await LocaleService.loadI18n(locale);

        this._setLocale(locale);
        this.setActiveI18n(i18n);

        this.setDateFormat(Intl.DateTimeFormat(locale, {
            dateStyle: 'medium',
        }));

        this.setDateTimeFormat(Intl.DateTimeFormat(locale, {
            dateStyle: 'medium',
            timeStyle: 'short',
        }));

        localStorage.setItem('preferredLocale', locale);
    }

    static async create(locale: BrowserLocale): Promise<LocaleService> {
        return new LocaleService(locale, await LocaleService.loadI18n(locale));
    }

    static detectLocale(): BrowserLocale {
        const preferredLocale = localStorage.getItem('preferredLocale');
        const locale = Object.values(BrowserLocale).find((l) => l === preferredLocale);

        if (locale) {
            return locale;
        }

        if ('navigator' in globalThis) {
            const preferredLocale = globalThis.navigator.language.split('-')[0]
            const locale = Object.values(BrowserLocale).find((l) => l === preferredLocale);

            if (locale) {
                return locale;
            }
        }

        return BrowserLocale.English;
    }

    private static async loadI18n(locale: BrowserLocale): Promise<Dictionary> {
        return import(`../i18n/${locale}.tsx`).then((dict) => flatten(dict as typeof EN));
    }
}
