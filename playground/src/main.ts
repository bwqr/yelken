async function register() {
    if ("serviceWorker" in navigator) {
        try {
            const registration = await navigator.serviceWorker.register("/sw.js", {
                scope: "/",
                type: "module",
            });
            if (registration.installing) {
                console.log("Service worker installing");
            } else if (registration.waiting) {
                console.log("Service worker installed");
            } else if (registration.active) {
                console.log("Service worker active");
            }
        } catch (error) {
            console.error(`Registration failed with ${error}`);
        }
    }
}

register();

// function sendRequest(event: SubmitEvent) {
//     event.preventDefault();

//     const input: HTMLInputElement = document.getElementById('fetch-path')! as HTMLInputElement;

//     fetch(input.value, {
//         headers: { 'Authorization': 'Bearer SomeToken' }
//     })
//         .then((r) => r.text()).then((t) => console.log(t)).catch((e) => console.log(e));

//     return false;
// }

const frame: HTMLIFrameElement = document.getElementById('inner-frame')! as HTMLIFrameElement;
const input: HTMLInputElement = document.getElementById('fetch-path')! as HTMLInputElement;

frame.src = '/playground/';
input.value = '/';

(document.getElementById('send-request')! as HTMLFormElement).addEventListener('submit', (e: SubmitEvent) => {
    e.preventDefault();

    frame.src = `/playground${input.value}`;
});
