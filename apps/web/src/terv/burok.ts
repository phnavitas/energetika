/**
 * Hőburok-körvonal az alaprajzon: a fűtött helyiségek összevont területének külső határa (a külső falak belső síkja).
 * A felhasználó a körvonalat szerkesztheti (pont elhúzása, beszúrása, törlése); ha szerkesztette, a homlokzati falak és
 * a külső nyílászárók a körvonal szerint kerülnek át: falhossz és tájolás az élekből, a nyílászárók a legközelebbi élhez.
 */
import type { Raszter } from './raszter';

/** Körvonal lapkoordinátában (pt), az óramutató járásával megegyező vagy ellentétes sorrendben. */
export type Poligon = [number, number][];

const lapX = (r: Raszter, gx: number) => r.x0 + (gx * r.px) / r.mPerPt;
const lapY = (r: Raszter, gy: number) => r.y0 + (gy * r.px) / r.mPerPt;

/** Douglas–Peucker egyszerűsítés zárt sokszögre. */
function egyszerusit(p: Poligon, eps: number): Poligon {
  if (p.length < 4) return p;
  const tav = (q: [number, number], a: [number, number], b: [number, number]) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1e-9;
    return Math.abs((q[0] - a[0]) * dy - (q[1] - a[1]) * dx) / l;
  };
  const dp = (l: Poligon): Poligon => {
    if (l.length < 3) return l;
    let mx = 0, mi = 0;
    for (let i = 1; i < l.length - 1; i++) { const d = tav(l[i]!, l[0]!, l[l.length - 1]!); if (d > mx) { mx = d; mi = i; } }
    if (mx <= eps) return [l[0]!, l[l.length - 1]!];
    const a = dp(l.slice(0, mi + 1)), b = dp(l.slice(mi));
    return [...a.slice(0, -1), ...b];
  };
  // a legtávolabbi pontpárnál kettévágva
  let j = 0, d0 = 0;
  for (let i = 1; i < p.length; i++) { const d = Math.hypot(p[i]![0] - p[0]![0], p[i]![1] - p[0]![1]); if (d > d0) { d0 = d; j = i; } }
  const a = dp(p.slice(0, j + 1)), b = dp([...p.slice(j), p[0]!]);
  return [...a.slice(0, -1), ...b.slice(0, -1)];
}

export const terulet = (p: Poligon) => p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]!; return s + a[0] * b[1] - b[0] * a[1]; }, 0) / 2;

export function bennE(p: Poligon, x: number, y: number): boolean {
  let be = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i]!, [xj, yj] = p[j]!;
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) be = !be;
  }
  return be;
}

/**
 * A fűtött helyiségek (raszterindexek) körvonala: a helyiségek közti belső falakat (≤ ~0,7 m) lezárva, a külső falak
 * belső síkján. Csak a külső határvonal (a belső, fűtetlen „szigetek” nélkül), 4 m²-nél kisebb foltok nélkül.
 */
export function burokAuto(r: Raszter, futott: ReadonlySet<number>): Poligon[] {
  const { w, h } = r;
  let m = new Uint8Array(w * h);
  for (let k = 0; k < w * h; k++) { const c = r.cimke[k]!; if (c >= 2 && futott.has(c - 2)) m[k] = 1; }
  // zárás (dilatáció + erózió) a belső falak vastagságáig: a szomszédos fűtött helyiségek egy foltba kerülnek
  const R = Math.max(1, Math.round(0.36 / r.px));
  const tagit = (be: Uint8Array, ertek: 0 | 1) => {
    // négyzetes szerkezeti elem, soronként majd oszloponként
    const ki = new Uint8Array(w * h), tmp = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      let utolso = -1e9;
      for (let x = 0; x < w; x++) { if (be[y * w + x] === ertek) utolso = x; if (x - utolso <= R) tmp[y * w + x] = 1; }
      utolso = 1e9;
      for (let x = w - 1; x >= 0; x--) { if (be[y * w + x] === ertek) utolso = x; if (utolso - x <= R) tmp[y * w + x] = 1; }
    }
    for (let x = 0; x < w; x++) {
      let utolso = -1e9;
      for (let y = 0; y < h; y++) { if (tmp[y * w + x]) utolso = y; if (y - utolso <= R) ki[y * w + x] = 1; }
      utolso = 1e9;
      for (let y = h - 1; y >= 0; y--) { if (tmp[y * w + x]) utolso = y; if (utolso - y <= R) ki[y * w + x] = 1; }
    }
    return ki;
  };
  const dil = tagit(m, 1);
  const kulso = new Uint8Array(w * h); for (let k = 0; k < w * h; k++) kulso[k] = dil[k] ? 0 : 1;
  const er = tagit(kulso, 1);
  m = new Uint8Array(w * h); for (let k = 0; k < w * h; k++) m[k] = er[k] ? 0 : 1;
  // határélek: a maszkos cella bal oldalán haladva (y lefelé nő) – irányított élek csúcsról csúcsra
  const be = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && m[y * w + x] === 1;
  const kov = new Map<number, number[]>();
  const kulcs = (x: number, y: number) => y * (w + 1) + x;
  const el = (x1: number, y1: number, x2: number, y2: number) => { const a = kulcs(x1, y1); const l = kov.get(a); if (l) l.push(kulcs(x2, y2)); else kov.set(a, [kulcs(x2, y2)]); };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!be(x, y)) continue;
    if (!be(x, y - 1)) el(x, y, x + 1, y);
    if (!be(x + 1, y)) el(x + 1, y, x + 1, y + 1);
    if (!be(x, y + 1)) el(x + 1, y + 1, x, y + 1);
    if (!be(x - 1, y)) el(x, y + 1, x, y);
  }
  const hurkok: Poligon[] = [];
  for (const [start] of kov) {
    if (!kov.get(start)?.length) continue;
    const pts: [number, number][] = [];
    let a = start;
    for (let n = 0; n < 4 * w * h; n++) {
      const l = kov.get(a); if (!l || !l.length) break;
      const b = l.pop()!;
      pts.push([a % (w + 1), Math.floor(a / (w + 1))]);
      a = b; if (a === start) break;
    }
    if (pts.length >= 4) hurkok.push(pts);
  }
  const min = 4 / (r.px * r.px);
  const kulsok = hurkok.filter((p) => terulet(p) > min); // a cella bal oldali bejárásánál a külső határ pozitív előjelű
  return kulsok.map((p) => egyszerusit(p, 0.12 / r.px).map(([gx, gy]) => [Math.round(lapX(r, gx) * 10) / 10, Math.round(lapY(r, gy) * 10) / 10] as [number, number]))
    .filter((p) => p.length >= 3);
}

/** Él kifelé mutató normálisa lapirányban (0 = fel, 90 = jobbra), egész fokra kerekítve. */
export function elIrany(p: Poligon, i: number): number {
  const a = p[i]!, b = p[(i + 1) % p.length]!;
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  let nx = dy / l, ny = -dx / l;
  if (bennE(p, mx + nx * 2, my + ny * 2)) { nx = -nx; ny = -ny; }
  let ir = ((Math.round((Math.atan2(nx, -ny) * 180) / Math.PI) % 360) + 360) % 360;
  // a tengelyhez közeli (±4°) él a tengely irányába (a körvonal-egyszerűsítés apró ferdeségei)
  const t = Math.round(ir / 90) * 90; if (Math.abs(ir - t) <= 4) ir = t % 360;
  return ir;
}

export interface BurokEl {
  /** A körvonal élének sorszáma és lapiránya (kifelé). */
  i: number; irany: number;
  /** A fal belső síkja mentén mért (nettó) hossz, m – a szomszédos élek belső síkjainak metszéspontjai között. */
  hossz: number;
  /** A rajzolt él hossza (m). */
  rajzolt: number;
  /** A mért falvastagság (m, a belső és a külső sík között), ha a falsáv megtalálható. */
  vastag: number | null;
  /** Az él mintapontjainak hányadában találtunk falsávot (0…1); kevés → a falhossz bizonytalan. */
  lefedett: number;
  /** A belső sík szakasza (pt) – megjelenítéshez. */
  belso: [[number, number], [number, number]];
}

/**
 * A körvonal (felismert vagy kézzel rajzolt hőburok) csak irány: élenként a valódi falsávot keressük meg a raszterben
 * (az éltől befelé 1,5 m-ig, kifelé 1 m-ig, 25 cm-enként merőlegesen), és a fal belső síkján mérünk. A belső síkok
 * az élek eltolt egyenesei (a mintapontok mediánja), a sarkok ezek metszéspontjai – így a falvastagság nem kerül a
 * hosszba, és a pontatlanul lerakott sarokpont sem torzít. Nyílás (ablak, ajtó) is falsávnak számít.
 */
export function burokMeres(r: Raszter, pol: Poligon[]): BurokEl[][] {
  const gat = (x: number, y: number) => { const cx = Math.floor(((x - r.x0) * r.mPerPt) / r.px), cy = Math.floor(((y - r.y0) * r.mPerPt) / r.px); if (cx < 0 || cy < 0 || cx >= r.w || cy >= r.h) return false; const k = cy * r.w + cx; return !!(r.fal[k] || r.nyilas[k]); };
  return pol.map((p) => {
    const n = p.length;
    const elek = p.map((a, i) => {
      const b = p[(i + 1) % n]!;
      const lm = Math.hypot(b[0] - a[0], b[1] - a[1]) * r.mPerPt;
      const ir = elIrany(p, i);
      // befelé mutató egységvektor (az él normálisa, pt-irányban)
      const dx = (b[0] - a[0]) / (lm / r.mPerPt || 1), dy = (b[1] - a[1]) / (lm / r.mPerPt || 1);
      let nx = -dy, ny = dx; const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      if (!bennE(p, mx + nx * 2, my + ny * 2)) { nx = -nx; ny = -ny; }
      const be: number[] = [], ki: number[] = []; let db = 0;
      const lepes = Math.max(2, Math.round(lm / 0.25));
      for (let s = 1; s < lepes; s++) {
        const t = s / lepes, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
        db++;
        // a falsáv: az élhez legközelebbi összefüggő gát-szakasz a −1 … +1,5 m tartományban (+ befelé)
        const lp = 0.02; let legD = Infinity, kezd: number | null = null, sav: [number, number] | null = null;
        for (let d = -1.0; d <= 1.5 + 1e-9; d += lp) {
          const g = gat(x + (nx * d) / r.mPerPt, y + (ny * d) / r.mPerPt);
          if (g && kezd === null) kezd = d;
          if ((!g || d + lp > 1.5) && kezd !== null) {
            const veg = g ? d : d - lp;
            if (veg - kezd >= 0.06) { const tav = d < 0 ? Math.abs(veg) : kezd > 0 ? kezd : 0; if (tav < legD) { legD = tav; sav = [kezd, veg]; } }
            kezd = null;
          }
        }
        if (sav && sav[1] - sav[0] <= 1.0) { ki.push(sav[0]); be.push(sav[1]); }
      }
      const med = (v: number[]) => { const q = [...v].sort((u, w) => u - w); return q.length ? q[q.length >> 1]! : null; };
      return { i, ir, lm, a, b, nx, ny, dIn: med(be), dKi: med(ki), lefedett: db ? be.length / db : 0 };
    });
    // a nem talált élek belső síkja: a körvonal mediánvastagságával a rajzolt éltől befelé
    const vast = elek.flatMap((e) => (e.dIn !== null && e.dKi !== null && e.lefedett >= 0.3 ? [e.dIn - e.dKi] : [])).sort((u, w) => u - w);
    const vMed = vast.length ? vast[vast.length >> 1]! : 0.4;
    const eltol = (e: (typeof elek)[number]) => (e.lefedett >= 0.3 && e.dIn !== null ? e.dIn : vMed);
    // a belső egyenesek metszéspontjai (párhuzamos szomszéd: a közös csúcs eltolva)
    const vonal = (e: (typeof elek)[number]) => { const d = eltol(e) / r.mPerPt; return { px: e.a[0] + e.nx * d, py: e.a[1] + e.ny * d, vx: e.b[0] - e.a[0], vy: e.b[1] - e.a[1] }; };
    const metsz = (e1: (typeof elek)[number], e2: (typeof elek)[number], csucs: [number, number]): [number, number] => {
      const A = vonal(e1), B = vonal(e2); const det = A.vx * B.vy - A.vy * B.vx;
      if (Math.abs(det) < 1e-6 * Math.hypot(A.vx, A.vy) * Math.hypot(B.vx, B.vy)) { const d = eltol(e2) / r.mPerPt; return [csucs[0] + e2.nx * d, csucs[1] + e2.ny * d]; }
      const t = ((B.px - A.px) * B.vy - (B.py - A.py) * B.vx) / det; return [A.px + A.vx * t, A.py + A.vy * t];
    };
    return elek.map((e, k) => {
      const elozo = elek[(k - 1 + n) % n]!, kov = elek[(k + 1) % n]!;
      const p0 = metsz(elozo, e, e.a), p1 = metsz(e, kov, e.b);
      // a belső sík hossza (az él irányára vetítve, hogy a rossz metszés ne fordítsa meg)
      const h = ((p1[0] - p0[0]) * (e.b[0] - e.a[0]) + (p1[1] - p0[1]) * (e.b[1] - e.a[1])) / (Math.hypot(e.b[0] - e.a[0], e.b[1] - e.a[1]) || 1) * r.mPerPt;
      return { i: e.i, irany: e.ir, hossz: Math.max(0, Math.round(h * 100) / 100), rajzolt: Math.round(e.lm * 100) / 100, vastag: e.lefedett >= 0.3 && e.dIn !== null && e.dKi !== null ? Math.round((e.dIn - e.dKi) * 100) / 100 : null, lefedett: Math.round(e.lefedett * 100) / 100, belso: [p0, p1] as [[number, number], [number, number]] };
    });
  });
}

/**
 * Homlokzati falak a körvonal éleiből, a mögöttük lévő fűtött helyiséghez rendelve (raszterindex → [{irany, hossz}]).
 * Az él mentén 0,25 m-enként befelé (legfeljebb 1,5 m-ig) keressük a helyiséget.
 */
export function burokFalak(r: Raszter, pol: Poligon[], futott: ReadonlySet<number>, pecsetek?: ReadonlyMap<number, { x: number; y: number }>): Map<number, { irany: number; hossz: number }[]> {
  const ki = new Map<number, { irany: number; hossz: number }[]>();
  const cella = (x: number, y: number) => { const cx = Math.floor(((x - r.x0) * r.mPerPt) / r.px), cy = Math.floor(((y - r.y0) * r.mPerPt) / r.px); return cx < 0 || cy < 0 || cx >= r.w || cy >= r.h ? -1 : r.cimke[cy * r.w + cx]! - 2; };
  const meres = burokMeres(r, pol);
  meres.forEach((elek, pi) => { const p = pol[pi]!; for (const el of elek) {
    const lm = el.hossz; if (lm < 0.05) continue;
    // rövid (< 0,6 m), nem fő irányú él (a körvonal lépcsőzése): a leghosszabb szomszédos él irányába
    const foIr = (e: BurokEl) => e.irany % 45 === 0;
    const szomsz = [elek[(el.i - 1 + elek.length) % elek.length]!, elek[(el.i + 1) % elek.length]!].filter(foIr).sort((u, v) => v.hossz - u.hossz)[0];
    const ir = !foIr(el) && el.hossz < 0.6 && szomsz ? szomsz.irany : el.irany, rad = (el.irany * Math.PI) / 180, bx = -Math.sin(rad), by = Math.cos(rad); // befelé (pt-irány)
    const [a, b] = el.belso;
    const lepes = Math.max(1, Math.round(lm / 0.25)), dl = lm / lepes;
    const hozza = new Map<number, number>(); let maradek = 0;
    for (let s = 0; s < lepes; s++) {
      const t = (s + 0.5) / lepes, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
      // a belső síkba befutó belső fal (csatlakozás): a fal vastagságnyi rész nem homlokzati falfelület
      let fal = true;
      for (let d = 0.05; d <= 0.3 && fal; d += 0.05) { const kx = Math.floor(((x + (bx * d) / r.mPerPt - r.x0) * r.mPerPt) / r.px), ky = Math.floor(((y + (by * d) / r.mPerPt - r.y0) * r.mPerPt) / r.px); if (kx < 0 || ky < 0 || kx >= r.w || ky >= r.h || !r.fal[ky * r.w + kx]) fal = false; }
      if (fal) continue;
      let talalt = -1;
      for (let d = 0.05; d <= 1.5; d += 0.1) { const c = cella(x + (bx * d) / r.mPerPt, y + (by * d) / r.mPerPt); if (c >= 0 && futott.has(c)) { talalt = c; break; } }
      if (talalt >= 0) hozza.set(talalt, (hozza.get(talalt) ?? 0) + dl); else maradek += dl;
    }
    // a raszterben nem lezárt helyiség (pl. üvegfalas nappali): az él felezőpontjához legközelebbi, a burkon belüli fűtött pecsét
    if (!hozza.size && pecsetek) {
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      const jel = [...pecsetek.entries()].filter(([ri, q]) => futott.has(ri) && pol.some((pp) => bennE(pp, q.x, q.y)))
        .sort((u, v) => Math.hypot(u[1].x - mx, u[1].y - my) - Math.hypot(v[1].x - mx, v[1].y - my))[0];
      if (jel) hozza.set(jel[0], 0);
    }
    void p;
    if (!hozza.size) continue;
    // a hozzá nem rendelt rész (pl. falvég, nyílás előtti sáv) a legnagyobb részesedésű helyiséghez
    const fo = [...hozza.entries()].sort((x, y) => y[1] - x[1])[0]![0];
    hozza.set(fo, hozza.get(fo)! + maradek);
    for (const [ri, hossz] of hozza) { const l = ki.get(ri) ?? []; const e = l.find((f) => f.irany === ir); if (e) e.hossz += hossz; else l.push({ irany: ir, hossz }); ki.set(ri, l); }
  } });
  for (const l of ki.values()) for (const f of l) f.hossz = Math.round(f.hossz * 100) / 100;
  return ki;
}

/** A nyílás (felirat helye, pt) legközelebbi körvonal-éle, ha legfeljebb `maxM` méterre van: az él iránya. */
export function nyilasEl(r: Raszter, pol: Poligon[], x: number, y: number, maxM = 1.3): number | null {
  let leg = Infinity, ir: number | null = null;
  for (const p of pol) for (let i = 0; i < p.length; i++) {
    const a = p[i]!, b = p[(i + 1) % p.length]!;
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1e-9;
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2));
    const d = Math.hypot(a[0] + dx * t - x, a[1] + dy * t - y) * r.mPerPt;
    if (d < leg) { leg = d; ir = elIrany(p, i); }
  }
  return leg <= maxM ? ir : null;
}
