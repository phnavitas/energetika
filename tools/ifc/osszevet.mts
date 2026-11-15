/**
 * A tervből épített épületmodell (a Navitherm 3D „teljes” nézetének modellje, JSON) és az IFC összevetése:
 * npx tsx tools/ifc/osszevet.mts modell_epulet.json projekt.ifc
 */
import * as W from '../../apps/web/node_modules/web-ifc/web-ifc-api-node.js';
import { ifcBeolvas, osszevet } from '../../packages/ifc/src/index';
import * as fs from 'fs';
const api = new (W as any).IfcAPI(); api.SetWasmPath(new URL('../../apps/web/node_modules/web-ifc/', import.meta.url).pathname, true); await api.Init();
const md = JSON.parse(fs.readFileSync(process.argv[2]!, 'utf8'));
const ifc = ifcBeolvas(api, new Uint8Array(fs.readFileSync(process.argv[3]!)));
for (const s of osszevet(md, ifc)) console.log(`${s.csoport.padEnd(36)} ${s.mertek.padEnd(22)} modell ${String(s.modell).padStart(9)}  IFC ${String(s.ifc).padStart(9)}  ${s.elteres === null ? '   új' : `${s.elteres >= 0 ? '+' : ''}${s.elteres.toFixed(1)}%`}`);
process.exit(0);
