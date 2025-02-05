import { generateHydrationScript, renderToString } from "solid-js/web";
import { JSXElement } from "solid-js";
import App from "./app";
import { Request, Response } from '~/../types/interfaces/yelken-handler-page';

export type ServerProps = { request: Request };

function Server(props: ServerProps): JSXElement {
    return App(props.request)
}

export default function(props: ServerProps): Response {
    const body = renderToString(() => Server(props));

    return {
        head: ['<title>Yelken page</title>', '<meta name="og:title" content="Yelken">', '<link href="/assets/plugins/frontend/client.css" rel="stylesheet">', generateHydrationScript()],
        body: `<div id="app">${body}</div>`,
        scripts: ['<script type="module" async src="/assets/plugins/frontend/client.js"></script>'],
    };
}
