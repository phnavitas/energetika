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

/**
 * Ferde fal lépcsőzetes rajzolata → egy ferde él. A rácsból kapott körvonalon a ferde falat (ablakfülkék, sarkok
 * miatt) rövid, egy irányba lépő „ugrások” tördelik; ahol legalább két ilyen ugrás (mind ugyanarra az oldalra,
 * egyenként < `ugras`, a köztük lévő menti élek ≤ `maxMenti`) egy legalább `minHossz` hosszú, tengelytől ≥ 3°-kal eltérő
 * egyenes mentén `tures`-en belül marad, a szakaszt egy ferde éllel helyettesítjük. Az ide-oda ugró (fülke, kiugrás),
 * ill. hosszú szakaszokkal lépcsőző (sorházas homlokzat) tengelyirányú fal marad.
 */
function ferdeOsszevon(p: Poligon, tures: number, ugras: number, minHossz: number, maxMenti: number): Poligon {
  const n = p.length; if (n < 6) return p;
  const tav = (q: [number, number], a: [number, number], b: [number, number]) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1e-9; return ((q[0] - a[0]) * dy - (q[1] - a[1]) * dx) / l; };
  const jo = (i: number, j: number) => {
    const a = p[i]!, b = p[j % n]!; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < minHossz) return false;
    const szog = Math.abs(Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI) % 90; if (szog < 3 || szog > 87) return false;
    let elojel = 0, ugrasDb = 0;
    for (let k = i + 1; k < j; k++) if (Math.abs(tav(p[k % n]!, a, b)) > tures) return false;
    for (let k = i; k < j; k++) {
      const u = p[k % n]!, v = p[(k + 1) % n]!; const l = Math.hypot(v[0] - u[0], v[1] - u[1]);
      // az él iránya a ferde egyeneshez képest: menti (hosszú) vagy keresztirányú ugrás (rövid)
      const ex = (b[0] - a[0]) / L, ey = (b[1] - a[1]) / L; const menti = ((v[0] - u[0]) * ex + (v[1] - u[1]) * ey) / (l || 1);
      if (menti > 0.9) {
        if (l > maxMenti) {
          // hosszabb menti él csak akkor, ha maga is a ferde fal irányába dől (≥ 0,8°, azonos értelemben) – a pontosan
          // tengelyirányú, lépcsőzetes homlokzat (sorház) nem ferde fal
          const tenge = Math.abs(v[0] - u[0]) >= Math.abs(v[1] - u[1]); const elter = tenge ? (v[1] - u[1]) / (v[0] - u[0]) : (v[0] - u[0]) / (v[1] - u[1]);
          const lanc = tenge ? (b[1] - a[1]) / (b[0] - a[0]) : (b[0] - a[0]) / (b[1] - a[1]);
          if (l > 2 * maxMenti || Math.abs(Math.atan(elter)) < 0.8 * Math.PI / 180 || Math.sign(elter) !== Math.sign(lanc)) return false;
        }
        continue;
      }
      if (menti < -0.2 || l > ugras) return false;
      const sz = Math.sign((v[0] - u[0]) * -ey + (v[1] - u[1]) * ex); if (!sz) continue;
      if (elojel && sz !== elojel) return false; elojel = sz; ugrasDb++;
    }
    return ugrasDb >= 2;
  };
  const ki: Poligon = []; let i = 0;
  while (i < n) {
    let leg = -1;
    for (let j = i + 3; j <= n; j++) if (jo(i, j)) leg = j;
    ki.push(p[i]!);
    i = leg > 0 ? leg : i + 1;
  }
  return ki.length >= 3 ? ki : p;
}

/**
 * Derékszögűsítés: a tengelyhez közeli (≤ 12°) élek pontosan tengelyirányúak (az él két végpontjának átlagos
 * koordinátáján), a két tengelyirányú él közötti rövid (< `letores`) ferde „letörés” (a rácsból adódó sarokcsapás)
 * elhagyva – a csúcsok a szomszédos élegyenesek metszéspontjai. A hosszú ferde él (valódi ferde fal) marad.
 */
function derekszog(p: Poligon, letores: number, tures: number): Poligon {
  type El = { a: [number, number]; b: [number, number]; t: 'v' | 'f' | 'x'; c: number };
  const tipus = (a: [number, number], b: [number, number]): El => {
    const dx = b[0] - a[0], dy = b[1] - a[1]; const sz = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI) % 180;
    // tengelyirányú, ha a végpontjai a tengelytől legfeljebb `tures`-nyire térnek el (rövid élnél ez akár 12°,
    // hosszú élnél csak kis szög – a valódi, enyhén ferde fal megmarad)
    if ((sz <= 12 || sz >= 168) && Math.abs(dy) <= Math.max(tures, Math.abs(dx) * Math.tan(Math.PI / 180))) return { a, b, t: 'v', c: (a[1] + b[1]) / 2 };
    if (Math.abs(sz - 90) <= 12 && Math.abs(dx) <= Math.max(tures, Math.abs(dy) * Math.tan(Math.PI / 180))) return { a, b, t: 'f', c: (a[0] + b[0]) / 2 };
    return { a, b, t: 'x', c: 0 };
  };
  let el: El[] = p.map((a, i) => tipus(a, p[(i + 1) % p.length]!));
  // rövid ferde letörések elhagyása
  for (let kor = 0; kor < 3; kor++) {
    const n = el.length; if (n < 4) break;
    const ki: El[] = [];
    for (let i = 0; i < n; i++) {
      const e = el[i]!, el0 = el[(i - 1 + n) % n]!, el1 = el[(i + 1) % n]!;
      const L = Math.hypot(e.b[0] - e.a[0], e.b[1] - e.a[1]);
      if (e.t === 'x' && L < letores && el0.t !== 'x' && el1.t !== 'x') continue;
      ki.push(e);
    }
    if (ki.length === el.length) break; el = ki;
  }
  // azonos irányú szomszédos tengelyélek: közel egy vonalban (≤ 3 rács) összevonva
  const n = el.length; if (n < 3) return p;
  const pont = (e1: El, e2: El): [number, number] => {
    if (e1.t === 'v' && e2.t === 'f') return [e2.c, e1.c];
    if (e1.t === 'f' && e2.t === 'v') return [e1.c, e2.c];
    // általános egyenesmetszés (ferde él), ill. párhuzamos élek: a közös csúcs
    const L1 = e1.t === 'v' ? { px: 0, py: e1.c, vx: 1, vy: 0 } : e1.t === 'f' ? { px: e1.c, py: 0, vx: 0, vy: 1 } : { px: e1.a[0], py: e1.a[1], vx: e1.b[0] - e1.a[0], vy: e1.b[1] - e1.a[1] };
    const L2 = e2.t === 'v' ? { px: 0, py: e2.c, vx: 1, vy: 0 } : e2.t === 'f' ? { px: e2.c, py: 0, vx: 0, vy: 1 } : { px: e2.a[0], py: e2.a[1], vx: e2.b[0] - e2.a[0], vy: e2.b[1] - e2.a[1] };
    const det = L1.vx * L2.vy - L1.vy * L2.vx;
    if (Math.abs(det) < 1e-6 * Math.hypot(L1.vx, L1.vy) * Math.hypot(L2.vx, L2.vy)) return e2.a;
    const t = ((L2.px - L1.px) * L2.vy - (L2.py - L1.py) * L2.vx) / det; return [L1.px + L1.vx * t, L1.py + L1.vy * t];
  };
  const ki: Poligon = [];
  for (let i = 0; i < n; i++) {
    const e0 = el[(i - 1 + n) % n]!, e1 = el[i]!;
    if (e0.t !== 'x' && e0.t === e1.t) {
      // párhuzamos tengelyélek: lépcső (ugrás) a két él között
      if (Math.abs(e0.c - e1.c) < 1e-9) continue;
      ki.push(e0.t === 'v' ? [e1.a[0], e0.c] : [e0.c, e1.a[1]]);
      ki.push(e0.t === 'v' ? [e1.a[0], e1.c] : [e1.c, e1.a[1]]);
      continue;
    }
    ki.push(pont(e0, e1));
  }
  // ellenőrzés: a terület legfeljebb 5 %-kal változhat, különben az eredeti
  return ki.length >= 3 && Math.abs(terulet(ki) - terulet(p)) <= 0.05 * Math.abs(terulet(p)) ? ki : p;
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
/**
 * Fűtött zsebek: a helyiségként fel nem ismert, zárt terek (pl. tetőtérben a fürdő és a vastag külső fal közötti,
 * az 1,90 m-es belmagasság-vonallal levágott sáv), amelyeket csak vékony (≤ 0,2 m) vonal / válaszfal választ el fűtött
 * helyiségtől, a külső tértől és más (nem fűtött) helyiségtől viszont vastag fal. Legfeljebb 20 m², és nincs benne
 * megnevező felirat (`tilto`: a lap szöveges feliratainak helye).
 */
function futottZsebek(r: Raszter, futott: ReadonlySet<number>, tilto: { x: number; y: number }[]): number[] {
  const { w, h } = r; const N = w * h;
  // megnevezett tér (pl. „PADLÁS – TÁROLÓTÉR” felirat a zsebben): nem fűtött zseb
  const tiltoK = new Set(tilto.map((t) => { const x = Math.floor((t.x - r.x0) * r.mPerPt / r.px), y = Math.floor((t.y - r.y0) * r.mPerPt / r.px); return x >= 0 && y >= 0 && x < w && y < h ? y * w + x : -1; }).filter((k) => k >= 0));
  // a falak ≤ 0,2 m-es rései (dilatáció, két falréteg közti hézag) zárva: ezeken át a külső tér nem „folyik be” a zsebbe
  const R = Math.max(1, Math.round(0.1 / r.px));
  const tagit = (be: Uint8Array, ertek: number) => {
    const tmp = new Uint8Array(N), ki = new Uint8Array(N);
    for (let y = 0; y < h; y++) { let u = -1e9; for (let x = 0; x < w; x++) { if (be[y * w + x] === ertek) u = x; if (x - u <= R) tmp[y * w + x] = 1; } u = 1e9; for (let x = w - 1; x >= 0; x--) { if (be[y * w + x] === ertek) u = x; if (u - x <= R) tmp[y * w + x] = 1; } }
    for (let x = 0; x < w; x++) { let u = -1e9; for (let y = 0; y < h; y++) { if (tmp[y * w + x]) u = y; if (y - u <= R) ki[y * w + x] = 1; } u = 1e9; for (let y = h - 1; y >= 0; y--) { if (tmp[y * w + x]) u = y; if (u - y <= R) ki[y * w + x] = 1; } }
    return ki;
  };
  const fal0 = new Uint8Array(N); for (let k = 0; k < N; k++) fal0[k] = r.fal[k] || r.nyilas[k] ? 1 : 0;
  const dil = tagit(fal0, 1); const nem = new Uint8Array(N); for (let k = 0; k < N; k++) nem[k] = dil[k] ? 0 : 1;
  const er = tagit(nem, 1); const fal = new Uint8Array(N); for (let k = 0; k < N; k++) fal[k] = er[k] ? 0 : 1;
  for (let k = 0; k < N; k++) if (r.cimke[k]! >= 2) fal[k] = 0; // helyiségbe nem nő bele
  const latott = new Uint8Array(N); const ki: number[] = [];
  const lepMax = Math.max(1, Math.round(0.2 / r.px)); const maxDb = 20 / (r.px * r.px);
  const szabad = (k: number) => r.cimke[k]! < 2 && !fal[k];
  for (let i = 0; i < N; i++) {
    if (latott[i] || !szabad(i)) continue;
    const komp = [i]; latott[i] = 1; let rossz = false; let futottDb = 0; let hatar = 0; let vastagDb = 0;
    for (let t = 0; t < komp.length; t++) {
      const q = komp[t]!, x = q % w, y = (q / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) { rossz = true; continue; }
        const n = ny * w + nx;
        if (szabad(n)) { if (!latott[n]) { latott[n] = 1; komp.push(n); } continue; }
        hatar++;
        // a határon túl (vékony falon át) mi van
        let xx = nx, yy = ny, l = 0;
        while (l < lepMax && xx >= 0 && yy >= 0 && xx < w && yy < h && fal[yy * w + xx]) { xx += dx; yy += dy; l++; }
        if (xx < 0 || yy < 0 || xx >= w || yy >= h || fal[yy * w + xx]) { vastagDb++; continue; } // vastag fal
        const c = r.cimke[yy * w + xx]!;
        // vékony vonalon (szaggatott belmagasság-vonal, válaszfal) túli szabad tér: ugyanannak a zsebnek a része (a külső
        // tér is – akkor a zseb a lap széléig ér, és elvetjük)
        if (c >= 2) { if (futott.has(c - 2)) futottDb++; else rossz = true; } else { const m2 = yy * w + xx; if (!latott[m2]) { latott[m2] = 1; komp.push(m2); } }
      }
      if (komp.length > maxDb) rossz = true;
    }
    // a zseb határának legalább negyede vékony vonalon át fűtött helyiséggel közös (a két épületrész közötti, ajtóval
    // csatlakozó fűtetlen tér nem zseb)
    // … és legalább negyede vastag (külső) fal: a korláttal, vékony vonallal határolt erkély, loggia nem zseb
    if (!rossz && futottDb * r.px >= 0.5 && futottDb >= 0.25 * hatar && vastagDb >= 0.25 * hatar && !komp.some((k) => tiltoK.has(k))) ki.push(...komp);
  }
  return ki;
}

/**
 * A helyiség raszterének „kifolyt” része: ha a felismert terület jóval nagyobb a pecsétben írtnál (a válaszfal vagy egy
 * át nem hidalt nyílás résén át a szomszédos, helyiségként fel nem ismert térbe folyt), a ≤ 0,9 m-es nyakon túli
 * részek közül azok, amelyek a pecsét pontját nem tartalmazzák. A levágás csak akkor érvényes, ha a maradék a
 * pecsétterülethez közelebb van.
 */
export function kifolytCellak(r: Raszter, ri: number, Avart: number, px: number, py: number, bb?: [number, number, number, number, number]): number[] {
  const W = r.w; const c0 = ri + 2;
  // a helyiség befoglalója (rácspont) és cellaszáma – megadva, vagy egy menetben
  let [bx0, by0, bx1, by1, db] = bb ?? [Infinity, Infinity, -1, -1, 0];
  if (!bb) for (let k = 0; k < W * r.h; k++) if (r.cimke[k] === c0) { const x = k % W, y = (k / W) | 0; db++; if (x < bx0) bx0 = x; if (y < by0) by0 = y; if (x > bx1) bx1 = x; if (y > by1) by1 = y; }
  const A = db * r.px * r.px;
  if (!(Avart > 0) || !db || A < 1.4 * Avart + 1) return [];
  // részrács a befoglaló körül (a morfológia csak itt)
  const R = Math.max(1, Math.round(0.45 / r.px)); const ox = Math.max(0, bx0 - 1), oy = Math.max(0, by0 - 1);
  const w = Math.min(W, bx1 + 2) - ox, h = Math.min(r.h, by1 + 2) - oy; const N = w * h;
  const gk = (k: number) => (oy + ((k / w) | 0)) * W + ox + (k % w);
  const m = new Uint8Array(N); for (let k = 0; k < N; k++) m[k] = r.cimke[gk(k)] === c0 ? 1 : 0;
  const morf = (be: Uint8Array, erozio: boolean) => {
    const tmp = new Uint8Array(N), ki = new Uint8Array(N); const cel = erozio ? 0 : 1;
    for (let y = 0; y < h; y++) { let u = -1e9; for (let x = 0; x < w; x++) { if (be[y * w + x] === cel) u = x; if (x - u <= R) tmp[y * w + x] = 1; } u = 1e9; for (let x = w - 1; x >= 0; x--) { if (be[y * w + x] === cel) u = x; if (u - x <= R) tmp[y * w + x] = 1; } }
    for (let x = 0; x < w; x++) { let u = -1e9; for (let y = 0; y < h; y++) { if (tmp[y * w + x]) u = y; if (y - u <= R) ki[y * w + x] = 1; } u = 1e9; for (let y = h - 1; y >= 0; y--) { if (tmp[y * w + x]) u = y; if (u - y <= R) ki[y * w + x] = 1; } }
    if (erozio) for (let k = 0; k < N; k++) ki[k] = ki[k] ? 0 : 1;
    return ki;
  };
  const er = morf(m, true); for (let k = 0; k < N; k++) if (!m[k]) er[k] = 0;
  const ny = morf(er, false); for (let k = 0; k < N; k++) if (!m[k]) ny[k] = 0;
  const komp = new Int32Array(N); let kn = 0; const sor: number[] = [];
  for (let i = 0; i < N; i++) {
    if (!ny[i] || komp[i]) continue; kn++; komp[i] = kn; const kezd = sor.length; sor.push(i);
    for (let t = kezd; t < sor.length; t++) { const a = sor[t]!, x = a % w; for (const n of [x > 0 ? a - 1 : -1, x < w - 1 ? a + 1 : -1, a - w, a + w]) if (n >= 0 && n < N && ny[n] && !komp[n]) { komp[n] = kn; sor.push(n); } }
  }
  if (kn < 2) return [];
  for (let t = 0; t < sor.length; t++) { const a = sor[t]!, x = a % w; for (const n of [x > 0 ? a - 1 : -1, x < w - 1 ? a + 1 : -1, a - w, a + w]) if (n >= 0 && n < N && m[n] && !komp[n]) { komp[n] = komp[a]!; sor.push(n); } }
  const gx = Math.floor((px - r.x0) * r.mPerPt / r.px) - ox, gy = Math.floor((py - r.y0) * r.mPerPt / r.px) - oy;
  let tart = gx >= 0 && gy >= 0 && gx < w && gy < h ? komp[gy * w + gx]! : 0;
  const meret = new Map<number, number>(); for (let k = 0; k < N; k++) if (komp[k] && m[k]) meret.set(komp[k]!, (meret.get(komp[k]!) ?? 0) + 1);
  if (!tart) tart = [...meret.entries()].sort((a2, b2) => b2[1] - a2[1])[0]![0];
  const marad = (meret.get(tart) ?? 0) * r.px * r.px;
  if (Math.abs(marad - Avart) >= Math.abs(A - Avart)) return [];
  const ki: number[] = []; for (let k = 0; k < N; k++) if (m[k] && komp[k] !== tart) ki.push(gk(k));
  return ki;
}

export function burokAuto(r: Raszter, futott: ReadonlySet<number>, zsebTilto?: { x: number; y: number }[], vart?: { ri: number; A: number; x: number; y: number }[]): Poligon[] {
  const { w, h } = r;
  let m = new Uint8Array(w * h);
  for (let k = 0; k < w * h; k++) { const c = r.cimke[k]!; if (c >= 2 && futott.has(c - 2)) m[k] = 1; }
  // a pecsétnél jóval nagyobbra kifolyt helyiségek túlfolyt része nem a burok része
  if (vart) {
    // a helyiségek befoglalója és cellaszáma egy menetben
    const bb = new Map<number, [number, number, number, number, number]>();
    for (let k = 0; k < w * h; k++) { const c = r.cimke[k]!; if (c < 2) continue; const x = k % w, y = (k / w) | 0; const b = bb.get(c - 2); if (!b) bb.set(c - 2, [x, y, x, y, 1]); else { if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y; b[4]++; } }
    for (const v of vart) { const b = bb.get(v.ri); if (!b || !futott.has(v.ri) || b[4] * r.px * r.px < 1.4 * v.A + 1) continue; for (const k of kifolytCellak(r, v.ri, v.A, v.x, v.y, b)) m[k] = 0; }
  }
  if (zsebTilto) for (const k of futottZsebek(r, futott, zsebTilto)) m[k] = 1;
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
  return kulsok.map((p) => { const g = globalThis as any; let q = egyszerusit(p, 0.12 / r.px); if (!g.NOFO) q = ferdeOsszevon(q, 0.6 / r.px, 0.7 / r.px, 2.5 / r.px, 3.0 / r.px); if (!g.NODR) q = derekszog(q, 1.5 / r.px, 0.2 / r.px); return q.map(([gx, gy]) => [Math.round(lapX(r, gx) * 10) / 10, Math.round(lapY(r, gy) * 10) / 10] as [number, number]); })
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
/** A körvonal éleinél a falsáv a raszterben: élenként a befelé mutató normális, a sáv külső (dKi) és belső (dIn) síkjának
 * távolsága a rajzolt éltől (m, befelé pozitív; mediánok), és hogy a mintapontok hányadánál volt meg. A legfeljebb 4 cm-es
 * réssel csatlakozó réteg (a falra rajzolt hőszigetelés külön kontúrja) a sáv része. */
/**
 * Külső sraffozott felületek (járda, térkő, kavicsterítés, burkolt udvar): a raszter „fal” cellái közül azok, amelyek
 * 1,2 m-nél szélesebb összefüggő foltban állnak (nyitás 0,6 m-es négyzettel) – épületfal ilyen vastag nem lehet.
 * A burok falsáv-keresése ezeket nem tekinti falnak, a rétegnézet külön színnel mutatja.
 */
const sraffTar = new WeakMap<Raszter, Uint8Array>();
export function kulsoSraff(r: Raszter): Uint8Array {
  const t = sraffTar.get(r); if (t) return t;
  const { w, h } = r; const N = w * h; const R = Math.max(1, Math.round(0.6 / r.px));
  const morf = (be: Uint8Array, cel: number) => {
    const tmp = new Uint8Array(N), ki = new Uint8Array(N);
    for (let y = 0; y < h; y++) { let u = -1e9; for (let x = 0; x < w; x++) { if (be[y * w + x] === cel) u = x; if (x - u <= R) tmp[y * w + x] = 1; } u = 1e9; for (let x = w - 1; x >= 0; x--) { if (be[y * w + x] === cel) u = x; if (u - x <= R) tmp[y * w + x] = 1; } }
    for (let x = 0; x < w; x++) { let u = -1e9; for (let y = 0; y < h; y++) { if (tmp[y * w + x]) u = y; if (y - u <= R) ki[y * w + x] = 1; } u = 1e9; for (let y = h - 1; y >= 0; y--) { if (tmp[y * w + x]) u = y; if (u - y <= R) ki[y * w + x] = 1; } }
    return ki;
  };
  const fal = new Uint8Array(N); for (let k = 0; k < N; k++) fal[k] = r.fal[k] ? 1 : 0;
  const hatter = morf(fal, 0); const er = new Uint8Array(N); for (let k = 0; k < N; k++) er[k] = fal[k] && !hatter[k] ? 1 : 0;
  const ny = morf(er, 1); for (let k = 0; k < N; k++) ny[k] = ny[k] && fal[k] ? 1 : 0;
  // keskenyebb külső sáv (épület körüli járda, kavicssáv): az a kitöltési stílus, amely sehol nem határos helyiséggel,
  // és a foltjai átlagosan 25 cm-nél szélesebbek (a hőszigetelés vékonyabb, a falazat helyiséggel határos)
  const db = new Map<number, number>(), kerul = new Map<number, number>(), helyMellett = new Map<number, number>();
  for (let k = 0; k < N; k++) {
    const st = r.stilus[k]!; if (!fal[k] || !st) continue;
    db.set(st, (db.get(st) ?? 0) + 1);
    const x = k % w; let hm = false;
    for (const n of [x > 0 ? k - 1 : -1, x < w - 1 ? k + 1 : -1, k - w, k + w]) {
      if (n < 0 || n >= N) continue;
      if (r.stilus[n] !== st || !fal[n]) kerul.set(st, (kerul.get(st) ?? 0) + 1);
      if (r.cimke[n]! >= 2) hm = true;
    }
    if (hm) helyMellett.set(st, (helyMellett.get(st) ?? 0) + 1);
  }
  const kulsoSt = new Set<number>();
  for (const [st, n] of db) {
    const vast = (2 * n) / Math.max(1, kerul.get(st) ?? 0) * r.px;
    if (n * r.px * r.px >= 0.5 && (helyMellett.get(st) ?? 0) <= 0.002 * n && vast >= 0.25) kulsoSt.add(st);
  }
  if (kulsoSt.size) for (let k = 0; k < N; k++) if (fal[k] && kulsoSt.has(r.stilus[k]!)) ny[k] = 1;
  sraffTar.set(r, ny); return ny;
}

function elSavok(r: Raszter, p: Poligon) {
  const sraff = kulsoSraff(r);
  const gat = (x: number, y: number) => { const cx = Math.floor(((x - r.x0) * r.mPerPt) / r.px), cy = Math.floor(((y - r.y0) * r.mPerPt) / r.px); if (cx < 0 || cy < 0 || cx >= r.w || cy >= r.h) return false; const k = cy * r.w + cx; return !!((r.fal[k] && !sraff[k]) || r.nyilas[k]); };
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
          let g = gat(x + (nx * d) / r.mPerPt, y + (ny * d) / r.mPerPt);
          // ≤ 4 cm rés a sávon belül (rétegek határvonala, kontúrközi hézag): a sáv folytatódik
          if (!g && kezd !== null && d + 0.05 <= 1.5 && (gat(x + (nx * (d + 0.02)) / r.mPerPt, y + (ny * (d + 0.02)) / r.mPerPt) || gat(x + (nx * (d + 0.04)) / r.mPerPt, y + (ny * (d + 0.04)) / r.mPerPt))) g = true;
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
  return elek;
}

export function burokMeres(r: Raszter, pol: Poligon[]): BurokEl[][] {
  return pol.map((p) => {
    const n = p.length;
    const elek = elSavok(r, p);
    // a nem talált élek belső síkja: a körvonal mediánvastagságával a rajzolt éltől befelé
    const vast = elek.flatMap((e) => (e.dIn !== null && e.dKi !== null && e.lefedett >= 0.3 ? [e.dIn - e.dKi] : [])).sort((u, w) => u - w);
    const vMed = vast.length ? vast[vast.length >> 1]! : 0.4;
    const eltol = (e: (typeof elek)[number]) => (e.lefedett >= 0.3 && e.dIn !== null ? e.dIn : vMed);
    // a belső egyenesek metszéspontjai (párhuzamos szomszéd: a közös csúcs eltolva)
    const vonal = (e: (typeof elek)[number]) => { const d = eltol(e) / r.mPerPt; return { px: e.a[0] + e.nx * d, py: e.a[1] + e.ny * d, vx: e.b[0] - e.a[0], vy: e.b[1] - e.a[1] }; };
    const metsz = (e1: (typeof elek)[number], e2: (typeof elek)[number], csucs: [number, number]): [number, number] => {
      const A = vonal(e1), B = vonal(e2); const det = A.vx * B.vy - A.vy * B.vx;
      if (Math.abs(det) < 1e-6 * Math.hypot(A.vx, A.vy) * Math.hypot(B.vx, B.vy)) { const d = eltol(e2) / r.mPerPt; return [csucs[0] + e2.nx * d, csucs[1] + e2.ny * d]; }
      const t = ((B.px - A.px) * B.vy - (B.py - A.py) * B.vx) / det; const q: [number, number] = [A.px + A.vx * t, A.py + A.vy * t];
      // közel párhuzamos élek metszése messzire eshet: legfeljebb 1,2 m-re a csúcstól, különben az eltolt csúcs
      if (Math.hypot(q[0] - csucs[0], q[1] - csucs[1]) * r.mPerPt > 1.2) { const d = eltol(e2) / r.mPerPt; return [csucs[0] + e2.nx * d, csucs[1] + e2.ny * d]; }
      return q;
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

/**
 * A hőburok a fal külső síkján (hőszigetelés külső felülete, ill. vastag fal külső síkja): a körvonal élei a mért
 * falsáv külső síkjára tolva, a sarkok a szomszédos külső síkok metszéspontjai. Ahol nincs falsáv, a körvonal
 * mediánvastagságával kifelé.
 */
export function kulsoSikra(r: Raszter, pol: Poligon[]): Poligon[] {
  return pol.map((p) => {
    const n = p.length; if (n < 3) return p;
    const elek = elSavok(r, p);
    // hihető falsáv: a belső síkja a rajzolt él közelében (a körvonal a helyiségek széle), a külső kifelé, és a
    // vastagsága 8–80 cm – a ennél vastagabb „sáv” a fal elé rajzolt külső sraffozással (járda, kavics) összenőtt
    const hiheto = (e: (typeof elek)[number]) => e.lefedett >= 0.3 && e.dKi !== null && e.dIn !== null && e.lm >= 0.3 && e.dIn >= -0.15 && e.dIn <= 0.35 && e.dKi <= 0.05 && e.dIn - e.dKi >= 0.08 && e.dIn - e.dKi <= 0.8;
    const vast = elek.flatMap((e) => (hiheto(e) ? [e.dIn! - e.dKi!] : [])).sort((u, w) => u - w);
    const vMed = vast.length ? vast[vast.length >> 1]! : 0.4;
    const jo = (e: (typeof elek)[number]) => hiheto(e) && e.dIn! - e.dKi! <= vMed + 0.15;
    const eltol = (e: (typeof elek)[number]) => (jo(e) ? e.dKi! : Math.min(e.dIn !== null && e.dIn >= -0.15 && e.dIn <= 0.35 ? e.dIn : 0, 0.1) - vMed);
    const vonal = (e: (typeof elek)[number]) => { const d = eltol(e) / r.mPerPt; return { px: e.a[0] + e.nx * d, py: e.a[1] + e.ny * d, vx: e.b[0] - e.a[0], vy: e.b[1] - e.a[1] }; };
    const maxEl = 1.2 / r.mPerPt; // a sarokpont legfeljebb 1,2 m-re mozdulhat (közel párhuzamos élek metszése)
    const ki: Poligon = elek.map((e, k) => {
      const elozo = elek[(k - 1 + n) % n]!;
      const A = vonal(elozo), B = vonal(e); const det = A.vx * B.vy - A.vy * B.vx;
      const d1 = eltol(elozo) / r.mPerPt, d2 = eltol(e) / r.mPerPt;
      const atlag: [number, number] = [e.a[0] + (elozo.nx * d1 + e.nx * d2) / 2, e.a[1] + (elozo.ny * d1 + e.ny * d2) / 2];
      let q: [number, number] = atlag;
      if (Math.abs(det) >= 0.05 * Math.hypot(A.vx, A.vy) * Math.hypot(B.vx, B.vy)) {
        const t = ((B.px - A.px) * B.vy - (B.py - A.py) * B.vx) / det; const m: [number, number] = [A.px + A.vx * t, A.py + A.vy * t];
        if (Math.hypot(m[0] - e.a[0], m[1] - e.a[1]) <= maxEl) q = m;
      }
      return [Math.round(q[0] * 10) / 10, Math.round(q[1] * 10) / 10] as [number, number];
    });
    // ha az eltolás kifordítaná vagy önmetszővé tenné a körvonalat, marad az eredeti
    const metszo = () => { for (let i = 0; i < ki.length; i++) for (let j = i + 2; j < ki.length; j++) { if (i === 0 && j === ki.length - 1) continue; if (szakaszMetsz(ki[i]!, ki[(i + 1) % ki.length]!, ki[j]!, ki[(j + 1) % ki.length]!)) return true; } return false; };
    return Math.sign(terulet(ki)) === Math.sign(terulet(p)) && Math.abs(terulet(ki)) >= Math.abs(terulet(p)) * 0.95 && !metszo() ? ki : p;
  });
}
function szakaszMetsz(a: [number, number], b: [number, number], c: [number, number], d: [number, number]): boolean {
  const o = (p: [number, number], q: [number, number], r2: [number, number]) => Math.sign((q[0] - p[0]) * (r2[1] - p[1]) - (q[1] - p[1]) * (r2[0] - p[0]));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}

/**
 * Belső falak csatlakozása a (belső méretű) körvonal éleihez: az él mentén 5 cm-enként, 15 cm-re befelé falcella van
 * (válaszfal, belső teherhordó fal). Élenként a csatlakozási szakaszok az él hosszának arányában [t0, t1], a sarkok
 * 10 cm-es környezete nélkül. Belső méretes számításnál ezek a falszakaszok nem a külső fal részei (levonódnak).
 */
export function csatlakozasok(r: Raszter, pol: Poligon[]): [number, number][][][] {
  return pol.map((p) => {
    const n = p.length;
    const A0 = p.reduce((t, [x, y], i) => { const [x2, y2] = p[(i + 1) % n]!; return t + x * y2 - x2 * y; }, 0);
    const el = Math.sign(A0) || 1;
    return p.map((a, i) => {
      const b = p[(i + 1) % n]!; const L = Math.hypot(b[0] - a[0], b[1] - a[1]) * r.mPerPt; if (L < 0.3) return [];
      const ux = (b[0] - a[0]) / (L / r.mPerPt), uy = (b[1] - a[1]) / (L / r.mPerPt); const bx = -el * uy, by = el * ux; // befelé
      const ki: [number, number][] = []; let kezd: number | null = null;
      const lep = 0.05;
      for (let d = 0.1; d <= L - 0.1 + 1e-9; d += lep) {
        const x = a[0] + (ux * d + bx * 0.15) / r.mPerPt, y = a[1] + (uy * d + by * 0.15) / r.mPerPt;
        const cx = Math.floor((x - r.x0) * r.mPerPt / r.px), cy = Math.floor((y - r.y0) * r.mPerPt / r.px);
        const k = cy * r.w + cx; const fal = cx >= 0 && cy >= 0 && cx < r.w && cy < r.h && !!r.fal[k] && !r.nyilas[k];
        if (fal && kezd === null) kezd = d;
        if (!fal && kezd !== null) { if (d - kezd >= 0.06) ki.push([kezd / L, d / L]); kezd = null; }
      }
      if (kezd !== null && L - 0.1 - kezd >= 0.06) ki.push([kezd / L, (L - 0.1) / L]);
      return ki;
    });
  });
}
