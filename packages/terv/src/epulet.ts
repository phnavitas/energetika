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
import { tetoGeo } from './teto';

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
  /** Hőburokfal: a belső síkba csatlakozó belső falak összvastagsága (m) – a belső felület ennyivel rövidebb. */
  csatlakozas?: number;
  /** A fal belső (tér felőli) magassága (m), ha eltér a szint belmagasságától (alacsonyabb párkány, térdfal). */
  belsoMag?: number;
  /** Ferde / tört felső élű fal (tetőtér: oromfal, térdfal + tetősík): a belső felület felső éle a falsík mentén
   * (t: 0…1 a belső sík hosszán, z: magasság a szint padlójától, m). */
  profil?: { t: number; z: number }[];
  /** Térdfal / oromfal / alacsonyabb párkány jelölés. */
  jelleg?: 'terdfal' | 'oromfal' | 'parkany' | 'ferde';
}

/** Falmagasság-megadás a hőburokfalakhoz (a hívó a homlokzat / metszet / tetőablakok alapján). */
export type FalMagassag = number | { profil: { t: number; z: number }[]; jelleg?: Fal['jelleg'] } | { belsoMag: number; jelleg?: Fal['jelleg'] } | null;

/** A fal belső (tér felőli) bruttó felülete (m²): a falsík hossza × belső magasság, ill. a profil alatti terület. */
export function falFelulet(f: Fal, belmag: number): number {
  const L = Math.max(0, f.sikHossz - (f.csatlakozas ?? 0));
  if (f.profil && f.profil.length >= 2) { let A = 0; for (let i = 1; i < f.profil.length; i++) { const p = f.profil[i - 1]!, q = f.profil[i]!; A += (q.t - p.t) * (p.z + q.z) / 2; } return A * L; }
  return L * (f.belsoMag ?? belmag);
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

/**
 * Vízszintes / ferde hőburokelem egy fűtött tér fölött vagy alatt (a szomszédos szintek egymásra vetítéséből):
 * - felül: teto (a legfelső szint feletti födém / tető), ferde (tetőtéri tetősík – irany: a kifelé mutató lapirány),
 *   padlasfodem (tetőtér vízszintes része), lapostető (a felső szinten túlnyúló rész), futetlenAlatt (fűtetlen tér alatt);
 * - alul: padlo (legalsó szint), konzol (külső levegő felett), futetlenFelett (fűtetlen tér felett).
 */
export interface VizszintesBurok {
  id: string; ter: string; szint: string; hely: 'felul' | 'alul';
  fajta: 'teto' | 'ferde' | 'padlasfodem' | 'lapostető' | 'futetlenAlatt' | 'padlo' | 'konzol' | 'futetlenFelett';
  /** A tér alapterületének érintett része (vetület, m²) és a felület (ferdénél a valódi, m²). */
  Avet: number; A: number;
  hajlas?: number; irany?: number;
}
/** Tetőtéri tető (a T szint hőburok-körvonala és a metszet szerinti tetőgeometria – a megjelenítéshez). */
export interface TetoGeom { szint: string; z0: number; poligonok: P2[][]; hajlas: number; terdfal: number; belmag: number; orom?: Record<number, number> }
export interface EpuletModell { szintek: Szint[]; terek: Ter[]; falak: Fal[]; nyilasok: Nyilas[]; fodemek: Fodem[]; vizszintes: VizszintesBurok[]; tetok: TetoGeom[] }

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
  /** Hőburokfal magassága szintenként (homlokzat, tetőablakos térdfal, tetőtér-metszet); null: a szint belmagassága. */
  falMagassag?: (sz: Szint, w: { pt: [P2, P2]; irany: number; ri: number; A: P2; B: P2 }) => FalMagassag;
  /** Tetőtér (metszetből): hajlás, térdfal, padlásfödém-magasság, oromzatok (lapirány → szélesség) – a T jelű szinten. */
  tetoter?: { hajlas: number; terdfal: number; belmag: number; orom?: Record<number, number> };
}

type FalNyers = { a: P2; b: P2; vastag: number; bal: Oldal | number; jobb: Oldal | number; /** a falsík (belső oldal) hossza, m */ sik: number;
  /** hőburokfal: a belső sík végpontjai (lap, pt), kifelé mutató lapirány, a belső oldali helyiség */ burokEl?: { pt: [P2, P2]; irany: number; ri: number; A: P2; B: P2 } };

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
        terek.push({ id: tid(ri), szint: sz0.id, kod: ad?.kod, nev: ad?.nev ?? `Helyiség ${ri + 1}`, burkolat: ad?.burkolat, A: sz(ad?.A || Ap, 2), poligonok: pol, belmag: sz0.belmag, kategoria: L.kategoria.get(ri)!, forras: { lap: L.lap, ri } });
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
        // hőburokfal magassága (a hívó szerint): alacsonyabb párkány / térdfal / tetőtéri profil
        let mag: FalMagassag = null;
        if (f.burokEl && L.falMagassag) { try { mag = L.falMagassag(sz0, f.burokEl); } catch { mag = null; } }
        const extra: Partial<Fal> = typeof mag === 'number' ? { belsoMag: sz(mag, 2) } : mag && 'profil' in mag ? { profil: mag.profil.map((q) => ({ t: sz(q.t, 4), z: sz(q.z, 3) })), ...(mag.jelleg ? { jelleg: mag.jelleg } : {}) } : mag ? { belsoMag: sz(mag.belsoMag, 2), ...(mag.jelleg ? { jelleg: mag.jelleg } : {}) } : {};
        // (a szerkezeti magasság: alacsonyabb belső magasságnál a födém vastagságával fölötte, különben a szintmagasság)
        const hSz = extra.profil ? Math.max(...extra.profil.map((q) => q.z)) + (sz0.h - sz0.belmag) : extra.belsoMag !== undefined ? Math.min(sz0.h, extra.belsoMag + (sz0.h - sz0.belmag)) : sz0.h;
        falak.push({ id, szint: sz0.id, a: [sz(f.a[0]), sz(f.a[1])], b: [sz(f.b[0]), sz(f.b[1])], vastag: sz(f.vastag, 2), z0: sz0.z0, h: sz(hSz, 3), ...extra,
          bal: oldal(f.bal), jobb: oldal(f.jobb), kulso: typeof f.bal !== 'number' || typeof f.jobb !== 'number' || kb === 'kulter' || kj === 'kulter',
          burok, ...(futB !== futJ ? { futottOldal: futB ? 'bal' as const : 'jobb' as const } : {}), hossz: sz(hossz, 2), sikHossz: sz(f.sik, 2) });
        falIdk.push({ id, f });
      }
      // hőburokfalak belső síkjába csatlakozó belső falak (a belső felület ezekkel rövidebb)
      for (const { id, f } of falIdk) {
        const E = f.burokEl; if (!E) continue;
        const dx = E.B[0] - E.A[0], dy = E.B[1] - E.A[1], L = Math.hypot(dx, dy); if (L < 0.2) continue;
        const ux = dx / L, uy = dy / L; let cs = 0;
        for (const { f: g } of falIdk) {
          if (g.burokEl || typeof g.bal !== 'number' || typeof g.jobb !== 'number') continue;
          const gx = g.b[0] - g.a[0], gy = g.b[1] - g.a[1], gl = Math.hypot(gx, gy); if (gl < 0.1 || Math.abs((gx * ux + gy * uy) / gl) > 0.3) continue;
          for (const P of [g.a, g.b]) {
            const t = (P[0] - E.A[0]) * ux + (P[1] - E.A[1]) * uy, d = Math.abs((P[0] - E.A[0]) * uy - (P[1] - E.A[1]) * ux);
            if (t > g.vastag / 2 && t < L - g.vastag / 2 && d < g.vastag / 2 + 0.15) { cs += g.vastag; break; }
          }
        }
        if (cs > 0) { const fal = falak.find((q) => q.id === id)!; fal.csatlakozas = sz(Math.min(cs, fal.sikHossz), 2); }
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
  const tetok: TetoGeom[] = lapok.flatMap((L) => (L.tetoter && L.burokPol?.length ? L.szintek.filter((s) => s.kod === 'T').map((s) => ({ szint: s.id, z0: s.z0, poligonok: L.burokPol!.map((q) => q.map(([x, y]) => L.m(x, y))), ...L.tetoter! })) : []));
  return { szintek, terek, falak, nyilasok, fodemek, vizszintes: vizszintesBurok(szintek, terek, lapok, fodemek), tetok };
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
        ki.push({ a, b, vastag: v, bal: helyBal ? h : tul, jobb: helyBal ? tul : h, sik: ll, burokEl: { pt: [pt(ta), pt(tb)], irany: el.irany, ri: h, A, B } });
      }
    }
  }));
  return ki;
}

/** Pont a sokszögben (páros-páratlan szabály). */
function bennP(q: P2, p: P2[]) { let b = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const a = p[i]!, c = p[j]!; if ((a[1] > q[1]) !== (c[1] > q[1]) && q[0] < ((c[0] - a[0]) * (q[1] - a[1])) / (c[1] - a[1]) + a[0]) b = !b; } return b; }

/**
 * A fűtött terek vízszintes / ferde hőburokelemei: szintenként 0,1 m-es rácson a terek, a szomszédos szint tereire
 * vetítve (a köztük lévő falak miatt 0,4 m-es tűréssel); tetőtéren a tetősík (térdfal → ferde → padlásfödém) szerint.
 * A terület a tér (pecsét szerinti) alapterületének a rácsból adódó hányada.
 */
function vizszintesBurok(szintek: Szint[], terek: Ter[], lapok: LapBemenet[], fodemek: Fodem[]): VizszintesBurok[] {
  const ki: VizszintesBurok[] = [];
  const pts = terek.flatMap((t) => t.poligonok.flat()); if (!pts.length) return ki;
  const c = 0.1, x0 = Math.min(...pts.map((p) => p[0])) - 1, y0 = Math.min(...pts.map((p) => p[1])) - 1;
  const W = Math.ceil((Math.max(...pts.map((p) => p[0])) + 1 - x0) / c), Hh = Math.ceil((Math.max(...pts.map((p) => p[1])) + 1 - y0) / c);
  // szintenként: cella → tér-index (terek tömbben), -1 üres
  const sorrend = szintek.slice().sort((p, q) => p.z0 - q.z0).map((s) => s.id);
  const racs = new Map<string, Int32Array>();
  const cellak = new Map<number, number[]>();
  terek.forEach((t, ti) => {
    let g = racs.get(t.szint); if (!g) { g = new Int32Array(W * Hh).fill(-1); racs.set(t.szint, g); }
    const lista: number[] = [];
    for (const p of t.poligonok) {
      if (p.length < 3) continue;
      const bx0 = Math.max(0, Math.floor((Math.min(...p.map((q) => q[0])) - x0) / c)), bx1 = Math.min(W - 1, Math.ceil((Math.max(...p.map((q) => q[0])) - x0) / c));
      const by0 = Math.max(0, Math.floor((Math.min(...p.map((q) => q[1])) - y0) / c)), by1 = Math.min(Hh - 1, Math.ceil((Math.max(...p.map((q) => q[1])) - y0) / c));
      for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) if (bennP([x0 + (x + 0.5) * c, y0 + (y + 0.5) * c], p)) { const k = y * W + x; if (g[k] === -1) { g[k] = ti; lista.push(k); } }
    }
    cellak.set(ti, lista);
  });
  // a szint fűtött / fűtetlen tereinek kiterjesztése (0,4 m – a szint falai)
  const R = 4;
  const kiterj = (g: Int32Array, kat: (ti: number) => boolean) => {
    const a = new Uint8Array(W * Hh); for (let k = 0; k < a.length; k++) if (g[k]! >= 0 && kat(g[k]!)) a[k] = 1;
    const b = new Uint8Array(W * Hh);
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) { let v = 0; for (let d = -R; d <= R && !v; d++) { const xx = x + d; if (xx >= 0 && xx < W && a[y * W + xx]) v = 1; } b[y * W + x] = v; }
    const o = new Uint8Array(W * Hh);
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) { let v = 0; for (let d = -R; d <= R && !v; d++) { const yy = y + d; if (yy >= 0 && yy < Hh && b[yy * W + x]) v = 1; } o[y * W + x] = v; }
    return o;
  };
  // a szint épülettömege (a födém körvonala: minden nem kültéri helyiség, falakkal) – ami ezen belül nem fűtött, fűtetlen tér
  const tomeg = (sz0: string) => {
    const o = new Uint8Array(W * Hh);
    for (const fd of fodemek) if (fd.folott === sz0 && fd.id.startsWith('FP')) for (const p of fd.poligonok) {
      if (p.length < 3) continue;
      const bx0 = Math.max(0, Math.floor((Math.min(...p.map((q) => q[0])) - x0) / c)), bx1 = Math.min(W - 1, Math.ceil((Math.max(...p.map((q) => q[0])) - x0) / c));
      const by0 = Math.max(0, Math.floor((Math.min(...p.map((q) => q[1])) - y0) / c)), by1 = Math.min(Hh - 1, Math.ceil((Math.max(...p.map((q) => q[1])) - y0) / c));
      for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) if (bennP([x0 + (x + 0.5) * c, y0 + (y + 0.5) * c], p)) o[y * W + x] = 1;
    }
    return o;
  };
  const fut = new Map<string, Uint8Array>(), nfut = new Map<string, Uint8Array>();
  for (const [sz0, g] of racs) { fut.set(sz0, kiterj(g, (ti) => terek[ti]!.kategoria === 'futott')); const nf = kiterj(g, (ti) => terek[ti]!.kategoria === 'futetlen'), tm = tomeg(sz0); for (let k = 0; k < nf.length; k++) if (tm[k]) nf[k] = 1; nfut.set(sz0, nf); }
  // tetőtér: a lap hőburok-körvonalainak tetőgeometriája
  const tetok = new Map<string, { pol: P2[]; g: ReturnType<typeof tetoGeo>; hajlas: number }[]>();
  for (const L of lapok) {
    if (!L.tetoter || !L.burokPol?.length) continue;
    for (const s of L.szintek) if (s.kod === 'T') tetok.set(s.id, L.burokPol.map((q) => { const pol = q.map(([x, y]) => L.m(x, y)); return { pol, g: tetoGeo(pol, L.tetoter!, L.tetoter!.orom), hajlas: L.tetoter!.hajlas }; }));
  }
  let n = 0;
  const add = (t: Ter, hely: VizszintesBurok['hely'], fajta: VizszintesBurok['fajta'], arany: number, extra: Partial<VizszintesBurok> = {}, Aval?: number) => {
    const Avet = t.A * arany; if (Avet < 0.3) return;
    ki.push({ id: `V${++n}`, ter: t.id, szint: t.szint, hely, fajta, Avet: Math.round(Avet * 100) / 100, A: Math.round((Aval ?? Avet) * 100) / 100, ...extra });
  };
  // körvonal nélküli (a rajzon nem lehatárolt) fűtött tér: a szint körvonalas fűtött tereinek átlagos arányaival
  const atlag: { t: Ter; arany: Map<string, number> }[] = [];
  const szintArany = new Map<string, Map<string, { A: number; Av: number; x: Partial<VizszintesBurok> }>>();
  terek.forEach((t, ti) => {
    if (t.kategoria !== 'futott') return;
    const cs = cellak.get(ti) ?? []; if (!cs.length) { atlag.push({ t, arany: new Map() }); return; }
    const i = sorrend.indexOf(t.szint);
    const fel = sorrend[i + 1], le = i > 0 ? sorrend[i - 1] : undefined;
    // felül
    let nyitott = 0, futetlen = 0;
    if (fel && racs.has(fel)) { for (const k of cs) { if (fut.get(fel)![k]) continue; if (nfut.get(fel)![k]) futetlen++; else nyitott++; } }
    else nyitott = cs.length;
    const tt = tetok.get(t.szint);
    if (tt && nyitott === cs.length) {
      // tetőtér: cellánként a tetősík (irányonként) vagy a padlásfödém
      const ferde = new Map<number, number>(); let sik = 0, haj = 0;
      for (const k of cs) {
        const q: P2 = [x0 + ((k % W) + 0.5) * c, y0 + (Math.floor(k / W) + 0.5) * c];
        const tg = tt.find((x) => bennP(q, x.pol)) ?? tt[0]!; haj = tg.hajlas;
        const { ir } = tg.g.HI(q); if (ir === null) sik++; else ferde.set(ir, (ferde.get(ir) ?? 0) + 1);
      }
      const cos = Math.cos((haj * Math.PI) / 180);
      for (const [ir, db] of ferde) add(t, 'felul', 'ferde', db / cs.length, { hajlas: haj, irany: ir }, (t.A * db) / cs.length / cos);
      add(t, 'felul', 'padlasfodem', sik / cs.length);
    } else {
      add(t, 'felul', fel && racs.has(fel) ? 'lapostető' : 'teto', nyitott / cs.length);
      add(t, 'felul', 'futetlenAlatt', futetlen / cs.length);
    }
    // alul
    if (!le || !racs.has(le)) { add(t, 'alul', 'padlo', 1); return; }
    let ny2 = 0, fu2 = 0;
    for (const k of cs) { if (fut.get(le)![k]) continue; if (nfut.get(le)![k]) fu2++; else ny2++; }
    // terepszint alatti alsó szint fölött nincs konzol: a lehatárolatlan rész fűtetlen pince / garázs (ha a szinten van
    // fűtetlen tér), különben talajon fekvő padló
    const leSz = szintek.find((x) => x.id === le);
    if (leSz && leSz.z0 < -0.5) { const vanFutetlen = terek.some((u) => u.szint === le && u.kategoria === 'futetlen'); if (vanFutetlen) { fu2 += ny2; ny2 = 0; } else { add(t, 'alul', 'padlo', ny2 / cs.length); ny2 = 0; } }
    add(t, 'alul', 'konzol', ny2 / cs.length); add(t, 'alul', 'futetlenFelett', fu2 / cs.length);
  });
  // (a körvonalas terek elemeiből szintenként: fajta|irány → vetület- és felületarány a szint körvonalas fűtött területéhez)
  for (const v of ki) {
    const m = szintArany.get(v.szint) ?? new Map(); szintArany.set(v.szint, m);
    const k = `${v.hely}|${v.fajta}|${v.irany ?? ''}`; const e = m.get(k) ?? { A: 0, Av: 0, x: { ...(v.hajlas !== undefined ? { hajlas: v.hajlas } : {}), ...(v.irany !== undefined ? { irany: v.irany } : {}) } };
    e.A += v.A; e.Av += v.Avet; m.set(k, e);
  }
  const szintA = new Map<string, number>(); terek.forEach((t, ti) => { if (t.kategoria === 'futott' && (cellak.get(ti) ?? []).length) szintA.set(t.szint, (szintA.get(t.szint) ?? 0) + t.A); });
  for (const { t } of atlag) {
    const m = szintArany.get(t.szint), A0 = szintA.get(t.szint);
    if (!m || !A0) { add(t, 'felul', 'teto', 1); add(t, 'alul', 'padlo', 1); continue; }
    for (const [k, e] of m) { const [hely, fajta] = k.split('|') as [VizszintesBurok['hely'], VizszintesBurok['fajta']]; add(t, hely, fajta, e.Av / A0, e.x, (t.A * e.A) / A0); }
  }
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
