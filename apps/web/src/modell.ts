/**
 * A felület projektmodellje és átalakítása a számítómag bemenetére.
 * A felhasználó helyiségeket, rétegrendeket, nyílászáró-típusokat és határoló felületeket visz fel;
 * ebből áll elő a zóna (AN, V) és a határoló elemek listája.
 */
import {
  retegrendU, talajonFekvoPadlo, osztottAblak, kapcsoltLegretegR, kethejuNyilaszaroU, nyilaszaroU, nyilaszaroArnyekoloval, nyilaszaroSablon,
  epuletfizika, kovetelmeny, klima, hoszukseglet, GEPESZETI_SZETTEK, szabalyozasiTenyezo,
  type EpuletBemenet, type HataroloElem, type Reteg, type Hatar, type FutesiHotermelo, type HmvHotermelo,
  type FutesSablon, type HmvSablon, type SzellozesRendszer,
} from '@mag/index';
import type { BTenyezoKod, HoaramIrany, Legzaras, NyilasElhelyezes } from '@mag/tablak/epuletfizika';
import type { Tajolas, Hajlasszog } from '@mag/tablak/klima';
import { anyag, beepitett, type Anyag } from './katalogus';

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
export interface HoszuksegletBeallitas { thetaE: number; n50: number; vedettseg: hoszukseglet.Vedettseg; Gw: number; fRH: number; }
export const HSZ_ALAP: HoszuksegletBeallitas = { thetaE: -15, n50: 3, vedettseg: 'mersekelt', Gw: 1, fRH: 0 };

export type Szerep = 'fal' | 'padlas' | 'teto' | 'pincefodem' | 'padlo' | 'belso';
export interface RetegUI { id: string; anyagId?: string; nev?: string; dCm: number; lambda?: number; R?: number; legreteg?: 'zart' | 'intenziv'; }
export interface Retegrend {
  id: string; nev: string; szerep: Szerep; kovetelmenyKod: string;
  hoaramIrany: HoaramIrany; kulsoOldal: 'kulso' | 'futetlen' | 'belso';
  retegek: RetegUI[];
  kezidU?: number; rseFelulbiralas?: number;
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
  /** A nyílászáró ebből a falból vonódik le. */
  szuloId?: string;
  chi?: number;
  /** A CHI_VALASZTEK sorindexe (az azonos χ értékű sorok megkülönböztetésére). */
  chiKod?: number;
  padlo?: {
    P: number; dfCm: number; z: number;
    perem?: { irany: 'vizszintes' | 'fuggoleges'; D: number; dCm: number; R: number };
    psiPF: number;
  };
}

// ---------------------------------------------------------------------------------------------
// Gépészet: a szett csak kiindulópont, minden elem külön szerkeszthető.

/** Fűtési alrendszer; bivalens rendszernél több is lehet, a lefedések összege 1. */
export interface FutesAlrendszerUI extends FutesSablon { id: string; nev: string; szettKod?: string; }
export interface HmvUI extends HmvSablon { szettKod?: string; }
export interface SzellozesUI {
  /** Hővisszanyerő hatásfoka (0..1). */
  etaR: number;
  /** Üzemidő-arány (0..1). */
  uzemArany: number;
  ventilator: SzellozesRendszer['ventilator'];
  segedKWh?: number;
}
export interface NapelemUI { id: string; nev: string; kWp: number; tajolas: 'K_Ny' | 'DK_DNy' | 'D'; hajlasszog: number; }
export interface Gepeszet { futes: FutesAlrendszerUI[]; hmv: HmvUI; szellozes: SzellozesUI | null; napelem: NapelemUI[]; }

export interface Projekt {
  verzio: 2;
  meta: {
    nev: string; megrendelo: string; irsz: string; telepules: string; kozterulet: string; kozteruletJelleg: string; hazszam: string;
    hrsz: string; epitesiEv: number;
    /** A nyílászárók cseréjének éve (a kortipikus ablakajánláshoz); üres: az építés éve. */
    nyilaszaroCsereEv?: number; kategoria: 'csaladi_haz' | 'egyeb_lakoepulet';
    kovetelmenySzint: 'kozel_nulla' | 'jelentos_felujitas' | 'meglevo'; epulettipus?: string; szintek: number;
  };
  zona: { legzaras: Legzaras; elhelyezes: NyilasElhelyezes; szelnekKitett: boolean; hotarolo: keyof typeof epuletfizika.HOTAROLO_KEPESSEG; cmEffFajl?: number; futesProgramozhato: boolean };
  helyisegek: Helyiseg[];
  retegrendek: Retegrend[];
  nyilaszarok: NyilaszaroTipus[];
  feluletek: Felulet[];
  gepeszet: Gepeszet;
  tanusito: { nev: string; jogosultsag: string; email: string; telefon: string };
  /** Helyiségenkénti hőszükséglet beállításai. */
  hoszukseglet?: HoszuksegletBeallitas;
  /** A projektben használt nem beépített (irodai) anyagok pillanatképe: a projekt így önmagában is számolható. */
  anyagok?: Anyag[];
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

export function feluletNettoA(p: Projekt, f: Felulet): number {
  if (f.fajta === 'nyilaszaro') {
    const n = p.nyilaszarok.find((x) => x.id === f.nyilaszaroId);
    return n ? n.szelesseg * n.magassag * (f.darab ?? 1) : 0;
  }
  const levonas = p.feluletek.filter((x) => x.fajta === 'nyilaszaro' && x.szuloId === f.id).reduce((s, x) => s + feluletNettoA(p, x), 0);
  return Math.max((f.A ?? 0) - levonas, 0);
}

export interface Atalakitas { bemenet: EpuletBemenet | null; hibak: string[]; geometria: Geometria; }

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
        });
      } else if (f.fajta === 'padlo') {
        const r = p.retegrendek.find((x) => x.id === f.retegrendId);
        if (!r || !f.padlo) { hibak.push(`„${f.nev}”: hiányzó padló rétegrend vagy kerület.`); continue; }
        const UTp = padloUT(r, f);
        elemek.push({ tipus: 'talaj', nev: f.nev, A: f.A ?? 0, UT: UTp, P: f.padlo.P, psiPF: f.padlo.psiPF, kovetelmenyKod: r.kovetelmenyKod });
      } else {
        const r = p.retegrendek.find((x) => x.id === f.retegrendId);
        if (!r) { hibak.push(`„${f.nev}”: nincs rétegrend kiválasztva.`); continue; }
        const e = retegrendSzamitas(r);
        elemek.push({ tipus: 'opak', nev: f.nev, A: feluletNettoA(p, f), U: e.U, chi: f.chi ?? 0, hatar: hatar(f.hatar), kovetelmenyKod: r.kovetelmenyKod });
      }
    } catch (err) {
      hibak.push(`„${f.nev}”: ${(err as Error).message}`);
    }
  }

  const gp = p.gepeszet;
  if (!gp.futes.length) hibak.push('Vegyél fel legalább egy fűtési rendszert.');
  const lefedesOssz = gp.futes.reduce((x, f) => x + (f.lefedes ?? 1), 0);
  if (gp.futes.length && Math.abs(lefedesOssz - 1) > 0.005) hibak.push(`A fűtési rendszerek lefedési arányainak összege ${(lefedesOssz * 100).toFixed(0)}%; 100% kell.`);
  if (hibak.length) return { bemenet: null, hibak, geometria: g };

  const futes = gp.futes.map(({ id: _id, szettKod: _sz, szabalyozas, ...a }) => ({
    ...structuredClone(a), Arszr: g.AN, zona: 'F1', lefedes: gp.futes.length > 1 ? a.lefedes ?? 1 : 1,
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
    napelem: gp.napelem.map(({ nev, kWp, tajolas, hajlasszog }) => ({ nev, kWp, tajolas, hajlasszog })),
  };
  return { bemenet, hibak, geometria: g };
}

/** Talajon fekvő padló egyenértékű hőátbocsátási tényezője (MSZ EN ISO 13370, 4.20–4.33). */
export function padloUT(r: Retegrend, f: Felulet): number {
  const e = retegrendSzamitas(r);
  const Rp = e.retegR.reduce((s, x) => s + x, 0);
  return talajonFekvoPadlo({
    A: f.A ?? 0, P: f.padlo!.P, df: f.padlo!.dfCm / 100, Rp, z: f.padlo!.z,
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
  if (padloF) { const r = p.retegrendek.find((x) => x.id === padloF.retegrendId); if (r && padloF.padlo) { try { padloU = padloUT(r, padloF); } catch { /* hiányos */ } } }

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
      elemek, fRH: be.fRH,
    };
  });
  const gsz = p.gepeszet.szellozes;
  return {
    bemenet: {
      thetaE: be.thetaE, thetaME: klima.KULSO_HOMERSEKLET_EVES, n50: be.n50, vedettseg: be.vedettseg, Gw: be.Gw,
      hovisszanyeres: gsz ? { etaR: gsz.etaR } : null, helyisegek,
    },
    hibak, osszevetes, ablakA,
  };
}

export function szabalyozasErtek(s: FutesSablon['szabalyozas']): number {
  return 'valasztas' in s ? szabalyozasiTenyezo(s.valasztas).epszilon : s.kozvetlen;
}

export function futesSzettbol(kod: string): FutesAlrendszerUI {
  const sz = GEPESZETI_SZETTEK.find((x) => x.kod === kod)!;
  return { ...structuredClone(sz.futes), id: ujId(), nev: sz.nev.split(' + ')[0] ?? sz.nev, szettKod: kod };
}
export function hmvSzettbol(kod: string): HmvUI {
  const sz = GEPESZETI_SZETTEK.find((x) => x.kod === kod)!;
  return { ...structuredClone(sz.hmv), szettKod: kod };
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
