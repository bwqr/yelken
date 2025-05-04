import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
    plugins: [solidPlugin()],
    server: {
        port: 8080,
    },
    build: {
        target: 'esnext',
    },
    css: {
        preprocessorOptions: {
            scss: {
                silenceDeprecations: ['mixed-decls', 'color-functions', 'global-builtin', 'import']
            },
        }
    },
});
