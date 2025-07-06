import { A, useLocation } from "@solidjs/router";
import { type Component, createEffect, createSignal, For, type JSX, onCleanup, Show, useContext } from "solid-js";
import { Dynamic } from "solid-js/web";
import * as config from './lib/config';
import { UserContext } from "./lib/user/context";
import { Braces, BoxArrowRight, CardText, Columns, Dashboard, Images, Journals, Person, Stack, Translate, ShieldLock, PeopleFill, List, XLg, GearFill, ClipboardCheckFill } from "./Icons";
import { dropdownClickListener } from "./lib/utils";
import ProfileIcon from "./components/ProfileIcon";
import { Permission } from "./lib/models";

interface Link {
    title: string,
    href: string,
    icon: Component,
}

export function SideNav(): JSX.Element {
    const location = useLocation();
    const userCtx = useContext(UserContext)!;

    const [dropdown, setDropdown] = createSignal(false);
    onCleanup(dropdownClickListener('sidenav-dropdown', () => setDropdown(false)));

    const [show, setShow] = createSignal(false);

    // Close both mobile nav and dropdown when current page changes.
    createEffect(() => {
        if (location.pathname) {
            setDropdown(false);
            setShow(false);
        }
    });

    const categories: { title?: string, links: Link[] }[] = [
        {
            links: [
                { title: 'Dashboard', href: '/', icon: Dashboard },
            ]
        },
    ];

    if (userCtx.user().permissions.includes(Permission.CMSRead)) {
        categories.push(...[
            {
                title: 'CMS',
                links: [
                    { title: 'Models', href: '/models', icon: Stack },
                    { title: 'Contents', href: '/contents', icon: CardText },
                    { title: 'Assets', href: '/assets', icon: Images },
                    { title: 'Forms', href: '/forms', icon: ClipboardCheckFill },
                ]
            },
        ]);
    }

    if (userCtx.user().permissions.includes(Permission.AppearanceRead)) {
        categories.push(...[
            {
                title: 'Appearance',
                links: [
                    { title: 'Themes', href: '/themes', icon: Columns },
                    { title: 'Templates', href: '/templates', icon: Braces },
                    { title: 'Pages', href: '/pages', icon: Journals },
                ]
            },
        ]);
    }

    if (userCtx.user().permissions.includes(Permission.Admin)) {
        categories.push(...[
            {
                title: 'Administration',
                links: [
                    { title: 'Locales', href: '/locales', icon: Translate },
                    { title: 'Roles', href: '/roles', icon: ShieldLock },
                    { title: 'Users & Perms', href: '/users', icon: PeopleFill },
                    { title: 'Settings', href: '/settings', icon: GearFill },
                ]
            },
        ]);
    }

    return (
        <div class="p-md-2 pe-md-0">
            <button class="d-sm-none btn icon-link p-2 float-end" onClick={() => setShow(!show())}>
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
                    <button
                        class="btn icon-link nav-link py-2 px-1 w-100 rounded my-1"
                        type="button"
                        aria-expanded={dropdown()}
                        on:click={(ev) => { ev.stopPropagation(); setDropdown(!dropdown()) }}
                    >
                        <ProfileIcon name={userCtx.user().name} />
                        {userCtx.user().name}
                    </button>

                    <Show when={dropdown()}>
                        <ul id="sidenav-dropdown" class="dropdown-menu mt-1 show shadow highlight-links w-100" style="left: 0;">
                            <li>
                                <A class="dropdown-item icon-link py-2" href="/profile">
                                    <Person viewBox="0 0 16 16" />
                                    Profile
                                </A>
                            </li>
                            <li>
                                <a
                                    class="dropdown-item icon-link py-2"
                                    href={config.resolveURL(config.BASE_URL, '/auth/login')}
                                    on:click={_ => localStorage.removeItem('token')}
                                    rel="external"
                                >
                                    <BoxArrowRight viewBox="0 0 16 16" />

                                    Logout
                                </a>
                            </li>
                        </ul>
                    </Show>
                </div>

                <div class="highlight-links">
                    <For each={categories}>
                        {(category, idx) => (
                            <>
                                <Show when={category.title}>
                                    <p class="w-100 px-2 text-secondary m-0 text-uppercase d-none d-lg-block" style="font-size: calc(var(--bs-body-font-size) - 0.2rem)">
                                        <b>{category.title}</b>
                                    </p>
                                </Show>

                                <ul class="navbar-nav" classList={{ 'mb-4': idx() < categories.length - 1 }}>
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
