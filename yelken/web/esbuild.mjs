import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import child from 'node:child_process';
import * as esbuild from 'esbuild'
import { sassPlugin } from 'esbuild-sass-plugin'

const BUILD_DIR = 'build';

await esbuild.build({
  entryPoints: ['index.scss'],
  entryNames: '[name]-[hash]',
  outdir: BUILD_DIR,
  plugins: [sassPlugin()],
});

function wasmPackFile(file) {
  return file.startsWith('yelken') && ['.js', '.wasm'].includes(path.extname(file));
}

// Clean wasm-pack generated files
await Promise.all(
  (await fs.promises.readdir(BUILD_DIR))
    .filter(wasmPackFile)
    .map((file) => fs.promises.rm(path.resolve(BUILD_DIR, file)))
);

// Run wasm-pack
const subcommand = child.spawn('wasm-pack', ['build', '--target', 'web', '--release', '--out-dir', BUILD_DIR, '--out-name', 'yelken', '--no-typescript', '.']);
subcommand.stdout.pipe(process.stdout);
subcommand.stderr.pipe(process.stderr);
await new Promise((resolve, _) => subcommand.on('close', () => resolve()));

// Hash wasm-pack generated files
await Promise.all(
  (await fs.promises.readdir(BUILD_DIR))
    .filter(wasmPackFile)
    .map(async (file) => {
      const stream = fs.createReadStream(path.resolve(BUILD_DIR, file));
      const hash = crypto.createHash('shake256', { outputLength: 8 });
      hash.setEncoding('hex');

      stream.pipe(hash);

      await new Promise((resolve, reject) => {
        stream.on('error', () => reject());
        stream.on('end', () => resolve());
      })

      hash.end();

      const fileHash = hash.digest('hex');
      const fileObj = path.parse(file);

      await fs.promises.rename(path.resolve(BUILD_DIR, file), path.resolve(BUILD_DIR, `${fileObj.name}-${fileHash}${fileObj.ext}`));
    })
);

// Build index.html with output files
const outputFiles = await fs.promises.readdir(BUILD_DIR);

const cssOutputName = outputFiles.find(file => file.startsWith('index') && file.endsWith('css'));
const outputName = outputFiles.find(file => file.startsWith('yelken') && file.endsWith('js'));
const wasmOutputName = outputFiles.find(file => file.startsWith('yelken') && file.endsWith('wasm'));

const html = await fs.promises.readFile('index.html', { encoding: 'utf8' });
const newHtml = html
  .replaceAll('{CSS_OUTPUT}', cssOutputName)
  .replaceAll('{OUTPUT_NAME}', outputName)
  .replaceAll('{WASM_OUTPUT_NAME}', wasmOutputName)

await fs.promises.writeFile(`build/index.html`, newHtml);
