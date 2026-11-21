/**
 * Az ELBA-nak szánt böngészős csomag belépési pontja: a közös 3D-motor (three.js-sel együtt) és a két bemenet –
 * a PDF-ből épített épületmodell (ugyanaz a kép, mint a Navitherm-ben), ill. az IFC-ből háromszögelt geometria.
 * Kimenet: dist/elba/elba-3d.mjs (tools/elba/csomag.mjs). Az ELBA oldali csatoló: app/elba-bim-nezet.js.
 */
import * as THREE from 'three';
import type { EpuletModell } from '@terv/epulet';
import { nezoNyit, type Elem3D, type TipusLeiras } from './motor';
import { epuletElemek, EPULET_TIPUSOK, type EpuletForras } from './epuletElemek';

export { nezoNyit } from './motor';
export type { Elem3D, Nezo, NezoOpciok, Megjelenes, TipusBeall, KameraAllas } from './motor';

/** Az ELBA típuslistája: az épületmodellé + az IFC további osztályai. */
export const ELBA_TIPUSOK: TipusLeiras[] = [...EPULET_TIPUSOK.filter((t) => t.kulcs !== 'ter'),
  { kulcs: 'burkolat', nev: 'Burkolat, réteg', szin: 0xdbd6cc }, { kulcs: 'lepcso', nev: 'Lépcső, rámpa', szin: 0xcbc9c2 },
  { kulcs: 'korlat', nev: 'Korlát', szin: 0x4d5259 }, { kulcs: 'egyeb', nev: 'Egyéb', szin: 0xcccccb }];

/** IFC-osztály → megjelenési típus */
export function ifcTipus(ifc: string | undefined | null): string {
  const k = (ifc ?? '').toUpperCase();
  if (/^IFCWALL/.test(k)) return 'fal';
  if (k === 'IFCROOF') return 'teto';
  if (k === 'IFCWINDOW' || k === 'IFCDOOR' || k === 'IFCCURTAINWALL') return 'nyilaszaro';
  if (k === 'IFCSLAB') return 'fodem';
  if (k === 'IFCFOOTING' || k === 'IFCPILE') return 'alapozas';
  if (k === 'IFCCOLUMN' || k === 'IFCBEAM' || k === 'IFCMEMBER') return 'piller';
  if (k === 'IFCCOVERING' || k === 'IFCBUILDINGELEMENTPART') return 'burkolat';
  if (/^IFC(STAIR|RAMP)/.test(k)) return 'lepcso';
  if (k === 'IFCRAILING') return 'korlat';
  return 'egyeb';
}
const hexSzin = (c: number[] | null | undefined) => (c && c.length >= 3 ? (Math.round(c[0]! * 255) << 16) | (Math.round(c[1]! * 255) << 8) | Math.round(c[2]! * 255) : undefined);

/** IFC-ből (vagy elmentett modellképből) háromszögelt geometria → elemek. A bemenet z-fel koordinátás:
 *  {elemek:[{gid,kezd,db,szin?,ifc?}], poz, norm?} → three: (x, z, −y). */
export function haromszogElemek(geo: { elemek: { gid: string; kezd: number; db: number; szin?: number[] | null; ifc?: string }[]; poz: Float32Array; norm?: Float32Array | null },
  szint?: (gid: string) => string | null | undefined): Elem3D[] {
  const ki: Elem3D[] = [];
  for (const e of geo.elemek) {
    const p = new Float32Array(e.db * 3), n = geo.norm ? new Float32Array(e.db * 3) : null;
    for (let v = 0; v < e.db; v++) { const i = (e.kezd + v) * 3;
      p[v * 3] = geo.poz[i]!; p[v * 3 + 1] = geo.poz[i + 2]!; p[v * 3 + 2] = -geo.poz[i + 1]!;
      if (n && geo.norm) { n[v * 3] = geo.norm[i]!; n[v * 3 + 1] = geo.norm[i + 2]!; n[v * 3 + 2] = -geo.norm[i + 1]!; } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    if (n) g.setAttribute('normal', new THREE.BufferAttribute(n, 3)); else g.computeVertexNormals();
    const sz = hexSzin(e.szin);
    ki.push({ id: e.gid, tipus: ifcTipus(e.ifc), szint: szint?.(e.gid) ?? null, geo: g, ...(sz !== undefined ? { szin: sz } : {}), adat: { ifc: e.ifc } });
  }
  return ki;
}

/** A PDF-ből épített modell → elemek az ELBA azonosítóival (a kivonat gid-jei: PDF-W-…, PDF-N-…, PDF-F-… stb.). Ami a
 *  kivonatban nem önálló elem, annak `id`-je null (látszik, de nem kattintható). `van(gid)`: létezik-e a kivonatban. */
export function pdfModellElemek(modell: EpuletModell, van: (gid: string) => boolean, elo = 'PDF-', szintNev?: (id: string) => string): Elem3D[] {
  const G = (x: string) => elo + x;
  const elso = (...l: string[]) => l.find((g) => van(g)) ?? null;
  return epuletElemek(modell, { mindenFodem: true, terek: false }).map((e) => {
    const a = e.adat as EpuletForras;
    let id: string | null = null;
    switch (a.fajta) {
      case 'fal': id = elso(G('W-' + a.fal.id)); break;
      case 'nyilas': id = elso(G('N-' + a.id)); break;
      case 'fodem': id = elso(G('F-' + a.id)); break;
      case 'lapos': id = elso(G('F-' + a.fodem)); break;
      case 'piller': id = elso(G('P-' + a.id)); break;
      case 'gerenda': id = elso(G('G-' + a.id)); break;
      case 'koszoru': id = elso(G(`W-${a.fal}-${a.attika ? 'ATT' : 'KOSZ'}`), G('W-' + a.fal)); break;
      case 'alapozas': id = a.pontalap ? elso(G('ALAP-' + a.id)) : elso(G('ALAP-SAV-' + a.id), G('ALAP-SAV')); break;
      case 'teto': id = elso(G('TETO')); break;
      default: id = null;
    }
    const szulo = e.szulo ? elso(G('W-' + e.szulo)) ?? undefined : undefined;
    return { ...e, id, szint: e.szint && szintNev ? szintNev(e.szint) : e.szint, ...(szulo ? { szulo } : { szulo: undefined }) };
  });
}

/** (a csatoló ellenőrzi, hogy a csomag betöltődött) */
export const nezo3dVerzio = 1;
export { nezoNyit as nyit };
