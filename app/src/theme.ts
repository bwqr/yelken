export enum ColorMode {
    Light = 'light',
    Dark = 'dark',
    Auto = 'auto',
}

export function getColorMode(): ColorMode | null {
    return localStorage.getItem('colorMode') as ColorMode | null;
}

export function updateColorMode(mode: ColorMode) {
    localStorage.setItem('colorMode', mode);

    applyTheme();
}

function getLightTheme(): string {
    return 'light';
}

function getDarkTheme(): string {
    return 'dark';
}

function getPreferredTheme(): string {
    const mode = getColorMode();

    if (mode === 'light') {
        return getLightTheme();
    } else if (mode === 'dark') {
        return getDarkTheme();
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? getDarkTheme() : getLightTheme();
}

function applyTheme() {
    document.documentElement.setAttribute('data-bs-theme', getPreferredTheme());
}

applyTheme();

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme());
