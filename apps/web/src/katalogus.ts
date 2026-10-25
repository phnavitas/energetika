/**
 * Felületi katalógus. A beépített anyagok a számítómag alapkatalógusából jönnek (ugyanebből készül a seed).
 * Bejelentkezve hozzájönnek az iroda saját anyagai, és minden projekt magával viszi a benne használt
 * nem beépített anyagok pillanatképét (Projekt.anyagok), így fájlból vagy offline is számolható.
 */
import { epuletfizika } from '@mag/index';
import { ALAP_ANYAGOK, type Anyag } from '@mag/alapkatalogus';

export type { Anyag, Sraffozas } from '@mag/alapkatalogus';
export { SRAFFOZASOK } from '@mag/alapkatalogus';

let irodai: Anyag[] = [];
let projektbeli: Anyag[] = [];

/** Az iroda könyvtárából betöltött anyagok (bejelentkezés után). */
export function irodaiAnyagokBeallit(a: Anyag[]) { irodai = a.map((x) => ({ ...x, irodai: true })); }
/** Az aktuális projekt anyag-pillanatképe. */
export function projektAnyagokBeallit(a: Anyag[] | undefined) { projektbeli = a ?? []; }

export function anyag(id: string | undefined): Anyag | undefined {
  if (!id) return undefined;
  return ALAP_ANYAGOK.find((a) => a.id === id) ?? irodai.find((a) => a.id === id) ?? projektbeli.find((a) => a.id === id);
}

/** Választható anyagok: beépített, irodai, és a projektben lévő, a könyvtárban már nem szereplő anyagok. */
export function anyagLista(): Anyag[] {
  const l = [...ALAP_ANYAGOK, ...irodai];
  for (const a of projektbeli) if (!l.some((x) => x.id === a.id)) l.push(a);
  return l;
}

export function beepitett(id: string | undefined) { return !!id && ALAP_ANYAGOK.some((a) => a.id === id); }

/**
 * Üvegezések: a 4.1. táblázat tájékoztató sorai, kiegészítve a mai háromrétegű termékek jellemző (gyártói) értékeivel.
 * A kiegészítő sorok nem rendeleti értékek – a tényleges teljesítménynyilatkozat (Ug, g) szerint pontosítandók.
 */
export const UVEGEZESEK: readonly { kod: string; megnevezes: string; Ug: number; gn: number; lowe: boolean }[] = [
  ...epuletfizika.UVEGEZES_TAJEKOZTATO,
  { kod: 'haromreteg_07', megnevezes: 'Háromrétegű (4-14-4-14-4) két low-e, argon – gyártói jellemző érték', Ug: 0.7, gn: 0.53, lowe: true },
  { kod: 'haromreteg_06', megnevezes: 'Háromrétegű (4-16-4-16-4) két low-e, argon – gyártói jellemző érték', Ug: 0.6, gn: 0.52, lowe: true },
  { kod: 'haromreteg_05', megnevezes: 'Háromrétegű (4-18-4-18-4) két low-e, argon/kripton – gyártói jellemző érték', Ug: 0.5, gn: 0.5, lowe: true },
];
/** Keretek: a 4.2. táblázat tájékoztató sorai, kiegészítve mai profilok jellemző (gyártói) Uf értékeivel. */
export const KERETEK: readonly { kod: string; megnevezes: string; Uk: number; anyag: string }[] = [
  ...epuletfizika.KERET_TAJEKOZTATO,
  { kod: 'pvc_uf11', megnevezes: 'Műanyag, 5–6 kamrás, 70–82 mm – gyártói jellemző érték', Uk: 1.1, anyag: 'pvc' },
  { kod: 'pvc_uf09', megnevezes: 'Műanyag, 6–7 kamrás, ≥ 82 mm, középtömítéses – gyártói jellemző érték', Uk: 0.9, anyag: 'pvc' },
  { kod: 'fa_uf11', megnevezes: 'Fa, 88–92 mm (IV 92) – gyártói jellemző érték', Uk: 1.1, anyag: 'fa' },
  { kod: 'fem_uf11', megnevezes: 'Alumínium, erős hőhídmegszakítással (passzívház-profil) – gyártói jellemző érték', Uk: 1.1, anyag: 'fem' },
];
export const ARNYEKOLOK = epuletfizika.ARNYEKOLO_G;

/**
 * Ajtó- és kaputípusok beépített (teljes szerkezetre vonatkozó) hőátbocsátási tényezővel.
 * Forrás: Hörmann garázskapu-katalógus (86912, 2017; beépített kapu 5000 × 2125 mm, üvegezés nélkül) és
 * Hörmann termékáttekintés (83972; bejárati ajtók UD „kb. legfeljebb” értékei). A „becslés” jelű sorok
 * tájékoztató tervezői értékek – termékadat (teljesítménynyilatkozat) felülírja.
 */
export interface AjtoKapuSablon { kod: string; nev: string; leiras: string; fajta: 'kapu' | 'ajto'; U: number; forras: string; becsles?: boolean }
export const AJTO_KAPU_SABLONOK: AjtoKapuSablon[] = [
  { kod: 'kapu_szekc_67', fajta: 'kapu', nev: 'Szekcionált garázskapu, 67 mm PUR, hőhídmegszakítással', leiras: 'Kéthéjú acél, 67 mm poliuretánhab-töltésű szekciók, termikusan elválasztott (pl. Hörmann LPU 67 Thermo).', U: 1.0, forras: 'Hörmann 86912: beépített kapu U = 1,0 W/m²K' },
  { kod: 'kapu_szekc_42', fajta: 'kapu', nev: 'Szekcionált garázskapu, 42 mm PUR', leiras: 'Kéthéjú acél, 42 mm poliuretánhab-töltésű szekciók (pl. Hörmann LPU 42). A leggyakoribb családiház-kapu.', U: 1.4, forras: 'Hörmann 86912: beépített kapu U = 1,4 W/m²K' },
  { kod: 'kapu_fa', fajta: 'kapu', nev: 'Fa garázskapu (szekcionált, tömörfa betéttel)', leiras: 'Fa keretes, tömörfa betétes szekcionált kapu (pl. Hörmann LTH).', U: 3.0, forras: 'Hörmann 86912: beépített kapu U = 3,0 W/m²K' },
  { kod: 'kapu_billeno_szig', fajta: 'kapu', nev: 'Billenőkapu, hőszigetelt (habtöltésű) lappal', leiras: 'Acél billenőkapu utólag vagy gyárilag hőszigetelt kapulappal; a kerületi tömítés gyenge.', U: 3.0, forras: 'tervezői becslés (fa szekcionált kapuhoz hasonló)', becsles: true },
  { kod: 'kapu_redony', fajta: 'kapu', nev: 'Redőnykapu, habtöltésű alumínium lamellával', leiras: 'Feltekercselődő, PUR-habbal töltött alumínium lamellás garázskapu; a lamella vékony, a vezetősín tömítetlen.', U: 4.5, forras: 'tervezői becslés, termékadattal pontosítandó', becsles: true },
  { kod: 'kapu_acel_egyheju', fajta: 'kapu', nev: 'Egyhéjú acél garázskapu (billenő vagy szekcionált), szigeteletlen', leiras: 'Trapéz- vagy bordás acéllemez kapulap hőszigetelés nélkül; régi billenőkapuk.', U: 6.5, forras: 'Hörmann 86912 (LTE 42 egyhéjú acél): beépített kapu U = 6,5 W/m²K' },
  { kod: 'ajto_alu_carbon', fajta: 'ajto', nev: 'Alumínium bejárati ajtó, passzívház-szintű (≈ 0,5)', leiras: 'Szálerősített kompozit tokkal, vastag hőszigetelt ajtólappal (pl. Hörmann ThermoCarbon).', U: 0.5, forras: 'Hörmann 83972: UD kb. 0,47 W/m²K-ig' },
  { kod: 'ajto_acel_65', fajta: 'ajto', nev: 'Acél bejárati ajtó, 65 mm hőszigetelt lap', leiras: 'Hőhídmentes tok, 65 mm PUR-habbal töltött acél ajtólap (pl. Hörmann Thermo65).', U: 0.87, forras: 'Hörmann 83972: UD kb. 0,87 W/m²K-ig' },
  { kod: 'ajto_acel_46', fajta: 'ajto', nev: 'Acél bejárati ajtó, 46 mm hőszigetelt lap', leiras: 'Acél ajtólap 46 mm PUR-habbal, alumínium tok (pl. Hörmann Thermo46).', U: 1.1, forras: 'Hörmann 83972: UD kb. 1,1 W/m²K-ig' },
  { kod: 'ajto_fa_regi', fajta: 'ajto', nev: 'Régi tömör fa bejárati ajtó', leiras: 'Hőszigetelés nélküli, tömör vagy kazettás fa ajtólap, egyszerű tömítéssel.', U: 2.5, forras: 'tervezői becslés', becsles: true },
];
