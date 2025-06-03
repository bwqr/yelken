import { type JSX, useContext } from "solid-js";
import { UserContext } from "./lib/user/context";

export default function Dashboard(): JSX.Element {
    const userCtx = useContext(UserContext)!;

    return (
        <div class="container py-4 px-md-4">
            <div class="row gap-2 gap-sm-0">
                <div class="col-md-6">
                    <div class="rounded bg-primary-subtle p-3">
                        <p class="m-0">You have logged in {userCtx.user().name}</p>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="rounded bg-primary-subtle p-3">
                        <p class="m-0">It is a good day to start</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
