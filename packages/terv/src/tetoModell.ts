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

export type TetoMod = 'derekszogu' | 'konvex' | 'kozelito';

/** A tető felülete háromszögekben (az ElbaBimGeometria.tetoBontas bemenete), és az ereszvonal.
 *  A körvonalat a főirányába forgatjuk: ha így derékszögű, a téglalapos módszer pontos; ha nem derékszögű, de konvex,
 *  az élsíkok alsó burkolója; egyébként a derékszögűsített körvonal teteje (közelítő). */
export function tetoHaromszogek(be: TetoBemenet): { haromszogek: [P3, P3, P3][]; eresz: P2[]; mod: TetoMod } | null {
  const th = foIrany(be.korvonal), forg = Math.abs(th) > 0.1;
  const loc = forg ? be.korvonal.map((q) => forgat(q, -th)) : be.korvonal;
  const dsz = derekszogu(loc);
  if (!dsz && konvex(tisztit(be.korvonal))) { const r = konvexTeto(be); return r && { ...r, mod: 'konvex' }; }
  const irM = (ir: number) => { const d = forgat(ir === 0 ? [0, -1] : ir === 90 ? [1, 0] : ir === 180 ? [0, 1] : [-1, 0], th);
    return ((Math.round((Math.atan2(d[0], -d[1]) * 180) / Math.PI / 90) * 90) % 360 + 360) % 360; };
  const r = tetoDerekszogu({ ...be, korvonal: loc, ...(be.orom ? { orom: (ir: number, szel: number) => be.orom!(forg ? irM(ir) : ir, szel) } : {}) });
  if (!r) return null;
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
    const xv = w < h; // a rövidebb élek a végek
    add(0, 1, r.y0, 0, !xv, w, [(r.x0 + r.x1) / 2, r.y0 - 0.05]);
    add(0, -1, -r.y1, 180, !xv, w, [(r.x0 + r.x1) / 2, r.y1 + 0.05]);
    add(1, 0, r.x0, 270, xv, h, [r.x0 - 0.05, (r.y0 + r.y1) / 2]);
    add(-1, 0, -r.x1, 90, xv, h, [r.x1 + 0.05, (r.y0 + r.y1) / 2]);
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
          r2 = vag(r2, s.nx - q.nx, s.ny - q.ny, -(s.c - q.c) + (ui < ti ? -1e-9 : 1e-9)); if (r2.length && terulet(r2) > 1e-6) uj.push(r2);
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
