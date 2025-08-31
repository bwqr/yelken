import { type JSX, Show, useContext } from "solid-js";
import { LocaleContext } from "../lib/i18n";

export default function(props: { show: boolean, small?: boolean }): JSX.Element {
    const localeCtx = useContext(LocaleContext)!;

    return (
        <Show when={props.show}>
            <div class="spinner-border" classList={{ 'spinner-border-sm': props.small === true }} role="status">
                <span class="visually-hidden">{localeCtx.i18n.common.loading()}</span>
            </div>
        </Show>
    );
}
