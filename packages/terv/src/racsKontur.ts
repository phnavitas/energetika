/**
 * A HŐBUROK A MÉRETLÁNCOK RÁCSÁN (2026-11-23, Balázs: „Nagyon sokszor amorf hőburkot rajzol, ilyenkor a falfelismerés
 * is bizonytalan" – „a javító eszközökre utána kell koncentrálni, miután megvan a ház").
 *
 * A ház külső síkjait a tervező a külső méretláncokkal megadja: a láncok határjelei a homlokzati síkok, sarkok,
 * lépcsők helyén állnak. A külső (a ház körül futó) láncok jeleiből rácsot vetünk; a rács minden celláját a raszter
 * dönti el többségi szavazással (a fűtött helyiség, ill. a nem fűtött tér / külső tér cellái), a falsávba eső
 * keskeny cellákat a szomszédjuk. A kontúr így csak a méretezett síkokon futhat – derékszögű, a falfelismerés
 * hibái (szétesett helyiség, kifolyás) legfeljebb egy-egy cella döntését befolyásolják, nem a kontúr alakját.
 *
 * null: nincs mindkét irányban külső méretlánc, vagy a rácskontúr a raszteres kontúrtól nagyon eltér (a láncok nem
 * a házra vonatkoznak) – ilyenkor a raszteres burok marad.
 */
import type { Lap } from './kinyeres';
import type { Raszter } from './raszter';
import type { Poligon } from './burok';
import { meretlancok, type MeretLanc } from './meretlanc';

const bennPol = (p: Poligon, x: number, y: number) => { let b = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, yi] = p[i]!, [xj, yj] = p[j]!; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) b = !b; } return b; };

export interface RacsKontur {
  /** a kontúr(ok) a lapon (pt), a fal külső síkján */
  pol: Poligon[];
  /** a rács vonalai (pt) – megjelenítéshez, ellenőrzéshez */
  xs: number[]; ys: number[];
  /** a felhasznált külső láncok */
  lancok: MeretLanc[];
}

export function racsKontur(r: Raszter, lap: Lap, futott: ReadonlySet<number>, alap?: Poligon[], pecsetek?: readonly { x: number; y: number }[]): RacsKontur | null {
  const { w, h, px, mPerPt } = r; const m = 1 / mPerPt; // 1 m pt-ban
  const lx = (gx: number) => r.x0 + (gx * px) / mPerPt, ly = (gy: number) => r.y0 + (gy * px) / mPerPt;
  const gxOf = (x: number) => ((x - r.x0) * mPerPt) / px, gyOf = (y: number) => ((y - r.y0) * mPerPt) / px;
  // a fűtött helyiségek befoglalója (pt)
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity, hDb = 0;
  for (let gy = 0; gy < h; gy++) for (let gx = 0; gx < w; gx++) { const c = r.cimke[gy * w + gx]!; if (c >= 2 && futott.has(c - 2)) { hDb++; if (gx < bx0) bx0 = gx; if (gx > bx1) bx1 = gx; if (gy < by0) by0 = gy; if (gy > by1) by1 = gy; } }
  if (hDb * px * px < 10) return null;
  [bx0, bx1] = [lx(bx0), lx(bx1 + 1)]; [by0, by1] = [ly(by0), ly(by1 + 1)];
  const lancok = meretlancok(lap, mPerPt);
  // külső láncok: a ház mellett (a befoglalón kívül, ≤ 8 m-re), a ház szélességének legalább 40 %-át átfogó vagy a
  // házra eső jelekkel; a jelek a ház ± 1,2 m-es sávjában
  const kulso: MeretLanc[] = [];
  const xs: number[] = [], ys: number[] = [];
  for (const l of lancok) {
    const [c0, c1, a0, a1] = l.fuggo ? [bx0, bx1, by0, by1] : [by0, by1, bx0, bx1];
    const kint = (l.c < c0 - 0.15 * m && l.c > c0 - 8 * m) || (l.c > c1 + 0.15 * m && l.c < c1 + 8 * m);
    if (!kint) continue;
    const jel = l.jelek.filter((p) => p >= a0 - 1.2 * m && p <= a1 + 1.2 * m);
    if (jel.length < 2 || (jel[jel.length - 1]! - jel[0]!) < 0.4 * (a1 - a0)) continue;
    kulso.push(l); (l.fuggo ? ys : xs).push(...jel);
  }
  const egyedi = (v: number[]) => { v.sort((p, q) => p - q); const ki: number[] = []; for (const p of v) if (!ki.length || p - ki[ki.length - 1]! > 0.03 * m) ki.push(p); return ki; };
  // a láncok szélső jelei (a ház külső síkjai a láncok szerint)
  const lx0 = Math.min(...xs), lx1 = Math.max(...xs), ly0 = Math.min(...ys), ly1 = Math.max(...ys);
  // a raszteres kontúr (alap) síkjai ott, ahol nincs méretlánc-jel 0,25 m-en belül (a lánc nem méretez minden síkot)
  if (alap) {
    const xc = [...xs], yc = [...ys];
    for (const p of alap) for (let k = 0; k < p.length; k++) {
      const a = p[k]!, b = p[(k + 1) % p.length]!;
      if (Math.abs(a[0] - b[0]) < 0.02 * m && !xc.some((x) => Math.abs(x - a[0]) <= 0.25 * m)) xs.push((a[0] + b[0]) / 2);
      if (Math.abs(a[1] - b[1]) < 0.02 * m && !yc.some((y) => Math.abs(y - a[1]) <= 0.25 * m)) ys.push((a[1] + b[1]) / 2);
    }
  }
  const X = egyedi(xs), Y = egyedi(ys);
  if (X.length < 2 || Y.length < 2) return null;
  // (a rács a ház két szélét át kell fogja: a szélső jelek a befoglaló ± 1,2 m-én belül)
  if (X[0]! > bx0 + 1.2 * m || X[X.length - 1]! < bx1 - 1.2 * m || Y[0]! > by0 + 1.2 * m || Y[Y.length - 1]! < by1 - 1.2 * m) return null;
  const nx = X.length - 1, ny = Y.length - 1;
  // a raszteres kontúr (alap) maszkja – a falsávba eső cellák döntéséhez (a fal külső síkjáig ér)
  let AM: Uint8Array | null = null;
  if (alap?.length) {
    AM = new Uint8Array(w * h);
    for (const p of alap) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const [x, y] of p) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      for (let gy = Math.max(0, Math.floor(gyOf(y0))); gy <= Math.min(h - 1, Math.ceil(gyOf(y1))); gy++) for (let gx = Math.max(0, Math.floor(gxOf(x0))); gx <= Math.min(w - 1, Math.ceil(gxOf(x1))); gx++)
        if (!AM[gy * w + gx] && bennPol(p, lx(gx + 0.5), ly(gy + 0.5))) AM[gy * w + gx] = 1;
    }
  }
  // cellánként: fűtött (H), ismeretlen belső (N: helyiség nélküli zárt rész), nem fűtött helyiség (U), külső tér (K),
  // fal / nyílás (F); a fal nélküli részen a helyiségek döntenek, a falsávba eső cellán a raszteres kontúr
  const allapot = new Int8Array(nx * ny); // 1: bent, 0: kint, 2: falcella (eldöntendő)
  const belsoJellegu = new Uint8Array(nx * ny); // a fal nélküli rész többsége helyiség / zárt belső (nem külső tér, nem fűtetlen)
  const falJellegu = new Uint8Array(nx * ny), kivulC = new Uint8Array(nx * ny), helyisegNelkul = new Uint8Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const gx0 = Math.max(0, Math.round(gxOf(X[i]!))), gx1 = Math.min(w, Math.round(gxOf(X[i + 1]!)));
    const gy0 = Math.max(0, Math.round(gyOf(Y[j]!))), gy1 = Math.min(h, Math.round(gyOf(Y[j + 1]!)));
    let H = 0, N = 0, U = 0, Kk = 0, A = 0;
    for (let gy = gy0; gy < gy1; gy++) for (let gx = gx0; gx < gx1; gx++) {
      const k = gy * w + gx; const c = r.cimke[k]!;
      if (AM?.[k]) A++;
      if (r.fal[k] || r.nyilas[k]) continue;
      if (c >= 2) { if (futott.has(c - 2)) H++; else U++; } else if (c === 1) Kk++; else N++;
    }
    const T = Math.max(1, (gx1 - gx0) * (gy1 - gy0));
    // (a láncok szélső jelein kívüli falcella kint van: a tervező a ház külső síkjáig méretez – a szomszéd tűzfala,
    // a kerítés, a támfal nem a ház)
    if (H + N + U + Kk >= 0.3 * T && H + N > U + Kk) belsoJellegu[j * nx + i] = 1;
    const kivul = X[i + 1]! <= lx0 + 0.01 * m || X[i]! >= lx1 - 0.01 * m || Y[j + 1]! <= ly0 + 0.01 * m || Y[j]! >= ly1 - 0.01 * m;
    if (H + N + U + Kk < 0.3 * T) falJellegu[j * nx + i] = 1;
    if (kivul) kivulC[j * nx + i] = 1;
    if (!H && !U) helyisegNelkul[j * nx + i] = 1;
    if (H + N + U + Kk < 0.3 * T) allapot[j * nx + i] = kivul ? 0 : AM ? (A >= 0.5 * T ? 1 : 0) : 2;
    else if (H + N > U + Kk && (H > 0 || (AM && A >= 0.5 * T))) allapot[j * nx + i] = 1;
    else if (U >= Kk) allapot[j * nx + i] = 0;
    // a külső térhez sorolt (kifolyt, hézagos falú) rész: a raszteres kontúr dönt (az a zárt zsebeket már besorolta)
    else allapot[j * nx + i] = AM && A >= 0.5 * T ? 1 : 0;
  }
  // (raszteres kontúr nélkül) falcellák: bent, ha bent lévő cellával szomszédos (két rétegig); a többi kint
  for (let kor = 0; kor < 2; kor++) {
    const uj: number[] = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      if (allapot[j * nx + i] !== 2) continue;
      const sz = [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]].some(([a, b]) => a! >= 0 && b! >= 0 && a! < nx && b! < ny && allapot[b! * nx + a!] === 1);
      if (sz) uj.push(j * nx + i);
    }
    for (const k of uj) allapot[k] = 1;
  }
  for (let k = 0; k < nx * ny; k++) if (allapot[k] === 2) allapot[k] = 0;
  // a fűtött helyiség pecsétje a helyiségben áll: a cellája bent van, és a vele (fal nélkül) összefüggő belső jellegű
  // cellák is (a szétesett – a raszterben töredékes – helyiség, pl. a burkolat-kiosztásos fürdő)
  const sor: number[] = [];
  for (const p of pecsetek ?? []) {
    const i = X.findIndex((x, k) => k < nx && p.x >= x && p.x < X[k + 1]!), j = Y.findIndex((y, k) => k < ny && p.y >= y && p.y < Y[k + 1]!);
    if (i < 0 || j < 0) continue; const k = j * nx + i; if (!belsoJellegu[k]) continue; if (!allapot[k]) { allapot[k] = 1; sor.push(k); }
  }
  for (let t = 0; t < sor.length; t++) { const k = sor[t]!, i = k % nx, j = (k / nx) | 0;
    for (const [a, b] of [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]] as const) { if (a < 0 || b < 0 || a >= nx || b >= ny) continue; const q = b * nx + a; if (!allapot[q] && belsoJellegu[q]) { allapot[q] = 1; sor.push(q); } } }
  // zárt lyuk: a kint lévő, fal nélküli cellák, amelyek a rács széléről (a falcellákon nem átjutva) nem érhetők el, és
  // belső jellegűek (helyiség nélküli zárt rész, töredékes helyiség) – bent; a külső tér jellegű zárt udvar (átrium) kint
  // marad. A hozzájuk tapadó falcellák (a lyukat a külső tértől elválasztó fal) is bent.
  {
    const elert = new Uint8Array(nx * ny); const q: number[] = [];
    const nyitott = (k: number) => !allapot[k] && (!falJellegu[k] || kivulC[k]);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if ((i === 0 || j === 0 || i === nx - 1 || j === ny - 1) && nyitott(j * nx + i)) { elert[j * nx + i] = 1; q.push(j * nx + i); }
    for (let t = 0; t < q.length; t++) { const k = q[t]!, i = k % nx, j = (k / nx) | 0;
      for (const [a, b] of [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]] as const) { if (a < 0 || b < 0 || a >= nx || b >= ny) continue; const u = b * nx + a; if (!elert[u] && nyitott(u)) { elert[u] = 1; q.push(u); } } }
    const toltott: number[] = [];
    for (let k = 0; k < nx * ny; k++) if (!allapot[k] && !falJellegu[k] && !elert[k] && belsoJellegu[k]) { allapot[k] = 1; toltott.push(k); }
    for (const k of toltott) { const i = k % nx, j = (k / nx) | 0;
      for (const [a, b] of [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]] as const) { if (a < 0 || b < 0 || a >= nx || b >= ny) continue; const u = b * nx + a; if (!allapot[u] && falJellegu[u] && !kivulC[u]) allapot[u] = 1; } }
  }
  // belső fal: a kint lévő falcella (nem a láncokon kívül), amelynek két szemközti oldalán bent lévő cella van – két
  // fűtött rész közti fal (a raszteres kontúr a vastag belső falnál kettévághatja a házat); a sorban álló falcellák
  // (a ház teljes mélységén átmenő fal) együtt: a sor két végén kell bent lévő cellának lennie
  for (let valt = true; valt;) {
    valt = false;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i; if (allapot[k] || kivulC[k] || !falJellegu[k] && !helyisegNelkul[k]) continue;
      const bent = (a: number, b: number) => a >= 0 && b >= 0 && a < nx && b < ny && allapot[b * nx + a] === 1;
      // (a fal két síkja közti, a raszterben a külső térrel összefolyt rés – pl. kirajzolatlan hőszigetelés – is fal: a
      // helyiség nélküli, a fal irányára merőlegesen legfeljebb 0,6 m széles cella)
      const fal = (q: number, a: number, b: number, vizsz: boolean) => !kivulC[q] && (falJellegu[q] || helyisegNelkul[q] && (vizsz ? X[a + 1]! - X[a]! : Y[b + 1]! - Y[b]!) <= 0.6 * m);
      // (a szomszédos falcellákon át legfeljebb 2 cellán belül)
      const ir = (di: number, dj: number) => { for (let s = 1; s <= 3; s++) { const a = i + di * s, b = j + dj * s; if (bent(a, b)) return true; if (a < 0 || b < 0 || a >= nx || b >= ny) return false; if (!fal(b * nx + a, a, b, di !== 0)) return false; } return false; };
      if ((fal(k, i, j, true) && ir(-1, 0) && ir(1, 0)) || (fal(k, i, j, false) && ir(0, -1) && ir(0, 1))) { allapot[k] = 1; valt = true; }
    }
  }
  // kontúr a cellarácson (irányított határélek, a bent lévő cella bal oldalán)
  const kontur = (all: Int8Array): Poligon[] => {
  const be = (i: number, j: number) => i >= 0 && j >= 0 && i < nx && j < ny && all[j * nx + i] === 1;
  const kov = new Map<number, number[]>(); const K = (i: number, j: number) => j * (nx + 1) + i;
  const el = (a: number, b: number) => { const l = kov.get(a); if (l) l.push(b); else kov.set(a, [b]); };
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    if (!be(i, j)) continue;
    if (!be(i, j - 1)) el(K(i, j), K(i + 1, j));
    if (!be(i + 1, j)) el(K(i + 1, j), K(i + 1, j + 1));
    if (!be(i, j + 1)) el(K(i + 1, j + 1), K(i, j + 1));
    if (!be(i - 1, j)) el(K(i, j + 1), K(i, j));
  }
  const pol: Poligon[] = [];
  for (const [start] of kov) {
    if (!kov.get(start)?.length) continue;
    const pts: [number, number][] = []; let a = start;
    for (let n = 0; n < 4 * (nx + 1) * (ny + 1); n++) { const l = kov.get(a); if (!l?.length) break; const b = l.pop()!; pts.push([X[a % (nx + 1)]!, Y[Math.floor(a / (nx + 1))]!]); a = b; if (a === start) break; }
    // egy egyenesbe eső csúcsok el
    const q = pts.filter((p, k) => { const e = pts[(k - 1 + pts.length) % pts.length]!, u = pts[(k + 1) % pts.length]!; return !((Math.abs(e[0] - p[0]) < 1e-6 && Math.abs(u[0] - p[0]) < 1e-6) || (Math.abs(e[1] - p[1]) < 1e-6 && Math.abs(u[1] - p[1]) < 1e-6)); });
    const A = q.reduce((s, p, k) => { const u = q[(k + 1) % q.length]!; return s + p[0] * u[1] - u[0] * p[1]; }, 0) / 2;
    if (q.length >= 4 && A * mPerPt * mPerPt > 4) pol.push(q.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10] as [number, number]));
  }
  return pol;
  };
  const pol = kontur(allapot);
  if (!pol.length) return null;
  return { pol, xs: X, ys: Y, lancok: kulso };
}
