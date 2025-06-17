import { A, useLocation } from "@solidjs/router";
import { type Component, createSignal, For, type JSX, onCleanup, Show, useContext } from "solid-js";
import { Dynamic } from "solid-js/web";
import * as config from './lib/config';
import { UserContext } from "./lib/user/context";
import { ArrowBarDown, ArrowBarUp, Braces, BoxArrowRight, CardText, Columns, Dashboard, Images, Journals, Person, Stack, Translate, ShieldLock, PeopleFill } from "./Icons";
import { dropdownClickListener } from "./lib/utils";
import ProfileIcon from "./components/ProfileIcon";

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
        <div class="p-2 pe-0" style="min-height: 100vh">
            <nav id="sidenav" class="p-2 rounded shadow-sm border" classList={{ 'h-100': show() }} style="background: linear-gradient(to bottom, var(--custom-bg), color-mix(in srgb, var(--custom-bg) 50%, var(--bs-primary-bg-subtle) 50%));">
                <button class="d-sm-none btn icon-link p-2" onClick={() => setShow(!show())}>
                    <Show when={show()}><ArrowBarUp viewBox="0 0 16 16" /></Show>
                    <Show when={!show()}><ArrowBarDown viewBox="0 0 16 16" /></Show>
                </button>

                <div class="px-4 py-2 d-none d-lg-block">
                    <A href="/" class="text-decoration-none fs-4 text-secondary-emphasis">Yelken</A>
                </div>

                <hr class="" />

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

                <div class="highlight-links" classList={{ 'd-none': !show() }}>
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
                                                    <Dynamic component={link.icon} viewBox="0 0 16 16" />
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
