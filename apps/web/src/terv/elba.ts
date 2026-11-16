/**
 * Felület nélküli belépési pont: PDF-tervlapokból teljes épületmodell (IFC-szerű) – az ELBA mennyiségkiírásához.
 * Ugyanaz a folyamat, mint a Tervből lépésé (alaprajz-felismerés → szintek → falak, nyílások, födémek, pillérek,
 * koszorú, alapozás, tető), felhasználói döntések nélkül: a helyiségek besorolása a nevükből, a szintek a lapcímből,
 * az északi irány a rajzról / a homlokzatokból, a metszet az első metszetlap.
 *
 * Böngészőben fut (a lapok képe vásznon készül); a pdf.js a csomagban van, munkaszál nélkül.
 */
import { pdfLapok, alaprajzFeldolgoz, metszetFeldolgoz, type TervLap, type AlaprajzFeldolgozas } from '@terv/elemzes';
import { jegyzekSorok } from '@terv/alaprajz';
import type { EpuletModell } from '@terv/epulet';
import { alapAllapot, elemzesLap, tervFolyamat, type FolyamatAllapot } from './folyamat';

export type { EpuletModell } from '@terv/epulet';

export interface PdfbolEpuletEredmeny {
  modell: EpuletModell | null;
  /** A beolvasott lapok szerepe (alaprajz / metszet / homlokzat / leírás / egyéb) – ellenőrzéshez. */
  lapok: { fajl: string; oldal: number; szerep: TervLap['szerep']; cim: string; hiba?: string }[];
  /** Nem végzetes gondok (pl. olvashatatlan alaprajz, hiányzó metszet). */
  figyelmeztetes: string[];
}

/**
 * PDF-fájlokból (File vagy { name, arrayBuffer() }) az épületmodell.
 * opciok.allapot: felülírható döntések (pl. szintKi: lapindex → szintkódok, bm: belmagasság).
 */
export async function pdfbolEpulet(fajlok: (File | { name: string; type?: string; arrayBuffer(): Promise<ArrayBuffer> })[],
  opciok: { halad?: (arany: number, szoveg: string) => void; allapot?: Partial<FolyamatAllapot> } = {}): Promise<PdfbolEpuletEredmeny> {
  const lapok: TervLap[] = [], figyelmeztetes: string[] = [];
  for (const [fi, f] of fajlok.entries()) {
    try {
      const ll = await pdfLapok(f as File, 2000, (k, o) => opciok.halad?.((fi + (o ? k / o : 0)) / fajlok.length * 0.6, `${f.name}${o > 1 ? ` (${k}/${o}. oldal)` : ''}`));
      lapok.push(...ll);
    } catch (e) { figyelmeztetes.push(`${f.name}: a PDF nem olvasható (${(e as Error).message})`); }
  }
  // a műszaki leírás(ok) helyiséglistája – a helyiségpecsét nélküli alaprajzhoz
  const jegyzek = lapok.filter((l) => l.szerep === 'leiras').flatMap((l) => jegyzekSorok(l.lap.szovegek));
  const elemzesek: Record<number, AlaprajzFeldolgozas | string> = {};
  const alaprajzok = lapok.map((l, i) => ({ l, i })).filter(({ l }) => l.szerep === 'alaprajz');
  for (const [n, { l, i }] of alaprajzok.entries()) {
    opciok.halad?.(0.6 + (n / Math.max(1, alaprajzok.length)) * 0.35, `alaprajz felismerése: ${l.cim || l.fajl}`);
    await new Promise((r) => setTimeout(r, 0));
    try { const a = alaprajzFeldolgoz(l.lap, undefined, l.szurke, l.tinta, jegyzek); elemzesLap.set(a, l.lap); elemzesek[i] = a; }
    catch (e) { elemzesek[i] = (e as Error).message; figyelmeztetes.push(`${l.fajl} ${l.oldal}. oldal: az alaprajz nem ismerhető fel (${(e as Error).message})`); }
  }
  if (!alaprajzok.length) figyelmeztetes.push('Nincs alaprajzként felismert lap.');
  const mLap = lapok.find((l) => l.szerep === 'metszet');
  if (!mLap) figyelmeztetes.push('Nincs metszet: a födémek rétegrendje, a tető hajlása és a koszorú nem olvasható ki.');
  const me0 = mLap ? metszetFeldolgoz(mLap.lap) : null;
  const terdfal = opciok.allapot?.terdfalKezi;
  const me = me0?.tetoter ? { ...me0, tetoter: { ...me0.tetoter, terdfal: me0.tetoter.terdfal ?? terdfal ?? null } } : me0;
  opciok.halad?.(0.97, 'épületmodell');
  let modell: EpuletModell | null = null;
  try { modell = tervFolyamat(alapAllapot(lapok, elemzesek, me, opciok.allapot)).epuletModell(); }
  catch (e) { figyelmeztetes.push(`Az épületmodell nem állt össze: ${(e as Error).message}`); }
  opciok.halad?.(1, 'kész');
  return {
    modell, figyelmeztetes,
    lapok: lapok.map((l, i) => ({ fajl: l.fajl, oldal: l.oldal, szerep: l.szerep, cim: l.cim, ...(typeof elemzesek[i] === 'string' ? { hiba: elemzesek[i] as string } : {}) })),
  };
}
