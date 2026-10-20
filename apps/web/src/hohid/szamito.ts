/**
 * Kétdimenziós, állandósult hővezetés (MSZ EN ISO 10211) véges térfogatos megoldása téglalaprácson.
 * A geometria téglalapokból áll (anyag, belső levegő, külső levegő); a rács vonalai a téglalapok éleire illeszkednek,
 * a cellák legfeljebb `maxCella` méretűek. A levegőcellák peremfeltételek: hőmérséklet + felületi hőátadási ellenállás.
 * A modellhatárok (vágósíkok) adiabatikusak. Az egyenletrendszer szimmetrikus pozitív definit: Jacobi-előkondicionált CG.
 */

export type Zona = 'belso' | 'kulso';
export interface Teglalap { x0: number; y0: number; x1: number; y1: number; anyag: string | Zona }
export interface AnyagDef { nev: string; lambda: number; szin: string }
export interface Geometria {
  /** A modell befoglalója (m). */
  x0: number; y0: number; x1: number; y1: number;
  /** Sorrendben festve: a későbbi felülírja a korábbit. A le nem fedett terület adiabatikus üreg. */
  elemek: Teglalap[];
  anyagok: Record<string, AnyagDef>;
}
export interface Peremfeltetel { thetaI: number; thetaE: number; Rsi: number; Rse: number }

export interface Megoldas {
  xs: number[]; ys: number[];
  /** Cellánként: anyag-index (≥0), −1 üreg, −2 belső levegő, −3 külső levegő. */
  tipus: Int16Array;
  T: Float64Array;
  /** A belső levegőből a szerkezetbe lépő hőáram (W/m), és a kapcsolati tényező L2D = Q / (θi − θe). */
  Q: number; L2D: number;
  /** Belső felület legalacsonyabb hőmérséklete és helye (m). */
  thetaSiMin: number; hely: [number, number];
  iteracio: number;
}

function racsvonalak(ertekek: number[], a: number, b: number, max: number): number[] {
  const u = [...new Set(ertekek.filter((v) => v >= a - 1e-9 && v <= b + 1e-9).map((v) => Math.round(v * 1e6) / 1e6))].sort((p, q) => p - q);
  const ki: number[] = [];
  for (let i = 0; i < u.length; i++) {
    ki.push(u[i]!);
    if (i + 1 < u.length) { const d = u[i + 1]! - u[i]!; const n = Math.ceil(d / max - 1e-9); for (let k = 1; k < n; k++) ki.push(u[i]! + d * k / n); }
  }
  return ki;
}

export function megold(g: Geometria, pf: Peremfeltetel, maxCella = 0.02): Megoldas {
  const xs = racsvonalak([g.x0, g.x1, ...g.elemek.flatMap((e) => [e.x0, e.x1])], g.x0, g.x1, maxCella);
  const ys = racsvonalak([g.y0, g.y1, ...g.elemek.flatMap((e) => [e.y0, e.y1])], g.y0, g.y1, maxCella);
  const nx = xs.length - 1, ny = ys.length - 1, N = nx * ny;
  const anyagKulcsok = Object.keys(g.anyagok);
  const tipus = new Int16Array(N).fill(-1);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const cx = (xs[i]! + xs[i + 1]!) / 2, cy = (ys[j]! + ys[j + 1]!) / 2;
    for (const e of g.elemek) if (cx > e.x0 && cx < e.x1 && cy > e.y0 && cy < e.y1) tipus[j * nx + i] = e.anyag === 'belso' ? -2 : e.anyag === 'kulso' ? -3 : anyagKulcsok.indexOf(e.anyag);
  }
  const lam = (k: number) => g.anyagok[anyagKulcsok[tipus[k]!]!]!.lambda;
  const dx = (i: number) => xs[i + 1]! - xs[i]!, dy = (j: number) => ys[j + 1]! - ys[j]!;
  // ismeretlenek: a szilárd cellák
  const idx = new Int32Array(N).fill(-1); let n = 0;
  for (let k = 0; k < N; k++) if (tipus[k]! >= 0) idx[k] = n++;
  // ritka mátrix soronként: átló + szomszédok, jobb oldal
  const diag = new Float64Array(n), b = new Float64Array(n);
  const nb: number[][] = Array.from({ length: n }, () => []);
  const ng: number[][] = Array.from({ length: n }, () => []);
  // belső levegő felé eső lapok (a hőáram és a felületi hőmérséklet számításához)
  const belsoLapok: { k: number; G: number; Rfel: number }[] = [];
  const kapcsol = (k: number, l: number, felulet: number, fa: number, fb: number) => {
    // fa, fb: a cellaközéppont és a közös lap távolsága a két cellában
    const ta = tipus[k]!, tb = tipus[l]!;
    if (ta < 0 && tb < 0) return;
    if (ta >= 0 && tb >= 0) {
      const G = felulet / (fa / lam(k) + fb / lam(l));
      const a = idx[k]!, c = idx[l]!;
      diag[a] += G; diag[c] += G; nb[a]!.push(c); ng[a]!.push(G); nb[c]!.push(a); ng[c]!.push(G);
      return;
    }
    const [s, levego, fs] = ta >= 0 ? [k, tb, fa] : [l, ta, fb];
    if (levego === -1) return; // adiabatikus üreg
    const belso = levego === -2;
    const Rs = belso ? pf.Rsi : pf.Rse;
    const G = felulet / (fs / lam(s) + Rs);
    const a = idx[s]!;
    diag[a] += G; b[a] += G * (belso ? pf.thetaI : pf.thetaE);
    if (belso) belsoLapok.push({ k: s, G, Rfel: Rs / felulet });
  };
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i;
    if (i + 1 < nx) kapcsol(k, k + 1, dy(j), dx(i) / 2, dx(i + 1) / 2);
    if (j + 1 < ny) kapcsol(k, k + nx, dx(i), dy(j) / 2, dy(j + 1) / 2);
  }
  // CG
  const x = new Float64Array(n).fill((pf.thetaI + pf.thetaE) / 2);
  const Ax = (v: Float64Array, ki: Float64Array) => { for (let a = 0; a < n; a++) { let s = diag[a]! * v[a]!; const l = nb[a]!, gg = ng[a]!; for (let t = 0; t < l.length; t++) s -= gg[t]! * v[l[t]!]!; ki[a] = s; } };
  const r = new Float64Array(n), z = new Float64Array(n), p = new Float64Array(n), q = new Float64Array(n);
  Ax(x, q); for (let a = 0; a < n; a++) { r[a] = b[a]! - q[a]!; z[a] = r[a]! / diag[a]!; p[a] = z[a]!; }
  let rz = 0; for (let a = 0; a < n; a++) rz += r[a]! * z[a]!;
  const bnorm = Math.sqrt(b.reduce((s, v) => s + v * v, 0)) || 1;
  let it = 0;
  for (; it < 20000; it++) {
    Ax(p, q); let pq = 0; for (let a = 0; a < n; a++) pq += p[a]! * q[a]!;
    const alfa = rz / pq; let rn = 0;
    for (let a = 0; a < n; a++) { x[a] += alfa * p[a]!; r[a] -= alfa * q[a]!; rn += r[a]! * r[a]!; }
    if (Math.sqrt(rn) / bnorm < 1e-11) break;
    let rz2 = 0; for (let a = 0; a < n; a++) { z[a] = r[a]! / diag[a]!; rz2 += r[a]! * z[a]!; }
    const beta = rz2 / rz; rz = rz2;
    for (let a = 0; a < n; a++) p[a] = z[a]! + beta * p[a]!;
  }
  const T = new Float64Array(N);
  for (let k = 0; k < N; k++) T[k] = tipus[k]! >= 0 ? x[idx[k]!]! : tipus[k] === -2 ? pf.thetaI : tipus[k] === -3 ? pf.thetaE : NaN;
  let Q = 0, tMin = Infinity, hely: [number, number] = [0, 0];
  for (const l of belsoLapok) {
    const Tc = T[l.k]!; const q1 = l.G * (pf.thetaI - Tc); Q += q1;
    // felületi hőmérséklet: θsi = θi − q·Rsi (a lapra jutó hőárammal)
    const ts = pf.thetaI - q1 * l.Rfel;
    if (ts < tMin) { tMin = ts; const i = l.k % nx, j = (l.k / nx) | 0; hely = [(xs[i]! + xs[i + 1]!) / 2, (ys[j]! + ys[j + 1]!) / 2]; }
  }
  return { xs, ys, tipus, T, Q, L2D: Q / (pf.thetaI - pf.thetaE), thetaSiMin: tMin, hely, iteracio: it };
}

/** Izotermák (szintvonalak) szakaszai a cellaközéppontok rácsán, „marching squares” módszerrel. */
export function izotermak(m: Megoldas, szintek: number[]): { szint: number; szakaszok: [number, number, number, number][] }[] {
  const nx = m.xs.length - 1, ny = m.ys.length - 1;
  const cx = (i: number) => (m.xs[i]! + m.xs[i + 1]!) / 2, cy = (j: number) => (m.ys[j]! + m.ys[j + 1]!) / 2;
  const ki: { szint: number; szakaszok: [number, number, number, number][] }[] = [];
  for (const s of szintek) {
    const sz: [number, number, number, number][] = [];
    for (let j = 0; j + 1 < ny; j++) for (let i = 0; i + 1 < nx; i++) {
      const k = [j * nx + i, j * nx + i + 1, (j + 1) * nx + i + 1, (j + 1) * nx + i];
      if (k.some((q) => m.tipus[q]! < 0)) continue;
      const v = k.map((q) => m.T[q]!);
      const p = [[cx(i), cy(j)], [cx(i + 1), cy(j)], [cx(i + 1), cy(j + 1)], [cx(i), cy(j + 1)]] as const;
      const pts: [number, number][] = [];
      for (let e = 0; e < 4; e++) {
        const a = v[e]!, c = v[(e + 1) % 4]!;
        if ((a - s) * (c - s) < 0) { const t = (s - a) / (c - a); const A = p[e]!, B = p[(e + 1) % 4]!; pts.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]); }
      }
      if (pts.length === 2) sz.push([pts[0]![0], pts[0]![1], pts[1]![0], pts[1]![1]]);
      else if (pts.length === 4) { sz.push([pts[0]![0], pts[0]![1], pts[1]![0], pts[1]![1]]); sz.push([pts[2]![0], pts[2]![1], pts[3]![0], pts[3]![1]]); }
    }
    ki.push({ szint: s, szakaszok: sz });
  }
  return ki;
}
