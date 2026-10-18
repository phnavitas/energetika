/**
 * A felület projektmodellje és átalakítása a számítómag bemenetére.
 * A felhasználó helyiségeket, rétegrendeket, nyílászáró-típusokat és határoló felületeket visz fel;
 * ebből áll elő a zóna (AN, V) és a határoló elemek listája.
 */
import {
  retegrendU, talajonFekvoPadlo, teglalapAblak, nyilaszaroU, nyilaszaroArnyekoloval,
  epuletfizika, kovetelmeny, GEPESZETI_SZETTEK, szabalyozasiTenyezo,
  type EpuletBemenet, type HataroloElem, type Reteg, type Hatar, type FutesiHotermelo, type HmvHotermelo,
  type FutesSablon, type HmvSablon, type SzellozesRendszer,
} from '@mag/index';
import type { BTenyezoKod, HoaramIrany, Legzaras, NyilasElhelyezes } from '@mag/tablak/epuletfizika';
import type { Tajolas, Hajlasszog } from '@mag/tablak/klima';
import { anyag, beepitett, type Anyag } from './katalogus';

export type HelyisegKategoria = 'kondicionalt' | 'erosen_kapcsolt' | 'gyengen_kapcsolt';
export interface Helyiseg { id: string; nev: string; kategoria: HelyisegKategoria; A: number; h: number; }

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
  /** Komponensekből (4.16) vagy kézi Uw. */
  komponens?: { keretMm: number; Ug: number; Uk: number; psi: number };
  uwKezi?: number;
  gn: number;
  keretarany?: number;
  /** Társított árnyékoló (fűtési U-hoz ΔR, hűtéshez gárny). */
  arnyekolo?: { kod: string; dR: number; garnyH: number };
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
    hrsz: string; epitesiEv: number; kategoria: 'csaladi_haz' | 'egyeb_lakoepulet';
    kovetelmenySzint: 'kozel_nulla' | 'jelentos_felujitas' | 'meglevo'; epulettipus?: string; szintek: number;
  };
  zona: { legzaras: Legzaras; elhelyezes: NyilasElhelyezes; szelnekKitett: boolean; hotarolo: keyof typeof epuletfizika.HOTAROLO_KEPESSEG; cmEffFajl?: number; futesProgramozhato: boolean };
  helyisegek: Helyiseg[];
  retegrendek: Retegrend[];
  nyilaszarok: NyilaszaroTipus[];
  feluletek: Felulet[];
  gepeszet: Gepeszet;
  tanusito: { nev: string; jogosultsag: string; email: string; telefon: string };
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

export function nyilaszaroAdatok(n: NyilaszaroTipus) {
  const A = n.szelesseg * n.magassag;
  let U: number, Au: number;
  if (n.komponens) {
    const g = teglalapAblak({ szelesseg: n.szelesseg, magassag: n.magassag, keretSzelesseg: n.komponens.keretMm / 1000, Uü: n.komponens.Ug, Uk: n.komponens.Uk, psiKü: n.komponens.psi });
    U = nyilaszaroU(g);
    Au = g.Aü;
  } else {
    U = n.uwKezi ?? 1.4;
    Au = A * (1 - (n.keretarany ?? (A < 0.5 ? epuletfizika.KERETARANY.kismeretu_05m2_alatt : epuletfizika.KERETARANY.altalanos)));
  }
  if (n.kovetelmenyKod === 'ajto' || n.kovetelmenyKod === 'kapu') Au = n.gn > 0 ? Au : 0;
  const UFutes = n.arnyekolo ? nyilaszaroArnyekoloval(U, n.arnyekolo.dR) : U;
  return { A, U, Au, UFutes };
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
        const e = retegrendSzamitas(r);
        const Rp = e.retegR.reduce((s, x) => s + x, 0);
        const t = talajonFekvoPadlo({
          A: f.A ?? 0, P: f.padlo.P, df: f.padlo.dfCm / 100, Rp, z: f.padlo.z,
          peremSzigetelesek: f.padlo.perem ? [{ irany: f.padlo.perem.irany, D: f.padlo.perem.D, dpsz: f.padlo.perem.dCm / 100, Rpsz: f.padlo.perem.R }] : [],
        });
        elemek.push({ tipus: 'talaj', nev: f.nev, A: f.A ?? 0, UT: t.UTp, P: f.padlo.P, psiPF: f.padlo.psiPF, kovetelmenyKod: r.kovetelmenyKod });
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
