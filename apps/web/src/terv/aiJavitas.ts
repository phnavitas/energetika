/**
 * AI-JAVÍTÁS (2026-11-22, Balázs: „A kiírt dolgokat nem tudod automatikusan javítani a rajzon?” – „Mind a három”).
 *
 * Az AI-ellenőrzés csak megmondja, MI a hiba és nagyjából HOL (a kivágat képpontjaiban, ±0,5 m); a javítást a program
 * végzi, a rajz saját geometriájához igazítva:
 *  - besorolás: a megnevezett helyiség fűtött / fűtetlen / külső tér szerepe;
 *  - hőburok: a jelölt helyen futó burokél a legközelebbi fal külső síkjára igazítva (a raszter falai szerint; csak a
 *    jelölt szakasz mozdul, ha az él hosszabb);
 *  - hiányzó fal: a jelölt helyen a PDF két párhuzamos (8–70 cm-re futó) vonala közti sáv kézi falként (Kijeloles.falPlusz).
 * Mindegyik a felhasználó „Alkalmaz” gombjára, visszavonhatóan.
 */
import { bennE, type Poligon } from '@terv/burok';
import type { Raszter } from '@terv/raszter';
import type { Lap } from '@terv/kinyeres';

export type AiSzerep = 'futott' | 'futetlen' | 'kulter';
export type AiJavitas =
  | { tipus: 'besorolas'; hi: number; szerep: AiSzerep; szoveg: string }
  | { tipus: 'burok'; burok: Poligon[]; szoveg: string }
  | { tipus: 'fal'; sav: Poligon; szoveg: string };

const normal = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

/** A helyiség indexe a név szerint (pontos, majd tartalmazó egyezés; több találatnál nincs). */
export function helyisegKeres(nev: string | undefined, nevek: string[]): number {
  if (!nev) return -1;
  const n = normal(nev); if (!n) return -1;
  const pontos = nevek.map((x, i) => (normal(x) === n ? i : -1)).filter((i) => i >= 0);
  if (pontos.length === 1) return pontos[0]!;
  const resz = nevek.map((x, i) => (normal(x).includes(n) || n.includes(normal(x)) ? i : -1)).filter((i) => i >= 0 && normal(nevek[i]!).length >= 3);
  return resz.length === 1 ? resz[0]! : -1;
}

/**
 * A falvonal legkisebb vastagsága a lapon (pt): a hosszú (≥ 2 m), tengelyirányú vonalak vastagságának 90. percentilise
 * fele, legalább 0,2 pt – a vékonyabb (méretvonal, raszterháló, burkolatvonal) nem falsík.
 */
const falVastagGy = new WeakMap<Lap, number>();
function falVonalMin(lap: Lap, mPerPt: number): number {
  const c = falVastagGy.get(lap); if (c !== undefined) return c;
  const hv: [number, number][] = [];
  for (const u of lap.utvonalak) { if (u.muvelet !== 'stroke' && u.muvelet !== 'fillStroke') continue; if (!(u.vastagsag > 0)) continue;
    for (const p of u.pontok) for (let i = 0; i + 3 < p.length; i += 2) { const dx = p[i + 2]! - p[i]!, dy = p[i + 3]! - p[i + 1]!; const l = Math.hypot(dx, dy) * mPerPt;
      if (l >= 2 && (Math.abs(dx) < 0.02 * Math.abs(dy) || Math.abs(dy) < 0.02 * Math.abs(dx))) hv.push([u.vastagsag, l]); } }
  let v = 0.2;
  if (hv.length) { hv.sort((a, b) => a[0] - b[0]); const ossz = hv.reduce((t, q) => t + q[1], 0); let t = 0; for (const [w, l] of hv) { t += l; if (t >= 0.9 * ossz) { v = Math.max(0.2, 0.5 * w); break; } } }
  falVastagGy.set(lap, v); return v;
}

const falE = (r: Raszter, x: number, y: number) => {
  const cx = Math.floor(((x - r.x0) * r.mPerPt) / r.px), cy = Math.floor(((y - r.y0) * r.mPerPt) / r.px);
  return cx >= 0 && cy >= 0 && cx < r.w && cy < r.h && !!r.fal[cy * r.w + cx];
};

/**
 * A hőburok jelölt helyen (doboz, pt) futó élének igazítása a legközelebbi fal külső síkjára. irany: 'be' – a burok
 * kifolyik (a fal belül van), 'ki' – kimarad (a fal kívül van), null – bármelyik. Ha nincs megfelelő él vagy fal: null.
 */
export function burokIgazit(r: Raszter, burok: Poligon[], doboz: [number, number, number, number], irany: 'be' | 'ki' | null, lap?: Lap): Poligon[] | null {
  const m = 1 / r.mPerPt; // 1 m pt-ban
  const [bx0, by0, bx1, by1] = [Math.min(doboz[0], doboz[2]) - 0.3 * m, Math.min(doboz[1], doboz[3]) - 0.3 * m, Math.max(doboz[0], doboz[2]) + 0.3 * m, Math.max(doboz[1], doboz[3]) + 0.3 * m];
  // a dobozzal leginkább átfedő tengelyirányú él
  let leg: { pi: number; i: number; t0: number; t1: number; atfed: number } | null = null;
  burok.forEach((p, pi) => p.forEach((a, i) => {
    const b = p[(i + 1) % p.length]!; const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
    if (L < 0.3 * m || (Math.abs(dx) > 0.02 * L && Math.abs(dy) > 0.02 * L)) return;
    const vizsz = Math.abs(dy) <= 0.02 * L;
    const allando = vizsz ? a[1] : a[0]; if (allando < (vizsz ? by0 : bx0) || allando > (vizsz ? by1 : bx1)) return;
    const [u0, u1] = vizsz ? [bx0, bx1] : [by0, by1]; const [ea, eb] = vizsz ? [a[0], b[0]] : [a[1], b[1]];
    const lo = Math.max(Math.min(ea, eb), u0), hi = Math.min(Math.max(ea, eb), u1); if (hi - lo < 0.3 * m) return;
    const t0 = (lo - ea) / (eb - ea), t1 = (hi - ea) / (eb - ea);
    const atfed = hi - lo; if (!leg || atfed > leg.atfed) leg = { pi, i, t0: Math.min(t0, t1), t1: Math.max(t0, t1), atfed };
  }));
  if (!leg) return null;
  const { pi, i, t0, t1 } = leg as { pi: number; i: number; t0: number; t1: number };
  const p = burok[pi]!, a = p[i]!, b = p[(i + 1) % p.length]!;
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]); let nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L;
  const kx = (a[0] + b[0]) / 2, ky = (a[1] + b[1]) / 2;
  if (!bennE(p, kx + nx * 0.05 * m, ky + ny * 0.05 * m)) { nx = -nx; ny = -ny; } // befelé
  // a fal sávjai a merőleges eltolás (m, + = befelé) mentén: a szakasz mintapontjainak legalább 60 %-a falon
  const minta = 24, lep = Math.max(0.02, r.px), sav: [number, number][] = []; let kezd: number | null = null;
  for (let d = -2.5; d <= 2.5 + 1e-9; d += lep) {
    let db = 0;
    for (let s = 0; s < minta; s++) { const t = t0 + ((t1 - t0) * (s + 0.5)) / minta; const x = a[0] + (b[0] - a[0]) * t + nx * d * m, y = a[1] + (b[1] - a[1]) * t + ny * d * m; if (falE(r, x, y)) db++; }
    const fal = db >= 0.6 * minta;
    if (fal && kezd === null) kezd = d;
    if (!fal && kezd !== null) { sav.push([kezd, d - lep]); kezd = null; }
  }
  if (kezd !== null) sav.push([kezd, 2.5]);
  // a fal külső síkja (a sáv kifelé eső széle); a dobozon belül (± 0,5 m), a kért irányban, a legközelebbi
  const dm = (q: [number, number]) => ((q[0] - kx) * nx + (q[1] - ky) * ny) / m;
  const dTart = [dm([bx0, by0]), dm([bx1, by0]), dm([bx0, by1]), dm([bx1, by1])];
  const dMin = Math.min(...dTart) - 0.5, dMax = Math.max(...dTart) + 0.5;
  const jelolt = sav.map(([d0, d1]) => ({ d: d0, vast: d1 - d0 })).filter(({ d, vast }) => vast >= 0.06 && Math.abs(d) >= 0.08 && d >= dMin && d <= dMax &&
    (irany === 'be' ? d > 0 : irany === 'ki' ? d < 0 : true)).sort((u, v) => Math.abs(u.d) - Math.abs(v.d));
  // (a raszterben nincs fal – pl. a falat a felismerés nem látta –: a PDF két párhuzamos, 8–70 cm-re futó vonala,
  // amely a jelölt szakasz legalább felén végigfut; a külső síkja a kifelé eső vonal)
  if (!jelolt.length && lap) {
    const vizsz = Math.abs(ny) > 0.5; const seg0 = Math.min(vizsz ? a[0] + (b[0] - a[0]) * t0 : a[1] + (b[1] - a[1]) * t0, vizsz ? a[0] + (b[0] - a[0]) * t1 : a[1] + (b[1] - a[1]) * t1);
    const seg1 = Math.max(vizsz ? a[0] + (b[0] - a[0]) * t0 : a[1] + (b[1] - a[1]) * t0, vizsz ? a[0] + (b[0] - a[0]) * t1 : a[1] + (b[1] - a[1]) * t1);
    const vonalak: { d: number; lo: number; hi: number }[] = [];
    const vMin = falVonalMin(lap, r.mPerPt);
    for (const u of lap.utvonalak) {
      if (u.muvelet === 'none' || u.muvelet === 'fill' || u.vastagsag < vMin || u.bbox[2] < bx0 || u.bbox[0] > bx1 || u.bbox[3] < by0 || u.bbox[1] > by1) continue;
      for (const pp of u.pontok) for (let k = 0; k + 3 < pp.length; k += 2) {
        const x0 = pp[k]!, y0 = pp[k + 1]!, x1 = pp[k + 2]!, y1 = pp[k + 3]!; const LL = Math.hypot(x1 - x0, y1 - y0); if (LL < 0.3 * m) continue;
        if (vizsz ? Math.abs(y1 - y0) > 0.02 * LL : Math.abs(x1 - x0) > 0.02 * LL) continue;
        const lo = Math.max(Math.min(vizsz ? x0 : y0, vizsz ? x1 : y1), seg0), hi = Math.min(Math.max(vizsz ? x0 : y0, vizsz ? x1 : y1), seg1); if (hi <= lo) continue;
        vonalak.push({ d: dm([(x0 + x1) / 2, (y0 + y1) / 2]) - dm([kx, ky]) + 0, lo, hi });
      }
    }
    const fel = (seg1 - seg0) * 0.5, parok: number[] = [];
    for (const u of vonalak) for (const v of vonalak) {
      const vast = v.d - u.d; if (vast < 0.08 || vast > 0.7) continue; // u a külső (kisebb d), v a belső vonal
      if (Math.min(u.hi, v.hi) - Math.max(u.lo, v.lo) < fel) continue;
      if (Math.abs(u.d) >= 0.08 && u.d >= dMin && u.d <= dMax && (irany === 'be' ? u.d > 0 : irany === 'ki' ? u.d < 0 : true)) parok.push(u.d);
    }
    parok.sort((p1, p2) => Math.abs(p1) - Math.abs(p2));
    if (parok.length) jelolt.push({ d: parok[0]!, vast: 0 });
  }
  const cel = jelolt[0]; if (!cel) return null;
  const ex = nx * cel.d * m, ey = ny * cel.d * m;
  const uj = burok.map((q) => q.map((v) => [v[0], v[1]] as [number, number]));
  const q = uj[pi]!;
  if (t0 <= 0.1 && t1 >= 0.9) {
    // az egész él mozdul (a két szomszédos él követi)
    q[i] = [a[0] + ex, a[1] + ey]; q[(i + 1) % q.length] = [b[0] + ex, b[1] + ey];
  } else {
    // csak a jelölt szakasz: két lépcsővel
    const P = (t: number): [number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const s0 = Math.max(0, t0), s1 = Math.min(1, t1);
    const be: [number, number][] = [];
    if (s0 > 0.02) be.push(P(s0)); be.push([P(s0)[0] + ex, P(s0)[1] + ey], [P(s1)[0] + ex, P(s1)[1] + ey]); if (s1 < 0.98) be.push(P(s1));
    if (s0 <= 0.02) q[i] = [a[0] + ex, a[1] + ey];
    if (s1 >= 0.98) q[(i + 1) % q.length] = [b[0] + ex, b[1] + ey];
    q.splice(i + 1, 0, ...be.filter((_, k) => !((s0 <= 0.02 && k === 0) || (s1 >= 0.98 && k === be.length - 1))));
  }
  const kerek = uj.map((pp) => pp.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10] as [number, number])
    .filter((v, k, arr) => k === 0 || Math.hypot(v[0] - arr[k - 1]![0], v[1] - arr[k - 1]![1]) > 0.01));
  const regi = new Set(burok.flat().map(([x, y]) => `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`));
  return kerek.map((pp) => fogSimit(pp, m, (v) => !regi.has(`${v[0]},${v[1]}`)));
}

/**
 * Az eltolt él végén maradt „fog” levágása: két egymást követő rövid (< 0,6 m), egymásra merőleges él, amelyet két hosszú,
 * egymásra merőleges él fog közre (sarokba szorult falvastagságnyi kiugrás vagy bemélyedés) – a sarok a két hosszú él
 * egyenesének metszése lesz. Csak az igazítással keletkezett fogat (legalább egy csúcsa új) – a rajz valódi lépcsői maradnak.
 */
function fogSimit(p: [number, number][], m: number, uj: (v: [number, number]) => boolean): [number, number][] {
  const rovid = 0.6 * m, hosszu = 0.6 * m;
  const hossz = (a: [number, number], b: [number, number]) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  const fugg = (a: [number, number], b: [number, number]) => Math.abs(b[0] - a[0]) < 1e-6 * m + 0.02 * hossz(a, b);
  for (let kor = 0; kor < 4 && p.length > 4; kor++) {
    let volt = false;
    for (let j = 0; j < p.length && p.length > 4; j++) {
      const n = p.length, A = p[(j - 1 + n) % n]!, B = p[j]!, C = p[(j + 1) % n]!, D = p[(j + 2) % n]!, E = p[(j + 3) % n]!;
      if (hossz(B, C) >= rovid || hossz(C, D) >= rovid || hossz(A, B) < hosszu || hossz(D, E) < hosszu) continue;
      if (!uj(B) && !uj(C) && !uj(D)) continue;
      const ab = fugg(A, B), de = fugg(D, E); if (ab === de) continue; // a két hosszú él merőleges
      const X: [number, number] = ab ? [B[0], D[1]] : [D[0], B[1]];
      // B, C, D helyett X (a körbejárás sorrendjében)
      const k = [j, (j + 1) % n, (j + 2) % n].sort((u, v) => v - u);
      const hely = j - k.filter((t) => t < j).length;
      for (const t of k) p.splice(t, 1);
      p.splice(hely, 0, X);
      volt = true; break;
    }
    if (!volt) break;
  }
  return p;
}

/**
 * Hiányzó fal a jelölt helyen (doboz, pt): a PDF két párhuzamos, tengelyirányú, 8–70 cm-re futó, falvonal-vastagságú
 * (nem méretvonal) vonala (≥ 0,5 m közös szakasszal) közti sáv – ha ott a raszter még nem fal. Nincs ilyen pár: null.
 */
export function falKeres(lap: Lap, r: Raszter, doboz: [number, number, number, number]): Poligon | null {
  const m = 1 / r.mPerPt;
  const [bx0, by0, bx1, by1] = [Math.min(doboz[0], doboz[2]) - 0.3 * m, Math.min(doboz[1], doboz[3]) - 0.3 * m, Math.max(doboz[0], doboz[2]) + 0.3 * m, Math.max(doboz[1], doboz[3]) + 0.3 * m];
  const vonal: { vizsz: boolean; c: number; lo: number; hi: number }[] = [];
  const vMin = falVonalMin(lap, r.mPerPt);
  for (const u of lap.utvonalak) {
    if (u.muvelet === 'none' || u.muvelet === 'fill' || u.vastagsag < vMin || u.bbox[2] < bx0 || u.bbox[0] > bx1 || u.bbox[3] < by0 || u.bbox[1] > by1) continue;
    for (const p of u.pontok) for (let k = 0; k + 3 < p.length; k += 2) {
      const x0 = p[k]!, y0 = p[k + 1]!, x1 = p[k + 2]!, y1 = p[k + 3]!; const L = Math.hypot(x1 - x0, y1 - y0); if (L < 0.5 * m) continue;
      const vizsz = Math.abs(y1 - y0) <= 0.02 * L, fugg = Math.abs(x1 - x0) <= 0.02 * L; if (!vizsz && !fugg) continue;
      const c = vizsz ? (y0 + y1) / 2 : (x0 + x1) / 2, lo = Math.max(Math.min(vizsz ? x0 : y0, vizsz ? x1 : y1), vizsz ? bx0 : by0), hi = Math.min(Math.max(vizsz ? x0 : y0, vizsz ? x1 : y1), vizsz ? bx1 : by1);
      if (c < (vizsz ? by0 : bx0) || c > (vizsz ? by1 : bx1) || hi - lo < 0.5 * m) continue;
      vonal.push({ vizsz, c, lo, hi });
    }
  }
  let leg: { sav: Poligon; hossz: number } | null = null;
  for (let i = 0; i < vonal.length; i++) for (let j = i + 1; j < vonal.length; j++) {
    const u = vonal[i]!, v = vonal[j]!; if (u.vizsz !== v.vizsz) continue;
    const d = Math.abs(u.c - v.c) / m; if (d < 0.08 || d > 0.7) continue;
    const lo = Math.max(u.lo, v.lo), hi = Math.min(u.hi, v.hi); if (hi - lo < 0.5 * m) continue;
    const c0 = Math.min(u.c, v.c), c1 = Math.max(u.c, v.c);
    // (a sáv közepén ne legyen már fal – akkor nem hiányzik)
    let falDb = 0; const n = 12;
    for (let s = 0; s < n; s++) { const t = lo + ((hi - lo) * (s + 0.5)) / n, cm = (c0 + c1) / 2; if (u.vizsz ? falE(r, t, cm) : falE(r, cm, t)) falDb++; }
    if (falDb >= 0.7 * n) continue;
    const sav: Poligon = u.vizsz ? [[lo, c0], [hi, c0], [hi, c1], [lo, c1]] : [[c0, lo], [c1, lo], [c1, hi], [c0, hi]];
    if (!leg || hi - lo > leg.hossz) leg = { sav, hossz: hi - lo };
  }
  return leg ? (leg as { sav: Poligon }).sav : null;
}

/** A kézi falsávok (pt) a raszterben: másolat, a sávok cellái falak. */
export function raszterFalPlusz(r: Raszter, savok: Poligon[]): Raszter {
  const fal = new Uint8Array(r.fal);
  for (const p of savok) {
    const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]);
    const cx0 = Math.max(0, Math.floor(((Math.min(...xs) - r.x0) * r.mPerPt) / r.px)), cx1 = Math.min(r.w - 1, Math.ceil(((Math.max(...xs) - r.x0) * r.mPerPt) / r.px));
    const cy0 = Math.max(0, Math.floor(((Math.min(...ys) - r.y0) * r.mPerPt) / r.px)), cy1 = Math.min(r.h - 1, Math.ceil(((Math.max(...ys) - r.y0) * r.mPerPt) / r.px));
    for (let y = cy0; y <= cy1; y++) for (let x = cx0; x <= cx1; x++) {
      const px = r.x0 + ((x + 0.5) * r.px) / r.mPerPt, py = r.y0 + ((y + 0.5) * r.px) / r.mPerPt;
      if (bennE(p, px, py)) fal[y * r.w + x] = 1;
    }
  }
  return { ...r, fal };
}
