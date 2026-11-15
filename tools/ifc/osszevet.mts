/**
 * A tervből épített épületmodell (JSON, a Navitherm „teljes” 3D nézetének modellje) és az IFC összevetése:
 * npx tsx tools/ifc/osszevet.mts modell_epulet.json projekt.ifc
 * Az IFC-t az ELBA olvasója bontja ki (packages/ifc/vendor/elba-bim-olvaso.js).
 */
import { createRequire } from 'module';
import * as fs from 'fs';
import { osszevet } from '../../packages/ifc/src/index';
const req = createRequire(import.meta.url);
const O = req('../../packages/ifc/vendor/elba-bim-olvaso.js');
const md = JSON.parse(fs.readFileSync(process.argv[2]!, 'utf8'));
const ifc = O.olvas(fs.readFileSync(process.argv[3]!, 'utf8'));
for (const s of osszevet(md, ifc)) console.log(`${s.csoport.padEnd(36)} ${s.mertek.padEnd(18)} modell ${String(s.modell).padStart(9)}  IFC ${String(s.ifc).padStart(9)}  ${s.elteres === null ? '   új' : `${s.elteres >= 0 ? '+' : ''}${s.elteres.toFixed(1)}%`}`);
