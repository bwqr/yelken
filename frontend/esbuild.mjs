import * as esbuild from 'esbuild'
import { solidPlugin } from 'esbuild-plugin-solid';
import { componentize } from '@bytecodealliance/componentize-js';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

await esbuild.build({
  entryPoints: ['server.ts'],
  bundle: true,
  format: 'esm',
  outdir: 'build',
  platform: 'node',
  treeShaking: true,
  plugins: [solidPlugin({
    solid: {
      generate: 'ssr',
      hydratable: true,
    }
  })],
});

await esbuild.build({
  entryPoints: ['client.ts'],
  bundle: true,
  format: 'esm',
  outdir: 'build',
  platform: 'browser',
  treeShaking: true,
  plugins: [solidPlugin({
    solid: {
      generate: 'dom'
    }
  })],
});

const { component } = await componentize(await readFile('./build/server.js', 'utf8'), {
  disableFeatures: ['http'],
  witPath: resolve('./wit'),
  worldName: 'root',
});

await writeFile('build/server.wasm', component);
