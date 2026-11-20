/**
 * Tetőrészek a homlokzatokról: a magastetős épület lapostetős (2–3 %-os lejtésű, attikás) szárnyai. A homlokzati nézet
 * tetősziluettjén (a nézet fő vonalhálózatának felső éle) a vízszintes plató, amelynek egyik végén sem lejt le a tető a
 * hajlásával (gerinc), lapostető – a szakasz az alaprajzra vetítve az épület egy sávja, amely fölött nincs magastető.
 *
 * A sziluett: a nézet befoglalójában a vízszintes, függőleges és a tető hajlásával (± 3°) futó vonalak (a nem
 * függőleges legalább 0,6 m hosszú – a szaggatott szintvonal, a feliratok mutatóvonala, a fák kimaradnak) rácsa, ennek
 * legnagyobb összefüggő része (az épület), oszloponként a legfelső pontja, 0,5 m-es mediánnal simítva.
 */
import type { Lap } from './kinyeres';
import type { TervNyilas } from './nyilaszarok';
import { homlokzatEltolas, homlokzatRajzok, type HomlokzatRajz } from './homlokzatIllesztes';

type P2 = [number, number];

export interface HomlokzatSziluett {
  /** A homlokzat égtája (fok, 0 = É, órajárás szerint). */
  az: number;
  /** A nézet bal széle (m, a lap x-koordinátája léptékben) és az oszlopköz (m). */
  x0: number; dx: number;
  /** Oszloponként a tetősziluett magassága (m, a nézet alsó széléhez mérve; NaN: nincs épület). */
  h: Float64Array;
  /** A nézet rajza (keretek – a nyílások szerinti illesztéshez). */
  rajz: HomlokzatRajz;
  /** A fő hajlástól eltérő, 3–16°-os, legalább 1,5 m-es ferde vonalak (m: x a nézet x-koordinátája, z mint `h`) – a
   *  féltető oldalnézetben; és a nyílászárókeretek tetejének mediánja (z). */
  ferdek: { x0: number; z0: number; x1: number; z1: number; szog: number }[];
  keretTeto: number;
}

const PX = 0.05;

/** A lap homlokzati nézeteinek tetősziluettje. */
export function homlokzatSziluettek(lap: Lap, hajlasok: number[], tartalekM?: number): HomlokzatSziluett[] {
  const ki: HomlokzatSziluett[] = [];
  const rajzok = homlokzatRajzok(lap, tartalekM);
  const bb = rajzok.map((r) => ({ x0: Math.min(...r.keretek.map((k) => k.x0)), x1: Math.max(...r.keretek.map((k) => k.x1)), y0: Math.min(...r.keretek.map((k) => k.y0)), y1: Math.max(...r.keretek.map((k) => k.y1)) }));
  for (const [ri, r] of rajzok.entries()) {
    const m = r.mPerPt, b = bb[ri]!;
    // a nézet sávja: a keretek ± 15 m, de legfeljebb a mellette (azonos magasságban) álló nézet kereteiig félútig
    let bx0 = b.x0 - 15 / m, bx1 = b.x1 + 15 / m;
    const by0 = b.y0 - 7 / m, by1 = b.y1 + 0.6 / m;
    for (const [qi, q] of bb.entries()) {
      if (qi === ri || q.y1 < by0 || q.y0 > by1) continue;
      if (q.x0 >= b.x1) bx1 = Math.min(bx1, (b.x1 + q.x0) / 2); else if (q.x1 <= b.x0) bx0 = Math.max(bx0, (b.x0 + q.x1) / 2);
    }
    const w = Math.ceil(((bx1 - bx0) * m) / PX) + 1, h = Math.ceil(((by1 - by0) * m) / PX) + 1;
    if (w * h > 8e6) continue;
    const M = new Uint8Array(w * h);
    const tr = (x: number, y: number): P2 => [((x - bx0) * m) / PX, ((y - by0) * m) / PX];
    const ferdek: HomlokzatSziluett['ferdek'] = [];
    for (const u of lap.utvonalak) {
      if (u.muvelet === 'none' || u.bbox[2] < bx0 || u.bbox[0] > bx1 || u.bbox[3] < by0 || u.bbox[1] > by1) continue;
      for (const p of u.pontok) for (let i = 0; i + 3 < p.length; i += 2) {
        const ddx = Math.abs(p[i + 2]! - p[i]!), ddy = Math.abs(p[i + 3]! - p[i + 1]!);
        const sz = (Math.atan2(ddy, ddx) * 180) / Math.PI;
        if (u.muvelet !== 'fill' && sz >= 3 && sz <= 16 && !hajlasok.some((q) => Math.abs(sz - q) < 3) && ddx * m >= 1.5) {
          const [ax, ay] = [p[i]!, p[i + 1]!], [qx, qy] = [p[i + 2]!, p[i + 3]!];
          if (ax >= bx0 && ax <= bx1 && qx >= bx0 && qx <= bx1 && ay >= by0 && ay <= by1 && qy >= by0 && qy <= by1) {
            const [l, r] = ax < qx ? [[ax, ay], [qx, qy]] : [[qx, qy], [ax, ay]];
            ferdek.push({ x0: l[0]! * m, z0: (by1 - l[1]!) * m, x1: r[0]! * m, z1: (by1 - r[1]!) * m, szog: sz });
          }
        }
        if (!(sz < 2 || sz > 88 || hajlasok.some((q) => Math.abs(sz - q) < 3))) continue;
        if (sz <= 88 && Math.hypot(ddx, ddy) * m < 0.6) continue;
        const [ax, ay] = tr(p[i]!, p[i + 1]!), [bx, by] = tr(p[i + 2]!, p[i + 3]!);
        const n = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay))));
        for (let k = 0; k <= n; k++) { const x = Math.round(ax + ((bx - ax) * k) / n), y = Math.round(ay + ((by - ay) * k) / n); if (x >= 0 && y >= 0 && x < w && y < h) M[y * w + x] = 1; }
      }
    }
    // a legnagyobb összefüggő rész (8-szomszéd), amely a keretek vízszintes kiterjedésének legalább felét fedi
    const C = new Int32Array(w * h).fill(-1); let fo = -1, foDb = 0;
    const kx0 = ((b.x0 - bx0) * m) / PX, kx1 = ((b.x1 - bx0) * m) / PX;
    for (let i = 0; i < w * h; i++) {
      if (!M[i] || C[i]! >= 0) continue;
      const id = i; let db = 0, xa = w, xb = 0; const q = [i]; C[i] = id;
      while (q.length) { const a = q.pop()!; db++; const x = a % w, y = (a / w) | 0; if (x < xa) xa = x; if (x > xb) xb = x;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; const c = yy * w + xx; if (M[c] && C[c]! < 0) { C[c] = id; q.push(c); } } }
      if (Math.min(xb, kx1) - Math.max(xa, kx0) < 0.5 * (kx1 - kx0)) continue;
      if (db > foDb) { foDb = db; fo = id; }
    }
    if (fo < 0) continue;
    const nyers = new Float64Array(w).fill(NaN);
    for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) if (C[y * w + x] === fo) { nyers[x] = (h - y) * PX; break; }
    // 0,5 m-es medián (a magányos tüskék – mutatóvonal, felirat – nélkül)
    const R = 5, sim = new Float64Array(w).fill(NaN);
    for (let x = 0; x < w; x++) {
      if (Number.isNaN(nyers[x]!)) continue;
      const v: number[] = []; for (let d = -R; d <= R; d++) { const q = nyers[x + d]; if (q !== undefined && !Number.isNaN(q)) v.push(q); }
      v.sort((a, b) => a - b); sim[x] = v[v.length >> 1]!;
    }
    const tetok = r.keretek.map((k) => (by1 - k.y0) * m).sort((a, b) => a - b);
    ki.push({ az: r.az, x0: bx0 * m, dx: PX, h: sim, rajz: r, ferdek, keretTeto: tetok[tetok.length >> 1] ?? 0 });
  }
  return ki;
}

/**
 * A sziluett lapostetős szakaszai (m, a nézet x-koordinátájában): legalább 2 m hosszú vízszintes plató (± 6 cm) legalább
 * 0,4 m-rel a sziluett csúcsa alatt, amelynek egyik végén sem lejt le a sziluett a tető hajlásával (azaz nem gerinc).
 */
export function laposSzakaszok(s: HomlokzatSziluett, hajlasok: number[]): [number, number][] {
  const { h, dx } = s; const n = h.length; const ki: [number, number][] = [];
  const tgMin = Math.tan((Math.min(...hajlasok) * Math.PI) / 180) * 0.6, tgMax = Math.tan((Math.max(...hajlasok) * Math.PI) / 180) * 1.6;
  const L = Math.round(0.6 / dx);
  // (a sziluett legmagasabb pontja – a nyeregtető gerince, oldalnézetben vízszintes – nem lapostető: a plató legalább
  // 0,4 m-rel alatta)
  let max = -Infinity; for (const v of h) if (v > max) max = v;
  // a végen túl lejtő-e a tető (a platótól távolodva a hajlással csökken)
  const lejt = (i: number, ir: number) => {
    const h0 = h[i]!; let db = 0;
    for (let k = 1; k <= L; k++) { const q = h[i + ir * k]; if (q === undefined || Number.isNaN(q)) return false; const tg = (h0 - q) / (k * dx); if (tg >= tgMin && tg <= tgMax) db++; }
    return db >= L * 0.6;
  };
  let i = 0;
  while (i < n) {
    if (Number.isNaN(h[i]!)) { i++; continue; }
    let j = i; const ref = h[i]!;
    while (j + 1 < n && !Number.isNaN(h[j + 1]!) && Math.abs(h[j + 1]! - ref) <= 0.06) j++;
    if ((j - i + 1) * dx >= 2 && ref <= max - 0.4 && !lejt(i, -1) && !lejt(j, 1)) ki.push([s.x0 + i * dx, s.x0 + (j + 1) * dx]);
    i = j + 1;
  }
  return ki;
}

const szogKul = (a: number, b: number) => Math.abs(((((a - b) % 360) + 540) % 360) - 180);

/**
 * Lapostetős sávok az alaprajzon (lapkoordináta, pt): tengely ('x' – függőleges sáv, x-tartomány; 'y' – vízszintes) és
 * a tartomány. A homlokzat és az alaprajz illesztése a nyílások szerint (homlokzatEltolas); ennek híján, ha a sziluett és
 * a körvonal homlokzati vetületének szélessége egyezik (± 2,5 m / 15 %), a közepük szerint. Az egymás melletti lapos
 * szakaszok (eltérő attikamagasság) egy sávot adnak. Két szemközti illesztett homlokzat esetén csak az egybevágó (≥ 60 %-ban
 * fedő) sávok.
 */
export interface TetoSav {
  tengely: 'x' | 'y'; a: number; b: number;
  /** A sáv féltetős része (a sávra merőleges tengely c0–c1 tartománya, lapkoordináta): hajlás (fok) és a lejtés iránya
   *  (lapirány: 0 fel, 90 jobbra, 180 le, 270 balra). */
  felteto?: { c0: number; c1: number; hajlas: number; lejt: number };
}

export function laposTetoSavok(sziluettek: HomlokzatSziluett[], korvonal: P2[], mPerPt: number, eszakSzog: number, hajlasok: number[], nyilasok: TervNyilas[] = []): TetoSav[] {
  if (korvonal.length < 4 || !hajlasok.length) return [];
  // irányonként (0: a lapon felfelé néző homlokzat, órajárás szerint) a vetület: s = (−cos t·x − sin t·y)·mPerPt
  const vet = (ir: number, [x, y]: P2) => { const t = (ir * Math.PI) / 180; return (-Math.cos(t) * x - Math.sin(t) * y) * mPerPt; };
  const savok = new Map<number, [number, number][]>();
  const illesztett: { sz: HomlokzatSziluett; ir: number; o: number }[] = [];
  for (const sz of sziluettek) {
    const ill = homlokzatEltolas(sz.rajz, nyilasok, mPerPt, eszakSzog);
    let ir: number, o: number;
    let f0 = -1, f1 = -1; sz.h.forEach((v, k) => { if (!Number.isNaN(v)) { if (f0 < 0) f0 = k; f1 = k; } });
    if (f0 < 0) continue;
    if (ill) { ir = ill.ir; o = ill.o; }
    else {
      ir = [0, 90, 180, 270].reduce((a, b) => (szogKul(b - eszakSzog, sz.az) < szogKul(a - eszakSzog, sz.az) ? b : a));
      if (szogKul(ir - eszakSzog, sz.az) > 45) continue;
      const s = korvonal.map((p) => vet(ir, p)); const smin = Math.min(...s), smax = Math.max(...s);
      const F0 = sz.x0 + f0 * sz.dx, F1 = sz.x0 + (f1 + 1) * sz.dx;
      if (Math.abs(F1 - F0 - (smax - smin)) > Math.max(2.5, 0.15 * (smax - smin))) continue;
      o = (F0 + F1) / 2 - (smin + smax) / 2;
    }
    illesztett.push({ sz, ir, o });
    const s = korvonal.map((p) => vet(ir, p)); const smin = Math.min(...s), smax = Math.max(...s);
    // az egymáshoz csatlakozó lapos szakaszok összevonva
    const ls: [number, number][] = [];
    for (const [a, b] of laposSzakaszok(sz, hajlasok)) { const u = ls[ls.length - 1]; if (u && a - u[1] < 0.3) u[1] = b; else ls.push([a, b]); }
    const lista = savok.get(ir) ?? [];
    for (const [a, b] of ls) {
      const p0 = Math.max(smin, a - o), p1 = Math.min(smax, b - o);
      if (p1 - p0 >= 2) lista.push([p0, p1]);
    }
    savok.set(ir, lista);
  }
  // tengelyenként: a két szemközti homlokzat sávjai (s → lapkoordináta)
  const ki: TetoSav[] = [];
  const lapra = (ir: number, [p0, p1]: [number, number]): [number, number] => {
    // 0: s = −x·m; 180: s = x·m; 90: s = −y·m; 270: s = y·m
    const e = ir === 0 || ir === 90 ? -1 : 1;
    const a = (e * p0) / mPerPt, b = (e * p1) / mPerPt; return [Math.min(a, b), Math.max(a, b)];
  };
  const koord = (t: 'x' | 'y') => korvonal.map(([x, y]) => (t === 'x' ? x : y));
  const illeszt = (t: 'x' | 'y', v: number) => koord(t).reduce((best, c) => (Math.abs(c - v) < Math.abs(best - v) && Math.abs(c - v) * mPerPt <= 0.6 ? c : best), v);
  for (const [ira, irb, t] of [[0, 180, 'x'], [90, 270, 'y']] as [number, number, 'x' | 'y'][]) {
    const A = (savok.get(ira) ?? []).map((q) => lapra(ira, q)), B = (savok.get(irb) ?? []).map((q) => lapra(irb, q));
    const vannak = savok.has(ira) && savok.has(irb);
    const jel = vannak
      ? A.flatMap(([a0, a1]) => B.flatMap(([b0, b1]) => { const i0 = Math.max(a0, b0), i1 = Math.min(a1, b1); return i1 - i0 >= 0.6 * Math.min(a1 - a0, b1 - b0) ? [[Math.min(a0, b0), Math.max(a1, b1)] as [number, number]] : []; }))
      : [...A, ...B];
    for (const [a, b] of jel) {
      const sav: TetoSav = { tengely: t, a: illeszt(t, a), b: illeszt(t, b) };
      const f = feltetoKeres(sav); if (f) sav.felteto = f;
      ki.push(sav);
    }
  }
  return ki;

  /**
   * Féltető a sávon: a rá merőleges homlokzatokon (a sáv oldalnézete) a nyílászárók teteje fölötti, egyező (± 0,5°)
   * hajlású ferde vonalak – a legszélesebb tartományt fedő hajlás –, legalább 2 m-en és a körvonal mélységének legalább
   * 30 %-án: a tartományuk a féltető, a magasabb végük felől lejt.
   */
  function feltetoKeres(sav: TetoSav): TetoSav['felteto'] | undefined {
    const merol = sav.tengely === 'x' ? [90, 270] : [0, 180];
    const masik = (p: P2) => (sav.tengely === 'x' ? p[1] : p[0]);
    const mely = korvonal.map(masik), m0 = Math.min(...mely), m1 = Math.max(...mely);
    const jel: { szog: number; c0: number; c1: number; cMagas: number; L: number }[] = [];
    for (const { sz, ir, o } of illesztett) {
      if (!merol.includes(ir)) continue;
      for (const f of sz.ferdek) {
        if (Math.min(f.z0, f.z1) < sz.keretTeto - 0.1) continue;
        const [c0, c1] = lapra(ir, [f.x0 - o, f.x1 - o]);
        const e = ir === 0 || ir === 90 ? -1 : 1, cMagas = (e * ((f.z0 > f.z1 ? f.x0 : f.x1) - o)) / mPerPt;
        if (c1 < m0 || c0 > m1) continue;
        jel.push({ szog: Math.round(f.szog * 2) / 2, c0: Math.max(c0, m0), c1: Math.min(c1, m1), cMagas, L: f.x1 - f.x0 });
      }
    }
    const csop = new Map<number, typeof jel>();
    for (const j of jel) { const k = [...csop.keys()].find((q) => Math.abs(q - j.szog) <= 0.5) ?? j.szog; csop.set(k, [...(csop.get(k) ?? []), j]); }
    // (a csoportok közül a legszélesebb tartományt fedő – a sűrű, rövid sraffozás, burkolat-vonalazás nem)
    const fedes = (g: typeof jel) => { const iv = g.map((j) => [j.c0, j.c1] as [number, number]).sort((p, q) => p[0] - q[0]); let t = 0, e = -Infinity; for (const [a, b] of iv) { if (b > e) { t += b - Math.max(a, e); e = b; } } return t * mPerPt; };
    const leg = [...csop.values()].sort((p, q) => fedes(q) - fedes(p))[0];
    if (!leg || fedes(leg) < 2) return undefined;
    const c0 = Math.min(...leg.map((j) => j.c0)), c1 = Math.max(...leg.map((j) => j.c1));
    if ((c1 - c0) < 0.3 * (m1 - m0)) return undefined;
    const hajlas = leg.map((j) => j.szog).sort((p, q) => p - q)[leg.length >> 1]!;
    const magasKisebb = leg.filter((j) => j.cMagas < (j.c0 + j.c1) / 2).length >= leg.length / 2;
    const lejt = sav.tengely === 'x' ? (magasKisebb ? 180 : 0) : magasKisebb ? 90 : 270;
    return { c0: illeszt(sav.tengely === 'x' ? 'y' : 'x', c0), c1: illeszt(sav.tengely === 'x' ? 'y' : 'x', c1), hajlas, lejt };
  }
}

/**
 * Látszik-e a magastető a homlokzatokon: valamelyik nézet tetősziluettjén legalább 1,5 m-en (vízszintesen) a hajlással
 * (± a tangens 60–160 %-a) emelkedő / süllyedő szakasz – a kontylap, az oromzat, a tetősík oldalnézetben mind ilyen.
 */
export function magastetoLatszik(sziluettek: HomlokzatSziluett[], hajlas: number): boolean {
  const tg = Math.tan((hajlas * Math.PI) / 180), lo = tg * 0.6, hi = tg * 1.6;
  for (const s of sziluettek) {
    const L = Math.round(0.5 / s.dx); let fut = 0;
    for (let i = 0; i + L < s.h.length; i += L) {
      const a = s.h[i]!, b = s.h[i + L]!;
      const m = Math.abs(b - a) / (L * s.dx);
      if (!Number.isNaN(a) && !Number.isNaN(b) && m >= lo && m <= hi) { fut += L * s.dx; if (fut >= 1.5) return true; } else fut = 0;
    }
  }
  return false;
}
