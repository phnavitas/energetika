/**
 * Teljes épület számítása, követelmények és besorolás – 1. függ. 3. fejezet lépései szerint.
 */
import { zonaHaviMerleg, type ZonaBemenet, type ZonaEredmeny, type NyilaszaroElem, type OpakElem, type HataroloElem } from './energiamerleg.js';
import { futesiRendszer, hmvRendszer, szellozesRendszer, hutesRendszer, vilagitasRendszer, szabalyozasiTenyezo, type FutesiAlrendszer, type HmvRendszer, type SzellozesRendszer, type HutesRendszer, type VilagitasBemenet, type RendszerEredmeny } from './rendszerek.js';
import { FENYHASZNOSITAS, LAMPATEST_ETA, FFE } from './tablak/profilok.js';
import { napelemTermeles } from './tablak/gepeszet.js';
import type { Energiahordozo, Sulyozo } from './tablak/sulyozo.js';
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
  /** 'lakoepulet': lakó és szállás jellegű; 'egyeb': egyéb rendeltetés – referenciaépülettel (2. melléklet 2.3, 5. melléklet), világítással. */
  rendeltetes: 'lakoepulet' | 'egyeb';
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
  /** Gépi hűtés (11. fejezet); a hivatkozott zóna (alapértelmezés: az első) hűtöttként számolódik. */
  hutes?: (HutesRendszer & { zona?: string })[];
  /** Napelemek – exportáltként elszámolva (13.1, 14.7). */
  napelem?: NapelemBemenet[];
  /** Beépített világítás (12.1) – csak egyéb rendeltetésnél számít be. */
  vilagitas?: VilagitasBemenet[];
  /** Referencia rendszer felülbírálásai (alapértelmezés: 5. melléklet szerint a tárgyi épületből levezetve). */
  referencia?: Partial<ReferenciaBeallitas>;
  /** Súlyozó tényezők felülbírálása (8. § (1): a távhőszolgáltató által közzétett érték). Csak a tárgyi épületre. */
  sulyozo?: Partial<Record<Energiahordozo, Sulyozo>>;
}

export interface NapelemBemenet {
  nev: string; kWp: number; tajolas: 'K_Ny' | 'DK_DNy' | 'D'; hajlasszog: number;
  /** 13.2.2 részletes módszer (pl. PVGIS): az éves termelés [kWh/év] és forrása. Megadva felülírja a 13.1. táblázatot. */
  reszletes?: { Wev: number; forras: string };
}

export interface ReferenciaBeallitas {
  hotermeloHely: 'belul' | 'kivul';
  futesElosztasHely: 'belul' | 'kivul';
  hmvElosztasHely: 'belul' | 'kivul';
  holeadokTobbMint10: boolean;
  /** Egyéb rendeltetés: a referenciaépület tömítetlenségi légcseréje (jó légzárású nyílászárók, 2. függ. 2.4.). */
  nfilt?: number;
  /** Egyéb rendeltetés: a referencia hűtőgép SEER-je (5. melléklet: léghűtéses komfort folyadékhűtő < 400 kW: 3,8). */
  hutesSEER?: number;
}

export interface SzerkezetErtekeles {
  nev: string;
  kovetelmenyKod: string | null;
  U: number;
  /** Az elemi követelménnyel összevetett érték: falaknál, födémeknél a rétegtervi U (hőhíd nélkül). */
  Uelemi: number;
  Umax: number | null;
  megfelel: boolean | null;
  minosites: Minosites | null;
  A: number;
}

export interface RendszerMinosites { Enren: number; EnrenRef: number; szazalek: number; minosites: Minosites }

export interface EpuletEredmeny {
  zonak: ZonaEredmeny[];
  rendszerek: RendszerEredmeny[];
  /** Napelemek éves termelése [kWh/év]. */
  napelem: { nev: string; W: number; modszer: 'tabla' | 'reszletes' }[];
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
  /** 4. melléklet 2.9: azonos geometriájú és határolású épület a referencia épülettechnikai rendszerrel (természetes szellőzéssel). */
  referenciaEpulet: { Enren: number; EnrenFajl: number; ECO2Fajl: number; /** egyéb rendeltetésnél a teljes 5. melléklet szerinti referenciaépület */ teljes?: boolean; rendszerek?: RendszerEredmeny[]; zonak?: ZonaEredmeny[] };
  rendszerErtekeles: {
    futes: RendszerMinosites | null; hmv: RendszerMinosites | null;
    hutes?: RendszerMinosites | null; vilagitas?: RendszerMinosites | null;
  };
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

const UMAX = (kod: string | undefined) => (kod ? U_KOVETELMENYEK.find((x) => x.kod === kod)?.Umax : undefined);
const TETO_KODOK = new Set(['lapostető', 'futott_tetoter']);

/**
 * 5. melléklet – egyéb rendeltetésű referenciaépület zónája: azonos geometria, határolás, tájolás és használat;
 * a határolók U-értéke az 1. melléklet 1.1. elemi követelménye (a csatlakozási hőhidak a tárgyi épület szerint),
 * talajon fekvő padló UT = 0,3; fűtésre g = 0,55 (hűtésre a tárgyi épület g-je és árnyékolása);
 * üvegezési arány tájolásonként legfeljebb 50% (60°-nál kisebb hajlásnál 30%); programozható fűtés;
 * jó légzárású nyílászárók; gépi szellőzésnél 50% hővisszanyerés.
 */
function referenciaZona(z: ZonaBemenet, nfilt: number, fw: Figyelmeztetes[]): ZonaBemenet {
  const elemek: HataroloElem[] = z.elemek.map((e) => {
    if (e.tipus === 'opak') { const U = UMAX(e.kovetelmenyKod); return U !== undefined ? { ...e, U } : { ...e }; }
    if (e.tipus === 'nyilaszaro') {
      const U = UMAX(e.kovetelmenyKod) ?? e.U;
      const { UFutes: _u, ...r } = e;
      return { ...r, U, gnFutes: 0.55 };
    }
    if (e.tipus === 'talaj') {
      const U = UMAX(e.kovetelmenyKod) ?? 0.3;
      return { ...e, UT: U, ...(e.pinceFal ? { pinceFal: { ...e.pinceFal, UTpf: 0.3 } } : {}) };
    }
    return { ...e };
  });
  // üvegezési arány korlátja – homlokzati falak tájolásonként, tetők összesen
  const kulso = (e: HataroloElem) => 'hatar' in e && e.hatar.tipus === 'kulso';
  const ablakok = elemek.filter((e): e is NyilaszaroElem => e.tipus === 'nyilaszaro' && kulso(e));
  const csoportok = new Map<string, { ny: NyilaszaroElem[]; fal: OpakElem[]; max: number }>();
  // ha a homlokzati falak tájolása nincs megadva, a korlát a teljes homlokzatra vonatkozik
  const tajolasNelkul = elemek.some((e) => e.tipus === 'opak' && kulso(e) && e.kovetelmenyKod === 'homlokzati_fal' && !e.tajolas);
  const falKulcs = (t: string | null | undefined) => (tajolasNelkul ? 'fal|összes' : `fal|${t ?? '-'}`);
  for (const n of ablakok) {
    const k = n.hajlasszog < 60 ? 'teto' : falKulcs(n.tajolas);
    const c = csoportok.get(k) ?? { ny: [], fal: [], max: n.hajlasszog < 60 ? 0.3 : 0.5 };
    c.ny.push(n); csoportok.set(k, c);
  }
  for (const e of elemek) {
    if (e.tipus !== 'opak' || !kulso(e)) continue;
    if (TETO_KODOK.has(e.kovetelmenyKod ?? '')) csoportok.get('teto')?.fal.push(e);
    else if (e.kovetelmenyKod === 'homlokzati_fal') csoportok.get(falKulcs(e.tajolas))?.fal.push(e);
  }
  for (const [k, c] of csoportok) {
    const An = c.ny.reduce((s, n) => s + n.A, 0), Af = c.fal.reduce((s, f) => s + f.A, 0);
    if (An <= 0 || An / (An + Af) <= c.max) continue;
    if (Af <= 0) { fw.push({ kod: 'REF_UVEGARANY', uzenet: `Referenciaépület: a(z) ${k === 'teto' ? 'tető' : k.split('|')[1] + ' homlokzat'} üvegezési aránya nem korlátozható – nincs azonos tájolású opak felület megadva.`, forras: '9/2023 ÉKM 5. melléklet' }); continue; }
    const kf = (c.max * (An + Af)) / An, dA = An - c.max * (An + Af);
    for (const n of c.ny) { n.A *= kf; if (n.Au !== undefined) n.Au *= kf; }
    for (const f of c.fal) f.A += dA * (f.A / Af);
  }
  const { gepiSzellozes, ...zz } = z;
  return {
    ...zz, elemek, nfilt, futesProgramozhato: true,
    ...(gepiSzellozes ? { gepiSzellozes: { ...gepiSzellozes, etaR: 0.5 } } : {}),
  };
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
  const hutottZonak = new Set((b.hutes ?? []).map((h) => h.zona ?? b.zonak[0]?.nev));
  const zonak = b.zonak.map((z) => zonaHaviMerleg(hutottZonak.has(z.nev) ? { ...z, hutott: true } : z, { QsdFelulbiralas: opciok?.QsdFelulbiralas?.[z.nev] }));
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
  for (const h of b.hutes ?? []) {
    const z = zonak.find((x) => x.nev === (h.zona ?? b.zonak[0]?.nev));
    if (!z) throw new Error(`Ismeretlen zóna a hűtési rendszerben: ${h.zona}`);
    rendszerek.push(hutesRendszer(z.QHnetEv, h));
  }
  const egyeb = b.rendeltetes === 'egyeb';
  if (egyeb) for (const v of b.vilagitas ?? []) rendszerek.push(vilagitasRendszer(v));
  else if (b.vilagitas?.length) fw.push({ kod: 'VILAGITAS_LAKO', uzenet: 'Lakó és szállás jellegű épületnél a beépített világítás nem számítható be az energiamérlegbe.', forras: '1. függ. 12. fejezet' });
  if (egyeb && !(b.vilagitas ?? []).length) fw.push({ kod: 'VILAGITAS_HIANYZIK', uzenet: 'Egyéb rendeltetésű épület: a beépített világítás energiaigénye kötelező része a számításnak – add meg a Villamosság lépésben.', forras: '1. függ. 3.1, 12. fejezet' });
  rendszerek.forEach((r) => fw.push(...r.figyelmeztetesek));

  const napelem = (b.napelem ?? []).map((n) => ({ nev: n.nev, W: n.reszletes ? n.reszletes.Wev : napelemTermeles(n.kWp, n.tajolas, n.hajlasszog), modszer: n.reszletes ? 'reszletes' as const : 'tabla' as const }));
  const pvOssz = (b.napelem ?? []).reduce((s, n) => s + n.kWp, 0);
  // 13.2.1: a táblázat csak 20 kWp-ig; a feltétel a teljes beépített teljesítményre vonatkozik.
  if (pvOssz > 20 && (b.napelem ?? []).some((n) => !n.reszletes)) fw.push({ kod: 'PV_20KWP', uzenet: `A napelemek összteljesítménye ${pvOssz.toFixed(1)} kWp; a 13.1. táblázat 20 kWp-ig alkalmazható, fölötte részletes módszer (13.2.2, pl. PVGIS) kell.`, forras: '1. függ. 13.2.1' });
  for (const n of b.napelem ?? []) if (n.reszletes) fw.push({ kod: 'PV_RESZLETES', uzenet: `„${n.nev}”: ${Math.round(n.reszletes.Wev)} kWh/év részletes módszerrel (${n.reszletes.forras}).`, forras: '1. függ. 13.2.2' });
  const passziv = zonak.reduce((s, z) => s + z.QsdHasznositott, 0);
  const ind = indikatorok(rendszerek, b.AN, passziv, napelem.reduce((s, n) => s + n.W, 0), b.sulyozo);

  const aV = b.Alehulo / b.V;
  // Fajlagos hőveszteség-tényező: zónák V-vel súlyozva
  const qm = zonak.reduce((s, z, i) => s + z.q * b.zonak[i]!.V, 0) / b.zonak.reduce((s, z) => s + z.V, 0);
  const qFnet = zonak.reduce((s, z) => s + z.QFnetEv, 0) / b.AN;

  // Egyéb rendeltetés: 5. melléklet szerinti referenciaépület és referencia épülettechnikai rendszer
  let refTeljes: { ind: Indikatorok; rendszerek: RendszerEredmeny[]; zonak: ZonaEredmeny[] } | null = null;
  if (egyeb) {
    const rzonak = b.zonak.map((z) => referenciaZona(z, b.referencia?.nfilt ?? 0.06, fw));
    const rz = rzonak.map((z) => zonaHaviMerleg(hutottZonak.has(z.nev) ? { ...z, hutott: true } : z));
    const rQ = new Map(rz.map((z) => [z.nev, z.QFnetEv]));
    const rr: RendszerEredmeny[] = [...referenciaRendszerek(b, rQ)];
    // gépi szellőzés: azonos légmennyiség, üzemidő és segédenergia
    for (const s of b.szellozes ?? []) rr.push(szellozesRendszer(s));
    // hűtés: a tárgyi épületben hűtött zónákban, 6/12 °C fan-coil, referencia SEER
    for (const h of b.hutes ?? []) {
      const z = rz.find((x) => x.nev === (h.zona ?? b.zonak[0]?.nev));
      if (z) rr.push(hutesRendszer(z.QHnetEv, { nev: 'Referencia hűtés', gep: { tipus: 'seer', SEER: b.referencia?.hutesSEER ?? 3.8, energiahordozo: 'villamos' }, cH: 'fancoil_6_12', szab: 'viz_6_12', lefedes: h.lefedes, segedKWh: h.segedKWh }));
    }
    // világítás: üvegburás parabolatükrös lámpatest, nem dimmelhető LED, kézi be- és kikapcsolás
    for (const v of b.vilagitas ?? []) rr.push(vilagitasRendszer({ ...v, nev: 'Referencia világítás', FH: FENYHASZNOSITAS.led, etaVil: LAMPATEST_ETA.parabola, Ffe: FFE.nem, szabalyozas: 'kezi' }));
    refTeljes = { ind: indikatorok(rr, b.AN), rendszerek: rr, zonak: rz };
  }
  const Eref = refTeljes?.ind.fajlagos.EnrenFajl ?? 0, Cref = refTeljes?.ind.fajlagos.ECO2Fajl ?? 0;
  const kn = egyeb
    ? { EnrenMax: 0.8 * Eref, ECO2Max: 0.8 * Cref, qmMax: qmMaxKozelNulla(aV) } // 2. melléklet 2.3, 3.3
    : { EnrenMax: KOZEL_NULLA_LAKO.EnrenFajlMax, ECO2Max: KOZEL_NULLA_LAKO.ECO2FajlMax, qmMax: qmMaxKozelNulla(aV) };
  const jf = { EnrenMax: egyeb ? Eref : EnrenMaxFelujitasLako(aV), qmMax: qmMaxFelujitas(aV) }; // 3. melléklet 2.4
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
    szerkezetek.push({ nev: e.nev, kovetelmenyKod: kod, U, Uelemi, Umax: k?.Umax ?? null, megfelel: k ? Uelemi <= k.Umax + 1e-9 : null, minosites, A: e.A });
  }

  // Épülettechnikai rendszerek értékelése (176/2008 5. melléklet) – referencia rendszerhez
  const ref = referenciaRendszerek(b, zonaQ);
  const refInd = indikatorok(ref, b.AN);
  // Referencia épület: a gépi szellőzés hővisszanyerése nélkül számolt nettó igénnyel (a referencia rendszer természetes szellőzésű).
  const refZonaQ = b.zonak.some((z) => z.gepiSzellozes)
    ? new Map(b.zonak.map((z) => { const { gepiSzellozes: _g, ...zz } = z; return [z.nev, zonaHaviMerleg(hutottZonak.has(z.nev) ? { ...zz, hutott: true } : zz).QFnetEv] as [string, number]; }))
    : zonaQ;
  const refEpInd = refZonaQ === zonaQ ? refInd : indikatorok(referenciaRendszerek(b, refZonaQ), b.AN);
  const fE = ind.celonkent.futes.nren, fR = refInd.celonkent.futes.nren;
  const hE = ind.celonkent.hmv.nren, hR = refInd.celonkent.hmv.nren;
  const rm = (tipus: 'hutes' | 'vilagitas', E0: number, R0: number): RendszerMinosites | null => (R0 > 0 ? { Enren: E0, EnrenRef: R0, szazalek: (E0 / R0) * 100, minosites: rendszerMinosites(tipus, (E0 / R0) * 100) } : null);

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
    referenciaEpulet: refTeljes
      ? { Enren: refTeljes.ind.osszes.nren, EnrenFajl: Eref, ECO2Fajl: Cref, teljes: true, rendszerek: refTeljes.rendszerek, zonak: refTeljes.zonak }
      : { Enren: refEpInd.osszes.nren, EnrenFajl: refEpInd.fajlagos.EnrenFajl, ECO2Fajl: refEpInd.fajlagos.ECO2Fajl },
    rendszerErtekeles: {
      futes: fR > 0 ? { Enren: fE, EnrenRef: fR, szazalek: (fE / fR) * 100, minosites: rendszerMinosites('futes', (fE / fR) * 100) } : null,
      hmv: hR > 0 ? { Enren: hE, EnrenRef: hR, szazalek: (hE / hR) * 100, minosites: rendszerMinosites('hmv', (hE / hR) * 100) } : null,
      ...(refTeljes ? {
        hutes: rm('hutes', ind.celonkent.hutes.nren, refTeljes.ind.celonkent.hutes.nren),
        vilagitas: rm('vilagitas', ind.celonkent.vilagitas.nren, refTeljes.ind.celonkent.vilagitas.nren),
      } : {}),
    },
    figyelmeztetesek: fw,
  };
}

export { REFERENCIA_LAKO };
