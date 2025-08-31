import { A } from '@solidjs/router';
import type * as en from './en';
import { ColorMode } from "../theme";

export const auth: typeof en.auth = {
    login: {
        title: 'Yelken\'e Giriş Yap',
        subtitle: 'Websitenizi yönetmek için giriş yap',
        slogan: 'Websitenizi yönetmenin kolay yolu',
        login: 'Giriş Yap',
        email: 'E-posta',
        password: 'Parola',
        validationErrors: {
            email: 'Lütfen e-posta adresinizi girin',
            password: 'Lütfen parolanızı girin',
        },
        serverErrors: {
            invalid_credentials: 'Bilgiler geçersiz',
            user_not_created_with_email: 'Kullanıcı başka bir yöntem ile giriş yapıyor',
        },
    }
};

export const admin: typeof en.admin = {
    settings: {
        locale: 'Dil',
    }
};

export const app: typeof en.app = {
    pageNotFound: () => (<>Sayfa bulunamadı. <A href="/">Ana Sayfaya</A> geri dön.</>),
};

export const common: typeof en.common = {
    loading: 'Yükleniyor',
    loadingError: 'Encountered an error while loading',
};

export const dashboard: typeof en.dashboard = {
    loggedIn: (name: string) => (<><strong>{name}</strong> kullanıcısı ile giriş yaptınız</>),
    welcome: 'Başlamak için güzel bir gün',
};

export const nav: typeof en.nav = {
    links: {
        dashboard: 'Panel',
        models: 'Modeller',
        contents: 'İçerikler',
        assets: 'Kaynaklar',
        appearance: 'Görünüş',
        themes: 'Temalar',
        templates: 'Şablonlar',
        pages: 'Sayfalar',
        admin: 'Yönetim',
        locales: 'Yerel Ayarlar',
        roles: 'Roller',
        usersPerms: 'Kullanıcılar ve İzinler',
        settings: 'Ayarlar',
    },
    profile: {
        profile: 'Profil',
        logout: 'Çıkış yap',
    },
    colorModes: {
        [ColorMode.Auto]: 'Otomatik',
        [ColorMode.Light]: 'Açık',
        [ColorMode.Dark]: 'Koyu',
    }
};
