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
  // a keret világosabb, hogy elváljon az üvegtől (Balázs, 2026-11-21: „alig választható el az üvegtől”)
  ter: 0xdcd5c6, terFutetlen: 0xd3d6d9, terKulter: 0xd6dccb, beton: 0xbcc0c5, keret: 0x7c838c, uveg: 0x22262b,
};
/** A típusonként állítható megjelenés (szín, átlátszóság) alapértékei. */
export const EPULET_TIPUSOK: TipusLeiras[] = [
  { kulcs: 'fal', nev: 'Fal', szin: ANYAG.fal }, { kulcs: 'teto', nev: 'Tető', szin: ANYAG.teto },
  { kulcs: 'nyilaszaro', nev: 'Nyílászáró keret', szin: ANYAG.keret }, { kulcs: 'uveg', nev: 'Üveg / ajtólap', szin: ANYAG.uveg },
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

/**
 * A fal EGY test (Balázs, 2026-11-21: „az egy síkban levő, folytonos falakat … egy testté, amiből az ablakokat kell
 * kivonni”): a fal nézete (hossz × magasság, felül a profil szerint) síkidomként, a nyílások lyukként – a padlóig érő
 * nyílás (ajtó) a körvonal bevágásaként –, falvastagságnyi kihúzással. Ha a síkidom nem bontható háromszögekre
 * (egymásba lógó nyílások), a régi hasábos bontás marad.
 */
function falTest(f: Fal, ny: { t: number; szel: number; mag: number; pm: number }[], L: number): THREE.BufferGeometry | null {
  const off = f.profil && f.profil.length >= 2 ? f.h - Math.max(...f.profil.map((q) => q.z)) : 0;
  const felso = f.profil && f.profil.length >= 2 ? f.profil.map((q) => ({ t: q.t * L, z: q.z + off })) : [{ t: 0, z: f.h }, { t: L, z: f.h }];
  const zFel = (t: number) => { for (let i = 1; i < felso.length; i++) { const a = felso[i - 1]!, b = felso[i]!; if (t <= b.t + 1e-9) return a.z + ((b.z - a.z) * (t - a.t)) / Math.max(1e-9, b.t - a.t); } return felso[felso.length - 1]!.z; };
  const lyuk = ny.map((n) => ({ t0: Math.max(0.02, n.t - n.szel / 2), t1: Math.min(L - 0.02, n.t + n.szel / 2), z0: Math.max(0, n.pm), z1: n.pm + n.mag }))
    .map((q) => ({ ...q, z1: Math.min(q.z1, Math.min(zFel(q.t0), zFel(q.t1)) - 0.02) })).filter((q) => q.t1 > q.t0 + 0.03 && q.z1 > q.z0 + 0.03).sort((a, b) => a.t0 - b.t0);
  // egymás mellé / egymásba érő nyílások (pl. a teraszajtó-sor): egy lyuk a közös befoglalóval (a keretek kitöltik)
  for (let i = 1; i < lyuk.length; i++) { const p = lyuk[i - 1]!, q = lyuk[i]!;
    if (q.t0 < p.t1 + 0.04) { p.t1 = Math.max(p.t1, q.t1); p.z0 = Math.min(p.z0, q.z0); p.z1 = Math.max(p.z1, q.z1); lyuk.splice(i, 1); i--; } }
  const pont: THREE.Vector2[] = [new THREE.Vector2(0, 0)];
  for (const q of lyuk) if (q.z0 <= 0.01) pont.push(new THREE.Vector2(q.t0, 0), new THREE.Vector2(q.t0, q.z1), new THREE.Vector2(q.t1, q.z1), new THREE.Vector2(q.t1, 0));
  pont.push(new THREE.Vector2(L, 0), ...felso.slice().reverse().map((q) => new THREE.Vector2(q.t, q.z)));
  const sh = new THREE.Shape(pont);
  for (const q of lyuk) if (q.z0 > 0.01) sh.holes.push(new THREE.Path([new THREE.Vector2(q.t0, q.z0), new THREE.Vector2(q.t1, q.z0), new THREE.Vector2(q.t1, q.z1), new THREE.Vector2(q.t0, q.z1)]));
  try {
    const g = new THREE.ExtrudeGeometry(sh, { depth: f.vastag, bevelEnabled: false }); g.translate(0, 0, -f.vastag / 2);
    return (g.getAttribute('position')?.count ?? 0) >= 36 ? g : null;
  } catch { return null; }
}

/** sáv (hossz × magasság) téglalapjai a lyukak kivonásával – a koszorú a nyílások fölött / mellett */
function savDarabok(L: number, z0: number, z1: number, lyuk: { t0: number; t1: number; z0: number; z1: number }[]) {
  const ki: { t0: number; t1: number; z0: number; z1: number }[] = [];
  const l = lyuk.map((q) => ({ t0: Math.max(0, q.t0), t1: Math.min(L, q.t1), z0: Math.max(z0, q.z0), z1: Math.min(z1, q.z1) })).filter((q) => q.t1 > q.t0 + 0.01 && q.z1 > q.z0 + 0.01).sort((a, b) => a.t0 - b.t0);
  let t = 0;
  for (const q of l) {
    if (q.t0 > t) ki.push({ t0: t, t1: q.t0, z0, z1 });
    if (q.z0 > z0 + 0.01) ki.push({ t0: Math.max(t, q.t0), t1: q.t1, z0, z1: q.z0 });
    if (q.z1 < z1 - 0.01) ki.push({ t0: Math.max(t, q.t0), t1: q.t1, z0: q.z1, z1 });
    t = Math.max(t, q.t1);
  }
  if (t < L) ki.push({ t0: t, t1: L, z0, z1 });
  return ki;
}

/** befelé tolt sokszög (derékszögű / konvex sarkoknál pontos; a fal síkjával egybeeső élek így nem látszanak sávként) */
function befele(p: [number, number][], d: number): [number, number][] {
  let A = 0; for (let i = 0; i < p.length; i++) { const a = p[i]!, b = p[(i + 1) % p.length]!; A += a[0] * b[1] - b[0] * a[1]; }
  const s = A > 0 ? 1 : -1, n = p.length;
  return p.map((c, i) => {
    const a = p[(i + n - 1) % n]!, b = p[(i + 1) % n]!;
    const n1 = norm2([-(c[1] - a[1]) * s, (c[0] - a[0]) * s]), n2 = norm2([-(b[1] - c[1]) * s, (b[0] - c[0]) * s]);
    const m = norm2([n1[0] + n2[0], n1[1] + n2[1]]), k = d / Math.max(0.3, m[0] * n1[0] + m[1] * n1[1]);
    return [c[0] + m[0] * k, c[1] + m[1] * k];
  });
}
const norm2 = (v: [number, number]): [number, number] => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };

/** vastag tető: a felület (felső sík) lefelé eltolt másolata + a szabad élek mentén oldallapok */
function vastagTeto(pos: number[], vast: number): THREE.BufferGeometry {
  const ki: number[] = [...pos];
  for (let i = 0; i < pos.length; i += 9) { // alsó sík (fordított körüljárással)
    ki.push(pos[i]!, pos[i + 1]! - vast, pos[i + 2]!, pos[i + 6]!, pos[i + 7]! - vast, pos[i + 8]!, pos[i + 3]!, pos[i + 4]! - vast, pos[i + 5]!);
  }
  const kulcs = (x: number, y: number, z: number) => `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
  const elek = new Map<string, { a: number[]; b: number[]; db: number }>();
  for (let i = 0; i < pos.length; i += 9) for (const [u, v] of [[0, 1], [1, 2], [2, 0]] as const) {
    const a = pos.slice(i + u * 3, i + u * 3 + 3), b = pos.slice(i + v * 3, i + v * 3 + 3);
    const k1 = kulcs(a[0]!, a[1]!, a[2]!), k2 = kulcs(b[0]!, b[1]!, b[2]!), k = k1 < k2 ? k1 + '|' + k2 : k2 + '|' + k1;
    const x = elek.get(k); if (x) x.db++; else elek.set(k, { a, b, db: 1 });
  }
  for (const { a, b, db } of elek.values()) { if (db !== 1) continue;
    ki.push(a[0]!, a[1]!, a[2]!, b[0]!, b[1]!, b[2]!, b[0]!, b[1]! - vast, b[2]!, a[0]!, a[1]!, a[2]!, b[0]!, b[1]! - vast, b[2]!, a[0]!, a[1]! - vast, a[2]!); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(ki, 3)); g.computeVertexNormals(); return g;
}

/** A ferde tető vastagsága (m): a metszet ferde tetős rétegrendjéből (fa / fedés), különben 28 cm. */
export function tetoVastag(modell: EpuletModell): number {
  const r = (modell.retegrendek ?? []).filter((x) => x.szerep === 'teto' && (/tetoter|ferde|magas/i.test(x.kovetelmeny ?? '')
    || /fedés|cserép|cserep|lemez|zsindely|szaruf/i.test(x.cim) || x.retegek.some((q) => /fa\b|fa$|^fa|szaruf/i.test(q.anyag?.kategoria ?? q.anyag?.nev ?? ''))));
  const v = r.map((x) => x.retegek.reduce((t, q) => t + (q.vastag ?? 0), 0)).filter((x) => x > 0.08 && x < 0.8);
  return v.length ? Math.max(0.15, Math.min(0.6, Math.max(...v))) : 0.28;
}

/** Mennyivel kell a fal két végét visszavágni, hogy T-csatlakozásban a másik fal síkjáig érjen (és ne a tengelyéig). */
function tCsonk(f: Fal, falak: Fal[], L: number): [number, number] {
  const u: [number, number] = [(f.b[0] - f.a[0]) / L, (f.b[1] - f.a[1]) / L];
  const vag = (P: [number, number], kifele: [number, number]) => {
    let leg = 0;
    for (const h of falak) {
      if (h === f || h.szint !== f.szint) continue;
      const Lh = Math.hypot(h.b[0] - h.a[0], h.b[1] - h.a[1]); if (Lh < 0.1) continue;
      const v: [number, number] = [(h.b[0] - h.a[0]) / Lh, (h.b[1] - h.a[1]) / Lh];
      if (Math.abs(u[0] * v[0] + u[1] * v[1]) > 0.17) continue; // csak (közel) merőleges gazdafal
      const s = (P[0] - h.a[0]) * v[0] + (P[1] - h.a[1]) * v[1];
      if (s < h.vastag / 2 + 0.05 || s > Lh - h.vastag / 2 - 0.05) continue; // a gazdafal végénél sarok – nem T
      const d = -(P[0] - h.a[0]) * v[1] + (P[1] - h.a[1]) * v[0];      // P távolsága a gazdafal tengelyétől
      if (Math.abs(d) > h.vastag / 2 + 0.005) continue;                 // P nincs a gazdafal testében
      // a fal a gazdafal melyik oldaláról jön: onnan a síkig vágunk
      const be = -kifele[0] * -v[1] + -kifele[1] * v[0];                 // a fal befelé mutató irányának normálkomponense
      if (Math.abs(be) < 0.2) continue;
      const sik = be > 0 ? h.vastag / 2 : -h.vastag / 2;                // a gazdafal síkja a fal felőli oldalon
      const kell = (sik - d) / be;                                       // ennyit kell visszahúzni a fal belseje felé
      if (kell > leg && kell < L / 2 - 0.05) leg = kell;
    }
    return leg;
  };
  return [vag(f.a, [-u[0], -u[1]]), vag(f.b, u)];
}
/** a profil (t: 0..1 a régi hosszon) a levágott falra */
function profilVag(pr: { t: number; z: number }[], L: number, ta: number, tb: number) {
  const L2 = L - ta - tb, z = (t: number) => { for (let i = 1; i < pr.length; i++) { const a = pr[i - 1]!, b = pr[i]!; if (t <= b.t + 1e-9) return a.z + ((b.z - a.z) * (t - a.t)) / Math.max(1e-9, b.t - a.t); } return pr[pr.length - 1]!.z; };
  const t0 = ta / L, t1 = 1 - tb / L;
  const pont = [{ t: t0, z: z(t0) }, ...pr.filter((q) => q.t > t0 + 1e-6 && q.t < t1 - 1e-6), { t: t1, z: z(t1) }];
  return pont.map((q) => ({ t: (q.t * L - ta) / L2, z: q.z }));
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
  const valodi = modell.falak.filter((f) => f.szerkezet !== 'hatar');
  for (const f of modell.falak) {
    if (f.szerkezet === 'hatar') continue; // helyiséghatár, nem fal
    const dx = f.b[0] - f.a[0], dy = f.b[1] - f.a[1], L = Math.hypot(dx, dy); if (L < 0.05) continue;
    const ny = nyFal.get(f.id) ?? [], rot = -Math.atan2(dy, dx), adat: EpuletForras = { fajta: 'fal', fal: f };
    // a T-csatlakozásban a fal vége a másik fal síkjáig (a tengelyig húzott vég a homlokzaton függőleges vonalként látszana)
    const [ta, tb] = tCsonk(f, valodi, L);
    const f2: Fal = ta || tb ? { ...f, a: [f.a[0] + (dx / L) * ta, f.a[1] + (dy / L) * ta], b: [f.b[0] - (dx / L) * tb, f.b[1] - (dy / L) * tb],
      ...(f.profil ? { profil: profilVag(f.profil, L, ta, tb) } : {}) } : f;
    const L2 = L - ta - tb, ny2 = ta ? ny.map((n) => ({ ...n, t: n.t - ta })) : ny;
    const test = L2 > 0.05 ? falTest(f2, ny2, L2) : null;
    if (test) ki.push({ id: f.id, tipus: 'fal', szint: f.szint, geo: beeget(test, f2.a[0], f.z0, f2.a[1], rot), adat });
    else for (const d of falDarabok(f, ny)) {
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
  // (a koszorú a nyílásokba nem lóghat bele: a nyílás fölötti / melletti része marad – Balázs, 2026-11-21)
  for (const k of modell.koszoruk ?? []) for (const id of k.falak) {
    const f = falIx.get(id); if (!f) continue;
    const dx = f.b[0] - f.a[0], dy = f.b[1] - f.a[1], L = Math.hypot(dx, dy); if (L < 0.05) continue;
    const lyuk = (nyFal.get(id) ?? []).map((n) => ({ t0: n.t - n.szel / 2, t1: n.t + n.szel / 2, z0: f.z0 + n.pm, z1: f.z0 + n.pm + n.mag }));
    for (const d of savDarabok(L, k.zFelso - k.magas, k.zFelso, lyuk)) {
      const tm = (d.t0 + d.t1) / 2;
      ki.push({ id: k.id, tipus: 'piller', szint: k.szint, geo: beeget(new THREE.BoxGeometry(d.t1 - d.t0, d.z1 - d.z0, Math.min(k.szel, f.vastag - 0.04)),  /* (a falon belül: a homlokzaton ne látsszon vonalként) */ f.a[0] + (dx / L) * tm, (d.z0 + d.z1) / 2, f.a[1] + (dy / L) * tm, -Math.atan2(dy, dx)),
        adat: { fajta: 'koszoru', id: k.id, fal: id, attika: k.fajta === 'attika' } satisfies EpuletForras });
    }
  }
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
    // a tető VASTAG test (Balázs, 2026-11-21: „tetőnek legyen vastagsága”): a felület a felső sík, lefelé a ferde tető
    // rétegrendjének vastagságával (a metszetből; ennek híján 28 cm), függőlegesen mérve (÷ cos hajlás)
    const tv = tetoVastag(modell) / Math.cos((Math.min(60, modell.magasteto.hajlas) * Math.PI) / 180);
    const pos: number[] = []; for (const h of modell.magasteto.haromszogek) for (const [x, y, z] of h) pos.push(x!, z!, y!);
    ki.push({ id: 'TETO', tipus: 'teto', szint: modell.magasteto.szint, geo: vastagTeto(pos, tv), adat: { fajta: 'teto', id: 'TETO' } satisfies EpuletForras });
    // (felülről nyitott belső tér nincs): a legfelső szint födémjének síkjában; befelé húzva, hogy a falsíkon ne látsszon sávként
    const ft = modell.fodemek.find((f) => f.alatt === modell.magasteto!.szint);
    if (ft) (modell.magasteto.lapos ?? []).forEach((p, i) => {
      if (p.length < 3) return;
      const g2 = new THREE.ExtrudeGeometry(new THREE.Shape(befele(p, 0.02).map(([x, y]) => new THREE.Vector2(x, y))), { depth: ft.vastag, bevelEnabled: false }); g2.rotateX(Math.PI / 2); g2.translate(0, ft.z, 0);
      ki.push({ id: `LAPOS-${i + 1}`, tipus: 'teto', szint: modell.magasteto!.szint, geo: g2, adat: { fajta: 'lapos', id: `LAPOS-${i + 1}`, fodem: ft.id } satisfies EpuletForras });
    });
  }
  // pillérek. A legalsó szint SZABADON ÁLLÓ pillére (terasz, előtető) a képen a pontalapjáig, ennek híján a talajon
  // fekvő padló aljáig ér – különben a ház alatti sáv mellett „lebeg”. (Csak megjelenítés: a pillér magassága marad.)
  const padloAlj = Math.min(0, ...modell.fodemek.filter((fd) => fd.alatt === null).map((fd) => fd.z - fd.vastag));
  const pontalap = new Map((modell.alapozas ?? []).filter((a) => a.fajta === 'pontalap' && a.piller).map((a) => [a.piller!, a]));
  const falVast = new Map(modell.falak.map((f) => [f.id, f.vastag]));
  for (const p of modell.pillerek ?? []) {
    // a falban álló pillér a falon belül van (különben sávként lóg ki a homlokzatból)
    if (p.hely !== 'szabad' && p.falId && Math.min(p.a, p.b) <= (falVast.get(p.falId) ?? 0) + 0.02) continue;
    const lent = p.hely === 'szabad' && Math.abs(p.z0 - zMin0) < 0.01;
    const z0 = lent ? Math.min(p.z0, pontalap.get(p.id)?.zFelso ?? padloAlj) : p.z0, z1 = p.z0 + p.h;
    ki.push({ id: p.id, tipus: 'piller', szint: p.szint, geo: beeget(new THREE.BoxGeometry(p.a, z1 - z0, p.b), p.kozep[0], (z0 + z1) / 2, p.kozep[1]), adat: { fajta: 'piller', id: p.id } satisfies EpuletForras });
  }
  // födémek (tető / legalsó padló; a közbenső, ha a metszetből ismert a rétegrendje – az ELBA-nak mind)
  for (const fd of modell.fodemek) {
    if (!opc.mindenFodem && fd.burok !== 'teto' && fd.burok !== 'padlo' && !fd.retegek) continue;
    if (fd.burok === 'teto' && fd.alatt && tetoSzint.has(fd.alatt)) continue;
    // a magastető alatti legfelső födém padlásfödém (nem tető): födémként, befelé húzva (a falsíkon ne legyen barna sáv)
    const padlas = fd.burok === 'teto' && !!modell.magasteto && fd.alatt === modell.magasteto.szint;
    const tipus = fd.burok === 'teto' && !padlas ? 'teto' : fd.alatt === null ? 'padlo' : 'fodem';
    for (const p0 of fd.poligonok) {
      if (p0.length < 3) continue;
      const p = padlas ? befele(p0, 0.02) : p0;
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
