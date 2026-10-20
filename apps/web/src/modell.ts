/**
 * A felület projektmodellje és átalakítása a számítómag bemenetére.
 * A felhasználó helyiségeket, rétegrendeket, nyílászáró-típusokat és határoló felületeket visz fel;
 * ebből áll elő a zóna (AN, V) és a határoló elemek listája.
 */
import {
  retegrendU, talajonFekvoPadlo, osztottAblak, kapcsoltLegretegR, kethejuNyilaszaroU, nyilaszaroU, nyilaszaroArnyekoloval, nyilaszaroSablon,
  epuletfizika, kovetelmeny, klima, hoszukseglet, GEPESZETI_SZETTEK, FUTES_SZETTEK, HMV_SZETTEK, SZELLOZES_SZETTEK, HUTES_SZETTEK, szabalyozasiTenyezo, pvgis,
  type EpuletBemenet, type HataroloElem, type Reteg, type Hatar, type FutesiHotermelo, type HmvHotermelo,
  type FutesSablon, type HmvSablon, type HutesSablon, type SzellozesRendszer,
} from '@mag/index';
import type { BTenyezoKod, HoaramIrany, Legzaras, NyilasElhelyezes } from '@mag/tablak/epuletfizika';
import type { Tajolas, Hajlasszog } from '@mag/tablak/klima';
import { anyag, beepitett, type Anyag } from './katalogus';
import type { FelujitasBeallitas } from './felujitas';
import type { AlternativBeallitas } from './alternativ';

export type HelyisegKategoria = 'kondicionalt' | 'erosen_kapcsolt' | 'gyengen_kapcsolt';
export interface Helyiseg { id: string; nev: string; kategoria: HelyisegKategoria; A: number; h: number; hsz?: HelyisegHsz; }

/** Helyiségenkénti hőszükséglet adatai (MSZ EN 12831); üres mező = alapérték. */
export interface HelyisegHsz {
  theta?: number;
  nmin?: number;
  nyilasok?: hoszukseglet.NyilasSzam;
  kulsoFalak: { id: string; retegrendId: string; hossz: number }[];
  padlas: boolean;
  padlo: boolean;
  szomszedok: { id: string; helyisegId: string; A: number; U: number }[];
}
export interface HoszuksegletBeallitas {
  thetaE: number; n50: number; vedettseg: hoszukseglet.Vedettseg; Gw: number;
  /** Felfűtési többlet: 'nincs' (folyamatos fűtés), 'fajlagos' (fRH W/m²), 'arany' (ΦT+ΦV %-ában). */
  rhMod?: 'nincs' | 'fajlagos' | 'arany';
  fRH: number; rhArany?: number;
}
export const HSZ_ALAP: HoszuksegletBeallitas = { thetaE: -15, n50: 3, vedettseg: 'mersekelt', Gw: 1, fRH: 0 };

export type Szerep = 'fal' | 'padlas' | 'teto' | 'pincefodem' | 'padlo' | 'belso';
export interface RetegUI { id: string; anyagId?: string; nev?: string; dCm: number; lambda?: number; R?: number; legreteg?: 'zart' | 'intenziv'; /** Páradiffúziós ellenállási szám kézi értéke (üres: katalógus / jellemző érték). */ mu?: number; }
export interface Retegrend {
  id: string; nev: string; szerep: Szerep; kovetelmenyKod: string;
  hoaramIrany: HoaramIrany; kulsoOldal: 'kulso' | 'futetlen' | 'belso';
  retegek: RetegUI[];
  kezidU?: number; rseFelulbiralas?: number;
  /** A nevet a felhasználó írta: a program nem nevezi át a rétegek alapján. */
  nevKezi?: boolean;
}

export interface NyilaszaroTipus {
  id: string; nev: string; kovetelmenyKod: 'ablak_fa_pvc' | 'ablak_fem' | 'tetosik_ablak' | 'ajto' | 'kapu';
  szelesseg: number; magassag: number;
  /** Komponensekből (4.16; kapcsolt szárnyaknál 4.17) vagy kézi Uw. */
  komponens?: NyilaszaroKomponens;
  /** A kiinduló kortipikus sablon kódja (tájékoztató). */
  sablonKod?: string;
  uwKezi?: number;
  gn: number;
  keretarany?: number;
  /** Társított árnyékoló (fűtési U-hoz ΔR, hűtéshez gárny). */
  arnyekolo?: { kod: string; dR: number; garnyH: number };
}

export interface NyilaszaroKomponens {
  keretMm: number; Ug: number; Uk: number; psi: number;
  /** A 4.1./4.2. táblázat sorai (ha onnan választott). */
  uvegKod?: string; keretKod?: string;
  tavtarto?: 'fem' | 'fejlett' | 'nincs';
  /** Ψ kézzel megadva (különben a 4.3. táblázatból a keret, az üveg és a távtartó szerint). */
  psiKezi?: boolean;
  /** Tokosztó / szárnytalálkozás szélessége [mm]; osztás oszlop × sor üvegmezőre. */
  osztoMm?: number; oszlop?: number; sor?: number;
  /** Üvegosztó léc mezőnként (4.4. táblázat). */
  lec?: { fuggoleges: number; vizszintes: number; psi: number };
  /** Kapcsolt szárnyú (kéthéjú) ablak: légrés [mm] (4.17). */
  kapcsoltResMm?: number;
}

export type HatarKod = 'kulso' | BTenyezoKod;
export interface Felulet {
  id: string; nev: string; helyisegId?: string;
  fajta: 'opak' | 'nyilaszaro' | 'padlo';
  retegrendId?: string; nyilaszaroId?: string;
  hatar: HatarKod;
  /** Opak: felület (nettó, ha nincs szülőhöz kötött nyílászáró) · padló: alapterület. */
  A?: number;
  darab?: number;
  tajolas?: Tajolas | null;
  hajlasszog?: 0 | Hajlasszog;
  /** Opak felület méretből: határoló hossz × magasság (a bruttó felület A ebből adódik). */
  meret?: { hossz: number; magassag: number };
  /** A nyílászáró ebből a falból vonódik le. */
  szuloId?: string;
  /** Nyílászáró: fűtési idényre vonatkozó árnyékolási tényező (környező beépítés, erkély, előtető, növényzet; 1 = nincs árnyékolás). */
  arnyekolas?: number;
  chi?: number;
  /** A CHI_VALASZTEK sorindexe (az azonos χ értékű sorok megkülönböztetésére). */
  chiKod?: number;
  padlo?: {
    P: number; dfCm: number; z: number;
    /** Ha megadott: a kerület ezeknek a (földszinti) külső falfelületeknek a hosszából adódik. */
    falIds?: string[];
    perem?: { irany: 'vizszintes' | 'fuggoleges'; D: number; dCm: number; R: number };
    psiPF: number;
  };
}

// ---------------------------------------------------------------------------------------------
// Gépészet: a szett csak kiindulópont, minden elem külön szerkeszthető.

/** Fűtési alrendszer; bivalens rendszernél több is lehet, a lefedések összege 1. */
export interface FutesAlrendszerUI extends FutesSablon {
  id: string; nev: string; szettKod?: string;
  /** Kiszolgált alapterület [m²]: ha megadott, a lefedés = terület / AN, és a táblázatok ezzel a rendszer-alapterülettel számolnak. */
  terulet?: number;
}
export interface HmvUI extends HmvSablon { szettKod?: string; }
export interface SzellozesUI {
  /** Hővisszanyerő hatásfoka (0..1). */
  etaR: number;
  /** Üzemidő-arány (0..1). */
  uzemArany: number;
  ventilator: SzellozesRendszer['ventilator'];
  segedKWh?: number;
  szettKod?: string;
}
export interface NapelemUI {
  id: string; nev: string; kWp: number;
  /** 13.1. táblázat oszlopa (egyszerűsített módszer). */
  tajolas: 'K_Ny' | 'DK_DNy' | 'D'; hajlasszog: number;
  /** 'tabla': 13.2.1 egyszerűsített (≤ 20 kWp); 'pvgis': 13.2.2 részletes, PVGIS lekérdezéssel. */
  modszer?: 'tabla' | 'pvgis';
  /** PVGIS: azimut [°] (0 = dél, −90 = kelet, +90 = nyugat), rendszerveszteség [%], elhelyezés. */
  azimut?: number; veszteseg?: number; elhelyezes?: 'building' | 'free';
  /** A legutóbbi PVGIS lekérdezés teljes, igazolásként tárolt eredménye. */
  pvgis?: pvgis.PvgisEredmeny;
}
export interface HutesUI extends HutesSablon { id: string; nev: string; szettKod?: string }
export interface Gepeszet { futes: FutesAlrendszerUI[]; hmv: HmvUI; szellozes: SzellozesUI | null; napelem: NapelemUI[]; hutes?: HutesUI[] }

export interface Projekt {
  verzio: 2;
  meta: {
    nev: string; megrendelo: string; irsz: string; telepules: string; kozterulet: string; kozteruletJelleg: string; hazszam: string;
    hrsz: string; epitesiEv: number;
    /** A nyílászárók cseréjének éve (a kortipikus ablakajánláshoz); üres: az építés éve. */
    nyilaszaroCsereEv?: number;
    /** Az épület földrajzi helye (PVGIS-hez); forrás: címkereső vagy kézi. */
    koordinata?: { lat: number; lon: number; forras?: string };
    kategoria: 'csaladi_haz' | 'egyeb_lakoepulet';
    kovetelmenySzint: 'kozel_nulla' | 'jelentos_felujitas' | 'meglevo'; epulettipus?: string; szintek: number;
  };
  zona: { legzaras: Legzaras; elhelyezes: NyilasElhelyezes; szelnekKitett: boolean; hotarolo: keyof typeof epuletfizika.HOTAROLO_KEPESSEG; cmEffFajl?: number; futesProgramozhato: boolean };
  helyisegek: Helyiseg[];
  retegrendek: Retegrend[];
  nyilaszarok: NyilaszaroTipus[];
  feluletek: Felulet[];
  gepeszet: Gepeszet;
  tanusito: Tanusito;
  /** Helyiségenkénti hőszükséglet beállításai. */
  hoszukseglet?: HoszuksegletBeallitas;
  /** Csatolt fotók (tömörített JPEG dataURL); az e-tanúsítás XML Photos blokkjába és a jegyzőkönyvbe kerülnek. */
  fotok?: Foto[];
  /** A projektben használt nem beépített (irodai) anyagok pillanatképe: a projekt így önmagában is számolható. */
  anyagok?: Anyag[];
  /** Felújítás-elemző beállításai (árak, intézkedések). */
  felujitas?: FelujitasBeallitas;
  /** Alternatív rendszerek vizsgálata (9/2023 ÉKM 5. §, 4. melléklet). */
  alternativ?: AlternativBeallitas;
  /** Hőhidak: 'chi' egyszerűsített (6.1. táblázat, felületenkénti χ), 'psi' részletes (vonalmenti Ψ · l a hőhíd-számításból). */
  hohidMod?: 'chi' | 'psi';
  hohidak?: HohidUI[];
}

/** Egy kétdimenziós hőhíd-számítás (MSZ EN ISO 10211) a katalógus-csomópontból. */
export interface HohidUI {
  id: string; nev: string; sablon: string;
  param: Record<string, number>;
  thetaI: number; thetaE: number;
  /** A hőhíd hossza a projektben (m) és a használt méretrendszer (a felületek belső vagy külső méretből számítottak). */
  hossz: number; meretrendszer: 'belso' | 'kulso';
  /** Bekerül-e a számításba (részletes módban). */
  szamit: boolean;
  /** A határoló tér (b tényezőhöz). */
  hatar?: HatarKod;
  eredmeny?: { L2D: number; psiE: number; psiI: number; thetaSiMin: number; fRsi: number; karimak: { nev: string; U: number; lKulso: number; lBelso: number }[] };
}

export type FotoKategoria = 'CoverPhoto' | 'Facade' | 'CharacteristicOpeningStructure' | 'HeatGeneratorAndHeatStorageSituation' | 'CharacteristicHeatExchanger';
export const FOTO_KATEGORIAK: { ertek: FotoKategoria; nev: string }[] = [
  { ertek: 'CoverPhoto', nev: 'Címlapfotó (az épület)' },
  { ertek: 'Facade', nev: 'Homlokzat' },
  { ertek: 'CharacteristicOpeningStructure', nev: 'Jellemző nyílászáró' },
  { ertek: 'HeatGeneratorAndHeatStorageSituation', nev: 'Hőtermelő, hőtároló' },
  { ertek: 'CharacteristicHeatExchanger', nev: 'Jellemző hőleadó' },
];
export interface Foto { id: string; kategoria: FotoKategoria; megjegyzes?: string; dataUrl: string; szel: number; mag: number }

/** A tanúsító adatai (XML CertifierDetails) és a névjegyzéki ellenőrzés nyoma. */
export interface Tanusito {
  nev: string;
  /** Névjegyzéki szám a jogosultság kódjával, pl. „TÉ 11-0296”. */
  jogosultsag: string;
  email: string; telefon: string;
  kamara?: 'MEK' | 'MMK';
  cim?: { iranyitoszam: string; telepules: string; kozterulet: string; kozteruletJelleg: string; hazszam: string };
  /** Kézi ellenőrzés a kamarai névjegyzékben: dátum, talált állapot, jogosultság lejárata, forrás. */
  ellenorzes?: { datum: string; aktiv: boolean; lejarat?: string; forras: string };
}

export const ujId = () => Math.random().toString(36).slice(2, 10);

/** A projekt anyag-pillanatképének frissítése: a használt nem beépített anyagok aktuális adata, a nem használtak nélkül. */
export function anyagPillanatkep(p: Projekt) {
  const ids = new Set(p.retegrendek.flatMap((r) => r.retegek.map((x) => x.anyagId)).filter((id): id is string => !!id && !beepitett(id)));
  const uj: Anyag[] = [];
  for (const id of ids) {
    const a = anyag(id) ?? p.anyagok?.find((x) => x.id === id);
    if (a) uj.push({ ...a });
  }
  if (uj.length) p.anyagok = uj; else delete p.anyagok;
}

// ---------------------------------------------------------------------------------------------
// Rétegrend → mag

/** Szerkezet automatikus neve a rétegek anyagából: teherhordó réteg + hőszigetelés, pl. „Homlokzati fal – vázkerámia 38 cm + 15 cm EPS”. */
export function retegrendAutoNev(r: Retegrend): string {
  const sor = r.retegek.map((x) => ({ x, a: anyag(x.anyagId) }));
  const nevOf = (e: (typeof sor)[number]) => (e.a?.nev ?? e.x.nev ?? 'réteg')
    .split(' – ')[0]!.split(',')[0]!.replace(/\s*\(.*?\)\s*/g, ' ')
    .replace(/(^|\s)(falazat|homlokzati|hőszigetelő|hőszigetelés|lemez|lap|tekercs|lépésálló\/terhelhető)(?=\s|$)/gi, ' ')
    .replace(/\s+/g, ' ').trim();
  const szig = sor.filter((e) => e.a?.sraffozas.startsWith('hoszigeteles'));
  const fo = sor.filter((e) => ['falazat', 'beton', 'fa'].includes(e.a?.sraffozas ?? '') || (!e.a && e.x.R === undefined && !e.x.legreteg && e.x.dCm >= 10))
    .sort((a, b) => b.x.dCm - a.x.dCm)[0];
  const reszek: string[] = [];
  if (fo) reszek.push(`${nevOf(fo).replace(/\s*\d+([,.]\d+)?\s*cm/, '')} ${String(Math.round(fo.x.dCm * 10) / 10).replace('.', ',')} cm`);
  if (szig.length) {
    const d = szig.reduce((s, e) => s + e.x.dCm, 0);
    const vastag = [...szig].sort((a, b) => b.x.dCm - a.x.dCm)[0]!;
    reszek.push(`${String(Math.round(d * 10) / 10).replace('.', ',')} cm ${nevOf(vastag)}`);
  }
  return `${SZEREP_NEV[r.szerep]}${reszek.length ? ` – ${reszek.join(' + ')}` : ''}`;
}

export function magRetegek(r: Retegrend): Reteg[] {
  return r.retegek.map((x): Reteg => {
    const a = anyag(x.anyagId);
    const nev = x.nev ?? a?.nev ?? 'réteg';
    const d = x.dCm / 100;
    if (x.legreteg) return { tipus: 'legreteg', nev, d, szellozes: x.legreteg };
    if (x.R !== undefined) return { tipus: 'ellenallas', nev, d, R: x.R };
    if (x.lambda !== undefined) return { tipus: 'homogen', nev, d, lambda: x.lambda };
    if (a?.R && Math.abs(a.R.d - d) < 1e-6) return { tipus: 'ellenallas', nev, d, R: a.R.R };
    if (a?.R) return { tipus: 'homogen', nev, d, lambda: a.R.d / a.R.R };
    if (a?.lambda) return { tipus: 'homogen', nev, d, lambda: a.lambda };
    throw new Error(`Hiányzó hővezetési adat: ${nev}`);
  });
}

export function retegrendSzamitas(r: Retegrend) {
  return retegrendU({
    retegek: magRetegek(r), hoaramIrany: r.hoaramIrany, kulsoOldal: r.kulsoOldal,
    Rse: r.rseFelulbiralas, korrekcio: r.kezidU ? { kezi: r.kezidU } : undefined,
  });
}

/** Állandósult hőmérséklet-lefutás a rétegeken át (ábrához). */
export function homersekletLefutas(r: Retegrend, thetaI: number, thetaE: number) {
  const e = retegrendSzamitas(r);
  const q = (thetaI - thetaE) / e.Rtot;
  const pontok: { x: number; theta: number }[] = [];
  let x = 0;
  let theta = thetaI - q * e.Rsi;
  pontok.push({ x, theta });
  e.retegR.forEach((R, i) => {
    x += r.retegek[i]!.dCm;
    theta -= q * R;
    pontok.push({ x, theta });
  });
  return { pontok, thetaSi: thetaI - q * e.Rsi, thetaSe: thetaE + q * e.Rse, q, eredmeny: e };
}

export function retegrendVastagsag(r: Retegrend) {
  return r.retegek.reduce((s, x) => s + x.dCm, 0);
}

// ---------------------------------------------------------------------------------------------
// Nyílászáró → mag

/** 4.3. táblázat: Ψ keret–üveg a keret anyaga, az üvegezés bevonata és a távtartó szerint. */
export function psiTablabol(k: Pick<NyilaszaroKomponens, 'uvegKod' | 'keretKod' | 'tavtarto'>): number | null {
  if (k.tavtarto === 'nincs') return 0;
  const uveg = epuletfizika.UVEGEZES_TAJEKOZTATO.find((x) => x.kod === k.uvegKod);
  const keret = epuletfizika.KERET_TAJEKOZTATO.find((x) => x.kod === k.keretKod);
  if (!uveg || !keret || !k.tavtarto) return null;
  if (uveg.kod === 'egyreteg') return 0;
  const sor = keret.anyag === 'fem' ? (keret.kod === 'fem_0' ? epuletfizika.PSI_KERET_UVEG.fem_nelkul : epuletfizika.PSI_KERET_UVEG.fem_termikus) : epuletfizika.PSI_KERET_UVEG.fa_pvc;
  return sor[uveg.lowe ? 'lowe' : 'bevonat_nelkul'][k.tavtarto];
}

export function nyilaszaroGeometria(n: NyilaszaroTipus) {
  const k = n.komponens!;
  return osztottAblak({
    szelesseg: n.szelesseg, magassag: n.magassag, keretSzelesseg: k.keretMm / 1000, osztoSzelesseg: (k.osztoMm ?? 2 * k.keretMm) / 1000,
    oszlop: k.oszlop ?? 1, sor: k.sor ?? 1, Uü: k.Ug, Uk: k.Uk, psiKü: k.psi, lec: k.lec,
  });
}

export function nyilaszaroAdatok(n: NyilaszaroTipus) {
  const A = n.szelesseg * n.magassag;
  let U: number, Au: number, Uegy: number | null = null, Rl: number | null = null;
  if (n.komponens) {
    const g = nyilaszaroGeometria(n);
    Uegy = nyilaszaroU(g);
    U = Uegy;
    if (n.komponens.kapcsoltResMm) { Rl = kapcsoltLegretegR(n.komponens.kapcsoltResMm); U = kethejuNyilaszaroU(Uegy, Uegy, Rl); }
    Au = g.Aü;
  } else {
    U = n.uwKezi ?? 1.4;
    Au = A * (1 - (n.keretarany ?? (A < 0.5 ? epuletfizika.KERETARANY.kismeretu_05m2_alatt : epuletfizika.KERETARANY.altalanos)));
  }
  if (n.kovetelmenyKod === 'ajto' || n.kovetelmenyKod === 'kapu') Au = n.gn > 0 ? Au : 0;
  const UFutes = n.arnyekolo ? nyilaszaroArnyekoloval(U, n.arnyekolo.dR) : U;
  return { A, U, Au, UFutes, Uegy, Rl };
}

/** Nyílászáró-típus kortipikus sablonból (a méret megmarad). */
export function sablonbolNyilaszaro(s: nyilaszaroSablon.NyilaszaroSablon, alap: Pick<NyilaszaroTipus, 'id' | 'szelesseg' | 'magassag' | 'kovetelmenyKod' | 'arnyekolo'>): NyilaszaroTipus {
  const uveg = epuletfizika.UVEGEZES_TAJEKOZTATO.find((x) => x.kod === s.uveg)!;
  const keret = epuletfizika.KERET_TAJEKOZTATO.find((x) => x.kod === s.keret)!;
  const komp: NyilaszaroKomponens = {
    keretMm: s.keretMm, osztoMm: s.osztoMm, oszlop: s.oszlop, sor: s.sor, Ug: uveg.Ug, Uk: keret.Uk, uvegKod: uveg.kod, keretKod: keret.kod, tavtarto: s.tavtarto, psi: 0,
    ...(s.kapcsoltResMm ? { kapcsoltResMm: s.kapcsoltResMm } : {}),
  };
  komp.psi = psiTablabol(komp) ?? 0;
  // kapcsolt egyrétegű szárnyak: két üvegréteg – g a 4.1. táblázat bevonat nélküli kétrétegű sora szerint
  const gn = s.kapcsoltResMm ? epuletfizika.UVEGEZES_TAJEKOZTATO.find((x) => x.kod === 'ketreteg_bevonat_nelkul')!.gn : uveg.gn;
  return {
    id: alap.id, nev: s.nev, kovetelmenyKod: alap.kovetelmenyKod === 'ajto' || alap.kovetelmenyKod === 'kapu' ? 'ablak_fa_pvc' : (s.anyag === 'fem' ? 'ablak_fem' : alap.kovetelmenyKod === 'tetosik_ablak' ? 'tetosik_ablak' : 'ablak_fa_pvc'),
    szelesseg: alap.szelesseg, magassag: alap.magassag, komponens: komp, gn, arnyekolo: alap.arnyekolo, sablonKod: s.kod,
  };
}

// ---------------------------------------------------------------------------------------------
// Projekt → EpuletBemenet

function hatar(k: HatarKod): Hatar {
  return k === 'kulso' ? { tipus: 'kulso' } : { tipus: 'futetlen', b: k };
}

export interface Geometria { AN: number; V: number; Alehulo: number; }

export function geometria(p: Projekt): Geometria {
  const futott = p.helyisegek.filter((h) => h.kategoria !== 'gyengen_kapcsolt');
  const AN = futott.reduce((s, h) => s + h.A, 0);
  const V = futott.reduce((s, h) => s + h.A * h.h, 0);
  let Alehulo = 0;
  for (const f of p.feluletek) Alehulo += feluletNettoA(p, f);
  return { AN, V, Alehulo };
}

/** Átlagos belmagasság a fűtött helyiségekből (alapterülettel súlyozva). */
export function atlagBelmagassag(p: Projekt): number {
  const f = p.helyisegek.filter((h) => h.kategoria !== 'gyengen_kapcsolt' && h.A > 0);
  const A = f.reduce((s, h) => s + h.A, 0);
  return A > 0 ? Math.round((f.reduce((s, h) => s + h.A * h.h, 0) / A) * 100) / 100 : 2.7;
}

/** Egy rétegrendhez a helyiségeknél (hőszükséglet) megadott külső falhosszak összege. */
export function falhosszHelyisegekbol(p: Projekt, retegrendId: string | undefined): number {
  return Math.round(p.helyisegek.reduce((s, h) => s + (h.hsz?.kulsoFalak ?? []).filter((k) => !retegrendId || k.retegrendId === retegrendId).reduce((a, k) => a + k.hossz, 0), 0) * 100) / 100;
}

/** Talajon fekvő padló kitett kerülete: a kijelölt külső falak hosszának összege, vagy a megadott érték. */
export function padloKerulet(p: Projekt, f: Felulet): number {
  const ids = f.padlo?.falIds;
  if (!ids?.length) return f.padlo?.P ?? 0;
  return Math.round(p.feluletek.filter((x) => ids.includes(x.id)).reduce((s, x) => s + (x.meret?.hossz ?? 0), 0) * 100) / 100;
}

export function feluletNettoA(p: Projekt, f: Felulet): number {
  if (f.fajta === 'nyilaszaro') {
    const n = p.nyilaszarok.find((x) => x.id === f.nyilaszaroId);
    return n ? n.szelesseg * n.magassag * (f.darab ?? 1) : 0;
  }
  const levonas = p.feluletek.filter((x) => x.fajta === 'nyilaszaro' && x.szuloId === f.id).reduce((s, x) => s + feluletNettoA(p, x), 0);
  return Math.max((f.A ?? 0) - levonas, 0);
}

export interface Atalakitas { bemenet: EpuletBemenet | null; hibak: string[]; geometria: Geometria; }

/** A fűtési idény hónapjai (január–április, október–december) – a napnyereség tájékoztató összesítéséhez. */
export const FUTESI_HONAPOK = [0, 1, 2, 3, 9, 10, 11];

/**
 * Nyílászáró-felület passzív szoláris nyeresége (6.29: Qsd = Au · 0,9 · gn · F · Gs), kWh – a fűtési idényre és egész évre.
 * Gs a 2. függ. 1.6. táblázat havi sugárzási hozama a tájolás és dőlés szerint; F a felülethez megadott árnyékolási tényező.
 */
export function nyilasNapnyereseg(p: Projekt, f: Felulet): { ideny: number; ev: number } | null {
  if (f.fajta !== 'nyilaszaro' || f.hatar !== 'kulso') return null;
  const n = p.nyilaszarok.find((x) => x.id === f.nyilaszaroId); if (!n) return null;
  const d = nyilaszaroAdatok(n); const Au = d.Au * (f.darab ?? 1);
  const F = f.arnyekolas ?? 1;
  let ideny = 0, ev = 0;
  for (let m = 0; m < 12; m++) {
    const q = Au * epuletfizika.F_UVEGEZES_BEESESI * n.gn * F * klima.sugarzasiHozam(f.tajolas ?? null, f.hajlasszog ?? 90, m);
    ev += q; if (FUTESI_HONAPOK.includes(m)) ideny += q;
  }
  return { ideny, ev };
}

export function atalakit(p: Projekt): Atalakitas {
  const hibak: string[] = [];
  const g = geometria(p);
  if (g.AN <= 0) hibak.push('Adj meg legalább egy fűtött helyiséget.');
  if (!p.feluletek.length) hibak.push('Vegyél fel határoló felületeket.');

  const elemek: HataroloElem[] = [];
  for (const f of p.feluletek) {
    try {
      if (f.fajta === 'nyilaszaro') {
        const n = p.nyilaszarok.find((x) => x.id === f.nyilaszaroId);
        if (!n) { hibak.push(`„${f.nev}”: nincs nyílászáró-típus kiválasztva.`); continue; }
        const d = nyilaszaroAdatok(n);
        const db = f.darab ?? 1;
        elemek.push({
          tipus: 'nyilaszaro', nev: f.nev, A: d.A * db, U: d.U, UFutes: d.UFutes, hatar: hatar(f.hatar),
          tajolas: f.tajolas ?? null, hajlasszog: f.hajlasszog ?? 90, Au: d.Au * db, gn: n.gn,
          garnyH: n.arnyekolo?.garnyH, kovetelmenyKod: n.kovetelmenyKod,
          ...(f.arnyekolas !== undefined && f.arnyekolas < 1 ? { Farny: Array(12).fill(Math.max(0, f.arnyekolas)) } : {}),
        });
      } else if (f.fajta === 'padlo') {
        const r = p.retegrendek.find((x) => x.id === f.retegrendId);
        if (!r || !f.padlo) { hibak.push(`„${f.nev}”: hiányzó padló rétegrend vagy kerület.`); continue; }
        const UTp = padloUT(r, f, p);
        elemek.push({ tipus: 'talaj', nev: f.nev, A: f.A ?? 0, UT: UTp, P: padloKerulet(p, f), psiPF: f.padlo.psiPF, kovetelmenyKod: r.kovetelmenyKod });
      } else {
        const r = p.retegrendek.find((x) => x.id === f.retegrendId);
        if (!r) { hibak.push(`„${f.nev}”: nincs rétegrend kiválasztva.`); continue; }
        const e = retegrendSzamitas(r);
        elemek.push({ tipus: 'opak', nev: f.nev, A: feluletNettoA(p, f), U: e.U, chi: p.hohidMod === 'psi' ? 0 : f.chi ?? 0, hatar: hatar(f.hatar), kovetelmenyKod: r.kovetelmenyKod });
      }
    } catch (err) {
      hibak.push(`„${f.nev}”: ${(err as Error).message}`);
    }
  }
  // részletes hőhíd-számítás: a χ helyett vonalmenti Ψ · l (MSZ EN ISO 10211)
  if (p.hohidMod === 'psi') {
    for (const h of p.hohidak ?? []) {
      if (!h.szamit) continue;
      if (!h.eredmeny) { hibak.push(`„${h.nev}”: a hőhíd még nincs kiszámítva.`); continue; }
      elemek.push({ tipus: 'vonal', nev: h.nev, l: h.hossz, psi: h.meretrendszer === 'kulso' ? h.eredmeny.psiE : h.eredmeny.psiI, hatar: hatar(h.hatar ?? 'kulso') });
    }
  }

  const gp = p.gepeszet;
  if (!gp.futes.length) hibak.push('Vegyél fel legalább egy fűtési rendszert.');
  const lefedesOssz = gp.futes.reduce((x, f) => x + (gp.futes.length > 1 && f.terulet && g.AN > 0 ? f.terulet / g.AN : f.lefedes ?? 1), 0);
  if (gp.futes.length && Math.abs(lefedesOssz - 1) > 0.005) hibak.push(`A fűtési rendszerek lefedési arányainak összege ${(lefedesOssz * 100).toFixed(0)}%; 100% kell.`);
  for (const n of gp.napelem) {
    if (n.modszer !== 'pvgis') continue;
    const be = napelemPvgisBemenet(p, n);
    if (!be) hibak.push(`„${n.nev}”: a PVGIS-számításhoz add meg az épület koordinátáit (Gépészet → Napelem).`);
    else if (!pvgis.pvgisErvenyes(n.pvgis, be)) hibak.push(`„${n.nev}”: a PVGIS-adat hiányzik vagy a bemenetek megváltoztak – kérd le újra.`);
  }
  if (hibak.length) return { bemenet: null, hibak, geometria: g };

  const futes = gp.futes.map(({ id: _id, szettKod: _sz, terulet, szabalyozas, ...a }) => ({
    ...structuredClone(a), Arszr: terulet && terulet > 0 ? terulet : g.AN, zona: 'F1', lefedes: gp.futes.length > 1 ? (terulet && g.AN > 0 ? terulet / g.AN : a.lefedes ?? 1) : 1,
    epszilonSzab: szabalyozasErtek(szabalyozas),
  }));
  const { szettKod: _h, ...hmvAlap } = gp.hmv;
  const hmv = { ...structuredClone(hmvAlap), nev: 'HMV', Arszr: g.AN, AN: g.AN, qHMV: epuletfizika.HMV_LAKO[p.meta.kategoria] };
  const VLT = epuletfizika.PROFIL_LAKO.nSzuks * g.V;
  const szellozes = gp.szellozes ? [{ nev: 'Gépi szellőzés', V: VLT, uzemora: 8760 * gp.szellozes.uzemArany, ventilator: gp.szellozes.ventilator, segedKWh: gp.szellozes.segedKWh }] : [];

  const nf = epuletfizika.nfilt({ legzaras: p.zona.legzaras, elhelyezes: p.zona.elhelyezes, szelnekKitett: p.zona.szelnekKitett, szintek: p.meta.szintek <= 2 ? '1-2' : p.meta.szintek <= 6 ? '3-6' : '7-' });
  const bemenet: EpuletBemenet = {
    nev: p.meta.nev, rendeltetes: 'lakoepulet', AN: g.AN, V: g.V, Alehulo: g.Alehulo,
    kovetelmenySzint: p.meta.kovetelmenySzint,
    zonak: [{
      nev: 'F1', AN: g.AN, V: g.V, thetaF: 20, thetaH: 26, nSzuks: epuletfizika.PROFIL_LAKO.nSzuks, nfilt: nf, qb: epuletfizika.PROFIL_LAKO.qb,
      CmEffFajl: p.zona.cmEffFajl ?? epuletfizika.HOTAROLO_KEPESSEG[p.zona.hotarolo].ertek,
      futesProgramozhato: p.zona.futesProgramozhato, elemek,
      gepiSzellozes: gp.szellozes ? { etaR: gp.szellozes.etaR, uzemArany: gp.szellozes.uzemArany } : undefined,
    }],
    futes, hmv: [hmv], szellozes,
    hutes: (gp.hutes ?? []).map(({ id: _i, szettKod: _s, ...h }) => ({ ...structuredClone(h), zona: 'F1' })),
    napelem: gp.napelem.map((n) => {
      const alap = { nev: n.nev, kWp: n.kWp, tajolas: n.tajolas, hajlasszog: n.hajlasszog };
      if (n.modszer !== 'pvgis') return alap;
      const pv = n.pvgis!;
      return { ...alap, reszletes: { Wev: pv.ossz.E_y, forras: `PVGIS 5.3, ${pv.meteo.sugarzasDb ?? 'n. a.'} ${pv.meteo.evTol ?? ''}–${pv.meteo.evIg ?? ''}, lekérve ${pv.lekerve.slice(0, 10)}` } };
    }),
  };
  return { bemenet, hibak, geometria: g };
}

/** Talajon fekvő padló egyenértékű hőátbocsátási tényezője (MSZ EN ISO 13370, 4.20–4.33). */
export function padloUT(r: Retegrend, f: Felulet, p?: Projekt): number {
  const e = retegrendSzamitas(r);
  const Rp = e.retegR.reduce((s, x) => s + x, 0);
  return talajonFekvoPadlo({
    A: f.A ?? 0, P: p ? padloKerulet(p, f) : f.padlo!.P, df: f.padlo!.dfCm / 100, Rp, z: f.padlo!.z,
    peremSzigetelesek: f.padlo!.perem ? [{ irany: f.padlo!.perem.irany, D: f.padlo!.perem.D, dpsz: f.padlo!.perem.dCm / 100, Rpsz: f.padlo!.perem.R }] : [],
  }).UTp;
}

// ---------------------------------------------------------------------------------------------
// Helyiségenkénti hőszükséglet

/** Helyiségnév alapján javasolt belső hőmérséklet és minimális légcsere (tervezői alapérték, módosítható). */
export function hszAlapertek(nev: string): { theta: number; nmin: number; tipus: string } {
  const n = nev.toLowerCase();
  if (/fürdő|furdo|zuhany/.test(n)) return { theta: 24, nmin: hoszukseglet.NMIN.konyha_furdo.ertek, tipus: 'fürdő' };
  if (/nappali|szoba|háló|halo|étkező|etkezo|dolgozó/.test(n)) return { theta: 20, nmin: hoszukseglet.NMIN.lakohelyiseg.ertek, tipus: 'lakóhelyiség' };
  if (/konyha|wc|mosdó|mosókonyha/.test(n)) return { theta: 20, nmin: hoszukseglet.NMIN.konyha_furdo.ertek, tipus: 'konyha, WC' };
  if (/közlekedő|kozlekedo|előtér|eloter|folyosó|lépcső|kamra|tároló|gardrób/.test(n)) return { theta: 18, nmin: hoszukseglet.NMIN.lakohelyiseg.ertek, tipus: 'közlekedő, tároló' };
  return { theta: 20, nmin: hoszukseglet.NMIN.lakohelyiseg.ertek, tipus: 'lakóhelyiség' };
}

export const hszUres = (): HelyisegHsz => ({ kulsoFalak: [], padlas: false, padlo: false, szomszedok: [] });

export interface HszOsszevetes { falHelyisegek: number; falHatarolas: number; padlasHelyisegek: number; padlasHatarolas: number; padloHelyisegek: number; padloHatarolas: number; }

export function hoszuksegletBemenet(p: Projekt): { bemenet: hoszukseglet.HszBemenet; hibak: string[]; osszevetes: HszOsszevetes; ablakA: Record<string, number> } {
  const hibak: string[] = [];
  const be = { ...HSZ_ALAP, ...p.hoszukseglet };
  const opak = (szerep: Szerep) => p.feluletek.find((f) => f.fajta === 'opak' && p.retegrendek.find((r) => r.id === f.retegrendId)?.szerep === szerep);
  const Uopak = (rId: string | undefined, chi = 0) => {
    const r = p.retegrendek.find((x) => x.id === rId);
    if (!r) return null;
    try { return retegrendSzamitas(r).U * (1 + chi); } catch { return null; }
  };
  const padlasF = opak('padlas') ?? opak('teto');
  const padloF = p.feluletek.find((f) => f.fajta === 'padlo');
  let padloU: number | null = null;
  if (padloF) { const r = p.retegrendek.find((x) => x.id === padloF.retegrendId); if (r && padloF.padlo) { try { padloU = padloUT(r, padloF, p); } catch { /* hiányos */ } } }

  const osszevetes: HszOsszevetes = {
    falHelyisegek: 0, padlasHelyisegek: 0, padloHelyisegek: 0,
    falHatarolas: p.feluletek.filter((f) => f.fajta === 'opak' && f.hatar === 'kulso' && p.retegrendek.find((r) => r.id === f.retegrendId)?.szerep === 'fal').reduce((s, f) => s + feluletNettoA(p, f), 0),
    padlasHatarolas: p.feluletek.filter((f) => f.fajta === 'opak' && ['padlas', 'teto'].includes(p.retegrendek.find((r) => r.id === f.retegrendId)?.szerep ?? '')).reduce((s, f) => s + feluletNettoA(p, f), 0),
    padloHatarolas: p.feluletek.filter((f) => f.fajta === 'padlo').reduce((s, f) => s + (f.A ?? 0), 0),
  };
  const ablakA: Record<string, number> = {};

  const futott = p.helyisegek.filter((h) => h.kategoria !== 'gyengen_kapcsolt');
  const helyisegek = futott.map((h): hoszukseglet.HelyisegHszBemenet => {
    const hz = h.hsz ?? hszUres();
    const alap = hszAlapertek(h.nev);
    const theta = hz.theta ?? alap.theta;
    const elemek: hoszukseglet.HszElem[] = [];
    // nyílászárók a helyiségben
    let nyilasDb = 0, nyilasA = 0;
    for (const f of p.feluletek.filter((x) => x.fajta === 'nyilaszaro' && x.helyisegId === h.id)) {
      const n = p.nyilaszarok.find((x) => x.id === f.nyilaszaroId);
      if (!n) continue;
      const d = nyilaszaroAdatok(n);
      const db = f.darab ?? 1;
      const A = d.A * db;
      if (f.hatar === 'kulso') { elemek.push({ tipus: 'kulso', nev: f.nev, A, U: d.U }); nyilasDb += db; nyilasA += A; }
      else elemek.push({ tipus: 'futetlen', nev: f.nev, A, U: d.U, bu: epuletfizika.B_TENYEZO[f.hatar].tel });
    }
    ablakA[h.id] = nyilasA;
    // külső falak: hossz × belmagasság − nyílászárók
    const falBrutto = hz.kulsoFalak.reduce((s, x) => s + x.hossz * h.h, 0);
    let levonando = nyilasA;
    for (const fal of hz.kulsoFalak) {
      const chi = p.feluletek.find((f) => f.retegrendId === fal.retegrendId)?.chi ?? 0;
      const U = Uopak(fal.retegrendId, chi);
      if (U === null) { hibak.push(`${h.nev}: a külső fal rétegrendje hiányos.`); continue; }
      const brutto = fal.hossz * h.h;
      const le = falBrutto > 0 ? Math.min(levonando, nyilasA * (brutto / falBrutto)) : 0;
      levonando -= le;
      elemek.push({ tipus: 'kulso', nev: 'Külső fal', A: Math.max(brutto - le, 0), U });
      osszevetes.falHelyisegek += Math.max(brutto - le, 0);
    }
    if (nyilasA > 0 && falBrutto < nyilasA) hibak.push(`${h.nev}: a nyílászárók felülete (${nyilasA.toFixed(1)} m²) nagyobb a megadott külső falnál – add meg a külső fal hosszát.`);
    if (hz.padlas) {
      const U = padlasF ? Uopak(padlasF.retegrendId, padlasF.chi ?? 0) : null;
      if (U === null || !padlasF) hibak.push(`${h.nev}: nincs padlásfödém vagy tető a határolásban.`);
      else if (padlasF.hatar === 'kulso') elemek.push({ tipus: 'kulso', nev: 'Tető', A: h.A, U });
      else elemek.push({ tipus: 'futetlen', nev: 'Padlásfödém', A: h.A, U, bu: epuletfizika.B_TENYEZO[padlasF.hatar].tel });
      osszevetes.padlasHelyisegek += h.A;
    }
    if (hz.padlo) {
      if (padloU === null) hibak.push(`${h.nev}: nincs talajon fekvő padló a határolásban.`);
      else elemek.push({ tipus: 'talaj', nev: 'Talajon fekvő padló', A: h.A, Uequiv: padloU });
      osszevetes.padloHelyisegek += h.A;
    }
    for (const sz of hz.szomszedok) {
      const m = p.helyisegek.find((x) => x.id === sz.helyisegId);
      if (!m) continue;
      const tm = m.kategoria === 'gyengen_kapcsolt' ? null : (m.hsz?.theta ?? hszAlapertek(m.nev).theta);
      if (tm === null) elemek.push({ tipus: 'futetlen', nev: m.nev, A: sz.A, U: sz.U, bu: epuletfizika.B_TENYEZO.futetlen_helyiseg.tel });
      else elemek.push({ tipus: 'szomszed', nev: m.nev, A: sz.A, U: sz.U, thetaSzomszed: tm });
    }
    return {
      id: h.id, nev: h.nev, A: h.A, V: h.A * h.h, thetaInt: theta, nmin: hz.nmin ?? alap.nmin,
      nyilasok: hz.nyilasok ?? (nyilasDb >= 2 ? 'tobb' : nyilasDb === 1 ? 'egy' : 'nincs'),
      elemek, fRH: be.rhMod === 'fajlagos' || (!be.rhMod && be.fRH) ? be.fRH : 0,
    };
  });
  const gsz = p.gepeszet.szellozes;
  return {
    bemenet: {
      thetaE: be.thetaE, thetaME: klima.KULSO_HOMERSEKLET_EVES, n50: be.n50, vedettseg: be.vedettseg, Gw: be.Gw,
      hovisszanyeres: gsz ? { etaR: gsz.etaR } : null, rhArany: be.rhMod === 'arany' ? (be.rhArany ?? 0.1) : 0, helyisegek,
    },
    hibak, osszevetes, ablakA,
  };
}

export function szabalyozasErtek(s: FutesSablon['szabalyozas']): number {
  return 'valasztas' in s ? szabalyozasiTenyezo(s.valasztas).epszilon : s.kozvetlen;
}

/** Fűtési szett (részszett vagy régi kombinált szett kódja alapján). */
export function futesSzettbol(kod: string): FutesAlrendszerUI {
  const k = GEPESZETI_SZETTEK.find((x) => x.kod === kod)?.futesKod ?? kod;
  const sz = FUTES_SZETTEK.find((x) => x.kod === k) ?? FUTES_SZETTEK[0]!;
  return { ...structuredClone(sz.adat), id: ujId(), nev: sz.nev, szettKod: sz.kod };
}
export function hmvSzettbol(kod: string): HmvUI {
  const k = GEPESZETI_SZETTEK.find((x) => x.kod === kod)?.hmvKod ?? kod;
  const sz = HMV_SZETTEK.find((x) => x.kod === k) ?? HMV_SZETTEK[0]!;
  return { ...structuredClone(sz.adat), szettKod: sz.kod };
}
export function szellozesSzettbol(kod: string): SzellozesUI {
  const sz = SZELLOZES_SZETTEK.find((x) => x.kod === kod)!;
  return { ...structuredClone(sz.adat), szettKod: kod };
}
export function hutesSzettbol(kod: string): HutesUI {
  const sz = HUTES_SZETTEK.find((x) => x.kod === kod)!;
  return { ...structuredClone(sz.adat), id: ujId(), nev: sz.nev, szettKod: kod };
}
/** A szett aktuális neve kód alapján (régi kombinált kódokat is felold). */
export function szettNev(lista: readonly { kod: string; nev: string }[], kod: string | undefined, regi?: 'futesKod' | 'hmvKod'): string | null {
  if (!kod) return null;
  const k = regi ? GEPESZETI_SZETTEK.find((x) => x.kod === kod)?.[regi] ?? kod : kod;
  return lista.find((x) => x.kod === k)?.nev ?? null;
}

/** A napelem PVGIS-bemenete a projekt adataiból (null, ha nincs koordináta). */
export function napelemPvgisBemenet(p: Projekt, n: NapelemUI): pvgis.PvgisBemenet | null {
  const k = p.meta.koordinata;
  if (!k) return null;
  return { lat: k.lat, lon: k.lon, kWp: n.kWp, veszteseg: n.veszteseg ?? 14, hajlasszog: n.hajlasszog, azimut: n.azimut ?? 0, elhelyezes: n.elhelyezes ?? 'building' };
}

export function erpFutes(h: FutesiHotermelo, eta: number): FutesiHotermelo {
  if (h.tipus === 'kazan_tabla') return { tipus: 'kazan_erp', energiahordozo: h.energiahordozo, etaS: eta };
  if (h.tipus === 'hoszivattyu_tabla') return { tipus: 'hoszivattyu_erp', etaS: eta };
  return h;
}
export function erpHmv(h: HmvHotermelo, eta: number): HmvHotermelo {
  if (h.tipus === 'kazan_tabla') return { tipus: 'erp', energiahordozo: h.energiahordozo, etaWH: eta };
  if (h.tipus === 'elektromos_tabla') return { tipus: 'erp_elektromos', etaWH: eta, hoszivattyu: h.kod.startsWith('hsz') };
  return h;
}

/** Régebbi projektfájlok átalakítása az aktuális modellre (1. verzió: egy fűtési és egy HMV szett + ErP hatásfok). */
export function projektMigral(nyers: unknown): Projekt {
  const p = structuredClone(nyers) as Projekt & { gepeszet: Gepeszet & { futesSzett?: string; hmvSzett?: string; futesErpEta?: number | null; hmvErpEta?: number | null } };
  if ((p.verzio as number) === 1 || p.gepeszet?.futesSzett) {
    const r = p.gepeszet;
    const f = futesSzettbol(r.futesSzett && GEPESZETI_SZETTEK.some((x) => x.kod === r.futesSzett) ? r.futesSzett : GEPESZETI_SZETTEK[0]!.kod);
    if (r.futesErpEta) f.hotermelo = erpFutes(f.hotermelo, r.futesErpEta);
    const h = hmvSzettbol(r.hmvSzett && GEPESZETI_SZETTEK.some((x) => x.kod === r.hmvSzett) ? r.hmvSzett : GEPESZETI_SZETTEK[0]!.kod);
    if (r.hmvErpEta) h.hotermelo = erpHmv(h.hotermelo, r.hmvErpEta);
    p.gepeszet = { futes: [f], hmv: h, szellozes: null, napelem: [] };
    p.verzio = 2;
  }
  p.gepeszet.napelem ??= [];
  p.gepeszet.szellozes ??= null;
  p.gepeszet.hutes ??= [];
  // Korábbi rétegrendek neve kézi névnek számít (nem nevezzük át).
  for (const r of p.retegrendek ?? []) r.nevKezi ??= true;
  return p;
}

export const SZEREP_ALAP: Record<Szerep, Pick<Retegrend, 'kovetelmenyKod' | 'hoaramIrany' | 'kulsoOldal'>> = {
  fal: { kovetelmenyKod: 'homlokzati_fal', hoaramIrany: 'vizszintes', kulsoOldal: 'kulso' },
  padlas: { kovetelmenyKod: 'padlasfodem', hoaramIrany: 'felfele', kulsoOldal: 'futetlen' },
  teto: { kovetelmenyKod: 'futott_tetoter', hoaramIrany: 'felfele', kulsoOldal: 'kulso' },
  pincefodem: { kovetelmenyKod: 'also_zarofodem', hoaramIrany: 'lefele', kulsoOldal: 'futetlen' },
  padlo: { kovetelmenyKod: 'talajon_fekvo_padlo', hoaramIrany: 'lefele', kulsoOldal: 'kulso' },
  belso: { kovetelmenyKod: 'futott_futetlen_fal', hoaramIrany: 'vizszintes', kulsoOldal: 'futetlen' },
};

export const SZEREP_NEV: Record<Szerep, string> = {
  fal: 'Homlokzati fal', padlas: 'Padlásfödém', teto: 'Tető / tetőtér', pincefodem: 'Pincefödém', padlo: 'Talajon fekvő padló', belso: 'Fűtetlen tér felé eső fal',
};

/** 6.1. táblázat – választható χ értékek. */
export const CHI_VALASZTEK = [
  { ertek: 0.15, nev: 'Külső fal, külső oldali szigetelés – gyengén hőhidas', szerep: 'fal' },
  { ertek: 0.2, nev: 'Külső fal, külső oldali szigetelés – közepesen hőhidas', szerep: 'fal' },
  { ertek: 0.3, nev: 'Külső fal, külső oldali szigetelés – erősen hőhidas', szerep: 'fal' },
  { ertek: 0.25, nev: 'Egyéb külső fal – gyengén hőhidas', szerep: 'fal' },
  { ertek: 0.3, nev: 'Egyéb külső fal – közepesen hőhidas', szerep: 'fal' },
  { ertek: 0.4, nev: 'Egyéb külső fal – erősen hőhidas', szerep: 'fal' },
  { ertek: 0.1, nev: 'Padlásfödém', szerep: 'padlas' },
  { ertek: 0.1, nev: 'Lapostető / beépített tetőtér – gyengén hőhidas', szerep: 'teto' },
  { ertek: 0.15, nev: 'Lapostető / beépített tetőtér – közepesen hőhidas', szerep: 'teto' },
  { ertek: 0.2, nev: 'Lapostető / beépített tetőtér – erősen hőhidas', szerep: 'teto' },
  { ertek: 0.2, nev: 'Pincefödém, szerkezeten belüli szigetelés', szerep: 'pincefodem' },
  { ertek: 0.1, nev: 'Pincefödém, alsó oldali szigetelés', szerep: 'pincefodem' },
  { ertek: 0.05, nev: 'Fűtött és fűtetlen terek közötti fal', szerep: 'belso' },
] as const;

export const HATAR_NEV: Record<HatarKod, string> = {
  kulso: 'Külső levegő',
  ...Object.fromEntries(Object.entries(epuletfizika.B_TENYEZO).map(([k, v]) => [k, v.megnevezes])) as Record<BTenyezoKod, string>,
};

export function kovetelmenyNev(kod: string) {
  return kovetelmeny.U_KOVETELMENYEK.find((k) => k.kod === kod);
}
