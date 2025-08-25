interface Config {
    appVersion: string,
    siteURL: string,
    baseURL: string,
}

class ConfigService implements Config {
    constructor(public appVersion: string, public siteURL: string, public baseURL: string) { }

    static fromEnv(): ConfigService {
        let CONFIG: Record<string, string> = {};

        if ('YELKEN_CONFIG' in window && typeof window.YELKEN_CONFIG === 'string') {
            try {
                CONFIG = JSON.parse(window.YELKEN_CONFIG as string);
            } catch (e) {
                console.debug('Failed to parse YELKEN_CONFIG', e);
            }
        }

        function getConfig(key: string, fallback: string): string {
            return CONFIG[key] !== undefined ? CONFIG[key] : fallback;
        }

        return new ConfigService(
            __APP_VERSION__,
            getConfig('SITE_URL', import.meta.env.VITE_SITE_URL),
            getConfig('BASE_URL', import.meta.env.BASE_URL),
        )
    }

    resolveSiteURL(path: string): string {
        return this.resolveURL(this.siteURL, path);
    }

    resolveApiURL(path: string): string {
        const apiUrl = this.resolveURL(this.siteURL, 'api');

        return this.resolveURL(apiUrl, path);
    }

    resolveBaseUrl(path: string): string {
        return this.resolveURL(this.baseURL, path);
    }

    resolveURL(base: string, path: string): string {
        if (base.endsWith('/')) {
            if (path.startsWith('/')) {
                return `${base}${path.slice(1)}`
            }

            return `${base}${path}`;
        } else if (path.startsWith('/')) {
            return `${base}${path}`;
        }

        return `${base}/${path}`;
    }
}

export default ConfigService.fromEnv();
