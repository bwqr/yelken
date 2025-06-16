import { type JSX, Show } from "solid-js";

export default function(props: { show: boolean, small?: boolean }): JSX.Element {
    return (
        <Show when={props.show}>
            <div class="spinner-border" classList={{ 'spinner-border-sm': props.small === true }} role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
        </Show>
    );
}
