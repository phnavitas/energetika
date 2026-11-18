/**
 * A beolvasott épületmodell zártságának ellenőrzése: ahol a modellben „lyuk” marad (a körvonal mentén hiányzó fal, a fal
 * teteje és a tető közti rés – pl. hiányzó oromfal –, a tetőfelület hézaga, a legfelső szint le nem fedett része), ott a
 * felismerés hiányos. A hibák helye (m, a modell koordinátáiban) és mérete a figyelmeztetéshez és a 3D jelöléséhez.
 */
import type { EpuletModell, Fal } from './epulet';

type P2 = [number, number];
export interface ZartsagHiba {
  fajta: 'fal' | 'orom' | 'teto' | 'fedes';
  szint?: string;
  /** A hiba közepe (m) és – falnál, résnél – a hiányzó szakasz két vége. */
  hely: P2; a?: P2; b?: P2;
  /** hossz (m) vagy terület (m²) – a fajta szerint */
  meret: number;
  leiras: string;
}

const kerek = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const szoveg = (v: number) => String(kerek(v)).replace('.', ',');

function pontSzakasz(p: P2, a: P2, b: P2): { d: number; t: number; L: number } {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1e-9;
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L;
  const d = Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / L;
  return { d, t, L };
}
function bennHarom(p: P2, a: number[], b: number[], c: number[]): number | null {
  const den = (b[1]! - c[1]!) * (a[0]! - c[0]!) + (c[0]! - b[0]!) * (a[1]! - c[1]!);
  if (Math.abs(den) < 1e-12) return null;
  const w1 = ((b[1]! - c[1]!) * (p[0] - c[0]!) + (c[0]! - b[0]!) * (p[1] - c[1]!)) / den;
  const w2 = ((c[1]! - a[1]!) * (p[0] - c[0]!) + (a[0]! - c[0]!) * (p[1] - c[1]!)) / den;
  const w3 = 1 - w1 - w2;
  if (w1 < -1e-6 || w2 < -1e-6 || w3 < -1e-6) return null;
  return w1 * a[2]! + w2 * b[2]! + w3 * c[2]!;
}
function bennPol(p: P2, q: P2[]): boolean {
  let b = false;
  for (let i = 0, j = q.length - 1; i < q.length; j = i++) { const [xi, yi] = q[i]!, [xj, yj] = q[j]!; if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) b = !b; }
  return b;
}

export function zartsagEllenoriz(M: EpuletModell): ZartsagHiba[] {
  const ki: ZartsagHiba[] = [];
  const falSzint = new Map<string, Fal[]>();
  for (const f of M.falak) { const l = falSzint.get(f.szint) ?? []; l.push(f); falSzint.set(f.szint, l); }
  // 1. a szint körvonala (a padlófödém sokszöge) mentén mindenütt fal kell (a nyílás a falban van)
  for (const fd of M.fodemek) {
    const sz = fd.folott; if (!sz) continue;
    const falak = falSzint.get(sz) ?? [];
    for (const pol of fd.poligonok) for (let i = 0; i < pol.length; i++) {
      const A = pol[i]!, B = pol[(i + 1) % pol.length]!, L = Math.hypot(B[0] - A[0], B[1] - A[1]);
      if (L < 0.3) continue;
      const n = Math.max(2, Math.ceil(L / 0.1));
      let fut: number | null = null;
      const lezar = (k: number) => {
        if (fut === null) return;
        const t0 = fut / n, t1 = k / n, hossz = (t1 - t0) * L; fut = null;
        if (hossz < 0.3) return;
        const a: P2 = [A[0] + (B[0] - A[0]) * t0, A[1] + (B[1] - A[1]) * t0], b: P2 = [A[0] + (B[0] - A[0]) * t1, A[1] + (B[1] - A[1]) * t1];
        ki.push({ fajta: 'fal', szint: sz, a, b, hely: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], meret: kerek(hossz), leiras: `${szoveg(hossz)} m hosszon nincs fal a szint körvonalán – a fal felismerése hiányos (pl. szaggatott, rajzi vonallal megszakított fal, bejárati fülke)` });
      };
      for (let k = 0; k <= n; k++) {
        const p: P2 = [A[0] + ((B[0] - A[0]) * k) / n, A[1] + ((B[1] - A[1]) * k) / n];
        const fedett = falak.some((f) => { const q = pontSzakasz(p, f.a, f.b); return q.d <= f.vastag / 2 + 0.3 && q.t >= -f.vastag / 2 - 0.15 && q.t <= q.L + f.vastag / 2 + 0.15; });
        if (!fedett && fut === null) fut = k;
        if (fedett) lezar(k);
      }
      lezar(n);
    }
  }
  const mt = M.magasteto;
  if (mt && mt.haromszogek.length) {
    const T = mt.haromszogek;
    const tetoZ = (p: P2): number | null => { let z: number | null = null; for (const [a, b, c] of T) { const v = bennHarom(p, a, b, c); if (v !== null && (z === null || v < z)) z = v; } return z; };
    // 2. a tetőfelület hézagai: a háromszögháló csak egyszer használt élei, amelyek nem az ereszvonalon vannak
    const kulcs = (p: number[]) => `${Math.round(p[0]! * 200)}|${Math.round(p[1]! * 200)}|${Math.round(p[2]! * 200)}`;
    const elek = new Map<string, { db: number; a: number[]; b: number[] }>();
    for (const t of T) for (let i = 0; i < 3; i++) {
      const a = t[i]!, b = t[(i + 1) % 3]!, ka = kulcs(a), kb = kulcs(b), k = ka < kb ? `${ka}#${kb}` : `${kb}#${ka}`;
      const e = elek.get(k); if (e) e.db++; else elek.set(k, { db: 1, a, b });
    }
    const ereszen = (p: number[]) => Math.abs(p[2]! - mt.zEresz) < 0.05 || mt.eresz.some((q, i) => pontSzakasz([p[0]!, p[1]!], q, mt.eresz[(i + 1) % mt.eresz.length]!).d < 0.05);
    // (egy élre több, kisebb háromszög éle is illeszkedhet – T-csomópont: az él akkor zárt, ha a középpontja egy másik háromszög élén van)
    const masElen = (p: number[], sajat: string) => [...elek.entries()].some(([k, e]) => k !== sajat && (() => {
      const q = pontSzakasz([p[0]!, p[1]!], [e.a[0]!, e.a[1]!], [e.b[0]!, e.b[1]!]); if (!(q.d < 0.02 && q.t > 0.01 && q.t < q.L - 0.01)) return false;
      const z = e.a[2]! + ((e.b[2]! - e.a[2]!) * q.t) / q.L; return Math.abs(z - p[2]!) < 0.03; })());
    for (const [k, e] of elek) {
      if (e.db !== 1) continue;
      const L = Math.hypot(e.b[0]! - e.a[0]!, e.b[1]! - e.a[1]!, e.b[2]! - e.a[2]!); if (L < 0.2) continue;
      if (ereszen(e.a) && ereszen(e.b)) continue;
      const kozep = [(e.a[0]! + e.b[0]!) / 2, (e.a[1]! + e.b[1]!) / 2, (e.a[2]! + e.b[2]!) / 2];
      if (masElen(kozep, k)) continue;
      ki.push({ fajta: 'teto', szint: mt.szint, a: [e.a[0]!, e.a[1]!], b: [e.b[0]!, e.b[1]!], hely: [kozep[0]!, kozep[1]!], meret: kerek(L), leiras: `${szoveg(L)} m hosszú hézag a tetőfelületen (két tetősík nem találkozik) – a tetőforma felismerése bizonytalan` });
    }
    // 3. a tetővel fedett szint külső falai: a fal teteje és a tető alsó síkja közt nem maradhat rés (oromfal, párkány)
    const sz = M.szintek.find((s) => s.id === mt.szint);
    for (const f of falSzint.get(mt.szint) ?? []) {
      if (!f.kulso) continue;
      const L = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]); if (L < 0.5) continue;
      const nx = -(f.b[1] - f.a[1]) / L, ny = (f.b[0] - f.a[0]) / L;
      const n = Math.max(2, Math.ceil(L / 0.25));
      let maxRes = 0, resHossz = 0, kozep: P2 = [0, 0], db = 0;
      for (let k = 0; k <= n; k++) {
        const t = k / n, c: P2 = [f.a[0] + (f.b[0] - f.a[0]) * t, f.a[1] + (f.b[1] - f.a[1]) * t];
        // (a fal mindkét síkjában: a tető a falat a belső oldalon fedi)
        const zs = [tetoZ(c)].filter((z): z is number => z !== null);
        const felso = f.profil?.length ? (() => { const pr = f.profil!; let i = 0; while (i < pr.length - 2 && pr[i + 1]!.t < t) i++;
          const p = pr[i]!, q = pr[Math.min(i + 1, pr.length - 1)]!; const z = q.t > p.t ? p.z + ((q.z - p.z) * (t - p.t)) / (q.t - p.t) : p.z; return (sz?.z0 ?? 0) + z; })() : f.z0 + f.h;
        if (!zs.length) continue;
        const res = Math.min(...zs) - felso;
        if (res > 0.15) { maxRes = Math.max(maxRes, res); resHossz += L / n; kozep = [kozep[0] + c[0], kozep[1] + c[1]]; db++; }
      }
      if (resHossz >= 0.5 && db) ki.push({ fajta: 'orom', szint: mt.szint, a: f.a, b: f.b, hely: [kozep[0] / db, kozep[1] / db], meret: kerek(resHossz * maxRes / 2, 1),
        leiras: `a ${f.id} fal teteje és a tető közt legfeljebb ${szoveg(maxRes)} m-es rés (${szoveg(resHossz)} m hosszon) – hiányzik az oromfal / a fal magasítása, vagy a tetőhajlás, ill. a falmagasság hibás` });
    }
    // 4. a tetővel fedett szint alaprajzának le nem fedett része
    for (const fd of M.fodemek) {
      if (fd.folott !== mt.szint) continue;
      for (const pol of fd.poligonok) {
        const xs = pol.map((p) => p[0]), ys = pol.map((p) => p[1]); let A = 0, sx = 0, sy = 0;
        for (let x = Math.min(...xs) + 0.25; x < Math.max(...xs); x += 0.5) for (let y = Math.min(...ys) + 0.25; y < Math.max(...ys); y += 0.5)
          if (bennPol([x, y], pol) && tetoZ([x, y]) === null) { A += 0.25; sx += x; sy += y; }
        if (A >= 1) ki.push({ fajta: 'fedes', szint: mt.szint, hely: [sx / (A / 0.25), sy / (A / 0.25)], meret: kerek(A, 1), leiras: `kb. ${szoveg(A)} m²-en a szint fölött nincs tető – a tető körvonala (ereszvonal) hiányos` });
      }
    }
  }
  return ki;
}
