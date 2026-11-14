/** A tervfelismerés közös típusai (az alkalmazások modellje ezekre épül). */

/** Rétegrend szerepe a szerkezetben (metszetből felismerve). */
export type Szerep = 'fal' | 'padlas' | 'teto' | 'pincefodem' | 'padlo' | 'belso';
export interface RetegUI { id: string; anyagId?: string; nev?: string; dCm: number; lambda?: number; R?: number; legreteg?: 'zart' | 'intenziv'; /** Páradiffúziós ellenállási szám kézi értéke (üres: katalógus / jellemző érték). */ mu?: number;
  /** A rétegben futó bordák (szarufa, fogópár, fagerenda, fedélszék, váz): inhomogén réteg (4.1.4). */
  borda?: RetegBorda; }
export interface RetegBorda {
  /** A borda anyaga (alapból puhafa). */
  anyagId?: string; lambda?: number; nev?: string;
  /** Borda szélessége és tengelytávolsága (cm) – a területarány szel / tav. */
  szelCm: number; tavCm: number;
  /** A borda magassága a rétegben (cm); üres: a teljes rétegvastagság. Kisebb magasságnál a borda-szelet a borda és a
   * fölötte / alatta folytonos hőszigetelés soros ellenállása. */
  magCm?: number;
  /** A tervből becsült (a metszet szövegéből, alapértelmezett méretekkel) – ellenőrizendő. */
  becsult?: boolean;
}

/** Rövid egyedi azonosító. */
export const ujId = () => Math.random().toString(36).slice(2, 10);
