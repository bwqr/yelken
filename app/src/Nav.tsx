import { A, useLocation } from "@solidjs/router";
import { type Component, createSignal, For, type JSX, onCleanup, Show, useContext } from "solid-js";
import { Dynamic } from "solid-js/web";
import * as config from './lib/config';
import './Nav.scss';
import { UserContext } from "./lib/user/context";
import { ArrowBarDown, ArrowBarUp, Braces, BoxArrowRight, CardText, Columns, Dashboard, Images, Journals, Person, PersonCircle, Stack, Translate, ShieldLock, PeopleFill } from "./Icons";
import { dropdownClickListener } from "./lib/utils";

export function TopBar(): JSX.Element {
    const userCtx = useContext(UserContext)!;

    const [dropdown, setDropdown] = createSignal(false);

    onCleanup(dropdownClickListener('topbar-dropdown', () => setDropdown(false)));

    return (
        <nav class="navbar px-4 py-2">
            <div class="flex-grow-1">
            </div>

            <div class="dropdown">
                <button
                    class="btn icon-link fs-4"
                    type="button"
                    aria-expanded={dropdown()}
                    on:click={(ev) => { ev.stopPropagation(); setDropdown(!dropdown()) }}
                >
                    <PersonCircle viewBox="0 0 16 16" />
                </button>

                <Show when={dropdown()}>
                    <ul id="topbar-dropdown" class="dropdown-menu mt-1 show shadow" style="right: 0; min-width: 15rem;">
                        <li>
                            <a class="dropdown-item disabled icon-link py-2" aria-disabled="true">
                                <svg class="bi" viewBox="0 0 16 16"></svg>
                                {userCtx.user().name}
                            </a>
                        </li>
                        <li><hr class="dropdown-divider" /></li>
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
        </nav>
    );
}

interface Link {
    title: string,
    href: string,
    icon: Component,
}

export function SideNav(): JSX.Element {
    const location = useLocation();

    const [show, setShow] = createSignal(true);

    const categories: { title?: string, links: Link[] }[] = [
        {
            links: [
                { title: 'Dashboard', href: '/', icon: Dashboard },
            ]
        },
        {
            title: 'CMS',
            links: [
                { title: 'Models', href: '/models', icon: Stack },
                { title: 'Contents', href: '/contents', icon: CardText },
                { title: 'Assets', href: '/assets', icon: Images },
            ]
        },
        {
            title: 'Site Look',
            links: [
                { title: 'Themes', href: '/themes', icon: Columns },
                { title: 'Locales', href: '/locales', icon: Translate },
                { title: 'Templates', href: '/templates', icon: Braces },
                { title: 'Pages', href: '/pages', icon: Journals },
            ]
        },
        {
            title: 'Administration',
            links: [
                { title: 'Roles', href: '/roles', icon: ShieldLock },
                { title: 'Users & Perms', href: '/users', icon: PeopleFill },
            ]
        }
    ];

    return (
        <div class="p-2 vh-100">
            <nav id="sidenav" class="bg-body text-secondary p-2 rounded shadow-sm overflow-auto" classList={{ 'h-100': show() }}>
                <button class="d-sm-none btn icon-link p-2" onClick={() => setShow(!show())}>
                    <Show when={show()}><ArrowBarUp viewBox="0 0 16 16" /></Show>
                    <Show when={!show()}><ArrowBarDown viewBox="0 0 16 16" /></Show>
                </button>

                <div class="px-4 py-2 d-none d-lg-block">
                    <A href="/" class="text-decoration-none fs-4 text-secondary-emphasis">Yelken</A>
                </div>

                <div classList={{ 'd-none': !show() }}>
                    <hr class="mt-0" />

                    <For each={categories}>
                        {(category) => (
                            <>
                                <Show when={category.title}>
                                    <p class="w-100 px-2 text-secondary m-0 text-uppercase d-none d-lg-block" style="font-size: calc(var(--bs-body-font-size) - 0.2rem)">
                                        <b>{category.title}</b>
                                    </p>
                                </Show>

                                <ul class="navbar-nav mb-4">
                                    <For each={category.links}>
                                        {(link) => (
                                            <li class="nav-item">
                                                <A
                                                    href={link.href} class="icon-link nav-link p-2 w-100 rounded my-1"
                                                    aria-current={(link.href === '/' ? link.href === location.pathname : location.pathname.startsWith(link.href)) ? 'page' : false}
                                                    classList={{ 'active': link.href === '/' ? link.href === location.pathname : location.pathname.startsWith(link.href) }}
                                                >
                                                    <Dynamic component={link.icon}  viewBox="0 0 16 16"/>
                                                    <span class="d-none d-lg-block">{link.title}</span>
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
