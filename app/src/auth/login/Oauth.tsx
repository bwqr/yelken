import { useSearchParams } from "@solidjs/router";
import { createSignal, Show } from "solid-js";
import * as config from "../../lib/config";

const STATE_LENGTH = 32;
const STATE_KEY = 'oauth_state';
const TIMEOUT = 1000 * 60 * 5;

type OauthState = { state: string; timestamp: number };

// https://stackoverflow.com/a/27747377
function generateState(length: number) {
    function dec2hex(dec: number) {
        return dec.toString(16).padStart(2, '0');
    }

    var arr = new Uint8Array(length / 2);
    crypto.getRandomValues(arr);
    return Array.from(arr, dec2hex).join('');
}

export const OauthRedirect = () => {
    const state = generateState(STATE_LENGTH);

    const oauthState: OauthState = {
        state,
        timestamp: new Date().getTime()
    };

    localStorage.setItem(STATE_KEY, JSON.stringify(oauthState));

    window.location.assign(config.resolveURL(config.API_URL, `/auth/oauth/redirect?state=${state}`))

    return (<></>);
}

function finishOauth(params: Record<string, string | string[] | undefined>) {
    const item = localStorage.getItem(STATE_KEY);

    if (item === null) {
        throw new Error('state_not_found');
    }

    let stateObject: OauthState;

    try {
        stateObject = JSON.parse(item);
    } catch (e) {
        throw new Error('invalid_state');
    }

    if (typeof stateObject.state !== 'string' || typeof stateObject.timestamp !== 'number') {
        throw new Error('invalid_state');
    }

    if (stateObject.timestamp < new Date().getTime() - TIMEOUT) {
        throw new Error('expired_state');
    }

    if (params.state !== stateObject.state) {
        throw new Error('mismatched_state');
    }

    if (typeof params.token !== 'string') {
        throw new Error('missing_token_in_query');
    }

    localStorage.setItem('token', params.token);
    localStorage.removeItem(STATE_KEY);
}

export const OauthLogin = () => {
    const [error, setError] = createSignal(undefined as string | undefined);
    const [searchParams] = useSearchParams();

    try {
        finishOauth(searchParams);

        window.location.assign(config.BASE_URL);
    } catch (e) {
        setError(`${e}`);
    }
    return (
        <Show when={error()}>
            {(e) => <p>Failed to login {e()}</p>}
        </Show>
    );
}
