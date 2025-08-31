import { A } from "@solidjs/router";
import { ColorMode } from "../theme";

export const auth = {
    login: {
        title: 'Log in to Yelken',
        subtitle: 'Log in to manage your website',
        slogan: 'Easy way to manage websites',
        login: 'Log in',
        email: 'Email',
        password: 'Password',
        validationErrors: {
            email: 'Please enter your email',
            password: 'Please enter your password',
        },
        serverErrors: {
            invalid_credentials: 'Invalid credentials',
            user_not_created_with_email: 'User has different login method',
        },
    }
};

export const admin = {
    settings: {
        locale: 'Locale',
    }
};

export const app = {
    pageNotFound: () => (<>Page not found. Go to <A href="/">Home Page</A></>),
};

export const asset = {
    pickAssetModal: {
        pickAsset: 'Pick an Asset',

    },
}

export const common = {
    loading: 'Loading',
    loadingError: 'Encountered an error while loading',
};

export const dashboard = {
    loggedIn: (name: string) => (<>You have logged in as <strong>{name}</strong></>),
    welcome: 'It is a good day to start',
};

export const nav = {
    links: {
        dashboard: 'Dashboard',
        models: 'Models',
        contents: 'Contents',
        assets: 'Assets',
        appearance: 'Appearance',
        themes: 'Themes',
        templates: 'Templates',
        pages: 'Pages',
        admin: 'Administration',
        locales: 'Locales',
        roles: 'Roles',
        usersPerms: 'Users & Perms',
        settings: 'Settings',
    },
    profile: {
        profile: 'Profile',
        logout: 'Log out',
    },
    colorModes: {
        [ColorMode.Auto]: 'Auto',
        [ColorMode.Light]: 'Light',
        [ColorMode.Dark]: 'Dark',
    }
};
