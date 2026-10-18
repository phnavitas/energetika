import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [preact(), ...(process.env.EGYFAJL ? [viteSingleFile()] : [])],
  resolve: {
    alias: [
      { find: '@mag', replacement: fileURLToPath(new URL('../../packages/mag/src', import.meta.url)) },
      { find: '@export', replacement: fileURLToPath(new URL('../../packages/export/src', import.meta.url)) },
      // HAMIS=1: memóriabeli adatréteg a felület teszteléséhez (tools/feluletteszt.mjs)
      ...(process.env.HAMIS ? [{ find: /^(\.\.?\/)+tarolo$/, replacement: fileURLToPath(new URL('./src/tarolo-hamis.ts', import.meta.url)) }] : []),
    ],
  },
  // Az egyfájlos előnézet (artifact) helyi módban fut: nincs adatbázis-kapcsolat.
  envDir: process.env.EGYFAJL ? './nincs-env' : '.',
  server: { host: true, port: 5173 },
});
