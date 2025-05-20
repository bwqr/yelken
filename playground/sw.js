import wasmUrl from 'wasm/wasm_bg.wasm?url';
import { app_init, serve_request, initSync } from 'wasm';

const origin = new URL(import.meta.url).origin;
const bypassPaths = [
  '/@vite',
  '/playground',
  '/src',
  '/node_modules',
];

function sendRequest(request) {
  const header_keys = [];
  const header_values = []

  request.headers.entries().forEach(([key, value]) => {
    header_keys.push(key);
    header_values.push(value);
  });

  return request.bytes()
    .then((bytes) => serve_request(request.method, request.url.replace('/playground', ''), header_keys, header_values, bytes));
}

self.addEventListener('install', (event) => {
  console.log('installed');

  event.waitUntil(
    fetch(wasmUrl)
      .then((resp) => resp.bytes())
      .then((wasm) => {
        initSync({ module: wasm });
        return app_init('Yelken User', 'my@email.com', 'password');
      })
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (!(url.origin === origin && url.pathname.startsWith('/playground'))) {
    return;
  }

  console.log('Handling fetch', event.request.url);

  event.respondWith(
    sendRequest(event.request)
      .then((resp) => {
        console.log('Responding with', resp);

        return resp;
      })
      .catch((e) => console.error(e))
  );
});
