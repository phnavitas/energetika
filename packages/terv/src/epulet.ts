/**
 * Épületmodell a felismert alaprajzokból (IFC-fogalmak szerint): szintek, terek, falak (tengely, vastagság, magasság,
 * két oldaluk), nyílászárók a falakban, födémek – a hőburok elemenként / oldalanként jelölve.
 *
 * Koordináták: méter, x jobbra, y lefelé (a lap szerint), z felfelé. A lapok egymáshoz igazítását (eltolás) és a
 * szintmagasságokat a hívó adja meg (lapbemenet).
 */
import type { AlaprajzFeldolgozas } from './elemzes';
import type { FalSzakasz, Raszter } from './raszter';
import { burokMeres, burokTomeg, elKornyezet, helyisegKorvonal, type Poligon } from './burok';

export type P2 = [number, number];

/** Egy fal (vagy födém) oldalán mi van. */
export type Oldal =
  | { fajta: 'ter'; ter: string }
  | { fajta: 'kulso' }
  | { fajta: 'talaj' }
  | { fajta: 'szomszed' }
  /** a modellben nem szereplő fűtetlen tér (pl. pecsét nélküli csarnok, raktár) */
  | { fajta: 'futetlen' }
  | { fajta: 'ismeretlen' };

/** Hőburok-szerep: a fal / födém fűtött teret határol ezzel szemben (null: nem hőátadó). */
export type BurokSzerep = 'kulso' | 'talaj' | 'futetlen' | 'szomszed' | null;

export type TerKategoria = 'futott' | 'futetlen' | 'kulter';

export interface Szint { id: string; nev: string; kod: string; z0: number; /** padlótól padlóig (m) */ h: number; belmag: number }

export interface Ter {
  id: string; szint: string; kod?: string; nev: string; burkolat?: string;
  /** Alapterület (m²): a pecsét / jegyzék szerint, ennek híján a körvonalból. */
  A: number;
  poligonok: P2[][];
  belmag: number;
  kategoria: TerKategoria;
  /** A forrás: lap sorszáma és raszterhelyiség-index. */
  forras: { lap: number; ri: number };
}

export interface Fal {
  id: string; szint: string;
  /** Tengely (m): a → b. */
  a: P2; b: P2;
  vastag: number;
  z0: number; h: number;
  /** Az a → b irányhoz képest bal (normális: (dy, -dx)·… lásd `normal`) és jobb oldal. */
  bal: Oldal; jobb: Oldal;
  /** Külső fal (az egyik oldalán nem tér van). */
  kulso: boolean;
  /** Hőburok-szerep (ha az egyik oldal fűtött tér). */
  burok: BurokSzerep;
  /** A fűtött oldal (ha van): 'bal' | 'jobb'. */
  futottOldal?: 'bal' | 'jobb';
  /** Hossz (m, a tengely mentén). */
  hossz: number;
  /** A falsík hossza a tér felől (m) – külső falnál a belső sík, belső falnál az egyik oldal. */
  sikHossz: number;
}

export interface Nyilas {
  id: string; fal: string; szint: string;
  /** A nyílás közepe a fal tengelyén, a-tól mérve (m). */
  t: number;
  szel: number; mag: number; pm: number;
  fajta: string;
  kod?: string;
  burok: boolean;
}

export interface Fodem {
  id: string;
  /** Az alatta lévő szint (null: a legalsó szint padlója) és a fölötte lévő (null: tető). */
  alatt: string | null; folott: string | null;
  poligonok: P2[][];
  z: number; vastag: number;
  burok: BurokSzerep | 'teto' | 'padlo';
}

export interface EpuletModell { szintek: Szint[]; terek: Ter[]; falak: Fal[]; nyilasok: Nyilas[]; fodemek: Fodem[] }

/** Egy alaprajzi lap bemenete. */
export interface LapBemenet {
  lap: number;
  a: AlaprajzFeldolgozas;
  /** A lap szintjei (a lap ezekre érvényes – típusszint), alulról felfelé. */
  szintek: Szint[];
  /** pt → m (az alaplaphoz igazítva). */
  m: (x: number, y: number) => P2;
  /** Raszterhelyiség-index → kategória (a nem szereplő / ki nem jelölt helyiség nem kerül a modellbe). */
  kategoria: Map<number, TerKategoria>;
  /** Raszterhelyiség-index → pecsét szerinti adatok. */
  adat?: Map<number, { kod?: string; nev: string; A?: number; burkolat?: string }>;
  /** Ismeretlen túloldalú falszakaszok, amelyek külső falak („ri|szakaszindex”); a többi ismeretlen nem hőátadó. */
  ismKulso?: ReadonlySet<string>;
  /** A fűtött terek hőburka (pt, a fal belső síkján) – ha megadott, a fűtött terek külső falai ennek éleiből (mért
   * falvastagsággal, a túloldal környezete szerint), a helyiségek raszteres szakaszai csak a belső falakhoz kellenek. */
  burokPol?: Poligon[];
  /** A burok raszterje (ha eltér a lap raszterétől, pl. vektoros falú). */
  burokR?: Raszter;
}

type FalNyers = { a: P2; b: P2; vastag: number; bal: Oldal | number; jobb: Oldal | number; /** a falsík (belső oldal) hossza, m */ sik: number };

const sz = (v: number, d = 3) => Math.round(v * 10 ** d) / 10 ** d;

/** Egyenes illesztése a pontokra (főirány): közép, egységirány, a pontok vetületének tartománya. */
function egyenes(p: P2[]): { c: P2; u: P2; t0: number; t1: number } {
  const n = p.length; let cx = 0, cy = 0; for (const [x, y] of p) { cx += x; cy += y; } cx /= n; cy /= n;
  let sxx = 0, syy = 0, sxy = 0; for (const [x, y] of p) { const dx = x - cx, dy = y - cy; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
  const th = 0.5 * Math.atan2(2 * sxy, sxx - syy); const u: P2 = [Math.cos(th), Math.sin(th)];
  let t0 = Infinity, t1 = -Infinity; for (const [x, y] of p) { const t = (x - cx) * u[0] + (y - cy) * u[1]; if (t < t0) t0 = t; if (t > t1) t1 = t; }
  return { c: [cx, cy], u, t0, t1 };
}

/** Lapirány (0 = fel, 90 = jobbra) → kifelé mutató egységvektor (y lefelé). */
const iranyVektor = (ir: number): P2 => [Math.sin((ir * Math.PI) / 180), -Math.cos((ir * Math.PI) / 180)];

/** A falszakasz síkja (m): a két végpont és a kifelé mutató normális. */
function szakaszSik(s: FalSzakasz, m: (x: number, y: number) => P2): { p0: P2; p1: P2; n: P2 } | null {
  if (s.pontok.length < 2) return null;
  const pm = s.pontok.map(([x, y]) => m(x, y));
  const e = egyenes(pm);
  let u = e.u;
  // a normális a lapirány felé (a ferde falnál is az illesztett egyenesre merőleges)
  const ir = iranyVektor(s.irany);
  let n: P2 = [-u[1], u[0]]; if (n[0] * ir[0] + n[1] * ir[1] < 0) n = [-n[0], -n[1]];
  // főirányhoz közeli (≤ 2°) egyenes: pontosan tengelyirányú
  const szog = Math.atan2(n[1], n[0]), tz = Math.atan2(ir[1], ir[0]);
  if (Math.abs(((szog - tz + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) < (2 * Math.PI) / 180) { n = ir; u = [-ir[1], ir[0]]; }
  let t0 = Infinity, t1 = -Infinity; for (const [x, y] of pm) { const t = (x - e.c[0]) * u[0] + (y - e.c[1]) * u[1]; if (t < t0) t0 = t; if (t > t1) t1 = t; }
  return { p0: [e.c[0] + u[0] * t0, e.c[1] + u[1] * t0], p1: [e.c[0] + u[0] * t1, e.c[1] + u[1] * t1], n };
}

/** A raszter helyiségének egyedi azonosítója. */
const terId = (lap: number, szint: string, ri: number) => `T${lap}.${szint}.${ri}`;

/**
 * Épületmodell a lapokból. A típusszintes lap minden szintjére ugyanaz a geometria kerül (más azonosítóval).
 */
export function epuletModell(lapok: LapBemenet[]): EpuletModell {
  const szintek: Szint[] = [], terek: Ter[] = [], falak: Fal[] = [], nyilasok: Nyilas[] = [], fodemek: Fodem[] = [];
  let falSzam = 0, nySzam = 0;
  for (const L of lapok) {
    const r = L.a.r; if (!r) continue;
    const sajat = [...L.kategoria.keys()];
    // a lap tereinek körvonala (egyszer, a szintekre másolva)
    const korv = new Map<number, P2[][]>();
    for (const ri of sajat) korv.set(ri, helyisegKorvonal(r, ri).map((p) => p.map(([x, y]) => L.m(x, y))));
    // falak: helyiségpáronként a közös szakaszok, külső falnál a helyiség szakasza
    const nyers: FalNyers[] = [];
    const futott = new Set(sajat.filter((ri) => L.kategoria.get(ri) === 'futott'));
    const vanBurok = !!L.burokPol?.length && futott.size > 0;
    if (vanBurok) nyers.push(...burokFalakModell(L.burokR ?? r, L.burokPol!, futott, L.m, new Set(sajat)));
    for (const ri of sajat) {
      r.helyisegek[ri]!.szakaszok.forEach((s, sj) => {
        if (s.hossz < 0.15) return;
        // (hőburokkal: a fűtött tér nem belső falai a burokból)
        if (vanBurok && futott.has(ri) && !(typeof s.tul === 'number' && L.kategoria.has(s.tul))) return;
        if (typeof s.tul === 'number' && s.tul < ri && L.kategoria.has(s.tul)) return; // a pár másik oldala már felvette
        const sik = szakaszSik(s, L.m); if (!sik) return;
        const v = Math.max(0.05, Math.min(1.2, s.vastagsag || 0.3));
        // tengely: a falsík + fél falvastagság kifelé; a végek a falvastagság felével meghosszabbítva (sarokcsatlakozás)
        const d: P2 = [sik.p1[0] - sik.p0[0], sik.p1[1] - sik.p0[1]]; const l = Math.hypot(d[0], d[1]); if (l < 0.1) return;
        const u: P2 = [d[0] / l, d[1] / l], k = v / 2;
        const a: P2 = [sik.p0[0] + sik.n[0] * k - u[0] * k, sik.p0[1] + sik.n[1] * k - u[1] * k];
        const b: P2 = [sik.p1[0] + sik.n[0] * k + u[0] * k, sik.p1[1] + sik.n[1] * k + u[1] * k];
        // a → b irányhoz képest: bal oldal a (u[1], -u[0])·(-1)… – a helyiség a normálissal ellentétes oldalon
        const balN: P2 = [u[1], -u[0]]; // y lefelé: (uy, -ux) a menetirány bal oldala
        const helyBal = balN[0] * -sik.n[0] + balN[1] * -sik.n[1] > 0;
        const tul: Oldal | number = typeof s.tul === 'number' ? (L.kategoria.has(s.tul) ? s.tul : { fajta: 'szomszed' })
          : s.tul === 'kulso' ? (s.talaj ? { fajta: 'talaj' } : s.szomszed ? { fajta: 'szomszed' } : { fajta: 'kulso' })
          : L.ismKulso?.has(`${ri}|${sj}`) ? { fajta: 'kulso' } : { fajta: 'ismeretlen' };
        nyers.push({ a, b, vastag: v, bal: helyBal ? ri : tul, jobb: helyBal ? tul : ri, sik: l });
      });
    }
    for (const sz0 of L.szintek) {
      if (!szintek.some((x) => x.id === sz0.id)) szintek.push(sz0);
      const tid = (ri: number) => terId(L.lap, sz0.id, ri);
      for (const ri of sajat) {
        const ad = L.adat?.get(ri), pol = korv.get(ri) ?? [];
        const Ap = pol.reduce((t, p) => t + Math.abs(teruletP(p)), 0);
        terek.push({ id: tid(ri), szint: sz0.id, kod: ad?.kod, nev: ad?.nev ?? `Helyiség ${ri + 1}`, burkolat: ad?.burkolat, A: sz(ad?.A ?? Ap, 2), poligonok: pol, belmag: sz0.belmag, kategoria: L.kategoria.get(ri)!, forras: { lap: L.lap, ri } });
      }
      // (talaj csak terepszint alatti szinten – fölötte a terepsraffozás mögötti fal külső fal)
      const fold = sz0.z0 < -0.5;
      const oldal = (o: Oldal | number): Oldal => (typeof o === 'number' ? { fajta: 'ter', ter: tid(o) } : o.fajta === 'talaj' && !fold ? { fajta: 'kulso' } : o.fajta === 'kulso' && fold ? { fajta: 'talaj' } : o);
      const kat = (o: Oldal | number) => (typeof o === 'number' ? L.kategoria.get(o)! : null);
      const falIdk: { id: string; f: FalNyers }[] = [];
      for (const f of nyers) {
        const id = `F${++falSzam}`;
        const kb = kat(f.bal), kj = kat(f.jobb);
        const futB = kb === 'futott', futJ = kj === 'futott';
        const masik = futB && !futJ ? f.jobb : futJ && !futB ? f.bal : null;
        let burok: BurokSzerep = null;
        if (masik !== null) {
          if (typeof masik === 'number') burok = L.kategoria.get(masik) === 'kulter' ? 'kulso' : 'futetlen';
          else { const o = oldal(masik); burok = o.fajta === 'ter' ? 'futetlen' : o.fajta === 'ismeretlen' ? null : o.fajta; }
        }
        const hossz = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]);
        falak.push({ id, szint: sz0.id, a: [sz(f.a[0]), sz(f.a[1])], b: [sz(f.b[0]), sz(f.b[1])], vastag: sz(f.vastag, 2), z0: sz0.z0, h: sz0.h,
          bal: oldal(f.bal), jobb: oldal(f.jobb), kulso: typeof f.bal !== 'number' || typeof f.jobb !== 'number' || kb === 'kulter' || kj === 'kulter',
          burok, ...(futB !== futJ ? { futottOldal: futB ? 'bal' as const : 'jobb' as const } : {}), hossz: sz(hossz, 2), sikHossz: sz(f.sik, 2) });
        falIdk.push({ id, f });
      }
      // nyílászárók: a helyiség (és a túloldal) falai közül a legközelebbi, amelynek tengelyére a nyílás közepe esik
      for (const n of L.a.nyilasok) {
        if (n.helyiseg === null || n.helyiseg === undefined || !L.kategoria.has(n.helyiseg) || !(n.szel > 0)) continue;
        const [x, y] = L.m(n.x, n.y);
        let leg: { id: string; t: number; d: number; f: FalNyers } | null = null;
        for (const { id, f } of falIdk) {
          const erint = f.bal === n.helyiseg || f.jobb === n.helyiseg; if (!erint) continue;
          const dx = f.b[0] - f.a[0], dy = f.b[1] - f.a[1], l = Math.hypot(dx, dy); if (l < 0.1) continue;
          const t = ((x - f.a[0]) * dx + (y - f.a[1]) * dy) / l; if (t < -0.2 || t > l + 0.2) continue;
          const d = Math.abs((x - f.a[0]) * dy - (y - f.a[1]) * dx) / l;
          if (d < 1.2 && (!leg || d < leg.d)) leg = { id, t: Math.max(0, Math.min(l, t)), d, f };
        }
        if (!leg) continue;
        const fal = falak.find((q) => q.id === leg!.id)!;
        nyilasok.push({ id: `N${++nySzam}`, fal: leg.id, szint: sz0.id, t: sz(leg.t, 2), szel: n.szel, mag: n.mag > 0 ? n.mag : (n.szel >= 1.6 ? 2.4 : 1.5), pm: n.pm ?? (n.mag >= 1.9 ? 0 : 0.9), fajta: n.fajta, burok: fal.burok !== null });
      }
    }
  }
  // födémek: szintenként a terek uniója (a raszter külső körvonala), alul padló, felül tető / közbenső födém
  szintek.sort((p, q) => p.z0 - q.z0);
  for (const L of lapok) {
    const r = L.a.r; if (!r) continue;
    const mind = new Set([...L.kategoria.entries()].filter(([, k]) => k !== 'kulter').map(([ri]) => ri));
    const fut = new Set([...L.kategoria.entries()].filter(([, k]) => k === 'futott').map(([ri]) => ri));
    if (!mind.size) continue;
    const pol = burokTomeg(r, mind).map((p) => p.map(([x, y]) => L.m(x, y)));
    const vanFut = fut.size > 0;
    for (const sz0 of L.szintek) {
      const i = szintek.findIndex((x) => x.id === sz0.id);
      const also = i === 0, felso = i === szintek.length - 1 || !lapok.some((M) => M.szintek.some((x) => x.id === szintek[i + 1]?.id));
      fodemek.push({ id: `FP${sz0.id}`, alatt: also ? null : szintek[i - 1]!.id, folott: sz0.id, poligonok: pol, z: sz0.z0, vastag: 0.3, burok: also && vanFut ? 'padlo' : null });
      if (felso) fodemek.push({ id: `FT${sz0.id}`, alatt: sz0.id, folott: null, poligonok: pol, z: sz0.z0 + sz0.h, vastag: 0.3, burok: vanFut ? 'teto' : null });
    }
  }
  return { szintek, terek, falak, nyilasok, fodemek };
}


/** A hőburok éleiből a fűtött terek külső falai: élenként a túloldal környezete szerinti szakaszok (külső tér, szomszéd;
 * a fűtetlen / fűtött tér felé eső részt a helyiségek közti falak adják), a mért falvastagsággal, a belső oldalon a
 * legközelebbi fűtött helyiséggel. */
function burokFalakModell(r: Raszter, pol: Poligon[], futott: ReadonlySet<number>, m: (x: number, y: number) => P2, modellben: ReadonlySet<number>): FalNyers[] {
  const ki: FalNyers[] = [];
  const meres = burokMeres(r, pol), kz = elKornyezet(r, pol, futott);
  const cella = (x: number, y: number) => { const cx = Math.floor(((x - r.x0) * r.mPerPt) / r.px), cy = Math.floor(((y - r.y0) * r.mPerPt) / r.px); return cx < 0 || cy < 0 || cx >= r.w || cy >= r.h ? -1 : r.cimke[cy * r.w + cx]! - 2; };
  const vMind = meres.flat().flatMap((e) => (e.vastag !== null && e.vastag > 0.05 ? [e.vastag] : [])).sort((a, b) => a - b);
  const vMed = vMind.length ? vMind[vMind.length >> 1]! : 0.4;
  meres.forEach((elek, pi) => elek.forEach((el) => {
    const [P0, P1] = el.belso; const l = Math.hypot(P1[0] - P0[0], P1[1] - P0[1]) * r.mPerPt; if (l < 0.15) return;
    const n = iranyVektor(el.irany), v = Math.max(0.1, Math.min(1.2, el.vastag ?? vMed));
    const reszek = (kz[pi]?.[el.i]?.length ? kz[pi]![el.i]! : [[0, 1, 'kulso']]) as [number, number, string][];
    for (const [t0, t1, f] of reszek) {
      if (f !== 'kulso' && f !== 'szomszed' && f !== 'futetlen') continue;
      if ((t1 - t0) * l < 0.15) continue;
      const pt = (t: number): P2 => [P0[0] + (P1[0] - P0[0]) * t, P0[1] + (P1[1] - P0[1]) * t];
      // fűtetlen tér felé: ha az a modell tere, a két helyiség közti fal adja; különben itt (modellen kívüli fűtetlen tér)
      if (f === 'futetlen') {
        const [mx, my] = pt((t0 + t1) / 2); let kint = -1;
        for (let d = 0.1; d <= 1.6 && kint < 0; d += 0.1) { const c = cella(mx + (n[0] * d) / r.mPerPt, my + (n[1] * d) / r.mPerPt); if (c >= 0) kint = c; }
        if (kint >= 0 && modellben.has(kint)) continue;
      }
      // a belső oldali fűtött helyiség 0,25 m-enként (befelé keresve); az azonos helyiségű szakaszok egy fal
      const lepes = Math.max(1, Math.round(((t1 - t0) * l) / 0.25));
      const hely: number[] = [];
      for (let q = 0; q < lepes; q++) {
        const [mx, my] = pt(t0 + ((q + 0.5) / lepes) * (t1 - t0)); let h = -1;
        for (let d = 0.15; d <= 1.6 && h < 0; d += 0.1) { const c = cella(mx - (n[0] * d) / r.mPerPt, my - (n[1] * d) / r.mPerPt); if (c >= 0 && futott.has(c)) h = c; }
        hely.push(h);
      }
      // a helyiség nélküli minták (falcsatlakozás, nyílás előtti sáv) a szomszéd mintáéhoz
      for (let q = 0; q < lepes; q++) if (hely[q]! < 0) { const e = hely.slice(0, q).reverse().find((x) => x >= 0) ?? hely.slice(q + 1).find((x) => x >= 0); if (e !== undefined) hely[q] = e; }
      let q0 = 0;
      for (let q = 1; q <= lepes; q++) {
        if (q < lepes && hely[q] === hely[q0]) continue;
        const h = hely[q0]!; const ta = t0 + (q0 / lepes) * (t1 - t0), tb = t0 + (q / lepes) * (t1 - t0); q0 = q;
        if (h < 0 || (tb - ta) * l < 0.1) continue;
        const A = m(...pt(ta)), B = m(...pt(tb));
        const d: P2 = [B[0] - A[0], B[1] - A[1]]; const ll = Math.hypot(d[0], d[1]); const u: P2 = [d[0] / ll, d[1] / ll], k = v / 2;
        // tengely: a belső sík + fél falvastagság kifelé; a körvonal csúcsainál a vég a falvastagság felével hosszabb
        const e0 = ta <= 1e-6 ? k : 0, e1 = tb >= 1 - 1e-6 ? k : 0;
        const a: P2 = [A[0] + n[0] * k - u[0] * e0, A[1] + n[1] * k - u[1] * e0], b: P2 = [B[0] + n[0] * k + u[0] * e1, B[1] + n[1] * k + u[1] * e1];
        const balN: P2 = [u[1], -u[0]]; const helyBal = balN[0] * -n[0] + balN[1] * -n[1] > 0;
        const tul: Oldal = f === 'szomszed' ? { fajta: 'szomszed' } : f === 'futetlen' ? { fajta: 'futetlen' } : { fajta: 'kulso' };
        ki.push({ a, b, vastag: v, bal: helyBal ? h : tul, jobb: helyBal ? tul : h, sik: ll });
      }
    }
  }));
  return ki;
}

function teruletP(p: P2[]) { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i]!, b = p[(i + 1) % p.length]!; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }

/** Összesítés (ellenőrzéshez): falfelület hőburok-szerep szerint, nyílások nélkül / nyílásokkal (m²). */
export function modellOsszeg(md: EpuletModell): Record<string, number> {
  const ki: Record<string, number> = {};
  const ny = new Map<string, number>(); for (const n of md.nyilasok) ny.set(n.fal, (ny.get(n.fal) ?? 0) + n.szel * n.mag);
  for (const f of md.falak) { const k = `fal:${f.burok ?? (f.kulso ? 'kulso-nem-futott' : 'belso')}`; ki[k] = (ki[k] ?? 0) + f.hossz * f.h; ki[k + ':ny'] = (ki[k + ':ny'] ?? 0) + (ny.get(f.id) ?? 0); }
  for (const t of md.terek) ki[`ter:${t.kategoria}`] = (ki[`ter:${t.kategoria}`] ?? 0) + t.A;
  for (const k of Object.keys(ki)) ki[k] = Math.round(ki[k]! * 10) / 10;
  return ki;
}

export type { Raszter, Poligon };
