let YELKEN_CONFIG: Record<string, string> = {};

try {
    YELKEN_CONFIG = JSON.parse((window as any).YELKEN_CONFIG ?? '{}')
} catch (e) {
    console.debug('Failed to parse YELKEN_CONFIG', e);
}

function getConfig(key: string, fallback: string): string {
    return YELKEN_CONFIG[key] !== undefined ? YELKEN_CONFIG[key] : fallback;
}

export const APP_VERSION = __APP_VERSION__;
export const API_URL = getConfig('API_URL', import.meta.env.VITE_API_URL);
export const BASE_URL = getConfig('BASE_URL', import.meta.env.BASE_URL);

export const resolveURL = (base: string, path: string): string => {
    if (base.endsWith('/')) {
        if (path.startsWith('/')) {
            return `${base}${path.slice(1)}`
        }

        return `${base}${path}`;
    } else if (path.startsWith('/')) {
        return `${base}${path}`;
    }

    return `${base}/${path}`;
};
