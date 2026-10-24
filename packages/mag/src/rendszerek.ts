/**
 * Épülettechnikai rendszerek – fűtés (8. fejezet) és HMV (9. fejezet), egyszerűsített módszer.
 * Kimenet: energiahordozónkénti végenergia [kWh/év], amiből az indikátorok számolnak (14. fejezet).
 */
import { interpolal, type Figyelmeztetes, type TablazatOszlop } from './interpolacio.js';
import type { Energiahordozo } from './tablak/sulyozo.js';
import * as T from './tablak/gepeszet.js';
import * as H from './tablak/hutes.js';
import type * as Prof from './tablak/profilok.js';
import { fszab as P_fszab } from './tablak/profilok.js';

export interface VegenergiaTetel {
  /** Energiahordozó a súlyozó tényezőhöz (7. melléklet). */
  energiahordozo: Energiahordozo;
  /** Végenergia [kWh/év]. Égéshőre vonatkozik; a súlyozáshoz Ffé/éh-val szorozzuk (14.2). */
  Q: number;
  /** 'ho': hőtermelő tüzelőanyag/áram; 'seged': villamos segédenergia; 'kornyezeti': hőszivattyú által hasznosított környezeti hő. */
  jelleg: 'ho' | 'seged' | 'kornyezeti';
  megnevezes: string;
}

export interface RendszerEredmeny {
  nev: string;
  cel: 'futes' | 'hmv' | 'szellozes' | 'hutes' | 'vilagitas';
  tetelek: VegenergiaTetel[];
  reszletek: Record<string, number>;
  figyelmeztetesek: Figyelmeztetes[];
}

function oszlop<T extends { forras: string; A: readonly number[] }>(t: T, kulcs: keyof T & string): TablazatOszlop {
  return { forras: `${t.forras}, ${kulcs}`, x: t.A, y: t[kulcs] as unknown as (number | null)[] };
}

// ---------------------------------------------------------------------------------------------
// Hőtermelők

export type FutesiHotermelo =
  /** 8.3.1.1 – ErP címkés, nem elektromos kazán: εF = 1/ηs; segédenergia nem számolandó. */
  | { tipus: 'kazan_erp'; energiahordozo: Energiahordozo; etaS: number }
  /** 8.3.1.2 – ErP hatályán kívüli folyékony/gáz kazán, 8.1./8.2. táblázat. */
  | { tipus: 'kazan_tabla'; kazan: 'allando' | 'alacsony' | 'kondenzacios'; hely: 'belul' | 'kivul'; energiahordozo: Energiahordozo }
  /** 8.3. és 8.4. táblázat – szilárd és biomassza kazán. */
  | { tipus: 'szilard_kazan'; kazan: 'vegyes' | 'tuzifa' | 'pellet' | 'faelgazosito'; energiahordozo: Energiahordozo }
  /** 8.3.2.1 – ErP címkés elektromos hőszivattyú: εF = 1/(2,5·ηs); segédenergia nem szabad. */
  | { tipus: 'hoszivattyu_erp'; etaS: number }
  /** 8.3.2.2 – ErP hatályán kívüli hőszivattyú, 8.5. táblázat (vagy SCOP: εF = 1/SCOP). */
  | { tipus: 'hoszivattyu_tabla'; forras: 'viz_viz' | 'talaj_viz' | 'levego_viz' | 'tavozo_levego_viz'; hofok: '55/45' | '35/28' }
  | { tipus: 'hoszivattyu_levego_levego' }
  | { tipus: 'hoszivattyu_scop'; SCOP: number }
  /** 8.3.3 – távhő. */
  | { tipus: 'tavho'; hokozpontokSzama?: number }
  /** 8.7. táblázat. */
  | { tipus: 'egyeb'; kod: (typeof T.EGYEB_FUTES_EPSZILON_F)[number]['kod'] }
  /** Kézi megadás (részletes módszer, MSZ EN 15316-4-x). */
  | { tipus: 'kezi'; epszilon: number; energiahordozo: Energiahordozo; segedKWh?: number; hoszivattyu?: boolean };

interface HotermeloAdat { eps: number; energiahordozo: Energiahordozo; WtermFajl: number; WtermAbsz: number; hoszivattyu: boolean; leiras: string; }

function futesiHotermelo(h: FutesiHotermelo, Arszr: number, fw: Figyelmeztetes[]): HotermeloAdat {
  switch (h.tipus) {
    case 'kazan_erp':
      return { eps: 1 / h.etaS, energiahordozo: h.energiahordozo, WtermFajl: 0, WtermAbsz: 0, hoszivattyu: false, leiras: `ErP kazán ηs = ${(h.etaS * 100).toFixed(0)}%` };
    case 'kazan_tabla': {
      const t = h.hely === 'kivul' ? T.KAZAN_KIVUL : T.KAZAN_BELUL;
      return { eps: interpolal(oszlop(t, h.kazan), Arszr, fw), energiahordozo: h.energiahordozo, WtermFajl: interpolal(oszlop(t, 'segedenergia'), Arszr, fw), WtermAbsz: 0, hoszivattyu: false, leiras: `${h.kazan} kazán, fűtött téren ${h.hely === 'kivul' ? 'kívül' : 'belül'}` };
    }
    case 'szilard_kazan': {
      const sor = h.kazan === 'vegyes' ? 'vegyes' : h.kazan === 'pellet' ? 'pellet' : 'tuzifa_faelgazosito';
      return { eps: T.SZILARD_KAZAN_EPSZILON_F[h.kazan], energiahordozo: h.energiahordozo, WtermFajl: interpolal(oszlop(T.SZILARD_KAZAN_SEGED, sor), Arszr, fw), WtermAbsz: 0, hoszivattyu: false, leiras: `${h.kazan} kazán` };
    }
    case 'hoszivattyu_erp':
      return { eps: 1 / (2.5 * h.etaS), energiahordozo: 'villamos', WtermFajl: 0, WtermAbsz: 0, hoszivattyu: true, leiras: `ErP hőszivattyú ηs = ${(h.etaS * 100).toFixed(0)}%` };
    case 'hoszivattyu_tabla':
      return { eps: T.HOSZIVATTYU_EPSZILON_F[h.forras][h.hofok], energiahordozo: 'villamos', WtermFajl: 0, WtermAbsz: 0, hoszivattyu: true, leiras: `${h.forras} hőszivattyú ${h.hofok}` };
    case 'hoszivattyu_levego_levego':
      return { eps: T.HOSZIVATTYU_EPSZILON_F.levego_levego, energiahordozo: 'villamos', WtermFajl: 0, WtermAbsz: 0, hoszivattyu: true, leiras: 'levegő/levegő hőszivattyú' };
    case 'hoszivattyu_scop':
      return { eps: 1 / h.SCOP, energiahordozo: 'villamos', WtermFajl: 0, WtermAbsz: 0, hoszivattyu: true, leiras: `hőszivattyú SCOP = ${h.SCOP}` };
    case 'tavho':
      return { eps: T.TAVHO_FUTES.epszilonF, energiahordozo: 'tavho', WtermFajl: 0, WtermAbsz: T.TAVHO_FUTES.segedenergiaHokozpontonkentKWh * (h.hokozpontokSzama ?? 1), hoszivattyu: false, leiras: 'távhő' };
    case 'egyeb': {
      const s = T.EGYEB_FUTES_EPSZILON_F.find((x) => x.kod === h.kod)!;
      return { eps: s.eF, energiahordozo: s.energiahordozo as Energiahordozo, WtermFajl: 0, WtermAbsz: 0, hoszivattyu: false, leiras: s.megnevezes };
    }
    case 'kezi':
      return { eps: h.epszilon, energiahordozo: h.energiahordozo, WtermFajl: 0, WtermAbsz: h.segedKWh ?? 0, hoszivattyu: !!h.hoszivattyu, leiras: 'kézi megadás' };
  }
}

// ---------------------------------------------------------------------------------------------
// Fűtési alrendszer

export type ElosztasHely = 'belul' | 'kivul' | 'nincs';

export interface FutesiAlrendszer {
  nev: string;
  /** Rendszer-alapterület [m²]. */
  Arszr: number;
  /** A zóna nettó fűtési igényének az alrendszer által fedezett hányada (0..1); bivalens rendszernél < 1. */
  lefedes?: number;
  hotermelo: FutesiHotermelo;
  /** εF,szab – a szabalyozasiTenyezo() segédfüggvénnyel vagy a 8.13./8.14. táblázatból. */
  epszilonSzab: number;
  elosztas: { hely: ElosztasHely; elore: number; vissza: number };
  /** Puffertároló (8.15.); null: nincs. */
  tarolo: null | { hely: 'belul' | 'kivul'; elore: number; vissza: number };
  /** Keringtető szivattyú oszlopa a 8.16. táblázatban; null: nincs (pl. egyedi fűtés). */
  szivattyu: null | Exclude<keyof typeof T.FUTES_SZIVATTYU, 'forras' | 'A'>;
}

/** Hőfoklépcső szerinti interpoláció a közepes hőmérsékletkülönbségen (7. fejezet). */
function hofokInterpolal(sorok: Record<T.Hofoklepcso, number>, elore: number, vissza: number): number {
  const pontok = T.HOFOKLEPCSOK.map((h) => {
    const [e, v] = h.split('/').map(Number) as [number, number];
    return { dT: T.kozepesHomersekletKulonbseg(e, v), y: sorok[h] };
  }).sort((a, b) => a.dT - b.dT);
  return interpolal({ forras: 'hőfoklépcső', x: pontok.map((p) => p.dT), y: pontok.map((p) => p.y) }, T.kozepesHomersekletKulonbseg(elore, vissza));
}

export function futesiRendszer(a: FutesiAlrendszer, QFnetZona: number, AN: number): RendszerEredmeny {
  const fw: Figyelmeztetes[] = [];
  const lef = a.lefedes ?? 1;
  const QFnetFR = QFnetZona * lef;
  const h = futesiHotermelo(a.hotermelo, a.Arszr, fw);

  // 8.5 elosztás
  let qSzall = 0;
  if (a.elosztas.hely !== 'nincs') {
    const t = a.elosztas.hely === 'kivul' ? T.ELOSZTAS_KIVUL : T.ELOSZTAS_BELUL;
    const sorok = Object.fromEntries(T.HOFOKLEPCSOK.map((hf) => [hf, interpolal(oszlop(t, hf), a.Arszr, fw)])) as Record<T.Hofoklepcso, number>;
    qSzall = hofokInterpolal(sorok, a.elosztas.elore, a.elosztas.vissza);
  }
  const QSzall = qSzall * a.Arszr * lef;

  // 8.7 tárolás
  let qTar = 0, wTar = 0;
  if (a.tarolo) {
    const t = T.FUTES_TAROLO;
    const k55 = a.tarolo.hely === 'belul' ? 'belul_55_45' : 'kivul_55_45';
    const k35 = a.tarolo.hely === 'belul' ? 'belul_35_28' : 'kivul_35_28';
    const y55 = interpolal(oszlop(t, k55), a.Arszr, fw);
    const y35 = interpolal(oszlop(t, k35), a.Arszr, fw);
    const dT55 = T.kozepesHomersekletKulonbseg(55, 45), dT35 = T.kozepesHomersekletKulonbseg(35, 28);
    const dT = T.kozepesHomersekletKulonbseg(a.tarolo.elore, a.tarolo.vissza);
    qTar = y35 + ((y55 - y35) * (dT - dT35)) / (dT55 - dT35);
    if (a.hotermelo.tipus === 'szilard_kazan') qTar *= t.szilardSzorzo;
    wTar = interpolal(oszlop(t, 'segedenergia'), a.Arszr, fw);
  }
  const QTar = qTar * a.Arszr * lef;
  const WTar = wTar * a.Arszr * lef;

  // 8.8 szivattyú
  const wSziv = a.szivattyu ? interpolal(oszlop(T.FUTES_SZIVATTYU, a.szivattyu), a.Arszr, fw) : 0;
  const WSziv = wSziv * a.Arszr * lef;
  const WTerm = h.WtermFajl * a.Arszr * lef + h.WtermAbsz * lef;

  // 8.2
  const Qleadott = QFnetFR * a.epszilonSzab + QSzall + QTar;
  const QFveg = Qleadott * h.eps;

  const tetelek: VegenergiaTetel[] = [{ energiahordozo: h.energiahordozo, Q: QFveg, jelleg: 'ho', megnevezes: `Fűtés – ${h.leiras}` }];
  if (h.hoszivattyu) {
    const Qkorny = QFveg * (1 / h.eps - 1);
    if (h.eps <= 0.37) tetelek.push({ energiahordozo: 'kornyezeti_ho', Q: Qkorny, jelleg: 'kornyezeti', megnevezes: 'Fűtés – hőszivattyú környezeti hő' });
    else fw.push({ kod: 'HSZ_NEM_MEGUJULO', uzenet: `εF = ${h.eps.toFixed(3)} > 0,37: a hőszivattyú környezeti hője nem vehető figyelembe megújulóként.`, forras: '1. függ. 14.3' });
  }
  const WFveg = WSziv + WTar + WTerm;
  if (WFveg > 0) tetelek.push({ energiahordozo: 'villamos', Q: WFveg, jelleg: 'seged', megnevezes: 'Fűtés – villamos segédenergia' });

  return {
    nev: a.nev, cel: 'futes', tetelek, figyelmeztetesek: fw,
    reszletek: { QFnetFR, epszilonSzab: a.epszilonSzab, qSzall, QSzall, qTar, QTar, epszilonF: h.eps, Qleadott, QFveg, wSziv, WSziv, WTar, WTerm, WFveg, AN },
  };
}

/** εF,szab összeállítása a 8.10.–8.12. táblázat választásaiból (vizes fűtés). */
export function szabalyozasiTenyezo(p: {
  alap: keyof typeof T.SZAB_ALAP;
  holeado:
    | { tipus: 'szabad'; hofok: '90/70' | '70/55' | '55/45' | '45/35'; egycsoves?: boolean; ventilatoros?: boolean; hatarolo: keyof typeof T.SZAB_SZABAD.hatarolo }
    | { tipus: 'beagyazott'; rendszer: keyof typeof T.SZAB_BEAGYAZOTT.rendszer; hatarolo: keyof typeof T.SZAB_BEAGYAZOTT.hatarolo };
  helyiseg: keyof typeof T.SZAB_HELYISEG;
  beszabalyozas:
    | { csovek: 'egycsoves'; mod: keyof typeof T.SZAB_BESZABALYOZAS.egycsoves }
    | { csovek: 'ketcsoves'; mod: keyof typeof T.SZAB_BESZABALYOZAS.ketcsoves; holeadokTobbMint10: boolean };
}): { epszilon: number; tagok: number[] } {
  const e0 = T.SZAB_ALAP[p.alap].ertek;
  let e1: number, e2: number;
  if (p.holeado.tipus === 'szabad') {
    if (p.holeado.ventilatoros) e1 = T.SZAB_SZABAD.ventilatoros_radiator;
    else if (p.holeado.egycsoves) {
      const k = p.holeado.hofok as keyof typeof T.SZAB_SZABAD.hofoklepcso_egycsoves;
      e1 = T.SZAB_SZABAD.hofoklepcso_egycsoves[k] ?? T.SZAB_SZABAD.hofoklepcso_egycsoves['70/55'];
    } else e1 = T.SZAB_SZABAD.hofoklepcso_ketcsoves[p.holeado.hofok];
    e2 = T.SZAB_SZABAD.hatarolo[p.holeado.hatarolo];
  } else {
    e1 = T.SZAB_BEAGYAZOTT.rendszer[p.holeado.rendszer];
    e2 = T.SZAB_BEAGYAZOTT.hatarolo[p.holeado.hatarolo];
  }
  const e3 = T.SZAB_HELYISEG[p.helyiseg];
  const e4 = p.beszabalyozas.csovek === 'egycsoves'
    ? T.SZAB_BESZABALYOZAS.egycsoves[p.beszabalyozas.mod]
    : T.SZAB_BESZABALYOZAS.ketcsoves[p.beszabalyozas.mod][p.beszabalyozas.holeadokTobbMint10 ? 1 : 0]!;
  return { epszilon: e0 + e1 + e2 + e3 + e4, tagok: [e0, e1, e2, e3, e4] };
}

// ---------------------------------------------------------------------------------------------
// HMV

export type HmvHotermelo =
  | { tipus: 'erp'; energiahordozo: Energiahordozo; etaWH: number }
  | { tipus: 'erp_elektromos'; etaWH: number; hoszivattyu: boolean }
  | { tipus: 'kazan_tabla'; kazan: 'allando' | 'alacsony' | 'kondenzacios' | 'kombi_AF' | 'kombi_KT' | 'kond_kombi_AF' | 'kond_kombi_KT'; energiahordozo: Energiahordozo }
  | { tipus: 'szilard'; kazan: 'vegyes' | 'tuzifa' | 'pellet' | 'faelgazosito'; energiahordozo: Energiahordozo }
  | { tipus: 'elektromos_tabla'; kod: keyof typeof T.HMV_ELEKTROMOS_EPSZILON }
  | { tipus: 'egyeb'; kod: keyof typeof T.HMV_EGYEB }
  | { tipus: 'tavho'; hokozpontokSzama?: number }
  | { tipus: 'kezi'; epszilon: number; energiahordozo: Energiahordozo; segedKWh?: number; hoszivattyu?: boolean };

export interface HmvRendszer {
  nev: string;
  Arszr: number;
  /** Nettó HMV igény [kWh/m²év] (2. függ. 2.2.; lakóépületre kötelező). */
  qHMV: number;
  /** Az igény fajlagosításához használt hasznos alapterület. */
  AN: number;
  lefedes?: number;
  hotermelo: HmvHotermelo;
  tarolo: null | { tipus: keyof typeof T.HMV_TAROLO.belul; hely: 'belul' | 'kivul' };
  elosztas: { cirkulacio: boolean; hely: 'belul' | 'kivul' };
  cirkSzivattyu: null | 'ismeretlen' | 'EEI_023' | 'EEI_017';
  /** Napkollektor egyszerűsített módszerrel (9.2.1.1) – a 9.1/9.2 táblázatból számolt Qkoll,max·k [kWh/év]. */
  napkollektorKWh?: number;
  napkollektorFelulet?: number;
  /** Napkollektor a 9.2.1.1 egyszerűsített módszerrel (a kollektorKWh/Felulet helyett): hajlásszög αm [°], tájolás γm [°] (K = −90, D = 0, Ny = +90). */
  napkollektor?: { tipus: 'sik' | 'vakuum'; felulet: number; hajlasszog: number; tajolasFok: number };
}

export function hmvRendszer(r: HmvRendszer): RendszerEredmeny {
  const fw: Figyelmeztetes[] = [];
  const lef = r.lefedes ?? 1;
  const QHMVnet = r.qHMV * r.AN * lef;

  let eps: number, eh: Energiahordozo, Wterm = 0, hsz = false, leiras: string;
  const h = r.hotermelo;
  switch (h.tipus) {
    case 'erp': eps = 1 / h.etaWH; eh = h.energiahordozo; leiras = `ErP vízmelegítő ηwh = ${(h.etaWH * 100).toFixed(0)}%`; break;
    case 'erp_elektromos': eps = 1 / (2.5 * h.etaWH); eh = 'villamos'; hsz = h.hoszivattyu; leiras = `ErP elektromos vízmelegítő ηwh = ${(h.etaWH * 100).toFixed(0)}%`; break;
    case 'kazan_tabla': {
      eps = interpolal(oszlop(T.HMV_KAZAN, h.kazan), r.Arszr, fw); eh = h.energiahordozo;
      const kombi = h.kazan.includes('kombi');
      Wterm = interpolal(oszlop(T.HMV_KAZAN, kombi ? 'seged_kombi' : 'seged_mas'), r.Arszr, fw) * r.Arszr * lef;
      leiras = `${h.kazan} kazán HMV`;
      break;
    }
    case 'szilard': {
      eps = T.HMV_SZILARD_EPSZILON[h.kazan]; eh = h.energiahordozo;
      const sor = h.kazan === 'vegyes' ? 'vegyes' : h.kazan === 'pellet' ? 'pellet' : 'tuzifa_faelgazosito';
      Wterm = interpolal(oszlop(T.SZILARD_KAZAN_SEGED, sor), r.Arszr, fw) * r.Arszr * lef;
      leiras = `${h.kazan} kazán HMV`;
      break;
    }
    case 'elektromos_tabla': eps = T.HMV_ELEKTROMOS_EPSZILON[h.kod]; eh = 'villamos'; hsz = h.kod.startsWith('hsz'); leiras = h.kod; break;
    case 'egyeb': eps = T.HMV_EGYEB[h.kod].eHMV; eh = T.HMV_EGYEB[h.kod].energiahordozo as Energiahordozo; leiras = h.kod; break;
    case 'tavho': eps = T.TAVHO_HMV.epszilon; eh = 'tavho'; Wterm = T.TAVHO_HMV.segedenergiaHokozpontonkentKWh * (h.hokozpontokSzama ?? 1) * lef; leiras = 'távhő HMV'; break;
    case 'kezi': eps = h.epszilon; eh = h.energiahordozo; Wterm = h.segedKWh ?? 0; hsz = !!h.hoszivattyu; leiras = 'kézi megadás'; break;
  }

  // 9.4 tárolás, 9.5 elosztás (a nettó igény %-ában)
  let tarArany = 0;
  if (r.tarolo) {
    const t = T.HMV_TAROLO;
    tarArany = r.tarolo.hely === 'belul'
      ? interpolal({ forras: `${t.forras} (belül), ${r.tarolo.tipus}`, x: t.A_belul, y: t.belul[r.tarolo.tipus] }, r.Arszr, fw) / 100
      : interpolal({ forras: `${t.forras} (kívül), ${r.tarolo.tipus}`, x: t.A_kivul, y: t.kivul[r.tarolo.tipus] }, r.Arszr, fw) / 100;
  }
  const ek = r.elosztas.cirkulacio ? (r.elosztas.hely === 'kivul' ? 'cirk_kivul' : 'cirk_belul') : (r.elosztas.hely === 'kivul' ? 'nincs_cirk_kivul' : 'nincs_cirk_belul');
  const szallArany = interpolal(oszlop(T.HMV_ELOSZTAS, ek), r.Arszr, fw) / 100;
  const QSzall = QHMVnet * szallArany;
  const QTar = QHMVnet * tarArany;

  let kollKWh = r.napkollektorKWh, kollA = r.napkollektorFelulet;
  if (r.napkollektor) {
    const k = T.kollektorTermeles(r.napkollektor.tipus, r.napkollektor.felulet, r.Arszr, r.napkollektor.hajlasszog, r.napkollektor.tajolasFok);
    kollKWh = k.Qkoll; kollA = r.napkollektor.felulet;
    if (k.tablanKivul) fw.push({ kod: 'KOLLEKTOR_TABLAN_KIVUL', uzenet: 'A kollektorfelület vagy a rendszer-alapterület kívül esik a 9.1./9.2. táblázat tartományán; a szélső értékkel számoltunk.', forras: '1. függ. 9.2.1.1' });
  }
  const Wcirk = r.cirkSzivattyu ? interpolal(oszlop(T.HMV_CIRK_SZIVATTYU, r.cirkSzivattyu), r.Arszr, fw) * r.Arszr * lef : 0;
  const Wszol = kollA ? T.szolarSzivattyu(kollA) : 0;

  // 9.1 / 9.4–9.6 (napkollektor: a kiegészítő hőtermelő végenergiájából levonva)
  const Qleadott = QHMVnet + QSzall + QTar;
  let QHMVveg = Qleadott * eps;
  const tetelek: VegenergiaTetel[] = [];
  if (kollKWh) {
    const Qkoll = Math.min(kollKWh, Qleadott);
    QHMVveg = (Qleadott - Qkoll) * eps; // 9.6: Qvég,2 = Qvég,koll_nélkül − Qvég,koll·εHMV,2
    tetelek.push({ energiahordozo: 'nap_termikus', Q: Qkoll, jelleg: 'ho', megnevezes: 'HMV – napkollektor' });
  }
  tetelek.unshift({ energiahordozo: eh, Q: QHMVveg, jelleg: 'ho', megnevezes: `HMV – ${leiras}` });
  if (hsz) {
    const Qk = QHMVveg * (1 / eps - 1);
    if (eps <= 0.37) tetelek.push({ energiahordozo: 'kornyezeti_ho', Q: Qk, jelleg: 'kornyezeti', megnevezes: 'HMV – hőszivattyú környezeti hő' });
    else fw.push({ kod: 'HSZ_NEM_MEGUJULO', uzenet: `εHMV = ${eps.toFixed(3)} > 0,37: a környezeti hő nem vehető figyelembe megújulóként.`, forras: '1. függ. 14.3' });
  }
  const W = Wcirk + Wterm + Wszol;
  if (W > 0) tetelek.push({ energiahordozo: 'villamos', Q: W, jelleg: 'seged', megnevezes: 'HMV – villamos segédenergia' });

  return { nev: r.nev, cel: 'hmv', tetelek, figyelmeztetesek: fw, reszletek: { QHMVnet, szallArany, tarArany, QSzall, QTar, epszilonHMV: eps, Qleadott, QHMVveg, Wcirk, Wterm, Wszol } };
}

// ---------------------------------------------------------------------------------------------
// Szellőzés (10. fejezet) – ventilátor villamos energia; léghevítés nélküli (csak hővisszanyerős) rendszer.

export interface SzellozesRendszer {
  nev: string;
  /** Szállított (friss) térfogatáram [m³/h]. */
  V: number;
  /** Éves üzemidő [h] (lakóépület: 8760 · üzemarány). */
  uzemora: number;
  ventilator:
    /** 10.17 – ErP adatlap: SPI [kW/(m³/h)]. */
    | { mod: 'erp'; SPI: number; misc: keyof typeof T.SZELL_MISC; ctrl: keyof typeof T.SZELL_CTRL; x: keyof typeof T.SZELL_X }
    /** 10.20 – nyomásesés és ventilátor-összhatásfok (null: 10.8. táblázat). */
    | { mod: 'nyomas'; dp: number; etaVent: number | null };
  /** További villamos segédenergia (10.23) [kWh/év]. */
  segedKWh?: number;
}

export function szellozesRendszer(s: SzellozesRendszer): RendszerEredmeny {
  const fw: Figyelmeztetes[] = [];
  let Wvent: number;
  const v = s.ventilator;
  if (v.mod === 'erp') {
    Wvent = (s.V * T.SZELL_MISC[v.misc] * v.SPI * s.uzemora) / T.SZELL_CTRL[v.ctrl] ** T.SZELL_X[v.x]; // 10.17
  } else {
    const eta = v.etaVent ?? T.ventilatorHatasfok(s.V);
    if (v.etaVent === null) fw.push({ kod: 'VENT_ETA_TABLA', uzenet: `Ventilátor-összhatásfok a 10.8. táblázatból: ${eta}.`, forras: T.SZELL_FORRAS });
    Wvent = ((s.V * v.dp) / (3600 * eta)) * s.uzemora / 1000; // 10.20 (befúvó és elszívó együtt: a Δp a teljes rendszeré)
  }
  const W = Wvent + (s.segedKWh ?? 0);
  return {
    nev: s.nev, cel: 'szellozes', figyelmeztetesek: fw,
    tetelek: W > 0 ? [{ energiahordozo: 'villamos', Q: W, jelleg: 'seged', megnevezes: 'Szellőzés – ventilátor villamos energia' }] : [],
    reszletek: { V: s.V, uzemora: s.uzemora, Wvent, W },
  };
}

// ---------------------------------------------------------------------------------------------
// Hűtés (11. fejezet, egyszerűsített módszer)

export interface HutesRendszer {
  nev: string;
  /** Hűtőgép: táblázati típus (11.2.) vagy adatlap szerinti SEER. Passzív talajhőcserélős hűtésnél 'passziv_talaj'. */
  gep: { tipus: 'tabla'; kod: H.HutogepKod } | { tipus: 'seer'; SEER: number; energiahordozo: 'villamos' | 'fosszilis_gaz' } | { tipus: 'passziv_talaj' };
  cH: H.HutesChKod;
  szab: H.HutesSzabKod;
  /** A nettó hűtési igény ennyiszeres hányadát fedezi (több rendszer esetén); alapérték 1. */
  lefedes?: number;
  /** A SEER-ben nem foglalt villamos segédenergia (11.2) [kWh/év]; egyszerűsített esetben 0. */
  segedKWh?: number;
}

export function hutesRendszer(QHnet: number, r: HutesRendszer): RendszerEredmeny {
  const fw: Figyelmeztetes[] = [];
  const Q = QHnet * (r.lefedes ?? 1);
  const cH = H.HUTES_CH[r.cH].cH;
  const eSzab = H.HUTES_SZAB[r.szab].eps;
  const eSzall = 1; // 11.1.3
  const tetelek: VegenergiaTetel[] = [];
  let epsH = 0, SEER = 0;
  if (r.gep.tipus === 'passziv_talaj') {
    // 11.1.2 utolsó bekezdés: 1 kWh segédenergia 10 kWh nettó hűtési igényt fedez.
    const W = Q / H.PASSZIV_TALAJ_ARANY;
    if (W > 0) tetelek.push({ energiahordozo: 'villamos', Q: W, jelleg: 'seged', megnevezes: 'Hűtés – passzív talajhőcserélő keringtetése' });
  } else {
    let eh: 'villamos' | 'fosszilis_gaz';
    if (r.gep.tipus === 'tabla') { const g = H.HUTOGEPEK[r.gep.kod]; SEER = g.SEER; eh = g.energiahordozo; }
    else { SEER = r.gep.SEER; eh = r.gep.energiahordozo; }
    if (!(SEER > 0)) throw new Error('A hűtőgép SEER értéke legyen pozitív.');
    epsH = 1 / SEER; // 11.3
    const Qveg = Q * cH * eSzab * eSzall * epsH; // 11.1
    if (Qveg > 0) tetelek.push({ energiahordozo: eh, Q: Qveg, jelleg: 'ho', megnevezes: `Hűtés – hűtőgép (SEER ${SEER.toLocaleString('hu-HU')})` });
  }
  if ((r.segedKWh ?? 0) > 0) tetelek.push({ energiahordozo: 'villamos', Q: r.segedKWh!, jelleg: 'seged', megnevezes: 'Hűtés – egyéb villamos segédenergia' });
  if (Q <= 0) fw.push({ kod: 'HUTES_NINCS_IGENY', uzenet: `„${r.nev}”: a zóna nettó hűtési igénye 0, a hűtés nem okoz energiafogyasztást.`, forras: H.HUTES_FORRAS });
  return { nev: r.nev, cel: 'hutes', tetelek, figyelmeztetesek: fw, reszletek: { QHnet: Q, cH, eSzab, eSzall, epsH, SEER } };
}

// ---------------------------------------------------------------------------------------------
// Beépített világítás (1. függelék 12.1, egyszerűsített módszer) – lakóépületnél nem számítható be.

export interface VilagitasBemenet {
  nev: string;
  /** A zóna nettó alapterülete [m²]. */
  A: number;
  /** Előírt megvilágítás [lx] (2. függ. 2.1.). */
  MV: number;
  /** Fényhasznosítás [lm/W] (12.1.) és lámpatest-hatásfok (12.2.). */
  FH: number;
  etaVil: number;
  /** Fényerő-szabályozhatóság (12.3.). */
  Ffe: number;
  /** Kihasználtsági mutató (12.4.) és a szabályozás típusa (12.5.). */
  Fkihaszn: number;
  szabalyozas: Prof.FszabKod;
  /** Üzemórák (12.6.) és természetes megvilágítás (12.7.). */
  tnappal: number; tejjel: number; Fnappal: number;
  vesz: boolean; standby: boolean;
}

/** 12.1–12.2: WV = (Ffe · P · Fszab · (tnappal · Fnappal + téjjel) / 1000 + wvész + wstandby) · A; P = MV / (FH · ηvil). */
export function vilagitasRendszer(v: VilagitasBemenet): RendszerEredmeny {
  const P = v.MV / (v.FH * v.etaVil);
  const Fszab = P_fszab(v.szabalyozas, v.Fkihaszn);
  const W = (v.Ffe * P * Fszab * (v.tnappal * v.Fnappal + v.tejjel) / 1000 + (v.vesz ? 1 : 0) + (v.standby ? 1.5 : 0)) * v.A;
  return {
    nev: v.nev, cel: 'vilagitas',
    tetelek: W > 0 ? [{ energiahordozo: 'villamos', Q: W, jelleg: 'seged', megnevezes: 'Beépített világítás' }] : [],
    reszletek: { P, Fszab, W, wFajl: v.A > 0 ? W / v.A : 0 },
    figyelmeztetesek: [],
  };
}
