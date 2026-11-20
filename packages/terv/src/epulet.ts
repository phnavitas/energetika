/**
 * Épületmodell a felismert alaprajzokból (IFC-fogalmak szerint): szintek, terek, falak (tengely, vastagság, magasság,
 * két oldaluk), nyílászárók a falakban, födémek – a hőburok elemenként / oldalanként jelölve.
 *
 * Koordináták: méter, x jobbra, y lefelé (a lap szerint), z felfelé. A lapok egymáshoz igazítását (eltolás) és a
 * szintmagasságokat a hívó adja meg (lapbemenet).
 */
import { tetoHaromszogek } from './tetoModell';
import { pillerKeres } from './pillerek';
import { poligonKulonbseg } from './poligonKulonbseg';
import type { Lap } from './kinyeres';
import type { FodemSav, MetszetElem } from './metszetGeom';
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
  /** A rétegek a metszet e rétegrendjéből (kód), nem a rajzból. */
  retegForras?: string;
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
  /** Forrás: a lap sorszáma és a nyílás indexe a lap elemzésében (al.nyilasok; ≥ 20000: modellAjtok) – a kézi méretmódosításhoz. */
  forras?: { lap: number; ny: number };
  /** A mellvédmagasság a homlokzat szerinti (LapBemenet.mellved); az alaprajzi felirat szerinti érték. */
  pmAlaprajz?: number;
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
  /** Lapostető (az alsó szint felső szint által le nem fedett része, a teljes modellben): vetületi terület (m²), szabad
   *  széle (m), a felső szint falához csatlakozó hossza (m), a rajta álló attika hossza (m). */
  lapos?: { terulet: number; szel: number; csatl: number; attika: number };
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
export interface Piller { id: string; szint: string; kozep: P2; /** keresztmetszet (m, x / y irányban) */ a: number; b: number; z0: number; h: number; reteg: string;
  /** Helye a falakhoz képest (az ELBA pillerFalhoz szabálya): falban (a fal átmegy rajta, ill. T-csatlakozás), falvégen,
   * sarkon, szabadon álló. A falban álló pillér a fal hosszában benne van – az ELBA a falfelületből vonja le. */
  hely?: 'fal' | 'veg' | 'sarok' | 'szabad';
  /** A befogadó fal (a tengelyéhez legközelebbi) és a pillérhez érő falak. */
  falId?: string; falak?: string[] }

/** Gerenda (kiváltó, alulbordás): az alaprajzon falanyag nélküli helyiséghatár a „ger. as: +2,60” feliratával – az
 * alsó síkja a feliratból, a felső a fölötte lévő födém alsó síkja. */
export interface Gerenda { id: string; szint: string; a: P2; b: P2; szel: number; alsoSik: number; felsoSik: number; magas: number; falId: string }

/** Alapozás a legalsó szint teherhordó falai alatt (a metszet szerinti keresztmetszettel): sávalap, ill. a rá ülő lábazati
 * fal (zsalukő); a hossz a falaké. */
export interface Alapozas { id: string; fajta: 'savalap' | 'labazat' | 'pontalap' | 'lemezalap'; szel: number; magas: number; zFelso: number; reteg: string; falak: string[]; hossz: number;
  /** pontalapnál: a pillér, amely alatt áll; becsült: a mérete nem a rajzról van */
  piller?: string; becsult?: boolean;
  /** lemezalapnál a területe (m², a legalsó szint körvonala) */
  terulet?: number }

/**
 * Magastető a legfelső szint körvonalán (tetoModell.tetoHaromszogek): a tetőfelület háromszögei – az ELBA ebből bontja
 * fő tetőre és tetőszakaszokra (ElbaBimGeometria.tetoBontas) –, az ereszvonal, a hajlás és az ereszkiállás.
 */
export interface Magasteto { szint: string; hajlas: number; kiallas: number; kiallasBecsult: boolean;
  /** derekszogu: pontos (téglalapos bontás, főirányba forgatva); konvex: élsíkok alsó burkolója; vaz: egyenes váz (ferde, nem konvex); kozelito: derékszögűsített körvonal */
  mod: 'derekszogu' | 'konvex' | 'vaz' | 'kozelito'; zEresz: number; eresz: P2[]; haromszogek: [number, number, number][][];
  /** A tető alá vont fedett teraszok (a szint körvonalán kívül, szabad pillérsorig – fedettTerasz) alaprajzi sávjai. */
  fedett?: P2[][];
  /** A kért oromfal(ak)kal a tetőfelület nem állítható elő (átfedő síkok) – oromfal nélkül (kontyolva) számolva. */
  oromElvetve?: boolean;
  /** A szint körvonalának lapostetős részei (a magastető ezeken kívül); több magastetős darabnál a további darabok ereszvonala. */
  lapos?: P2[][]; tovabbiEresz?: P2[][];
  /** A féltetős részek (alaprajz, hajlás, a lejtés lapiránya) – a háromszögeik a `haromszogek` közt; az alsó élük az
   *  eresz magasságában. */
  felteto?: { pol: P2[]; hajlas: number; lejt: number }[];
  /** A bemenet lapostetős sávjai (MagastetoBe.lapos) – a kézi javítás felületéhez. */
  laposSav?: { tengely: 'x' | 'y'; a: number; b: number; felteto?: { c0: number; c1: number; hajlas: number; lejt: number } }[] }

/** A magastető bemenete: hajlás (fok), oromzatok lapirányonként (szélesség, m), ereszkiállás (m, alapból 0,5 – becsült),
 *  lapostetős sávok (modellkoordináta, m: 'x' – az x ∈ [a, b] sáv, 'y' – az y ∈ [a, b] sáv; a homlokzatokról –
 *  tetoReszek.laposTetoSavok –, ill. kézzel): ezeken a szint körvonalának része lapostetős, a többi kap magastetőt. */
export interface MagastetoBe { hajlas: number; orom?: Record<number, number>; kiallas?: number;
  /** (felteto: a sáv c0–c1 része – a sávra merőleges tengelyen – féltető a hajlással, lejt irányába lejtve) */
  lapos?: { tengely: 'x' | 'y'; a: number; b: number; felteto?: { c0: number; c1: number; hajlas: number; lejt: number } }[];
  /** Lapostetős sáv a szint (födém) körvonalának oldalairól (lapirány: 0 fent, 90 jobbra, 180 lent, 270 balra): szélesség, m. */
  laposOldal?: Record<number, number>;
  /** Az oldalhoz érő sáv teteje kézzel: féltető (hajlás, a lejtés lapiránya – a teljes sávon), null: lapostető. */
  feltetoOldal?: Record<number, { hajlas: number; lejt: number } | null> }

/** Koszorú szintenként: a teherhordó falak tetején (a metszet szerinti keresztmetszettel), a hossza a falaké. */
export interface Koszoru { id: string; szint: string; szel: number; magas: number; zFelso: number; reteg: string; falak: string[]; hossz: number;
  /** 'attika': a koszorúra ülő vasbeton sáv a lapostetős részen (a fölötte lévő szint körvonalán kívüli teherhordó falakon). */
  fajta?: 'koszoru' | 'attika' }

export interface EpuletModell { szintek: Szint[]; terek: Ter[]; falak: Fal[]; nyilasok: Nyilas[]; fodemek: Fodem[]; vizszintes: VizszintesBurok[]; tetok: TetoGeom[]; lefedes?: FalLefedes[]; pillerek?: Piller[]; koszoruk?: Koszoru[]; gerendak?: Gerenda[]; alapozas?: Alapozas[]; magasteto?: Magasteto }

/** A metszet egy külsőfal-rétegrendje (kód, rétegek: leírás, vastagság m, hőszigetelés-e). */
export interface KulsoFalRetegrend { kod: string; retegek: { leiras: string; vastag: number; szigeteles: boolean }[] }

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
  /** Az alaprajzitól eltérő, a homlokzat szerinti mellvédmagasság (m) nyílásonként (homlokzatMellvedek). */
  mellved?: ReadonlyMap<object, number>;
  /** A fűtött terek hőburka (pt, a fal belső síkján) – ha megadott, a fűtött terek külső falai ennek éleiből (mért
   * falvastagsággal, a túloldal környezete szerint), a helyiségek raszteres szakaszai csak a belső falakhoz kellenek. */
  burokPol?: Poligon[];
  /** A burok raszterje (ha eltér a lap raszterétől, pl. vektoros falú). */
  burokR?: Raszter;
  /** Az épülettömeg körvonala (pt, a fal külső síkján) – kézzel szerkesztett hőburoknál ebből a födémek / a tető;
   * ennek híján a raszterből (`burokTomeg`). */
  tomegPol?: Poligon[];
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
  // (ferde egyenes csak akkor, ha a pontok valóban egy egyenesen vannak – a ferde fal pixelei; a sarkon befordulóak,
  // szétszórt pontok – a lépcsős, L alakú pixelsor – illesztett egyenese ferde lenne, a csatlakozás valójában derékszögű)
  // (csak külső / ismeretlen túloldalnál – a helyiségek közti rövid ferde fal pixelei a csatlakozó falak miatt szórhatnak)
  const szorodas = typeof s.tul === 'number' ? 0 : Math.sqrt(pm.reduce((t, [x, y]) => t + ((x - e.c[0]) * -u[1] + (y - e.c[1]) * u[0]) ** 2, 0) / pm.length);
  const kozel = Math.abs(((szog - tz + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) < (12 * Math.PI) / 180;
  if (!kozel && szorodas > 0.12) {
    // (a szétszórt pontok többsége a szakasz irányú egyenesen sincs rajta – pl. a helyiség belsejében lévő kis
    // szigetek, sraffozás határai –: nem fal)
    const d = pm.map(([x, y]) => x * ir[0] + y * ir[1]).sort((a, b) => a - b), dm = d[Math.floor(d.length / 2)]!;
    if (d.filter((v) => Math.abs(v - dm) <= 0.15).length < 0.6 * d.length) return null;
  }
  if (kozel || szorodas > 0.12) {
    n = ir; u = [-ir[1], ir[0]];
    const d = pm.map(([x, y]) => x * n[0] + y * n[1]).sort((a, b) => a - b), dm = d[Math.floor(d.length / 2)]!;
    const cd = e.c[0] * n[0] + e.c[1] * n[1]; c = [e.c[0] + n[0] * (dm - cd), e.c[1] + n[1] * (dm - cd)];
  }
  let t0 = Infinity, t1 = -Infinity; for (const [x, y] of pm) { const t = (x - c[0]) * u[0] + (y - c[1]) * u[1]; if (t < t0) t0 = t; if (t > t1) t1 = t; }
  // (külső / ismeretlen túloldalnál: a hosszának legalább 40 %-át folytonosan – ≤ 0,3 m-es hézagokkal – kísérik a
  // pontok; az egymástól távoli pillérek, szigetek határpixelei egy vonalban nem fal)
  if (t1 - t0 > 2 && typeof s.tul !== 'number') {
    const ts = pm.map(([x, y]) => (x - c[0]) * u[0] + (y - c[1]) * u[1]).sort((a, b) => a - b);
    let fed = 0; for (let i = 1; i < ts.length; i++) { const g = ts[i]! - ts[i - 1]!; if (g <= 0.3) fed += g; }
    if (fed < 0.4 * (t1 - t0)) return null;
  }
  return { p0: [c[0] + u[0] * t0, c[1] + u[1] * t0], p1: [c[0] + u[0] * t1, c[1] + u[1] * t1], n };
}

/** A raszter helyiségének egyedi azonosítója. */
const terId = (lap: number, szint: string, ri: number) => `T${lap}.${szint}.${ri}`;

/**
 * Épületmodell a lapokból. A típusszintes lap minden szintjére ugyanaz a geometria kerül (más azonosítóval).
 */
export function epuletModell(lapok: LapBemenet[], opt: { fodemSavok?: FodemSav[]; metszetElemek?: MetszetElem[];
  /** magastető: hajlás (fok), oromzatok lapirányonként (szélesség, m), ereszkiállás (m, alapból 0,5 – becsült) */
  teto?: MagastetoBe;
  /** A metszet külsőfal-rétegrendjei (kívülről befelé mindegy – a sorrend a táblázaté): ahol az alaprajzon mért fal
   *  vékonyabb (a homlokzati hőszigetelés sávja nem falként rajzolt), ill. a rajz rétegei közt nincs hőszigetelés. */
  kulsoFalRetegrend?: KulsoFalRetegrend[] } = {}): EpuletModell {
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
        // (teljes modell) vékonynak mért, anyag nélküli helyiségközi „fal”: ha mellette fal-fólia vonalpár fut, a fal az
        // (a raszterben a bútor / szaniter fehér takarása a falsávot elvékonyíthatja, a helyiséghatár ott elcsúszik)
        if (L.kizart && f.vastag <= 0.06 && typeof f.bal === 'number' && typeof f.jobb === 'number' && !falAnyag(L, f) && !falRetegek(L, f)) {
          const p = falVonalPar(L, f);
          if (p) { const l = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]), nx = -(f.b[1] - f.a[1]) / l, ny = (f.b[0] - f.a[0]) / l;
            f.a = [f.a[0] + nx * p.d, f.a[1] + ny * p.d]; f.b = [f.b[0] + nx * p.d, f.b[1] + ny * p.d]; f.vastag = p.v; }
        }
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
      falMagPontosit(falak.filter((q) => falIdk.some((x) => x.id === q.id)), L);
      // hőburokfalak belső síkjába csatlakozó belső falak (a belső felület ezekkel rövidebb – a raszter szerint)
      for (const { id, f } of falIdk) { const cs = f.burokEl?.csatl; if (cs && cs > 0) { const fal = falak.find((q) => q.id === id)!; fal.csatlakozas = sz(Math.min(cs, fal.sikHossz), 2); } }
      // (teljes modell) két helyiség közti rövid, falazóelemnél vastagabb (> 60 cm) „fal” két egy vonalba eső fal között:
      // a köztük lévő ajtó / áttörés környéke (a raszter a nyíláson át mér vastagságot) – a két szomszéd fal közti
      // szakasz, azok vastagságával és rétegrendjével (a nyílás így falra kerül)
      if (L.kizart) for (const { id, f: fn } of falIdk) {
        const w = falak.find((q) => q.id === id)!, v = w.mag ?? w.vastag;
        if (!(v > 0.6 && w.hossz < 2 * v && w.bal.fajta === 'ter' && w.jobb.fajta === 'ter')) continue;
        const ux = (w.b[0] - w.a[0]) / w.hossz, uy = (w.b[1] - w.a[1]) / w.hossz, mx = (w.a[0] + w.b[0]) / 2, my = (w.a[1] + w.b[1]) / 2;
        const jel = falIdk.map((x) => falak.find((q) => q.id === x.id)!).filter((q) => q.id !== id && q.szerkezet !== 'hatar' && (q.mag ?? q.vastag) <= 0.5 && q.hossz > 0.3 &&
          Math.abs(((q.b[0] - q.a[0]) * uy - (q.b[1] - q.a[1]) * ux) / q.hossz) < 0.05 && Math.abs((mx - q.a[0]) * uy - (my - q.a[1]) * ux) <= 0.3);
        // a két oldalon a legközelebbi vég (a középponttól mért vetület szerint)
        let e1: { t: number; q: Fal } | null = null, e2: { t: number; q: Fal } | null = null;
        for (const q of jel) for (const p of [q.a, q.b]) { const t = (p[0] - mx) * ux + (p[1] - my) * uy;
          if (t < 0 && (!e1 || t > e1.t) && [q.a, q.b].every((r) => (r[0] - mx) * ux + (r[1] - my) * uy <= t + 1e-6)) e1 = { t, q };
          if (t > 0 && (!e2 || t < e2.t) && [q.a, q.b].every((r) => (r[0] - mx) * ux + (r[1] - my) * uy >= t - 1e-6)) e2 = { t, q }; }
        if (!e1 || !e2 || e2.t - e1.t > 3 || Math.abs((e1.q.mag ?? e1.q.vastag) - (e2.q.mag ?? e2.q.vastag)) > 0.02) continue;
        // (a tengely az egyik szomszédé)
        const q = e1.q, qx = q.a[0], qy = q.a[1], vet = (t: number): P2 => { const px = mx + ux * t, py = my + uy * t; const s = (px - qx) * ux + (py - qy) * uy; return [sz(qx + ux * s), sz(qy + uy * s)]; };
        w.a = vet(e1.t); w.b = vet(e2.t); w.hossz = sz(e2.t - e1.t, 2); w.sikHossz = w.hossz; w.vastag = q.vastag; w.szerkezet = q.szerkezet;
        if (q.mag !== undefined) w.mag = q.mag; else delete w.mag;
        if (q.retegek) w.retegek = q.retegek.map((x) => ({ ...x })); if (q.anyag) w.anyag = { ...q.anyag };
        fn.a = w.a; fn.b = w.b; fn.vastag = w.vastag;
      }
      // nyílászárók: a helyiség (és a túloldal) falai közül a legközelebbi, amelynek tengelyére a nyílás közepe esik
      // (a teljes épületmodellben – kizart megadva – a csak a modellnek szóló belső ajtók is)
      const nyN = L.a.nyilasok.length;
      for (const [nyi, n] of [...L.a.nyilasok, ...(L.kizart ? L.a.modellAjtok ?? [] : [])].entries()) {
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
        // (felirat nélküli nyílás: becsült magasság; a mellvéd a becsült magassághoz illő – ajtómagasságnál 0)
        const nMag = n.mag > 0 ? n.mag : (n.szel >= 1.6 ? 2.4 : 1.5);
        const pmH = L.mellved?.get(n);
        nyilasok.push({ id: `N${++nySzam}`, fal: leg.id, szint: sz0.id, t: sz(leg.t, 2), szel: n.szel, mag: nMag, pm: pmH ?? n.pm ?? (nMag >= 1.9 ? 0 : 0.9), fajta: n.fajta, burok: fal.burok !== null,
          forras: { lap: L.lap, ny: nyi < nyN ? nyi : 20000 + nyi - nyN }, ...(pmH !== undefined && n.pm !== null ? { pmAlaprajz: n.pm } : {}) });
      }
      // (teljes modell) a hosszának legalább 70 %-án nyílással áttört külső fal (pl. garázskapu sávja) vastagsága a
      // rajzon nem látszik – a kapukeret / küszöb vonala adja –: a végeihez csatlakozó külső falaké
      if (L.kizart) for (const { id } of falIdk) {
        const f = falak.find((q) => q.id === id)!; if (!f.kulso || f.szerkezet === 'hatar') continue;
        const ny = nyilasok.filter((n) => n.fal === id).reduce((t, n) => t + n.szel, 0); if (ny < 0.7 * f.hossz) continue;
        const veg = (p: P2) => falak.filter((q) => q.id !== id && q.szint === f.szint && q.kulso && q.szerkezet !== 'hatar' && !nyilasok.some((n) => n.fal === q.id && n.szel >= 0.7 * q.hossz) &&
          [q.a, q.b].some((r) => Math.hypot(r[0] - p[0], r[1] - p[1]) <= 0.45));
        const szomsz = [...veg(f.a), ...veg(f.b)]; if (!szomsz.length) continue;
        const db = new Map<number, { n: number; q: Fal }>(); for (const q of szomsz) { const k = q.mag ?? q.vastag; const e = db.get(k) ?? { n: 0, q }; e.n += q.hossz; db.set(k, e); }
        const { q } = [...db.values()].sort((a, b) => b.n - a.n)[0]!;
        f.mag = q.mag ?? q.vastag; f.vastag = q.vastag; f.szerkezet = q.szerkezet; if (q.retegek) f.retegek = q.retegek.map((x) => ({ ...x }));
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
    const fel = L.rajz?.szovegek.filter((t) => /\p{L}{4,}/u.test(t.s)).map((t) => ({ x: t.x + t.szel / 2, y: t.y }));
    const pol = (L.tomegPol ?? burokTomeg(r, mind, undefined, undefined, fel)).map((p) => p.map(([x, y]) => L.m(x, y)));
    const vanFut = fut.size > 0;
    for (const sz0 of L.szintek) {
      const i = szintek.findIndex((x) => x.id === sz0.id);
      const also = i === 0, felso = i === szintek.length - 1 || !lapok.some((M) => M.szintek.some((x) => x.id === szintek[i + 1]?.id));
      fodemek.push({ id: `FP${sz0.id}`, alatt: also ? null : szintek[i - 1]!.id, folott: sz0.id, poligonok: pol, z: sz0.z0, vastag: 0.3, burok: also && vanFut ? 'padlo' : null });
      if (felso) fodemek.push({ id: `FT${sz0.id}`, alatt: sz0.id, folott: null, poligonok: pol, z: sz0.z0 + sz0.h, vastag: 0.3, burok: vanFut ? 'teto' : null });
    }
  }
  // lapostetők (teljes modell): az alsó szint felső szint által le nem fedett része
  for (const L of lapok) {
    if (!L.kizart) continue;
    for (const sz0 of L.szintek) {
      const i = szintek.findIndex((x) => x.id === sz0.id), kov = szintek[i + 1]; if (!kov) continue;
      const A = fodemek.find((f) => f.id === `FP${sz0.id}`), B = fodemek.find((f) => f.id === `FP${kov.id}`); if (!A || !B) continue;
      const k = poligonKulonbseg(A.poligonok, B.poligonok); if (k.terulet < 2) continue;
      fodemek.push({ id: `FL${sz0.id}`, alatt: sz0.id, folott: null, poligonok: k.poligonok, z: sz0.z0 + sz0.h, vastag: 0.3, burok: [...L.kategoria.values()].includes('futott') ? 'teto' : null,
        lapos: { terulet: k.terulet, szel: k.szel, csatl: k.csatl, attika: 0 } });
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
  // (teljes modell) 60 cm-nél vastagabb, a vastagsága kétszeresénél rövidebb, nyílás nélküli „fal” nem fal: kitöltött
  // folt (burkolat- / szigetelés-sraff, akna, kéménytest) – a falazóelemek legfeljebb 50 cm-esek
  if (lapok.some((L) => L.kizart)) for (let i = falak.length - 1; i >= 0; i--) {
    const f = falak[i]!, v = f.mag ?? f.vastag;
    if (f.szerkezet !== 'hatar' && v > 0.6 && f.hossz < 2 * v && !nyilasok.some((n) => n.fal === f.id)) falak.splice(i, 1);
  }
  pillerFalhoz(pillerek, falak);
  if (opt.fodemSavok?.length) {
    const elt = fodemRetegrend(fodemek, szintek, opt.fodemSavok);
    for (const f of [...falak, ...pillerek]) { const d = elt.get(f.szint); if (d) f.z0 = Math.round((f.z0 + d) * 100) / 100; }
    for (const p of pillerek) { const s0 = szintek.find((q) => q.id === p.szint); if (s0) p.h = s0.h; }
  }
  // (csak a teljes épületmodellben – kizart megadva –; a hőburok-átvétel falhosszai a korábbiak)
  if (lapok.some((L) => L.kizart)) { falVastagJavit(falak, nyilasok); sarokZaras(falak, nyilasok); }
  if (opt.kulsoFalRetegrend?.length) kulsoFalRetegek(falak, fodemek, nyilasok, opt.kulsoFalRetegrend);
  const koszoruk = opt.metszetElemek?.length ? koszoruKeres(szintek, falak, fodemek, opt.metszetElemek) : [];
  for (const fd of fodemek) if (fd.lapos) fd.lapos.attika = sz(koszoruk.filter((k) => k.fajta === 'attika' && k.szint === fd.alatt).reduce((t, k) => t + k.hossz, 0), 2);
  const gerendak = gerendaKeres(lapok, falak, fodemek, koszoruk);
  const magasteto = opt.teto ? magastetoEpit(szintek, fodemek, koszoruk, opt.teto, pillerek) : null;
  if (magasteto) oromFalak(falak, szintek, magasteto);
  const alapozas = opt.metszetElemek?.length ? alapozasKeres(szintek, falak, opt.metszetElemek, pillerek, opt.fodemSavok ?? [], fodemek) : [];
  return { szintek, terek, falak, nyilasok, fodemek, vizszintes: vizszintesBurok(szintek, terek, lapok, fodemek), tetok, lefedes, ...(pillerek.length ? { pillerek } : {}), ...(koszoruk.length ? { koszoruk } : {}), ...(gerendak.length ? { gerendak } : {}), ...(alapozas.length ? { alapozas } : {}), ...(magasteto ? { magasteto } : {}) };
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
      // (kézzel kijjebb húzott körvonal: a fal mögött 1,6 m-en belül nincs helyiség – a teljes él mintáin messzebb, 6 m-ig keresve)
      if (hely.every((x) => x < 0)) for (let q = 0; q < lepes; q++) {
        const [mx, my] = pt(t0 + ((q + 0.5) / lepes) * (t1 - t0)); let h = -1;
        for (let d = 1.7; d <= 6 && h < 0; d += 0.1) { const c = cella(mx - (n[0] * d) / r.mPerPt, my - (n[1] * d) / r.mPerPt); if (c >= 0 && futott.has(c)) h = c; }
        hely[q] = h;
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
/** Pont a sokszögben (vagy a határától legfeljebb tol távolságra). */
function pontBenne(pl: P2[], x: number, y: number, tol = 0): boolean {
  let be = false;
  for (let i = 0, j = pl.length - 1; i < pl.length; j = i++) { const [xi, yi] = pl[i]!, [xj, yj] = pl[j]!; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) be = !be; }
  if (be || tol <= 0) return be;
  for (let i = 0, j = pl.length - 1; i < pl.length; j = i++) { const [ax, ay] = pl[j]!, [bx, by] = pl[i]!; const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
    const u = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)); if (Math.hypot(x - ax - u * dx, y - ay - u * dy) <= tol) return true; }
  return false;
}

/**
 * A körvonal kis (≤ 40 cm) lépcsőinek elhagyása a tetőhöz: két párhuzamos él közti rövid, rájuk merőleges élnél a
 * belső él a külsőre tolódik (a tető az ereszkiállással a falsík kis ugrásait is lefedi – pl. 28 cm-es falkiugrás).
 */
function kisLepcsoNelkul(pol: P2[], max = 0.4): P2[] {
  let p = pol.map(([x, y]) => [x, y] as P2);
  const ter = (q: P2[]) => q.reduce((t, a, i) => { const b = q[(i + 1) % q.length]!; return t + a[0] * b[1] - b[0] * a[1]; }, 0) / 2;
  for (let kor = 0; kor < 20; kor++) {
    const n = p.length; if (n <= 4) break;
    let valt = false;
    for (let i = 0; i < n && !valt; i++) {
      const a = p[(i + n - 1) % n]!, b = p[i]!, c = p[(i + 1) % n]!, d = p[(i + 2) % n]!;
      const l = Math.hypot(c[0] - b[0], c[1] - b[1]); if (l > max || l < 1e-6) continue;
      const u = [(b[0] - a[0]), (b[1] - a[1])], w = [(d[0] - c[0]), (d[1] - c[1])], e = [(c[0] - b[0]) / l, (c[1] - b[1]) / l];
      const lu = Math.hypot(u[0]!, u[1]!), lw = Math.hypot(w[0]!, w[1]!); if (lu < 1e-6 || lw < 1e-6) continue;
      // a két szomszéd él párhuzamos, azonos irányú, és merőleges a rövid élre (lépcső, nem „U” bemélyedés)
      if (Math.abs(u[0]! * e[0]! + u[1]! * e[1]!) / lu > 0.02 || Math.abs(w[0]! * e[0]! + w[1]! * e[1]!) / lw > 0.02 || (u[0]! * w[0]! + u[1]! * w[1]!) / (lu * lw) < 0.98) continue;
      // két változat: b → c vonalára (b' = b + e·l), vagy c → b vonalára; a nagyobb területű marad
      const v1 = p.slice(); v1[i] = [b[0] + (c[0] - b[0]), b[1] + (c[1] - b[1])]; v1[(i + n - 1) % n] = [a[0] + (c[0] - b[0]), a[1] + (c[1] - b[1])];
      const v2 = p.slice(); v2[(i + 1) % n] = [c[0] - (c[0] - b[0]), c[1] - (c[1] - b[1])]; v2[(i + 2) % n] = [d[0] - (c[0] - b[0]), d[1] - (c[1] - b[1])];
      const s0 = Math.sign(ter(p)), j1 = ter(v1) * s0, j2 = ter(v2) * s0;
      const uj = j1 >= j2 ? v1 : v2;
      // egybeeső / egy egyenesbe eső csúcsok elhagyása
      const t: P2[] = [];
      for (const q of uj) { const z = t[t.length - 1]; if (!z || Math.hypot(q[0] - z[0], q[1] - z[1]) > 1e-6) t.push(q); }
      if (t.length > 1 && Math.hypot(t[0]![0] - t[t.length - 1]![0], t[0]![1] - t[t.length - 1]![1]) < 1e-6) t.pop();
      const k = t.filter((q, j) => { const r0 = t[(j + t.length - 1) % t.length]!, r1 = t[(j + 1) % t.length]!; return Math.abs((q[0] - r0[0]) * (r1[1] - q[1]) - (q[1] - r0[1]) * (r1[0] - q[0])) > 1e-6; });
      if (k.length >= 4) { p = k; valt = true; }
    }
    if (!valt) break;
  }
  return p;
}

/**
 * A körvonal sekély (≤ ereszkiállás, de legalább 0,6 m – kb. falvastagság –; ≤ 6 m széles) befelé nyíló fülkéi (bejárati fülke) a tetőhöz kitöltve: az eresz
 * egyenesen fut át fölöttük, nem vápázik be.
 */
function sekelyFulkeNelkul(pol: P2[], mely: number): P2[] {
  let p = pol.map(([x, y]) => [x, y] as P2);
  const ter = (q: P2[]) => q.reduce((t, a, i) => { const b = q[(i + 1) % q.length]!; return t + a[0] * b[1] - b[0] * a[1]; }, 0) / 2;
  for (let kor = 0; kor < 20; kor++) {
    const n = p.length; if (n <= 4) break;
    let valt = false;
    for (let i = 0; i < n && !valt; i++) {
      const a = p[(i + n - 1) % n]!, b = p[i]!, c = p[(i + 1) % n]!, d = p[(i + 2) % n]!;
      const l = Math.hypot(c[0] - b[0], c[1] - b[1]), l1 = Math.hypot(b[0] - a[0], b[1] - a[1]), l2 = Math.hypot(d[0] - c[0], d[1] - c[1]);
      if (l < 1e-6 || l > 6 || l1 > mely + 0.05 || l2 > mely + 0.05 || Math.abs(l1 - l2) > 0.05 || l1 < 1e-6) continue;
      const e = [(c[0] - b[0]) / l, (c[1] - b[1]) / l], u = [(b[0] - a[0]) / l1, (b[1] - a[1]) / l1], w = [(d[0] - c[0]) / l2, (d[1] - c[1]) / l2];
      // „U”: a két oldal merőleges az aljra és ellentétes irányú
      if (Math.abs(u[0]! * e[0]! + u[1]! * e[1]!) > 0.02 || Math.abs(w[0]! * e[0]! + w[1]! * e[1]!) > 0.02 || u[0]! * w[0]! + u[1]! * w[1]! > -0.98) continue;
      // b elhagyva, c az a-oldal mélységével kijjebb (a – c' tengelyirányú; a c' – d maradék lépcsőt a kisLepcsoNelkul viszi)
      const c2: P2 = [c[0] + w[0]! * l1, c[1] + w[1]! * l1];
      const uj0 = p.map((q, j) => (j === (i + 1) % n ? c2 : q)).filter((_, j) => j !== i);
      // csak befelé nyíló fülke (a kitöltés növeli a területet)
      if (Math.abs(ter(uj0)) <= Math.abs(ter(p))) continue;
      const uj: P2[] = []; for (const q of uj0) { const z = uj[uj.length - 1]; if (!z || Math.hypot(q[0] - z[0], q[1] - z[1]) > 0.005) uj.push(q); }
      if (uj.length > 1 && Math.hypot(uj[0]![0] - uj[uj.length - 1]![0], uj[0]![1] - uj[uj.length - 1]![1]) <= 0.005) uj.pop();
      const k = uj.filter((q, j) => { const r0 = uj[(j + uj.length - 1) % uj.length]!, r1 = uj[(j + 1) % uj.length]!; return Math.abs((q[0] - r0[0]) * (r1[1] - q[1]) - (q[1] - r0[1]) * (r1[0] - q[0])) > 1e-6; });
      if (k.length >= 4) { p = k; valt = true; }
    }
    if (!valt) break;
  }
  return p;
}

/** Magastető a legfelső szint körvonalán; oromfalas a téglalapvég, ha azon a homlokzaton a végszélesség legalább 60 %-a
 * oromzat. Az eresz a legfelső szint koszorújának tetején (ennek híján a szint tetején). */
/**
 * A külső falak rétegrendje a metszetből: ahol az alaprajzon mért vastagság a rétegrendénél legalább 8 cm-rel kisebb
 * (a hőszigetelés sávja a rajzon nem falként jelent meg), a fal belső síkja marad, a tengelye kifelé tolódik és a
 * vastagsága a rétegrendé; ahol a mért vastagság egyezik, de a rajz rétegei közt nincs hőszigetelés, a rétegek a
 * metszet szerintiek (a hőszigetelés neve, vastagsága így a mennyiségekben is megjelenik).
 */
function kulsoFalRetegek(falak: Fal[], fodemek: Fodem[], nyilasokRef: Nyilas[], rr: KulsoFalRetegrend[]): void {
  const jo = rr.filter((x) => x.retegek.some((q) => q.szigeteles) && x.retegek.reduce((t, q) => t + q.vastag, 0) >= 0.15);
  if (!jo.length) return;
  for (const f of falak) {
    if (!f.kulso || f.szerkezet === 'hatar' || f.vastag < 0.15 || f.profil) continue;
    const vanSzig = (f.retegek ?? []).some((q) => !q.sraff && q.vastag >= 0.04);
    // a mért vastagsághoz legközelebbi rétegrend
    const v = jo.map((x) => ({ x, T: x.retegek.reduce((t, q) => t + q.vastag, 0) })).sort((p, q) => Math.abs(p.T - f.vastag) - Math.abs(q.T - f.vastag))[0]!;
    const hiany = v.T - f.vastag;
    if (!(hiany >= 0.08 && hiany <= 0.4) && !(Math.abs(hiany) <= 0.1 && !vanSzig)) continue;
    if (hiany >= 0.08) {
      // kifelé: a padlófödém körvonalán kívül eső oldal
      const L = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]); if (L < 0.1) continue;
      const n: P2 = [(f.b[1] - f.a[1]) / L, -(f.b[0] - f.a[0]) / L], k: P2 = [(f.a[0] + f.b[0]) / 2, (f.a[1] + f.b[1]) / 2];
      const pol = fodemek.filter((d) => d.folott === f.szint).flatMap((d) => d.poligonok);
      const bent = (o: number) => pol.some((q) => pontBenne(q, k[0] + o * n[0] * (f.vastag / 2 + 0.25), k[1] + o * n[1] * (f.vastag / 2 + 0.25)));
      const ki = bent(1) && !bent(-1) ? -1 : !bent(1) && bent(-1) ? 1 : (f.bal.fajta === 'kulso' ? 1 : f.jobb.fajta === 'kulso' ? -1 : 0);
      if (!ki) continue;
      const d = (hiany / 2) * ki;
      // (sarkon – másik külső fal végpontja 0,5 m-en belül – a fal vége is kitolódik, hogy a sarok zárt maradjon)
      const u: P2 = [(f.b[0] - f.a[0]) / L, (f.b[1] - f.a[1]) / L];
      const sarok = (p: P2) => falak.some((q) => q !== f && q.kulso && q.szint === f.szint && [q.a, q.b].some((r) => Math.hypot(r[0] - p[0], r[1] - p[1]) <= 0.5));
      const ea = sarok(f.a) ? Math.abs(d) : 0, eb = sarok(f.b) ? Math.abs(d) : 0;
      f.a = [sz(f.a[0] + n[0] * d - u[0] * ea), sz(f.a[1] + n[1] * d - u[1] * ea)]; f.b = [sz(f.b[0] + n[0] * d + u[0] * eb), sz(f.b[1] + n[1] * d + u[1] * eb)];
      if (ea) for (const ny of nyilasokRef) if (ny.fal === f.id) ny.t = sz(ny.t + ea, 3);
      f.hossz = sz(f.hossz + ea + eb, 3);
      f.vastag = sz(v.T, 3); if (f.mag !== undefined) f.mag = Math.max(f.mag, sz(v.T, 3));
    }
    f.retegek = v.x.retegek.map((q) => ({ stilus: 0, szin: '', sraff: !q.szigeteles, reteg: q.leiras, vastag: sz(q.vastag, 3) }));
    f.retegForras = v.x.kod;
  }
}

/**
 * Oromfal: a magastetővel fedett szint külső falai a tető síkjáig érnek – ahol a tető (oromzat, kontylap alatti rész)
 * a fal teteje fölött van, a fal felső éle a tetőt követi (profil), így a modell zárt (nincs rés a fal és a tető közt).
 */
function oromFalak(falak: Fal[], szintek: Szint[], mt: Magasteto): void {
  const sz0 = szintek.find((s) => s.id === mt.szint); if (!sz0) return;
  const T = mt.haromszogek;
  const tetoZ = (x: number, y: number): number | null => {
    let z: number | null = null;
    for (const [a, b, c] of T) {
      const den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]); if (Math.abs(den) < 1e-12) continue;
      const w1 = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / den, w2 = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / den, w3 = 1 - w1 - w2;
      if (w1 < -1e-6 || w2 < -1e-6 || w3 < -1e-6) continue;
      const v = w1 * a[2] + w2 * b[2] + w3 * c[2]; if (z === null || v < z) z = v;
    }
    return z;
  };
  for (const f of falak) {
    if (f.szint !== mt.szint || !f.kulso || f.szerkezet === 'hatar' || f.profil) continue;
    const L = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]); if (L < 0.5) continue;
    const teto0 = f.z0 + f.h - sz0.z0, n = Math.max(2, Math.ceil(L / 0.25));
    const pr: { t: number; z: number }[] = [];
    let res = 0;
    for (let k = 0; k <= n; k++) {
      const t = k / n, z = tetoZ(f.a[0] + (f.b[0] - f.a[0]) * t, f.a[1] + (f.b[1] - f.a[1]) * t);
      const zr = z === null ? teto0 : Math.max(teto0, z - sz0.z0); res = Math.max(res, zr - teto0);
      pr.push({ t: sz(t, 4), z: sz(zr, 3) });
    }
    if (res < 0.15) continue;
    // (egyenes szakaszok összevonása)
    const ki = [pr[0]!];
    for (let i = 1; i < pr.length - 1; i++) { const p = ki[ki.length - 1]!, q = pr[i]!, r = pr[i + 1]!; const zv = p.z + ((r.z - p.z) * (q.t - p.t)) / (r.t - p.t || 1); if (Math.abs(zv - q.z) > 0.01) ki.push(q); }
    ki.push(pr[pr.length - 1]!);
    // (a fal magassága a profil legmagasabb pontjáig – a profil a szint padlójától mért)
    f.profil = ki; f.jelleg = f.jelleg ?? 'oromfal'; f.h = sz(Math.max(...ki.map((q) => q.z)) + sz0.z0 - f.z0, 3);
  }
}

function magastetoEpit(szintek: Szint[], fodemek: Fodem[], koszoruk: Koszoru[], t: MagastetoBe, pillerek: Piller[] = []): Magasteto | null {
  const fel = [...szintek].sort((a, b) => b.z0 - a.z0)[0]; if (!fel || !(t.hajlas > 5)) return null;
  const fd = fodemek.find((f) => f.alatt === fel.id && f.id.startsWith('FT')) ?? fodemek.find((f) => f.folott === fel.id);
  const pol0 = fd?.poligonok.slice().sort((a, b) => b.length - a.length)[0]; if (!pol0 || pol0.length < 4) return null;
  const { pol: pol1, fedett } = fedettTerasz(pol0, pillerek.filter((p) => p.szint === fel.id && p.hely === 'szabad'));
  const kiallas = t.kiallas ?? 0.5;
  const pol = kisLepcsoNelkul(sekelyFulkeNelkul(kisLepcsoNelkul(pol1), Math.max(kiallas, 0.6)));
  const k = koszoruk.find((q) => q.szint === fel.id && q.fajta !== 'attika');
  const zEresz = sz(k ? k.zFelso : fel.z0 + fel.h, 2);
  // lapostetős sávok: a körvonal ezekbe eső része lapostető, a maradék darabjai kapnak magastetőt (legalább 2 m széles,
  // 8 m²-es darabok; ha a sávok a körvonal 85 %-át fedik, nincs magastető)
  let darabok: P2[][] = [pol], lapos: P2[][] = [];
  const feltetok: { pol: P2[]; hajlas: number; lejt: number }[] = [];
  const bx = pol0.map((q) => q[0]), by = pol0.map((q) => q[1]);
  const fx0 = Math.min(...bx), fx1 = Math.max(...bx), fy0 = Math.min(...by), fy1 = Math.max(...by);
  const sav: NonNullable<MagastetoBe['lapos']> = [...(t.lapos ?? []).map((q) => ({ ...q })), ...Object.entries(t.laposOldal ?? {}).flatMap(([k, w]) => {
    const ir = Number(k); if (!(w > 0)) return [];
    return [ir === 270 ? { tengely: 'x' as const, a: fx0 - 2, b: fx0 + w } : ir === 90 ? { tengely: 'x' as const, a: fx1 - w, b: fx1 + 2 } : ir === 0 ? { tengely: 'y' as const, a: fy0 - 2, b: fy0 + w } : { tengely: 'y' as const, a: fy1 - w, b: fy1 + 2 }];
  })];
  for (const [k, v] of Object.entries(t.feltetoOldal ?? {})) {
    const ir = Number(k);
    const q = sav.find((r) => (r.tengely === 'x' ? (ir === 270 ? r.a <= fx0 + 0.6 : ir === 90 ? r.b >= fx1 - 0.6 : false) : ir === 0 ? r.a <= fy0 + 0.6 : ir === 180 ? r.b >= fy1 - 0.6 : false));
    if (!q) continue;
    if (v && v.hajlas > 0) q.felteto = { c0: (q.tengely === 'x' ? fy0 : fx0) - 2, c1: (q.tengely === 'x' ? fy1 : fx1) + 2, hajlas: v.hajlas, lejt: v.lejt }; else delete q.felteto;
  }
  if (sav.length) {
    const xs = pol.map((q) => q[0]), ys = pol.map((q) => q[1]);
    const x0 = Math.min(...xs) - 1, x1 = Math.max(...xs) + 1, y0 = Math.min(...ys) - 1, y1 = Math.max(...ys) + 1;
    const savok = sav.map((q): P2[] => (q.tengely === 'x' ? [[q.a, y0], [q.b, y0], [q.b, y1], [q.a, y1]] : [[x0, q.a], [x1, q.a], [x1, q.b], [x0, q.b]]));
    const mar = poligonKulonbseg([pol], savok);
    const T = Math.abs(teruletP(pol));
    const jo = mar.poligonok.filter((p) => Math.abs(teruletP(p)) >= 8);
    if (mar.terulet < 0.15 * T || !jo.length) return null;
    if (mar.terulet < 0.98 * T) {
      darabok = jo; lapos = poligonKulonbseg([pol], jo).poligonok.filter((p) => Math.abs(teruletP(p)) >= 2);
      // féltetős részek: a sáv és a féltető-tartomány metszete (a lapostetős részből kivonva)
      for (const q of sav) {
        const f = q.felteto; if (!f || !(f.hajlas > 0)) continue;
        const r: P2[] = q.tengely === 'x' ? [[q.a, f.c0], [q.b, f.c0], [q.b, f.c1], [q.a, f.c1]] : [[f.c0, q.a], [f.c1, q.a], [f.c1, q.b], [f.c0, q.b]];
        const kivul = poligonKulonbseg(lapos, [r]).poligonok;
        const fp = poligonKulonbseg(lapos, kivul).poligonok.filter((p) => Math.abs(teruletP(p)) >= 4);
        if (!fp.length) continue;
        lapos = kivul.filter((p) => Math.abs(teruletP(p)) >= 2);
        for (const p of fp) feltetok.push({ pol: p, hajlas: f.hajlas, lejt: f.lejt });
      }
    }
  }
  let oromElvetve = false, mod: Magasteto['mod'] | undefined;
  const reszek: { eresz: P2[]; haromszogek: [number, number, number][][] }[] = [];
  for (const d of darabok) {
    let oromKert = false;
    let g = tetoHaromszogek({ korvonal: d, hajlas: t.hajlas, kiallas, zEresz, orom: (ir, szel) => { const v = (t.orom?.[ir] ?? 0) >= 0.6 * szel; if (v) oromKert = true; return v; } });
    // ellenőrzés: a tetősíkok alaprajzi vetülete nem lehet nagyobb az eresz körvonalánál (oromfallal az összetett – L, T –
    // alaprajzon a síkok átfedhetnek); ilyenkor oromfal nélkül
    if (g && oromKert) {
      const vet = g.haromszogek.reduce((s0, [a, b, c]) => s0 + Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2, 0);
      const er = Math.abs(teruletP(g.eresz));
      if (vet > 1.02 * er + 0.5) { g = tetoHaromszogek({ korvonal: d, hajlas: t.hajlas, kiallas, zEresz }); oromElvetve = true; }
    }
    if (!g) continue;
    mod = mod ?? g.mod; reszek.push({ eresz: g.eresz, haromszogek: g.haromszogek });
  }
  if (!reszek.length || !mod) return null;
  const [fo, ...tobbi] = reszek;
  for (const f of feltetok) fo!.haromszogek.push(...feltetoHaromszogek(f.pol, f.hajlas, f.lejt, zEresz));
  const kerP = (p: P2[]) => p.map(([x, y]) => [sz(x), sz(y)] as P2);
  return { szint: fel.id, hajlas: t.hajlas, kiallas, kiallasBecsult: t.kiallas === undefined, mod, zEresz, eresz: kerP(fo!.eresz),
    ...(fedett.length ? { fedett } : {}), ...(oromElvetve ? { oromElvetve } : {}), ...(lapos.length ? { lapos: lapos.map(kerP), laposSav: sav.map((q) => ({ tengely: q.tengely, a: sz(q.a), b: sz(q.b), ...(q.felteto ? { felteto: { ...q.felteto, c0: sz(q.felteto.c0), c1: sz(q.felteto.c1) } } : {}) })) } : {}), ...(tobbi.length ? { tovabbiEresz: tobbi.map((q) => kerP(q.eresz)) } : {}), ...(feltetok.length ? { felteto: feltetok.map((f) => ({ ...f, pol: kerP(f.pol) })) } : {}),
    // (µm-re kerekítve: a tetőbontás az élek egyezéséből dolgozik – a mm-es kerekítés a T-csatlakozású élpontokat leviszi az élről)
    haromszogek: reszek.flatMap((q) => q.haromszogek).map((h) => h.map(([x, y, z]) => [sz(x, 6), sz(y, 6), sz(z, 6)] as [number, number, number])) };
}

/** A fal tengelyének egyik végét a tengely mentén új helyre teszi (a nyílások a-tól mért helye és a hossz követi). */
function falVegAllit(f: Fal, veg: 'a' | 'b', P: P2, nyilasok: Nyilas[]) {
  const L0 = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]); if (L0 < 1e-6) return;
  const u: P2 = [(f.b[0] - f.a[0]) / L0, (f.b[1] - f.a[1]) / L0];
  if (veg === 'a') { const d = (P[0] - f.a[0]) * u[0] + (P[1] - f.a[1]) * u[1]; for (const n of nyilasok) if (n.fal === f.id) n.t = sz(n.t - d, 2); f.a = [sz(P[0], 3), sz(P[1], 3)]; }
  else f.b = [sz(P[0], 3), sz(P[1], 3)];
  const L = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]); f.sikHossz = sz(Math.max(0, f.sikHossz + (L - f.hossz)), 2); f.hossz = sz(L, 2);
}

/**
 * Valószínűtlenül vastag fal (a rajzon a fal mellé simuló sraffozás – térkő, kavics, terep –, a vizes helyiség
 * berendezése a falvastagságba számít): a szint azonos fajtájú (külső / belső) falainak jellemző vastagságára (medián,
 * ≥ 3 fal), ha 0,6 m-nél vastagabb és a jellemzőnek legalább 1,6-szorosa (belső falnál 1,8-szorosa), rétegrend nélkül.
 * Külső falnál a tér felőli (belső) sík marad, belső falnál a tengely.
 */
function falVastagJavit(falak: Fal[], nyilasok: Nyilas[]) {
  void nyilasok;
  for (const szint of new Set(falak.map((f) => f.szint))) {
    // (csak belső falnál: a külső fal síkjához igazodik a födém / tömeg körvonala is – annak vastagsága így marad)
    for (const kulso of [false]) {
      const kf = falak.filter((f) => f.szint === szint && f.kulso === kulso && !f.profil);
      const jo = kf.filter((f) => f.vastag >= (kulso ? 0.15 : 0.05) && f.vastag <= 0.6 && f.hossz >= 1).map((f) => f.vastag).sort((a, b) => a - b);
      if (jo.length < 3) continue;
      const med = jo[jo.length >> 1]!;
      for (const f of kf) {
        if (!(f.vastag > 0.6 && f.vastag >= (kulso ? 1.6 : 1.8) * med) || f.retegek?.length) continue;
        if (kulso) {
          const L = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]); if (L < 1e-6) continue;
          const u: P2 = [(f.b[0] - f.a[0]) / L, (f.b[1] - f.a[1]) / L], balN: P2 = [u[1], -u[0]];
          const terBal = f.bal.fajta === 'ter', terJobb = f.jobb.fajta === 'ter'; if (terBal === terJobb) continue;
          // a tengely a tér felé tolódik (a belső sík helyben marad)
          const d = ((f.vastag - med) / 2) * (terBal ? 1 : -1);
          f.a = [sz(f.a[0] + balN[0] * d, 3), sz(f.a[1] + balN[1] * d, 3)]; f.b = [sz(f.b[0] + balN[0] * d, 3), sz(f.b[1] + balN[1] * d, 3)];
        }
        f.vastag = med;
      }
    }
  }
}

/**
 * Sarokzárás: két, közel derékszögben (75–105°) találkozó fal, amelyek végpontjai a tengelyeik metszéspontjától
 * legfeljebb a másik fal vastagságának megfelelő (≥ 0,8 m) távolságra vannak, a metszésponton túl a másik fal
 * vastagságának felével ér véget – a külső síkok a sarokban pontosan találkoznak (nincs rés, nincs kilógó falvég).
 */
function sarokZaras(falak: Fal[], nyilasok: Nyilas[]) {
  for (const szint of new Set(falak.map((f) => f.szint))) {
    const ff = falak.filter((f) => f.szint === szint && f.hossz >= 0.3 && !f.profil);
    type Veg = { f: Fal; veg: 'a' | 'b' };
    const jel: { v1: Veg; v2: Veg; X: P2; d: number }[] = [];
    const ir = (f: Fal): P2 => { const L = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]); return [(f.b[0] - f.a[0]) / L, (f.b[1] - f.a[1]) / L]; };
    // (a végpontnál egyenesen folytatódó fal – a falat csak a csatlakozó belső fal vágta ketté –: nem sarok)
    const folytatodik = (f: Fal, P: P2) => { const u = ir(f); return ff.some((g) => { if (g === f) return false; const v = ir(g); if (Math.abs(u[0] * v[1] - u[1] * v[0]) > 0.17) return false;
      const dv = Math.abs((P[0] - g.a[0]) * v[1] - (P[1] - g.a[1]) * v[0]); if (dv > 0.15) return false;
      return Math.min(Math.hypot(P[0] - g.a[0], P[1] - g.a[1]), Math.hypot(P[0] - g.b[0], P[1] - g.b[1])) <= Math.max(0.5, f.vastag); }); };
    for (let i = 0; i < ff.length; i++) for (let j = i + 1; j < ff.length; j++) {
      const f1 = ff[i]!, f2 = ff[j]!, u1 = ir(f1), u2 = ir(f2);
      const cos = Math.abs(u1[0] * u2[0] + u1[1] * u2[1]); if (cos > Math.cos((75 * Math.PI) / 180)) continue;
      const det = u1[0] * u2[1] - u1[1] * u2[0]; if (Math.abs(det) < 1e-9) continue;
      const t = ((f2.a[0] - f1.a[0]) * u2[1] - (f2.a[1] - f1.a[1]) * u2[0]) / det;
      const X: P2 = [f1.a[0] + u1[0] * t, f1.a[1] + u1[1] * t];
      for (const e1 of ['a', 'b'] as const) for (const e2 of ['a', 'b'] as const) {
        const P = f1[e1], Q = f2[e2];
        if (folytatodik(f1, P) || folytatodik(f2, Q)) continue;
        const d1 = Math.hypot(P[0] - X[0], P[1] - X[1]), d2 = Math.hypot(Q[0] - X[0], Q[1] - X[1]);
        if (d1 > Math.max(0.8, f2.vastag) || d2 > Math.max(0.8, f1.vastag)) continue;
        // (a metszéspont a fal végénél van, nem a közepén – a másik vége messzebb)
        const O1 = f1[e1 === 'a' ? 'b' : 'a'], O2 = f2[e2 === 'a' ? 'b' : 'a'];
        if (Math.hypot(O1[0] - X[0], O1[1] - X[1]) < d1 || Math.hypot(O2[0] - X[0], O2[1] - X[1]) < d2) continue;
        jel.push({ v1: { f: f1, veg: e1 }, v2: { f: f2, veg: e2 }, X, d: d1 + d2 });
      }
    }
    // végpontonként a legközelebbi pár
    jel.sort((p, q) => p.d - q.d);
    const foglalt = new Set<string>();
    for (const { v1, v2, X } of jel) {
      const k1 = `${v1.f.id}${v1.veg}`, k2 = `${v2.f.id}${v2.veg}`; if (foglalt.has(k1) || foglalt.has(k2)) continue;
      foglalt.add(k1); foglalt.add(k2);
      for (const [v, masik] of [[v1, v2.f], [v2, v1.f]] as const) {
        const O = v.f[v.veg === 'a' ? 'b' : 'a'], L = Math.hypot(X[0] - O[0], X[1] - O[1]); if (L < 1e-6) continue;
        const u: P2 = [(X[0] - O[0]) / L, (X[1] - O[1]) / L];
        falVegAllit(v.f, v.veg, [X[0] + u[0] * (masik.vastag / 2), X[1] + u[1] * (masik.vastag / 2)], nyilasok);
      }
    }
  }
}

/**
 * Féltető (egy síkú tető) háromszögei: a derékszögű alaprajz a csúcsai x / y koordinátáinak rácsán soronként összevont
 * téglalapokra bontva; a sík az alsó élén (a lejtés irányában a legszélső koordináta) az eresz magasságában.
 */
function feltetoHaromszogek(p: P2[], hajlas: number, lejt: number, zE: number): [number, number, number][][] {
  const xs = [...new Set(p.map((q) => q[0]))].sort((a, b) => a - b), ys = [...new Set(p.map((q) => q[1]))].sort((a, b) => a - b);
  const tg = Math.tan((hajlas * Math.PI) / 180), x0 = xs[0]!, x1 = xs[xs.length - 1]!, y0 = ys[0]!, y1 = ys[ys.length - 1]!;
  const z = (x: number, y: number) => zE + tg * (lejt === 180 ? y1 - y : lejt === 0 ? y - y0 : lejt === 90 ? x1 - x : x - x0);
  const ki: [number, number, number][][] = [];
  for (let j = 0; j + 1 < ys.length; j++) {
    let i = 0;
    while (i + 1 < xs.length) {
      if (!pontBenne(p, (xs[i]! + xs[i + 1]!) / 2, (ys[j]! + ys[j + 1]!) / 2)) { i++; continue; }
      let k = i; while (k + 2 < xs.length && pontBenne(p, (xs[k + 1]! + xs[k + 2]!) / 2, (ys[j]! + ys[j + 1]!) / 2)) k++;
      const a: [number, number, number] = [xs[i]!, ys[j]!, z(xs[i]!, ys[j]!)], b: [number, number, number] = [xs[k + 1]!, ys[j]!, z(xs[k + 1]!, ys[j]!)];
      const c: [number, number, number] = [xs[k + 1]!, ys[j + 1]!, z(xs[k + 1]!, ys[j + 1]!)], d: [number, number, number] = [xs[i]!, ys[j + 1]!, z(xs[i]!, ys[j + 1]!)];
      ki.push([a, b, c], [a, c, d]);
      i = k + 1;
    }
  }
  return ki;
}

/**
 * Fedett terasz a tető alatt: a körvonal egy élén kívül, vele párhuzamos sorban (± 30 cm) álló legalább két szabad pillér,
 * 0,3–4,5 m-re, az él hosszának legalább 40 %-án – a tető az él és a pillérsor külső síkja közti sávot is fedi. A sáv
 * végei a körvonal ± 0,5 m-en belüli koordinátáira illesztve. Élenként a legtávolabbi ilyen sor.
 */
function fedettTerasz(pol: P2[], szabad: Piller[]): { pol: P2[]; fedett: P2[][] } {
  if (szabad.length < 2) return { pol, fedett: [] };
  const n = pol.length, A = pol.reduce((s, [x, y], i) => { const [x2, y2] = pol[(i + 1) % n]!; return s + x * y2 - x2 * y; }, 0), el = Math.sign(A) || 1;
  const ki: P2[] = [], fedett: P2[][] = [];
  for (let i = 0; i < n; i++) {
    const a = pol[i]!, b = pol[(i + 1) % n]!, L = Math.hypot(b[0] - a[0], b[1] - a[1]); ki.push(a); if (L < 1) continue;
    const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L, nx = el * uy, ny = -el * ux; // kifelé mutató normális
    const jel = szabad.map((p) => ({ p, d: (p.kozep[0] - a[0]) * nx + (p.kozep[1] - a[1]) * ny, t: (p.kozep[0] - a[0]) * ux + (p.kozep[1] - a[1]) * uy, f: Math.max(p.a, p.b) / 2 }))
      .filter((q) => q.d > 0.3 && q.d <= 4.5 && q.t >= -0.5 && q.t <= L + 0.5 && !pontBenne(pol, q.p.kozep[0], q.p.kozep[1]));
    let leg: { D: number; t1: number; t2: number } | null = null;
    for (const q of jel) {
      const sor = jel.filter((r) => Math.abs(r.d - q.d) <= 0.3); if (sor.length < 2) continue;
      const t1 = Math.max(0, Math.min(...sor.map((r) => r.t - r.f))), t2 = Math.min(L, Math.max(...sor.map((r) => r.t + r.f)));
      if (t2 - t1 < 0.4 * L) continue;
      const D = Math.max(...sor.map((r) => r.d + r.f));
      if (!leg || D > leg.D) leg = { D, t1, t2 };
    }
    if (!leg) continue;
    // a sáv végei a körvonal közeli koordinátáira (a terasz jellemzően egy szárny / a fő tömb szélességéig tart)
    const vetuletek = pol.map(([x, y]) => (x - a[0]) * ux + (y - a[1]) * uy).filter((t) => t >= -0.01 && t <= L + 0.01);
    const illeszt = (t: number) => vetuletek.reduce((best, v) => (Math.abs(v - t) < Math.abs(best - t) && Math.abs(v - t) <= 0.5 ? v : best), t);
    const t1 = illeszt(leg.t1), t2 = illeszt(leg.t2);
    const P = (t: number, d: number): P2 => [a[0] + ux * t + nx * d, a[1] + uy * t + ny * d];
    const sav = [P(t1, 0), P(t1, leg.D), P(t2, leg.D), P(t2, 0)];
    if (t1 > 0.01) ki.push(sav[0]!); ki.push(sav[1]!, sav[2]!); if (t2 < L - 0.01) ki.push(sav[3]!);
    fedett.push(sav.map(([x, y]) => [sz(x), sz(y)] as P2));
  }
  return { pol: fedett.length ? ki : pol, fedett };
}

/**
 * Alapozás a metszetből (Balázs szabálya: a 20 cm-es vagy vastagabb – teherhordó – fal alatt, a belsők alatt is, mindig
 * van sávalap, kivéve a lemezalapozású házat; lemezalapnál a széleken lehet fagyhatár-gerenda / sávalap; a lemezalap
 * legalább 18 cm vastag):
 * - lemezalap: a ±0,00 alatti (legfeljebb 1,5 m), legalább 18 cm vastag, ≥ 3 m széles, vasbeton / lemez rétegű sáv
 *   (az aljzatbeton, zúzottkő nem); ekkor a sávalap csak a külső falak alatt (perem);
 * - sávalap: alapozás- / sávalap-rétegű, 30–150 cm széles és magas elem (a leggyakoribb keresztmetszet), a teherhordó
 *   falak alatt; lábazati fal a sávalapra (± 5 cm) ülő, 15–45 cm széles, zsalukő / lábazat / alapozás-rétegű elem.
 */
function alapozasKeres(szintek: Szint[], falak: Fal[], elemek: MetszetElem[], pillerek: Piller[] = [], savok: FodemSav[] = [], fodemek: Fodem[] = []): Alapozas[] {
  const also = szintek[0]; if (!also) return [];
  const ki0: Alapozas[] = [];
  const lemez = savok.filter((q) => q.zFelso <= 0.05 && q.zFelso >= -1.5 && q.vastag >= 0.18 && q.szel >= 3
    && (/lemez/i.test(q.reteg) || (/vasbeton|\bvb\b|monolit/i.test(q.reteg) && !/aljzat|z[úu]zott|kavics|homok/i.test(q.reteg)))).sort((p, q) => q.szel - p.szel)[0];
  if (lemez) {
    const fd = fodemek.find((f) => f.folott === also.id && !f.alatt);
    const A = fd ? fd.poligonok.reduce((t, pl) => t + Math.abs(pl.reduce((s0, [x, y], i) => { const [x2, y2] = pl[(i + 1) % pl.length]!; return s0 + x * y2 - x2 * y; }, 0)) / 2, 0) : 0;
    ki0.push({ id: 'LA1', fajta: 'lemezalap', szel: lemez.szel, magas: lemez.vastag, zFelso: lemez.zFelso, reteg: lemez.reteg.trim(), falak: [], hossz: 0, terulet: sz(A, 2) });
  }
  const tf = falak.filter((f) => f.szint === also.id && f.szerkezet === 'teherhordo' && (!lemez || f.kulso)); if (!tf.length) return ki0;
  const ALAP = /alapoz|s[áa]valap|\.FUN\b|fundament/i, NEM = /h[őo]szig|v[íi]zszig|xps|eps|vakolat|szigetel/i;
  const kulcs = (e: MetszetElem) => `${e.szel}|${e.magas}`;
  const sav = elemek.filter((e) => ALAP.test(e.reteg) && !NEM.test(e.reteg) && e.szel >= 0.3 && e.szel <= 1.5 && e.magas >= 0.3 && e.magas <= 1.5 && e.zFelso < -0.1);
  if (!sav.length) return ki0;
  const db = (e: MetszetElem, l: MetszetElem[]) => l.filter((q) => kulcs(q) === kulcs(e)).length;
  const s0 = [...sav].sort((p, q) => db(q, sav) - db(p, sav) || q.szel - p.szel)[0]!;
  const falIdk = tf.map((f) => f.id), hossz = sz(tf.reduce((t, f) => t + f.hossz, 0), 2);
  const ki: Alapozas[] = [...ki0, { id: 'S1', fajta: 'savalap', szel: s0.szel, magas: s0.magas, zFelso: s0.zFelso, reteg: s0.reteg.trim(), falak: falIdk, hossz }];
  const lab = elemek.filter((e) => (/zsalu|l[áa]bazat/i.test(e.reteg) || ALAP.test(e.reteg)) && !NEM.test(e.reteg) && e.szel >= 0.15 && e.szel <= 0.45 && e.magas >= 0.15 && e.zFelso <= 0.05 && Math.abs(e.zAlso - s0.zFelso) <= 0.05);
  if (lab.length) { const l0 = [...lab].sort((p, q) => db(q, lab) - db(p, lab) || q.szel - p.szel)[0]!;
    ki.push({ id: 'L1', fajta: 'labazat', szel: l0.szel, magas: l0.magas, zFelso: l0.zFelso, reteg: l0.reteg.trim(), falak: falIdk, hossz }); }
  // pontalap a szabadon álló pillér alatt: a metszeten nem látszik – becsült méret: a sávalap magassága, szélessége a
  // pillér + 2 × 20 cm (legalább a sávalapé), 5 cm-re felfelé kerekítve
  for (const p of pillerek) {
    if (p.hely !== 'szabad' || p.szint !== also.id) continue;
    const a = Math.max(s0.szel, Math.ceil((Math.max(p.a, p.b) + 0.4) * 20 - 1e-6) / 20);
    ki.push({ id: `PA${p.id}`, fajta: 'pontalap', szel: a, magas: s0.magas, zFelso: s0.zFelso, reteg: s0.reteg.trim(), falak: [], hossz: a, piller: p.id, becsult: true });
  }
  return ki;
}

/**
 * Gerendák a teljes modellben: a „ger. as: +2,60” (gerenda alsó síkja) felirathoz legközelebbi (≤ 1,5 m), falanyag
 * nélküli helyiséghatár (szerkezet 'hatar') a gerenda tengelye; az alsó sík a felirat (±0,00-hoz), a felső síkja a szint fölötti födém alsó síkja, a
 * szélessége a szint koszorújáé (ennek híján 25 cm).
 */
function gerendaKeres(lapok: LapBemenet[], falak: Fal[], fodemek: Fodem[], koszoruk: Koszoru[]): Gerenda[] {
  const ki: Gerenda[] = [];
  for (const L of lapok) {
    if (!L.rajz || !L.kizart) continue;
    for (const t of L.rajz.szovegek) {
      const m = /ger(?:enda)?\.?\s*a\.?\s*s\.?[^\d+\-−]*([+\-−]?\d+[,.]\d+)/i.exec(t.s); if (!m) continue;
      const also = Number(m[1]!.replace(',', '.').replace('−', '-'));
      const [px, py] = L.m(t.x, t.y);
      for (const sz0 of L.szintek) {
        let leg: Fal | null = null, d0 = 1.5;
        for (const f of falak) {
          if (f.szint !== sz0.id || f.szerkezet !== 'hatar' || ki.some((g) => g.falId === f.id)) continue;
          const dx = f.b[0] - f.a[0], dy = f.b[1] - f.a[1], l2 = dx * dx + dy * dy; if (l2 < 0.25) continue;
          const u = Math.max(0, Math.min(1, ((px - f.a[0]) * dx + (py - f.a[1]) * dy) / l2));
          const d = Math.hypot(px - f.a[0] - u * dx, py - f.a[1] - u * dy); if (d < d0) { d0 = d; leg = f; }
        }
        if (!leg) continue;
        const fd = fodemek.find((f) => f.alatt === sz0.id), felso = fd ? fd.z - fd.vastag : sz0.z0 + sz0.h - 0.3;
        const alsoAbs = also; // (a szintjel ±0,00-hoz mért) if (felso - alsoAbs < 0.1 || felso - alsoAbs > 1.2) continue;
        const szel = koszoruk.find((k) => k.szint === sz0.id)?.szel ?? 0.25;
        ki.push({ id: `G${ki.length + 1}`, szint: sz0.id, a: leg.a, b: leg.b, szel, alsoSik: sz(alsoAbs, 2), felsoSik: sz(felso, 2), magas: sz(felso - alsoAbs, 2), falId: leg.id });
      }
    }
  }
  return ki;
}

/**
 * Koszorú szintenként a metszet kis keresztmetszetű elemeiből: szerkezeti (nem hőszigetelés, padló, tető, zsalukő,
 * alapozás) rétegen álló, 20–50 cm széles, 15–80 cm magas elem, amelynek felső síkja a szint fölötti födém alsó síkjához
 * (± 30 cm) esik, és a szint padlója fölött legalább 1,5 m-rel kezdődik; több jelölt közül a födém alsó síkjához
 * legközelebbi, azonos távolságnál a gyakoribb keresztmetszet. A koszorú a szint teherhordó falain fut.
 */
function koszoruKeres(szintek: Szint[], falak: Fal[], fodemek: Fodem[], elemek: MetszetElem[]): Koszoru[] {
  // (a falazóelem rétege – „POROTHERM FAL 30”, tégla, pórusbeton – a fal metszete, nem koszorú)
  const NEM = /h[őo]szig|padl[óo]|tet[őo]|zsalu|alapoz|s[áa]valap|metszet kit|kieg[ée]sz|pill[ée]r|burkolat|f[öo]d[ée]m|porotherm|t[ée]gla|ker[áa]mia|falaz|ytong|p[óo]rusbeton|g[áa]zbeton/i;
  const ki: Koszoru[] = [];
  for (const sz0 of szintek) {
    const fd = fodemek.find((f) => f.alatt === sz0.id);
    const alja = fd ? fd.z - fd.vastag : sz0.z0 + sz0.h - 0.3;
    const jel = elemek.filter((e) => !NEM.test(e.reteg) && e.szel >= 0.2 && e.szel <= 0.5 && e.magas >= 0.15 && e.magas <= 0.8
      && Math.abs(e.zFelso - alja) <= 0.3 && e.zAlso >= sz0.z0 + 1.5);
    if (!jel.length) continue;
    const kulcs = (e: MetszetElem) => `${e.szel}|${e.magas}`;
    const db = (e: MetszetElem) => jel.filter((q) => kulcs(q) === kulcs(e)).length;
    const leg = jel.sort((p, q) => Math.abs(p.zFelso - alja) - Math.abs(q.zFelso - alja) || db(q) - db(p))[0]!;
    const tf = falak.filter((f) => f.szint === sz0.id && f.szerkezet === 'teherhordo');
    if (!tf.length) continue;
    ki.push({ id: `K${sz0.id}`, szint: sz0.id, szel: leg.szel, magas: leg.magas, zFelso: leg.zFelso, reteg: leg.reteg.trim(), falak: tf.map((f) => f.id), hossz: sz(tf.reduce((t, f) => t + f.hossz, 0), 2), fajta: 'koszoru' });
    // attika: a koszorúra (± 5 cm) ülő, 30–100 cm magas, vasbeton / beton elem; a fölötte lévő szint körvonalán kívüli
    // (lapostetős) teherhordó falakon
    const att = elemek.filter((e) => /beton|\bvb\b/i.test(e.reteg) && !NEM.test(e.reteg) && e.szel >= 0.2 && e.szel <= 0.5 && e.magas >= 0.3 && e.magas <= 1 && Math.abs(e.zAlso - leg.zFelso) <= 0.05)
      .sort((p, q) => db(q) - db(p))[0];
    const felso = szintek.find((q) => q.z0 > sz0.z0 + 1);
    const felsoPol = felso ? fodemek.find((f) => f.folott === felso.id)?.poligonok ?? [] : [];
    if (att && felsoPol.length) {
      const kint = tf.filter((f) => { const mx = (f.a[0] + f.b[0]) / 2, my = (f.a[1] + f.b[1]) / 2; return !felsoPol.some((pl) => pontBenne(pl, mx, my, 0.3)); });
      if (kint.length) ki.push({ id: `A${sz0.id}`, szint: sz0.id, szel: att.szel, magas: att.magas, zFelso: att.zFelso, reteg: att.reteg.trim(), falak: kint.map((f) => f.id), hossz: sz(kint.reduce((t, f) => t + f.hossz, 0), 2), fajta: 'attika' });
    }
  }
  return ki;
}

/**
 * A pillér helye a falakhoz képest – az ELBA `pillerFalhoz` szabálya: a pillérhez érő falak (a fal tengelye legfeljebb
 * fél falvastagság + fél pillérméret + 15 cm-re, a fal hosszán belül) iránya dönt: nincs fal → szabad; egy irány, a fal
 * mindkét oldalon tovább fut → fal; egy irány, csak egyik oldalon → vég; két irány, egyikben átmenő fal (T) → fal;
 * két irány, egyikben sem → sarok. A befogadó fal a tengelyével legközelebbi.
 */
function pillerFalhoz(pillerek: Piller[], falak: Fal[]) {
  for (const p of pillerek) {
    const meret = Math.max(p.a, p.b); let jo: Fal | null = null, leg = Infinity;
    const ero: { f: Fal; ux: number; uy: number; elotte: boolean; utana: boolean }[] = [];
    for (const f of falak) {
      if (f.szint !== p.szint || f.szerkezet === 'hatar') continue;
      const dx = f.b[0] - f.a[0], dy = f.b[1] - f.a[1], L = Math.hypot(dx, dy); if (L < 0.2) continue;
      const ux = dx / L, uy = dy / L, t0 = (p.kozep[0] - f.a[0]) * ux + (p.kozep[1] - f.a[1]) * uy, t = Math.max(0, Math.min(L, t0));
      const d = Math.hypot(p.kozep[0] - (f.a[0] + ux * t), p.kozep[1] - (f.a[1] + uy * t));
      if (d > f.vastag / 2 + meret / 2 + 0.15) continue;
      ero.push({ f, ux, uy, elotte: t0 > meret / 2 + 0.05, utana: t0 < L - meret / 2 - 0.05 });
      if (d < leg) { leg = d; jo = f; }
    }
    const iranyok: { a: number; ket: boolean; egy: boolean; falak: Fal[] }[] = [];
    for (const x of ero) {
      const a = ((Math.atan2(x.uy, x.ux) * 180) / Math.PI + 180) % 180;
      let ir = iranyok.find((i) => Math.min(Math.abs(i.a - a), 180 - Math.abs(i.a - a)) < 20);
      if (!ir) { ir = { a, ket: false, egy: false, falak: [] }; iranyok.push(ir); }
      ir.falak.push(x.f);
      if (x.elotte && x.utana) ir.ket = true; else ir.egy = true;
      if (ir.egy && ir.falak.length >= 2) ir.ket = true;
    }
    let hely: NonNullable<Piller['hely']> = 'szabad', fo: (typeof iranyok)[number] | undefined;
    if (iranyok.length >= 2) { fo = iranyok.find((i) => i.ket); hely = fo ? 'fal' : 'sarok'; }
    else if (iranyok.length === 1) { fo = iranyok[0]!; hely = fo.ket ? 'fal' : 'veg'; }
    p.hely = hely;
    if (jo) p.falId = jo.id;
    p.falak = (hely === 'fal' && fo ? fo.falak : ero.map((x) => x.f)).map((f) => f.id);
  }
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
    const cel = !fd.folott ? sz0.z0 + sz0.h : sz0.z0, tol = !fd.folott ? 0.4 : 0.35;
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
    // (lapostető: nem padlóval kezdődő, tető- / hőszigetelő réteget tartalmazó lánc – a felső szint padlója nem az)
    const lapLanc = fd.lapos ? lancok.filter((l) => !/padl[óo]|burkolat|aljzat|esztrich/i.test(l[0]!.reteg) && l.some((q) => /tet[őo]|h[őo]\s*szig|v[íi]zszig|lejt/i.test(q.reteg))) : [];
    if (fd.lapos && !lapLanc.length) continue;
    const lanc = (fd.lapos ? lapLanc : padloLanc.length ? padloLanc : lancok)[0]; if (!lanc) continue; const elso = lanc[0]!;
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

/** Rétegzett lapon a fal tengelyével párhuzamos (± 30 cm-en belüli) fal-fólia vonalpár, amely a hossz legalább felén fut
 *  és távolsága falazóelem-vastagság (5–32 cm, ± 2 cm): a tengely eltolása a normális irányában és a vastagság. */
function falVonalPar(L: LapBemenet, f: FalNyers): { d: number; v: number } | null {
  const r = L.a.r; if (!r?.falVonal) return null;
  const dx = f.b[0] - f.a[0], dy = f.b[1] - f.a[1], l = Math.hypot(dx, dy); if (l < 0.5) return null;
  const nx = -dy / l, ny = dx / l, lep = r.px / 2;
  const fed: { d: number; f: number }[] = [];
  for (let d = -0.3; d <= 0.3 + 1e-9; d += lep) { let van = 0, n = 0;
    for (let t = 0.1; t < 0.91; t += 0.05) { n++; const [x, y] = modellbolPt(L, [f.a[0] + dx * t + nx * d, f.a[1] + dy * t + ny * d]);
      const gx = Math.floor(((x - r.x0) * r.mPerPt) / r.px), gy = Math.floor(((y - r.y0) * r.mPerPt) / r.px);
      if (gx >= 0 && gy >= 0 && gx < r.w && gy < r.h && r.falVonal[gy * r.w + gx]) van++; }
    fed.push({ d, f: van / n }); }
  // csúcsok: helyi maximumok ≥ 50 % fedéssel (szomszédos azonos értékek közül az első)
  const csucs = fed.filter((q, i) => q.f >= 0.5 && q.f >= (fed[i - 1]?.f ?? 0) && q.f > (fed[i + 1]?.f ?? 0)).map((q) => q.d);
  let leg: { d: number; v: number; e: number } | null = null;
  for (let i = 0; i < csucs.length; i++) for (let j = i + 1; j < csucs.length; j++) {
    const v = csucs[j]! - csucs[i]!; if (v < 0.04 || v > 0.34) continue;
    const s = [...FAL_SZABVANY, 0.32].reduce((p, q) => (Math.abs(q - v) < Math.abs(p - v) ? q : p)); if (Math.abs(s - v) > 0.02 + r.px / 2) continue;
    const kozep = (csucs[i]! + csucs[j]!) / 2, e = Math.abs(kozep) + Math.abs(s - v);
    if (!leg || e < leg.e) leg = { d: kozep, v: s, e };
  }
  return leg && { d: leg.d, v: leg.v };
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
/** Falazóelem-vastagságok (m): a mért mag (a rajzon a vakolat is benne lehet – a 33 cm-es fal 30 cm-es falazat) ezekre
 * igazodik; a 32 cm ritka, csak méretszám szerint. */
const FAL_SZABVANY = [0.06, 0.075, 0.1, 0.12, 0.15, 0.2, 0.25, 0.3, 0.38, 0.44, 0.5];

/**
 * A falmag pontosítása (Balázs: a fal vastagságát a méretszámok és a feliratok – rétegrend – alapján ellenőrizni kell):
 * 1. méretszám: a fal mentén (a tengelyre vetítve a hosszán belül, tőle legfeljebb 1,2 m-re) álló egész cm-szám
 *    (5–60), amely a mért maghoz ± 3,5 cm-en belül van – a rajz szerinti vastagság;
 * 2. ennek híján a legközelebbi falazóelem-vastagság (± 3,5 cm);
 * 3. faltípus: a külső fal, amelynek magja a lap uralkodó külső falmagjától eltér, de a teljes vastagsága a
 *    uralkodó külső fal teljes vastagságával (± 6 cm) egyezik, ugyanaz a faltípus (a rétegek szétválasztása hibázott).
 */
function falMagPontosit(falak: Fal[], L: LapBemenet) {
  // (méretszám: a lap egész számos feliratainak leggyakoribb betűméretével írt, vezető nulla nélküli szám – a
  // helyiségszám, „09”, nagyobb betűs vagy nullával kezdődik –, értéke falazóelem-vastagság vagy 32 cm)
  const szamok: { v: number; p: P2 }[] = [];
  if (L.rajz) {
    const egesz = L.rajz.szovegek.filter((t) => /^\s*[1-9]\d?\s*$/.test(t.s));
    const mdb = new Map<number, number>(); for (const t of egesz) { const k = Math.round(t.meret * 2) / 2; mdb.set(k, (mdb.get(k) ?? 0) + 1); }
    const fo = [...mdb].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
    for (const t of egesz) { const v = Number(t.s.trim()) / 100; if (Math.abs(t.meret - fo) > 0.2 * fo) continue;
      if (!FAL_SZABVANY.some((q) => Math.abs(q - v) < 0.001) && Math.abs(v - 0.32) > 0.001) continue; szamok.push({ v, p: L.m(t.x, t.y) }); }
  }
  for (const f of falak) {
    if (f.szerkezet === 'hatar') continue;
    const mert = f.mag ?? f.vastag;
    const dx = f.b[0] - f.a[0], dy = f.b[1] - f.a[1], l = Math.hypot(dx, dy); if (l < 0.2) continue;
    const ux = dx / l, uy = dy / l;
    const jel = szamok.filter(({ v, p }) => { const t = (p[0] - f.a[0]) * ux + (p[1] - f.a[1]) * uy, d = Math.abs(-(p[0] - f.a[0]) * uy + (p[1] - f.a[1]) * ux);
      return t >= -0.3 && t <= l + 0.3 && d <= 1.2 && Math.abs(v - mert) <= 0.035; }).map((q) => q.v);
    if (jel.length) { const db = new Map<number, number>(); for (const v of jel) db.set(v, (db.get(v) ?? 0) + 1); f.mag = [...db].sort((a, b) => b[1] - a[1] || Math.abs(a[0] - mert) - Math.abs(b[0] - mert))[0]![0]; continue; }
    const sz0 = FAL_SZABVANY.reduce((p, q) => (Math.abs(q - mert) < Math.abs(p - mert) ? q : p));
    if (Math.abs(sz0 - mert) <= 0.035) f.mag = sz0;
  }
  // faltípus a külső falakon
  const kulso = falak.filter((f) => f.kulso && f.szerkezet !== 'hatar' && f.mag !== undefined);
  const hossz = new Map<string, { L: number; mag: number; v: number }>();
  for (const f of kulso) if ((f.retegek?.length ?? 0) >= 2) { const k = `${f.mag}`; const e = hossz.get(k) ?? { L: 0, mag: f.mag!, v: 0 }; e.v = (e.v * e.L + f.vastag * f.hossz) / (e.L + f.hossz); e.L += f.hossz; hossz.set(k, e); }
  const ur = [...hossz.values()].sort((a, b) => b.L - a.L)[0];
  if (ur) for (const f of kulso) if (Math.abs(f.mag! - ur.mag) > 0.04 && Math.abs(f.vastag - ur.v) <= 0.06) f.mag = ur.mag;
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
