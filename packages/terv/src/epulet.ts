/**
 * Épületmodell a felismert alaprajzokból (IFC-fogalmak szerint): szintek, terek, falak (tengely, vastagság, magasság,
 * két oldaluk), nyílászárók a falakban, födémek – a hőburok elemenként / oldalanként jelölve.
 *
 * Koordináták: méter, x jobbra, y lefelé (a lap szerint), z felfelé. A lapok egymáshoz igazítását (eltolás) és a
 * szintmagasságokat a hívó adja meg (lapbemenet).
 */
import { pillerKeres } from './pillerek';
import type { Lap } from './kinyeres';
import type { FodemSav } from './metszetGeom';
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
  /** a modellben helyiségként nem szereplő belső tér (lépcső-, légtér, akna – felirat nélküli zárt terület a rajzon) */
  | { fajta: 'belso' }
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
  /** Forrás a lapon: hőburokfalnál a belső oldali helyiség (raszterindex), a belső sík végpontjai (pt) és a kifelé
   * mutató lapirány; fűtött–fűtetlen belső falnál a fűtött oldali helyiség. */
  forras?: { lap: number; ri: number; pt?: [P2, P2]; irany?: number };
  /** Hőburokfal: a belső síkba csatlakozó belső falak összvastagsága (m) – a belső felület ennyivel rövidebb. */
  csatlakozas?: number;
  /** A fal belső (tér felőli) magassága (m), ha eltér a szint belmagasságától (alacsonyabb párkány, térdfal). */
  belsoMag?: number;
  /** Ferde / tört felső élű fal (tetőtér: oromfal, térdfal + tetősík): a belső felület felső éle a falsík mentén
   * (t: 0…1 a belső sík hosszán, z: magasság a szint padlójától, m). */
  profil?: { t: number; z: number }[];
  /** A fal anyaga a rajz szerint: a kitöltés színe, sraffozott-e, a PDF-réteg (ArchiCAD) – azonos jellemzőjű falak egy típus. */
  anyag?: { stilus: number; szin: string; sraff: boolean; reteg?: string };
  /** Rétegrend a rajz szerint (a bal oldaltól a jobb felé): a fal keresztmetszetében egymást követő kitöltések
   * (stílus: szín, sraffozás, PDF-réteg) és vastagságuk (m) – pl. falazat + homlokzati hőszigetelés. */
  retegek?: { stilus: number; szin: string; sraff: boolean; reteg?: string; vastag: number }[];
  /** A fal magjának (szerkezeti rétegének) vastagsága (m): a rétegrendből a nem-réteg (hőszigetelés, vakolat,
   * burkolat nélküli) rétegek összege; ha a PDF-réteg neve vastagságot mond („POROTHERM FAL 30”, „VÁLASZFAL 10”)
   * és a mért érték ± 12 cm-en belül van, a név szerinti. */
  mag?: number;
  /** Szerkezet: teherhordó fal (≥ 20 cm, vagy a réteg neve szerint), válaszfal (≤ 15 cm, vagy a réteg neve szerint), ill. kitöltő / egyéb;
   * „hatar”: nem fal, csak helyiséghatár (rajzolt falanyag nélküli, vonalvastagságú – pl. gerendavonal az egybenyitott
   * terek között). */
  szerkezet?: 'teherhordo' | 'valaszfal' | 'egyeb' | 'hatar';
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
  /** A födém felső síkja (m) és vastagsága (lefelé). */
  z: number; vastag: number;
  burok: BurokSzerep | 'teto' | 'padlo';
  /** Rétegrend a metszetből (felülről lefelé: PDF-réteg, vastagság m) – ekkor z a legfelső réteg teteje, vastag az összeg. */
  retegek?: { reteg: string; vastag: number }[];
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
/**
 * A falak alaprajzi lefedése lapként (a lap első szintjén): a modell falainak téglalapjai a rajz falpixeleihez képest.
 * (a rajzolt fal a nyílások áthidalt részével együtt, mint a modell fala)
 * lefedes: a rajzolt falfelület hányada, amelyet modellfal fed (hiányzó fal: < 1), pontossag: a modellfal-felület hányada,
 * amely rajzolt falon van (fölösleges / túlnyúló fal: < 1), atfedes: a modellfalak egymást fedő része (m², sarkok, csatlakozások).
 */
export interface FalLefedes { lap: number; szint: string; rajzA: number; modellA: number; lefedes: number; pontossag: number; atfedes: number;
  /** a modell többlete (m²): rajzolt fal mellett (≤ 0,3 m: vastagság-, hosszeltérés) ill. attól távol (fölösleges fal);
   * a hiány (m²): modellfal mellett (vékonyabb / rövidebb modellfal) ill. attól távol (hiányzó fal) */
  tobbletKozel: number; tobbletTavol: number; hianyKozel: number; hianyTavol: number }
/** Pillér: az alaprajz tartószerkezeti rétegén álló, közel négyzetes, 15–80 cm-es téglalap (pillerKeres). */
export interface Piller { id: string; szint: string; kozep: P2; /** keresztmetszet (m, x / y irányban) */ a: number; b: number; z0: number; h: number; reteg: string }

export interface EpuletModell { szintek: Szint[]; terek: Ter[]; falak: Fal[]; nyilasok: Nyilas[]; fodemek: Fodem[]; vizszintes: VizszintesBurok[]; tetok: TetoGeom[]; lefedes?: FalLefedes[]; pillerek?: Piller[] }

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
  /** A jegyzékben / pecséten szereplő, a rajzon helyiséghez nem köthető terek (körvonal nélkül, a szint átlagos fedésével). */
  /** A felirattal azonosított, de a modellből kizárt terek (raszterindex) – megadásakor a többi, felirat nélküli zárt
   * terület (lépcső-, légtér) felé is belső fal készül. */
  kizart?: ReadonlySet<number>;
  /** A lap rajzolata (PDF-elemek) – a teljes modellben a pillérekhez. */
  rajz?: Lap;
  pecsetTerek?: { kod?: string; nev: string; A: number; burkolat?: string; kategoria: TerKategoria }[];
  /** Tetőtér (metszetből): hajlás, térdfal, padlásfödém-magasság, oromzatok (lapirány → szélesség) – a T jelű szinten. */
  tetoter?: { hajlas: number; terdfal: number; belmag: number; orom?: Record<number, number> };
}

type FalNyers = { a: P2; b: P2; vastag: number; bal: Oldal | number; jobb: Oldal | number; /** a falsík (belső oldal) hossza, m */ sik: number;
  /** hőburokfal: a belső sík végpontjai (lap, pt), kifelé mutató lapirány, a belső oldali helyiség */ burokEl?: { pt: [P2, P2]; irany: number; ri: number; A: P2; B: P2; csatl?: number } };

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
  // a szakasz irányához közeli (≤ 12°) egyenes: pontosan a szakasz (lap) irányában – a csatlakozó falak, sarkok pixelei
  // az illesztett egyenest elfordíthatják; a hely ilyenkor a pontok normális menti mediánja (a kilógó pixelek nélkül)
  const szog = Math.atan2(n[1], n[0]), tz = Math.atan2(ir[1], ir[0]);
  let c = e.c;
  if (Math.abs(((szog - tz + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) < (12 * Math.PI) / 180) {
    n = ir; u = [-ir[1], ir[0]];
    const d = pm.map(([x, y]) => x * n[0] + y * n[1]).sort((a, b) => a - b), dm = d[Math.floor(d.length / 2)]!;
    const cd = e.c[0] * n[0] + e.c[1] * n[1]; c = [e.c[0] + n[0] * (dm - cd), e.c[1] + n[1] * (dm - cd)];
  }
  let t0 = Infinity, t1 = -Infinity; for (const [x, y] of pm) { const t = (x - c[0]) * u[0] + (y - c[1]) * u[1]; if (t < t0) t0 = t; if (t > t1) t1 = t; }
  return { p0: [c[0] + u[0] * t0, c[1] + u[1] * t0], p1: [c[0] + u[0] * t1, c[1] + u[1] * t1], n };
}

/** A raszter helyiségének egyedi azonosítója. */
const terId = (lap: number, szint: string, ri: number) => `T${lap}.${szint}.${ri}`;

/**
 * Épületmodell a lapokból. A típusszintes lap minden szintjére ugyanaz a geometria kerül (más azonosítóval).
 */
export function epuletModell(lapok: LapBemenet[], opt: { fodemSavok?: FodemSav[] } = {}): EpuletModell {
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
    // a lap fő falirányai (a szakaszok hossz-súlyozott iránya 90°-onként): a főirányoktól eltérő rövid (< 1,6 m)
    // szakasz nem fal (ajtólap, nyitásív, lépcső-, bútorvonal)
    let sx = 0, sy = 0;
    for (const ri of sajat) for (const s of r.helyisegek[ri]!.szakaszok) { const a = (s.irany * 4 * Math.PI) / 180; sx += Math.cos(a) * s.hossz; sy += Math.sin(a) * s.hossz; }
    const fo = (Math.atan2(sy, sx) * 180) / Math.PI / 4;
    const foEltér = (ir: number) => { const d = (((ir - fo) % 90) + 90) % 90; return Math.min(d, 90 - d); };
    // két modellbeli helyiség közös fala: a hosszabban látó oldal veszi fel (a pár és a falsík iránya szerint) – a
    // lépcsőt, beépített bútort tartalmazó helyiség raszterében a fal egy része takarásban lehet
    const parKulcs = (ri: number, j: number, ir: number) => `${Math.min(ri, j)}|${Math.max(ri, j)}|${ri < j ? ir : (ir + 180) % 360}`;
    const parOssz = new Map<string, Map<number, number>>();
    for (const ri of sajat) for (const s of r.helyisegek[ri]!.szakaszok) if (typeof s.tul === 'number' && L.kategoria.has(s.tul)) {
      const k = parKulcs(ri, s.tul, Math.round(s.irany / 90) * 90 % 360); const m = parOssz.get(k) ?? new Map<number, number>(); parOssz.set(k, m); m.set(ri, (m.get(ri) ?? 0) + s.hossz); }
    // (csak a teljes épületmodellnél – kizart megadva –; a hőburok-modell a korábbi, alacsonyabb indexű oldalt veszi)
    const parNyer = (ri: number, j: number, ir: number) => { if (!L.kizart) return ri < j; const m = parOssz.get(parKulcs(ri, j, Math.round(ir / 90) * 90 % 360)); if (!m) return true;
      const a = m.get(ri) ?? 0, b = m.get(j) ?? 0; return a > b + 0.05 || (Math.abs(a - b) <= 0.05 && ri < j); };
    for (const ri of sajat) {
      r.helyisegek[ri]!.szakaszok.forEach((s, sj) => {
        if (s.hossz < 0.15) return;
        // (hőburokkal: a fűtött tér nem belső falai a burokból)
        // (kivéve a felirat nélküli belső terület – lépcső-, légtér – felé: az nem burok, a fal belső fal)
        const belsoTul = !!L.kizart && typeof s.tul === 'number' && !L.kategoria.has(s.tul) && !L.kizart.has(s.tul);
        if (vanBurok && futott.has(ri) && !(typeof s.tul === 'number' && L.kategoria.has(s.tul)) && !belsoTul) return;
        if (typeof s.tul === 'number' && L.kategoria.has(s.tul) && !parNyer(ri, s.tul, s.irany)) return; // a pár másik oldala veszi fel
        const sik = szakaszSik(s, L.m); if (!sik) return;
        // (a lapon y lefelé: a normális lapiránya atan2(nx, -ny))
        const sikIr = (Math.atan2(sik.n[0], -sik.n[1]) * 180) / Math.PI;
        if (s.hossz < 1.6 && (foEltér(sikIr) > 10 || foEltér(s.irany) > 10) && typeof s.tul === 'number') return;
        const v = Math.max(0.05, Math.min(1.2, s.vastagsag || 0.3));
        // tengely: a falsík + fél falvastagság kifelé; a végek a falvastagság felével meghosszabbítva (sarokcsatlakozás)
        const d: P2 = [sik.p1[0] - sik.p0[0], sik.p1[1] - sik.p0[1]]; const l = Math.hypot(d[0], d[1]); if (l < 0.1) return;
        const u: P2 = [d[0] / l, d[1] / l], k = v / 2;
        const a: P2 = [sik.p0[0] + sik.n[0] * k - u[0] * k, sik.p0[1] + sik.n[1] * k - u[1] * k];
        const b: P2 = [sik.p1[0] + sik.n[0] * k + u[0] * k, sik.p1[1] + sik.n[1] * k + u[1] * k];
        // a → b irányhoz képest: bal oldal a (u[1], -u[0])·(-1)… – a helyiség a normálissal ellentétes oldalon
        const balN: P2 = [u[1], -u[0]]; // y lefelé: (uy, -ux) a menetirány bal oldala
        const helyBal = balN[0] * -sik.n[0] + balN[1] * -sik.n[1] > 0;
        const tul: Oldal | number = typeof s.tul === 'number' ? (L.kategoria.has(s.tul) ? s.tul : belsoTul && vanBurok ? { fajta: 'belso' } : { fajta: 'szomszed' })
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
      // a jegyzékben / pecséten szereplő, a rajzon helyiséghez nem köthető terek (körvonal nélkül)
      (L.pecsetTerek ?? []).forEach((t, j) => terek.push({ id: `${tid(-1)}p${j}`, szint: sz0.id, kod: t.kod, nev: t.nev, burkolat: t.burkolat, A: sz(t.A, 2), poligonok: [], belmag: sz0.belmag, kategoria: t.kategoria, forras: { lap: L.lap, ri: -1 } }));
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
          else { const o = oldal(masik); burok = o.fajta === 'ter' ? 'futetlen' : o.fajta === 'ismeretlen' || o.fajta === 'belso' ? null : o.fajta; }
        }
        const hossz = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]);
        // hőburokfal magassága (a hívó szerint): alacsonyabb párkány / térdfal / tetőtéri profil
        let mag: FalMagassag = null;
        if (f.burokEl && L.falMagassag) { try { mag = L.falMagassag(sz0, f.burokEl); } catch { mag = null; } }
        const extra: Partial<Fal> = typeof mag === 'number' ? { belsoMag: sz(mag, 2) } : mag && 'profil' in mag ? { profil: mag.profil.map((q) => ({ t: sz(q.t, 4), z: sz(q.z, 3) })), ...(mag.jelleg ? { jelleg: mag.jelleg } : {}) } : mag ? { belsoMag: sz(mag.belsoMag, 2), ...(mag.jelleg ? { jelleg: mag.jelleg } : {}) } : {};
        // (a szerkezeti magasság: alacsonyabb belső magasságnál a födém vastagságával fölötte, különben a szintmagasság)
        const hSz = extra.profil ? Math.max(...extra.profil.map((q) => q.z)) + (sz0.h - sz0.belmag) : extra.belsoMag !== undefined ? Math.min(sz0.h, extra.belsoMag + (sz0.h - sz0.belmag)) : sz0.h;
        const anyag = falAnyag(L, f), retegek = falRetegek(L, f);
        falak.push({ id, szint: sz0.id, a: [sz(f.a[0]), sz(f.a[1])], b: [sz(f.b[0]), sz(f.b[1])], vastag: sz(f.vastag, 2), z0: sz0.z0, h: sz(hSz, 3), ...extra,
          ...(anyag ? { anyag } : {}), ...(retegek ? { retegek } : {}), szerkezet: !anyag && !retegek && f.vastag <= 0.06 && typeof f.bal === 'number' && typeof f.jobb === 'number' && !falVonalMent(L, f) ? 'hatar' : falSzerkezet(f.vastag, anyag),
          bal: oldal(f.bal), jobb: oldal(f.jobb), kulso: (typeof f.bal !== 'number' && f.bal.fajta !== 'belso') || (typeof f.jobb !== 'number' && f.jobb.fajta !== 'belso') || kb === 'kulter' || kj === 'kulter',
          burok, ...(futB !== futJ ? { futottOldal: futB ? 'bal' as const : 'jobb' as const } : {}), hossz: sz(hossz, 2), sikHossz: sz(f.sik, 2),
          ...(f.burokEl ? { forras: { lap: L.lap, ri: f.burokEl.ri, pt: f.burokEl.pt, irany: f.burokEl.irany } } : futB !== futJ && typeof (futB ? f.bal : f.jobb) === 'number' ? { forras: { lap: L.lap, ri: (futB ? f.bal : f.jobb) as number } } : {}) });
        falIdk.push({ id, f });
      }
      // rétegrend nélküli fal (a nyílások miatt nincs ép metszéke): az azonos vastagságú (± 2 cm), azonos helyzetű
      // (külső / belső) falak leggyakoribb rétegrendje – ugyanaz a faltípus
      { const sajatFal = falak.filter((q) => falIdk.some((x) => x.id === q.id));
        const tipusok = new Map<string, Map<string, { n: number; r: NonNullable<Fal['retegek']> }>>();
        const tk = (q: Fal) => `${q.kulso ? 'k' : 'b'}|${Math.round(q.vastag * 50)}`;
        // (forrás csak szerkezeti réteget is tartalmazó rétegrend lehet: név szerint nem réteg, név híján sraffozott)
        for (const q of sajatFal) if (q.retegek && q.retegek.some((x) => (x.reteg ? !RETEG_JEL.test(x.reteg) : x.sraff))) { const m = tipusok.get(tk(q)) ?? new Map(); tipusok.set(tk(q), m); const k = q.retegek.map((x) => `${x.stilus}:${x.vastag}`).join(','); const e = m.get(k) ?? { n: 0, r: q.retegek }; e.n += q.hossz; m.set(k, e); }
        for (const q of sajatFal) if (!q.retegek && q.szerkezet !== 'hatar') { const m = tipusok.get(tk(q)); if (!m) continue; const best = [...m.values()].sort((a, b) => b.n - a.n)[0]; if (best) q.retegek = best.r.map((x) => ({ ...x })); } }
      for (const q of falak) if (falIdk.some((x) => x.id === q.id)) { const m = falMag(q); if (m !== undefined) q.mag = m; }
      // hőburokfalak belső síkjába csatlakozó belső falak (a belső felület ezekkel rövidebb – a raszter szerint)
      for (const { id, f } of falIdk) { const cs = f.burokEl?.csatl; if (cs && cs > 0) { const fal = falak.find((q) => q.id === id)!; fal.csatlakozas = sz(Math.min(cs, fal.sikHossz), 2); } }
      // nyílászárók: a helyiség (és a túloldal) falai közül a legközelebbi, amelynek tengelyére a nyílás közepe esik
      // (a teljes épületmodellben – kizart megadva – a csak a modellnek szóló belső ajtók is)
      for (const n of [...L.a.nyilasok, ...(L.kizart ? L.a.modellAjtok ?? [] : [])]) {
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
  const lefedes = lapok.flatMap((L) => { try { const sz0 = L.szintek[0]; return sz0 ? [falLefedes(L, falak.filter((f) => f.szint === sz0.id), sz0.id)] : []; } catch { return []; } });
  // pillérek (a teljes modellben, a lap rajzolatából)
  const pillerek: Piller[] = [];
  for (const L of lapok) {
    const r = L.a.r; if (!L.rajz || !L.kizart || !r) continue;
    for (const q of pillerKeres(L.rajz, r.mPerPt)) {
      const [ax, ay] = L.m(q.x0, q.y0), [bx, by] = L.m(q.x1, q.y1);
      for (const sz0 of L.szintek) pillerek.push({ id: `P${pillerek.length + 1}`, szint: sz0.id, kozep: [sz((ax + bx) / 2), sz((ay + by) / 2)], a: sz(Math.abs(bx - ax), 2), b: sz(Math.abs(by - ay), 2), z0: sz0.z0, h: sz0.h, reteg: q.reteg });
    }
  }
  if (opt.fodemSavok?.length) {
    const elt = fodemRetegrend(fodemek, szintek, opt.fodemSavok);
    for (const f of [...falak, ...pillerek]) { const d = elt.get(f.szint); if (d) f.z0 = Math.round((f.z0 + d) * 100) / 100; }
    for (const p of pillerek) { const s0 = szintek.find((q) => q.id === p.szint); if (s0) p.h = s0.h; }
  }
  return { szintek, terek, falak, nyilasok, fodemek, vizszintes: vizszintesBurok(szintek, terek, lapok, fodemek), tetok, lefedes, ...(pillerek.length ? { pillerek } : {}) };
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
      const hely: number[] = [], csatl: boolean[] = [];
      const falC = (x: number, y: number) => { const cx = Math.floor(((x - r.x0) * r.mPerPt) / r.px), cy = Math.floor(((y - r.y0) * r.mPerPt) / r.px); return cx >= 0 && cy >= 0 && cx < r.w && cy < r.h && !!r.fal[cy * r.w + cx]; };
      for (let q = 0; q < lepes; q++) {
        const [mx, my] = pt(t0 + ((q + 0.5) / lepes) * (t1 - t0)); let h = -1;
        // a belső síkba befutó belső fal (csatlakozás): befelé 5–30 cm-en végig falcella – a belső felületből levonódik
        let fal = true; for (let d = 0.05; d <= 0.3 + 1e-9 && fal; d += 0.05) if (!falC(mx - (n[0] * d) / r.mPerPt, my - (n[1] * d) / r.mPerPt)) fal = false;
        csatl.push(fal);
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
        const cs = csatl.slice(Math.round(((ta - t0) / (t1 - t0)) * lepes), q).filter(Boolean).length * (((t1 - t0) * l) / lepes);
        const A = m(...pt(ta)), B = m(...pt(tb));
        const d: P2 = [B[0] - A[0], B[1] - A[1]]; const ll = Math.hypot(d[0], d[1]); const u: P2 = [d[0] / ll, d[1] / ll], k = v / 2;
        // tengely: a belső sík + fél falvastagság kifelé; a körvonal csúcsainál a vég a falvastagság felével hosszabb
        const e0 = ta <= 1e-6 ? k : 0, e1 = tb >= 1 - 1e-6 ? k : 0;
        const a: P2 = [A[0] + n[0] * k - u[0] * e0, A[1] + n[1] * k - u[1] * e0], b: P2 = [B[0] + n[0] * k + u[0] * e1, B[1] + n[1] * k + u[1] * e1];
        const balN: P2 = [u[1], -u[0]]; const helyBal = balN[0] * -n[0] + balN[1] * -n[1] > 0;
        const tul: Oldal = f === 'szomszed' ? { fajta: 'szomszed' } : f === 'futetlen' ? { fajta: 'futetlen' } : { fajta: 'kulso' };
        ki.push({ a, b, vastag: v, bal: helyBal ? h : tul, jobb: helyBal ? tul : h, sik: ll, burokEl: { pt: [pt(ta), pt(tb)], irany: el.irany, ri: h, A, B, csatl: cs } });
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
  // (az épülettömegen belüli, a modellben nem szereplő rész – más rendeltetési egység, akna, a rajzon nem lehatárolt
  // helyiség – nem fűtetlen tér: fedettnek számít, mint a fal)
  for (const [sz0, g] of racs) { const f0 = kiterj(g, (ti) => terek[ti]!.kategoria === 'futott'), nf = kiterj(g, (ti) => terek[ti]!.kategoria === 'futetlen'), tm = tomeg(sz0); for (let k = 0; k < f0.length; k++) if (tm[k] && !nf[k]) f0[k] = 1; fut.set(sz0, f0); nfut.set(sz0, nf); }
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
  // (a körvonal nélküli tér helyzete ismeretlen: fölötte / alatta lévő szintnél fedettnek vesszük – mint a fal alatti
  // részt –, a legfelső szinten a tető, a legalsón a padló, terepszint alatti szint fölött a födém a szint átlaga szerint)
  for (const { t } of atlag) {
    const m = szintArany.get(t.szint), A0 = szintA.get(t.szint), i = sorrend.indexOf(t.szint);
    const fel = sorrend[i + 1], le = i > 0 ? sorrend[i - 1] : undefined;
    const vanFel = !!fel && racs.has(fel), vanLe = !!le && racs.has(le), leFold = vanLe && (szintek.find((x) => x.id === le)?.z0 ?? 0) < -0.5;
    const atl = (hely: VizszintesBurok['hely'], csak: (f: VizszintesBurok['fajta']) => boolean) => {
      let db = 0;
      if (m && A0) for (const [k, e] of m) { const [h, fajta] = k.split('|') as [VizszintesBurok['hely'], VizszintesBurok['fajta']]; if (h !== hely || !csak(fajta)) continue; add(t, h, fajta, e.Av / A0, e.x, (t.A * e.A) / A0); db++; }
      return db;
    };
    if (!vanFel && !atl('felul', (f) => f === 'teto' || f === 'ferde' || f === 'padlasfodem')) add(t, 'felul', 'teto', 1);
    if (!vanLe) add(t, 'alul', 'padlo', 1);
    else if (leFold) atl('alul', (f) => f === 'futetlenFelett' || f === 'padlo');
  }
  return ki;
}

/** A falak lefedése a rajzon (lásd FalLefedes): a modellfalak téglalapjai a lap raszterén, a rajzolt falpixelek a
 * modell befoglalójában (± 1 m). */
function falLefedes(L: LapBemenet, fs: Fal[], szint: string): FalLefedes {
  const r = L.a.r!; const W = r.w, H = r.h, px2 = r.px * r.px;
  const db = new Uint8Array(W * H);
  let x0 = W, y0 = H, x1 = 0, y1 = 0, osszA = 0;
  const cel = (p: P2) => { const [x, y] = modellbolPt(L, p); return [((x - r.x0) * r.mPerPt) / r.px, ((y - r.y0) * r.mPerPt) / r.px] as P2; };
  for (const f of fs) {
    const a = cel(f.a), b = cel(f.b), dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); if (l < 1e-6) continue;
    const ux = dx / l, uy = dy / l, fv = f.vastag / 2 / r.px;
    const xs = [a[0] + uy * fv, a[0] - uy * fv, b[0] + uy * fv, b[0] - uy * fv], ys = [a[1] - ux * fv, a[1] + ux * fv, b[1] - ux * fv, b[1] + ux * fv];
    const bx0 = Math.max(0, Math.floor(Math.min(...xs))), bx1 = Math.min(W - 1, Math.ceil(Math.max(...xs))), by0 = Math.max(0, Math.floor(Math.min(...ys))), by1 = Math.min(H - 1, Math.ceil(Math.max(...ys)));
    for (let gy = by0; gy <= by1; gy++) for (let gx = bx0; gx <= bx1; gx++) {
      const qx = gx + 0.5 - a[0], qy = gy + 0.5 - a[1], t = qx * ux + qy * uy, d = Math.abs(qx * uy - qy * ux);
      if (t < 0 || t > l || d > fv) continue;
      const k = gy * W + gx; if (db[k]! < 255) db[k]!++; osszA += px2;
      if (gx < x0) x0 = gx; if (gx > x1) x1 = gx; if (gy < y0) y0 = gy; if (gy > y1) y1 = gy;
    }
  }
  const tart = Math.round(1 / r.px);
  x0 = Math.max(0, x0 - tart); y0 = Math.max(0, y0 - tart); x1 = Math.min(W - 1, x1 + tart); y1 = Math.min(H - 1, y1 + tart);
  let R = 0, M = 0, I = 0;
  for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) { const k = gy * W + gx; const rf = (!!r.fal[k] || !!r.nyilas[k]), mf = db[k]! > 0; if (rf) R++; if (mf) M++; if (rf && mf) I++; }
  // közelség (0,3 m): a maszkok kiterjesztése soronként, majd oszloponként
  const n = Math.max(1, Math.round(0.3 / r.px));
  const tag = (f: (k: number) => boolean) => {
    const a = new Uint8Array(W * H);
    for (let gy = y0; gy <= y1; gy++) { let utolso = -1e9; for (let gx = x0; gx <= x1; gx++) { if (f(gy * W + gx)) utolso = gx; if (gx - utolso <= n) a[gy * W + gx] = 1; } utolso = 1e9; for (let gx = x1; gx >= x0; gx--) { if (f(gy * W + gx)) utolso = gx; if (utolso - gx <= n) a[gy * W + gx] = 1; } }
    const b = new Uint8Array(W * H);
    for (let gx = x0; gx <= x1; gx++) { let utolso = -1e9; for (let gy = y0; gy <= y1; gy++) { if (a[gy * W + gx]) utolso = gy; if (gy - utolso <= n) b[gy * W + gx] = 1; } utolso = 1e9; for (let gy = y1; gy >= y0; gy--) { if (a[gy * W + gx]) utolso = gy; if (utolso - gy <= n) b[gy * W + gx] = 1; } }
    return b;
  };
  const rK = tag((k) => (!!r.fal[k] || !!r.nyilas[k])), mK = tag((k) => db[k]! > 0);
  let tk = 0, tt = 0, hk = 0, ht = 0;
  for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) { const k = gy * W + gx; const rf = (!!r.fal[k] || !!r.nyilas[k]), mf = db[k]! > 0; if (mf && !rf) { if (rK[k]) tk++; else tt++; } if (rf && !mf) { if (mK[k]) hk++; else ht++; } }
  try { if ((globalThis as any).__lefedesDbg) { let rle = ''; let prev = -1, cnt = 0; for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) { const k = gy * W + gx; const v = (r.fal[k] || r.nyilas[k] ? 1 : 0) + (db[k]! > 0 ? 2 : 0); if (v === prev) cnt++; else { if (cnt) rle += prev + ':' + cnt + ','; prev = v; cnt = 1; } } rle += prev + ':' + cnt; ((globalThis as any).__lefedesKep ??= []).push({ w: x1 - x0 + 1, h: y1 - y0 + 1, rle }); } } catch { /* */ }
  const kr = (v: number, d = 3) => Math.round(v * 10 ** d) / 10 ** d;
  return { lap: L.lap, szint, rajzA: kr(R * px2, 2), modellA: kr(M * px2, 2), lefedes: kr(R ? I / R : 0), pontossag: kr(M ? I / M : 0), atfedes: kr(osszA - M * px2, 2),
    tobbletKozel: kr(tk * px2, 2), tobbletTavol: kr(tt * px2, 2), hianyKozel: kr(hk * px2, 2), hianyTavol: kr(ht * px2, 2) };
}

/**
 * A fal rétegrendje a rajzról: a tengelyre merőleges metszékek (a hossz 10–90 %-ánál) mentén a raszter
 * stílusai; az egymást követő azonos stílusú pixelek egy réteg. A szélesség ≥ 60 %-át fedő metszékek leggyakoribb
 * rétegrendje. Egyrétegű (egy stílusú) falnál nincs (az anyag adja).
 */
function falRetegek(L: LapBemenet, f: FalNyers): Fal['retegek'] | undefined {
  const r = L.a.r; const ST = r?.anyagStilus ?? r?.stilus; const INFO = r?.anyagStilus ? r.anyagInfo : r?.stilusInfo; if (!r || !ST || !INFO) return undefined;
  const dx = f.b[0] - f.a[0], dy = f.b[1] - f.a[1], l = Math.hypot(dx, dy); if (l < 0.5) return undefined;
  const ux = dx / l, uy = dy / l, nx = -uy, ny = ux;
  // (a metszékek a hossz 10–90 %-ánál: a nyílások helyén nincs rajzolt fal – ott a metszék kimarad)
  const jeloltek: { st: number; n: number }[][] = [];
  for (const t of [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]) {
    const cx = f.a[0] + dx * t, cy = f.a[1] + dy * t;
    const futas: { st: number; n: number }[] = [];
    // (a metszék a falvastagságnál 12 cm-rel szélesebb: a tengely a rajzolt faltól eltérhet – a középhez legközelebbi
    // összefüggő (≤ 3 cm-es résekkel) rajzolt sáv a fal metszete)
    const lepes = r.px, fel = f.vastag / 2 + 0.12, st0: number[] = [];
    for (let d = -fel; d <= fel + 1e-9; d += lepes) {
      const [x, y] = modellbolPt(L, [cx + nx * d, cy + ny * d]);
      const gx = Math.floor(((x - r.x0) * r.mPerPt) / r.px), gy = Math.floor(((y - r.y0) * r.mPerPt) / r.px);
      st0.push(gx >= 0 && gy >= 0 && gx < r.w && gy < r.h ? ST[gy * r.w + gx]! : 0);
    }
    const kozep = Math.round(fel / lepes), res = Math.max(1, Math.round(0.03 / lepes));
    let k0 = -1; for (let o = 0; o <= Math.round(0.12 / lepes) && k0 < 0; o++) { if (st0[kozep - o]) k0 = kozep - o; else if (st0[kozep + o]) k0 = kozep + o; }
    if (k0 < 0) continue;
    let i0 = k0, i1 = k0;
    for (let i = k0 - 1; i >= 0 && k0 - i; i--) { if (st0[i]) i0 = i; else if (i0 - i > res) break; }
    for (let i = k0 + 1; i < st0.length; i++) { if (st0[i]) i1 = i; else if (i - i1 > res) break; }
    for (let i = i0; i <= i1; i++) { const st = st0[i]!; const u = futas[futas.length - 1]; if (u && u.st === st) u.n++; else futas.push({ st, n: 1 }); }
    const belso = futas.filter((x) => x.st > 0 && x.n * lepes >= 0.015);
    const fedes = belso.reduce((s0, x) => s0 + x.n * lepes, 0);
    if (fedes < 0.6 * f.vastag || (i1 - i0 + 1) * lepes > f.vastag + 0.2) continue;
    jeloltek.push(belso);
  }
  // a leggyakoribb (stílus-sorrend szerinti) rétegrend, egyenlőségnél a több rétegű
  const kulcs = (x: { st: number }[]) => x.map((y) => y.st).filter((v, i, a) => i === 0 || a[i - 1] !== v).join(',');
  const gyak = new Map<string, number>(); for (const j of jeloltek) gyak.set(kulcs(j), (gyak.get(kulcs(j)) ?? 0) + 1);
  const legjobb = jeloltek.slice().sort((p, q) => (gyak.get(kulcs(q))! - gyak.get(kulcs(p))!) || (kulcs(q).split(',').length - kulcs(p).split(',').length))[0];
  // (egyetlen anyagú fal csak akkor kap rétegrendet, ha az anyaga PDF-réteg szerint ismert – pl. „VÁLASZFAL 10”)
  if (!legjobb || (new Set(legjobb.map((x) => x.st)).size < 2 && !Object.keys(INFO[legjobb[0]!.st - 1]?.retegek ?? {}).length)) return undefined;
  // a szomszédos azonos stílusú darabok egyesítése; a rétegvastagság a nyertes rétegrendű metszékek mediánja
  // (a sarokba, csatlakozásba eső metszék vastagabb)
  const egyesit = (j: { st: number; n: number }[]) => { const o: { st: number; n: number }[] = []; for (const x of j) { const u = o[o.length - 1]; if (u && u.st === x.st) u.n += x.n; else o.push({ ...x }); } return o; };
  const ossz = egyesit(legjobb), tars = jeloltek.filter((j) => kulcs(j) === kulcs(legjobb)).map(egyesit).filter((j) => j.length === ossz.length);
  ossz.forEach((x, k) => { const v = tars.map((j) => j[k]!.n).sort((a, b) => a - b); if (v.length) x.n = v[Math.floor(v.length / 2)]!; });
  return ossz.map((x) => { const info = INFO[x.st - 1]!; const reteg = Object.entries(info.retegek).sort((p, q) => q[1] - p[1])[0]?.[0];
    return { stilus: x.st, szin: info.szin, sraff: info.sraff, ...(reteg ? { reteg } : {}), vastag: Math.round(x.n * r.px * 100) / 100 }; });
}

const RETEG_JEL = /h[őo]szigetel|szigetel[ée]s|l[áa]bazat|[üu]veg|f[ée]m|bur?kolat|vakolat|^r[ée]teg/i;
/** Vastagság a PDF-réteg nevéből (cm → m): az utolsó 5–60 közti szám („POROTHERM FAL 30”, „VÁLASZFAL 10”). */
function nevVastag(n?: string): number | undefined {
  if (!n) return undefined;
  const sz = [...n.replace(/\.\d{3,}$/, '').matchAll(/(?:^|\D)(\d{1,2})(?=\D|$)/g)].map((m) => Number(m[1])).filter((v) => v >= 5 && v <= 60);
  return sz.length ? sz[sz.length - 1]! / 100 : undefined;
}
/**
 * A födémek rétegrendje a metszet vízszintes sávjaiból: a födém síkjához (padló: a szint padlója, ± 35 cm; tető: a szint
 * teteje, ± 40 cm) legközelebbi legfelső, legalább 2 m széles sávtól lefelé az egymáshoz (± 2 cm) csatlakozó sávok
 * (szintenként a legszélesebb, ugyanarról a metszetlapról), legfeljebb 1,2 m mélységig.
 */
function fodemRetegrend(fodemek: Fodem[], szintek: Szint[], savok0: FodemSav[]): Map<string, number> {
  const elt = new Map<string, number>();
  const szeles = savok0.filter((q) => q.szel >= 2);
  for (const fd of fodemek) {
    const sz0 = szintek.find((q) => q.id === (fd.folott ?? fd.alatt)); if (!sz0) continue;
    const cel = fd.id.startsWith('FT') ? sz0.z0 + sz0.h : sz0.z0, tol = fd.id.startsWith('FT') ? 0.4 : 0.35;
    // (minden jelölt kezdősávból lánc, metszetlaponként; a lánc a legszélesebb tagja 30 %-ánál keskenyebb sávnál véget
    // ér – más szerkezet, pl. alatta lévő lapostető rétege; a nagyobb összszélességű lánc nyer)
    const lancol = (elso: FodemSav) => { const lanc = [elso];
      for (;;) { const u = lanc[lanc.length - 1]!, max = Math.max(...lanc.map((q) => q.szel));
        const k = szeles.filter((q) => q.lap === elso.lap && !lanc.includes(q) && Math.abs(q.zFelso - u.zAlso) <= 0.02).sort((p, q) => q.szel - p.szel)[0];
        if (!k || k.szel < 0.3 * max || elso.zFelso - k.zAlso > 1.2) break; lanc.push(k); }
      return lanc; };
    const lancok = szeles.filter((q) => Math.abs(q.zFelso - cel) <= tol).map(lancol).sort((p, q) => q.reduce((t, x) => t + x.szel, 0) - p.reduce((t, x) => t + x.szel, 0));
    // (a szint padlója burkolattal / aljzattal kezdődik: ha van ilyen lánc, csak ezek közül – a lapostető rétegei nem padló)
    const padloLanc = fd.id.startsWith('FP') ? lancok.filter((l) => /padl[óo]|burkolat|aljzat|esztrich/i.test(l[0]!.reteg)) : [];
    const lanc = (padloLanc.length ? padloLanc : lancok)[0]; if (!lanc) continue; const elso = lanc[0]!;
    fd.retegek = lanc.map((q) => ({ reteg: q.reteg.trim(), vastag: q.vastag }));
    fd.vastag = Math.round(lanc.reduce((t, q) => t + q.vastag, 0) * 100) / 100; fd.z = elso.zFelso;
  }
  // a szintek padlómagassága a metszet szerinti kész padló (a felismert szintmagasság egyenletes emeletmagasságból jön)
  for (const fd of fodemek) {
    if (!fd.id.startsWith('FP') || !fd.retegek || !fd.alatt) continue;
    const i = szintek.findIndex((q) => q.id === fd.folott); if (i <= 0) continue;
    const sz0 = szintek[i]!, elozo = szintek[i - 1]!;
    if (Math.abs(fd.z - sz0.z0) > 0.35 || fd.z - elozo.z0 < 2) continue;
    const d = fd.z - sz0.z0; sz0.z0 = fd.z; elozo.h = Math.round((fd.z - elozo.z0) * 100) / 100; sz0.h = Math.round((sz0.h - d) * 100) / 100;
    elt.set(sz0.id, d);
  }
  return elt;
}

/** Rétegzett lapon a fal tengelye mentén (± 8 cm-en belül) fal-fólia vonala fut-e a hossz legalább felén. */
function falVonalMent(L: LapBemenet, f: FalNyers): boolean {
  const r = L.a.r; if (!r?.falVonal) return false;
  const dx = f.b[0] - f.a[0], dy = f.b[1] - f.a[1], l = Math.hypot(dx, dy); if (l < 0.2) return false;
  const nx = -dy / l, ny = dx / l; let van = 0, n = 0;
  for (let t = 0.05; t < 0.96; t += 0.05) { n++;
    for (let d = -0.08; d <= 0.08 + 1e-9; d += r.px / 2) { const [x, y] = modellbolPt(L, [f.a[0] + dx * t + nx * d, f.a[1] + dy * t + ny * d]);
      const gx = Math.floor(((x - r.x0) * r.mPerPt) / r.px), gy = Math.floor(((y - r.y0) * r.mPerPt) / r.px);
      if (gx >= 0 && gy >= 0 && gx < r.w && gy < r.h && r.falVonal[gy * r.w + gx]) { van++; break; } } }
  return van >= 0.5 * n;
}
/** A fal magvastagsága (lásd Fal.mag). */
function falMag(f: Fal): number | undefined {
  const igazit = (mert: number, nev?: string) => { const v = nevVastag(nev); return v !== undefined && Math.abs(v - mert) <= 0.12 ? v : mert; };
  if (f.retegek?.length) {
    const nevek = new Set(f.retegek.map((r) => RETEG_JEL.test(r.reteg ?? '')));
    const mag = f.retegek.filter((r) => (nevek.size > 1 ? !RETEG_JEL.test(r.reteg ?? '') : r.sraff));
    const s = mag.reduce((t, r) => t + r.vastag, 0);
    if (s > 0.04) return Math.round(igazit(s, mag.length === 1 ? mag[0]!.reteg : undefined) * 100) / 100;
  }
  // (rétegrend nélkül a mért vastagság a raszter falsávjáé – bizonytalanabb: a fólia neve ± 20 cm-ig dönt)
  if (f.anyag?.reteg && !RETEG_JEL.test(f.anyag.reteg)) { const v = nevVastag(f.anyag.reteg); return Math.round((v !== undefined && Math.abs(v - f.vastag) <= 0.2 ? v : f.vastag) * 100) / 100; }
  return undefined;
}

/** Pont (modell, m) → lapkoordináta (pt): a lap affin leképezésének inverze. */
function modellbolPt(L: LapBemenet, p: P2): P2 {
  const o = L.m(0, 0), ex = L.m(1, 0), ey = L.m(0, 1);
  const a = ex[0] - o[0], b = ey[0] - o[0], c = ex[1] - o[1], d = ey[1] - o[1], det = a * d - b * c;
  const x = p[0] - o[0], y = p[1] - o[1];
  return [(d * x - b * y) / det, (-c * x + a * y) / det];
}
/** A fal anyaga: a tengely menti raszterpixelek leggyakoribb stílusa (a végeken 15 %-ot kihagyva – csatlakozások). */
function falAnyag(L: LapBemenet, f: FalNyers): Fal['anyag'] | undefined {
  const r = L.a.r; const ST = r?.anyagStilus ?? r?.stilus; const INFO = r?.anyagStilus ? r.anyagInfo : r?.stilusInfo; if (!r || !ST) return undefined;
  const db = new Map<number, number>();
  for (let i = 0; i <= 12; i++) {
    const t = 0.15 + (0.7 * i) / 12;
    const [x, y] = modellbolPt(L, [f.a[0] + (f.b[0] - f.a[0]) * t, f.a[1] + (f.b[1] - f.a[1]) * t]);
    const gx = Math.floor(((x - r.x0) * r.mPerPt) / r.px), gy = Math.floor(((y - r.y0) * r.mPerPt) / r.px);
    if (gx < 0 || gy < 0 || gx >= r.w || gy >= r.h) continue;
    const st = ST[gy * r.w + gx]!; if (st) db.set(st, (db.get(st) ?? 0) + 1);
  }
  const best = [...db.entries()].sort((p, q) => q[1] - p[1])[0]; if (!best) return undefined;
  const info = INFO?.[best[0] - 1]; if (!info) return undefined;
  const reteg = Object.entries(info.retegek).sort((p, q) => q[1] - p[1])[0]?.[0];
  return { stilus: best[0], szin: info.szin, sraff: info.sraff, ...(reteg ? { reteg } : {}) };
}
function falSzerkezet(v: number, anyag?: Fal['anyag']): Fal['szerkezet'] {
  const r = anyag?.reteg?.toLowerCase() ?? '';
  if (/teherhord|szerkezeti|structural|load/.test(r)) return 'teherhordo';
  if (/válaszfal|valaszfal|partition|gipszkarton/.test(r)) return 'valaszfal';
  return v >= 0.2 ? 'teherhordo' : v <= 0.15 ? 'valaszfal' : 'egyeb';
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
