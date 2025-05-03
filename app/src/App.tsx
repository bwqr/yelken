import { createResource, Match, Suspense, Switch, type Component, type JSX } from 'solid-js';
import { Router, Route } from "@solidjs/router";
import { SideNav, TopBar } from './nav';
import { ContentContext, UserContext } from './context';
import { CreateModel, Model, Models } from './content/model';
import Dashboard from './dashboard';
import { Contents } from './content/content';
import EmailLogin from './auth/login/email';
import { OauthLogin, OauthRedirect } from './auth/login/oauth';

const BackgroundServices = (props: { children?: JSX.Element }) => {
    const [contentContext, ContentProvider] = ContentContext.create();
    const [promises] = createResource(() => Promise.all([UserContext.fetchUser(), contentContext.loadModels(), contentContext.loadFields()]));

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
                            <ContentProvider value={contentContext}>
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
    return (
        <Router root={props => (<>{props.children}</>)}>
            <Route path="/auth" component={props => (<>{props.children}</>)}>
                <Route path="/login" component={EmailLogin} />
                <Route path="/oauth/saas" component={OauthRedirect} />
                <Route path="/oauth/login" component={OauthLogin} />
            </Route>

            <Route path="/" component={props => (
                <div class="d-flex">
                    <SideNav />

                    <main class="flex-grow-1">
                        <BackgroundServices>
                            <TopBar />

                            {props.children}
                        </BackgroundServices>
                    </main>
                </div>
            )}>
                <Route path="/" component={Dashboard} />

                <Route path="/content" component={props => (<>{props.children}</>)}>
                    <Route path="/contents" component={Contents} />
                    <Route path="/create-model" component={CreateModel} />
                    <Route path="/models" component={Models} />
                    <Route path="/model/:namespace/:name" component={Model} />
                    <Route path="/model/:name" component={Model} />
                </Route>
            </Route>
        </Router>
    );
};

export default App;
