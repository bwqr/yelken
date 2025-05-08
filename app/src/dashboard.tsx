import { Component, JSX, useContext } from "solid-js";
import { UserContext } from "./context";

export default function Dashboard(): JSX.Element {
    const userCtx = useContext(UserContext)!;

    return (
        <div class="container mt-4">
            <div class="row">
                <div class="col-6">
                    <div class="rounded bg-primary-subtle p-3">
                        <p class="m-0">You have logged in {userCtx.user().name}</p>
                    </div>
                </div>
                <div class="col-6">
                    <div class="rounded bg-primary-subtle p-3">
                        <p class="m-0">It is a good day to start</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
