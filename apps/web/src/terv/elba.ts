/**
 * Felület nélküli belépési pont: PDF-tervlapokból teljes épületmodell (IFC-szerű) – az ELBA mennyiségkiírásához.
 * Ugyanaz a folyamat, mint a Tervből lépésé (alaprajz-felismerés → szintek → falak, nyílások, födémek, pillérek,
 * koszorú, alapozás, tető), felhasználói döntések nélkül: a helyiségek besorolása a nevükből, a szintek a lapcímből,
 * az északi irány a rajzról / a homlokzatokból, a metszet az első metszetlap.
 *
 * Böngészőben fut (a lapok képe vásznon készül); a pdf.js a csomagban van, munkaszál nélkül.
 */
import { pdfLapok, lapTinta, alaprajzFeldolgoz, metszetFeldolgoz, type TervLap, type AlaprajzFeldolgozas } from '@terv/elemzes';
import { jegyzekSorok, szintekCimbol } from '@terv/alaprajz';
import { zartsagEllenoriz, type ZartsagHiba } from '@terv/zartsag';
import type { EpuletModell } from '@terv/epulet';
import { elemAlakok, type ElemAlak } from '@terv/forrasAlak';
import { homlokzatiAnyagok, jelmagyarazat, type HomlokzatiAnyag, type JelmagyarazatTetel } from '@terv/jelmagyarazat';
import { alapAllapot, elemzesLap, tervFolyamat, type FolyamatAllapot } from './folyamat';

export type { EpuletModell } from '@terv/epulet';
export type { ZartsagHiba } from '@terv/zartsag';
export type { ElemAlak } from '@terv/forrasAlak';
export { elemekPontban } from '@terv/forrasAlak';

export interface PdfbolEpuletEredmeny {
  modell: EpuletModell | null;
  /** A beolvasott lapok szerepe (alaprajz / metszet / homlokzat / leírás / egyéb) – ellenőrzéshez. */
  lapok: { fajl: string; oldal: number; szerep: TervLap['szerep']; cim: string; hiba?: string }[];
  /** Nem végzetes gondok (pl. olvashatatlan alaprajz, hiányzó metszet, nem zárt modell). */
  figyelmeztetes: string[];
  /** A modell zártság-ellenőrzése: ahol a beolvasás hiányos (hiányzó fal, fal–tető rés, tetőhézag, fedetlen rész) –
   *  hely (m, a modell koordinátáiban) és leírás, a 3D jelöléséhez. */
  zartsag: ZartsagHiba[];
  /** A modellelemek (fal, nyílás, tér, födém, pillér, gerenda) alakja a forrás-tervlapon – 2D ⇄ 3D kijelöléshez: a lap
   *  sorszáma (a `lapok` sorrendje) és sokszög lapkoordinátában (pt; a `lapKepek` képére: px = pt × kepSzel / szel). */
  elemAlakok: ElemAlak[];
  /** A lapok előnézeti képe (JPEG dataURL) és mérete: képpont, ill. a lap mérete pontban (a rárajzoláshoz). */
  lapKepek: { kep: string; kepSzel: number; kepMag: number; szel: number; mag: number }[];
  /** A homlokzati lapok számozott anyaglistája („1. Homlokzati nemesvakolat törtfehér, Baumit Life 0019”) – lapindexszel. */
  homlokzatiAnyagok: (HomlokzatiAnyag & { lap: number })[];
  /** A lapok jelmagyarázatának tételei (minta színe / mintázata / rétege → anyagnév) – lapindexszel. */
  jelmagyarazat: (JelmagyarazatTetel & { lap: number })[];
}

/**
 * PDF-fájlokból (File vagy { name, arrayBuffer() }) az épületmodell.
 * opciok.allapot: felülírható döntések – lapSzerep (lapindex → 'alaprajz' | 'metszet' | 'homlokzat' | 'leiras' | 'egyeb'; a
 * lapindex a visszaadott `lapok` sorrendje: fájlonként, oldalanként), szintKi (lapindex → szintkódok), bm (belmagasság) stb.
 */
export async function pdfbolEpulet(fajlok: (File | { name: string; type?: string; arrayBuffer(): Promise<ArrayBuffer> })[],
  opciok: { halad?: (arany: number, szoveg: string) => void; allapot?: Partial<FolyamatAllapot> & { lapSzerep?: Record<number, TervLap['szerep']> } } = {}): Promise<PdfbolEpuletEredmeny> {
  const lapok: TervLap[] = [], figyelmeztetes: string[] = [];
  for (const [fi, f] of fajlok.entries()) {
    try {
      const ll = await pdfLapok(f as File, 2000, (k, o) => opciok.halad?.((fi + (o ? k / o : 0)) / fajlok.length * 0.6, `${f.name}${o > 1 ? ` (${k}/${o}. oldal)` : ''}`));
      lapok.push(...ll);
    } catch (e) { figyelmeztetes.push(`${f.name}: a PDF nem olvasható (${(e as Error).message})`); }
  }
  // a lapok szerepének felülírása (lapindex: a visszaadott `lapok` sorrendje – fájlonként, oldalanként)
  for (const [k, v] of Object.entries(opciok.allapot?.lapSzerep ?? {})) {
    const l = lapok[Number(k)]; if (!l || !v) continue;
    // (alaprajznak jelölt lap: a falfelismeréshez a nagyobb felbontású kép is kell)
    if (v === 'alaprajz' && !l.tinta) { const f = fajlok.find((x) => x.name === l.fajl); if (f) l.tinta = await lapTinta(f as File, l.oldal); }
    l.szerep = v;
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
  // tetőtéri alaprajz (a lap címe „Tetőtér…”) és szögfelirat nélküli, de rajzolt magastető: tetőtér a rajzból mért hajlással
  const me1 = me0 && !me0.tetoter && me0.tetoHajlas && alaprajzok.some(({ l }) => szintekCimbol(l.cim ?? '').includes('T'))
    ? { ...me0, tetoter: { hajlas: me0.tetoHajlas, terdfal: null, terdfalTipp: null, belmagassag: null, padlo: me0.szintek.padlo.at(-1) ?? null } } : me0;
  const me = me1?.tetoter ? { ...me1, tetoter: { ...me1.tetoter, terdfal: me1.tetoter.terdfal ?? terdfal ?? null } } : me1;
  opciok.halad?.(0.97, 'épületmodell');
  let modell: EpuletModell | null = null;
  const { lapSzerep: _ls, ...allapot } = opciok.allapot ?? {}; void _ls;
  try { modell = tervFolyamat(alapAllapot(lapok, elemzesek, me, allapot)).epuletModell(); }
  catch (e) { figyelmeztetes.push(`Az épületmodell nem állt össze: ${(e as Error).message}`); }
  let zartsag: ZartsagHiba[] = [];
  if (modell) { try { zartsag = zartsagEllenoriz(modell); } catch { zartsag = []; } }
  if (zartsag.length) figyelmeztetes.push(`A modell nem zárt – a beolvasás ${zartsag.length} helyen hiányos: ${zartsag.slice(0, 5).map((h) => h.leiras).join('; ')}${zartsag.length > 5 ? ' …' : ''}`);
  opciok.halad?.(1, 'kész');
  let alakok: ElemAlak[] = [];
  if (modell) { try { alakok = elemAlakok(modell); } catch { alakok = []; } }
  const hAnyag = lapok.flatMap((l, i) => { if (l.szerep !== 'homlokzat') return []; try { return homlokzatiAnyagok(l.lap).map((x) => ({ ...x, lap: i })); } catch { return []; } });
  const jm = lapok.flatMap((l, i) => { try { return jelmagyarazat(l.lap).map((x) => ({ ...x, lap: i })); } catch { return []; } });
  return {
    modell, figyelmeztetes, zartsag, elemAlakok: alakok, homlokzatiAnyagok: hAnyag, jelmagyarazat: jm,
    lapKepek: lapok.map((l) => ({ kep: l.kep, kepSzel: l.kepSzel, kepMag: l.kepMag, szel: l.lap.szel, mag: l.lap.mag })),
    lapok: lapok.map((l, i) => ({ fajl: l.fajl, oldal: l.oldal, szerep: l.szerep, cim: l.cim, ...(typeof elemzesek[i] === 'string' ? { hiba: elemzesek[i] as string } : {}) })),
  };
}
