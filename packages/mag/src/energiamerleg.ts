/**
 * Fűtés/hűtés nettó hőenergia-igénye havi módszerrel – 9/2023 ÉKM számítási módszer, 1. függelék 6. fejezet.
 */
import { HONAP_ORAK, KULSO_HOMERSEKLET_HAVI, KULSO_HOMERSEKLET_EVES, sugarzasiHozam, type Tajolas, type Hajlasszog } from './tablak/klima.js';
import { bErtek, type BTenyezoKod, HASZNOSITAS, F_UVEGEZES_BEESESI, B_EJJEL, HOTAROLO_KEPESSEG, sigmaFLako } from './tablak/epuletfizika.js';
import type { Figyelmeztetes } from './interpolacio.js';

export type Hatar = { tipus: 'kulso' } | { tipus: 'futetlen'; b: BTenyezoKod } | { tipus: 'futetlen_b'; bTel: number; bNyar: number };

export interface OpakElem {
  tipus: 'opak';
  nev: string;
  A: number;
  /** Rétegtervi (korrigált) U, csatlakozási hőhidak nélkül. */
  U: number;
  /** 6.1. táblázat χ – egyszerűsített csatlakozási hőhíd korrekció. Részletes módszernél 0 és vonalmenti hőhidak. */
  chi: number;
  hatar: Hatar;
  /** 1. melléklet 1.1. követelmény sorkódja (pl. 'homlokzati_fal'). */
  kovetelmenyKod?: string;
}

export interface NyilaszaroElem {
  tipus: 'nyilaszaro';
  nev: string;
  /** Bruttó (tok-külméret szerinti) felület. */
  A: number;
  U: number;
  /** Fűtési U társított árnyékolóval (4.18). Ha nincs, U. */
  UFutes?: number;
  hatar: Hatar;
  tajolas: Tajolas | null;
  hajlasszog: 0 | Hajlasszog;
  /** Üvegezett felület; ha nincs megadva: A·(1−keretarány). */
  Au?: number;
  keretarany?: number;
  gn: number;
  /** Hűtési módban a társított napvédő gárny,H (2. függ. 4.5.); fűtésnél 1. */
  garnyH?: number;
  /** Külső akadályok összesített árnyékoltsági tényezője havonta (Fh·Fv·Ff), alapérték 1. */
  Farny?: readonly number[];
  kovetelmenyKod?: string;
}

export interface TalajElem {
  tipus: 'talaj';
  nev: string;
  A: number;
  /** Talaj hatását is tartalmazó egyenértékű U (4.4). */
  UT: number;
  /** Kitett kerület és padló-fal Ψ (6.5 képlet). */
  P: number;
  psiPF: number;
  /** Fűtött pince fala: z·P·UT,pf (6.6). */
  pinceFal?: { z: number; UTpf: number };
  kovetelmenyKod?: string;
  /** Az elemi követelményhez használt rétegtervi U (pl. talajon fekvő padló „átlagos rétegtervi”). */
  UElemi?: number;
}

export interface VonalHohid { tipus: 'vonal'; nev: string; l: number; psi: number; hatar: Hatar; }
export interface PontHohid { tipus: 'pont'; nev: string; chi: number; db: number; hatar: Hatar; }

export type HataroloElem = OpakElem | NyilaszaroElem | TalajElem | VonalHohid | PontHohid;

export interface ZonaBemenet {
  nev: string;
  /** Nettó kondicionált (hasznos) alapterület [m²]. */
  AN: number;
  /** Fűtött térfogat belméretekkel [m³]. */
  V: number;
  thetaF: number;
  thetaH: number;
  /** Lakóépület: nszüks = 0,5 1/h, 24 h használat. */
  nSzuks: number;
  /** Tömítetlenségből származó légcsere (2. függ. 2.4.). */
  nfilt: number;
  /** Átlagos belső hőnyereség [W/m²] (lakó: 5). */
  qb: number;
  /** Effektív hőtároló képesség [kJ/K]; vagy CmEffFajl [kJ/m²K] × AN. */
  CmEff?: number;
  CmEffFajl?: number;
  futesProgramozhato?: boolean;
  hutott?: boolean;
  /** Éjszakai többlet szellőztetés növekménye nyáron (2. függ. 2.3.), csak hűtési módban. */
  nEjjel?: number;
  /** Lakóépület: a természetes szellőzés a használati idő teljes hányadában (Δtterm/Δt = 1). */
  termSzellozesIdoarany?: number;
  elemek: HataroloElem[];
}

export interface HaviEredmeny {
  honap: number;
  thetaE: number;
  HtrD: number; HtrX: number; HtrT: number; Hszell: number;
  Qtr: number; Qszell: number; Qveszt: number;
  Qsd: number; Qb: number; Qnyer: number;
  gamma: number; eta: number; tau: number; a: number;
  QFnet: number;
  // hűtés
  HtrX_H: number; Hszell_H: number; Qlead: number; Qterh: number; gammaH: number; etaH: number; QHnet: number;
}

export interface ZonaEredmeny {
  nev: string;
  havi: HaviEredmeny[];
  QFnetEv: number;
  qFnet: number;
  QHnetEv: number;
  qHnet: number;
  CmEff: number;
  /** 6.53 – fajlagos hőveszteség-tényező [W/m³K]. */
  q: number;
  /** Becsült fűtési hőszükséglet a lefedési arányokhoz (6.54) [W]. */
  QFo: number;
  /** Hasznosított passzív szoláris nyereség fűtési hónapokban (Σ ηF·Qsd, ahol QF,net > 0) [kWh]. */
  QsdHasznositott: number;
  figyelmeztetesek: Figyelmeztetes[];
}

function bHonap(h: Hatar, honap: number): number {
  if (h.tipus === 'kulso') return 1;
  if (h.tipus === 'futetlen') return bErtek(h.b, honap);
  return honap >= 4 && honap <= 8 ? h.bNyar : h.bTel;
}

/** Hasznosítási tényező fűtésre (6.35–6.38). */
export function hasznositasFutes(gamma: number, a: number, Qnyer: number): number {
  if (gamma > 0 && Math.abs(gamma - 1) > 1e-9) return (1 - gamma ** a) / (1 - gamma ** (a + 1));
  if (gamma > 0) return a / (a + 1);
  return Qnyer > 0 ? 1 / gamma : 1;
}

/** Hasznosítási tényező hűtésre (6.43–6.45). */
export function hasznositasHutes(gammaH: number, a: number): number {
  if (gammaH > 0 && Math.abs(gammaH - 1) > 1e-9) return (1 - gammaH ** -a) / (1 - gammaH ** -(a + 1));
  if (gammaH > 0) return a / (a + 1);
  return 1;
}

function uvegFelulet(n: NyilaszaroElem): number {
  return n.Au ?? n.A * (1 - (n.keretarany ?? 0.3));
}

export function zonaHaviMerleg(z: ZonaBemenet, opciok?: { QsdFelulbiralas?: readonly number[] }): ZonaEredmeny {
  const fw: Figyelmeztetes[] = [];
  const CmEff = z.CmEff ?? (z.CmEffFajl ?? HOTAROLO_KEPESSEG.kozepes.ertek) * z.AN;
  if (z.CmEff === undefined && z.CmEffFajl === undefined) {
    fw.push({ kod: 'HOTAROLO_ALAPERTEK', uzenet: 'Hőtároló képesség nincs megadva; közepesen nehéz épület (190 kJ/m²K) alapértéket használtunk.', forras: '1. függ. 6.5. táblázat' });
  }
  const termArany = z.termSzellozesIdoarany ?? 1;

  // Állandó tagok
  let HtrT = 0;
  for (const e of z.elemek) {
    if (e.tipus === 'talaj') HtrT += e.A * e.UT + e.P * e.psiPF + (e.pinceFal ? e.pinceFal.z * e.P * e.pinceFal.UTpf : 0);
  }
  const HszellF = 0.35 * (z.nSzuks * termArany + z.nfilt) * z.V;

  const havi: HaviEredmeny[] = [];
  for (let m = 0; m < 12; m++) {
    const dt = HONAP_ORAK[m]!;
    const thetaE = KULSO_HOMERSEKLET_HAVI[m]!;
    let HtrD = 0, HtrX = 0, HtrX_H = 0, HtrD_H = 0;
    let Qsd = 0, QsdH = 0;
    for (const e of z.elemek) {
      if (e.tipus === 'opak') {
        const H = e.A * e.U * (1 + e.chi);
        if (e.hatar.tipus === 'kulso') { HtrD += H; HtrD_H += H; }
        else { HtrX += bHonap(e.hatar, m) * H; HtrX_H += bHonap(e.hatar, m) * H; }
      } else if (e.tipus === 'nyilaszaro') {
        const HF = e.A * (e.UFutes ?? e.U);
        const HH = e.A * e.U;
        if (e.hatar.tipus === 'kulso') { HtrD += HF; HtrD_H += HH; }
        else { HtrX += bHonap(e.hatar, m) * HF; HtrX_H += bHonap(e.hatar, m) * HH; }
        if (e.hatar.tipus === 'kulso') {
          const Gs = sugarzasiHozam(e.tajolas, e.hajlasszog, m);
          const F = e.Farny?.[m] ?? 1;
          const Au = uvegFelulet(e);
          const g = F_UVEGEZES_BEESESI * e.gn;
          Qsd += Au * g * 1 * F * Gs;
          QsdH += Au * g * (e.garnyH ?? 1) * F * Gs;
        }
      } else if (e.tipus === 'vonal') {
        const H = e.l * e.psi;
        if (e.hatar.tipus === 'kulso') { HtrD += H; HtrD_H += H; } else { HtrX += bHonap(e.hatar, m) * H; HtrX_H += bHonap(e.hatar, m) * H; }
      } else if (e.tipus === 'pont') {
        const H = e.chi * e.db;
        if (e.hatar.tipus === 'kulso') { HtrD += H; HtrD_H += H; } else { HtrX += bHonap(e.hatar, m) * H; HtrX_H += bHonap(e.hatar, m) * H; }
      }
    }
    if (opciok?.QsdFelulbiralas) { Qsd = opciok.QsdFelulbiralas[m]!; }

    // Fűtés
    const Qtr = ((HtrD + HtrX) * (z.thetaF - thetaE) + HtrT * (z.thetaF - KULSO_HOMERSEKLET_EVES)) * dt / 1000; // 6.7
    const Qszell = HszellF * (z.thetaF - thetaE) * dt / 1000; // 6.20
    const tau = CmEff / 3.6 / (HtrD + HtrX + HtrT + HszellF); // 6.34
    const sigma = sigmaFLako(!!z.futesProgramozhato, tau);
    const Qveszt = sigma * (Qtr + Qszell); // 6.33
    const Qb = z.AN * z.qb * dt / 1000; // 6.26
    const Qnyer = Qsd + Qb; // 6.29
    const gamma = Qnyer / Qveszt; // 6.31
    const a = HASZNOSITAS.a0 + tau / HASZNOSITAS.tau0; // 6.39
    const eta = hasznositasFutes(gamma, a, Qnyer);
    let QFnet = Qveszt - eta * Qnyer; // 6.40
    if ((gamma <= 0 && Qnyer > 0) || gamma > 2 || QFnet < 0) QFnet = 0;

    // Hűtés (nyári b, nyári éjszakai szellőztetés máj–szept, társított napvédő)
    const nyar = m >= 4 && m <= 8;
    const HszellH = HszellF + (nyar && z.nEjjel ? 0.35 * B_EJJEL * (7 / 24) * z.nEjjel * z.V : 0); // 6.11
    const Qlead = (((HtrD_H + HtrX_H) * (z.thetaH - thetaE) + HtrT * (z.thetaH - KULSO_HOMERSEKLET_EVES)) + HszellH * (z.thetaH - thetaE)) * dt / 1000;
    const Qterh = QsdH + Qb;
    const gammaH = Qterh / Qlead;
    const tauH = CmEff / 3.6 / (HtrD_H + HtrX_H + HtrT + HszellH);
    const aH = HASZNOSITAS.a0 + tauH / HASZNOSITAS.tau0;
    const etaH = hasznositasHutes(gammaH, aH);
    let QHnet = Qterh - etaH * Qlead; // 6.47
    if (1 / gammaH > 2 || QHnet < 0 || Qlead <= 0 && Qterh <= 0) QHnet = 0;

    havi.push({ honap: m + 1, thetaE, HtrD, HtrX, HtrT, Hszell: HszellF, Qtr, Qszell, Qveszt, Qsd, Qb, Qnyer, gamma, eta, tau, a, QFnet, HtrX_H, Hszell_H: HszellH, Qlead, Qterh, gammaH, etaH, QHnet });
  }

  const QFnetEv = havi.reduce((s, h) => s + h.QFnet, 0);
  const QHnetEv = z.hutott ? havi.reduce((s, h) => s + h.QHnet, 0) : 0;

  // 6.53 – fajlagos hőveszteség-tényező, november–március (Δt = 3624 h)
  const telHonapok = [10, 11, 0, 1, 2];
  let osszeg = 0, dtOssz = 0;
  for (const i of telHonapok) {
    const h = havi[i]!;
    osszeg += (h.Qtr - h.eta * h.Qsd) / (z.thetaF - h.thetaE);
    dtOssz += HONAP_ORAK[i]!;
  }
  const q = (1000 / (z.V * dtOssz)) * osszeg;

  // 6.54 – becsült fűtési hőszükséglet (nem rendszerméretezésre!)
  const h0 = havi[0]!;
  const QFo = (h0.HtrD + h0.HtrX + h0.HtrT + h0.Hszell) * (z.thetaF - -13);

  const QsdHasznositott = havi.reduce((s, h) => s + (h.QFnet > 0 ? h.eta * h.Qsd : 0), 0);

  return { nev: z.nev, havi, QFnetEv, qFnet: QFnetEv / z.AN, QHnetEv, qHnet: QHnetEv / z.AN, CmEff, q, QFo, QsdHasznositott, figyelmeztetesek: fw };
}
