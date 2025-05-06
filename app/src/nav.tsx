import { A } from "@solidjs/router";
import { createSignal, For, JSX, Show } from "solid-js";
import { UserContext } from "./context";
import * as config from './config';

export function TopBar(): JSX.Element {
    const userCtx = UserContext.ctx();

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
                    <svg class="bi" viewBox="0 0 16 16" aria-hidden="true">
                        <use href="/node_modules/bootstrap-icons/bootstrap-icons.svg#person-circle" />
                    </svg>
                </button>

                <Show when={dropdown()}>
                    <ul class="dropdown-menu mt-1 show shadow" style="right: 0; min-width: 250px;">
                        <li>
                            <a class="dropdown-item disabled icon-link py-2" aria-disabled="true">
                                <svg class="bi" viewBox="0 0 16 16" aria-hidden="true"></svg>
                                {userCtx.user().name}
                            </a>
                        </li>
                        <li><hr class="dropdown-divider" /></li>
                        <li>
                            <A class="dropdown-item icon-link py-2" href="/profile">
                                <svg class="bi" viewBox="0 0 16 16" aria-hidden="true">
                                    <use href="/node_modules/bootstrap-icons/bootstrap-icons.svg#person" />
                                </svg>
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
                                <svg class="bi" viewBox="0 0 16 16" aria-hidden="true">
                                    <use href="/node_modules/bootstrap-icons/bootstrap-icons.svg#box-arrow-right" />
                                </svg>

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
        { title: 'Models', href: '/model/models' },
        { title: 'Contents', href: '/content' },
        { title: 'Plugin Manager', href: '/plugin-manager' },
        { title: 'Settings', href: '/settings' },
    ];

    return (
        <nav id="sidenav" class="vh-100 text-secondary" style="width: 200px; border-right: 1px solid #d8d8d8">
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
