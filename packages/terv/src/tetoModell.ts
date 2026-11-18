/**
 * Magastető-geometria az alaprajzi körvonalból (az ELBA a tetőt a geometriából azonosítja – ElbaBimGeometria.tetoBontas –,
 * ezért a modell a tető felületét háromszögekként adja, a bontást az ELBA szabályai végzik).
 *
 * Módszer (derékszögű körvonalra): a tető ereszvonala a körvonal az ereszkiállással kifelé tolva; ezt maximális
 * téglalapokra bontjuk (a körvonalon belüli, más téglalapban nem foglalt téglalapok). Minden téglalap saját
 * nyereg- / kontyolt teteje a négy (oromfalas végnél három) ereszsík alsó burkolója (konvex alakzaton ez pontos); az
 * összetett tető a téglalap-tetők felső burkolója (a vápák így adódnak). A tetőlapok konvex sokszögek (félsík-vágással),
 * a csúcsaik magassága a saját síkjukon.
 */
export type P2 = [number, number];
export type P3 = [number, number, number];

/** Sík: z = tg · (n · p − c) – a téglalap egy ereszéle (n befelé mutató egységnormális, c az él egyenese). */
interface Sik { nx: number; ny: number; c: number }
interface Teglalap { x0: number; y0: number; x1: number; y1: number; sikok: Sik[] }

const z0 = (s: Sik, x: number, y: number) => s.nx * x + s.ny * y - s.c;

/** Konvex sokszög vágása az a·x + b·y + c ≥ 0 félsíkkal. */
function vag(p: P2[], a: number, b: number, c: number): P2[] {
  const ki: P2[] = [];
  for (let i = 0; i < p.length; i++) {
    const P = p[i]!, Q = p[(i + 1) % p.length]!;
    const fp = a * P[0] + b * P[1] + c, fq = a * Q[0] + b * Q[1] + c;
    if (fp >= -1e-9) ki.push(P);
    if ((fp >= -1e-9) !== (fq >= -1e-9)) { const t = fp / (fp - fq); ki.push([P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t]); }
  }
  return tisztit(ki);
}
/** Ismétlődő és egy egyenesbe eső csúcsok elhagyása (a vágás a csúcson átmenő egyenesnél kettőzhet). */
function tisztit(p: P2[]): P2[] {
  let q = p.filter((a, i) => { const b = p[(i + 1) % p.length]!; return Math.hypot(a[0] - b[0], a[1] - b[1]) > 1e-6; });
  for (let k = 0; k < 3 && q.length >= 3; k++) q = q.filter((b, i) => { const a = q[(i - 1 + q.length) % q.length]!, c = q[(i + 1) % q.length]!;
    return Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) > 1e-9; });
  return q.length >= 3 ? q : [];
}
const terulet = (p: P2[]) => Math.abs(p.reduce((s, [x, y], i) => { const [x2, y2] = p[(i + 1) % p.length]!; return s + x * y2 - x2 * y; }, 0)) / 2;

/** A derékszögűsített körvonal (x / y irányú élek; a ferde éleket a hosszabbik vetületük irányára állítjuk). */
export function derekszogusit(p: P2[]): P2[] {
  const n = p.length; if (n < 4) return p;
  // élek irányának kerekítése, majd a csúcsok az egymást követő vízszintes / függőleges egyenesek metszéspontjai
  const elek: { v: boolean; k: number }[] = [];
  for (let i = 0; i < n; i++) { const a = p[i]!, b = p[(i + 1) % n]!; const v = Math.abs(b[0] - a[0]) < Math.abs(b[1] - a[1]); elek.push({ v, k: v ? (a[0] + b[0]) / 2 : (a[1] + b[1]) / 2 }); }
  // azonos irányú szomszédos élek összevonása
  const ossz: { v: boolean; k: number }[] = [];
  for (const e of elek) { const u = ossz[ossz.length - 1]; if (u && u.v === e.v) u.k = (u.k + e.k) / 2; else ossz.push({ ...e }); }
  if (ossz.length > 1 && ossz[0]!.v === ossz[ossz.length - 1]!.v) { ossz[0]!.k = (ossz[0]!.k + ossz[ossz.length - 1]!.k) / 2; ossz.pop(); }
  const ki: P2[] = [];
  for (let i = 0; i < ossz.length; i++) { const a = ossz[i]!, b = ossz[(i + 1) % ossz.length]!; if (a.v === b.v) continue; ki.push(a.v ? [a.k, b.k] : [b.k, a.k]); }
  return ki;
}

/** Derékszögű sokszög kifelé tolása d-vel (a csúcsok a két szomszédos él eltolt egyenesének metszéspontjában). */
export function kifeleTol(p: P2[], d: number): P2[] {
  const n = p.length; const A = p.reduce((s, [x, y], i) => { const [x2, y2] = p[(i + 1) % n]!; return s + x * y2 - x2 * y; }, 0);
  const el = Math.sign(A) || 1;
  const egyenes = p.map((a, i) => { const b = p[(i + 1) % n]!; const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; const nx = (el * (b[1] - a[1])) / l, ny = (-el * (b[0] - a[0])) / l; return { a: [a[0] + nx * d, a[1] + ny * d] as P2, ux: (b[0] - a[0]) / l, uy: (b[1] - a[1]) / l }; });
  return p.map((_, i) => { const e1 = egyenes[(i - 1 + n) % n]!, e2 = egyenes[i]!; const det = e1.ux * -e2.uy - e1.uy * -e2.ux;
    if (Math.abs(det) < 1e-9) return e2.a; const t = ((e2.a[0] - e1.a[0]) * -e2.uy - (e2.a[1] - e1.a[1]) * -e2.ux) / det; return [e1.a[0] + e1.ux * t, e1.a[1] + e1.uy * t]; });
}

function bennePont(p: P2[], x: number, y: number) {
  let be = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, yi] = p[i]!, [xj, yj] = p[j]!; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) be = !be; }
  return be;
}

/** Maximális téglalapok a derékszögű sokszögben (a csúcsok x / y koordinátáinak rácsán). */
function teglalapok(p: P2[]): { x0: number; y0: number; x1: number; y1: number }[] {
  const xs = [...new Set(p.map((q) => Math.round(q[0] * 1000) / 1000))].sort((a, b) => a - b), ys = [...new Set(p.map((q) => Math.round(q[1] * 1000) / 1000))].sort((a, b) => a - b);
  const cella = (i: number, j: number) => bennePont(p, (xs[i]! + xs[i + 1]!) / 2, (ys[j]! + ys[j + 1]!) / 2);
  const bent = (i0: number, j0: number, i1: number, j1: number) => { for (let i = i0; i < i1; i++) for (let j = j0; j < j1; j++) if (!cella(i, j)) return false; return true; };
  const jel: { i0: number; j0: number; i1: number; j1: number }[] = [];
  for (let i0 = 0; i0 < xs.length - 1; i0++) for (let i1 = i0 + 1; i1 < xs.length; i1++) for (let j0 = 0; j0 < ys.length - 1; j0++) for (let j1 = j0 + 1; j1 < ys.length; j1++)
    if (bent(i0, j0, i1, j1)) jel.push({ i0, j0, i1, j1 });
  const max = jel.filter((r) => !jel.some((q) => q !== r && q.i0 <= r.i0 && q.j0 <= r.j0 && q.i1 >= r.i1 && q.j1 >= r.j1));
  return max.map((r) => ({ x0: xs[r.i0]!, y0: ys[r.j0]!, x1: xs[r.i1]!, y1: ys[r.j1]! }));
}

export interface TetoBemenet {
  /** a legfelső szint külső körvonala (m) */
  korvonal: P2[];
  hajlas: number;
  /** ereszkiállás (m) */
  kiallas: number;
  /** oromfalas végek: a téglalap rövidebb élének kifelé mutató iránya (0 = −y, 90 = +x, 180 = +y, 270 = −x) szerint */
  orom?: (ir: number, szel: number) => boolean;
  /** az eresz magassága (m) */
  zEresz?: number;
}

/** A körvonal főiránya (fok, −45…45): az élek hosszal súlyozott iránya 90°-os periódussal. */
export function foIrany(p: P2[]): number {
  let s = 0, c = 0;
  for (let i = 0; i < p.length; i++) { const a = p[i]!, b = p[(i + 1) % p.length]!; const l = Math.hypot(b[0] - a[0], b[1] - a[1]), f = 4 * Math.atan2(b[1] - a[1], b[0] - a[0]); s += l * Math.sin(f); c += l * Math.cos(f); }
  return (Math.atan2(s, c) / 4) * 180 / Math.PI;
}
const forgat = (q: P2, fok: number): P2 => { const r = (fok * Math.PI) / 180, co = Math.cos(r), si = Math.sin(r); return [q[0] * co - q[1] * si, q[0] * si + q[1] * co]; };
/** Az élek (≥ 0,3 m) mind a tengelyek ±3°-án belül? */
function derekszogu(p: P2[]): boolean {
  return p.every((a, i) => { const b = p[(i + 1) % p.length]!; const dx = b[0] - a[0], dy = b[1] - a[1]; if (Math.hypot(dx, dy) < 0.3) return true;
    const f = (Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI; return f <= 3 || f >= 87; });
}
function konvex(p: P2[]): boolean {
  let jel = 0;
  for (let i = 0; i < p.length; i++) { const a = p[i]!, b = p[(i + 1) % p.length]!, c = p[(i + 2) % p.length]!;
    const k = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]); if (Math.abs(k) < 1e-6) continue;
    if (jel && Math.sign(k) !== jel) return false; jel = Math.sign(k); }
  return true;
}

/** Konvex (nem derékszögű) körvonal kontyolt teteje: minden ereszél síkja, a tető a síkok alsó burkolója
 *  (konvex sokszögön ez az egyenes váz – straight skeleton – pontos teteje). */
function konvexTeto(be: TetoBemenet): { haromszogek: [P3, P3, P3][]; eresz: P2[] } | null {
  const k0 = tisztit(be.korvonal); if (k0.length < 3) return null;
  const eresz = kifeleTol(k0, be.kiallas), n = eresz.length;
  const tg = Math.tan((be.hajlas * Math.PI) / 180), ze = be.zEresz ?? 0;
  const A = eresz.reduce((s, [x, y], i) => { const [x2, y2] = eresz[(i + 1) % n]!; return s + x * y2 - x2 * y; }, 0), el = Math.sign(A) || 1;
  const S: Sik[] = eresz.map((a, i) => { const b = eresz[(i + 1) % n]!; const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = (-el * (b[1] - a[1])) / l, ny = (el * (b[0] - a[0])) / l; return { nx, ny, c: nx * a[0] + ny * a[1] }; });
  const haromszogek: [P3, P3, P3][] = [];
  S.forEach((s, si) => {
    let p: P2[] = eresz.slice();
    for (const [sj, q] of S.entries()) if (sj !== si) { p = vag(p, q.nx - s.nx, q.ny - s.ny, -(q.c - s.c) + (sj < si ? -1e-9 : 0)); if (!p.length) return; }
    if (terulet(p) < 1e-6) return;
    const P = p.map(([x, y]) => [x, y, ze + tg * z0(s, x, y)] as P3);
    for (let i = 1; i + 1 < P.length; i++) haromszogek.push([P[0]!, P[i]!, P[i + 1]!]);
  });
  return { haromszogek, eresz };
}

/**
 * Egyenes váz (straight skeleton) tető tetszőleges egyszerű sokszögre: a hullámfront (az ereszvonal) minden éle egységnyi
 * sebességgel befelé tolódik; élesemény (egy él nullára rövidül – a két csúcs összeolvad) és osztásesemény (konkáv csúcs
 * eléri a szemközti élt – a sokszög kettéválik) a következő legkorábbi. Két esemény között minden él egy trapézt söpör a
 * saját síkjában (z = tg · t): ezek a tetőlapok darabjai. Sikertelen (elfajuló) esetben null.
 */
export function egyenesVazTeto(eresz0: P2[], hajlas: number, ze = 0, naplo?: string[]): [P3, P3, P3][] | null {
  type Cs = { p: P2; v: P2; eBe: number; eKi: number };
  const pol = tisztit(eresz0); if (pol.length < 3) return null;
  const P = terElojel(pol) < 0 ? pol.slice().reverse() : pol.slice(), n = P.length;
  const tg = Math.tan((hajlas * Math.PI) / 180);
  // eredeti élek: befelé mutató (bal) normális, n·x = c + t
  const E = P.map((a, i) => { const b = P[(i + 1) % n]!, l = Math.hypot(b[0] - a[0], b[1] - a[1]); const nx = -(b[1] - a[1]) / l, ny = (b[0] - a[0]) / l; return { nx, ny, c: nx * a[0] + ny * a[1], dx: (b[0] - a[0]) / l, dy: (b[1] - a[1]) / l }; });
  const seb = (a: number, b: number): P2 | null => { const A = E[a]!, B = E[b]!, det = A.nx * B.ny - A.ny * B.nx;
    if (Math.abs(det) < 1e-9) return A.nx * B.nx + A.ny * B.ny > 0 ? [A.nx, A.ny] : null; return [(B.ny - A.ny) / det, (A.nx - B.nx) / det]; };
  const uj = (p: P2, eBe: number, eKi: number): Cs | null => { const v = seb(eBe, eKi); return v ? { p, v, eBe, eKi } : null; };
  let frontok: Cs[][] = [P.map((p, i) => uj(p, (i - 1 + n) % n, i)!)];
  if (frontok[0]!.some((c) => !c)) return null;
  const darabok: P3[][] = [];
  let T = 0;
  const hely = (c: Cs, d: number): P2 => [c.p[0] + c.v[0] * d, c.p[1] + c.v[1] * d];
  // kiesett csúcs után a front élláncának helyreállítása: a csúcs bejövő éle az előző kimenő éle (az egybeeső, ellentétes
  // élpár közül az, amelynek belső oldalán a megmaradt rész van); ellentétes élpárú csúcs (tüske) kiesik
  const javit = (f: Cs[]) => {
    for (let it = 0; it < 4 * f.length + 4 && f.length >= 3; it++) {
      let jo = true;
      for (let k = 0; k < f.length; k++) { const ke = (k - 1 + f.length) % f.length, el = f[ke]!, c = f[k]!; if (c.eBe === el.eKi) continue;
        // a két csúcs közti él: a két jelölt közül az, amelynek befelé mutató normálisa a front belseje (bal oldal) felé néz
        const dx = c.p[0] - el.p[0], dy = c.p[1] - el.p[1], A = E[el.eKi]!;
        const e = Math.hypot(dx, dy) < 1e-9 || A.nx * -dy + A.ny * dx > 0 ? el.eKi : c.eBe;
        el.eKi = e; c.eBe = e;
        const v1 = seb(el.eBe, el.eKi), v2 = seb(c.eBe, c.eKi);
        if (!v1) { f.splice(ke, 1); jo = false; break; } el.v = v1;
        if (!v2) { f.splice(k, 1); jo = false; break; } c.v = v2; }
      if (jo) for (let k = 0; k < f.length; k++) { const c = f[k]!; if (!seb(c.eBe, c.eKi)) { f.splice(k, 1); jo = false; break; } }
      if (jo) return;
    }
  };
  for (let lepes = 0; lepes < 20 * n + 50; lepes++) {
    frontok = frontok.filter((f) => f.length >= 3 && Math.abs(terElojel(f.map((c) => c.p))) > 1e-7);
    if (!frontok.length) return illeszt(darabok);
    // a legkorábbi esemény
    let ev: { d: number; f: number; i: number; e?: number } | null = null;
    frontok.forEach((f, fi) => f.forEach((c, i) => {
      const k = f[(i + 1) % f.length]!, e = E[c.eKi]!;
      const dv = (k.v[0] - c.v[0]) * e.dx + (k.v[1] - c.v[1]) * e.dy, dp = (k.p[0] - c.p[0]) * e.dx + (k.p[1] - c.p[1]) * e.dy;
      if (dv < -1e-12) { const d = -dp / dv; if (d > -1e-9 && (!ev || d < ev.d - 1e-12)) ev = { d: Math.max(0, d), f: fi, i }; }
      // konkáv csúcs (jobbra fordul) → osztás
      const a = E[c.eBe]!; if (a.dx * e.dy - a.dy * e.dx >= -1e-9) return;
      f.forEach((m, j) => {
        if (j === i || (j + 1) % f.length === i) return;
        const s = E[m.eKi]!, nev = s.nx * c.v[0] + s.ny * c.v[1] - 1; if (Math.abs(nev) < 1e-12) return;
        const d = (s.c + T - (s.nx * c.p[0] + s.ny * c.p[1])) / nev; if (!(d > 1e-9) || (ev && d >= ev.d - 1e-12)) return;
        const X = hely(c, d), A0 = hely(m, d), B0 = hely(f[(j + 1) % f.length]!, d);
        const L = (B0[0] - A0[0]) * s.dx + (B0[1] - A0[1]) * s.dy, t = (X[0] - A0[0]) * s.dx + (X[1] - A0[1]) * s.dy;
        if (t >= -1e-7 && t <= L + 1e-7) ev = { d, f: fi, i, e: j };
      });
    }));
    if (!ev) return null;
    const { d, f: fi, i, e: ej } = ev as { d: number; f: number; i: number; e?: number };
    naplo?.push(`T=${(T + d).toFixed(4)} ${ej === undefined ? 'él' : 'osztás→' + ej} f${fi} i${i} | ` + frontok.map((f) => f.map((c) => `${c.eBe}/${c.eKi}@${hely(c, d).map((v) => v.toFixed(2)).join(',')}`).join(' ')).join(' ‖ '));
    // söpört trapézok, majd a csúcsok előre
    if (d > 1e-12) for (const f of frontok) f.forEach((c, k) => { const m = f[(k + 1) % f.length]!;
      const a0: P3 = [c.p[0], c.p[1], ze + tg * T], b0: P3 = [m.p[0], m.p[1], ze + tg * T], a1h = hely(c, d), b1h = hely(m, d);
      const a1: P3 = [a1h[0], a1h[1], ze + tg * (T + d)], b1: P3 = [b1h[0], b1h[1], ze + tg * (T + d)];
      const q = [a0, b0, b1, a1].filter((x, k, t) => { const y = t[(k + 1) % 4]!; return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) > 1e-9; });
      if (q.length >= 3) darabok.push(q); });
    for (const f of frontok) for (const c of f) c.p = hely(c, d);
    T += d;
    const f = frontok[fi]!, c = f[i]!;
    if (ej === undefined) {
      const j = (i + 1) % f.length, m = f[j]!, w = uj(c.p, c.eBe, m.eKi);
      // (ellentétes élek – a szárny gerincvonallá fogyott –: mindkét csúcs kiesik)
      if (!w) { f.splice(Math.max(i, j), 1); f.splice(Math.min(i, j), 1); }
      else if (j === 0) { f.splice(i, 1); f[0] = w; } else f.splice(i, 2, w);
      javit(f);
    } else {
      const s = ej, m = f[s]!, wA = uj(c.p, c.eBe, m.eKi), wB = uj(c.p, m.eKi, c.eKi);
      // A: … c-1, wA, s+1 … ; B: s+1-ig … s, wB, c+1 …
      const A: Cs[] = [], B: Cs[] = [], L = f.length;
      for (let k = (s + 1) % L; k !== i; k = (k + 1) % L) A.push(f[k]!); if (wA) A.push(wA);
      for (let k = (i + 1) % L; k !== (s + 1) % L; k = (k + 1) % L) B.push(f[k]!); if (wB) B.push(wB);
      javit(A); javit(B);
      frontok.splice(fi, 1, A, B);
    }
  }
  return null;
}
/** A söpört darabok illesztése: minden darab élére a rá eső többi csúcs is felkerül (T-csatlakozás nélküli háló – az ELBA
 *  tetőbontása az élek egyezéséből keresi a gerincet, élt, vápát), majd a konvex darab legyezője a súlypontjából. */
function illeszt(darabok: P3[][]): [P3, P3, P3][] {
  const pontok: P3[] = [], kulcs = new Set<string>();
  for (const d of darabok) for (const p of d) { const k = p.map((v) => Math.round(v * 1e6)).join(','); if (!kulcs.has(k)) { kulcs.add(k); pontok.push(p); } }
  const ki: [P3, P3, P3][] = [];
  for (const d of darabok) {
    const sor: P3[] = [];
    d.forEach((a, k) => { const b = d[(k + 1) % d.length]!; sor.push(a);
      const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L2 = ab[0]! ** 2 + ab[1]! ** 2 + ab[2]! ** 2; if (L2 < 1e-14) return;
      const kozte: { t: number; p: P3 }[] = [];
      for (const p of pontok) { const t = ((p[0] - a[0]) * ab[0]! + (p[1] - a[1]) * ab[1]! + (p[2] - a[2]) * ab[2]!) / L2; if (t <= 1e-9 || t >= 1 - 1e-9) continue;
        const dx = a[0] + ab[0]! * t - p[0], dy = a[1] + ab[1]! * t - p[1], dz = a[2] + ab[2]! * t - p[2]; if (dx * dx + dy * dy + dz * dz < 1e-12) kozte.push({ t, p }); }
      kozte.sort((x, y) => x.t - y.t); for (const x of kozte) sor.push(x.p); });
    if (sor.length === 3) { ki.push([sor[0]!, sor[1]!, sor[2]!]); continue; }
    const s: P3 = [0, 1, 2].map((k) => d.reduce((t, p) => t + p[k]!, 0) / d.length) as P3;
    sor.forEach((a, k) => ki.push([s, a, sor[(k + 1) % sor.length]!]));
  }
  return ki;
}
const terElojel = (p: P2[]) => p.reduce((s, [x, y], i) => { const [x2, y2] = p[(i + 1) % p.length]!; return s + x * y2 - x2 * y; }, 0) / 2;

export type TetoMod = 'derekszogu' | 'konvex' | 'vaz' | 'kozelito';

/** A tető felülete háromszögekben (az ElbaBimGeometria.tetoBontas bemenete), és az ereszvonal.
 *  A körvonalat a főirányába forgatjuk: ha így derékszögű, a téglalapos módszer pontos; ha nem derékszögű, de konvex,
 *  az élsíkok alsó burkolója; egyébként a derékszögűsített körvonal teteje (közelítő). */
export function tetoHaromszogek(be: TetoBemenet): { haromszogek: [P3, P3, P3][]; eresz: P2[]; mod: TetoMod } | null {
  const th = foIrany(be.korvonal), forg = Math.abs(th) > 0.1;
  const loc = forg ? be.korvonal.map((q) => forgat(q, -th)) : be.korvonal;
  const dsz = derekszogu(loc);
  if (!dsz && konvex(tisztit(be.korvonal))) { const r = konvexTeto(be); return r && { ...r, mod: 'konvex' }; }
  // nem derékszögű, nem konvex: egyenes váz (oromfal nélkül); ha elfajul, a derékszögűsített közelítés
  if (!dsz) {
    const eresz = kifeleTol(tisztit(be.korvonal), be.kiallas), h = egyenesVazTeto(eresz, be.hajlas, be.zEresz ?? 0);
    const vet = h ? h.reduce((s, [a, b, c]) => s + Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2, 0) : 0;
    if (h && Math.abs(vet - terulet(eresz)) <= 0.005 * terulet(eresz)) return { haromszogek: h, eresz, mod: 'vaz' };
  }
  const irM = (ir: number) => { const d = forgat(ir === 0 ? [0, -1] : ir === 90 ? [1, 0] : ir === 180 ? [0, 1] : [-1, 0], th);
    return ((Math.round((Math.atan2(d[0], -d[1]) * 180) / Math.PI / 90) * 90) % 360 + 360) % 360; };
  let orom = false;
  const r = tetoDerekszogu({ ...be, korvonal: loc, ...(be.orom ? { orom: (ir: number, szel: number) => { const v = be.orom!(forg ? irM(ir) : ir, szel); if (v) orom = true; return v; } } : {}) });
  if (!r) return null;
  // oromfal nélkül a kontyolt tető az egyenes váz is (ugyanaz a tető, de átfedés és T-csatlakozás nélküli háló)
  if (!orom) { const h = egyenesVazTeto(r.eresz, be.hajlas, be.zEresz ?? 0);
    const vet = h ? h.reduce((s, [a, b, c]) => s + Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2, 0) : 0;
    if (h && Math.abs(vet - terulet(r.eresz)) <= 0.005 * terulet(r.eresz)) r.haromszogek = h; }
  const vissza = forg ? { haromszogek: r.haromszogek.map((h) => h.map(([x, y, z]) => { const [a, b] = forgat([x, y], th); return [a, b, z] as P3; }) as [P3, P3, P3]), eresz: r.eresz.map((q) => forgat(q, th)) } : r;
  return { ...vissza, mod: dsz ? 'derekszogu' : 'kozelito' };
}

function tetoDerekszogu(be: TetoBemenet): { haromszogek: [P3, P3, P3][]; eresz: P2[] } | null {
  const k0 = derekszogusit(be.korvonal); if (k0.length < 4) return null;
  const eresz = kifeleTol(k0, be.kiallas);
  const tg = Math.tan((be.hajlas * Math.PI) / 180), ze = be.zEresz ?? 0;
  const rr = teglalapok(eresz); if (!rr.length) return null;
  // téglalaponként a síkok; a rövidebb élen oromfal, ha az orom-függvény annak mondja (a téglalap végét a körvonal
  // határolja – más téglalapba nyúló vég nem orom)
  const T: Teglalap[] = rr.map((r) => {
    const w = r.x1 - r.x0, h = r.y1 - r.y0, s: Sik[] = [];
    const vegSzabad = (x: number, y: number) => !bennePont(eresz, x, y);
    const add = (nx: number, ny: number, c: number, ir: number, veg: boolean, szel: number, kint: [number, number]) => {
      if (veg && vegSzabad(kint[0], kint[1]) && be.orom?.(ir, szel)) return; s.push({ nx, ny, c }); };
    const xv = w < h; // álló téglalap: a rövidebb (vég-) élek a felső és az alsó
    add(0, 1, r.y0, 0, xv, w, [(r.x0 + r.x1) / 2, r.y0 - 0.05]);
    add(0, -1, -r.y1, 180, xv, w, [(r.x0 + r.x1) / 2, r.y1 + 0.05]);
    add(1, 0, r.x0, 270, !xv, h, [r.x0 - 0.05, (r.y0 + r.y1) / 2]);
    add(-1, 0, -r.x1, 90, !xv, h, [r.x1 + 0.05, (r.y0 + r.y1) / 2]);
    return { ...r, sikok: s };
  });
  const tetoZ = (t: Teglalap, x: number, y: number) => Math.min(...t.sikok.map((s) => z0(s, x, y)));
  // lapok: (téglalap, sík) – a téglalapon belül a sík a legalacsonyabb, és a többi, a pontot tartalmazó téglalap tetejénél
  // nem alacsonyabb (felső burkoló); konvex darabok listája
  const lapok: { t: number; s: Sik; p: P2[] }[] = [];
  T.forEach((t, ti) => t.sikok.forEach((s, si) => {
    let p: P2[] = [[t.x0, t.y0], [t.x1, t.y0], [t.x1, t.y1], [t.x0, t.y1]];
    for (const [sj, q] of t.sikok.entries()) if (sj !== si) { p = vag(p, q.nx - s.nx, q.ny - s.ny, -(q.c - s.c) + (sj < si ? -1e-9 : 0)); if (!p.length) return; }
    let darabok: P2[][] = [p];
    T.forEach((u, ui) => {
      if (ui === ti) return;
      const uj: P2[][] = [];
      for (const d of darabok) {
        // u-n kívüli rész: a négy élen kívüli félsíkok egymás utáni levágása
        let mar = d;
        for (const [a, b, c] of [[1, 0, -u.x0], [-1, 0, u.x1], [0, 1, -u.y0], [0, -1, u.y1]] as [number, number, number][]) {
          const kint = vag(mar, -a, -b, -c); if (kint.length && terulet(kint) > 1e-6) uj.push(kint);
          mar = vag(mar, a, b, c); if (!mar.length) break;
        }
        if (!mar.length) continue;
        // u-n belül: u lapjai szerint, ahol ez a sík legalább olyan magas, mint u teteje (egyenlőségnél a kisebb index nyer)
        for (const [qi, q] of u.sikok.entries()) {
          let r2 = mar;
          for (const [qj, w] of u.sikok.entries()) if (qj !== qi) { r2 = vag(r2, w.nx - q.nx, w.ny - q.ny, -(w.c - q.c) + (qj < qi ? -1e-9 : 0)); if (!r2.length) break; }
          if (!r2.length) continue;
          // (egyenlő magasságnál – azonos sík két téglalapban – a kisebb indexű nyer; a tűrés nagyobb a vágásénál)
          r2 = vag(r2, s.nx - q.nx, s.ny - q.ny, -(s.c - q.c) + (ui < ti ? -1e-6 : 1e-6)); if (r2.length && terulet(r2) > 1e-6) uj.push(r2);
        }
      }
      darabok = uj;
    });
    for (const d of darabok) if (terulet(d) > 1e-6) lapok.push({ t: ti, s, p: d });
  }));
  const haromszogek: [P3, P3, P3][] = [];
  for (const l of lapok) {
    const P = l.p.map(([x, y]) => [x, y, ze + tg * z0(l.s, x, y)] as P3);
    for (let i = 1; i + 1 < P.length; i++) haromszogek.push([P[0]!, P[i]!, P[i + 1]!]);
  }
  void tetoZ;
  return { haromszogek, eresz };
}
