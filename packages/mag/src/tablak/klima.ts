/**
 * Éghajlati adatok – 9/2023. (V. 25.) ÉKM rendelet 1. függelékéhez tartozó 2. Függelék, 1.2 pont
 * (egyszerűsített módszer). Forrás: kormany.hu dokumentumtár, 2023.07.27-i közzététel.
 */

export type Tajolas = 'É' | 'ÉK' | 'K' | 'DK' | 'D' | 'DNy' | 'Ny' | 'ÉNy';
export type Hajlasszog = 30 | 45 | 60 | 90;
export const TAJOLASOK: readonly Tajolas[] = ['É', 'ÉK', 'K', 'DK', 'D', 'DNy', 'Ny', 'ÉNy'];

/** A hónapok napjainak száma (nem szökőév). */
export const HONAP_NAPOK = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;
/** A hónapok hossza órában (Δt). */
export const HONAP_ORAK: readonly number[] = HONAP_NAPOK.map((n) => n * 24);

/** 2. Függelék 1.1. táblázat – Havi külső hőmérséklet átlagértékek [°C]. */
export const KULSO_HOMERSEKLET_HAVI: readonly number[] = [2.1, -0.1, 3.5, 10.9, 16.8, 20.8, 21.9, 21.0, 17.8, 8.3, 7.6, -0.1];
/** 2. Függelék 1.1. táblázat – Éves átlag [°C] (θe,év a talajjal érintkező szerkezetekhez, 6.7 képlet). */
export const KULSO_HOMERSEKLET_EVES = 10.9;

/** 2. Függelék 1.2. táblázat – Szezonális átlagok. */
export const SZEZON = {
  futes: { kezdet: 'okt. 15.', veg: 'ápr. 15.', atlagHomerseklet: 3.6, hosszOra: 4392 },
  hutes: { kezdet: 'máj. 15.', veg: 'szept. 15.', atlagHomerseklet: 20.6, hosszOra: 2976 },
} as const;

/** 2. Függelék 1.3. táblázat – Fagyvédelmi előfűtés: -4 °C alatti órák és azok átlaghőmérséklete, hónapindex 0..11. */
export const FAGYVEDELEM: Readonly<Record<number, { orak: number; atlag: number }>> = {
  0: { orak: 72, atlag: -5.82 },
  1: { orak: 110, atlag: -5.75 },
  2: { orak: 24, atlag: -6.0 },
  10: { orak: 1, atlag: -4.08 },
  11: { orak: 82, atlag: -5.51 },
};

/** 2. Függelék 1.4. táblázat – Relatív páratartalom havi átlag [%]. */
export const RELATIV_PARATARTALOM: readonly number[] = [84.4, 75.3, 77.8, 69.7, 61.0, 69.7, 62.1, 71.9, 66.8, 79.5, 86.1, 84.1];

/** 6.55 képlet – a lefedési arányokhoz becsült fűtési hőszükséglet külső méretezési hőmérséklete [°C]. */
export const KULSO_MERETEZESI_HOMERSEKLET_LEFEDESHEZ = -13;

/** 9.2.1.2 – hidegvíz hőmérséklet napkollektoros részletes számításhoz [°C]. */
export const HIDEGVIZ_HOMERSEKLET = 10.9;

// 2. Függelék 1.6. táblázat – Átlagos havi sugárzási energiahozam, Gs,i [kWh/m²/hó]
// Gépi kinyerés a forrásból; minden sor havi összege ellenőrizve az „Éves” oszloppal (tools/parse_klima.py).
export const GS_VIZSZINTES: readonly number[] = [33, 50.6, 66.6, 136.4, 197.1, 183, 173, 166.8, 112.7, 80.5, 43.7, 23.4];

export const GS_HAVI: Readonly<Record<Tajolas, Readonly<Record<Hajlasszog, readonly number[]>>>> = {
  'É': {
    30: [16.9, 24.2, 39.3, 96.1, 152.7, 152.5, 139.5, 120.5, 66.8, 31.5, 18.6, 14.5],
    45: [16.2, 22.7, 30.1, 69, 118.3, 125.5, 112, 88, 40.7, 26.2, 18.2, 13.7],
    60: [15.2, 21.4, 28.1, 48.5, 79, 92.9, 79.7, 57.2, 34.7, 25.6, 17.4, 12.7],
    90: [12.6, 18.1, 23.4, 41.1, 56.7, 60, 53.4, 47, 31.9, 23.5, 15.2, 10.1],
  },
  'ÉK': {
    30: [19.2, 31, 47.8, 105.9, 160.4, 153.7, 141.7, 127.3, 79.6, 46.8, 23.9, 15.4],
    45: [17.1, 26.8, 40, 89.2, 134.4, 130.3, 118.6, 105.2, 65.1, 37.6, 20.3, 13.9],
    60: [15.7, 24.1, 34.3, 75.7, 112, 109, 98.1, 87.5, 55.1, 32.8, 18.4, 12.8],
    90: [12.8, 19.4, 26.1, 55.8, 80.8, 77.5, 69.1, 64, 41.8, 26.7, 15.5, 10.1],
  },
  'K': {
    30: [31.7, 45.2, 62.8, 128.7, 184.5, 167.8, 157.3, 152.8, 106, 74.8, 41.2, 22.3],
    45: [30.6, 42.6, 59, 120.8, 171, 154.9, 144.4, 141.7, 99.8, 70.7, 39.4, 21.4],
    60: [28.8, 39.6, 53.9, 110.4, 154, 138.9, 128.6, 128.1, 91.5, 65.5, 36.7, 20],
    90: [23.3, 31.5, 40.7, 83.8, 113.8, 101.5, 92.8, 95.6, 69.9, 51, 29, 15.8],
  },
  'DK': {
    30: [46.6, 62.2, 76.4, 146.5, 202, 178.7, 170.7, 174, 129, 103.3, 60.9, 30.9],
    45: [50.1, 63.8, 76.6, 142.8, 192.3, 167.1, 159.9, 167.6, 128.5, 107.2, 65.3, 32.7],
    60: [51.1, 62.3, 73.2, 133.1, 174.6, 149.5, 143.4, 154.3, 122.3, 105.9, 66.1, 33],
    90: [45.3, 51.4, 57.7, 98.8, 121.8, 102.3, 98.2, 111.5, 94.3, 87.1, 57.4, 28.9],
  },
  'D': {
    30: [54.5, 73.3, 82.8, 153.6, 206.9, 182.1, 176.4, 184.3, 139.5, 118.8, 72, 36.5],
    45: [61.3, 79.3, 85, 150.4, 195.6, 168.3, 165, 178.6, 141.8, 128.6, 80.7, 40.5],
    60: [64.7, 81, 83, 139.5, 174.6, 146.8, 145.3, 163.3, 136.4, 130.9, 84.7, 42.4],
    90: [60.6, 71.5, 67, 98.3, 110, 88.4, 89.7, 110.4, 104.5, 113.5, 78.4, 39.6],
  },
  'DNy': {
    30: [48.4, 69.6, 77.3, 147.8, 201.7, 181.6, 175.3, 180.9, 131.5, 109.1, 64.8, 33.4],
    45: [52.6, 74.1, 77.6, 143.6, 190.8, 169.6, 164.8, 175.3, 131.4, 115, 70.5, 36.2],
    60: [54, 74.8, 74.2, 133.7, 173.1, 152, 148, 162.3, 125.4, 115.1, 72.3, 37.2],
    90: [48.5, 65.2, 58.5, 99.5, 121.7, 104.6, 102.2, 118.9, 97.1, 97.1, 64.2, 33.5],
  },
  'Ny': {
    30: [33.4, 53.9, 63.5, 130.2, 185.2, 174, 164.8, 162.4, 108.9, 81.2, 44.7, 24.3],
    45: [32.7, 53.7, 59.8, 122.7, 171.7, 161.6, 152.6, 153.3, 103.2, 79, 44, 24.1],
    60: [31.4, 51.7, 55, 113.2, 156, 146.9, 137.8, 141.2, 95.9, 75, 41.9, 23.3],
    90: [25.8, 42.8, 43, 88.6, 118.3, 111.4, 103.3, 109.9, 75.4, 60.6, 34.6, 19.5],
  },
  'ÉNy': {
    30: [19.7, 35.2, 48.3, 107.5, 162.6, 160.2, 148.6, 135.7, 81.8, 50.3, 25.1, 15.9],
    45: [17.5, 30.3, 41.1, 91.3, 136.8, 138.5, 127.1, 115, 68, 41.4, 21.6, 14.5],
    60: [16, 27, 36.3, 79.4, 115.5, 118.4, 107.5, 99, 59, 36.6, 19.9, 13.2],
    90: [13.1, 21.6, 28.4, 61.7, 87.3, 89.2, 79.9, 76.8, 46.8, 30.2, 16.7, 10.6],
  },
};

/** Havi sugárzási energiahozam adott tájolásra és hajlásszögre [kWh/m²]. Hajlásszög 0 = vízszintes. */
export function sugarzasiHozam(tajolas: Tajolas | null, hajlasszog: 0 | Hajlasszog, honap: number): number {
  const ertek = hajlasszog === 0 || tajolas === null ? GS_VIZSZINTES[honap] : GS_HAVI[tajolas][hajlasszog][honap];
  if (ertek === undefined) throw new Error(`Érvénytelen hónap: ${honap}`);
  return ertek;
}
