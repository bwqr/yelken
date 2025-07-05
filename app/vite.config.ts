import { defineConfig } from 'vite';
import checker from 'vite-plugin-checker'
import solidPlugin from 'vite-plugin-solid';
import solidSvg from 'vite-plugin-solid-svg'

export default defineConfig({
    plugins: [solidPlugin(), solidSvg(), checker({ typescript: true })],
    server: {
        port: 8080,
    },
    build: {
        target: 'esnext',
        assetsDir: 'static',
    },
    css: {
        preprocessorOptions: {
            scss: {
                // https://github.com/twbs/bootstrap/issues/40962#issuecomment-2448291496
                silenceDeprecations: ['color-functions', 'global-builtin', 'import']
            },
        }
    },
    define: {
        '__APP_VERSION__': JSON.stringify(process.env.npm_package_version),
    }
});
