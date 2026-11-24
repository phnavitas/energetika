/**
 * RAJZOK ILLESZTÉSE közös koordinátarendszerbe (2026-11-24, Balázs: „az alaprajzot és a helyszínrajzot kell kiindulásnak
 * összevetni … a többi rajzot is illeszteni kell, utána értelmezhető … A rajzokon szereplő egyedi hibákat nem javítjuk,
 * az általános módszereken kell”).
 *
 * Helyszínrajz ↔ alaprajz: az alaprajz külső kontúrját (m, a modell – az alaprajzi lap – irányában) mintaként keressük a
 * helyszínrajz vonalai között (a lépték mindkét lapon ismert). A helyszínrajz vonalaiból távolságtérkép (minden cellában a
 * legközelebbi rajzolt vonal távolsága); egy elhelyezés jósága a kontúr mintapontjainál mért (levágott) távolságok átlaga.
 * Forgatás: a helyszínrajz vonalainak főirányai (és a kontúr főiránya) szerint, a négy derékszögű helyzetben; eltolás: a
 * teljes lapon, durván, majd finomítva. A helyszínrajz épülete gyakran az ereszvonal (a falsíkon kívül 0,3–1,2 m-rel): a
 * kontúrt kifelé tolt változataival is próbáljuk. Felirat, tetőfelismerés nem kell hozzá.
 */
import type { Lap } from './kinyeres';

export type P2 = [number, number];

export interface HelyszinIllesztes {
  /** a modell (m) → helyszínrajzi lap (pt): q = R(szog)·p · (1/mPt) + t */
  szog: number; tx: number; ty: number; mPt: number;
  /** a kontúr kifelé tolása (m), amelynél a legjobb (az eresz a falsíkon kívül) */
  eltolas: number;
  /** a kontúrpontok átlagos távolsága a legközelebbi vonaltól (m, 1,5 m-nél levágva) */
  atlag: number;
  /** a kontúrpontok aránya, amelyek 0,25 m-en belül vonalon vannak */
  talalat: number;
  /** a második legjobb, a legjobbtól ≥ 5 m-re lévő elhelyezés átlaga – a kettő aránya a bizonyosság */
  masodik: number;
}

/** A vonalak távolságtérképe (cella: res m), euklideszi (Felzenszwalb–Huttenlocher, soronként és oszloponként). */
function tavTerkep(w: number, h: number, vonal: Uint8Array): Float32Array {
  const INF = 1e12, f = new Float64Array(Math.max(w, h)), d = new Float64Array(Math.max(w, h)), v = new Int32Array(Math.max(w, h)), z = new Float64Array(Math.max(w, h) + 1);
  const egyD = (n: number) => { let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < n; q++) { let s = ((f[q]! + q * q) - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!); while (s <= z[k]!) { k--; s = ((f[q]! + q * q) - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!); } k++; v[k] = q; z[k] = s; z[k + 1] = INF; }
    k = 0; for (let q = 0; q < n; q++) { while (z[k + 1]! < q) k++; d[q] = (q - v[k]!) * (q - v[k]!) + f[v[k]!]!; } };
  const T = new Float32Array(w * h);
  for (let x = 0; x < w; x++) { for (let y = 0; y < h; y++) f[y] = vonal[y * w + x] ? 0 : INF; egyD(h); for (let y = 0; y < h; y++) T[y * w + x] = d[y]!; }
  for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) f[x] = T[y * w + x]!; egyD(w); for (let x = 0; x < w; x++) T[y * w + x] = Math.sqrt(d[x]!); }
  return T;
}

const foIrany = (szakaszok: [number, number, number, number][]) => {
  const hist = new Float64Array(90);
  for (const [x0, y0, x1, y1] of szakaszok) { const L = Math.hypot(x1 - x0, y1 - y0); const a = ((Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI % 90 + 90) % 90; hist[Math.round(a) % 90] += L; }
  const csucsok: { a: number; s: number }[] = [];
  for (let a = 0; a < 90; a++) { const s = hist[(a + 89) % 90]! + hist[a]! + hist[(a + 1) % 90]!; csucsok.push({ a, s }); }
  csucsok.sort((p, q) => q.s - p.s);
  const ki: number[] = []; for (const c of csucsok) { if (ki.length >= 3) break; if (ki.every((a) => Math.min(Math.abs(a - c.a), 90 - Math.abs(a - c.a)) > 4)) ki.push(c.a); }
  return ki;
};

/** Kifelé tolt sokszög (csúcsonként a két szomszéd él normálisának összegével – derékszögű sarokra pontos). */
function kifele(p: P2[], d: number): P2[] {
  if (!d) return p;
  const n = p.length, A = p.reduce((t, [x, y], i) => { const [x2, y2] = p[(i + 1) % n]!; return t + x * y2 - x2 * y; }, 0), e = Math.sign(A) || 1;
  const nr = (a: P2, b: P2): P2 => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-9; return [-e * (b[1] - a[1]) / L, e * (b[0] - a[0]) / L]; };
  return p.map((v, i) => { const a = p[(i + n - 1) % n]!, b = p[(i + 1) % n]!; const na = nr(a, v), nb = nr(v, b); const c = 1 + na[0] * nb[0] + na[1] * nb[1]; return [v[0] + d * (na[0] + nb[0]) / Math.max(c, 0.5), v[1] + d * (na[1] + nb[1]) / Math.max(c, 0.5)] as P2; });
}

/**
 * Az alaprajzi kontúr (m, modell) elhelyezése a helyszínrajzon. kontur: a ház külső körvonala(i); mPt: a helyszínrajz
 * léptéke (m / pt). Null, ha a lapon nincs elég vonal.
 */
export function helyszinIllesztes(lap: Lap, kontur: P2[][], mPt: number): HelyszinIllesztes | null {
  if (!kontur.length) return null;
  // a helyszínrajz vonalai (m-ben), a lap teljes területén
  const sz: [number, number, number, number][] = [];
  for (const u of lap.utvonalak) {
    if (u.muvelet === 'none') continue;
    for (const p of u.pontok) for (let i = 0; i + 3 < p.length; i += 2) { const L = Math.hypot(p[i + 2]! - p[i]!, p[i + 3]! - p[i + 1]!) * mPt; if (L >= 0.15) sz.push([p[i]! * mPt, p[i + 1]! * mPt, p[i + 2]! * mPt, p[i + 3]! * mPt]); }
  }
  if (sz.length < 20) return null;
  const W = lap.szel * mPt, H = lap.mag * mPt;
  // (irány szerinti távolságtérképek: a kontúr éle csak a vele – a forgatás után – párhuzamos vonalon „ül”; a sűrű,
  // más irányú rajzolat – fák, sraffozás, feliratok – nem illeszkedés)
  const NB = 12;
  const res = Math.max(0.1, Math.sqrt((W * H) / 1.5e6));
  const w = Math.ceil(W / res) + 1, h = Math.ceil(H / res) + 1;
  const vonalak = Array.from({ length: NB }, () => new Uint8Array(w * h));
  for (const [x0, y0, x1, y1] of sz) {
    const a = ((Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI % 180 + 180) % 180, bin = Math.floor(a / (180 / NB)) % NB;
    const vonal = vonalak[bin]!;
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (res / 2))); for (let k = 0; k <= n; k++) { const x = Math.round((x0 + (x1 - x0) * k / n) / res), y = Math.round((y0 + (y1 - y0) * k / n) / res); if (x >= 0 && y >= 0 && x < w && y < h) vonal[y * w + x] = 1; } }
  const TT = vonalak.map((v) => tavTerkep(w, h, v));
  // derékszögű sarkok: két (≥ 0,5 m-es) szakasz közös végpontja, egymásra merőlegesen – a sűrű sraffozás, fák, feliratok
  // nem adnak sarkot (a sraff a körvonalba T-ben fut), a ház körvonala igen
  const sarok = new Uint8Array(w * h);
  { const veg = new Map<string, { x: number; y: number; a: number }[]>(); const K = (x: number, y: number) => `${Math.round(x / 0.1)}|${Math.round(y / 0.1)}`;
    for (const [x0, y0, x1, y1] of sz) { if (Math.hypot(x1 - x0, y1 - y0) < 0.5) continue; const a = ((Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI % 180 + 180) % 180;
      for (const [x, y] of [[x0, y0], [x1, y1]] as const) { const k = K(x, y); const l = veg.get(k); if (l) l.push({ x, y, a }); else veg.set(k, [{ x, y, a }]); } }
    for (const l of veg.values()) for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) { const d = Math.abs(l[i]!.a - l[j]!.a); if (Math.abs(d - 90) <= 5) { const gx = Math.round(l[i]!.x / res), gy = Math.round(l[i]!.y / res); if (gx >= 0 && gy >= 0 && gx < w && gy < h) sarok[gy * w + gx] = 1; } } }
  const TS = tavTerkep(w, h, sarok);
  const sarokTav = (x: number, y: number) => { const gx = Math.round(x / res), gy = Math.round(y / res); if (gx < 0 || gy < 0 || gx >= w || gy >= h) return 1.5; return Math.min(1.5, TS[gy * w + gx]! * res); };
  const LEVAG = 1.5;
  const tav = (x: number, y: number, a: number) => { const gx = Math.round(x / res), gy = Math.round(y / res); if (gx < 0 || gy < 0 || gx >= w || gy >= h) return LEVAG;
    const f = ((a % 180) + 180) % 180 / (180 / NB), b0 = Math.floor(f), b1 = (f - b0 < 0.5 ? b0 - 1 + NB : b0 + 1) % NB;
    return Math.min(LEVAG, TT[b0 % NB]![gy * w + gx]! * res, TT[b1]![gy * w + gx]! * res); };
  // a kontúr mintapontjai (0,25 m-enként), a súlypont körül
  let cx = 0, cy = 0, cn = 0; for (const p of kontur) for (const [x, y] of p) { cx += x; cy += y; cn++; } cx /= cn; cy /= cn;
  type MP = [number, number, number]; // x, y, az él iránya (fok)
  // (a sarokpontok iránya NaN: a saroktérképen mérve)
  const minta = (d: number) => { const pt: MP[] = []; for (const p0 of kontur) { const p = kifele(p0, d);
    for (let i = 0; i < p.length; i++) { const a = p[(i + p.length - 1) % p.length]!, v = p[i]!, b = p[(i + 1) % p.length]!; const u1 = Math.atan2(v[1] - a[1], v[0] - a[0]), u2 = Math.atan2(b[1] - v[1], b[0] - v[0]); const t = Math.abs((((u2 - u1) * 180) / Math.PI % 360 + 540) % 360 - 180); if (Math.abs(t - 90) <= 8 && Math.hypot(v[0] - a[0], v[1] - a[1]) >= 0.5 && Math.hypot(b[0] - v[0], b[1] - v[1]) >= 0.5) pt.push([v[0] - cx, v[1] - cy, NaN]); }
    for (let i = 0; i < p.length; i++) { const a = p[i]!, b = p[(i + 1) % p.length]!; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.3) continue; const ir = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI; const n = Math.max(1, Math.round(L / 0.25)); for (let k = 0; k < n; k++) pt.push([a[0] + (b[0] - a[0]) * (k + 0.5) / n - cx, a[1] + (b[1] - a[1]) * (k + 0.5) / n - cy, ir]); } } return pt; };
  // forgatások: a helyszínrajz főirányai − a kontúr főiránya, + k·90°
  const kSz: [number, number, number, number][] = []; for (const p of kontur) for (let i = 0; i < p.length; i++) { const a = p[i]!, b = p[(i + 1) % p.length]!; kSz.push([a[0], a[1], b[0], b[1]]); }
  const kIr = foIrany(kSz)[0] ?? 0;
  const szogek = new Set<number>(); for (const a of foIrany(sz)) for (let k = 0; k < 4; k++) szogek.add(((a - kIr + k * 90) % 360 + 360) % 360);
  // (az élpontok átlaga és a sarkok átlaga 60 : 40 arányban)
  const ertek = (pt: MP[], szog: number, c: number, s: number, tx: number, ty: number, kihagy = 1) => { let t = 0, n = 0, ts = 0, ns = 0;
    for (let i = 0; i < pt.length; i++) { const [x, y, a] = pt[i]!; const X = x * c - y * s + tx, Y = x * s + y * c + ty; if (Number.isNaN(a)) { ts += sarokTav(X, Y); ns++; } else if (i % kihagy === 0) { t += tav(X, Y, a + szog); n++; } }
    return ns ? 0.6 * (t / Math.max(1, n)) + 0.4 * (ts / ns) : t / Math.max(1, n); };
  type Jelolt = { szog: number; d: number; tx: number; ty: number; e: number };
  const jeloltek: Jelolt[] = [];
  const mintak = new Map<number, MP[]>(); for (const d of [0, 0.5, 1.0]) mintak.set(d, minta(d));
  // durva keresés: 1 m-es lépés, ritkított mintapontokkal, a 0,5 m-es eltolással
  const pt0 = mintak.get(0.5)!; const ritk = Math.max(1, Math.floor(pt0.length / 60));
  const lep = 1.0;
  for (const szog of szogek) {
    const c = Math.cos((szog * Math.PI) / 180), s = Math.sin((szog * Math.PI) / 180);
    for (let ty = 0; ty < H; ty += lep) for (let tx = 0; tx < W; tx += lep) {
      const e = ertek(pt0, szog, c, s, tx, ty, ritk);
      if (e < 0.8) jeloltek.push({ szog, d: 0.5, tx, ty, e });
    }
  }
  if (!jeloltek.length) return null;
  jeloltek.sort((p, q) => p.e - q.e);
  // a legjobb (egymástól ≥ 5 m-re lévő) jelöltek finomítása: eltolás 0,1 m-es, forgatás 0,5°-os lépéssel, a kontúr
  // kifelé tolása 0 / 0,5 / 1,0 m
  const legjobbak: Jelolt[] = [];
  for (const j of jeloltek) { if (legjobbak.length >= 12) break; if (legjobbak.every((q) => Math.hypot(q.tx - j.tx, q.ty - j.ty) >= 5)) legjobbak.push(j); }
  const finom: Jelolt[] = legjobbak.map((j0) => {
    let b = { ...j0, e: Infinity };
    for (const d of [0, 0.5, 1.0]) { const pt = mintak.get(d)!;
      for (let da = -2; da <= 2; da += 0.5) { const szog = j0.szog + da, c = Math.cos((szog * Math.PI) / 180), s = Math.sin((szog * Math.PI) / 180);
        for (let dy = -1; dy <= 1.001; dy += 0.25) for (let dx = -1; dx <= 1.001; dx += 0.25) { const e = ertek(pt, szog, c, s, j0.tx + dx, j0.ty + dy, 2); if (e < b.e) b = { szog, d, tx: j0.tx + dx, ty: j0.ty + dy, e }; } } }
    const pt = mintak.get(b.d)!; const c = Math.cos((b.szog * Math.PI) / 180), s = Math.sin((b.szog * Math.PI) / 180); const b0 = { ...b };
    for (let dy = -0.25; dy <= 0.251; dy += 0.05) for (let dx = -0.25; dx <= 0.251; dx += 0.05) { const e = ertek(pt, b0.szog, c, s, b0.tx + dx, b0.ty + dy); if (e < b.e) b = { ...b0, tx: b0.tx + dx, ty: b0.ty + dy, e }; }
    return b;
  }).sort((p, q) => p.e - q.e);
  const b = finom[0]!; const masodik = finom.find((q) => Math.hypot(q.tx - b.tx, q.ty - b.ty) >= 5)?.e ?? LEVAG;
  const pt = mintak.get(b.d)!; const c = Math.cos((b.szog * Math.PI) / 180), s = Math.sin((b.szog * Math.PI) / 180);
  let jo = 0, ne = 0; for (const [x, y, a] of pt) if (!Number.isNaN(a) && ++ne && tav(x * c - y * s + b.tx, x * s + y * c + b.ty, a + b.szog) <= 0.25) jo++;
  // vissza: a modell p → lap q (pt): q = (R·(p − c) + t) / mPt
  return { szog: b.szog, tx: (b.tx - (cx * c - cy * s)) / mPt, ty: (b.ty - (cx * s + cy * c)) / mPt, mPt, eltolas: b.d, atlag: b.e, talalat: jo / Math.max(1, ne), masodik };
}

/**
 * Homlokzati (metszet = true: metszeti) nézetek a lapon (felirattól függetlenül): a terepvonal (≥ 6 m-es vízszintes, darabokban is – 3 m-es
 * résig összefűzve) fölött a földig érő, legalább 2 m magas függőlegesek (falsarok, falsík) adják a ház falainak
 * vízszintes kiterjedését [a, b] a lapon (m). A fák, bokrok görbék – kimaradnak; a lapkeret és a pecsét hosszú vonalai is.
 * A függőlegesek helye (fx) a sarkok illesztéséhez.
 */
export interface HomlokzatNezet { y: number; a: number; b: number; fx: number[] }
export function homlokzatNezetek(lap: Lap, mPt: number, metszet = false): HomlokzatNezet[] {
  const Hs: { y: number; x0: number; x1: number }[] = [], V: { x: number; y0: number; y1: number }[] = [];
  for (const u of lap.utvonalak) {
    if (u.muvelet === 'none' || u.gorbe) continue; const [bx0, by0, bx1, by1] = u.bbox; if (bx1 - bx0 > 0.8 * lap.szel || by1 - by0 > 0.8 * lap.mag) continue;
    for (const p of u.pontok) for (let i = 0; i + 3 < p.length; i += 2) {
      const dx = Math.abs(p[i + 2]! - p[i]!) * mPt, dy = Math.abs(p[i + 3]! - p[i + 1]!) * mPt;
      if (dx >= 0.3 && dy < 0.01 * dx) Hs.push({ y: ((p[i + 1]! + p[i + 3]!) / 2) * mPt, x0: Math.min(p[i]!, p[i + 2]!) * mPt, x1: Math.max(p[i]!, p[i + 2]!) * mPt });
      if (dy >= 0.3 && dx < 0.01 * dy) V.push({ x: ((p[i]! + p[i + 2]!) / 2) * mPt, y0: Math.min(p[i + 1]!, p[i + 3]!) * mPt, y1: Math.max(p[i + 1]!, p[i + 3]!) * mPt });
    }
  }
  Hs.sort((a, b) => a.y - b.y || a.x0 - b.x0);
  const G: { y: number; x0: number; x1: number }[] = [];
  for (const h of Hs) { const g = G.find((q) => Math.abs(q.y - h.y) <= 0.03 && h.x0 <= q.x1 + 3 && h.x1 >= q.x0 - 3); if (g) { g.x0 = Math.min(g.x0, h.x0); g.x1 = Math.max(g.x1, h.x1); } else G.push({ ...h }); }
  const ki: HomlokzatNezet[] = [];
  for (const g of G) {
    if (g.x1 - g.x0 < 6) continue;
    // (metszetben a falmetszet a terepvonalon át az alapozásig fut: a terepet keresztező függőleges is)
    const fv = V.filter((v) => v.x >= g.x0 - 0.1 && v.x <= g.x1 + 0.1 && v.y1 >= g.y - 0.6 && (v.y1 <= g.y + 0.05 || metszet && v.y0 <= g.y - 2.0 && v.y1 <= g.y + 3) && Math.min(v.y1, g.y) - v.y0 >= 2.0);
    if (fv.length < 2) continue;
    const a = Math.min(...fv.map((v) => v.x)), b = Math.max(...fv.map((v) => v.x));
    if (b - a < 2) continue;
    // (egymáshoz közeli – ugyanazon nézet több terepvonala – közül az alsó)
    const fx = [...new Set(fv.map((v) => Math.round(v.x * 20) / 20))].sort((p, q) => p - q);
    const r = ki.findIndex((q) => Math.abs(q.a - a) < 0.3 && Math.abs(q.b - b) < 0.3 && Math.abs(q.y - g.y) < 1.5);
    if (r >= 0) { if (g.y > ki[r]!.y) ki[r] = { y: g.y, a, b, fx }; } else ki.push({ y: g.y, a, b, fx });
  }
  return ki;
}

/**
 * Egy homlokzati nézet illesztése a kontúrhoz: a négy nézési irány (a néző a lap alja / teteje / bal / jobb széle felől)
 * közül az, amelyiknél a kontúr látható sarkainak vetülete a nézet függőlegeseire esik, és a szélesség egyezik.
 * irany: a néző oldala a modell lapirányában (0: fent – a néző a −y felől, 90: jobb, 180: lent, 270: bal); o: a nézet
 * x-e = o + u (u a kontúr vetülete a néző jobb keze felé, a bal szélső pont 0); pont: 0–1.
 */
export function homlokzatNezetIllesztes(nz: HomlokzatNezet, kontur: P2[][]): { irany: number; o: number; pont: number; szelesseg: number }[] {
  const elek = kontur.flatMap((p) => p.map((a, i) => [a, p[(i + 1) % p.length]!] as [P2, P2]));
  const lathato = (x: number, y: number, v: P2) => { const px = x + v[0] * 0.05, py = y + v[1] * 0.05, qx = x + v[0] * 1000, qy = y + v[1] * 1000;
    for (const [a, b] of elek) { const d = (qx - px) * (b[1] - a[1]) - (qy - py) * (b[0] - a[0]); if (Math.abs(d) < 1e-12) continue; const t = ((a[0] - px) * (b[1] - a[1]) - (a[1] - py) * (b[0] - a[0])) / d, u = ((a[0] - px) * (qy - py) - (a[1] - py) * (qx - px)) / d; if (t > 0 && t < 1 && u > 1e-6 && u < 1 - 1e-6) return false; } return true; };
  // a néző a v irányban áll; a nézet jobbra mutató tengelye j (képernyő-koordinátában, y lefelé: a −y felé néző jobb keze +x)
  const nezok: { irany: number; v: P2; j: P2 }[] = [{ irany: 180, v: [0, 1], j: [1, 0] }, { irany: 0, v: [0, -1], j: [-1, 0] }, { irany: 270, v: [-1, 0], j: [0, 1] }, { irany: 90, v: [1, 0], j: [0, -1] }];
  const W = nz.b - nz.a, ki: { irany: number; o: number; pont: number; szelesseg: number }[] = [];
  for (const n of nezok) {
    const all = kontur.flat().map(([x, y]) => x * n.j[0] + y * n.j[1]); const u0 = Math.min(...all), L = Math.max(...all) - u0;
    const sz = Math.abs(W - L) / L; if (sz > 0.06) continue;
    const U = [...new Set(kontur.flat().filter(([x, y]) => lathato(x, y, n.v)).map(([x, y]) => Math.round((x * n.j[0] + y * n.j[1] - u0) * 20) / 20))].sort((p, q) => p - q);
    // a nézet bal széle a kontúr bal szélső pontja; a belső sarkok a függőlegeseken (± 0,12 m)
    const o = nz.a; let db = 0; for (const u of U) if (nz.fx.some((x) => Math.abs(x - (o + u)) <= 0.12)) db++;
    ki.push({ irany: n.irany, o, pont: 0.5 * (1 - sz / 0.06) + 0.5 * (U.length ? db / U.length : 0), szelesseg: sz });
  }
  return ki.sort((p, q) => q.pont - p.pont);
}

/** A lap vonalainak irány szerinti távolságtérképei (12 irányosztály, 15°-onként; cella: res m). */
export function iranyTerkepek(lap: Lap, mPt: number, maxCella = 1.5e6) {
  const sz: [number, number, number, number][] = [];
  for (const u of lap.utvonalak) {
    if (u.muvelet === 'none') continue; const [bx0, by0, bx1, by1] = u.bbox; if (bx1 - bx0 > 0.8 * lap.szel || by1 - by0 > 0.8 * lap.mag) continue;
    for (const p of u.pontok) for (let i = 0; i + 3 < p.length; i += 2) { const L = Math.hypot(p[i + 2]! - p[i]!, p[i + 3]! - p[i + 1]!) * mPt; if (L >= 0.1) sz.push([p[i]! * mPt, p[i + 1]! * mPt, p[i + 2]! * mPt, p[i + 3]! * mPt]); }
  }
  const W = lap.szel * mPt, H = lap.mag * mPt, NB = 12;
  const res = Math.max(0.05, Math.sqrt((W * H) / maxCella));
  const w = Math.ceil(W / res) + 1, h = Math.ceil(H / res) + 1;
  const vonalak = Array.from({ length: NB }, () => new Uint8Array(w * h));
  for (const [x0, y0, x1, y1] of sz) {
    const a = ((Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI % 180 + 180) % 180, bin = Math.floor(a / (180 / NB)) % NB;
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (res / 2)));
    for (let k = 0; k <= n; k++) { const x = Math.round((x0 + (x1 - x0) * k / n) / res), y = Math.round((y0 + (y1 - y0) * k / n) / res); if (x >= 0 && y >= 0 && x < w && y < h) vonalak[bin]![y * w + x] = 1; }
  }
  const TT = vonalak.map((v) => tavTerkep(w, h, v));
  const LEVAG = 1.0;
  const tav = (x: number, y: number, a: number) => { const gx = Math.round(x / res), gy = Math.round(y / res); if (gx < 0 || gy < 0 || gx >= w || gy >= h) return LEVAG;
    const f = ((a % 180) + 180) % 180 / (180 / NB), b0 = Math.floor(f) % NB, b1 = (f - Math.floor(f) < 0.5 ? b0 - 1 + NB : b0 + 1) % NB;
    return Math.min(LEVAG, TT[b0]![gy * w + gx]! * res, TT[b1]![gy * w + gx]! * res); };
  return { W, H, res, tav, LEVAG };
}

/** Az alaprajzi modell egy homlokzati nyílása (a falon: a kezdő végtől t m-re, szel széles; z: parapet és magasság). */
export interface IllNyilas { a: P2; b: P2; t: number; szel: number; z0: number; mag: number }

/**
 * Homlokzati lap illesztése az alaprajzhoz: a négy nézési irányból várt rajzolat – a látható sarkok függőlegesei
 * (a terep fölött 0,3–2,3 m) és a néző felé néző falak nyílásainak szélei (függőleges oldalak, vízszintes alsó-felső él) –
 * mintaként a lap vonalai között (irány szerinti távolságtérkép). Eltolás: a lap teljes területén (vízszintesen és
 * függőlegesen – a ±0,00 helye). Irányonként a legjobb, egymástól ≥ 5 m-re lévő elhelyezések.
 * Visszaad: irany (a néző oldala, mint homlokzatNezetIllesztes), ox (a nézet x-e = ox + u), oy (a lap y-a = oy − z),
 * atlag (m), talalat (a mintapontok ≤ 0,1 m-es aránya).
 */
export function homlokzatLapIllesztes(lap: Lap, mPt: number, kontur: P2[][], nyilasok: IllNyilas[]): { irany: number; ox: number; oy: number; atlag: number; talalat: number }[] {
  const T = iranyTerkepek(lap, mPt);
  const elek = kontur.flatMap((p) => p.map((a, i) => [a, p[(i + 1) % p.length]!] as [P2, P2]));
  const benne = (x: number, y: number) => { let b = false; for (const p of kontur) for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, yi] = p[i]!, [xj, yj] = p[j]!; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) b = !b; } return b; };
  const lathato = (x: number, y: number, v: P2) => { const px = x + v[0] * 0.05, py = y + v[1] * 0.05, qx = x + v[0] * 1000, qy = y + v[1] * 1000;
    for (const [a, b] of elek) { const d = (qx - px) * (b[1] - a[1]) - (qy - py) * (b[0] - a[0]); if (Math.abs(d) < 1e-12) continue; const t = ((a[0] - px) * (b[1] - a[1]) - (a[1] - py) * (b[0] - a[0])) / d, u = ((a[0] - px) * (qy - py) - (a[1] - py) * (qx - px)) / d; if (t > 0 && t < 1 && u > 1e-6 && u < 1 - 1e-6) return false; } return true; };
  const nezok: { irany: number; v: P2; j: P2 }[] = [{ irany: 180, v: [0, 1], j: [1, 0] }, { irany: 0, v: [0, -1], j: [-1, 0] }, { irany: 270, v: [-1, 0], j: [0, 1] }, { irany: 90, v: [1, 0], j: [0, -1] }];
  const ki: { irany: number; ox: number; oy: number; atlag: number; talalat: number }[] = [];
  for (const n of nezok) {
    const all = kontur.flat().map(([x, y]) => x * n.j[0] + y * n.j[1]); const u0 = Math.min(...all);
    // mintapontok: [u, z, irány (0: vízszintes, 90: függőleges)]
    const M: [number, number, number][] = [];
    const U = [...new Set(kontur.flat().filter(([x, y]) => lathato(x, y, n.v)).map(([x, y]) => Math.round((x * n.j[0] + y * n.j[1] - u0) * 20) / 20))];
    for (const u of U) for (let z = 0.3; z <= 2.3; z += 0.25) M.push([u, z, 90]);
    for (const ny of nyilasok) {
      const dx = ny.b[0] - ny.a[0], dy = ny.b[1] - ny.a[1], L = Math.hypot(dx, dy); if (L < 0.1) continue;
      const nx = -dy / L, nyy = dx / L; if (Math.abs(nx * n.v[0] + nyy * n.v[1]) < 0.9) continue;
      const mx = (ny.a[0] + ny.b[0]) / 2 + n.v[0] * 0.5, my = (ny.a[1] + ny.b[1]) / 2 + n.v[1] * 0.5; if (benne(mx, my)) continue;
      const p0: P2 = [ny.a[0] + (dx / L) * ny.t, ny.a[1] + (dy / L) * ny.t], p1: P2 = [ny.a[0] + (dx / L) * (ny.t + ny.szel), ny.a[1] + (dy / L) * (ny.t + ny.szel)];
      // (a nyílás a néző felől látszik: a középpontjából a néző felé induló sugár nem metszi a kontúrt)
      if (!lathato((p0[0] + p1[0]) / 2 + n.v[0] * 0.3, (p0[1] + p1[1]) / 2 + n.v[1] * 0.3, n.v)) continue;
      const ua = p0[0] * n.j[0] + p0[1] * n.j[1] - u0, ub = p1[0] * n.j[0] + p1[1] * n.j[1] - u0, ul = Math.min(ua, ub), ur = Math.max(ua, ub);
      for (let z = ny.z0 + 0.1; z <= ny.z0 + ny.mag - 0.1; z += 0.2) { M.push([ul, z, 90]); M.push([ur, z, 90]); }
      for (let u = ul + 0.1; u <= ur - 0.1; u += 0.2) { M.push([u, ny.z0 + ny.mag, 0]); if (ny.z0 > 0.2) M.push([u, ny.z0, 0]); }
    }
    if (M.length < 20) continue;
    const ertek = (ox: number, oy: number, kihagy = 1) => { let t = 0, c = 0; for (let i = 0; i < M.length; i += kihagy) { const [u, z, a] = M[i]!; t += T.tav(ox + u, oy - z, a); c++; } return t / c; };
    const rk = Math.max(1, Math.floor(M.length / 80));
    const jel: { ox: number; oy: number; e: number }[] = [];
    for (let oy = 2; oy < T.H; oy += 0.5) for (let ox = -2; ox < T.W; ox += 0.5) { const e = ertek(ox, oy, rk); if (e < 0.45) jel.push({ ox, oy, e }); }
    jel.sort((p, q) => p.e - q.e);
    const leg: { ox: number; oy: number; e: number }[] = [];
    for (const j of jel) { if (leg.length >= 25) break; if (leg.every((q) => Math.hypot(q.ox - j.ox, q.oy - j.oy) >= 3)) leg.push(j); }
    // a találati arány a pontos helyen, és a 0,35 m-rel elcsúsztatott helyeken (háttér): a sűrű mintázatú (burkolat,
    // cserépsor, sraff) felületen a minta bárhol „talál” – a kontraszt (pontos − háttér) dönt
    const arany = (ox: number, oy: number) => { let jo = 0; for (const [u, z, a] of M) if (T.tav(ox + u, oy - z, a) <= 0.08) jo++; return jo / M.length; };
    for (const j0 of leg) {
      let b = { ...j0, e: Infinity };
      for (let dy = -0.5; dy <= 0.501; dy += 0.05) for (let dx = -0.5; dx <= 0.501; dx += 0.05) { const e = ertek(j0.ox + dx, j0.oy + dy); if (e < b.e) b = { ox: j0.ox + dx, oy: j0.oy + dy, e }; }
      const t = arany(b.ox, b.oy);
      const hatter = [[0.35, 0], [-0.35, 0], [0, 0.35], [0, -0.35]].reduce((s0, [dx, dy]) => s0 + arany(b.ox + dx!, b.oy + dy!), 0) / 4;
      ki.push({ irany: n.irany, ox: b.ox, oy: b.oy, atlag: b.e, talalat: t - hatter });
    }
  }
  return ki.sort((p, q) => q.talalat - p.talalat);
}

const AZ_CIM: Record<string, number> = { 'É': 0, 'ÉK': 45, 'K': 90, 'DK': 135, 'D': 180, 'DNy': 225, 'Ny': 270, 'ÉNy': 315 };
export interface HomlokzatIll { cim: string; az: number; irany: number; nezet: HomlokzatNezet; o: number; L: number; szelElteres: number; sarok: number; nulla: number | null }

/**
 * Feliratos homlokzati nézetek illesztése: a felirat (É, DK …) égtája és az alaprajz északja adja a nézés irányát
 * (a néző oldala a lapon: az + észak, 90°-ra kerekítve); a nézet a felirathoz legközelebbi, a vetület szélességével
 * (± 6 %) egyező terepvonalas nézet; vízszintes hely: a falak bal széle (a látható sarkok egyezése finomít); magasság: a
 * nézet ±0,00 feliratának helye (m, a lap y-a), ha van.
 */
export function homlokzatCimesIllesztes(lap: Lap, mPt: number, kontur: P2[][], eszakSzog: number, cimek: { x: number; y: number; t: string }[]): HomlokzatIll[] {
  const nz = homlokzatNezetek(lap, mPt);
  const ki: HomlokzatIll[] = [];
  for (const c of cimek) {
    const az = AZ_CIM[c.t]; if (az === undefined) continue;
    const irany = ((Math.round(((az + eszakSzog) % 360) / 90) * 90) % 360 + 360) % 360;
    const jelolt = nz.map((n) => ({ n, il: homlokzatNezetIllesztes(n, kontur).find((q) => q.irany === irany) })).filter((q) => q.il);
    if (!jelolt.length) continue;
    const cx = c.x * mPt, cy = c.y * mPt;
    // (a felirat a nézet alatt vagy fölött, a vízszintes kiterjedésén belül / közelében: a legközelebbi)
    const tav = (n: HomlokzatNezet) => Math.max(0, n.a - cx, cx - n.b) + Math.abs(cy - n.y) * 0.5;
    jelolt.sort((p, q) => tav(p.n) - tav(q.n));
    const { n, il } = jelolt[0]!;
    if (tav(n) > 25) continue;
    const all = kontur.flat(); const L = Math.max(...all.map(([x, y]) => irany === 0 ? -x : irany === 180 ? x : irany === 90 ? -y : y)) - Math.min(...all.map(([x, y]) => irany === 0 ? -x : irany === 180 ? x : irany === 90 ? -y : y));
    // ±0,00 a nézet sávjában
    const nul = lap.szovegek.filter((t) => /[±]\s*0[,.]00/.test(t.s) || /^\+?\s*0[,.]000?$/.test(t.s.trim())).map((t) => ({ x: t.x * mPt, y: t.y * mPt })).filter((t) => t.x >= n.a - 4 && t.x <= n.b + 4 && t.y >= n.y - 4 && t.y <= n.y + 1).sort((p, q) => Math.abs(p.y - n.y) - Math.abs(q.y - n.y))[0];
    ki.push({ cim: c.t, az, irany, nezet: n, o: n.a, L, szelElteres: il!.szelesseg, sarok: il!.pont, nulla: nul ? nul.y : null });
  }
  return ki;
}

/**
 * Metszésvonalak az alaprajzi lapon: a metszetek betűjele (A, B …) a lapon legalább kétszer, egymástól legtávolabbi
 * két előfordulása a metszésvonal két vége (a vonal a kettőn át fut). pt-ben.
 */
export function metszesVonalak(lap: Lap, betuk: string[], mPt: number): { betu: string; a: P2; b: P2 }[] {
  const ki: { betu: string; a: P2; b: P2 }[] = [];
  for (const b of betuk) {
    const t = lap.szovegek.filter((q) => q.s.trim() === b);
    if (t.length < 2) continue;
    const kp = (q: (typeof t)[number]): P2 => { const a = (q.szog * Math.PI) / 180; return [q.x + Math.cos(a) * q.szel / 2, q.y - Math.sin(a) * q.szel / 2]; };
    let leg: { d: number; a: P2; b: P2 } | null = null;
    for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) { const A = kp(t[i]!), B = kp(t[j]!); const d = Math.hypot(A[0] - B[0], A[1] - B[1]); if (!leg || d > leg.d) leg = { d, a: A, b: B }; }
    if (leg && leg.d * mPt >= 3) ki.push({ betu: b, a: leg.a, b: leg.b });
  }
  return ki;
}

/** A metszésvonal (modell, m) és a kontúr metszéspontjai a vonal mentén (m, az a végtől), növekvő. */
export function metszesKontur(a: P2, b: P2, kontur: P2[][]): number[] {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1e-9) return [];
  const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L; const t: number[] = [];
  for (const p of kontur) for (let i = 0; i < p.length; i++) {
    const P = p[i]!, Q = p[(i + 1) % p.length]!; const ex = Q[0] - P[0], ey = Q[1] - P[1]; const d = ux * ey - uy * ex; if (Math.abs(d) < 1e-12) continue;
    const s = ((P[0] - a[0]) * ey - (P[1] - a[1]) * ex) / d, r = ((P[0] - a[0]) * uy - (P[1] - a[1]) * ux) / d;
    if (r >= 0 && r < 1) t.push(s);
  }
  return t.sort((p, q) => p - q);
}

/**
 * MÉRETLÁNCOK ÖSSZEVETÉSE (Balázs, 2026-11-24: „nézzük tovább így” – a rajzokat a tervező saját méretei kötik össze,
 * nem a felismert kontúr): két lánc jelei (a lánc menti helyek, m, növekvő) – azonos teljes hossz (± 3 cm) mellett a
 * belső jelek egyezése egyenes és fordított irányban. pont: az egyező belső jelek aránya a kevesebb belső jelű láncéhoz
 * (a részletesebb lánc jelei a másikét tartalmazhatják – összevont tagok); a két vég mindig egyezik.
 */
export function lancEgyezes(A: number[], B: number[], tures = 0.03): { pont: number; forditott: boolean; db: number } | null {
  if (A.length < 2 || B.length < 2) return null;
  const LA = A[A.length - 1]! - A[0]!, LB = B[B.length - 1]! - B[0]!;
  if (Math.abs(LA - LB) > Math.max(tures, 0.002 * LA)) return null;
  const a = A.map((x) => x - A[0]!), b0 = B.map((x) => x - B[0]!);
  let leg: { pont: number; forditott: boolean; db: number } | null = null;
  for (const forditott of [false, true]) {
    const b = forditott ? b0.map((x) => LB - x).reverse() : b0;
    const ia = a.slice(1, -1), ib = b.slice(1, -1);
    const db = ib.filter((x) => ia.some((y) => Math.abs(x - y) <= tures)).length;
    const n = Math.min(ia.length, ib.length);
    const pont = n ? db / n : 0.5; // (belső jel nélkül csak a hossz egyezik)
    if (!leg || pont > leg.pont || (pont === leg.pont && db > leg.db)) leg = { pont, forditott, db };
  }
  return leg;
}

/**
 * Tengelyjelek: körben (görbe, 4–16 mm átmérőjű, közel kör alakú útvonal) álló egy-két karakteres felirat (A, B', 12);
 * a tengely iránya a jel középpontján átmenő, legalább 2 m hosszú egyenes (függőleges 'v' vagy vízszintes 'h' a lapon);
 * hely: függőleges tengelynél az x, vízszintesnél az y (m, a lap koordinátáiban).
 */
export interface Tengelyjel { jel: string; x: number; y: number; irany: 'v' | 'h' | null; hely: number }
export function tengelyjelek(lap: Lap, mPt: number): Tengelyjel[] {
  const kor = lap.utvonalak.filter((u) => { if (!u.gorbe || u.muvelet === 'none') return false; const w = u.bbox[2] - u.bbox[0], h = u.bbox[3] - u.bbox[1]; return w >= 11 && w <= 45 && Math.abs(w - h) <= 0.15 * w; });
  if (!kor.length) return [];
  const V: { x: number; y0: number; y1: number }[] = [], H: { y: number; x0: number; x1: number }[] = [];
  for (const u of lap.utvonalak) { if (u.muvelet === 'none' || u.muvelet === 'fill') continue;
    for (const p of u.pontok) for (let i = 0; i + 3 < p.length; i += 2) { const dx = Math.abs(p[i + 2]! - p[i]!), dy = Math.abs(p[i + 3]! - p[i + 1]!);
      if (dy * mPt >= 2 && dx < 0.01 * dy) V.push({ x: (p[i]! + p[i + 2]!) / 2, y0: Math.min(p[i + 1]!, p[i + 3]!), y1: Math.max(p[i + 1]!, p[i + 3]!) });
      else if (dx * mPt >= 2 && dy < 0.01 * dx) H.push({ y: (p[i + 1]! + p[i + 3]!) / 2, x0: Math.min(p[i]!, p[i + 2]!), x1: Math.max(p[i]!, p[i + 2]!) }); } }
  const ki: Tengelyjel[] = [];
  for (const t of lap.szovegek) {
    const s = t.s.trim(); if (!/^([A-Z]{1,2}|\d{1,2})['’]?$/.test(s)) continue;
    const a = (t.szog * Math.PI) / 180, cx = t.x + Math.cos(a) * t.szel / 2, cy = t.y - Math.sin(a) * t.szel / 2 - (t.meret || 2) / 2;
    const k = kor.find((u) => cx >= u.bbox[0] && cx <= u.bbox[2] && cy >= u.bbox[1] && cy <= u.bbox[3]); if (!k) continue;
    const kx = (k.bbox[0] + k.bbox[2]) / 2, ky = (k.bbox[1] + k.bbox[3]) / 2, r = (k.bbox[2] - k.bbox[0]) / 2;
    // a tengelyvonal: a kör középpontjának vonalában, a körtől kifelé (a körhöz ér vagy belemetsz)
    const v = V.some((q) => Math.abs(q.x - kx) <= 0.15 * r && (Math.abs(q.y0 - (ky + r)) <= 1.5 * r || Math.abs(q.y1 - (ky - r)) <= 1.5 * r || (q.y0 <= ky && q.y1 >= ky)));
    const h = H.some((q) => Math.abs(q.y - ky) <= 0.15 * r && (Math.abs(q.x0 - (kx + r)) <= 1.5 * r || Math.abs(q.x1 - (kx - r)) <= 1.5 * r || (q.x0 <= kx && q.x1 >= kx)));
    const irany = v && !h ? 'v' : h && !v ? 'h' : null;
    if (ki.some((q) => q.jel === s.replace('’', "'") && Math.hypot(q.x - kx * mPt, q.y - ky * mPt) < 0.5)) continue;
    ki.push({ jel: s.replace('’', "'"), x: kx * mPt, y: ky * mPt, irany, hely: irany === 'h' ? ky * mPt : kx * mPt });
  }
  // (a tengelyvonal gyakran szaggatott – pontvonal –, egyetlen hosszú szakasza nincs: az irány a jelek elrendezéséből)
  // ugyanaz a jel két helyen (a tengely két végén): a kettőt összekötő irány; különben a család (számok / betűk) többi
  // jele: egy sorban (azonos y) állnak → függőleges tengelyek, egy oszlopban → vízszintesek
  const csalad = (j: string) => (/^\d/.test(j) ? 'szam' : 'betu');
  for (const t of ki) {
    if (t.irany) continue;
    const par = ki.find((q) => q !== t && q.jel === t.jel && Math.hypot(q.x - t.x, q.y - t.y) > 2);
    if (par) { t.irany = Math.abs(par.x - t.x) < Math.abs(par.y - t.y) ? 'v' : 'h'; continue; }
  }
  for (const cs of ['szam', 'betu']) {
    const l = ki.filter((t) => csalad(t.jel) === cs); if (l.length < 2) continue;
    const sorban = l.filter((t) => l.some((q) => q !== t && q.jel !== t.jel && Math.abs(q.y - t.y) < 0.3)).length, oszlopban = l.filter((t) => l.some((q) => q !== t && q.jel !== t.jel && Math.abs(q.x - t.x) < 0.3)).length;
    const ir: 'v' | 'h' | null = sorban > 1.5 * oszlopban ? 'v' : oszlopban > 1.5 * sorban ? 'h' : null;
    for (const t of l) if (!t.irany && ir) t.irany = ir;
  }
  for (const t of ki) t.hely = t.irany === 'h' ? t.y : t.x;
  return ki;
}

/**
 * Két lap tengelyjeleinek illesztése egy irányban: a B lap jeleinek helye = s · (az A lap azonos jelű tengelyének helye) + o
 * (s = ±1: tükrözés). Az A lap egy tengelycsaládja (irany: 'v' / 'h') és a B lap egy családja; a közös jelekből a
 * legtöbb (± 0,1 m-en belül) egyezést adó s, o. Null, ha kettőnél kevesebb a közös jel.
 */
export function tengelyIllesztes(A: Tengelyjel[], B: Tengelyjel[], iranyA: 'v' | 'h', iranyB: 'v' | 'h'): { s: 1 | -1; o: number; db: number; kozos: number } | null {
  const a = new Map<string, number[]>(); for (const t of A) if (t.irany === iranyA) (a.get(t.jel) ?? a.set(t.jel, []).get(t.jel)!).push(t.hely);
  const b = new Map<string, number[]>(); for (const t of B) if (t.irany === iranyB) (b.get(t.jel) ?? b.set(t.jel, []).get(t.jel)!).push(t.hely);
  // (egy jel egy lapon több helyen is lehet – a tengely két végén ugyanott: a medián)
  const med = (l: number[]) => { const q = [...l].sort((x, y) => x - y); return q[q.length >> 1]!; };
  const parok: [number, number][] = []; for (const [j, l] of a) { const m = b.get(j); if (m) parok.push([med(l), med(m)]); }
  if (parok.length < 2) return null;
  let leg: { s: 1 | -1; o: number; db: number; kozos: number } | null = null;
  for (const s of [1, -1] as const) for (const [pa, pb] of parok) {
    const o = pb - s * pa; const jo = parok.filter(([x, y]) => Math.abs(y - (s * x + o)) <= 0.1);
    if (!leg || jo.length > leg.db) { const om = jo.reduce((t, [x, y]) => t + (y - s * x), 0) / jo.length; leg = { s, o: om, db: jo.length, kozos: parok.length }; }
  }
  return leg && leg.db >= 2 ? leg : null;
}
