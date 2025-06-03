import { createResource, For, Match, Show, Suspense, Switch, type Component, type JSX } from 'solid-js';
import { Router, Route } from "@solidjs/router";
import { SideNav, TopBar } from './Nav';
import Dashboard from './Dashboard';
import { Content, ContentRoot, Contents, CreateContent } from './content/Content';
import EmailLogin from './auth/login/Email';
import { OauthLogin, OauthRedirect } from './auth/login/Oauth';
import * as config from './lib/config';
import { createStore, produce, reconcile } from 'solid-js/store';
import { ContentContext, ContentService } from './lib/content/context';
import { UserContext, UserService } from './lib/user/context';
import { AlertContext, type AlertStore } from './lib/context';
import { CreateModel, Model, Models } from './content/Model';
import { Pages } from './admin/Page';
import { Template, Templates } from './admin/Template';
import { AdminContext, AdminService } from './lib/admin/context';
import { Check, Exclamation, XCircle } from './Icons';
import { InstallTheme, Themes } from './admin/Theme';
import { CreateLocale, Locale, Locales } from './admin/Locale';
import { Dynamic } from 'solid-js/web';

enum AlertState {
    Success,
    Failure,
}

interface Alert {
    title: string;
    state: AlertState;
}

interface DisposableAlert extends Alert {
    expire: number;
}

function Alerts(props: { alerts: DisposableAlert[], removeAlert: (alert: DisposableAlert) => void }) {
    return <Show when={props.alerts.length > 0}>
        <div style="position: fixed; top: 10vh; right: 2rem; z-index: 99">
            <For each={props.alerts}>
                {(alert) =>
                    <div
                        class="border rounded border-2 px-3 py-3 d-flex mb-2 icon-link"
                        classList={{ 'border-success': alert.state === AlertState.Success, 'border-danger': alert.state === AlertState.Failure }}
                        role="alert"
                        style="background-color: var(--bs-body-bg); min-width: 18rem;"
                    >
                        <Dynamic component={alert.state === AlertState.Failure ? Exclamation : Check} />
                        <span class="flex-grow-1 me-2">{alert.title}</span>
                        <button class="btn p-0 icon-link" onClick={() => props.removeAlert(alert)}>
                            <XCircle viewBox="0 0 16 16" />
                        </button>
                    </div>
                }
            </For>
        </div>
    </Show>
}

const BackgroundServices = (props: { children?: JSX.Element }) => {
    const [promises] = createResource(() => Promise.all([
        UserService.fetchUser(),
        ContentService.fetchModels(),
        ContentService.fetchFields(),
        ContentService.fetchOptions(),
        ContentService.fetchLocales(),
    ]));

    return (
        <Suspense fallback={<p>Loading...</p>}>
            <Switch>
                <Match when={promises.error}>
                    <span>Error: {promises.error.message}</span>
                </Match>
                <Match when={promises()}>
                    {(promises) => {
                        const [user, models, fields, options, locales] = promises();

                        const userService = new UserService(user);
                        const contentService = new ContentService(models, fields, options, locales);

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

    const fireAlert = (state: AlertState, title: string) => {
        const alert: DisposableAlert = {
            expire: new Date().getTime() + timeout,
            title,
            state,
        };

        setAlerts(produce((alerts) => alerts.push(alert)));

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
            <Router base={baseUrl} root={(props) => (
                <>
                    {props.children}
                    <p style="position: fixed; bottom: 0.5rem; right: 0.75rem; padding: 0; margin: 0; font-size: 0.9rem;">Yelken v{config.APP_VERSION}</p>
                </>
            )}>
                <Route path="/auth" component={(props) => (<>{props.children}</>)}>
                    <Route path="/login" component={EmailLogin} />
                    <Route path="/oauth/cloud" component={OauthRedirect} />
                    <Route path="/oauth/login" component={OauthLogin} />
                </Route>

                <Route path="/" component={(props) => (
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
                    <Route path="/profile" component={(_) => <p>Profile</p>} />

                    <Route path="/models" component={(props) => (<>{props.children}</>)}>
                        <Route path="/" component={Models} />
                        <Route path="/view/:namespace/:name" component={Model} />
                        <Route path="/view/:name" component={Model} />
                        <Route path="/create" component={CreateModel} />
                    </Route>

                    <Route path="/contents" component={ContentRoot}>
                        <Route path="/" component={Contents} />
                        <Route path="/view/:id" component={Content} />
                        <Route path="/create" component={CreateContent} />
                    </Route>

                    <Route path="/content" component={ContentRoot}>
                        <Route path="/" component={() => (<></>)} />
                        <Route path="/:namespace/:name/create-content" component={CreateContent} />
                        <Route path="/:name/create-content" component={CreateContent} />
                        <Route path="/:namespace/:name/contents" component={Contents} />
                        <Route path="/:name/contents" component={Contents} />
                        <Route path="/content/:id" component={Content} />
                    </Route>

                    <Route path="/themes" component={(props) => (
                        <AdminContext.Provider value={new AdminService()}>
                            {props.children}
                        </AdminContext.Provider>
                    )}>
                        <Route path="/" component={Themes} />
                        <Route path="/install" component={InstallTheme} />
                    </Route>

                    <Route path="/locales" component={(props) => (
                        <AdminContext.Provider value={new AdminService()}>
                            {props.children}
                        </AdminContext.Provider>
                    )}>
                        <Route path="/" component={Locales} />
                        <Route path="/view/:key" component={Locale} />
                        <Route path="/create" component={CreateLocale} />
                    </Route>

                    <Route path="/pages" component={(props) => (
                        <AdminContext.Provider value={new AdminService()}>
                            {props.children}
                        </AdminContext.Provider>
                    )}>
                        <Route path="/" component={Pages} />
                    </Route>

                    <Route path="/templates" component={(props) => (
                        <AdminContext.Provider value={new AdminService()}>
                            {props.children}
                        </AdminContext.Provider>
                    )}>
                        <Route path="/" component={Templates} />
                        <Route path="/view" component={Template} />
                    </Route>
                </Route>
            </Router>

            <Alerts alerts={alerts} removeAlert={removeAlert} />
        </AlertContext.Provider>
    );
};

export default App;
