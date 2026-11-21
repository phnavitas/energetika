/**
 * A modellelemek alakja a forrás-tervlapon (visszakeresés, kölcsönös kijelölés 2D ⇄ 3D): minden falhoz, nyíláshoz,
 * helyiséghez (térhez), födémhez, pillérhez, gerendához a lap sorszáma és egy sokszög lapkoordinátában (pt, bal felső
 * origó, y lefelé – a pdf.js 1-es nagyítású nézetének koordinátái, a lap /Rotate forgatásával). A leképezés az
 * EpuletModell.lapok kapcsolatából jön (pt = x / mPerPt + o).
 */
import type { EpuletModell, LapKapcsolat } from './epulet';

type P2 = [number, number];

export interface ElemAlak {
  /** A modellelem azonosítója (fal: F…, nyílás: N…, tér, födém, pillér, gerenda). */
  id: string;
  tipus: 'fal' | 'nyilas' | 'ter' | 'fodem' | 'piller' | 'gerenda';
  /** A lap sorszáma (a beolvasott lapok sorrendjében). */
  lap: number;
  szint?: string;
  /** Zárt sokszög(ek) a lapon (pt). */
  poligonok: P2[][];
}

const keresKapcs = (lapok: LapKapcsolat[], szint?: string | null, lap?: number): LapKapcsolat | undefined =>
  (lap !== undefined ? lapok.find((k) => k.lap === lap && (!szint || k.szintek.includes(szint))) ?? lapok.find((k) => k.lap === lap) : undefined)
  ?? (szint ? lapok.find((k) => k.szintek.includes(szint)) : undefined);

/** Téglalap a tengely (a → b) körül, szélesség w (m). */
function sav(a: P2, b: P2, w: number): P2[] {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / L * w / 2, ny = (b[0] - a[0]) / L * w / 2;
  return [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]];
}

export function elemAlakok(md: EpuletModell): ElemAlak[] {
  const lapok = md.lapok ?? []; if (!lapok.length) return [];
  const ki: ElemAlak[] = [];
  const pt = (k: LapKapcsolat, p: P2): P2 => [p[0] / k.mPerPt + k.o[0], p[1] / k.mPerPt + k.o[1]];
  const add = (id: string, tipus: ElemAlak['tipus'], k: LapKapcsolat | undefined, pol: P2[][], szint?: string) => {
    if (!k || !pol.length) return;
    ki.push({ id, tipus, lap: k.lap, ...(szint ? { szint } : {}), poligonok: pol.map((p) => p.map((q) => pt(k, q))) });
  };
  const falak = new Map(md.falak.map((f) => [f.id, f]));
  for (const f of md.falak) add(f.id, 'fal', keresKapcs(lapok, f.szint, f.forras?.lap), [sav(f.a, f.b, Math.max(f.vastag, 0.02))], f.szint);
  for (const n of md.nyilasok) {
    const f = falak.get(n.fal); if (!f) continue;
    const L = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]) || 1, ux = (f.b[0] - f.a[0]) / L, uy = (f.b[1] - f.a[1]) / L;
    const a: P2 = [f.a[0] + ux * (n.t - n.szel / 2), f.a[1] + uy * (n.t - n.szel / 2)], b: P2 = [f.a[0] + ux * (n.t + n.szel / 2), f.a[1] + uy * (n.t + n.szel / 2)];
    add(n.id, 'nyilas', keresKapcs(lapok, n.szint, n.forras?.lap), [sav(a, b, Math.max(f.vastag, 0.1) + 0.04)], n.szint);
  }
  for (const t of md.terek) add(t.id, 'ter', keresKapcs(lapok, t.szint, t.forras?.lap), t.poligonok, t.szint);
  for (const d of md.fodemek) { const sz = d.folott ?? d.alatt ?? undefined; add(d.id, 'fodem', keresKapcs(lapok, sz), d.poligonok, sz); }
  for (const p of md.pillerek ?? []) add(p.id, 'piller', keresKapcs(lapok, p.szint), [[[p.kozep[0] - p.a / 2, p.kozep[1] - p.b / 2], [p.kozep[0] + p.a / 2, p.kozep[1] - p.b / 2], [p.kozep[0] + p.a / 2, p.kozep[1] + p.b / 2], [p.kozep[0] - p.a / 2, p.kozep[1] + p.b / 2]]], p.szint);
  for (const g of md.gerendak ?? []) add(g.id, 'gerenda', keresKapcs(lapok, g.szint), [sav(g.a, g.b, g.szel)], g.szint);
  return ki;
}

/** A lapon (pt) a ponthoz tartozó elemek – kattintásos kijelöléshez; a legkisebb területű (legbelső) elöl. */
export function elemekPontban(alakok: ElemAlak[], lap: number, x: number, y: number): ElemAlak[] {
  const benne = (p: P2[]) => { let b = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, yi] = p[i]!, [xj, yj] = p[j]!; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) b = !b; } return b; };
  const ter = (p: P2[]) => { let a = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j]![0] + p[i]![0]) * (p[j]![1] - p[i]![1]); return Math.abs(a / 2); };
  return alakok.filter((e) => e.lap === lap && e.poligonok.some(benne)).sort((a, b) => Math.min(...a.poligonok.map(ter)) - Math.min(...b.poligonok.map(ter)));
}
