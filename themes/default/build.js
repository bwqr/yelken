import { compile } from 'sass-embedded'
import { createHash } from 'node:crypto';
import { writeFile, rm, mkdir } from 'node:fs/promises';

async function recreateDir(path) {
  try {
    await rm(path, { recursive: true });
  } catch (e) {
    if (e.code !== 'ENOENT') {
      throw e;
    }
  }

  return mkdir(path);
}

const compressed = compile("sass/main.scss", { style: "compressed" });

const hash = createHash('sha256');
hash.update(compressed.css);

const filename = `main.${hash.copy().digest('hex').substring(0, 16)}.css`;

await recreateDir('./assets/dist');
await recreateDir('./templates/dist');

await writeFile(`./assets/dist/${filename}`, compressed.css);
await writeFile('./templates/dist/header.html', `<link rel="stylesheet" href="{{ asset_url('dist/${filename}', kind='theme') }}" />`);
