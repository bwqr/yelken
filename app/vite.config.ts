import { defineConfig } from 'vite';
import checker from 'vite-plugin-checker'
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
    plugins: [solidPlugin(), checker({ typescript: true })],
    server: {
        port: 8080,
    },
    build: {
        target: 'esnext',
    },
    css: {
        preprocessorOptions: {
            scss: {
                // https://github.com/twbs/bootstrap/issues/40962#issuecomment-2448291496
                silenceDeprecations: ['color-functions', 'global-builtin', 'import']
            },
        }
    },
});
