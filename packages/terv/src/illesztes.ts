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
