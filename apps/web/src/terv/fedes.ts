/**
 * Szintek egymásra vetítése: egy helyiség mekkora része van egy másik szint fűtött tere (vagy fala) alatt / felett.
 * Ebből adódik helyiségenként a tető (felette nincs fűtött tér) és a külső levegő / fűtetlen tér feletti födém
 * (alatta nincs fűtött tér). A lapok egy tervsorozatból valók, többnyire azonos helyzetben – az esetleges
 * eltolást a falak legjobb átfedése adja.
 */
import type { Raszter } from './raszter';

const lapX = (r: Raszter, cx: number) => r.x0 + ((cx + 0.5) * r.px) / r.mPerPt;
const lapY = (r: Raszter, cy: number) => r.y0 + ((cy + 0.5) * r.px) / r.mPerPt;

/** Falak 0,5 m-es rácson (lapkoordinátában, pt) – az eltolás kereséséhez. */
function falRacs(r: Raszter, lepesPt: number): Set<number> {
  const s = new Set<number>();
  for (let cy = 0; cy < r.h; cy++) for (let cx = 0; cx < r.w; cx++) {
    if (!r.fal[cy * r.w + cx]) continue;
    s.add(Math.round(lapX(r, cx) / lepesPt) * 100000 + Math.round(lapY(r, cy) / lepesPt));
  }
  return s;
}

/**
 * A `b` lap eltolása (pt) az `a` laphoz képest: `a` pontja (x, y) a `b` lapon (x + dx, y + dy).
 * null: a falak nem fedik egymást elég jól (más kivágat / lépték) – ilyenkor nem vetítünk.
 */
export function eltolas(a: Raszter, b: Raszter, maxM = 6): { dx: number; dy: number; fedes: number } | null {
  if (Math.abs(a.mPerPt - b.mPerPt) / a.mPerPt > 0.02) return null;
  const lepes = 0.5 / a.mPerPt; // 0,5 m
  const A = falRacs(a, lepes), B = falRacs(b, lepes);
  if (!A.size || !B.size) return null;
  const n = Math.round(maxM / 0.5);
  let leg = { i: 0, j: 0, db: -1 };
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
    let db = 0;
    for (const k of A) if (B.has(k + i * 100000 + j)) db++;
    if (db > leg.db || (db === leg.db && Math.abs(i) + Math.abs(j) < Math.abs(leg.i) + Math.abs(leg.j))) leg = { i, j, db };
  }
  const fedes = leg.db / Math.min(A.size, B.size);
  return fedes >= 0.25 ? { dx: leg.i * lepes, dy: leg.j * lepes, fedes } : null;
}

/**
 * Az `a` lap `ri`-edik raszter-helyiségének az a része (0…1), amely felett / alatt a `b` lapon fűtött helyiség
 * (`futottB` raszter-indexei) vagy fal van.
 */
export function fedettArany(a: Raszter, ri: number, b: Raszter, futottB: Set<number>, el: { dx: number; dy: number }): number {
  let ossz = 0, fed = 0;
  const lep = Math.max(1, Math.round(0.2 / a.px));
  for (let cy = 0; cy < a.h; cy += lep) for (let cx = 0; cx < a.w; cx += lep) {
    if (a.cimke[cy * a.w + cx] !== ri + 2) continue;
    ossz++;
    const x = lapX(a, cx) + el.dx, y = lapY(a, cy) + el.dy;
    const bx = Math.floor(((x - b.x0) * b.mPerPt) / b.px), by = Math.floor(((y - b.y0) * b.mPerPt) / b.px);
    if (bx < 0 || by < 0 || bx >= b.w || by >= b.h) continue;
    const k = by * b.w + bx, c = b.cimke[k]!;
    if (b.fal[k] || (c >= 2 && futottB.has(c - 2))) fed++;
  }
  return ossz ? fed / ossz : 1;
}
