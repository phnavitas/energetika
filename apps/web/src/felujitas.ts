/**
 * Felújítás-elemző: a projekt (meglévő állapot) másolatán intézkedéseket alkalmaz, mindegyiket a teljes 9/2023 ÉKM
 * számítással értékeli (nem egyszerűsített fokhíd-módszerrel), és energiaköltséget, megtérülést, nettó jelenértéket
 * számol. Az Excel „szerkezet beruházás optimalizáló” logikáját követi, a hibái javítva (lásd a felületi leírást).
 */
import { epuletSzamitas, szerkezetSablon as SS, type EpuletEredmeny } from '@mag/index';
import {
  atalakit, feluletNettoA, futesSzettbol, hmvSzettbol, szellozesSzettbol, sablonbolNyilaszaro, ujId,
  type Projekt, type Szerep,
} from './modell';
import { nyilaszaroSablon as NS } from '@mag/index';

// ---------------------------------------------------------------------------------------------
// Árak

export interface EnergiaArak {
  /** Földgáz: rezsicsökkentett sáv [Ft/kWh égéshő], sávhatár [kWh/év], sáv feletti ár [Ft/kWh], alapdíj [Ft/év]. */
  gazSav: number; gazSavHatar: number; gazFelett: number; gazAlapdij: number;
  /** Villamos energia (A1): sáv [Ft/kWh], sávhatár [kWh/év], felette [Ft/kWh]; hőszivattyús (H) tarifa [Ft/kWh]. */
  villSav: number; villSavHatar: number; villFelett: number; villH: number;
  /** H-tarifa alkalmazása a hőszivattyús fűtés villamos energiájára. */
  hTarifa: boolean;
  tavho: number; /** Távhő alapdíj [Ft/légm³/év]. */ tavhoAlapdij?: number; tuzifa: number; pellet: number; olaj: number; szen: number;
  /** Napelemes többlet visszvásárlási ára [Ft/kWh]; a saját fogyasztást kiváltó rész a villamos ár szerint értékelődik. */
  pvExport: number;
  /** A termelés saját felhasználási aránya (0..1). */
  pvOnfogyasztas: number;
  forras: string;
}

export interface Penzugy {
  /** Kalkulációs kamatláb (diszkontráta) [%/év], energiaár-emelkedés [%/év], vizsgált időszak [év], ÁFA [%]. */
  kamat: number; energiaArNovekedes: number; idoszak: number; afa: number;
}

// ---------------------------------------------------------------------------------------------
// Intézkedések

export type Intezkedes =
  | { id: string; tipus: 'szigeteles'; nev: string; aktiv: boolean; szerep: Szerep; retegrendIds: string[]; anyagId: string; dCm: number; arAlap: number; arCm: number }
  | { id: string; tipus: 'nyilaszaro'; nev: string; aktiv: boolean; sablonKod: string; arM2: number; csakAblak: boolean }
  | { id: string; tipus: 'futes'; nev: string; aktiv: boolean; szettKod: string; ar: number }
  | { id: string; tipus: 'hmv'; nev: string; aktiv: boolean; szettKod: string; ar: number }
  | { id: string; tipus: 'szellozes'; nev: string; aktiv: boolean; szettKod: string; ar: number }
  | { id: string; tipus: 'napelem'; nev: string; aktiv: boolean; kWp: number; arKWp: number; hajlasszog: number; tajolas: 'D' | 'DK_DNy' | 'K_Ny' }
  | { id: string; tipus: 'legzaras'; nev: string; aktiv: boolean; ar: number };

export interface FelujitasBeallitas { arak: EnergiaArak; penzugy: Penzugy; intezkedesek: Intezkedes[] }

/** Az intézkedés által érintett mennyiség (m², db, kWp). */
export function mennyiseg(p: Projekt, m: Intezkedes): { ertek: number; egyseg: string } {
  if (m.tipus === 'szigeteles') {
    const A = p.feluletek.filter((f) => f.retegrendId && m.retegrendIds.includes(f.retegrendId)).reduce((s, f) => s + (f.fajta === 'padlo' ? f.A ?? 0 : feluletNettoA(p, f)), 0);
    return { ertek: A, egyseg: 'm²' };
  }
  if (m.tipus === 'nyilaszaro') {
    const A = p.feluletek.filter((f) => f.fajta === 'nyilaszaro' && (!m.csakAblak || p.nyilaszarok.find((n) => n.id === f.nyilaszaroId)?.kovetelmenyKod !== 'ajto')).reduce((s, f) => s + feluletNettoA(p, f), 0);
    return { ertek: A, egyseg: 'm²' };
  }
  if (m.tipus === 'napelem') return { ertek: m.kWp, egyseg: 'kWp' };
  return { ertek: 1, egyseg: 'db' };
}

/** Nettó beruházási költség [Ft]. */
export function beruhazas(p: Projekt, m: Intezkedes): number {
  const q = mennyiseg(p, m).ertek;
  switch (m.tipus) {
    case 'szigeteles': return q * (m.arAlap + m.arCm * m.dCm);
    case 'nyilaszaro': return q * m.arM2;
    case 'napelem': return m.kWp * m.arKWp;
    default: return m.ar;
  }
}

/** Az intézkedés alkalmazása a projekt másolatán. */
export function alkalmaz(p: Projekt, m: Intezkedes): void {
  switch (m.tipus) {
    case 'szigeteles': {
      for (const r of p.retegrendek) {
        if (!m.retegrendIds.includes(r.id)) continue;
        const uj = { id: ujId(), anyagId: m.anyagId, dCm: m.dCm };
        // Padlónál az új hőszigetelés a burkolat és az új aljzat alá kerül, egyébként a külső (hideg) oldalra.
        if (r.szerep === 'padlo') r.retegek.splice(Math.min(2, r.retegek.length), 0, uj);
        else r.retegek.push(uj);
      }
      break;
    }
    case 'nyilaszaro': {
      const s = NS.NYILASZARO_SABLONOK.find((x) => x.kod === m.sablonKod);
      if (!s) break;
      for (const n of p.nyilaszarok) {
        if (m.csakAblak && n.kovetelmenyKod === 'ajto') continue;
        const uj = sablonbolNyilaszaro(s, n);
        Object.assign(n, { ...uj, id: n.id, nev: n.nev, szelesseg: n.szelesseg, magassag: n.magassag, kovetelmenyKod: n.kovetelmenyKod });
        delete n.uwKezi;
      }
      // Új nyílászárók jó légzárással.
      p.zona.legzaras = p.zona.legzaras === 'kivalo' ? 'kivalo' : 'jo';
      break;
    }
    case 'futes': p.gepeszet.futes = [futesSzettbol(m.szettKod)]; break;
    case 'hmv': p.gepeszet.hmv = hmvSzettbol(m.szettKod); break;
    case 'szellozes': p.gepeszet.szellozes = szellozesSzettbol(m.szettKod); break;
    case 'napelem': p.gepeszet.napelem.push({ id: ujId(), nev: 'Napelem (felújítás)', kWp: m.kWp, tajolas: m.tajolas, hajlasszog: m.hajlasszog, modszer: 'tabla' }); break;
    case 'legzaras': p.zona.legzaras = 'kivalo'; break;
  }
}

// ---------------------------------------------------------------------------------------------
// Energiaköltség

export interface Koltseg { osszes: number; tetelek: { nev: string; kWh: number; Ft: number }[] }

function savos(kWh: number, sav: number, hatar: number, felett: number) {
  return Math.min(kWh, hatar) * sav + Math.max(kWh - hatar, 0) * felett;
}

/** Éves energiaköltség (bruttó Ft) a végenergia-igényből és a napelemes termelésből. */
export function energiaKoltseg(e: EpuletEredmeny, a: EnergiaArak, V = 0): Koltseg {
  const tetelek: Koltseg['tetelek'] = [];
  // Villamos: a hőszivattyús fűtés H-tarifán (ha választott), a többi A1 sávosan.
  let villA1 = 0, villH = 0;
  for (const r of e.rendszerek) for (const t of r.tetelek) {
    if (t.energiahordozo !== 'villamos') continue;
    const hsz = r.cel === 'futes' && r.tetelek.some((x) => x.energiahordozo === 'kornyezeti_ho') && t.jelleg === 'ho';
    if (a.hTarifa && hsz) villH += t.Q; else villA1 += t.Q;
  }
  const pv = e.napelem.reduce((s, n) => s + n.W, 0);
  const onfogy = Math.min(pv * a.pvOnfogyasztas, villA1 + villH);
  const levonA1 = Math.min(onfogy, villA1), levonH = onfogy - levonA1;
  const villKoltseg = savos(villA1 - levonA1, a.villSav, a.villSavHatar, a.villFelett) + (villH - levonH) * a.villH;
  if (villA1 + villH > 0) tetelek.push({ nev: `Villamos energia${villH ? ' (ebből H-tarifa)' : ''}`, kWh: villA1 + villH - onfogy, Ft: villKoltseg });
  const v = e.indikatorok.vegenergia;
  // A gázszámla égéshőre (MJ) szól: a rendszerek égéshő-alapú végenergiáját összegezzük.
  const gaz = e.rendszerek.reduce((s, r) => s + r.tetelek.filter((t) => t.energiahordozo === 'fosszilis_gaz' || t.energiahordozo === 'bio_gaz').reduce((x, t) => x + t.Q, 0), 0);
  if (gaz > 0) tetelek.push({ nev: 'Földgáz', kWh: gaz, Ft: savos(gaz, a.gazSav, a.gazSavHatar, a.gazFelett) + a.gazAlapdij });
  if ((v.tavho ?? 0) > 0) tetelek.push({ nev: 'Távhő (hődíj + alapdíj)', kWh: v.tavho!, Ft: v.tavho! * a.tavho + (a.tavhoAlapdij ?? 0) * V });
  const bio = (v.bio_szilard ?? 0) + (v.bio_szilard_korszeru ?? 0);
  if (bio > 0) tetelek.push({ nev: 'Tűzifa, pellet', kWh: bio, Ft: bio * a.tuzifa });
  if ((v.fosszilis_folyekony ?? 0) > 0) tetelek.push({ nev: 'Fűtőolaj', kWh: v.fosszilis_folyekony!, Ft: v.fosszilis_folyekony! * a.olaj });
  if ((v.fosszilis_szilard ?? 0) > 0) tetelek.push({ nev: 'Szén', kWh: v.fosszilis_szilard!, Ft: v.fosszilis_szilard! * a.szen });
  const tobblet = pv - onfogy;
  if (tobblet > 0) tetelek.push({ nev: 'Napelemes többlet visszavásárlása', kWh: -tobblet, Ft: -tobblet * a.pvExport });
  return { osszes: tetelek.reduce((s, x) => s + x.Ft, 0), tetelek };
}

// ---------------------------------------------------------------------------------------------
// Pénzügy

/** Nettó jelenérték: −I + Σ S·(1+g)^t/(1+i)^t, t = 1..T. */
export function npv(I: number, S: number, f: Penzugy): number {
  const i = f.kamat / 100, g = f.energiaArNovekedes / 100;
  let s = -I;
  for (let t = 1; t <= f.idoszak; t++) s += (S * (1 + g) ** (t - 1)) / (1 + i) ** t;
  return s;
}
/** Diszkontált megtérülési idő [év]; null, ha az időszakon belül nem térül meg. */
export function megterules(I: number, S: number, f: Penzugy): number | null {
  if (I <= 0) return 0;
  const i = f.kamat / 100, g = f.energiaArNovekedes / 100;
  let s = -I;
  for (let t = 1; t <= 60; t++) {
    const d = (S * (1 + g) ** (t - 1)) / (1 + i) ** t;
    if (s + d >= 0) return t - 1 + (-s) / d;
    s += d;
  }
  return null;
}
/** Annuitás: a beruházás egyenletes éves terhe a kamatláb és az időszak mellett. */
export function annuitas(I: number, f: Penzugy): number {
  const i = f.kamat / 100;
  return i === 0 ? I / f.idoszak : (I * i) / (1 - (1 + i) ** -f.idoszak);
}

// ---------------------------------------------------------------------------------------------
// Értékelés

export interface Allapot { e: EpuletEredmeny | null; hiba: string | null; koltseg: Koltseg | null }

export function szamol(p: Projekt, a: EnergiaArak): Allapot {
  const t = atalakit(p);
  if (!t.bemenet) return { e: null, hiba: t.hibak[0] ?? 'A projekt nem számolható.', koltseg: null };
  try {
    const e = epuletSzamitas(t.bemenet);
    return { e, hiba: null, koltseg: energiaKoltseg(e, a, t.geometria.V) };
  } catch (err) { return { e: null, hiba: (err as Error).message, koltseg: null }; }
}

export function alkalmazva(p: Projekt, lista: Intezkedes[]): Projekt {
  const q = structuredClone(p);
  for (const m of lista) alkalmaz(q, m);
  return q;
}

export interface Ertekeles { I: number; Ibrutto: number; megtakaritas: number; npv: number; megterules: number | null; egyszeru: number | null; allapot: Allapot }

export function ertekel(p: Projekt, alap: Allapot, lista: Intezkedes[], b: FelujitasBeallitas): Ertekeles {
  const I = lista.reduce((s, m) => s + beruhazas(p, m), 0);
  const Ib = I * (1 + b.penzugy.afa / 100);
  const allapot = szamol(alkalmazva(p, lista), b.arak);
  const S = alap.koltseg && allapot.koltseg ? alap.koltseg.osszes - allapot.koltseg.osszes : 0;
  return { I, Ibrutto: Ib, megtakaritas: S, npv: npv(Ib, S, b.penzugy), megterules: megterules(Ib, S, b.penzugy), egyszeru: S > 0 ? Ib / S : null, allapot };
}

/** Optimális hőszigetelés-vastagság keresése: NPV a vastagság függvényében. */
export function vastagsagGorbe(p: Projekt, alap: Allapot, m: Extract<Intezkedes, { tipus: 'szigeteles' }>, b: FelujitasBeallitas, lepesek = [4, 6, 8, 10, 12, 14, 16, 18, 20, 25, 30]) {
  return lepesek.map((d) => {
    const x = { ...m, dCm: d };
    const r = ertekel(p, alap, [x], b);
    return { d, npv: r.npv, I: r.Ibrutto, S: r.megtakaritas, U: null as number | null };
  });
}

// ---------------------------------------------------------------------------------------------
// Alapértelmezett intézkedések a projekt szerkezeteiből

const SZIG_SZEREP: Partial<Record<Szerep, { anyagId: string; dCm: number; nev: string }>> = {
  fal: { anyagId: 'eps80_grafit', dCm: 15, nev: 'Homlokzati hőszigetelés (grafitos EPS)' },
  padlas: { anyagId: 'celluloz_befujt', dCm: 25, nev: 'Padlásfödém hőszigetelés (befújt cellulóz)' },
  teto: { anyagId: 'asvanyiyapot_szarufa', dCm: 20, nev: 'Tetőtér hőszigetelés (ásványgyapot)' },
  pincefodem: { anyagId: 'kozetgyapot_homlokzati', dCm: 12, nev: 'Pincefödém alsó hőszigetelés (kőzetgyapot)' },
  padlo: { anyagId: 'eps100_grafit', dCm: 10, nev: 'Padló hőszigetelés (bontással, új aljzattal)' },
};

export function alapIntezkedesek(p: Projekt, ar: (kod: string, alap: number) => number): Intezkedes[] {
  const ki: Intezkedes[] = [];
  for (const [szerep, d] of Object.entries(SZIG_SZEREP) as [Szerep, NonNullable<(typeof SZIG_SZEREP)[Szerep]>][]) {
    const ids = p.retegrendek.filter((r) => r.szerep === szerep && p.feluletek.some((f) => f.retegrendId === r.id)).map((r) => r.id);
    if (!ids.length) continue;
    ki.push({ id: ujId(), tipus: 'szigeteles', nev: d.nev, aktiv: true, szerep, retegrendIds: ids, anyagId: d.anyagId, dCm: d.dCm, arAlap: ar(`${szerep}_alap`, 0), arCm: ar(`${szerep}_cm`, 0) });
  }
  if (p.nyilaszarok.length) ki.push({ id: ujId(), tipus: 'nyilaszaro', nev: 'Ablakcsere háromrétegű üvegezésű műanyag ablakra', aktiv: true, sablonKod: 'pvc_3r', arM2: ar('ablak_3r', 0), csakAblak: true });
  ki.push({ id: ujId(), tipus: 'futes', nev: 'Kondenzációs gázkazán', aktiv: false, szettKod: 'gaz_kondenz_radiator', ar: ar('kondenz_kazan', 0) });
  ki.push({ id: ujId(), tipus: 'futes', nev: 'Levegő-víz hőszivattyú (radiátoros)', aktiv: false, szettKod: 'hsz_levego_viz_radiator', ar: ar('hoszivattyu', 0) });
  ki.push({ id: ujId(), tipus: 'szellozes', nev: 'Hővisszanyerős szellőzés', aktiv: false, szettKod: 'kozponti_hv', ar: ar('hrv', 0) });
  ki.push({ id: ujId(), tipus: 'napelem', nev: 'Napelem 5 kWp', aktiv: false, kWp: 5, arKWp: ar('napelem_kwp', 0), hajlasszog: 35, tajolas: 'D' });
  return ki;
}

export const SZIG_SABLON_REF = SS;
