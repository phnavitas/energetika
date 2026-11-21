/**
 * Berajzolt gépkocsi az alaprajzon: a garázs (vagy fedett beálló) jele akkor is, ha a térnek nincs helyiségpecsétje.
 * A kocsi rajza sok rövid vonal egy PDF-rétegen („KÖRNYEZET - auto”, „gépkocsi”, „car” …); a réteg vonalai közelség
 * szerint csoportosítva, a gépkocsi méretű (3,6–5,8 × 1,4–2,4 m) csoportok a kocsik. Réteg nélküli rajzon nem keresünk
 * (a bútor, burkolat ugyanilyen vonalakból áll – téves találat lenne).
 */
import type { Lap } from './kinyeres';

export interface Gepkocsi { x: number; y: number; hossz: number; szel: number; /** a hossztengely: 'v' vízszintes, 'f' függőleges (lapon) */ tengely: 'v' | 'f'; bbox: [number, number, number, number] }

const AUTO_RETEG = /(^|[^a-záéíóöőúüű])(aut[oó]k?|g[ée]pkocsi|g[ée]pj[áa]rm[űu]|j[áa]rm[űu]vek?|szem[ée]lyaut[oó]|cars?|vehicles?)([^a-záéíóöőúüű]|$)/i;

export function gepkocsik(lap: Lap, mPerPt: number): Gepkocsi[] {
  const el: [number, number, number, number][] = [];
  for (const u of lap.utvonalak) {
    if (!u.reteg || !AUTO_RETEG.test(u.reteg) || u.muvelet === 'none') continue;
    if (Math.max(u.bbox[2] - u.bbox[0], u.bbox[3] - u.bbox[1]) * mPerPt > 6) continue;
    el.push([...u.bbox] as [number, number, number, number]);
  }
  if (el.length < 10) return [];
  // közelség szerinti csoportok (≤ 0,15 m), rácsos gyorsítással
  const tol = 0.15 / mPerPt, cell = 1 / mPerPt;
  const apa = el.map((_, i) => i); const gy = (i: number): number => (apa[i] === i ? i : (apa[i] = gy(apa[i]!)));
  const racs = new Map<string, number[]>();
  el.forEach((b, i) => { for (let x = Math.floor((b[0] - tol) / cell); x <= Math.floor((b[2] + tol) / cell); x++) for (let y = Math.floor((b[1] - tol) / cell); y <= Math.floor((b[3] + tol) / cell); y++) { const k = `${x}|${y}`; const l = racs.get(k); if (l) l.push(i); else racs.set(k, [i]); } });
  for (const l of racs.values()) for (let a = 0; a < l.length; a++) for (let c = a + 1; c < l.length; c++) {
    const p = el[l[a]!]!, q = el[l[c]!]!;
    if (p[0] - tol <= q[2] && q[0] - tol <= p[2] && p[1] - tol <= q[3] && q[1] - tol <= p[3]) apa[gy(l[a]!)] = gy(l[c]!);
  }
  const cs = new Map<number, { b: [number, number, number, number]; db: number }>();
  el.forEach((b, i) => { const r = gy(i); const c = cs.get(r); if (c) { c.b = [Math.min(c.b[0], b[0]), Math.min(c.b[1], b[1]), Math.max(c.b[2], b[2]), Math.max(c.b[3], b[3])]; c.db++; } else cs.set(r, { b: [...b], db: 1 }); });
  const ki: Gepkocsi[] = [];
  for (const { b, db } of cs.values()) {
    const w = (b[2] - b[0]) * mPerPt, h = (b[3] - b[1]) * mPerPt, L = Math.max(w, h), S = Math.min(w, h);
    if (db < 10 || L < 3.6 || L > 5.8 || S < 1.4 || S > 2.4) continue;
    ki.push({ x: (b[0] + b[2]) / 2, y: (b[1] + b[3]) / 2, hossz: Math.round(L * 100) / 100, szel: Math.round(S * 100) / 100, tengely: w >= h ? 'v' : 'f', bbox: b });
  }
  return ki;
}
