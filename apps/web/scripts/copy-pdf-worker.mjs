// Copies the pdf.js worker and its data files (CMaps, standard fonts, wasm decoders, ICC profiles)
// into /public/pdfjs/<version>/ so they are served from our own origin (S2, D23). The folder name
// carries the pdfjs-dist version, so a dependency bump busts browser caches.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const pkgPath = require.resolve('pdfjs-dist/package.json');
const root = path.dirname(pkgPath);
const { version } = JSON.parse(readFileSync(pkgPath, 'utf8'));
const outRoot = path.join(here, '..', 'public', 'pdfjs');
const out = path.join(outRoot, version);

mkdirSync(outRoot, { recursive: true });
for (const f of readdirSync(outRoot)) if (f !== version) rmSync(path.join(outRoot, f), { recursive: true, force: true });
if (!existsSync(path.join(out, 'pdf.worker.min.mjs'))) {
  mkdirSync(out, { recursive: true });
  cpSync(path.join(root, 'build', 'pdf.worker.min.mjs'), path.join(out, 'pdf.worker.min.mjs'));
  for (const dir of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
    if (existsSync(path.join(root, dir))) cpSync(path.join(root, dir), path.join(out, dir), { recursive: true });
  }
}
console.log(`pdf.js ${version} assets → public/pdfjs/${version}/`);
