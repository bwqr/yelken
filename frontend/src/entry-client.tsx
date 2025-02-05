import { hydrate, render } from "solid-js/web";
import App from "./app";

export default function runClient() {
  hydrate(() => App({ url: 'hello world' }), document.getElementById("app")!);
}
