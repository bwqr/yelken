import { A, useLocation } from "@solidjs/router";
import { type Component, createEffect, createMemo, createSignal, For, type JSX, onCleanup, Show, useContext } from "solid-js";
import { Dynamic } from "solid-js/web";
import config from './lib/config';
import { UserContext } from "./lib/user/context";
import { Braces, BoxArrowRight, CardText, Columns, Dashboard, Images, Journals, Person, Stack, Translate, ShieldLock, PeopleFill, List, XLg, GearFill, Moon } from "./Icons";
import { dropdownClickListener } from "./lib/utils";
import ProfileIcon from "./components/ProfileIcon";
import { BrowserLocale, Permission } from "./lib/models";
import { ChangeLocaleContext, LocaleContext } from "./lib/i18n";
import * as theme from "./theme";

interface Link {
    title: string,
    href: string,
    icon: Component,
}

enum Dropdown {
    Profile,
    Locale,
    Theme,
}

export function SideNav(): JSX.Element {
    const changeLocaleCtx = useContext(ChangeLocaleContext)!;
    const location = useLocation();
    const localeCtx = useContext(LocaleContext)!;
    const userCtx = useContext(UserContext)!;

    const i18n = localeCtx.i18n.nav;

    const [dropdown, setDropdown] = createSignal(undefined as Dropdown | undefined);
    onCleanup(dropdownClickListener('sidenav-dropdown', () => dropdown() === Dropdown.Profile && setDropdown(undefined)));
    onCleanup(dropdownClickListener('locale-dropdown', () => dropdown() === Dropdown.Locale && setDropdown(undefined)));
    onCleanup(dropdownClickListener('theme-dropdown', () => dropdown() === Dropdown.Theme && setDropdown(undefined)));

    const [colorMode, setColorMode] = createSignal(theme.getColorMode() ?? theme.ColorMode.Auto);
    createEffect(() => theme.updateColorMode(colorMode()));

    const [show, setShow] = createSignal(false);

    // Close both mobile nav and dropdown when current page changes.
    createEffect(() => {
        if (location.pathname) {
            setDropdown(undefined);
            setShow(false);
        }
    });

    const categories = createMemo(() => {
        const user = userCtx.user();
        const categories: { title?: string, links: Link[] }[] = [
            {
                links: [
                    { title: i18n.links.dashboard(), href: '/', icon: Dashboard },
                ]
            },
        ];

        if (user.permissions.includes(Permission.CMSRead)) {
            categories.push(...[
                {
                    title: 'CMS',
                    links: [
                        { title: i18n.links.models(), href: '/models', icon: Stack },
                        { title: i18n.links.contents(), href: '/contents', icon: CardText },
                        { title: i18n.links.assets(), href: '/assets', icon: Images },
                    ]
                },
            ]);
        }

        if (user.permissions.includes(Permission.AppearanceRead)) {
            categories.push(...[
                {
                    title: i18n.links.appearance(),
                    links: [
                        { title: i18n.links.themes(), href: '/themes', icon: Columns },
                        { title: i18n.links.templates(), href: '/templates', icon: Braces },
                        { title: i18n.links.pages(), href: '/pages', icon: Journals },
                    ]
                },
            ]);
        }

        if (user.permissions.includes(Permission.Admin)) {
            categories.push(...[
                {
                    title: i18n.links.admin(),
                    links: [
                        { title: i18n.links.locales(), href: '/locales', icon: Translate },
                        { title: i18n.links.roles(), href: '/roles', icon: ShieldLock },
                        { title: i18n.links.usersPerms(), href: '/users', icon: PeopleFill },
                        { title: i18n.links.settings(), href: '/settings', icon: GearFill },
                    ]
                },
            ]);
        }

        return categories;
    });

    return (
        <div class="p-md-2 pe-md-0">
            <button class="d-sm-none btn icon-link p-2 float-end fs-2" onClick={() => setShow(!show())}>
                <Show when={show()}><XLg viewBox="0 0 16 16" width="12" height="12" /></Show>
                <Show when={!show()}><List viewBox="0 0 16 16" width="12" height="12" /></Show>
            </button>

            <nav
                id="sidenav"
                class="p-2 rounded shadow-sm border d-none d-md-block"
                style={`${show() ? 'display: block !important;' : ''} background: linear-gradient(to bottom, var(--custom-bg), color-mix(in srgb, var(--custom-bg) 50%, var(--bs-primary-bg-subtle) 50%));`}
            >

                <div class="px-4 py-1">
                    <A href="/" class="text-decoration-none fs-3 text-secondary-emphasis">Yelken</A>
                </div>

                <hr />

                <div class="dropdown">
                    <div class="d-flex gap-4 justify-content-center">
                        <button
                            class="btn icon-link nav-link py-2 px-1 rounded fs-5"
                            type="button"
                            aria-expanded={dropdown() === Dropdown.Locale}
                            on:click={(ev) => { ev.stopPropagation(); dropdown() === Dropdown.Locale ? setDropdown(undefined) : setDropdown(Dropdown.Locale) }}
                        >
                            <Translate viewBox="0 0 16 16" />
                        </button>

                        <button
                            class="btn icon-link nav-link py-2 px-1 rounded fs-5"
                            type="button"
                            aria-expanded={dropdown() === Dropdown.Theme}
                            on:click={(ev) => { ev.stopPropagation(); dropdown() === Dropdown.Theme ? setDropdown(undefined) : setDropdown(Dropdown.Theme) }}
                        >
                            <Moon viewBox="0 0 16 16" />
                        </button>
                    </div>

                    <ul id="locale-dropdown" class="dropdown-menu mt-1 shadow highlight-links w-100" classList={{ 'show': dropdown() === Dropdown.Locale }} style="left: 0;">
                        <For each={Object.values(BrowserLocale)}>
                            {(locale) => (
                                <li>
                                    <button class="dropdown-item" classList={{ 'active': localeCtx.locale() === locale }} onClick={() => { changeLocaleCtx.setLocale(locale); setDropdown(undefined); }}>
                                        {LOCALES[locale]}
                                    </button>
                                </li>
                            )}
                        </For>
                    </ul>

                    <ul id="theme-dropdown" class="dropdown-menu mt-1 shadow highlight-links w-100" classList={{ 'show': dropdown() === Dropdown.Theme }} style="left: 0;">
                        <For each={Object.values(theme.ColorMode)}>
                            {(mode) => (
                                <li>
                                    <button class="dropdown-item" classList={{ 'active': colorMode() === mode }} onClick={() => { setColorMode(mode); setDropdown(undefined); }}>
                                        {i18n.colorModes[mode]()}
                                    </button>
                                </li>
                            )}
                        </For>
                    </ul>
                </div>

                <div class="dropdown">
                    <button
                        class="btn icon-link nav-link py-2 px-1 w-100 rounded my-1"
                        type="button"
                        aria-expanded={dropdown() === Dropdown.Profile}
                        on:click={(ev) => { ev.stopPropagation(); dropdown() === Dropdown.Profile ? setDropdown(undefined) : setDropdown(Dropdown.Profile) }}
                    >
                        <ProfileIcon name={userCtx.user().name} />
                        {userCtx.user().name}
                    </button>

                    <ul id="sidenav-dropdown" class="dropdown-menu mt-1 shadow highlight-links w-100" classList={{ 'show': dropdown() === Dropdown.Profile }} style="left: 0;">
                        <li>
                            <A class="dropdown-item icon-link py-2" href="/profile">
                                <Person viewBox="0 0 16 16" />
                                {i18n.profile.profile()}
                            </A>
                        </li>
                        <li>
                            <a
                                class="dropdown-item icon-link py-2"
                                href={config.resolveBaseUrl('/auth/login')}
                                on:click={_ => localStorage.removeItem('token')}
                                rel="external"
                            >
                                <BoxArrowRight viewBox="0 0 16 16" />
                                {i18n.profile.logout()}
                            </a>
                        </li>
                    </ul>
                </div>

                <div class="highlight-links">
                    <For each={categories()}>
                        {(category, idx) => (
                            <>
                                <Show when={category.title}>
                                    <p class="w-100 px-2 text-secondary m-0 text-uppercase d-none d-lg-block" style="font-size: calc(var(--bs-body-font-size) - 0.2rem)">
                                        <b>{category.title}</b>
                                    </p>
                                </Show>

                                <ul class="navbar-nav" classList={{ 'mb-4': idx() < categories().length - 1 }}>
                                    <For each={category.links}>
                                        {(link) => (
                                            <li class="nav-item">
                                                <A
                                                    href={link.href} class="icon-link nav-link p-2 w-100 rounded my-1"
                                                    aria-current={(link.href === '/' ? link.href === location.pathname : location.pathname.startsWith(link.href)) ? 'page' : false}
                                                    classList={{ 'active': link.href === '/' ? link.href === location.pathname : location.pathname.startsWith(link.href) }}
                                                >
                                                    <Dynamic component={link.icon} viewBox="0 0 16 16" />
                                                    {link.title}
                                                </A>
                                            </li>
                                        )}
                                    </For>
                                </ul>
                            </>
                        )}
                    </For>
                </div>
            </nav>
        </div>
    );
}


const LOCALES = {
    [BrowserLocale.English]: 'English',
    [BrowserLocale.Turkish]: 'Türkçe',
};
