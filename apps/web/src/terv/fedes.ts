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
  const keres = (i0: number, j0: number) => {
    let leg = { i: i0, j: j0, db: -1 };
    for (let i = i0 - n; i <= i0 + n; i++) for (let j = j0 - n; j <= j0 + n; j++) {
      let db = 0;
      for (const k of A) if (B.has(k + i * 100000 + j)) db++;
      if (db > leg.db || (db === leg.db && Math.abs(i - i0) + Math.abs(j - j0) < Math.abs(leg.i - i0) + Math.abs(leg.j - j0))) leg = { i, j, db };
    }
    return leg;
  };
  // kiinduló eltolások: a lapok azonos helyzetben (0), ill. egy lapon egymás alatt / mellett rajzolt szintek: a falak
  // befoglalójának közepe, bal felső és jobb alsó sarka szerint egymásra tolva
  const bb = (S: Set<number>) => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const k of S) { const x = Math.round(k / 100000), y = k - x * 100000; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return [x0, y0, x1, y1]; };
  const [a0, a1, a2, a3] = bb(A), [b0, b1, b2, b3] = bb(B);
  const kezdok: [number, number][] = [[0, 0], [Math.round((b0 + b2 - a0 - a2) / 2), Math.round((b1 + b3 - a1 - a3) / 2)], [b0 - a0, b1 - a1], [b2 - a2, b3 - a3]];
  let leg = { i: 0, j: 0, db: -1 };
  for (const [i0, j0] of kezdok) { const l = keres(i0, j0); if (l.db > leg.db * 1.05 || leg.db < 0) leg = l; if (i0 === 0 && j0 === 0 && l.db / Math.min(A.size, B.size) >= 0.5) break; }
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
