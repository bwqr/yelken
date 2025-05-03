import { A } from "@solidjs/router";
import { createSignal, For, JSX, Show } from "solid-js";
import { UserContext } from "./context";

export function TopBar(): JSX.Element {
    const userCtx = UserContext.ctx();

    const [dropdown, setDropdown] = createSignal(false);

    const onSwitch = () => { console.log('switched') };

    window.document.addEventListener('click', () => setDropdown(false));

    return (
        <nav class="navbar px-4 py-3 mb-4">
            <div class="flex-grow-1">
                <button class="btn btn-secondary" onClick={onSwitch}>Change Language</button>
            </div>

            <div class="dropdown">
                <button
                    class="btn border border-2 border-primary-subtle"
                    type="button"
                    aria-expanded={dropdown()}
                    on:click={ev => { ev.stopPropagation(); setDropdown(!dropdown()) }}
                >
                    {userCtx.user().name}
                </button>

                <Show when={dropdown()}>
                    <ul class="dropdown-menu mt-1 show" style="right: 0;" on:click={ev => ev.stopPropagation()}>
                        <li>
                            <a
                                class="dropdown-item"
                                href="/auth/login"
                                on:click={_ => localStorage.removeItem('token')}
                                rel="external"
                            >Logout</a>
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
        { title: 'Models', href: '/content/models' },
        { title: 'Contents', href: '/content/contents' },
        { title: 'Plugin Manager', href: '/plugin-manager' },
        { title: 'Settings', href: '/settings' },
    ];

    return (
        <nav id="sidenav" class="vh-100 text-secondary" style="background-color: #ffdabd;">
            <div class="px-4 py-4 mb-2">
                <A href="/" class="text-decoration-none fs-4 text-secondary-emphasis">Yelken</A>
            </div>

            <p class="pe-5 text-secondary ps-3 m-0 text-uppercase" style="font-size: calc(var(--bs-body-font-size) - 0.2rem)"><b>Apps</b></p>
            <ul class="navbar-nav mb-4">
                <For each={links}>
                    {(link) => (<li class="nav-item"><A href={link.href} class="nav-link d-block ps-3 pe-5 py-2">{link.title}</A></li>)}
                </For>
            </ul>

            <p class="pe-5 text-secondary ps-3 m-0 text-uppercase" style="font-size: calc(var(--bs-body-font-size) - 0.2rem)"><b>Plugins</b></p>
        </nav>
    );
}
