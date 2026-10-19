/**
 * Helyiségenkénti tervezési hőszükséglet – MSZ EN 12831 egyszerűsített szerkezete szerint (a gépészeti méretezéshez).
 *
 *   ΦHL,i = ΦT,i + ΦV,i + ΦRH,i
 *   ΦT,i  = (HT,ie + HT,iue + HT,ig + HT,ij) · (θint,i − θe)
 *   ΦV,i  = 0,34 · V̇i · (θint,i − θe)
 *
 * A szabvány nemzeti melléklete nyilvánosan nem érhető el, ezért minden alapérték (θe, θint, nmin, e, ε, fg1) a
 * felületen felülírható; az alapértékek az MSZ EN 12831:2003 D (tájékoztató) mellékletének értékei, ellenőrizendők.
 * Ez a számítás nem része a 9/2023 ÉKM szerinti energetikai számításnak.
 */
import type { Figyelmeztetes } from './interpolacio.js';

export const HSZ_FORRAS = 'MSZ EN 12831:2003 D melléklet tájékoztató értékei (a nemzeti melléklet nem volt elérhető – ellenőrizendő)';

/** D.5a – minimális légcsereszám nmin [1/h]. */
export const NMIN = {
  lakohelyiseg: { ertek: 0.5, nev: 'Lakóhelyiség (alapérték)' },
  konyha_furdo: { ertek: 1.5, nev: 'Konyha vagy fürdőszoba ablakkal' },
  iroda: { ertek: 1.0, nev: 'Iroda' },
  tanterem: { ertek: 2.0, nev: 'Tárgyaló, tanterem' },
} as const;

/** D.8 – árnyékolási tényező e: a helyiség külső nyílásainak száma × az épület szél elleni védettsége. */
export const ARNYEKOLAS_E = {
  tobb: { nincs: 0.05, mersekelt: 0.03, eros: 0.02 },
  egy: { nincs: 0.03, mersekelt: 0.02, eros: 0.01 },
  nincs: { nincs: 0, mersekelt: 0, eros: 0 },
} as const;
export type Vedettseg = 'nincs' | 'mersekelt' | 'eros';
export type NyilasSzam = keyof typeof ARNYEKOLAS_E;

/** D.9 – magassági korrekció ε a helyiség terepszint feletti magassága szerint. */
export function magassagiKorrekcio(hTerep: number): number { return hTerep <= 10 ? 1 : hTerep <= 30 ? 1.2 : 1.5; }

/** D.4.3 – talaj: évi ingadozás korrekciója. */
export const FG1 = 1.45;

export type HszElem =
  /** Külső levegővel érintkező (U a hőhídhatással növelve). */
  | { tipus: 'kulso'; nev: string; A: number; U: number }
  /** Fűtetlen tér felé, bu hőmérséklet-csökkentő tényezővel. */
  | { tipus: 'futetlen'; nev: string; A: number; U: number; bu: number }
  /** Talajjal érintkező, egyenértékű U (MSZ EN ISO 13370). */
  | { tipus: 'talaj'; nev: string; A: number; Uequiv: number }
  /** Eltérő hőmérsékletű fűtött szomszéd (negatív is lehet: nyereség). */
  | { tipus: 'szomszed'; nev: string; A: number; U: number; thetaSzomszed: number };

export interface HelyisegHszBemenet {
  id: string;
  nev: string;
  A: number;
  V: number;
  thetaInt: number;
  nmin: number;
  nyilasok: NyilasSzam;
  /** Terepszint feletti magasság [m] a magassági korrekcióhoz. */
  hTerep?: number;
  elemek: HszElem[];
  /** Felfűtési többlet fajlagos értéke [W/m²] (szakaszos fűtés); 0, ha folyamatos. */
  fRH?: number;
}

export interface HszBemenet {
  thetaE: number;
  /** Évi középhőmérséklet a talajkorrekcióhoz (fg2). */
  thetaME: number;
  /** Légtömörség n50 [1/h]. */
  n50: number;
  vedettseg: Vedettseg;
  /** Talajvíz-korrekció (1,15, ha a talajvíz 1 m-nél közelebb). */
  Gw: number;
  /** Hővisszanyerős gépi szellőzés: a minimális légcserét a befúvás fedezi, (1 − ηr) arányban terhelve. */
  hovisszanyeres?: { etaR: number } | null;
  /** Felfűtési többlet a ΦT + ΦV arányában (tervezői pótlék, pl. 0,1); a helyiségenkénti fRH-val összeadódik. */
  rhArany?: number;
  helyisegek: HelyisegHszBemenet[];
}

export interface HelyisegHszEredmeny {
  id: string; nev: string; A: number; thetaInt: number;
  HTie: number; HTiue: number; HTig: number; HTij: number;
  PhiT: number;
  Vinf: number; Vmin: number; Vszamitott: number;
  PhiV: number; PhiRH: number; PhiHL: number;
  fajlagos: number;
}

export interface HszEredmeny {
  helyisegek: HelyisegHszEredmeny[];
  /** A helyiségek hőszükségletének összege [W] (hőtermelő-méretezéshez felső becslés). */
  osszesen: number;
  PhiT: number; PhiV: number; PhiRH: number;
  figyelmeztetesek: Figyelmeztetes[];
}

export function helyisegHoszukseglet(b: HszBemenet): HszEredmeny {
  const fw: Figyelmeztetes[] = [];
  const helyisegek = b.helyisegek.map((h): HelyisegHszEredmeny => {
    const dT = h.thetaInt - b.thetaE;
    if (dT <= 0) fw.push({ kod: 'HSZ_DT', uzenet: `„${h.nev}”: a belső hőmérséklet nem nagyobb a külső méretezési hőmérsékletnél.`, forras: HSZ_FORRAS });
    let HTie = 0, HTiue = 0, HTig = 0, HTij = 0;
    for (const e of h.elemek) {
      if (e.tipus === 'kulso') HTie += e.A * e.U;
      else if (e.tipus === 'futetlen') HTiue += e.A * e.U * e.bu;
      else if (e.tipus === 'talaj') {
        const fg2 = (h.thetaInt - b.thetaME) / dT;
        HTig += FG1 * fg2 * e.A * e.Uequiv * b.Gw;
      } else {
        const fij = (h.thetaInt - e.thetaSzomszed) / dT;
        HTij += fij * e.A * e.U;
      }
    }
    const PhiT = (HTie + HTiue + HTig + HTij) * dT;
    const e = ARNYEKOLAS_E[h.nyilasok][b.vedettseg];
    const eps = magassagiKorrekcio(h.hTerep ?? 0);
    const Vinf = 2 * h.V * b.n50 * e * eps;
    const Vmin = h.nmin * h.V;
    const Vszamitott = b.hovisszanyeres ? Vinf + Vmin * (1 - b.hovisszanyeres.etaR) : Math.max(Vinf, Vmin);
    const PhiV = 0.34 * Vszamitott * dT;
    const PhiRH = (h.fRH ?? 0) * h.A + (b.rhArany ?? 0) * (PhiT + PhiV);
    const PhiHL = PhiT + PhiV + PhiRH;
    return { id: h.id, nev: h.nev, A: h.A, thetaInt: h.thetaInt, HTie, HTiue, HTig, HTij, PhiT, Vinf, Vmin, Vszamitott, PhiV, PhiRH, PhiHL, fajlagos: h.A > 0 ? PhiHL / h.A : 0 };
  });
  const sum = (k: 'PhiT' | 'PhiV' | 'PhiRH' | 'PhiHL') => helyisegek.reduce((s, h) => s + h[k], 0);
  return { helyisegek, osszesen: sum('PhiHL'), PhiT: sum('PhiT'), PhiV: sum('PhiV'), PhiRH: sum('PhiRH'), figyelmeztetesek: fw };
}
