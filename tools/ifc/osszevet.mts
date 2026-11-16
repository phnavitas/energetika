/**
 * A tervből épített épületmodell (JSON, a Navitherm „teljes” 3D nézetének modellje) és az IFC összevetése:
 * npx tsx tools/ifc/osszevet.mts modell_epulet.json projekt.ifc
 * Az IFC-t az ELBA olvasója bontja ki (packages/ifc/vendor/elba-bim-olvaso.cjs); a mennyiség nélküli falakhoz
 * (proxy-export) a befoglaló dobozt az ELBA geometria-modulja adja.
 */
import { createRequire } from 'module';
import * as fs from 'fs';
import { osszevet, type Doboz } from '../../packages/ifc/src/index';
const req = createRequire(import.meta.url);
const O = req('../../packages/ifc/vendor/elba-bim-olvaso.cjs');
const G = req('../../packages/ifc/vendor/elba-bim-geometria.cjs');
const md = JSON.parse(fs.readFileSync(process.argv[2]!, 'utf8'));
const sz = fs.readFileSync(process.argv[3]!, 'latin1');
const ifc = O.olvas(sz);
// mennyiség nélküli falak: befoglaló doboz (a ±0-hoz mért z)
const gidk = ifc.elemek.filter((e: any) => /PROXY|WALL|ELEMENTPART/.test(e.ifc) || /COLUMN|BEAM|MEMBER/.test(e.ifc) || /pill[ée]r|gerend|koszor/i.test(e.tipusNev ?? '')).map((e: any) => e.gid);
let dobozok: Record<string, Doboz> = {};
if (gidk.length) {
  try {
    const R = O._rekordok ? O._rekordok(sz) : undefined;
    const nulla = G.szintNulla(sz, { R, hosszSzorzo: ifc.hosszSzorzo, szintek: ifc.szintek }) ?? 0;
    const d = G.dobozok(sz, { R, hosszSzorzo: ifc.hosszSzorzo, gidk, vilag: true }) ?? {};
    for (const [g, b] of Object.entries<any>(d)) dobozok[g] = { ...b, z0: b.z0 - nulla, z1: b.z1 - nulla };
  } catch (e) { console.error('doboz-hiba', String(e).slice(0, 200)); }
}
for (const s of osszevet(md, ifc, 1.2, dobozok)) console.log(`${s.csoport.padEnd(48)} ${s.mertek.padEnd(14)} modell ${String(s.modell).padStart(8)}  IFC ${String(s.ifc).padStart(8)}  ${s.elteres === null ? '   új' : `${s.elteres >= 0 ? '+' : ''}${s.elteres.toFixed(1)}%`}`);
