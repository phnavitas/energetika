/**
 * Eltérő belmagasságú épületrészek (pl. csarnok + fejépület) helyiségenként: a metszet belmagasság-sávjai az alaprajz
 * raszteréhez illesztve. A metszet vonala a lapon nem ismert (a metszetjel sokszor rajzelem): a metszet hossza szerint
 * dől el, hogy az alaprajz melyik tengelyével párhuzamos, a sávhatár (a két épületrész közti fal) helyét és a metszet
 * irányát (tükrözés) pedig az alaprajz azon hosszú, a tengelyre merőleges falvonala adja, amelyhez a metszet szerinti
 * sávszélesség a legjobban illik. Egy szintes épületre (a metszet függőleges méretszámai a padlótól mértek).
 */
import type { Raszter } from './raszter';
import type { BelmagSavok } from './metszetGeom';

export interface HelyisegMagassag {
  /** raszterindex → belmagasság (m) */
  magassag: Map<number, number>;
  /** a választott metszetrajz sávjai az alaprajzon (m, a tengely mentén) */
  tengely: 'x' | 'y'; hatarok: number[]; savok: number[];
}

export function helyisegMagassagok(r: Raszter, metszetek: BelmagSavok[], riLista: number[]): HelyisegMagassag | null {
  const { w, h, px } = r;
  // az épület kiterjedése (m) a falpixelekből
  // (a vizsgált helyiségek kiterjedése, a külső falvastagsággal – a lapon lévő többi vonal nélkül)
  const ri2 = new Set(riLista.map((x) => x + 2));
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (ri2.has(r.cimke[y * w + x]!)) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const fv = Math.round(0.4 / px); x0 = Math.max(0, x0 - fv); y0 = Math.max(0, y0 - fv); x1 = Math.min(w - 1, x1 + fv); y1 = Math.min(h - 1, y1 + fv);
  if (!(x1 > x0 && y1 > y0)) return null;
  const Lx = (x1 - x0) * px, Ly = (y1 - y0) * px;
  // falprofil a tengely mentén: a merőleges rácsvonalon a falpixelek aránya (hosszú, átmenő falnál nagy)
  const profil = (ax: 'x' | 'y') => {
    const n = ax === 'x' ? w : h, p = new Float64Array(n);
    if (ax === 'x') for (let x = x0; x <= x1; x++) { let c = 0; for (let y = y0; y <= y1; y++) if (r.fal[y * w + x]) c++; p[x] = c / (y1 - y0 + 1); }
    else for (let y = y0; y <= y1; y++) { let c = 0; for (let x = x0; x <= x1; x++) if (r.fal[y * w + x]) c++; p[y] = c / (x1 - x0 + 1); }
    return p;
  };
  let leg: (HelyisegMagassag & { pont: number }) | null = null;
  for (const m of metszetek) {
    const L = (m.s1 - m.s0) * m.mPt;
    for (const ax of ['x', 'y'] as const) {
      const LP = ax === 'x' ? Lx : Ly, P0 = (ax === 'x' ? x0 : y0) * px, P1 = (ax === 'x' ? x1 : y1) * px;
      // (a metszet kiterjedésébe a két szélső szintjel is beleszámít – néhány méterrel hosszabb lehet)
      if (L < LP * 0.85 || L > LP + 8) continue;
      const pr = profil(ax);
      const fal = (t: number) => { const i = Math.round(t / px); let v = 0; for (let d = -Math.round(0.4 / px); d <= Math.round(0.4 / px); d++) v = Math.max(v, pr[i + d] ?? 0); return v; };
      const hatar0 = m.savok.slice(0, -1).map((s) => (s.s1 - m.s0) * m.mPt);
      // eltolás (a metszet bal széle és az épület széle közt) és irány: a sávhatárok a legerősebb falvonalakra essenek
      for (const tukor of [false, true]) for (let off = -1; off <= (L - LP) + 1; off += 0.1) {
        const t = hatar0.map((u) => (tukor ? P1 - (u - off) : P0 + (u - off)));
        if (t.some((v) => v <= P0 + 1 || v >= P1 - 1)) continue;
        const pont = t.reduce((q, v) => q + fal(v), 0) / t.length;
        if (!leg || pont > leg.pont + 1e-9) {
          // a sávhatár pontosan a legerősebb falvonalra (± 0,4 m)
          const hatarok = t.map((v) => { let b = v, bv = -1; for (let d = -0.4; d <= 0.4; d += px) { const q = pr[Math.round((v + d) / px)] ?? 0; if (q > bv) { bv = q; b = v + d; } } return b; });
          const savH = m.savok.map((s) => s.h); if (tukor) { savH.reverse(); hatarok.reverse(); }
          leg = { pont, tengely: ax, hatarok, savok: savH, magassag: new Map() };
        }
      }
    }
  }
  // a sávhatárnak valódi, a merőleges kiterjedés nagy részén átmenő falon kell lennie
  if (!leg || leg.pont < 0.35) return null;
  // helyiségenként: a raszterpixelek tengely menti mediánja szerinti sáv
  for (const ri of riLista) {
    const v: number[] = [];
    for (let k = 0; k < w * h; k += 3) if (r.cimke[k] === ri + 2) v.push(((leg.tengely === 'x' ? k % w : Math.floor(k / w)) + 0.5) * px);
    if (!v.length) continue;
    v.sort((a, b) => a - b); const med = v[Math.floor(v.length / 2)]!;
    let si = 0; while (si < leg.hatarok.length && med > leg.hatarok[si]!) si++;
    leg.magassag.set(ri, leg.savok[si]!);
  }
  return leg;
}
