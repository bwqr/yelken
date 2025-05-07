import { createResource, For, Match, Show, Suspense, Switch, type Component, type JSX } from 'solid-js';
import { Router, Route } from "@solidjs/router";
import { SideNav, TopBar } from './nav';
import { AlertContext, AlertStore, ContentContext, ContentService, UserContext, UserService } from './context';
import { CreateModel, Model, Models } from './content/model';
import Dashboard from './dashboard';
import { Content, ContentRoot, Contents, CreateContent } from './content/content';
import EmailLogin from './auth/login/email';
import { OauthLogin, OauthRedirect } from './auth/login/oauth';
import * as config from './config';
import { createStore, produce, reconcile } from 'solid-js/store';

export enum AlertState {
    Success,
    Failure,
}

export interface Alert {
    title: string;
    state: AlertState;
}

interface DisposableAlert extends Alert {
    expire: number;
}

function Alerts(props: { alerts: DisposableAlert[], removeAlert: (alert: DisposableAlert) => void }) {
    return <Show when={props.alerts.length > 0}>
        <div style="position: fixed; top: 3vh; right: 2rem; z-index: 99">
            <For each={props.alerts}>
                {alert =>
                    <div
                        class="border rounded border-2 px-3 py-3 d-flex"
                        class:border-success={alert.state === AlertState.Success}
                        class:border-danger={alert.state === AlertState.Failure}
                        role="alert"
                        style="background-color: var(--bs-body-bg); min-width: 18rem;"
                    >
                        <span class="flex-grow-1">{alert.title}</span>
                        <button class="btn p-0 icon-link" onClick={() => props.removeAlert(alert)}>
                            <svg class="bi" viewBox="0 0 16 16" aria-hidden="true">
                                <use href="/node_modules/bootstrap-icons/bootstrap-icons.svg#x-circle" />
                            </svg>
                        </button>
                    </div>
                }
            </For>
        </div>
    </Show>
}

const BackgroundServices = (props: { children?: JSX.Element }) => {
    const contentService = new ContentService();
    const [promises] = createResource(() => Promise.all([
        UserService.fetchUser(),
        contentService.loadFields(),
        contentService.loadLocales(),
        contentService.loadModels()
    ]));

    return (
        <Suspense fallback={<p>Loading...</p>}>
            <Switch>
                <Match when={promises.error}>
                    <span>Error: {promises.error.message}</span>
                </Match>
                <Match when={promises()}>
                    {promises => {
                        const [user] = promises();

                        const userService = new UserService(user);

                        return (
                            <ContentContext.Provider value={contentService}>
                                <UserContext.Provider value={userService}>{props.children}</UserContext.Provider>
                            </ContentContext.Provider>
                        );
                    }}
                </Match>
            </Switch>
        </Suspense>
    );
};

const App: Component = () => {
    let baseUrl = config.BASE_URL;

    // When base is not equal to '/' and it ends with '/', href value for A component turns into `/base//link`.
    // To avoid that, strip '/' from the end. We may need a better solution in the future though.
    if (baseUrl !== '/' && baseUrl.endsWith('/')) {
        baseUrl = baseUrl.slice(0, baseUrl.length - 1);
    }

    const [alerts, setAlerts] = createStore<DisposableAlert[]>([]);
    let timeoutId: NodeJS.Timeout | undefined = undefined;
    const timeout = 5 * 1000;

    const fireAlert = (state: AlertState, title: string) =>{
        const alert: DisposableAlert = {
            expire: new Date().getTime() + timeout,
            title,
            state,
        };

        setAlerts(produce(alerts => alerts.push(alert)));

        if (timeoutId === undefined) {
            timeoutId = setTimeout(cleanAlerts, timeout);
        }
    };

    const alertService: AlertStore = {
        success: (title) => fireAlert(AlertState.Success, title),
        fail: (title) => fireAlert(AlertState.Failure, title),
    };

    function removeAlert(alert: DisposableAlert) {
        const index = alerts.findIndex((a) => a === alert);

        if (index > -1) {
            setAlerts(produce((alerts) => alerts.splice(index, 1)));
        }
    }

    function cleanAlerts() {
        const now = new Date().getTime();

        setAlerts(reconcile(alerts.filter((alert) => alert.expire > now)));
        timeoutId = undefined;

        const earliestExpire = alerts.reduce<number | undefined>((expire, alert) => {
            if (expire === undefined) {
                return alert.expire;
            }

            return alert.expire < expire ? alert.expire : expire;
        }, undefined);

        if (earliestExpire !== undefined) {
            timeoutId = setTimeout(cleanAlerts, earliestExpire - now);
        }
    }

    return (
        <AlertContext.Provider value={alertService}>
            <Router base={baseUrl} root={props => (<>{props.children}</>)}>
                <Route path="/auth" component={props => (<>{props.children}</>)}>
                    <Route path="/login" component={EmailLogin} />
                    <Route path="/oauth/saas" component={OauthRedirect} />
                    <Route path="/oauth/login" component={OauthLogin} />
                </Route>

                <Route path="/" component={props => (
                    <div class="d-flex">
                        <SideNav />

                        <main class="flex-grow-1 d-flex flex-column">
                            <BackgroundServices>
                                <TopBar />

                                {props.children}
                            </BackgroundServices>
                        </main>
                    </div>
                )}>
                    <Route path="/" component={Dashboard} />
                    <Route path="/profile" component={props => <p>Profile</p>} />

                    <Route path="/model" component={props => (<>{props.children}</>)}>
                        <Route path="/models" component={Models} />
                        <Route path="/model/:namespace/:name" component={Model} />
                        <Route path="/model/:name" component={Model} />
                        <Route path="/create-model" component={CreateModel} />
                    </Route>

                    <Route path="/content" component={ContentRoot}>
                        <Route path="/" component={() => (<></>)} />
                        <Route path="/:namespace/:name/create-content" component={CreateContent} />
                        <Route path="/:name/create-content" component={CreateContent} />
                        <Route path="/:namespace/:name/contents" component={Contents} />
                        <Route path="/:name/contents" component={Contents} />
                        <Route path="/content/:id" component={Content} />
                    </Route>
                </Route>
            </Router>

            <Alerts alerts={alerts} removeAlert={removeAlert} />
        </AlertContext.Provider>
    );
};

export default App;
