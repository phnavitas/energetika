import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

// a pdf.js WebAssembly-dekódolói (JBIG2 / CCITT, JPEG 2000, ICC) az assets/pdfjs-wasm/ mappába – a pdf.js a modul
// mellől tölti (lásd packages/terv/src/elemzes.ts, pdfjsWasmUrl); nélkülük a CCITT-maszkos lap tartalma elveszik
const PDFJS_WASM = ['jbig2.wasm', 'jbig2_nowasm_fallback.js', 'openjpeg.wasm', 'openjpeg_nowasm_fallback.js', 'qcms_bg.wasm'];
const pdfjsWasm = () => ({
  name: 'pdfjs-wasm',
  generateBundle(this: { emitFile: (f: { type: 'asset'; fileName: string; source: Uint8Array }) => string }) {
    for (const f of PDFJS_WASM) this.emitFile({ type: 'asset', fileName: `assets/pdfjs-wasm/${f}`, source: readFileSync(fileURLToPath(new URL(`./node_modules/pdfjs-dist/wasm/${f}`, import.meta.url))) });
  },
});

export default defineConfig({
  plugins: [preact(), pdfjsWasm(), ...(process.env.EGYFAJL ? [viteSingleFile()] : [])],
  resolve: {
    alias: [
      { find: '@mag', replacement: fileURLToPath(new URL('../../packages/mag/src', import.meta.url)) },
      { find: '@export', replacement: fileURLToPath(new URL('../../packages/export/src', import.meta.url)) },
      { find: '@terv', replacement: fileURLToPath(new URL('../../packages/terv/src', import.meta.url)) },
      // a @terv csomag külső függőségei az alkalmazás node_modules-ából
      { find: /^pdfjs-dist(\/.*)?$/, replacement: fileURLToPath(new URL('./node_modules/pdfjs-dist', import.meta.url)) + '$1' },
      { find: /^pdf-lib$/, replacement: fileURLToPath(new URL('./node_modules/pdf-lib', import.meta.url)) },
      // HAMIS=1: memóriabeli adatréteg a felület teszteléséhez (tools/feluletteszt.mjs)
      ...(process.env.HAMIS ? [{ find: /^(\.\.?\/)+tarolo$/, replacement: fileURLToPath(new URL('./src/tarolo-hamis.ts', import.meta.url)) }] : []),
    ],
  },
  // Az egyfájlos előnézet (artifact) helyi módban fut: nincs adatbázis-kapcsolat.
  envDir: process.env.EGYFAJL ? './nincs-env' : '.',
  server: { host: true, port: 5173 },
  // a munkaszálak egy fájlban (a PDF-olvasó munkaszál a pdf.js-t dinamikusan tölti be)
  worker: { rollupOptions: { output: { inlineDynamicImports: true } } },
});
