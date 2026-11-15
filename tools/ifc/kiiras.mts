/** IFC mennyiségi kiírás: npx tsx tools/ifc/kiiras.mts projekt.ifc [--json] */
import * as W from '../../apps/web/node_modules/web-ifc/web-ifc-api-node.js';
import { ifcBeolvas, kiiras } from '../../packages/ifc/src/index';
import * as fs from 'fs';
const api = new (W as any).IfcAPI(); api.SetWasmPath(new URL('../../apps/web/node_modules/web-ifc/', import.meta.url).pathname, true); await api.Init();
const md = ifcBeolvas(api, new Uint8Array(fs.readFileSync(process.argv[2]!)));
const k = kiiras(md);
if (process.argv.includes('--json')) console.log(JSON.stringify(k, null, 1));
else {
  console.log(`${md.schema} | szintek: ${md.szintek.map((s) => `${s.nev} (${s.z.toFixed(2)})`).join(', ')}`);
  for (const s of k) console.log(`${s.kategoria.padEnd(10)} ${s.tipus.slice(0, 44).padEnd(44)} ${(s.retegrend ?? '').slice(0, 44).padEnd(44)} ${String(s.db).padStart(4)} db  L ${s.hossz?.toFixed(2) ?? '–'}  A ${s.A?.toFixed(2) ?? '–'}  V ${s.V?.toFixed(2) ?? '–'}`);
}
process.exit(0);
