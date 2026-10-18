/**
 * Teljes épület számítása, követelmények és besorolás – 1. függ. 3. fejezet lépései szerint.
 */
import { zonaHaviMerleg, type ZonaBemenet, type ZonaEredmeny, type NyilaszaroElem } from './energiamerleg.js';
import { futesiRendszer, hmvRendszer, szellozesRendszer, szabalyozasiTenyezo, type FutesiAlrendszer, type HmvRendszer, type SzellozesRendszer, type RendszerEredmeny } from './rendszerek.js';
import { napelemTermeles } from './tablak/gepeszet.js';
import { indikatorok, type Indikatorok } from './indikatorok.js';
import {
  U_KOVETELMENYEK, qmMaxKozelNulla, qmMaxFelujitas, KOZEL_NULLA_LAKO, REFERENCIA_LAKO, EnrenMaxFelujitasLako,
  besorolas, szerkezetMinosites, rendszerMinosites, NYARI_HOVEDELEM, type Minosites,
} from './tablak/kovetelmeny.js';
import { F_UVEGEZES_BEESESI } from './tablak/epuletfizika.js';
import type { Figyelmeztetes } from './interpolacio.js';

export type KovetelmenySzint = 'kozel_nulla' | 'jelentos_felujitas' | 'meglevo';

export interface EpuletBemenet {
  nev: string;
  rendeltetes: 'lakoepulet';
  /** Hasznos alapterület (176/2008 szerint) [m²]. */
  AN: number;
  /** Fűtött térfogat belméretekkel [m³]. */
  V: number;
  /** Lehűlő felület [m²] (a felület/térfogat arányhoz). */
  Alehulo: number;
  kovetelmenySzint: KovetelmenySzint;
  zonak: ZonaBemenet[];
  futes: (FutesiAlrendszer & { zona: string })[];
  hmv: HmvRendszer[];
  /** Gépi szellőzés ventilátor-energiája (10. fejezet); a hővisszanyerés hatása a zóna gepiSzellozes mezőjében. */
  szellozes?: SzellozesRendszer[];
  /** Napelemek (13.2.1, ≤ 20 kWp) – egyszerűsített módszerrel exportáltként elszámolva (13.1). */
  napelem?: { nev: string; kWp: number; tajolas: 'K_Ny' | 'DK_DNy' | 'D'; hajlasszog: number }[];
  /** Referencia rendszer felülbírálásai (alapértelmezés: 5. melléklet szerint a tárgyi épületből levezetve). */
  referencia?: Partial<ReferenciaBeallitas>;
}

export interface ReferenciaBeallitas {
  hotermeloHely: 'belul' | 'kivul';
  futesElosztasHely: 'belul' | 'kivul';
  hmvElosztasHely: 'belul' | 'kivul';
  holeadokTobbMint10: boolean;
}

export interface SzerkezetErtekeles {
  nev: string;
  kovetelmenyKod: string | null;
  U: number;
  Umax: number | null;
  megfelel: boolean | null;
  minosites: Minosites | null;
  A: number;
}

export interface EpuletEredmeny {
  zonak: ZonaEredmeny[];
  rendszerek: RendszerEredmeny[];
  /** Napelemek éves termelése [kWh/év]. */
  napelem: { nev: string; W: number }[];
  indikatorok: Indikatorok;
  aV: number;
  qm: number;
  qFnet: number;
  kovetelmeny: {
    qmMax: number; qmMegfelel: boolean;
    EnrenMax: number; EnrenMegfelel: boolean;
    ECO2Max: number | null; ECO2Megfelel: boolean | null;
    /** Közel nulla és jelentős felújítás szintek – a tanúsítvány mindkettőt közli. */
    kozelNulla: { EnrenMax: number; ECO2Max: number; qmMax: number; teljesul: boolean };
    jelentosFelujitas: { EnrenMax: number; qmMax: number; teljesul: boolean };
  };
  besorolas: { energetikai: string; energetikaiSzazalek: number; CO2: string; CO2Szazalek: number };
  nyariHovedelem: { erintettFelulet: number; arany: number; mutato: number | null; megfelel: boolean };
  szerkezetek: SzerkezetErtekeles[];
  rendszerErtekeles: { futes: { Enren: number; EnrenRef: number; szazalek: number; minosites: Minosites } | null; hmv: { Enren: number; EnrenRef: number; szazalek: number; minosites: Minosites } | null };
  figyelmeztetesek: Figyelmeztetes[];
}

/** 5. melléklet 2. – referencia épülettechnikai rendszer lakóépületre. */
function referenciaRendszerek(b: EpuletBemenet, zonaQ: Map<string, number>): RendszerEredmeny[] {
  const tf = b.futes[0];
  const ref: ReferenciaBeallitas = {
    // 2.1.1: hőtermelő helye a tárgyi épület szerint; 2.1.5: központi fűtésnél a nyomvonal azonos, egyébként fűtött térben.
    hotermeloHely: tf?.hotermelo.tipus === 'kazan_tabla' ? tf.hotermelo.hely : 'kivul',
    futesElosztasHely: tf && tf.elosztas.hely !== 'nincs' ? tf.elosztas.hely : 'belul',
    hmvElosztasHely: b.hmv[0]?.elosztas.hely ?? 'belul',
    holeadokTobbMint10: false,
    ...b.referencia,
  };
  const QFnet = [...zonaQ.values()].reduce((a, x) => a + x, 0);
  const Arszr = b.AN;
  const szab = szabalyozasiTenyezo({
    alap: 'ref_helyiseg_pi', // 2.1.7.1: központi előremenő-hőm. szabályozás helyiségenkénti szabályozással
    holeado: { tipus: 'szabad', hofok: '55/45', hatarolo: 'kulsofali' }, // 2.1.7.2–3
    helyiseg: 'termosztatikus', // 2.1.7.4
    beszabalyozas: { csovek: 'ketcsoves', mod: 'statikus_csoportos_dinamikus', holeadokTobbMint10: ref.holeadokTobbMint10 }, // 2.1.7.5
  });
  const futes = futesiRendszer({
    nev: 'Referencia fűtés', Arszr,
    hotermelo: { tipus: 'kazan_tabla', kazan: 'kondenzacios', hely: ref.hotermeloHely, energiahordozo: 'fosszilis_gaz' }, // 2.1.2–3
    epszilonSzab: szab.epszilon,
    elosztas: { hely: ref.futesElosztasHely, elore: 55, vissza: 45 }, // 2.1.6
    tarolo: null, // 2.1.4
    szivattyu: 'epm_EEI_023', // 2.1.8
  }, QFnet, b.AN);
  const h0 = b.hmv[0];
  const hmv = hmvRendszer({
    nev: 'Referencia HMV', Arszr, qHMV: h0?.qHMV ?? 25, AN: b.AN,
    hotermelo: { tipus: 'kazan_tabla', kazan: 'kondenzacios', energiahordozo: 'fosszilis_gaz' }, // 2.2.1–2
    tarolo: { tipus: 'indirekt', hely: 'belul' }, // 2.2.3
    elosztas: { cirkulacio: true, hely: ref.hmvElosztasHely }, // 2.2.4–5 (cirkulációs szivattyú EEI 0,23)
    cirkSzivattyu: 'EEI_023',
  });
  return [futes, hmv];
}

function nyariHovedelem(zonak: ZonaBemenet[], AN: number) {
  const erintett: NyilaszaroElem[] = [];
  for (const z of zonak) for (const e of z.elemek) {
    if (e.tipus !== 'nyilaszaro' || e.hatar.tipus !== 'kulso') continue;
    // Az északtól legalább 45°-kal eltérő tájolású (ÉK és ÉNy pontosan 45° → beleszámít), vagy 45°-nál kisebb hajlásszögű.
    const beleszamit = e.hajlasszog < 45 || e.tajolas === null || e.tajolas !== 'É';
    if (beleszamit) erintett.push(e);
  }
  const Abrutto = erintett.reduce((s, e) => s + e.A, 0);
  const arany = Abrutto / AN;
  if (arany <= NYARI_HOVEDELEM.kuszobArany) return { erintettFelulet: Abrutto, arany, mutato: null, megfelel: true };
  let szamlalo = 0, nevezo = 0;
  for (const e of erintett) {
    const Au = e.Au ?? e.A * (1 - (e.keretarany ?? 0.3));
    const F = e.Farny ? Math.max(...e.Farny.slice(4, 9)) : 1;
    szamlalo += Au * F_UVEGEZES_BEESESI * e.gn * (e.garnyH ?? 1) * F;
    nevezo += Au;
  }
  const mutato = szamlalo / nevezo;
  return { erintettFelulet: Abrutto, arany, mutato, megfelel: mutato <= NYARI_HOVEDELEM.megengedettAtlag };
}

export interface SzamitasiOpciok {
  /** Validációhoz: zónánként a havi direkt szoláris nyereség felülbírálása [kWh]. */
  QsdFelulbiralas?: Readonly<Record<string, readonly number[]>>;
}

export function epuletSzamitas(b: EpuletBemenet, opciok?: SzamitasiOpciok): EpuletEredmeny {
  const fw: Figyelmeztetes[] = [];
  const zonak = b.zonak.map((z) => zonaHaviMerleg(z, { QsdFelulbiralas: opciok?.QsdFelulbiralas?.[z.nev] }));
  zonak.forEach((z) => fw.push(...z.figyelmeztetesek));
  const zonaQ = new Map(zonak.map((z) => [z.nev, z.QFnetEv]));

  const rendszerek: RendszerEredmeny[] = [];
  for (const f of b.futes) {
    const Q = zonaQ.get(f.zona);
    if (Q === undefined) throw new Error(`Ismeretlen zóna a fűtési rendszerben: ${f.zona}`);
    rendszerek.push(futesiRendszer(f, Q, b.AN));
  }
  for (const h of b.hmv) rendszerek.push(hmvRendszer(h));
  for (const s of b.szellozes ?? []) rendszerek.push(szellozesRendszer(s));
  rendszerek.forEach((r) => fw.push(...r.figyelmeztetesek));

  const napelem = (b.napelem ?? []).map((n) => ({ nev: n.nev, W: napelemTermeles(n.kWp, n.tajolas, n.hajlasszog) }));
  const pvOssz = (b.napelem ?? []).reduce((s, n) => s + n.kWp, 0);
  if (pvOssz > 20) fw.push({ kod: 'PV_20KWP', uzenet: `A napelemek összteljesítménye ${pvOssz.toFixed(1)} kWp; a 13.1. táblázat 20 kWp-ig alkalmazható, fölötte részletes módszer (MSZ EN 15316-4-3) kell.`, forras: '1. függ. 13.2.1' });
  const passziv = zonak.reduce((s, z) => s + z.QsdHasznositott, 0);
  const ind = indikatorok(rendszerek, b.AN, passziv, napelem.reduce((s, n) => s + n.W, 0));

  const aV = b.Alehulo / b.V;
  // Fajlagos hőveszteség-tényező: zónák V-vel súlyozva
  const qm = zonak.reduce((s, z, i) => s + z.q * b.zonak[i]!.V, 0) / b.zonak.reduce((s, z) => s + z.V, 0);
  const qFnet = zonak.reduce((s, z) => s + z.QFnetEv, 0) / b.AN;

  const kn = { EnrenMax: KOZEL_NULLA_LAKO.EnrenFajlMax, ECO2Max: KOZEL_NULLA_LAKO.ECO2FajlMax, qmMax: qmMaxKozelNulla(aV) };
  const jf = { EnrenMax: EnrenMaxFelujitasLako(aV), qmMax: qmMaxFelujitas(aV) };
  const E = ind.fajlagos.EnrenFajl, C = ind.fajlagos.ECO2Fajl;
  const knTeljesul = E <= kn.EnrenMax && C <= kn.ECO2Max && qm <= kn.qmMax;
  const jfTeljesul = E <= jf.EnrenMax && qm <= jf.qmMax;
  const szint = b.kovetelmenySzint;
  const kov = szint === 'kozel_nulla'
    ? { qmMax: kn.qmMax, EnrenMax: kn.EnrenMax, ECO2Max: kn.ECO2Max as number | null }
    : { qmMax: jf.qmMax, EnrenMax: jf.EnrenMax, ECO2Max: null as number | null };

  // 176/2008 3. melléklet: a besorolás a közel nulla követelményértékhez (új épületre vonatkozó) viszonyít.
  const energSzaz = (E / kn.EnrenMax) * 100;
  const co2Szaz = (C / kn.ECO2Max) * 100;

  // Elemi követelmények és szerkezetminősítés
  const szerkezetek: SzerkezetErtekeles[] = [];
  for (const z of b.zonak) for (const e of z.elemek) {
    if (e.tipus === 'vonal' || e.tipus === 'pont') continue;
    const kod = e.kovetelmenyKod ?? null;
    const k = kod ? U_KOVETELMENYEK.find((x) => x.kod === kod) : undefined;
    const U = e.tipus === 'talaj' ? (e.UElemi ?? e.UT) : e.tipus === 'opak' ? e.U * (1 + e.chi) : e.U;
    const Uelemi = e.tipus === 'opak' ? e.U : U; // elemi követelmény: rétegtervi U (hőhíd nélkül)
    let minosites: Minosites | null = null;
    if (k?.ertekelesiSor) minosites = szerkezetMinosites(k.ertekelesiSor, U);
    else if (k) {
      // A 4. melléklet nem ad sort (pl. ajtó): a követelményhez mérjük – a WinWatt így minősítette az 1,4 W/m²K-es ajtót „jó”-nak. Ellenőrizendő.
      minosites = U <= k.Umax ? 'jo' : 'kozepes';
      fw.push({ kod: 'MINOSITES_NINCS_SOR', uzenet: `„${e.nev}”: a 176/2008 4. melléklete nem ad értékelési sort; a követelményhez mért minősítést adtunk.`, forras: '176/2008 Korm. r. 4. melléklet' });
    }
    szerkezetek.push({ nev: e.nev, kovetelmenyKod: kod, U, Umax: k?.Umax ?? null, megfelel: k ? Uelemi <= k.Umax + 1e-9 : null, minosites, A: e.A });
  }

  // Épülettechnikai rendszerek értékelése (176/2008 5. melléklet) – referencia rendszerhez
  const ref = referenciaRendszerek(b, zonaQ);
  const refInd = indikatorok(ref, b.AN);
  const fE = ind.celonkent.futes.nren, fR = refInd.celonkent.futes.nren;
  const hE = ind.celonkent.hmv.nren, hR = refInd.celonkent.hmv.nren;

  return {
    zonak, rendszerek, napelem, indikatorok: ind, aV, qm, qFnet,
    kovetelmeny: {
      qmMax: kov.qmMax, qmMegfelel: qm <= kov.qmMax,
      EnrenMax: kov.EnrenMax, EnrenMegfelel: E <= kov.EnrenMax,
      ECO2Max: kov.ECO2Max, ECO2Megfelel: kov.ECO2Max === null ? null : C <= kov.ECO2Max,
      kozelNulla: { ...kn, teljesul: knTeljesul },
      jelentosFelujitas: { ...jf, teljesul: jfTeljesul },
    },
    besorolas: { energetikai: besorolas(energSzaz), energetikaiSzazalek: energSzaz, CO2: besorolas(co2Szaz), CO2Szazalek: co2Szaz },
    nyariHovedelem: nyariHovedelem(b.zonak, b.AN),
    szerkezetek,
    rendszerErtekeles: {
      futes: fR > 0 ? { Enren: fE, EnrenRef: fR, szazalek: (fE / fR) * 100, minosites: rendszerMinosites('futes', (fE / fR) * 100) } : null,
      hmv: hR > 0 ? { Enren: hE, EnrenRef: hR, szazalek: (hE / hR) * 100, minosites: rendszerMinosites('hmv', (hE / hR) * 100) } : null,
    },
    figyelmeztetesek: fw,
  };
}

export { REFERENCIA_LAKO };
