import wasmUrl from 'wasm/wasm_bg.wasm?url';
import * as config from './src/config';
import { app_init, serve_request, initSync } from 'wasm';

const origin = new URL(import.meta.url).origin;
const baseUrl = `${origin}${config.PREFIX}`;

const loadingWasmPromise = fetch(wasmUrl)
  .then((resp) => WebAssembly.compileStreaming(resp))
  .then((wasm) => {
    initSync({ module: wasm });
    return app_init(baseUrl, config.USER.name, config.USER.email, config.USER.password);
  })

function sendRequest(request) {
  const header_keys = [];
  const header_values = []

  request.headers.entries().forEach(([key, value]) => {
    header_keys.push(key);
    header_values.push(value);
  });

  return request.bytes()
    .then((bytes) => serve_request(request.method, request.url, header_keys, header_values, bytes));
}

self.addEventListener('install', (event) => {
  console.log('installed');

  event.waitUntil(loadingWasmPromise);
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (!(url.origin === origin && url.pathname.startsWith(config.PREFIX))) {
    return;
  }

  event.respondWith(
    loadingWasmPromise
      .then(() => sendRequest(event.request))
      .catch((e) => console.error(e))
  );
});
