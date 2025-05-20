import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [],
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
});
