import { createResource, Match, Suspense, Switch, type Component, type JSX } from 'solid-js';
import { Router, Route } from "@solidjs/router";
import { SideNav, TopBar } from './nav';
import { ContentContext, UserContext } from './context';
import { CreateModel, Model, Models } from './content/model';
import Dashboard from './dashboard';
import { ContentRoot, Contents, CreateContent } from './content/content';
import EmailLogin from './auth/login/email';
import { OauthLogin, OauthRedirect } from './auth/login/oauth';
import * as config from './config';

const BackgroundServices = (props: { children?: JSX.Element }) => {
    const [contentCtx, ContentProvider] = ContentContext.create();
    const [promises] = createResource(() => Promise.all([
        UserContext.fetchUser(),
        contentCtx.loadFields(),
        contentCtx.loadLocales(),
        contentCtx.loadModels()
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

                        const [userContext, UserProvider] = UserContext.create(user);

                        return (
                            <ContentProvider value={contentCtx}>
                                <UserProvider value={userContext}>{props.children}</UserProvider>
                            </ContentProvider>
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

    return (
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
                </Route>
            </Route>
        </Router>
    );
};

export default App;
