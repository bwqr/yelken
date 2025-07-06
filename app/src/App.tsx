import { createContext, createResource, For, Match, Show, Suspense, Switch, useContext, type Component, type Context, type JSX, type Resource, type ResourceReturn } from 'solid-js';
import { Router, Route, A } from "@solidjs/router";
import { SideNav } from './Nav';
import Dashboard from './Dashboard';
import { Content, Contents, ContentRoot, ContentsByModel, CreateContent } from './cms/Content';
import EmailLogin from './auth/login/Email';
import { OauthLogin, OauthRedirect } from './auth/login/Oauth';
import * as config from './lib/config';
import { createStore, produce, reconcile } from 'solid-js/store';
import { CMSContext, CMSService, type CMSStore } from './lib/cms/context';
import { UserContext, UserService } from './lib/user/context';
import { AlertContext, CommonContext, CommonService, type AlertStore } from './lib/context';
import { CreateModel, Model, Models } from './cms/Model';
import { CreatePage, Page, Pages } from './appearance/Page';
import { CreateTemplate, TemplateResource, Templates } from './appearance/Template';
import { AdminContext, AdminService } from './lib/admin/context';
import { Check, Exclamation, XCircle } from './Icons';
import { InstallTheme, Themes } from './appearance/Theme';
import { CreateLocale, Locale, LocaleResource, Locales } from './admin/Locale';
import { Dynamic } from 'solid-js/web';
import { CreateRole, Role, Roles } from './admin/Role';
import { CreateUser, User, Users } from './admin/User';
import { Asset, Assets, UploadAsset } from './cms/Asset';
import { AppearanceContext, AppearanceService } from './lib/appearance/context';
import { Settings } from './admin/Settings';
import { Forms } from './cms/Form';

class ServiceProvider {
    private _cmsCtx: ResourceReturn<CMSStore> | undefined;
    private cmsInit: () => Promise<CMSStore>;

    constructor(cmsInit: () => Promise<CMSStore>) {
        this.cmsInit = cmsInit;
    }

    cmsCtx(): Resource<CMSStore> {
        if (this._cmsCtx === undefined) {
            this._cmsCtx = createResource(this.cmsInit);
        }

        return this._cmsCtx[0];
    }
}

const ServiceContext: Context<ServiceProvider | undefined> = createContext();

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
                        <Dynamic component={alert.state === AlertState.Failure ? Exclamation : Check} viewBox="0 0 16 16" />
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
        UserService.fetchUser().then((user) => new UserService(user)),
        Promise.all([CommonService.fetchLocales(), CommonService.fetchNamespaces(), CommonService.fetchOptions()]).then(([locales, namespaces, options]) => new CommonService(locales, namespaces, options))
    ]));

    const cmsInit = () => Promise.all([
        CMSService.fetchModels(),
        CMSService.fetchFields(),
    ])
        .then(([models, fields]) => new CMSService(models, fields));

    return (
        <Suspense fallback={<p>Loading ...</p>}>
            <Switch>
                <Match when={promises.error}>
                    <span>Error: {promises.error.message}</span>
                </Match>
                <Match when={promises()}>
                    {(promises) => {
                        const [userService, commonService] = promises();

                        return (
                            <ServiceContext.Provider value={new ServiceProvider(cmsInit)}>
                                <CommonContext.Provider value={commonService}>
                                    <UserContext.Provider value={userService}>{props.children}</UserContext.Provider>
                                </CommonContext.Provider>
                            </ServiceContext.Provider>
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
                    <div class="d-flex flex-md-row flex-column align-items-md-start" style="min-height: 100vh;">
                        <BackgroundServices>
                            <SideNav />

                            <main class="flex-grow-1 d-flex flex-column">
                                {props.children}
                            </main>
                        </BackgroundServices>
                    </div>
                )}>
                    <Route path="/" component={Dashboard} />
                    <Route path="/profile" component={(_) => <p>Profile</p>} />

                    <Route path="/models" component={(props) => (
                        <Suspense fallback={
                            <p class="icon-link justify-content-center w-100">Loading ...</p>
                        }>
                            <Show when={useContext(ServiceContext)!.cmsCtx()()}>
                                {(ctx) => (
                                    <CMSContext.Provider value={ctx()}>
                                        {props.children}
                                    </CMSContext.Provider>
                                )}
                            </Show>
                        </Suspense>
                    )}>
                        <Route path="/" component={Models} />
                        <Route path="/view/:namespace/:key" component={Model} />
                        <Route path="/view/:key" component={Model} />
                        <Route path="/create" component={CreateModel} />
                    </Route>

                    <Route path="/contents" component={(props) => (
                        <Suspense fallback={
                            <p class="icon-link justify-content-center w-100">Loading ...</p>
                        }>
                            <Show when={useContext(ServiceContext)!.cmsCtx()()}>
                                {(ctx) => (
                                    <CMSContext.Provider value={ctx()}>
                                        {props.children}
                                    </CMSContext.Provider>
                                )}
                            </Show>
                        </Suspense>
                    )}>
                        <Route path="/" component={ContentRoot}>
                            <Route path="/" component={Contents} />
                            <Route path="/by-model/:key" component={ContentsByModel} />
                            <Route path="/by-model/:namespace/:key" component={ContentsByModel} />
                        </Route>

                        <Route path="/view/:id" component={Content} />
                        <Route path="/create/:key" component={CreateContent} />
                        <Route path="/create/:namespace/:key" component={CreateContent} />
                    </Route>

                    <Route path="/assets" component={(props) => (
                        <Suspense fallback={
                            <p class="icon-link justify-content-center w-100">Loading ...</p>
                        }>
                            <Show when={useContext(ServiceContext)!.cmsCtx()()}>
                                {(ctx) => (
                                    <CMSContext.Provider value={ctx()}>
                                        {props.children}
                                    </CMSContext.Provider>
                                )}
                            </Show>
                        </Suspense>
                    )}>
                        <Route path="/" component={Assets} />
                        <Route path="/upload" component={UploadAsset} />
                        <Route path="/view/:id" component={Asset} />
                    </Route>

                    <Route path="/forms" component={(props) => (
                        <Suspense fallback={
                            <p class="icon-link justify-content-center w-100">Loading ...</p>
                        }>
                            <Show when={useContext(ServiceContext)!.cmsCtx()()}>
                                {(ctx) => (
                                    <CMSContext.Provider value={ctx()}>
                                        {props.children}
                                    </CMSContext.Provider>
                                )}
                            </Show>
                        </Suspense>
                    )}>
                        <Route path="/" component={Forms} />
                    </Route>

                    <Route path="/themes" component={(props) => (
                        <AppearanceContext.Provider value={new AppearanceService()}>
                            {props.children}
                        </AppearanceContext.Provider>
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
                        <Route path="/resource/:key/:kind" component={LocaleResource} />
                        <Route path="/resource/:key/:kind/:namespace" component={LocaleResource} />
                        <Route path="/view/:key" component={Locale} />
                        <Route path="/create" component={CreateLocale} />
                    </Route>

                    <Route path="/pages" component={(props) => (
                        <AppearanceContext.Provider value={new AppearanceService()}>
                            {props.children}
                        </AppearanceContext.Provider>
                    )}>
                        <Route path="/" component={Pages} />
                        <Route path="/view/:namespace/:key" component={Page} />
                        <Route path="/view/:key" component={Page} />
                        <Route path="/create" component={CreatePage} />
                    </Route>

                    <Route path="/templates" component={(props) => (
                        <AppearanceContext.Provider value={new AppearanceService()}>
                            {props.children}
                        </AppearanceContext.Provider>
                    )}>
                        <Route path="/" component={Templates} />
                        <Route path="/resource" component={TemplateResource} />
                        <Route path="/resource/:namespace" component={TemplateResource} />
                        <Route path="/create" component={CreateTemplate} />
                    </Route>

                    <Route path="/roles" component={(props) => (
                        <AdminContext.Provider value={new AdminService()}>
                            {props.children}
                        </AdminContext.Provider>
                    )}>
                        <Route path="/" component={Roles} />
                        <Route path="/view/:key" component={Role} />
                        <Route path="/create" component={CreateRole} />
                    </Route>

                    <Route path="/users" component={(props) => (
                        <AdminContext.Provider value={new AdminService()}>
                            {props.children}
                        </AdminContext.Provider>
                    )}>
                        <Route path="/" component={Users} />
                        <Route path="/view/:username" component={User} />
                        <Route path="/create" component={CreateUser} />
                    </Route>

                    <Route path="/settings" component={(props) => (
                        <AdminContext.Provider value={new AdminService()}>
                            {props.children}
                        </AdminContext.Provider>
                    )}>
                        <Route path="/" component={Settings} />
                    </Route>
                </Route>
                <Route path="*404" component={() => (
                    <div class="d-flex justify-content-center align-items-center flex-column" style="height: 100vh">
                        <h1>404</h1>
                        <p>Page not found. Go to <A href="/">Home Page</A>.</p>
                    </div>
                )} />
            </Router>

            <Alerts alerts={alerts} removeAlert={removeAlert} />
        </AlertContext.Provider>
    );
};

export default App;
