import { type JSX, useContext } from "solid-js";
import { UserContext } from "./lib/user/context";
import { LocaleContext } from "./lib/i18n";

export default function Dashboard(): JSX.Element {
    const userCtx = useContext(UserContext)!;

    const i18n = useContext(LocaleContext)!.i18n.dashboard;

    return (
        <div class="container py-4 px-md-4">
            <div class="row gap-2 gap-sm-0">
                <div class="col-md-6">
                    <div class="rounded bg-primary-subtle p-3">
                        <p class="m-0">{i18n.loggedIn(userCtx.user().name)}</p>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="rounded bg-primary-subtle p-3">
                        <p class="m-0">{i18n.welcome()}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
