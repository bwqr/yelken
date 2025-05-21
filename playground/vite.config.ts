import { defineConfig } from 'vite';
import checker from 'vite-plugin-checker'
import solidPlugin from 'vite-plugin-solid';
import { resolve } from 'node:path';

export default defineConfig({
    plugins: [solidPlugin(), checker({ typescript: true })],
    build: {
        rollupOptions: {
            input: {
                app: resolve(__dirname, 'index.html'),
                playground: resolve(__dirname, 'playground/index.html'),
                sw: resolve(__dirname, 'sw.js')
            },
            output: {
                entryFileNames: (chunkInfo) => chunkInfo.name === 'sw' ? 'sw.js' : 'assets/[name]-[hash].js',
            },
        },
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
