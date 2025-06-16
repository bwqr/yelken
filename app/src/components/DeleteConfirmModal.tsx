import { createSignal, Show, useContext, type JSX } from "solid-js";
import ProgressSpinner from "./ProgressSpinner";
import { HttpError } from "../lib/api";
import { AlertContext } from "../lib/context";

export default function(props: {
    close: () => void,
    confirm: () => Promise<void> | void,
    message: JSX.Element,
}): JSX.Element {
    const alertCtx = useContext(AlertContext)!;

    const [inProgress, setInProgress] = createSignal(false);

    const [serverError, setServerError] = createSignal(undefined as string | undefined);

    const close = () => {
        if (inProgress()) {
            return;
        }

        props.close();
    }

    const confirm = () => {
        if (inProgress()) {
            return;
        }

        setServerError(undefined);

        const promise = props.confirm();

        if (promise instanceof Promise) {
            setInProgress(true);

            promise
                .catch((e) => {
                    if (e instanceof HttpError) {
                        setServerError(e.error);
                    } else {
                        alertCtx.fail(e.message);
                    }
                })
                .finally(() => setInProgress(false));
        }
    };

    return (
        <>
            <div class="modal show d-block" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Delete Confirm</h5>
                        </div>
                        <div class="modal-body">
                            {props.message}

                            <Show when={serverError()}>
                                <small class="text-danger my-2">{serverError()}</small>
                            </Show>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-outline-secondary" onClick={close} disabled={inProgress()}>Cancel</button>
                            <button type="button" class="btn btn-danger icon-link" onClick={confirm} disabled={inProgress()}>
                                <ProgressSpinner show={inProgress()} />
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="modal-backdrop fade show"></div>
        </>
    );
}
