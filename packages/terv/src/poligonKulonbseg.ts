/**
 * Sokszögek különbsége (A − B) rácson: a körvonalak főirányába forgatva a csúcsok x / y koordinátáiból álló
 * (nem egyenletes) rács celláit a középpontjuk szerint soroljuk be – derékszögű körvonalakon ez pontos, ferde élnél
 * 10 cm-es kiegészítő rácsvonalakkal közelítő. A B csúcsait a ±15 cm-en belüli A-koordinátákra illesztjük (a két
 * szint körvonala más-más lapról jön, a közös homlokzati síkok cm-es eltérése ne adjon szilánkot), a 0,4 m-nél
 * keskenyebb átlagszélességű vagy 1 m²-nél kisebb darabokat elhagyjuk. A darabok határán az élek két fajtája:
 * szél (A határa) és csatlakozás (B határa – a felső szint fala).
 */
import { foIrany } from './tetoModell';

type P2 = [number, number];
const forgat = (q: P2, fok: number): P2 => { const r = (fok * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r); return [q[0] * c - q[1] * s, q[0] * s + q[1] * c]; };
function benne(p: P2[], x: number, y: number) {
  let be = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, yi] = p[i]!, [xj, yj] = p[j]!; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) be = !be; }
  return be;
}
const derek = (p: P2[]) => p.every((a, i) => { const b = p[(i + 1) % p.length]!; const dx = b[0] - a[0], dy = b[1] - a[1]; if (Math.hypot(dx, dy) < 0.3) return true;
  const f = (Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI; return f <= 3 || f >= 87; });
const ter = (p: P2[]) => p.reduce((s, [x, y], i) => { const [x2, y2] = p[(i + 1) % p.length]!; return s + x * y2 - x2 * y; }, 0) / 2;

export interface Kulonbseg { poligonok: P2[][]; terulet: number; szel: number; csatl: number }

export function poligonKulonbseg(A0: P2[][], B0: P2[][]): Kulonbseg {
  const ures = { poligonok: [], terulet: 0, szel: 0, csatl: 0 };
  const fo = A0.slice().sort((p, q) => Math.abs(ter(q)) - Math.abs(ter(p)))[0]; if (!fo) return ures;
  const th = foIrany(fo);
  const A = A0.map((p) => p.map((q) => forgat(q, -th))), B1 = B0.map((p) => p.map((q) => forgat(q, -th)));
  const ax = A.flat().map((q) => q[0]), ay = A.flat().map((q) => q[1]);
  const illeszt = (v: number, t: number[]) => { let b = v, d0 = 0.15; for (const w of t) if (Math.abs(w - v) < d0) { d0 = Math.abs(w - v); b = w; } return b; };
  const B = B1.map((p) => p.map(([x, y]) => [illeszt(x, ax), illeszt(y, ay)] as P2));
  const kerek = (v: number) => Math.round(v * 1000) / 1000;
  const xs0 = new Set([...A, ...B].flat().map((q) => kerek(q[0]))), ys0 = new Set([...A, ...B].flat().map((q) => kerek(q[1])));
  if (![...A, ...B].every(derek)) {
    const x0 = Math.min(...ax), x1 = Math.max(...ax), y0 = Math.min(...ay), y1 = Math.max(...ay);
    for (let x = Math.ceil(x0 / 0.1) * 0.1; x < x1; x += 0.1) xs0.add(kerek(x));
    for (let y = Math.ceil(y0 / 0.1) * 0.1; y < y1; y += 0.1) ys0.add(kerek(y));
  }
  const xs = [...xs0].sort((a, b) => a - b), ys = [...ys0].sort((a, b) => a - b), nx = xs.length - 1, ny = ys.length - 1;
  if (nx < 1 || ny < 1) return ures;
  // cellák: 0 = A-n kívül, 1 = A − B, 2 = A ∩ B
  const c = new Uint8Array(nx * ny);
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const x = (xs[i]! + xs[i + 1]!) / 2, y = (ys[j]! + ys[j + 1]!) / 2;
    if (A.some((p) => benne(p, x, y))) c[j * nx + i] = B.some((p) => benne(p, x, y)) ? 2 : 1; }
  // összefüggő darabok; a kicsik / keskenyek elhagyása
  const komp = new Int32Array(nx * ny).fill(-1), darabok: number[][] = [];
  for (let k = 0; k < nx * ny; k++) {
    if (c[k] !== 1 || komp[k]! >= 0) continue;
    const d: number[] = [], sor = [k]; komp[k] = darabok.length;
    while (sor.length) { const q = sor.pop()!; d.push(q); const i = q % nx, j = (q - i) / nx;
      for (const [a, b] of [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]] as [number, number][]) { if (a < 0 || b < 0 || a >= nx || b >= ny) continue; const r = b * nx + a; if (c[r] === 1 && komp[r]! < 0) { komp[r] = darabok.length; sor.push(r); } } }
    darabok.push(d);
  }
  const cT = (q: number) => { const i = q % nx, j = (q - i) / nx; return (xs[i + 1]! - xs[i]!) * (ys[j + 1]! - ys[j]!); };
  const ki: Kulonbseg = { poligonok: [], terulet: 0, szel: 0, csatl: 0 };
  for (const d of darabok) {
    const T = d.reduce((s, q) => s + cT(q), 0);
    let bx0 = Infinity, bx1 = -Infinity, by0 = Infinity, by1 = -Infinity;
    for (const q of d) { const i = q % nx, j = (q - i) / nx; bx0 = Math.min(bx0, xs[i]!); bx1 = Math.max(bx1, xs[i + 1]!); by0 = Math.min(by0, ys[j]!); by1 = Math.max(by1, ys[j + 1]!); }
    if (T < 1 || T / Math.max(bx1 - bx0, by1 - by0) < 0.4) continue;
    ki.terulet += T;
    for (const p0 of korvonal(d, nx, xs, ys)) {
      const p = egyszerusit(p0, 0.08);
      // élek: a felezőpont 5 cm-rel kifelé B-ben → csatlakozás (a felső szint fala), A-n kívül → szél; különben belső vágás
      for (let i = 0; i < p.length; i++) { const a = p[i]!, b = p[(i + 1) % p.length]!, l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l < 1e-6) continue;
        const n = Math.max(1, Math.ceil(l / 0.1));
        for (let s = 0; s < n; s++) { const t = (s + 0.5) / n;
          const mx = a[0] + (b[0] - a[0]) * t + ((b[1] - a[1]) / l) * 0.05, my = a[1] + (b[1] - a[1]) * t - ((b[0] - a[0]) / l) * 0.05;
          if (B.some((q) => benne(q, mx, my))) ki.csatl += l / n; else if (!A.some((q) => benne(q, mx, my))) ki.szel += l / n; } }
      ki.poligonok.push(p.map((q) => forgat(q, th)));
    }
  }
  const k2 = (v: number) => Math.round(v * 100) / 100;
  return { poligonok: ki.poligonok.map((p) => p.map(([x, y]) => [k2(x), k2(y)] as P2)), terulet: k2(ki.terulet), szel: k2(ki.szel), csatl: k2(ki.csatl) };
}

/** Zárt sokszög egyszerűsítése (Douglas–Peucker, tűrés m) – a ferde élek lépcsőzetes rácsközelítése helyett. */
function egyszerusit(p: P2[], tur: number): P2[] {
  if (p.length < 5) return p;
  const dp = (q: P2[]): P2[] => {
    if (q.length < 3) return q;
    const a = q[0]!, b = q[q.length - 1]!, l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-9;
    let mi = 0, md = 0;
    for (let i = 1; i < q.length - 1; i++) { const d = Math.abs((b[0] - a[0]) * (a[1] - q[i]![1]) - (a[0] - q[i]![0]) * (b[1] - a[1])) / l; if (d > md) { md = d; mi = i; } }
    if (md <= tur) return [a, b];
    const x = dp(q.slice(0, mi + 1)), y = dp(q.slice(mi));
    return [...x.slice(0, -1), ...y];
  };
  // a legtávolabbi két csúcsnál kettévágva
  let k = 0, dm = 0; for (let i = 1; i < p.length; i++) { const d = Math.hypot(p[i]![0] - p[0]![0], p[i]![1] - p[0]![1]); if (d > dm) { dm = d; k = i; } }
  const e1 = dp(p.slice(0, k + 1)), e2 = dp([...p.slice(k), p[0]!]);
  const q = [...e1.slice(0, -1), ...e2.slice(0, -1)];
  return q.length >= 3 ? q : p;
}

/** Cellahalmaz körvonala (külső hurkok, pozitív körüljárással); lyuk esetén a halmazt a lyuk közepén kettévágjuk. */
function korvonal(d: number[], nx: number, xs: number[], ys: number[], mely = 0): P2[][] {
  const tag = new Set(d), el = new Map<string, string[]>();
  const kulcs = (i: number, j: number) => `${i},${j}`;
  const add = (a: string, b: string) => { const l = el.get(a) ?? []; l.push(b); el.set(a, l); };
  for (const q of d) { const i = q % nx, j = (q - i) / nx;
    if (!(j > 0 && tag.has(q - nx))) add(kulcs(i, j), kulcs(i + 1, j));
    if (!(i < nx - 1 && tag.has(q + 1))) add(kulcs(i + 1, j), kulcs(i + 1, j + 1));
    if (!tag.has(q + nx)) add(kulcs(i + 1, j + 1), kulcs(i, j + 1));
    if (!(i > 0 && tag.has(q - 1))) add(kulcs(i, j + 1), kulcs(i, j)); }
  const hurkok: P2[][] = [];
  for (;;) {
    const kezd = [...el.keys()].find((k) => el.get(k)!.length); if (!kezd) break;
    const h: string[] = []; let k = kezd;
    do { h.push(k); const l = el.get(k)!; const n = l.shift()!; k = n; } while (k !== kezd && el.get(k)?.length);
    const p = h.map((s) => { const [i, j] = s.split(',').map(Number); return [xs[i!]!, ys[j!]!] as P2; });
    // egy egyenesbe eső csúcsok elhagyása
    const q = p.filter((b, i) => { const a = p[(i - 1 + p.length) % p.length]!, c = p[(i + 1) % p.length]!; return Math.abs((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])) > 1e-9; });
    if (q.length >= 3) hurkok.push(q);
  }
  const lyuk = hurkok.find((p) => ter(p) < 0);
  if (!lyuk || mely > 4) return hurkok.filter((p) => ter(p) > 0);
  // vágás a lyuk közepén átmenő rácsoszlopnál
  const xk = (Math.min(...lyuk.map((q) => q[0])) + Math.max(...lyuk.map((q) => q[0]))) / 2;
  const iv = xs.findIndex((x, i) => i < nx && xs[i + 1]! > xk);
  const bal = d.filter((q) => q % nx <= iv), jobb = d.filter((q) => q % nx > iv);
  return [...(bal.length ? korvonal(bal, nx, xs, ys, mely + 1) : []), ...(jobb.length ? korvonal(jobb, nx, xs, ys, mely + 1) : [])];
}
