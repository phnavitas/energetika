/**
 * Jelmagyarázat (anyagjelölések) a tervlapon: minta + név párok – a falak, rétegek kitöltésének (színének,
 * mintázatának) anyagneve („vasbeton”, „tégla válaszfal”, „EPS homlokzati hőszig.”). A cím („Jelmagyarázat”,
 * „Jelkulcs”, „Anyagjelölések”) alatt / mellett álló szövegek, mindegyiktől balra egy kicsi kitöltött alakzat (a minta).
 * (Az ELBA korábbi PDF-értelmezőjének jelmagyarázat-olvasója alapján.)
 */
import type { Lap, Utvonal } from './kinyeres';

export interface JelmagyarazatTetel {
  nev: string;
  /** A minta kitöltőszíne (#rrggbb); `minta`: mintázattal (sraffozással) kitöltött. */
  szin: string; minta: boolean;
  /** A minta PDF-rétege (ArchiCAD-exportban tételenként saját réteg is lehet). */
  reteg?: string;
  /** A felirat helye (pt). */
  x: number; y: number;
}

const CIM = /^(jelmagyar[áa]zat|jelkulcs|anyagjel[öo]l[ée]sek)\b/i;

export function jelmagyarazat(lap: Lap): JelmagyarazatTetel[] {
  const cimek = lap.szovegek.filter((t) => CIM.test(t.s.trim()) && Math.abs(t.szog) < 1);
  if (!cimek.length) return [];
  // kicsi kitöltött alakzatok (minta-jelöltek) – egyszer gyűjtve
  const mintak = lap.utvonalak.filter((u) => {
    if (u.muvelet === 'stroke') return false;
    const w = u.bbox[2] - u.bbox[0], h = u.bbox[3] - u.bbox[1];
    return w >= 3 && h >= 2 && w <= 60 && h <= 30;
  });
  const ki: JelmagyarazatTetel[] = [];
  const latott = new Set<string>();
  for (const c of cimek) {
    const jeloltek = lap.szovegek.filter((t) => t !== c && Math.abs(t.szog) < 1 && t.y > c.y - 2 && t.y < c.y + 260 && t.x > c.x - 40 && t.x < c.x + 700
      && /[a-záéíóöőúüű]{3,}/i.test(t.s) && !CIM.test(t.s.trim()));
    for (const t of jeloltek) {
      const y0 = t.y - t.meret, y1 = t.y + t.meret * 0.25;
      let leg: { u: Utvonal; d: number } | null = null;
      for (const u of mintak) {
        const b = u.bbox; if (b[3] < y0 - 2 || b[1] > y1 + 2) continue;
        const d = t.x - b[2]; if (d < -2 || d > 40) continue;
        if (!leg || d < leg.d) leg = { u, d };
      }
      if (!leg) continue;
      // a minta-téglalapon belül a fehér háttér fölé rajzolt színes / mintázatos kitöltés a minta (a fehér csak keret)
      const b0 = leg.u.bbox;
      const reteg = mintak.filter((u) => u.bbox[0] < b0[2] - 0.5 && u.bbox[2] > b0[0] + 0.5 && u.bbox[1] < b0[3] - 0.5 && u.bbox[3] > b0[1] + 0.5);
      const feher = (c: string) => /^#f[a-f0-9]f[a-f0-9]f[a-f0-9]$/i.test(c);
      const sz = reteg.find((u) => u.minta) ?? reteg.find((u) => !feher(u.toltoSzin));
      if (!sz) continue;
      leg = { u: sz, d: leg.d };
      const nev = t.s.trim().replace(/\s+/g, ' ');
      const k = `${nev}|${leg.u.toltoSzin}`; if (latott.has(k)) continue; latott.add(k);
      ki.push({ nev, szin: leg.u.toltoSzin, minta: !!leg.u.minta, ...(leg.u.reteg ? { reteg: leg.u.reteg } : {}), x: t.x, y: t.y });
    }
  }
  return ki;
}

/** A kitöltés (szín, mintázat-e, réteg) jelmagyarázat szerinti neve – csak egyértelmű egyezésnél. */
export function jelmagyarazatNev(tetelek: JelmagyarazatTetel[], q: { szin: string; reteg?: string; minta?: boolean }): string | undefined {
  if (q.reteg) { const r = tetelek.filter((t) => t.reteg === q.reteg); if (r.length === 1) return r[0]!.nev; }
  const sz = tetelek.filter((t) => t.szin.toLowerCase() === q.szin.toLowerCase() && (q.minta === undefined || t.minta === q.minta));
  const nevek = [...new Set(sz.map((t) => t.nev))];
  return nevek.length === 1 ? nevek[0] : undefined;
}
