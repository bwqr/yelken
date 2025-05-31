import { A } from "@solidjs/router";
import { type Component, createSignal, For, type JSX, Show, useContext } from "solid-js";
import { Dynamic } from "solid-js/web";
import * as config from './lib/config';
import PersonCircle from 'bootstrap-icons/icons/person-circle.svg';
import Person from 'bootstrap-icons/icons/person.svg';
import BoxArrowRight from 'bootstrap-icons/icons/box-arrow-right.svg';
import Dashboard from 'bootstrap-icons/icons/speedometer2.svg';
import Stack from 'bootstrap-icons/icons/stack.svg';
import Journals from 'bootstrap-icons/icons/journals.svg';
import CardText from 'bootstrap-icons/icons/card-text.svg';
import Kanban from 'bootstrap-icons/icons/kanban.svg';
import './Nav.scss';
import { UserContext } from "./lib/user/context";

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
                { title: 'Templates', href: '/template', icon: Kanban },
            ]
        }
    ];

    return (
        <div class="p-2 vh-100">

            <nav id="sidenav" class="h-100 bg-body text-secondary p-2 rounded shadow-sm" style="width: 14rem;">
                <div class="px-4 py-2">
                    <A href="/" class="text-decoration-none fs-4 text-secondary-emphasis">Yelken</A>
                </div>

                <hr />

                <For each={categories}>
                    {(category) => (
                        <>
                            <Show when={category.title}>
                                <p class="pe-5 text-secondary ps-3 m-0 text-uppercase" style="font-size: calc(var(--bs-body-font-size) - 0.2rem)"><b>{category.title}</b></p>
                            </Show>

                            <ul class="navbar-nav mb-4">
                                <For each={category.links}>
                                    {(link) => (<li class="nav-item"><A href={link.href} class="icon-link nav-link ps-3 pe-5 py-2 w-100 rounded my-1"><Dynamic component={link.icon} />{link.title}</A></li>)}
                                </For>
                            </ul>
                        </>
                    )}
                </For>
            </nav>
        </div>
    );
}
