import { A } from "@solidjs/router";
import { type Component, createSignal, For, type JSX, Show, useContext } from "solid-js";
import { Dynamic } from "solid-js/web";
import * as config from './lib/config';
import './Nav.scss';
import { UserContext } from "./lib/user/context";
import { BoxArrowRight, CardText, Dashboard, Journals, KanbanFill, Person, PersonCircle, Stack } from "./Icons";

export function TopBar(): JSX.Element {
    const userCtx = useContext(UserContext)!;

    const [dropdown, setDropdown] = createSignal(false);

    window.document.addEventListener('click', (ev) => {
        let close = true;
        let target = ev.target;

        while (target) {
            if (!(target instanceof HTMLElement)) {
                break;
            }

            if (target.id === 'topbar-dropdown') {
                close = false;
                break;
            }

            target = target.parentElement;
        }

        if (close) {
            setDropdown(false);
        }
    });

    return (
        <nav class="navbar px-4 py-2" style="border-bottom: 1px solid #d8d8d8;">
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
                    <ul class="dropdown-menu mt-1 show shadow" style="right: 0; min-width: 15rem;">
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
    const categories: { title?: string, links: Link[] }[] = [
        {
            links: [
                { title: 'Dashboard', href: '/', icon: Dashboard },
            ]
        },
        {
            title: 'CMS',
            links: [
                { title: 'Models', href: '/model', icon: Stack },
                { title: 'Contents', href: '/content', icon: CardText },
            ]
        },
        {
            title: 'Site Look',
            links: [
                { title: 'Pages', href: '/page', icon: Journals },
                { title: 'Templates', href: '/template', icon: KanbanFill },
            ]
        }
    ];

    return (
        <div class="p-2 vh-100">

            <nav id="sidenav" class="bg-body h-100 text-secondary p-2 rounded shadow-sm">
                <div class="px-4 py-2 d-none d-lg-block">
                    <A href="/" class="text-decoration-none fs-4 text-secondary-emphasis">Yelken</A>
                </div>

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
                                            <A href={link.href} class="icon-link nav-link px-2 py-2 w-100 rounded my-1">
                                                <Dynamic component={link.icon} />
                                                <span class="d-none d-lg-block">{link.title}</span>
                                            </A>
                                        </li>
                                    )}
                                </For>
                            </ul>
                        </>
                    )}
                </For>
            </nav>
        </div>
    );
}
