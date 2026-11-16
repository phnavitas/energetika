/**
 * Pillérek az alaprajzról: a tartószerkezeti PDF-rétegen (pillér, oszlop, vasbeton / VB, beton, tartószerkezet) álló,
 * 15–80 cm-es, közel négyzetes (oldalarány ≤ 1,7) téglalap – kitöltött zárt alakzat, ill. különálló vonalakból összeálló
 * (két függőleges oldal azonos magasságtartománnyal, a végeiket összekötő vízszintes vonalakkal) téglalap.
 * A szigetelés, a burkolat rétege nem jelölt (a pillér körüli XPS-burkolat nem pillér).
 */
import type { Lap } from './kinyeres';

export interface TervPiller { x0: number; y0: number; x1: number; y1: number; reteg: string }

const TARTO = /pill[ée]r|oszlop|\bvb\b|vasbeton|beton|tart[óo]szerk/i;
const NEM = /h[őo]szigetel|burkolat|vakolat|b[úu]tor|ker[íi]t[ée]s|terep|k[öo]rnyezet/i;

export function pillerKeres(lap: Lap, mPerPt: number): TervPiller[] {
  const ok = (w: number, h: number) => { const a = w * mPerPt, b = h * mPerPt; return a >= 0.15 && a <= 0.8 && b >= 0.15 && b <= 0.8 && Math.max(a, b) <= 1.7 * Math.min(a, b); };
  const ki: TervPiller[] = [];
  const H: [number, number, number, string][] = [], V: [number, number, number, string][] = [];
  for (const u of lap.utvonalak) {
    if (!u.reteg || !TARTO.test(u.reteg) || NEM.test(u.reteg)) continue;
    const [bx0, by0, bx1, by1] = u.bbox;
    // kitöltött, zárt alakzat (egyetlen téglalap: a befoglaló a pillér)
    if (u.muvelet !== 'stroke' && u.muvelet !== 'none' && u.pontok.length === 1 && ok(bx1 - bx0, by1 - by0)) { ki.push({ x0: bx0, y0: by0, x1: bx1, y1: by1, reteg: u.reteg }); continue; }
    if (u.muvelet === 'fill') continue;
    for (const p of u.pontok) for (let i = 0; i + 3 < p.length; i += 2) {
      const ax = p[i]!, ay = p[i + 1]!, cx = p[i + 2]!, cy = p[i + 3]!;
      if (Math.abs(ay - cy) < 0.05 && Math.abs(ax - cx) * mPerPt >= 0.1) H.push([Math.min(ax, cx), Math.max(ax, cx), ay, u.reteg]);
      else if (Math.abs(ax - cx) < 0.05 && Math.abs(ay - cy) * mPerPt >= 0.1) V.push([Math.min(ay, cy), Math.max(ay, cy), ax, u.reteg]);
    }
  }
  // vonalakból összeálló téglalap
  const t = 0.6;
  for (const [a0, a1, ax, r] of V) for (const [b0, b1, bx] of V) {
    if (bx <= ax || Math.abs(a0 - b0) > t || Math.abs(a1 - b1) > t || !ok(bx - ax, a1 - a0)) continue;
    const vege = (y: number) => H.some(([x0, x1, hy]) => Math.abs(hy - y) < t && x0 <= ax + t && x1 >= bx - t);
    if (vege(a0) && vege(a1)) ki.push({ x0: ax, y0: a0, x1: bx, y1: a1, reteg: r });
  }
  // azonos (± 1 pt) téglalapok egyszer; a nagyobba eső kisebb (belső kontúr, mintázat) nem külön pillér
  const egy: TervPiller[] = [];
  for (const q of ki.sort((p, s) => (s.x1 - s.x0) * (s.y1 - s.y0) - (p.x1 - p.x0) * (p.y1 - p.y0)))
    if (!egy.some((o) => q.x0 >= o.x0 - 1 && q.y0 >= o.y0 - 1 && q.x1 <= o.x1 + 1 && q.y1 <= o.y1 + 1)) egy.push(q);
  return egy;
}
