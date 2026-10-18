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

export const UVEGEZESEK = epuletfizika.UVEGEZES_TAJEKOZTATO;
export const KERETEK = epuletfizika.KERET_TAJEKOZTATO;
export const ARNYEKOLOK = epuletfizika.ARNYEKOLO_G;
