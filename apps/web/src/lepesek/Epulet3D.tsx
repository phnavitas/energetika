/**
 * A teljes épületmodell 3D nézete (three.js): falak (nyílásokkal kivágva), terek padlója, födémek; a hőburok elemei
 * kiemelve. Forgatás: bal egérgomb húzása; mozgatás: jobb gomb / Shift; nagyítás: görgő.
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { falFelulet, type EpuletModell, type Fal, type BurokSzerep } from '@terv/epulet';
import { tetoGeo } from '@terv/teto';
import type { ZartsagHiba } from '@terv/zartsag';

const SZIN = {
  fal: 0xd8d2c4, falKulso: 0xc9bfa8, burok: 0xe8833a, futetlen: 0x5b9bd5, szomszed: 0x9ca3af, talaj: 0x8b6b4a,
  nyilas: 0x7fb7e6, padloFutott: 0xf3e3b5, padloFutetlen: 0xd5e3f0, padloKulter: 0xcfe8c5, fodem: 0xb8b0d8, piller: 0x8a8f99, teto: 0xb5643f,
};
/** Anyag szerinti alapszínek (ha a modell nem hoz színt): törtfehér fal, sötétebb barna tető, szürke alapozás, sötét
 *  nyílászáró-keret, még sötétebb szürke üveg / kapulap (Balázs, 2026-11-21). */
const ANYAG = {
  fal: 0xf1ede4, falKulso: 0xf1ede4, teto: 0x744a2c, lapos: 0x7d5a40, alapozas: 0x9aa0a6, padlo: 0xa3a8ad, fodem: 0xe3dfd6,
  ter: 0xdcd5c6, terFutetlen: 0xd3d6d9, terKulter: 0xd6dccb, beton: 0xbcc0c5, keret: 0x30343a, uveg: 0x22262b, kij: 0xf97316,
};
const EL_SZIN = 0x3c3c3c;
/** Típusonként állítható megjelenés (szín, átlátszóság) – a böngészőben megjegyezve. */
const TIPUSOK = [
  ['fal', 'Fal', ANYAG.fal], ['teto', 'Tető', ANYAG.teto], ['nyilaszaro', 'Nyílászáró keret', ANYAG.keret], ['uveg', 'Üveg / ajtólap', ANYAG.uveg],
  ['fodem', 'Födém', ANYAG.fodem], ['padlo', 'Talajon fekvő lemez', ANYAG.padlo], ['alapozas', 'Alapozás', ANYAG.alapozas], ['piller', 'Pillér, koszorú', ANYAG.beton], ['ter', 'Helyiség padlója', ANYAG.ter],
] as const;
type Tipus = typeof TIPUSOK[number][0];
type TipusBeall = Partial<Record<Tipus, { szin?: number; atl?: number }>>;
const BEALL_KULCS = 'ekm-3d-tipus-v1';
const beallOlvas = (): TipusBeall => { try { return JSON.parse(localStorage.getItem(BEALL_KULCS) ?? '{}') as TipusBeall; } catch { return {}; } };
const burokSzin = (b: BurokSzerep) => (b === 'kulso' ? SZIN.burok : b === 'futetlen' ? SZIN.futetlen : b === 'szomszed' ? SZIN.szomszed : b === 'talaj' ? SZIN.talaj : null);

/** Fal hasábjai a nyílások kivágásával (a fal hossza mentén szakaszokra bontva). */
function falDarabok(f: Fal, ny: { t: number; szel: number; mag: number; pm: number }[]): { t0: number; t1: number; z0: number; z1: number }[] {
  const L = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]);
  const h = f.h;
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

export type NyilasForras = { lap: number; ny: number };
export function Epulet3D({ modell, magassag = 600, kivNy, onNyilas, onElem, hibak }: { modell: EpuletModell; magassag?: number;
  /** Kattintással kijelölt elem (fal, nyílás, tér) azonosítója – a 2D rajzon kiemeléshez. */
  onElem?: (id: string | null) => void;
  /** A zártság-ellenőrzés hibái: piros jelölés a modellben (hiányzó fal, rés, tetőhézag, fedetlen rész). */
  hibak?: ZartsagHiba[];
  /** A kijelölt nyílászáró (forrása: lap és nyílásindex) – kiemelve; kattintásra onNyilas. */
  kivNy?: NyilasForras | null; onNyilas?: (f: NyilasForras | null) => void }) {
  const hely = useRef<HTMLDivElement>(null);
  // a nézőpont megmarad az újrarajzoláskor (kijelölés, méretmódosítás)
  const nezo = useRef<{ p: THREE.Vector3; t: THREE.Vector3; z?: number } | null>(null);
  const [csakBurok, setCsakBurok] = useState(false);
  const [szintLathato, setSzintLathato] = useState<Record<string, boolean>>({});
  const [kijelolt, setKijelolt] = useState<string | null>(null);
  /** Színezés: anyag szerint (alap) vagy hőburok-szerep szerint; röntgen (áttetsző) az átlátszóság fokával; csak a kijelölt. */
  const [szinezes, setSzinezes] = useState<'anyag' | 'hoburok'>('anyag');
  const [rontgen, setRontgen] = useState(false);
  const [atl, setAtl] = useState(0.18);
  const [csakKij, setCsakKij] = useState(false);
  /** Vízszintes metszés (a vágósík magassága, m; null: nincs), környezeti árnyékolás, párhuzamos vetítés, típusonkénti megjelenés. */
  const [metsz, setMetsz] = useState<number | null>(null);
  const [ao, setAo] = useState(true);
  const [orto, setOrto] = useState(false);
  const [tipusB, setTipusB] = useState<TipusBeall>(() => beallOlvas());
  const tipusAllit = (t: Tipus, v: { szin?: number; atl?: number } | null) => setTipusB((x) => { const u = { ...x }; if (v === null) delete u[t]; else u[t] = { ...u[t], ...v }; try { localStorage.setItem(BEALL_KULCS, JSON.stringify(u)); } catch { /* */ } return u; });
  const zTart = useMemo(() => { const z0 = Math.min(...modell.szintek.map((q) => q.z0)), z1 = Math.max(...modell.szintek.map((q) => q.z0 + q.h)); return [z0 - 1, z1 + 4] as const; }, [modell]);
  const lathato = (sz: string) => szintLathato[sz] !== false;

  // összesítés: falfelületek hőburok-szerep szerint, terek kategóriánként
  const osszeg = useMemo(() => {
    const bm = new Map(modell.szintek.map((s) => [s.id, s.belmag]));
    const ny = new Map<string, number>(); for (const n of modell.nyilasok) ny.set(n.fal, (ny.get(n.fal) ?? 0) + n.szel * n.mag);
    const o: Record<string, { A: number; ny: number }> = {};
    for (const f of modell.falak) { const k = f.burok ?? (f.kulso ? 'kulsoNem' : 'belso'); const x = (o[k] ??= { A: 0, ny: 0 }); x.A += falFelulet(f, bm.get(f.szint) ?? f.h); x.ny += ny.get(f.id) ?? 0; }
    return o;
  }, [modell]);

  useEffect(() => {
    const el = hely.current; if (!el) return;
    const w = el.clientWidth || 800, h = magassag;
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setSize(w, h); renderer.setClearColor(0xffffff);
    el.innerHTML = ''; el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    // (két irányból eső fény + égbolt: a szomszédos, eltérő irányú lapok más árnyalatot kapnak – nem olvadnak össze)
    scene.add(new THREE.HemisphereLight(0xffffff, 0x7d7d76, 0.75));
    const nap = new THREE.DirectionalLight(0xffffff, 0.85); nap.position.set(-30, 45, 50); scene.add(nap);
    const nap2 = new THREE.DirectionalLight(0xffffff, 0.3); nap2.position.set(40, 20, -35); scene.add(nap2);
    // modell → three: x = x, y = z (fel), z = y (a lap y lefelé – a néző felé)
    const grp = new THREE.Group(); scene.add(grp);
    const nyFal = new Map<string, typeof modell.nyilasok>(); for (const n of modell.nyilasok) nyFal.set(n.fal, [...(nyFal.get(n.fal) ?? []), n]);
    const anyagSz = szinezes === 'anyag';
    const alapSz = Object.fromEntries(TIPUSOK.map(([k, , c]) => [k, c])) as Record<Tipus, number>;
    /** a típus színe és átlátszósága (anyag szerinti színezésnél a beállítás szerint) */
    const tsz = (t: Tipus) => tipusB[t]?.szin ?? alapSz[t];
    const tat = (t: Tipus, alap = 1) => (anyagSz ? tipusB[t]?.atl ?? alap : alap);
    // globális vágósík: az árnyékolás (GTAO) saját mélység/normál anyagaira is hat
    const vag: THREE.Plane[] = [];
    const vagottAlatt = (x: THREE.Intersection) => metsz === null || x.point.y <= metsz + 1e-3; // a levágott rész nem kattintható
    renderer.clippingPlanes = metsz !== null ? [new THREE.Plane(new THREE.Vector3(0, -1, 0), metsz)] : [];
    const anyag = new Map<string, THREE.Material>();
    // (röntgenben minden áttetsző – a fokot a csúszka adja –, a kijelölt tömör és mindenen átlátszik)
    const mat = (c: number, atl0 = 1, kij = false) => {
      const o = kij ? 1 : rontgen ? Math.min(atl0, atl) : anyagSz ? (atl0 < 1 ? atl0 : 1) : atl0;
      const k = `${c}|${o.toFixed(2)}|${kij ? 1 : 0}`; let m = anyag.get(k) as THREE.MeshLambertMaterial | undefined;
      if (!m) { m = new THREE.MeshLambertMaterial({ color: c, transparent: o < 1, opacity: o, side: THREE.DoubleSide, depthWrite: o >= 1, clippingPlanes: vag,
        polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, ...(kij && rontgen ? { depthTest: false } : {}) }); anyag.set(k, m); }
      return m;
    };
    const elMat = new THREE.LineBasicMaterial({ color: EL_SZIN, transparent: true, opacity: rontgen ? 0.22 : 0.5, clippingPlanes: vag });
    const elMatKij = new THREE.LineBasicMaterial({ color: 0xc2410c, transparent: true, opacity: 0.95, depthTest: !rontgen, clippingPlanes: vag });
    /** él-kontúr a testre (a szomszédos elemek határa látszik) */
    const elek = (m: THREE.Mesh, kij = false) => { const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 25), kij ? elMatKij : elMat); if (kij) e.renderOrder = 11; m.add(e); if (kij && rontgen) m.renderOrder = 10; return m; };
    /** csak a kijelölt elem (és a hozzá tartozó nyílások) látszik */
    const rejt = (id: string | undefined) => csakKij && !!kijelolt && id !== kijelolt;
    const kattinthato: THREE.Object3D[] = [];
    for (const f of modell.falak) {
      if (!lathato(f.szint)) continue;
      if (f.szerkezet === 'hatar') continue; // helyiséghatár, nem fal
      const bsz = burokSzin(f.burok);
      if (csakBurok && bsz === null) continue;
      const dx = f.b[0] - f.a[0], dy = f.b[1] - f.a[1], L = Math.hypot(dx, dy); if (L < 0.05) continue;
      const fk = kijelolt === f.id;
      const szin = fk ? ANYAG.kij : anyagSz ? tsz('fal') : bsz ?? (f.kulso ? SZIN.falKulso : SZIN.fal), falAtl = fk ? 1 : tat('fal');
      const ny = (nyFal.get(f.id) ?? []);
      const falRejt = rejt(f.id) && !ny.some((n) => n.id === kijelolt);
      if (f.profil && f.profil.length >= 2) {
        // ferde / tört felső élű fal (tetőtér): síkidom a fal hosszán, a nyílások lyukként, falvastagságnyi kihúzással
        const off = f.h - Math.max(...f.profil.map((q) => q.z));
        const sh = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(L, 0), ...f.profil.slice().reverse().map((q) => new THREE.Vector2(q.t * L, q.z + off))]);
        for (const n of ny) { const t0 = Math.max(0.01, n.t - n.szel / 2), t1 = Math.min(L - 0.01, n.t + n.szel / 2), z0 = Math.max(0.01, n.pm), z1 = n.pm + n.mag; if (t1 > t0 + 0.05 && z1 > z0 + 0.05) sh.holes.push(new THREE.Path([new THREE.Vector2(t0, z0), new THREE.Vector2(t1, z0), new THREE.Vector2(t1, z1), new THREE.Vector2(t0, z1)])); }
        const g = new THREE.ExtrudeGeometry(sh, { depth: f.vastag, bevelEnabled: false }); g.translate(0, 0, -f.vastag / 2);
        if (!falRejt) { const m = new THREE.Mesh(g, mat(szin, falAtl, fk));
        m.position.set(f.a[0], f.z0, f.a[1]); m.rotation.y = -Math.atan2(dy, dx);
        m.userData = { id: f.id }; grp.add(elek(m, fk)); kattinthato.push(m); }
      } else if (!falRejt)
      for (const d of falDarabok(f, ny)) {
        const g = new THREE.BoxGeometry(d.t1 - d.t0, d.z1 - d.z0, f.vastag);
        const m = new THREE.Mesh(g, mat(szin, falAtl, fk));
        const tm = (d.t0 + d.t1) / 2;
        m.position.set(f.a[0] + (dx / L) * tm, f.z0 + (d.z0 + d.z1) / 2, f.a[1] + (dy / L) * tm);
        m.rotation.y = -Math.atan2(dy, dx);
        m.userData = { id: f.id }; grp.add(elek(m, fk)); kattinthato.push(m);
      }
      // nyílászárók: sötét keret (≈ 6 cm-es tok) és sötétebb szürke üveg / ajtó- és kapulap – kattintással kijelölhetők
      for (const n of ny) {
        const kiv = (!!kivNy && !!n.forras && n.forras.lap === kivNy.lap && n.forras.ny === kivNy.ny) || kijelolt === n.id;
        if (rejt(n.id) && !(kijelolt === f.id)) continue;
        const ny0 = new THREE.Group(); ny0.position.set(f.a[0] + (dx / L) * n.t, f.z0 + n.pm + n.mag / 2, f.a[1] + (dy / L) * n.t); ny0.rotation.y = -Math.atan2(dy, dx);
        const tok = Math.min(0.07, n.szel / 6, n.mag / 6), mely = Math.max(0.06, Math.min(0.12, f.vastag * 0.4));
        const resz = (sx: number, sy: number, sz0: number, x: number, y: number, c: number, o = 1) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz0), mat(kiv ? ANYAG.kij : c, o, kiv)); m.position.set(x, y, 0); m.userData = { id: n.id, ny: n.forras }; ny0.add(elek(m, kiv)); kattinthato.push(m); };
        const kc = anyagSz ? tsz('nyilaszaro') : SZIN.nyilas, ko = tat('nyilaszaro');
        resz(n.szel, tok, mely, 0, n.mag / 2 - tok / 2, kc, ko); resz(n.szel, tok, mely, 0, -n.mag / 2 + tok / 2, kc, ko);
        resz(tok, n.mag - 2 * tok, mely, -n.szel / 2 + tok / 2, 0, kc, ko); resz(tok, n.mag - 2 * tok, mely, n.szel / 2 - tok / 2, 0, kc, ko);
        resz(n.szel - 2 * tok, n.mag - 2 * tok, 0.03, 0, 0, anyagSz ? tsz('uveg') : SZIN.nyilas, anyagSz ? tat('uveg', 0.92) : 0.55);
        grp.add(ny0);
      }
    }
    // terek padlója
    for (const t of modell.terek) {
      if (!lathato(t.szint) || csakBurok) continue;
      const sz0 = modell.szintek.find((s) => s.id === t.szint); if (!sz0) continue;
      for (const p of t.poligonok) {
        if (p.length < 3) continue;
        const sh = new THREE.Shape(p.map(([x, y]) => new THREE.Vector2(x, y)));
        const g = new THREE.ShapeGeometry(sh); g.rotateX(Math.PI / 2);
        const tk = kijelolt === t.id; if (rejt(t.id)) continue;
        const m = new THREE.Mesh(g, mat(tk ? ANYAG.kij : anyagSz ? (t.kategoria === 'futott' ? tsz('ter') : t.kategoria === 'futetlen' ? ANYAG.terFutetlen : ANYAG.terKulter) : t.kategoria === 'futott' ? SZIN.padloFutott : t.kategoria === 'futetlen' ? SZIN.padloFutetlen : SZIN.padloKulter, tk ? 1 : tat('ter'), tk));
        m.position.y = sz0.z0 + 0.02; m.userData = { id: t.id }; grp.add(m); kattinthato.push(m);
      }
    }
    // tetőtér: a tetőfelület (térdfal → ferde tetősík → padlásfödém) magasságmezőként, 0,25 m-es rácson
    const tetoSzint = new Set((modell.tetok ?? []).map((t) => t.szint));
    for (const t of modell.tetok ?? []) {
      if (!lathato(t.szint)) continue;
      for (const p of t.poligonok) {
        if (p.length < 3) continue;
        const g = tetoGeo(p, t, t.orom), c = 0.25;
        const bx = [Math.min(...p.map((q) => q[0])), Math.max(...p.map((q) => q[0]))], by = [Math.min(...p.map((q) => q[1])), Math.max(...p.map((q) => q[1]))];
        const benn = (x: number, y: number) => { let b = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const a = p[i]!, d = p[j]!; if ((a[1] > y) !== (d[1] > y) && x < ((d[0] - a[0]) * (y - a[1])) / (d[1] - a[1]) + a[0]) b = !b; } return b; };
        const pos: number[] = [];
        for (let x = bx[0]!; x < bx[1]!; x += c) for (let y = by[0]!; y < by[1]!; y += c) {
          if (!benn(x + c / 2, y + c / 2)) continue;
          const z = (u: number, v: number) => t.z0 + g.H([u, v]) + 0.02;
          const P = [[x, y], [x + c, y], [x + c, y + c], [x, y + c]] as const;
          const Z = P.map(([u, v]) => z(u, v));
          for (const [i0, i1, i2] of [[0, 1, 2], [0, 2, 3]] as const) for (const i of [i0, i1, i2]) pos.push(P[i]![0], Z[i]!, P[i]![1]);
        }
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals();
        if (csakKij && kijelolt) continue;
        const m = new THREE.Mesh(geo, mat(anyagSz ? tsz('teto') : SZIN.teto, anyagSz ? tat('teto') : 0.45)); grp.add(m);
      }
    }
    // koszorúk (a falak tengelyén) és gerendák
    const rud = (a: [number, number], b: [number, number], szel: number, z0: number, z1: number, szin: number) => {
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l < 0.05 || z1 <= z0) return;
      if (csakKij && kijelolt) return;
      const m = new THREE.Mesh(new THREE.BoxGeometry(l, z1 - z0, szel), mat(anyagSz ? (szin === -1 ? tsz('alapozas') : tsz('piller')) : szin === -1 ? 0x9aa0a6 : szin, anyagSz ? tat(szin === -1 ? 'alapozas' : 'piller') : 0.9));
      m.position.set((a[0] + b[0]) / 2, (z0 + z1) / 2, (a[1] + b[1]) / 2); m.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0]); grp.add(elek(m));
    };
    const falIx = new Map(modell.falak.map((f) => [f.id, f]));
    for (const k of modell.koszoruk ?? []) { if (!lathato(k.szint)) continue;
      for (const id of k.falak) { const f = falIx.get(id); if (f) rud(f.a, f.b, k.szel, k.zFelso - k.magas, k.zFelso, SZIN.piller); } }
    for (const g of modell.gerendak ?? []) if (lathato(g.szint)) rud(g.a, g.b, g.szel, g.alsoSik, g.felsoSik, SZIN.piller);
    // alapozás (sávalap, lábazat a falak alatt; pontalap a pillér alatt) – szürke
    const pIx = new Map((modell.pillerek ?? []).map((p) => [p.id, p]));
    if (modell.szintek.some((s0) => lathato(s0.id) && s0.z0 <= (Math.min(...modell.szintek.map((q) => q.z0)) + 0.01))) for (const a of modell.alapozas ?? []) {
      if (a.fajta === 'pontalap') { const p = a.piller ? pIx.get(a.piller) : undefined; if (p) rud([p.kozep[0] - a.szel / 2, p.kozep[1]], [p.kozep[0] + a.szel / 2, p.kozep[1]], a.szel, a.zFelso - a.magas, a.zFelso, -1); continue; }
      if (a.fajta === 'lemezalap') continue;
      for (const id of a.falak) { const f = falIx.get(id); if (f) rud(f.a, f.b, a.szel, a.zFelso - a.magas, a.zFelso, -1); }
    }
    // magastető (a modell tetőfelülete háromszögekben)
    if (modell.magasteto && lathato(modell.magasteto.szint)) {
      const pos: number[] = []; for (const h of modell.magasteto.haromszogek) for (const [x, y, z] of h) pos.push(x!, z!, y!);
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
      if (!(csakKij && kijelolt)) { const m = new THREE.Mesh(g, mat(anyagSz ? tsz('teto') : SZIN.teto, anyagSz ? tat('teto') : 0.85)); (m.material as THREE.Material).side = THREE.DoubleSide; grp.add(elek(m)); }
      // a magastető nélküli részek lapostetője (felülről nyitott belső tér nincs): a legfelső szint födémjének síkjában
      const ft = modell.fodemek.find((f) => f.alatt === modell.magasteto!.szint);
      if (ft && !(csakKij && kijelolt)) for (const p of modell.magasteto.lapos ?? []) {
        if (p.length < 3) continue;
        const sh = new THREE.Shape(p.map(([x, y]) => new THREE.Vector2(x, y)));
        const g2 = new THREE.ExtrudeGeometry(sh, { depth: ft.vastag, bevelEnabled: false }); g2.rotateX(Math.PI / 2);
        const m2 = new THREE.Mesh(g2, mat(anyagSz ? tsz('teto') : SZIN.teto, anyagSz ? tat('teto') : 0.6)); m2.position.y = ft.z; grp.add(elek(m2));
      }
    }
    // pillérek
    for (const p of modell.pillerek ?? []) {
      if (!lathato(p.szint)) continue;
      if (csakKij && kijelolt) continue;
      const g = new THREE.BoxGeometry(p.a, p.h, p.b); const m = new THREE.Mesh(g, mat(anyagSz ? tsz('piller') : SZIN.piller, anyagSz ? tat('piller') : 0.95));
      m.position.set(p.kozep[0], p.z0 + p.h / 2, p.kozep[1]); grp.add(elek(m));
    }
    // födémek (tető / legalsó padló) körvonallal, áttetszően
    for (const fd of modell.fodemek) {
      const sz = fd.folott ?? fd.alatt; if (sz && !lathato(sz)) continue;
      // (a közbenső födém akkor, ha a metszetből ismert a rétegrendje)
      if (fd.burok !== 'teto' && fd.burok !== 'padlo' && !fd.retegek) continue;
      if (fd.burok === 'teto' && fd.alatt && tetoSzint.has(fd.alatt)) continue;
      for (const p of fd.poligonok) {
        if (p.length < 3) continue;
        const sh = new THREE.Shape(p.map(([x, y]) => new THREE.Vector2(x, y)));
        const g = new THREE.ExtrudeGeometry(sh, { depth: fd.vastag, bevelEnabled: false }); g.rotateX(Math.PI / 2);
        if (csakKij && kijelolt) continue;
        const ft0: Tipus = fd.burok === 'teto' ? 'teto' : fd.alatt === null ? 'padlo' : 'fodem';
        const c = anyagSz ? tsz(ft0) : fd.burok === 'teto' ? SZIN.teto : SZIN.fodem;
        const m = new THREE.Mesh(g, mat(c, anyagSz ? tat(ft0) : fd.burok === 'teto' ? 0.35 : 0.5));
        m.position.y = fd.z; grp.add(elek(m)); // (z a födém teteje, lefelé vastag)
      }
    }
    // a zártság-ellenőrzés hibái: piros, áttetsző jelölés (hiányzó fal sávja, rés / hézag helye)
    const jelolt = new THREE.MeshBasicMaterial({ color: 0xdc2626, transparent: true, opacity: 0.55, depthTest: false, side: THREE.DoubleSide });
    for (const hb of hibak ?? []) {
      const sz0 = modell.szintek.find((q) => q.id === hb.szint); const z0 = sz0?.z0 ?? 0, hh = sz0?.h ?? 3;
      if (hb.a && hb.b && hb.fajta === 'fal') {
        const L = Math.hypot(hb.b[0] - hb.a[0], hb.b[1] - hb.a[1]); if (L < 0.05) continue;
        const m = new THREE.Mesh(new THREE.BoxGeometry(L, hh, 0.15), jelolt); m.renderOrder = 10;
        m.position.set((hb.a[0] + hb.b[0]) / 2, z0 + hh / 2, (hb.a[1] + hb.b[1]) / 2); m.rotation.y = -Math.atan2(hb.b[1] - hb.a[1], hb.b[0] - hb.a[0]); grp.add(m);
      } else {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), jelolt); m.renderOrder = 10;
        m.position.set(hb.hely[0], z0 + hh + (hb.fajta === 'teto' ? 1.5 : 0.5), hb.hely[1]); grp.add(m);
      }
    }
    // kamera a modell befoglalójához
    const bb = new THREE.Box3().setFromObject(grp); const c = bb.getCenter(new THREE.Vector3()); const R = Math.max(5, bb.getSize(new THREE.Vector3()).length() / 2);
    // kamera: perspektivikus vagy párhuzamos (axonometrikus) vetítés
    const cam: THREE.PerspectiveCamera | THREE.OrthographicCamera = orto
      ? new THREE.OrthographicCamera(-R * 1.1 * (w / h), R * 1.1 * (w / h), R * 1.1, -R * 1.1, -R * 20, R * 40)
      : new THREE.PerspectiveCamera(40, w / h, 0.1, R * 20);
    const alapNezet = () => { cam.position.set(c.x - R * 1.2, c.y + R * 1.0, c.z + R * 1.6); ctl.target.copy(c); if (cam instanceof THREE.OrthographicCamera) { cam.zoom = 1; cam.updateProjectionMatrix(); } ctl.update(); };
    cam.position.set(c.x - R * 1.2, c.y + R * 1.0, c.z + R * 1.6); cam.lookAt(c);
    const ctl = new OrbitControls(cam, renderer.domElement); ctl.target.copy(c);
    if (nezo.current) { cam.position.copy(nezo.current.p); ctl.target.copy(nezo.current.t); if (cam instanceof THREE.OrthographicCamera && nezo.current.z) { cam.zoom = nezo.current.z; cam.updateProjectionMatrix(); } }
    ctl.update();
    // dupla kattintás: ráközelítés az elemre (üres helyen: alapnézet)
    const ray0 = new THREE.Raycaster();
    renderer.domElement.addEventListener('dblclick', (e) => {
      const rr = renderer.domElement.getBoundingClientRect();
      ray0.setFromCamera(new THREE.Vector2(((e.clientX - rr.left) / rr.width) * 2 - 1, -((e.clientY - rr.top) / rr.height) * 2 + 1), cam);
      const hit = ray0.intersectObjects(kattinthato).find(vagottAlatt);
      if (!hit) { nezo.current = null; alapNezet(); return; }
      const bb2 = new THREE.Box3().setFromObject(hit.object); const c2 = bb2.getCenter(new THREE.Vector3()); const r2 = Math.max(1.5, bb2.getSize(new THREE.Vector3()).length() * 1.2);
      const ir = cam.position.clone().sub(ctl.target).normalize();
      ctl.target.copy(c2); cam.position.copy(c2.clone().add(ir.multiplyScalar(r2 * 1.6)));
      if (cam instanceof THREE.OrthographicCamera) { cam.zoom = Math.max(1, R / r2); cam.updateProjectionMatrix(); }
      ctl.update();
    });
    // környezeti árnyékolás (GTAO): a sarkok, csatlakozások finoman sötétednek – röntgenben nem
    let composer: EffectComposer | null = null;
    if (ao && !rontgen) {
      try {
        composer = new EffectComposer(renderer); composer.setSize(w, h);
        composer.addPass(new RenderPass(scene, cam));
        const g = new GTAOPass(scene, cam, w, h); g.blendIntensity = 0.85; g.updateGtaoMaterial({ radius: Math.max(0.6, R * 0.04), distanceExponent: 1, thickness: 1, scale: 1, samples: 12 }); composer.addPass(g);
        composer.addPass(new OutputPass());
      } catch { composer = null; }
    }
    let fut = true; const loop = () => { if (!fut) return; if (composer) composer.render(); else renderer.render(scene, cam); requestAnimationFrame(loop); }; loop();
    // kattintás: elem kijelölése
    const ray = new THREE.Raycaster(); let le: [number, number] | null = null;
    const down = (e: PointerEvent) => { le = [e.clientX, e.clientY]; };
    const up = (e: PointerEvent) => {
      if (!le || Math.hypot(e.clientX - le[0], e.clientY - le[1]) > 4) return;
      const rr = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - rr.left) / rr.width) * 2 - 1, -((e.clientY - rr.top) / rr.height) * 2 + 1), cam);
      const hit = ray.intersectObjects(kattinthato).find(vagottAlatt); setKijelolt(hit ? (hit.object.userData.id as string) : null);
      onElem?.(hit ? (hit.object.userData.id as string) : null);
      onNyilas?.((hit?.object.userData.ny as NyilasForras | undefined) ?? null);
    };
    renderer.domElement.addEventListener('pointerdown', down); renderer.domElement.addEventListener('pointerup', up);
    (globalThis as { __epulet3dKep?: () => string }).__epulet3dKep = () => renderer.domElement.toDataURL('image/png');
    return () => { nezo.current = { p: cam.position.clone(), t: ctl.target.clone(), ...(cam instanceof THREE.OrthographicCamera ? { z: cam.zoom } : {}) }; fut = false; composer?.dispose(); ctl.dispose(); renderer.domElement.removeEventListener('pointerdown', down); renderer.domElement.removeEventListener('pointerup', up); renderer.dispose(); grp.traverse((o) => { if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose(); }); };
  }, [modell, csakBurok, szintLathato, kijelolt, magassag, kivNy?.lap, kivNy?.ny, hibak, szinezes, rontgen, atl, csakKij, metsz, ao, orto, tipusB]); // eslint-disable-line react-hooks/exhaustive-deps

  const info = (() => {
    if (!kijelolt) return null;
    const f = modell.falak.find((x) => x.id === kijelolt);
    const tNev = (o: Fal['bal']) => (o.fajta === 'ter' ? modell.terek.find((t) => t.id === o.ter)?.nev ?? o.ter : ({ kulso: 'külső tér', talaj: 'talaj', szomszed: 'szomszéd épület', futetlen: 'fűtetlen tér', belso: 'felirat nélküli belső tér', ismeretlen: 'ismeretlen' } as const)[o.fajta]);
    if (f) return `Fal · ${f.hossz.toFixed(2)} m × ${f.profil ? `${Math.min(...f.profil.map((q) => q.z)).toFixed(2)}–${Math.max(...f.profil.map((q) => q.z)).toFixed(2)}` : (f.belsoMag ?? f.h).toFixed(2)} m${f.jelleg ? ` (${({ terdfal: 'térdfal', oromfal: 'oromfal', parkany: 'alacsonyabb párkány', ferde: 'ferde felső élű' } as const)[f.jelleg]})` : ''}, ${Math.round(f.vastag * 100)} cm · ${tNev(f.bal)} | ${tNev(f.jobb)}${f.burok ? ` · hőburok: ${({ kulso: 'külső fal', futetlen: 'fűtetlen tér felé', szomszed: 'szomszéd felé', talaj: 'talajjal érintkező' } as const)[f.burok]}` : ''}`;
    const n = modell.nyilasok.find((x) => x.id === kijelolt);
    if (n) return `Nyílászáró · ${Math.round(n.szel * 100)} × ${Math.round(n.mag * 100)} cm, mellvéd ${Math.round(n.pm * 100)} cm · ${n.fajta.replace('_', ' ')}${onNyilas ? ' – a mérete a nyílászárók listájában átírható' : ''}`;
    const t = modell.terek.find((x) => x.id === kijelolt);
    if (t) return `${t.kod ? t.kod + ' ' : ''}${t.nev} · ${t.A.toFixed(2)} m² · belmagasság ${t.belmag.toFixed(2)} m · ${({ futott: 'fűtött', futetlen: 'fűtetlen', kulter: 'kültér' } as const)[t.kategoria]}`;
    return null;
  })();
  const fm = (v: number) => v.toLocaleString('hu-HU', { maximumFractionDigits: 1 });
  // a magastető felülete (a háromszögek valós, ferde területe) és a legalsó padló területe
  const tetoA = (modell.magasteto?.haromszogek ?? []).reduce((t, [a, b, c]) => { const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    return t + Math.hypot(u[1]! * v[2]! - u[2]! * v[1]!, u[2]! * v[0]! - u[0]! * v[2]!, u[0]! * v[1]! - u[1]! * v[0]!) / 2; }, 0);
  const polA = (p: [number, number][]) => Math.abs(p.reduce((q, a, i) => { const b = p[(i + 1) % p.length]!; return q + a[0] * b[1] - b[0] * a[1]; }, 0) / 2);
  const padloA = modell.fodemek.filter((f) => f.alatt === null).reduce((t, f) => t + f.poligonok.reduce((s, p) => s + polA(p), 0), 0);
  const laposA = (modell.magasteto?.lapos ?? []).reduce((t, p) => t + polA(p), 0);
  return (
    <div>
      <div class="gombsor" style="gap:8px;flex-wrap:wrap;align-items:center;padding:8px 10px">
        <span class="gombsor" style="gap:0" role="group" aria-label="Színezés">
          <button class={`gomb kis-gomb${szinezes === 'anyag' ? ' fo' : ''}`} onClick={() => setSzinezes('anyag')}>Anyag szerint</button>
          <button class={`gomb kis-gomb${szinezes === 'hoburok' ? ' fo' : ''}`} onClick={() => setSzinezes('hoburok')}>Hőburok szerint</button>
        </span>
        <label class="jelolo"><input type="checkbox" checked={rontgen} onChange={(e) => setRontgen((e.target as HTMLInputElement).checked)} /> röntgen</label>
        <input type="range" min="0.04" max="0.7" step="0.02" value={atl} disabled={!rontgen} aria-label="Röntgen átlátszóság" title="Röntgen: az elemek átlátszósága" style="width:90px"
          onInput={(e) => setAtl(Number((e.target as HTMLInputElement).value))} />
        <label class="jelolo" title="Csak a kijelölt elem látszik (kattints egy elemre)"><input type="checkbox" checked={csakKij} onChange={(e) => setCsakKij((e.target as HTMLInputElement).checked)} /> csak a kijelölt</label>
        <label class="jelolo"><input type="checkbox" checked={csakBurok} onChange={(e) => setCsakBurok((e.target as HTMLInputElement).checked)} /> csak a hőburok elemei</label>
        <label class="jelolo" title="Vízszintes vágósík: a sík fölötti rész nem látszik (3D alaprajz)"><input type="checkbox" checked={metsz !== null}
          onChange={(e) => setMetsz((e.target as HTMLInputElement).checked ? Math.min(...modell.szintek.map((q) => q.z0)) + 1.2 : null)} /> metszés</label>
        {metsz !== null && <>
          <select aria-label="Metszés a szinten" value="" onChange={(e) => { const v = (e.target as HTMLSelectElement).value; const sz0 = modell.szintek.find((q) => q.id === v); if (sz0) setMetsz(Math.round((sz0.z0 + 1.2) * 100) / 100); }} style="width:auto">
            <option value="">szint…</option>{modell.szintek.map((q) => <option value={q.id}>{q.nev} (+1,2 m)</option>)}
          </select>
          <input type="range" min={zTart[0]} max={zTart[1]} step="0.05" value={metsz} aria-label="A vágósík magassága" style="width:110px" onInput={(e) => setMetsz(Number((e.target as HTMLInputElement).value))} />
          <span class="halkabb" style="font-size:12px">{metsz.toFixed(2).replace('.', ',')} m</span>
        </>}
        <label class="jelolo" title="Környezeti árnyékolás: a sarkok, csatlakozások finoman sötétednek"><input type="checkbox" checked={ao} onChange={(e) => setAo((e.target as HTMLInputElement).checked)} /> árnyékolás</label>
        <label class="jelolo" title="Párhuzamos (axonometrikus) vetítés"><input type="checkbox" checked={orto} onChange={(e) => setOrto((e.target as HTMLInputElement).checked)} /> párhuzamos vetítés</label>
        {modell.szintek.map((s) => <label class="jelolo"><input type="checkbox" checked={lathato(s.id)} onChange={(e) => setSzintLathato((x) => ({ ...x, [s.id]: (e.target as HTMLInputElement).checked }))} /> {s.nev}</label>)}
        <span class="halkabb" style="font-size:12px">
          {(szinezes === 'anyag'
            ? [['#F1EDE4', 'fal'], ['#744A2C', 'tető'], ['#9AA0A6', 'alapozás'], ['#30343A', 'nyílászáró'], ['#F97316', 'kijelölt']]
            : [['#E8833A', 'külső fal (hőburok)'], ['#5B9BD5', 'fűtetlen felé'], ['#9CA3AF', 'szomszéd felé'], ['#D8D2C4', 'belső fal']]).map(([c, t]) => (
            <><span style={`display:inline-block;width:10px;height:10px;background:${c};border:1px solid #9ca3af;margin:0 4px 0 8px`} />{t}</>))}
        </span>
      </div>
      {szinezes === 'anyag' && <details style="padding:0 10px 6px;font-size:12px">
        <summary class="halkabb">Megjelenés típusonként (szín, átlátszóság – ebben a böngészőben megjegyezve)</summary>
        <table class="tabla" style="width:auto;margin-top:4px"><tbody>
          {TIPUSOK.map(([k, nev, alap]) => { const b = tipusB[k]; const hex = '#' + (b?.szin ?? alap).toString(16).padStart(6, '0'); return (
            <tr><td>{nev}</td>
              <td><input type="color" value={hex} aria-label={`${nev} színe`} onInput={(e) => tipusAllit(k, { szin: parseInt((e.target as HTMLInputElement).value.slice(1), 16) })} /></td>
              <td><input type="range" min="0.1" max="1" step="0.05" value={b?.atl ?? (k === 'uveg' ? 0.92 : 1)} aria-label={`${nev} átlátszatlansága`} style="width:100px" onInput={(e) => tipusAllit(k, { atl: Number((e.target as HTMLInputElement).value) })} /></td>
              <td>{b && <button class="gomb kis-gomb halk-gomb" onClick={() => tipusAllit(k, null)}>alap</button>}</td></tr>); })}
        </tbody></table>
      </details>}
      <div ref={hely} style={`width:100%;height:${magassag}px`} />
      <div class="halkabb" style="font-size:12px;padding:6px 10px">
        {info ?? 'Kattints egy falra, nyílászáróra vagy helyiségre a részletekért (dupla kattintás egy elemen: ráközelít, üres helyen: alapnézet).'}<br />
        {modell.szintek.length} szint · {modell.terek.length} tér · {modell.falak.length} fal · {modell.nyilasok.length} nyílászáró ·
        hőburok-fal (belső sík × belmagasság): külső {fm(osszeg.kulso?.A ?? 0)} m² (nyílás {fm(osszeg.kulso?.ny ?? 0)}), fűtetlen felé {fm(osszeg.futetlen?.A ?? 0)} m², szomszéd felé {fm(osszeg.szomszed?.A ?? 0)} m²
        {padloA > 0 && <> · alsó födém (külső méret) {fm(padloA)} m²</>}{tetoA > 0 && <> · magastető {fm(tetoA)} m² ({String(Math.round((modell.magasteto?.hajlas ?? 0) * 10) / 10).replace('.', ',')}°)</>}{laposA > 0 && <> · lapostető {fm(laposA)} m²</>}
      </div>
    </div>
  );
}
