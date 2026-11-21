/**
 * Garázskapu a homlokzati rajzon: a szekcionált (és a lamellás billenő) kapu rajza egyforma hosszú, egymás alatti
 * vízszintes vonalak sora (a panelek osztása) – legalább három, 2,2–6,5 m hosszú, azonos kezdetű és végű (± 0,1 m),
 * 0,25–0,9 m-es közökkel; a kétszárnyú / toló kapu a két-három azonos szélességű, ≥ 1,8 m magas függőleges sávjával
 * itt nem számít (ritka; azoknál a kapu a felirat / a nyílás szélessége szerint).
 */
import type { Lap } from './kinyeres';

export interface HomlokzatiKapu { x0: number; x1: number; y0: number; y1: number; szel: number; mag: number; panelek: number }

export function homlokzatiKapuk(lap: Lap, mPerPt: number): HomlokzatiKapu[] {
  const vv: [number, number, number][] = [];
  for (const u of lap.utvonalak) {
    if (u.muvelet === 'none' || u.muvelet === 'fill') continue;
    if (u.reteg && /m[ée]retez|felirat|terep|k[öo]rnyezet|n[öo]v[ée]ny/i.test(u.reteg)) continue;
    for (const p of u.pontok) for (let i = 0; i + 3 < p.length; i += 2) {
      const x0 = p[i]!, y0 = p[i + 1]!, x1 = p[i + 2]!, y1 = p[i + 3]!;
      if (Math.abs(y1 - y0) > 0.3) continue;
      const L = Math.abs(x1 - x0) * mPerPt; if (L < 2.2 || L > 6.5) continue;
      vv.push([Math.min(x0, x1), Math.max(x0, x1), (y0 + y1) / 2]);
    }
  }
  const tol = 0.1 / mPerPt, ki: HomlokzatiKapu[] = [], kesz = new Set<number>();
  vv.sort((a, b) => a[2] - b[2]);
  for (let i = 0; i < vv.length; i++) {
    if (kesz.has(i)) continue;
    const [a0, a1] = vv[i]!;
    const sor = vv.map((v, j) => ({ v, j })).filter(({ v }) => Math.abs(v[0] - a0) <= tol && Math.abs(v[1] - a1) <= tol);
    // (egy magasságon csak egy vonal; egymást követő közök 0,25–0,9 m)
    const ys = [...new Set(sor.map(({ v }) => Math.round(v[2] * 10) / 10))].sort((p, q) => p - q);
    let best: number[] = [], cur: number[] = [];
    for (const y of ys) { if (cur.length && ((y - cur[cur.length - 1]!) * mPerPt < 0.25 || (y - cur[cur.length - 1]!) * mPerPt > 0.9)) { if ((y - cur[cur.length - 1]!) * mPerPt < 0.25) continue; if (cur.length > best.length) best = cur; cur = []; } cur.push(y); }
    if (cur.length > best.length) best = cur;
    for (const { j } of sor) kesz.add(j);
    if (best.length < 3) continue;
    const mag = (best[best.length - 1]! - best[0]!) * mPerPt;
    if (mag < 1.2 || mag > 3.5) continue;
    ki.push({ x0: a0, x1: a1, y0: best[0]!, y1: best[best.length - 1]!, szel: Math.round((a1 - a0) * mPerPt * 100) / 100, mag: Math.round(mag * 100) / 100, panelek: best.length });
  }
  return ki;
}
