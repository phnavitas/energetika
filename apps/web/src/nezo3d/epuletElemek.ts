/**
 * Épületmodell → 3D elemek a közös motorhoz (Navitherm és az ELBA PDF-modellje ugyanezt rajzolja).
 * Koordináták: modell (x, y lefelé a lapon, z fel) → three (x, z, y).
 */
import * as THREE from 'three';
import type { EpuletModell, Fal, BurokSzerep } from '@terv/epulet';
import { tetoGeo } from '@terv/teto';
import type { Elem3D, TipusLeiras } from './motor';
import type { ZartsagHiba } from '@terv/zartsag';

/** Anyag szerinti alapszínek (ha a modell nem hoz színt): törtfehér fal, sötétebb barna tető, szürke alapozás, sötét
 *  nyílászáró-keret, még sötétebb szürke üveg / kapulap (Balázs, 2026-11-21). */
export const ANYAG = {
  fal: 0xf1ede4, teto: 0x744a2c, alapozas: 0x9aa0a6, padlo: 0xa3a8ad, fodem: 0xe3dfd6,
  ter: 0xdcd5c6, terFutetlen: 0xd3d6d9, terKulter: 0xd6dccb, beton: 0xbcc0c5, keret: 0x30343a, uveg: 0x22262b,
};
/** A típusonként állítható megjelenés (szín, átlátszóság) alapértékei. */
export const EPULET_TIPUSOK: TipusLeiras[] = [
  { kulcs: 'fal', nev: 'Fal', szin: ANYAG.fal }, { kulcs: 'teto', nev: 'Tető', szin: ANYAG.teto },
  { kulcs: 'nyilaszaro', nev: 'Nyílászáró keret', szin: ANYAG.keret }, { kulcs: 'uveg', nev: 'Üveg / ajtólap', szin: ANYAG.uveg, atl: 0.92 },
  { kulcs: 'fodem', nev: 'Födém', szin: ANYAG.fodem }, { kulcs: 'padlo', nev: 'Talajon fekvő lemez', szin: ANYAG.padlo },
  { kulcs: 'alapozas', nev: 'Alapozás', szin: ANYAG.alapozas }, { kulcs: 'piller', nev: 'Pillér, gerenda, koszorú', szin: ANYAG.beton },
  { kulcs: 'ter', nev: 'Helyiség padlója', szin: ANYAG.ter },
];

/** Az elem forrása a modellben (a hívó ebből köti a saját azonosítóihoz, színezéséhez). */
export type EpuletForras =
  | { fajta: 'fal'; fal: Fal }
  | { fajta: 'nyilas'; id: string; fal: Fal; forras?: { lap: number; ny: number } }
  | { fajta: 'ter'; id: string; kategoria: 'futott' | 'futetlen' | 'kulter' }
  | { fajta: 'tetoter' | 'teto'; id?: string }
  | { fajta: 'lapos'; id: string; fodem: string }
  | { fajta: 'koszoru'; id: string; fal: string; attika: boolean }
  | { fajta: 'gerenda' | 'piller'; id: string }
  | { fajta: 'alapozas'; id: string; pontalap: boolean }
  | { fajta: 'fodem'; id: string; burok?: string; alatt: string | null };

export interface EpuletElemOpc {
  /** Minden födém (a közbensők is, rétegrend nélkül is) – az ELBA-nak kell, a Navitherm csak a hőburokét mutatja. */
  mindenFodem?: boolean;
  /** A terek padlója (Navitherm: igen; ELBA: nem – a födém úgyis ott van). */
  terek?: boolean;
}

/** Fal hasábjai a nyílások kivágásával (a fal hossza mentén szakaszokra bontva). */
function falDarabok(f: Fal, ny: { t: number; szel: number; mag: number; pm: number }[]) {
  const L = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]), h = f.h;
  const lyuk = ny.map((n) => ({ t0: Math.max(0, n.t - n.szel / 2), t1: Math.min(L, n.t + n.szel / 2), z0: Math.max(0, n.pm), z1: Math.min(h, n.pm + n.mag) })).filter((x) => x.t1 > x.t0 + 0.01).sort((a, b) => a.t0 - b.t0);
  const ki: { t0: number; t1: number; z0: number; z1: number }[] = [];
  let t = 0;
  for (const q of lyuk) {
    if (q.t0 > t) ki.push({ t0: t, t1: q.t0, z0: 0, z1: h });
    if (q.z0 > 0.01) ki.push({ t0: q.t0, t1: q.t1, z0: 0, z1: q.z0 });
    if (q.z1 < h - 0.01) ki.push({ t0: q.t0, t1: q.t1, z0: q.z1, z1: h });
    t = Math.max(t, q.t1);
  }
  if (t < L) ki.push({ t0: t, t1: L, z0: 0, z1: h });
  return ki;
}

const mx = new THREE.Matrix4(), ROT = new THREE.Euler();
/** geometria eltolással és függőleges tengely körüli forgatással „beégetve” a világkoordinátába */
function beeget(g: THREE.BufferGeometry, x: number, y: number, z: number, roty = 0, gyerek?: { x: number; y: number }) {
  if (gyerek) g.translate(gyerek.x, gyerek.y, 0);
  ROT.set(0, roty, 0); mx.makeRotationFromEuler(ROT); mx.setPosition(x, y, z); g.applyMatrix4(mx); return g;
}

export const burokJel = (b: BurokSzerep | undefined) => b ?? null;

export function epuletElemek(modell: EpuletModell, opc: EpuletElemOpc = {}): Elem3D[] {
  const ki: Elem3D[] = [];
  const nyFal = new Map<string, typeof modell.nyilasok>(); for (const n of modell.nyilasok) nyFal.set(n.fal, [...(nyFal.get(n.fal) ?? []), n]);
  const zMin0 = Math.min(...modell.szintek.map((q) => q.z0));
  // falak (nyílásokkal kivágva) és nyílászárók (sötét keret + sötétebb üveg / ajtó- és kapulap)
  for (const f of modell.falak) {
    if (f.szerkezet === 'hatar') continue; // helyiséghatár, nem fal
    const dx = f.b[0] - f.a[0], dy = f.b[1] - f.a[1], L = Math.hypot(dx, dy); if (L < 0.05) continue;
    const ny = nyFal.get(f.id) ?? [], rot = -Math.atan2(dy, dx), adat: EpuletForras = { fajta: 'fal', fal: f };
    if (f.profil && f.profil.length >= 2) {
      // ferde / tört felső élű fal (tetőtér): síkidom a fal hosszán, a nyílások lyukként, falvastagságnyi kihúzással
      const off = f.h - Math.max(...f.profil.map((q) => q.z));
      const sh = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(L, 0), ...f.profil.slice().reverse().map((q) => new THREE.Vector2(q.t * L, q.z + off))]);
      for (const n of ny) { const t0 = Math.max(0.01, n.t - n.szel / 2), t1 = Math.min(L - 0.01, n.t + n.szel / 2), z0 = Math.max(0.01, n.pm), z1 = n.pm + n.mag; if (t1 > t0 + 0.05 && z1 > z0 + 0.05) sh.holes.push(new THREE.Path([new THREE.Vector2(t0, z0), new THREE.Vector2(t1, z0), new THREE.Vector2(t1, z1), new THREE.Vector2(t0, z1)])); }
      const g = new THREE.ExtrudeGeometry(sh, { depth: f.vastag, bevelEnabled: false }); g.translate(0, 0, -f.vastag / 2);
      ki.push({ id: f.id, tipus: 'fal', szint: f.szint, geo: beeget(g, f.a[0], f.z0, f.a[1], rot), adat });
    } else for (const d of falDarabok(f, ny)) {
      const tm = (d.t0 + d.t1) / 2;
      const g = new THREE.BoxGeometry(d.t1 - d.t0, d.z1 - d.z0, f.vastag);
      ki.push({ id: f.id, tipus: 'fal', szint: f.szint, geo: beeget(g, f.a[0] + (dx / L) * tm, f.z0 + (d.z0 + d.z1) / 2, f.a[1] + (dy / L) * tm, rot), adat });
    }
    for (const n of ny) {
      const cx = f.a[0] + (dx / L) * n.t, cy = f.z0 + n.pm + n.mag / 2, cz = f.a[1] + (dy / L) * n.t;
      const tok = Math.min(0.07, n.szel / 6, n.mag / 6), mely = Math.max(0.06, Math.min(0.12, f.vastag * 0.4));
      const nadat: EpuletForras = { fajta: 'nyilas', id: n.id, fal: f, ...(n.forras ? { forras: n.forras } : {}) };
      const resz = (sx: number, sy: number, sz0: number, x: number, y: number, tipus: string) =>
        ki.push({ id: n.id, tipus, szint: n.szint || f.szint, szulo: f.id, geo: beeget(new THREE.BoxGeometry(sx, sy, sz0), cx, cy, cz, rot, { x, y }), adat: nadat });
      resz(n.szel, tok, mely, 0, n.mag / 2 - tok / 2, 'nyilaszaro'); resz(n.szel, tok, mely, 0, -n.mag / 2 + tok / 2, 'nyilaszaro');
      resz(tok, n.mag - 2 * tok, mely, -n.szel / 2 + tok / 2, 0, 'nyilaszaro'); resz(tok, n.mag - 2 * tok, mely, n.szel / 2 - tok / 2, 0, 'nyilaszaro');
      resz(n.szel - 2 * tok, n.mag - 2 * tok, 0.03, 0, 0, 'uveg');
    }
  }
  // terek padlója
  if (opc.terek !== false) for (const t of modell.terek) {
    const sz0 = modell.szintek.find((s) => s.id === t.szint); if (!sz0) continue;
    for (const p of t.poligonok) {
      if (p.length < 3) continue;
      const g = new THREE.ShapeGeometry(new THREE.Shape(p.map(([x, y]) => new THREE.Vector2(x, y)))); g.rotateX(Math.PI / 2); g.translate(0, sz0.z0 + 0.02, 0);
      ki.push({ id: t.id, tipus: 'ter', szint: t.szint, geo: g, el: false, ...(t.kategoria === 'futott' ? {} : { szin: t.kategoria === 'futetlen' ? ANYAG.terFutetlen : ANYAG.terKulter }),
        adat: { fajta: 'ter', id: t.id, kategoria: t.kategoria } satisfies EpuletForras });
    }
  }
  // tetőtér: a tetőfelület (térdfal → ferde tetősík → padlásfödém) magasságmezőként, 0,25 m-es rácson
  const tetoSzint = new Set((modell.tetok ?? []).map((t) => t.szint));
  for (const t of modell.tetok ?? []) for (const p of t.poligonok) {
    if (p.length < 3) continue;
    const g = tetoGeo(p, t, t.orom), c = 0.25;
    const bx = [Math.min(...p.map((q) => q[0])), Math.max(...p.map((q) => q[0]))], by = [Math.min(...p.map((q) => q[1])), Math.max(...p.map((q) => q[1]))];
    const benn = (x: number, y: number) => { let b = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const a = p[i]!, d = p[j]!; if ((a[1] > y) !== (d[1] > y) && x < ((d[0] - a[0]) * (y - a[1])) / (d[1] - a[1]) + a[0]) b = !b; } return b; };
    const pos: number[] = [];
    for (let x = bx[0]!; x < bx[1]!; x += c) for (let y = by[0]!; y < by[1]!; y += c) {
      if (!benn(x + c / 2, y + c / 2)) continue;
      const P = [[x, y], [x + c, y], [x + c, y + c], [x, y + c]] as const, Z = P.map(([u, v]) => t.z0 + g.H([u, v]) + 0.02);
      for (const [i0, i1, i2] of [[0, 1, 2], [0, 2, 3]] as const) for (const i of [i0, i1, i2]) pos.push(P[i]![0], Z[i]!, P[i]![1]);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals();
    ki.push({ id: null, tipus: 'teto', szint: t.szint, geo, el: false, adat: { fajta: 'tetoter' } satisfies EpuletForras });
  }
  // koszorúk (a falak tengelyén), gerendák, alapozás: tengely menti hasábok
  const rud = (a: [number, number], b: [number, number], szel: number, z0: number, z1: number) => {
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l < 0.05 || z1 <= z0) return null;
    return beeget(new THREE.BoxGeometry(l, z1 - z0, szel), (a[0] + b[0]) / 2, (z0 + z1) / 2, (a[1] + b[1]) / 2, -Math.atan2(b[1] - a[1], b[0] - a[0]));
  };
  const falIx = new Map(modell.falak.map((f) => [f.id, f]));
  for (const k of modell.koszoruk ?? []) for (const id of k.falak) { const f = falIx.get(id); const g = f && rud(f.a, f.b, k.szel, k.zFelso - k.magas, k.zFelso);
    if (g) ki.push({ id: k.id, tipus: 'piller', szint: k.szint, geo: g, adat: { fajta: 'koszoru', id: k.id, fal: id, attika: k.fajta === 'attika' } satisfies EpuletForras }); }
  for (const gr of modell.gerendak ?? []) { const g = rud(gr.a, gr.b, gr.szel, gr.alsoSik, gr.felsoSik);
    if (g) ki.push({ id: gr.id, tipus: 'piller', szint: gr.szint, geo: g, adat: { fajta: 'gerenda', id: gr.id } satisfies EpuletForras }); }
  const pIx = new Map((modell.pillerek ?? []).map((p) => [p.id, p]));
  const alsoSzint = modell.szintek.find((q) => Math.abs(q.z0 - zMin0) < 0.01)?.id ?? null;
  for (const a of modell.alapozas ?? []) {
    const adat: EpuletForras = { fajta: 'alapozas', id: a.id, pontalap: a.fajta === 'pontalap' };
    if (a.fajta === 'pontalap') { const p = a.piller ? pIx.get(a.piller) : undefined; const g = p && rud([p.kozep[0] - a.szel / 2, p.kozep[1]], [p.kozep[0] + a.szel / 2, p.kozep[1]], a.szel, a.zFelso - a.magas, a.zFelso);
      if (g) ki.push({ id: a.id, tipus: 'alapozas', szint: alsoSzint, geo: g, adat }); continue; }
    if (a.fajta === 'lemezalap') continue;
    for (const id of a.falak) { const f = falIx.get(id); const g = f && rud(f.a, f.b, a.szel, a.zFelso - a.magas, a.zFelso); if (g) ki.push({ id: a.id, tipus: 'alapozas', szint: alsoSzint, geo: g, adat }); }
  }
  // magastető (a modell tetőfelülete háromszögekben) és a magastető nélküli részek lapostetője
  if (modell.magasteto) {
    const pos: number[] = []; for (const h of modell.magasteto.haromszogek) for (const [x, y, z] of h) pos.push(x!, z!, y!);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    ki.push({ id: 'TETO', tipus: 'teto', szint: modell.magasteto.szint, geo: g, adat: { fajta: 'teto', id: 'TETO' } satisfies EpuletForras });
    // (felülről nyitott belső tér nincs): a legfelső szint födémjének síkjában
    const ft = modell.fodemek.find((f) => f.alatt === modell.magasteto!.szint);
    if (ft) (modell.magasteto.lapos ?? []).forEach((p, i) => {
      if (p.length < 3) return;
      const g2 = new THREE.ExtrudeGeometry(new THREE.Shape(p.map(([x, y]) => new THREE.Vector2(x, y))), { depth: ft.vastag, bevelEnabled: false }); g2.rotateX(Math.PI / 2); g2.translate(0, ft.z, 0);
      ki.push({ id: `LAPOS-${i + 1}`, tipus: 'teto', szint: modell.magasteto!.szint, geo: g2, adat: { fajta: 'lapos', id: `LAPOS-${i + 1}`, fodem: ft.id } satisfies EpuletForras });
    });
  }
  // pillérek. A legalsó szint SZABADON ÁLLÓ pillére (terasz, előtető) a képen a pontalapjáig, ennek híján a talajon
  // fekvő padló aljáig ér – különben a ház alatti sáv mellett „lebeg”. (Csak megjelenítés: a pillér magassága marad.)
  const padloAlj = Math.min(0, ...modell.fodemek.filter((fd) => fd.alatt === null).map((fd) => fd.z - fd.vastag));
  const pontalap = new Map((modell.alapozas ?? []).filter((a) => a.fajta === 'pontalap' && a.piller).map((a) => [a.piller!, a]));
  for (const p of modell.pillerek ?? []) {
    const lent = p.hely === 'szabad' && Math.abs(p.z0 - zMin0) < 0.01;
    const z0 = lent ? Math.min(p.z0, pontalap.get(p.id)?.zFelso ?? padloAlj) : p.z0, z1 = p.z0 + p.h;
    ki.push({ id: p.id, tipus: 'piller', szint: p.szint, geo: beeget(new THREE.BoxGeometry(p.a, z1 - z0, p.b), p.kozep[0], (z0 + z1) / 2, p.kozep[1]), adat: { fajta: 'piller', id: p.id } satisfies EpuletForras });
  }
  // födémek (tető / legalsó padló; a közbenső, ha a metszetből ismert a rétegrendje – az ELBA-nak mind)
  for (const fd of modell.fodemek) {
    if (!opc.mindenFodem && fd.burok !== 'teto' && fd.burok !== 'padlo' && !fd.retegek) continue;
    if (fd.burok === 'teto' && fd.alatt && tetoSzint.has(fd.alatt)) continue;
    const tipus = fd.burok === 'teto' ? 'teto' : fd.alatt === null ? 'padlo' : 'fodem';
    for (const p of fd.poligonok) {
      if (p.length < 3) continue;
      const g = new THREE.ExtrudeGeometry(new THREE.Shape(p.map(([x, y]) => new THREE.Vector2(x, y))), { depth: fd.vastag, bevelEnabled: false }); g.rotateX(Math.PI / 2); g.translate(0, fd.z, 0); // (z a födém teteje, lefelé vastag)
      ki.push({ id: fd.id, tipus, szint: fd.folott ?? fd.alatt, geo: g, adat: { fajta: 'fodem', id: fd.id, ...(fd.burok ? { burok: fd.burok } : {}), alatt: fd.alatt } satisfies EpuletForras });
    }
  }
  return ki;
}

/** A zártság-ellenőrzés hibái: piros, áttetsző jelölés (hiányzó fal sávja, rés / hézag helye). */
export function zartsagJelolok(modell: EpuletModell, hibak: readonly ZartsagHiba[]): THREE.Object3D[] {
  const jelolt = new THREE.MeshBasicMaterial({ color: 0xdc2626, transparent: true, opacity: 0.55, depthTest: false, side: THREE.DoubleSide });
  const ki: THREE.Object3D[] = [];
  for (const hb of hibak) {
    const sz0 = modell.szintek.find((q) => q.id === hb.szint); const z0 = sz0?.z0 ?? 0, hh = sz0?.h ?? 3;
    if (hb.a && hb.b && hb.fajta === 'fal') {
      const L = Math.hypot(hb.b[0] - hb.a[0], hb.b[1] - hb.a[1]); if (L < 0.05) continue;
      const m = new THREE.Mesh(new THREE.BoxGeometry(L, hh, 0.15), jelolt);
      m.position.set((hb.a[0] + hb.b[0]) / 2, z0 + hh / 2, (hb.a[1] + hb.b[1]) / 2); m.rotation.y = -Math.atan2(hb.b[1] - hb.a[1], hb.b[0] - hb.a[0]); ki.push(m);
    } else {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), jelolt);
      m.position.set(hb.hely[0], z0 + hh + (hb.fajta === 'teto' ? 1.5 : 0.5), hb.hely[1]); ki.push(m);
    }
  }
  return ki;
}
