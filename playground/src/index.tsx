import { render } from 'solid-js/web';
import { createSignal } from 'solid-js';
import * as config from './config';
import './index.scss';

const App = ({ frame, prefix }: { frame: HTMLIFrameElement, prefix: string }) => {
    const [path, setPath] = createSignal(window.location.hash.replace('#', '') || '/');

    if (frame.src !== `${prefix}${path()}`) {
        frame.src = `${prefix}${path()}`;
    }

    const setFrameSrc = (src: string) => {
        frame.src = `${prefix}${src}`;
    };

    const onSubmit = (ev: SubmitEvent) => {
        ev.preventDefault();

        setFrameSrc(path());
    };

    const onLoad = () => {
        let path = frame.contentWindow?.location.pathname ?? frame.src;

        if (path.startsWith(prefix)) {
            path = path.replace(prefix, '');
        }

        setPath(path);

        if (window.location.hash !== path) {
            window.location.hash = path;
        }
    };

    frame.removeEventListener('load', onLoad);
    frame.addEventListener('load', onLoad);

    return (
        <div class="container" id="controller">
            <form id="navbar" onSubmit={onSubmit}>
                <input id="playground-path" type="text" placeholder="Path" value={path()} onInput={(ev) => setPath(ev.target.value)} />
                <button type="submit" class="btn btn-outline-primary">Load</button>
            </form>
            <div id="navs">
                <button type="button" class="btn btn-link" onClick={() => setFrameSrc('/')}>Home</button>
                <button type="button" class="btn btn-link" onClick={() => setFrameSrc('/yk/app/')}>Dashboard</button>
                <span>Email: <code>{config.USER.email}</code> Password: <code>{config.USER.password}</code></span>
            </div>
        </div>
    );
}

const root = document.getElementById('root');
const frame = document.getElementById('playground-frame') as HTMLIFrameElement;

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
    throw new Error(
        'Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?',
    );
}
if (import.meta.env.DEV && !(frame instanceof HTMLIFrameElement)) {
    throw new Error(
        'Playground frame element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?',
    );
}

render(() => <App frame={frame} prefix={config.PREFIX} />, root!);

(async function register() {
    if ("serviceWorker" in navigator) {
        try {
            const registration = await navigator.serviceWorker.register("/sw.js", {
                scope: "/",
                type: "module",
            });
            if (registration.installing) {
                // Reload iframe to render sw handled page
                navigator.serviceWorker.ready.then(() => frame.src = frame.src);
                console.log("Service worker installing");
            } else if (registration.waiting) {
                // Reload iframe to render sw handled page
                navigator.serviceWorker.ready.then(() => frame.src = frame.src);
                console.log("Service worker installed");
            } else if (registration.active) {
                console.log("Service worker active");
            }

        } catch (error) {
            console.error(`Registration failed with ${error}`);
        }
    }
})();
