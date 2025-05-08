import { A } from "@solidjs/router";
import { createSignal, For, JSX, Show, useContext } from "solid-js";
import { UserContext } from "./context";
import * as config from './config';
import PersonCircle from 'bootstrap-icons/icons/person-circle.svg';
import Person from 'bootstrap-icons/icons/person.svg';
import BoxArrowRight from 'bootstrap-icons/icons/box-arrow-right.svg';

export function TopBar(): JSX.Element {
    const userCtx = useContext(UserContext)!;

    const [dropdown, setDropdown] = createSignal(false);

    window.document.addEventListener('click', () => setDropdown(false));

    return (
        <nav class="navbar px-4 py-2" style="border-bottom: 1px solid #d8d8d8;">
            <div class="flex-grow-1">
            </div>

            <div class="dropdown">
                <button
                    class="btn icon-link fs-4"
                    type="button"
                    aria-expanded={dropdown()}
                    on:click={ev => { ev.stopPropagation(); setDropdown(!dropdown()) }}
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

export function SideNav(): JSX.Element {
    const links = [
        { title: 'Dashboard', href: '/' },
        { title: 'Models', href: '/model' },
        { title: 'Contents', href: '/content' },
        { title: 'Plugin Manager', href: '/plugin-manager' },
        { title: 'Settings', href: '/settings' },
    ];

    return (
        <nav id="sidenav" class="vh-100 text-secondary" style="width: 12rem; border-right: 1px solid #d8d8d8">
            <div class="px-4 py-2">
                <A href="/" class="text-decoration-none fs-4 text-secondary-emphasis">Yelken</A>
            </div>

            <p class="pe-5 text-secondary ps-3 m-0 text-uppercase" style="font-size: calc(var(--bs-body-font-size) - 0.2rem)"><b>Apps</b></p>
            <ul class="navbar-nav mb-4">
                <For each={links}>
                    {link => (<li class="nav-item"><A href={link.href} class="nav-link d-block ps-3 pe-5 py-2">{link.title}</A></li>)}
                </For>
            </ul>

            <p class="pe-5 text-secondary ps-3 m-0 text-uppercase" style="font-size: calc(var(--bs-body-font-size) - 0.2rem)"><b>Plugins</b></p>
        </nav>
    );
}
