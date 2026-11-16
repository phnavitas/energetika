// Az ELBA-nak szánt böngészős csomag: PDF-tervlapokból épületmodell (apps/web/src/terv/elba.ts).
// Kimenet: dist/elba/elba-terv.mjs (ESM, a pdf.js „legacy” – polyfilles – változatával együtt, munkaszál nélkül).
// Használat: node tools/elba/csomag.mjs
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const gyoker = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const pdfjs = path.join(gyoker, 'apps/web/node_modules/pdfjs-dist/legacy/build');
await build({
  entryPoints: [path.join(gyoker, 'apps/web/src/terv/elba.ts')], outfile: path.join(gyoker, 'dist/elba/elba-terv.mjs'),
  bundle: true, format: 'esm', platform: 'browser', target: 'es2020', minify: true, legalComments: 'none', logLevel: 'warning',
  tsconfig: path.join(gyoker, 'apps/web/tsconfig.json'),
  plugins: [{ name: 'pdfjs-legacy', setup(b) {
    b.onResolve({ filter: /^pdfjs-dist$/ }, () => ({ path: path.join(pdfjs, 'pdf.mjs') }));
    b.onResolve({ filter: /^pdfjs-dist\/build\/pdf\.worker(\.min)?\.mjs$/ }, () => ({ path: path.join(pdfjs, 'pdf.worker.min.mjs') }));
  } }],
});
console.log('dist/elba/elba-terv.mjs kész');
