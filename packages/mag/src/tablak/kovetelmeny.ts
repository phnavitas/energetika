/**
 * Követelmények – 9/2023. (V. 25.) ÉKM rendelet 1., 2., 3. és 5. melléklet.
 * Besorolás és értékelési osztályok – 176/2008. (VI. 30.) Korm. rendelet 3., 4., 5. melléklet.
 */

/**
 * 1. melléklet 1.1. – Határoló és nyílászáró szerkezetek hőátbocsátási tényezőjének követelményértékei [W/m²K].
 * `xmlKod`: az e-tanúsítás feltöltési fájl TypeOfStructure értéke. Csak a mintafájlban (WinWatt 9.54 export)
 * ténylegesen látott kódokat töltjük ki; a többi az XSD beszerzéséig `null`, hogy ne találgassunk.
 */
export interface SzerkezetKovetelmeny {
  sor: number;
  kod: string;
  megnevezes: string;
  Umax: number;
  xmlKod: string | null;
  /** 176/2008 Korm. r. 4. melléklet szerinti értékelési sor (ha van). */
  ertekelesiSor: ErtekelesiSzerkezet | null;
}

export const U_KOVETELMENYEK: readonly SzerkezetKovetelmeny[] = [
  { sor: 2, kod: 'homlokzati_fal', megnevezes: 'Homlokzati fal', Umax: 0.24, xmlKod: 'FacadeWall', ertekelesiSor: 'homlokzati_fal' },
  { sor: 3, kod: 'lapostető', megnevezes: 'Lapostető', Umax: 0.17, xmlKod: null, ertekelesiSor: 'teto' },
  { sor: 4, kod: 'futott_tetoter', megnevezes: 'Fűtött tetőteret határoló szerkezetek', Umax: 0.17, xmlKod: null, ertekelesiSor: 'teto' },
  { sor: 5, kod: 'padlasfodem', megnevezes: 'Padlás és búvótér alatti födém', Umax: 0.17, xmlKod: 'FloorStructureBelowAtticAndCrawlSpace', ertekelesiSor: 'padlasfodem' },
  { sor: 6, kod: 'arkadfodem', megnevezes: 'Árkád és áthajtó feletti födém', Umax: 0.17, xmlKod: null, ertekelesiSor: null },
  { sor: 7, kod: 'also_zarofodem', megnevezes: 'Alsó zárófödém fűtetlen terek felett', Umax: 0.26, xmlKod: null, ertekelesiSor: 'pincefodem' },
  { sor: 8, kod: 'uvegezes', megnevezes: 'Üvegezés', Umax: 1.0, xmlKod: null, ertekelesiSor: null },
  { sor: 9, kod: 'kulonleges_uvegezes', megnevezes: 'Különleges üvegezés (magas akusztikai vagy biztonsági követelményű)', Umax: 1.2, xmlKod: null, ertekelesiSor: null },
  { sor: 10, kod: 'ablak_fa_pvc', megnevezes: 'Fa vagy PVC keretszerkezetű homlokzati üvegezett nyílászáró (> 0,5 m²)', Umax: 1.1, xmlKod: 'FacadeOpeningsWithWoodenOrPvcFrames', ertekelesiSor: 'nyilaszaro' },
  { sor: 11, kod: 'ablak_fem', megnevezes: 'Fém keretszerkezetű homlokzati üvegezett nyílászáró (> 0,5 m²)', Umax: 1.4, xmlKod: null, ertekelesiSor: 'nyilaszaro' },
  { sor: 12, kod: 'fuggonyfal', megnevezes: 'Homlokzati üvegfal, függönyfal', Umax: 1.4, xmlKod: null, ertekelesiSor: 'nyilaszaro' },
  { sor: 13, kod: 'uvegteto', megnevezes: 'Üvegtető', Umax: 1.5, xmlKod: null, ertekelesiSor: null },
  { sor: 14, kod: 'felulvilagito', megnevezes: 'Tetőfelülvilágító, füstelvezető kupola (> 0,5 m²)', Umax: 1.7, xmlKod: null, ertekelesiSor: null },
  { sor: 15, kod: 'tetosik_ablak', megnevezes: 'Tetősík ablak (> 0,5 m²)', Umax: 1.3, xmlKod: null, ertekelesiSor: 'tetosik_ablak' },
  { sor: 16, kod: 'ipari_ajto', megnevezes: 'Ipari és tűzgátló ajtó és kapu (fűtött tér határolására)', Umax: 2.0, xmlKod: null, ertekelesiSor: null },
  { sor: 17, kod: 'ajto', megnevezes: 'Homlokzati vagy fűtött és fűtetlen terek közötti ajtó', Umax: 1.4, xmlKod: 'DoorBetweenFacadeOrHeatedAndUnheatedSpaces', ertekelesiSor: null },
  { sor: 18, kod: 'kapu', megnevezes: 'Homlokzati vagy fűtött és fűtetlen terek közötti kapu', Umax: 1.8, xmlKod: null, ertekelesiSor: null },
  { sor: 19, kod: 'futott_futetlen_fal', megnevezes: 'Fűtött és fűtetlen terek közötti fal', Umax: 0.4, xmlKod: null, ertekelesiSor: null },
  { sor: 20, kod: 'szomszed_fal', megnevezes: 'Szomszédos fűtött épületek és épületrészek közötti fal', Umax: 1.5, xmlKod: null, ertekelesiSor: null },
  { sor: 21, kod: 'labazati_fal', megnevezes: 'Lábazati fal', Umax: 0.3, xmlKod: null, ertekelesiSor: null },
  { sor: 22, kod: 'talajjal_erintkezo_fal', megnevezes: 'Talajjal érintkező fal (csak új épületeknél)', Umax: 0.3, xmlKod: null, ertekelesiSor: 'talajjal_erintkezo_fal' },
  { sor: 23, kod: 'talajon_fekvo_padlo', megnevezes: 'Talajon fekvő padló (új épületeknél)', Umax: 0.3, xmlKod: 'GroundLevelFloorInNewBuildings', ertekelesiSor: 'talajon_fekvo_padlo' },
  { sor: 24, kod: 'energiagyujto_fal', megnevezes: 'Hagyományos energiagyűjtő falak (pl. tömegfal, Trombe fal)', Umax: 1.0, xmlKod: null, ertekelesiSor: null },
];

/** 1. melléklet 2. – Nyári hővédelem: megengedett átlag (gH·gárny,H·Fárny) – a WinWatt jegyzőkönyv szerint 0,3. */
export const NYARI_HOVEDELEM = {
  /** A követelmény akkor lép életbe, ha az érintett transzparens felület > hasznos alapterület 8%-a. */
  kuszobArany: 0.08,
  /** A képlet a rendelet szövegében képként szerepel; a 0,3 határértéket a WinWatt 9.54 jegyzőkönyv mutatja („0.044 <= 0,3”). Ellenőrizendő. */
  megengedettAtlag: 0.3,
} as const;

/** Fajlagos hőveszteség-tényező megengedett értéke [W/m³K] a felület/térfogat arány függvényében. */
function qmFv(aV: number, also: number, alap: number, meredekseg: number, felso: number): number {
  if (aV <= 0.3) return also;
  if (aV >= 1.3) return felso;
  return alap + meredekseg * aV;
}

/**
 * 2. melléklet 1.2. (közel nulla energiaigényű épület). A forrás 2. sorában „0,3 ≤ A/V ≤ 1,0” áll, de a 3. sor
 * 1,3-tól folytatódik, és 0,071 + 0,23·1,3 = 0,37 – vagyis a 2. sor helyesen 1,3-ig tart (szerkesztési hiba a forrásban).
 */
export const qmMaxKozelNulla = (aV: number) => qmFv(aV, 0.14, 0.071, 0.23, 0.37);
/** 3. melléklet 1.2. (jelentős felújítás). */
export const qmMaxFelujitas = (aV: number) => qmFv(aV, 0.18, 0.078, 0.34, 0.52);

/** 5. melléklet 1.2. – Lakó és szállás jellegű épületek rögzített referenciaértékei (nem dinamikus szimuláció esetén). */
export const REFERENCIA_LAKO = { EnrenFajl: 95, ECO2Fajl: 25 } as const;

/** 2. melléklet 2.1. és 3.1. – Közel nulla követelmény lakóépületre: 0,8 × referencia. */
export const KOZEL_NULLA_LAKO = { EnrenFajlMax: 0.8 * REFERENCIA_LAKO.EnrenFajl, ECO2FajlMax: 0.8 * REFERENCIA_LAKO.ECO2Fajl } as const;

/** 3. melléklet 2.2. – Jelentős felújítás, lakóépület: összesített energetikai jellemző követelményértéke [kWh/m²év]. */
export function EnrenMaxFelujitasLako(aV: number): number {
  if (aV <= 0.3) return 110;
  if (aV >= 1.3) return 150;
  return 40 * aV + 98;
}

// ---------------------------------------------------------------------------------------------
// 176/2008. (VI. 30.) Korm. rendelet

/** 3. melléklet – Energetikai minőség és CO₂ szerinti besorolás; a százalék a követelményértékhez viszonyított arány.
 * Alsó határ kizárt, felső határ beleszámít; A+++: ≤ 0%. */
export const BESOROLAS_HATAROK: readonly { osztaly: string; felsoHatar: number }[] = [
  { osztaly: 'A+++', felsoHatar: 0 },
  { osztaly: 'A++', felsoHatar: 50 },
  { osztaly: 'A+', felsoHatar: 90 },
  { osztaly: 'A', felsoHatar: 100 },
  { osztaly: 'B', felsoHatar: 130 },
  { osztaly: 'C', felsoHatar: 160 },
  { osztaly: 'D', felsoHatar: 200 },
  { osztaly: 'E', felsoHatar: 250 },
  { osztaly: 'F', felsoHatar: 310 },
  { osztaly: 'G', felsoHatar: 390 },
  { osztaly: 'H', felsoHatar: 500 },
  { osztaly: 'I', felsoHatar: Infinity },
];

export function besorolas(szazalek: number): string {
  for (const h of BESOROLAS_HATAROK) if (szazalek <= h.felsoHatar) return h.osztaly;
  return 'I';
}

export type Minosites = 'kivalo' | 'jo' | 'kozepes' | 'gyenge' | 'rossz';
/** Az e-tanúsítás XML minősítési kódjai: a mintafájlban látott 'Excellent' és 'Good'. A többi az XSD-ből ellenőrizendő. */
export const MINOSITES_XML: Readonly<Record<Minosites, string | null>> = {
  kivalo: 'Excellent',
  jo: 'Good',
  kozepes: null,
  gyenge: null,
  rossz: null,
};

export type ErtekelesiSzerkezet =
  | 'homlokzati_fal' | 'padlasfodem' | 'talajjal_erintkezo_fal' | 'talajon_fekvo_padlo'
  | 'pincefodem' | 'teto' | 'nyilaszaro' | 'tetosik_ablak';

/** 4. melléklet – Épületszerkezetek értékelési osztályai: felső határok [W/m²K] kiváló → gyenge; e fölött rossz. */
export const SZERKEZET_ERTEKELES: Readonly<Record<ErtekelesiSzerkezet, readonly [number, number, number, number]>> = {
  homlokzati_fal: [0.16, 0.24, 0.45, 0.9],
  padlasfodem: [0.12, 0.17, 0.3, 0.7],
  talajjal_erintkezo_fal: [0.2, 0.3, 0.5, 0.8],
  talajon_fekvo_padlo: [0.2, 0.3, 0.5, 0.8],
  pincefodem: [0.2, 0.26, 0.5, 0.9],
  teto: [0.12, 0.17, 0.3, 0.7],
  nyilaszaro: [0.8, 1.1, 1.5, 3.0],
  tetosik_ablak: [1.1, 1.3, 1.5, 3.0],
};

const SORREND: readonly Minosites[] = ['kivalo', 'jo', 'kozepes', 'gyenge', 'rossz'];

export function szerkezetMinosites(sor: ErtekelesiSzerkezet, U: number): Minosites {
  const h = SZERKEZET_ERTEKELES[sor];
  for (let i = 0; i < 4; i++) if (U <= h[i]!) return SORREND[i]!;
  return 'rossz';
}

export type RendszerTipus = 'futes' | 'futes_szellozes' | 'hmv' | 'hutes' | 'vilagitas';
/** 5. melléklet – Épülettechnikai rendszerek értékelési osztályai: Enren / Enren,ref [%] felső határai kiváló → gyenge. */
export const RENDSZER_ERTEKELES: Readonly<Record<RendszerTipus, readonly [number, number, number, number]>> = {
  futes: [70, 95, 105, 130],
  futes_szellozes: [55, 90, 105, 120],
  hmv: [50, 90, 105, 120],
  hutes: [80, 95, 110, 125],
  vilagitas: [85, 115, 250, 800],
};

export function rendszerMinosites(tipus: RendszerTipus, szazalek: number): Minosites {
  const h = RENDSZER_ERTEKELES[tipus];
  for (let i = 0; i < 4; i++) if (szazalek <= h[i]!) return SORREND[i]!;
  return 'rossz';
}
