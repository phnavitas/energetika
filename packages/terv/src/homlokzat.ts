/**
 * Homlokzati tervlap feldolgozása: a nyílászárók (üvegfelület + körbefutó keretsávok) felismerése a színezett
 * vektoros rajzból, méretük (tokkülméret) és magassági helyzetük, valamint a keretszínű tömör panelek (pl. fém
 * homlokzatburkolat) felülete. Az eredmény az alaprajzból átvett nyílászárók ellenőrzésére szolgál.
 *
 * Feltételezés (ArchiCAD/Revit színezett homlokzat): az üveg egyszínű kitöltött téglalap (kékes-szürke árnyalat),
 * a tok és a szárny 1–3 pt széles kitöltött sávokból áll. A korlát, attika, födémszél mögé bukó ablak alját
 * becsüljük („takart”).
 */
import type { Lap } from './kinyeres';
import { meretaranyKeres } from './alaprajz';
import { meretaranyKotabol } from './autohelyiseg';

type Tajolas = 'É' | 'ÉK' | 'K' | 'DK' | 'D' | 'DNy' | 'Ny' | 'ÉNy';
type BB = [number, number, number, number];

export interface HomlokzatAblak {
  /** Tokkülméret [m]. */
  szel: number; mag: number;
  /** Az ablak alsó élének magassága a szintjelekből [m] (ha a lapon van legalább 3 szintjel). */
  z: number | null;
  /** Az alsó keretsáv nem látszik (korlát, attika mögött) – a magasság becsült. */
  takart: boolean;
  bbox: BB;
}
export interface HomlokzatEredmeny {
  irany: Tajolas | null;
  mPerPt: number | null;
  ablakok: HomlokzatAblak[];
  /** Keretszínű tömör panelek (nem ablak, nem redőnytok) összes felülete [m²] – jellemzően fém homlokzatburkolat, tömör ajtólap. */
  panelA: number;
  uvegSzin: string | null; keretSzin: string | null;
  figyelmeztetesek: string[];
}

const IRANY: Record<string, Tajolas> = { 'É': 'É', 'ÉK': 'ÉK', 'K': 'K', 'DK': 'DK', 'D': 'D', 'DNY': 'DNy', 'NY': 'Ny', 'ÉNY': 'ÉNy' };

/** „DK homlokzat”, „ÉNY homlokzat”, „Északkeleti homlokzat” → tájolás. */
export function homlokzatIrany(cim: string): Tajolas | null {
  const m = /(?:^|[^A-ZÁÉÍÓÖŐÚÜŰ])(ÉNY|ÉK|DNY|DK|É|K|D|NY)\s*[-–]?\s*I?\s*HOMLOKZAT/.exec(cim.toUpperCase());
  if (m) return IRANY[m[1]!] ?? null;
  const sz: [RegExp, Tajolas][] = [[/északnyugati/i, 'ÉNy'], [/északkeleti/i, 'ÉK'], [/délnyugati/i, 'DNy'], [/délkeleti/i, 'DK'], [/északi/i, 'É'], [/déli/i, 'D'], [/keleti/i, 'K'], [/nyugati/i, 'Ny']];
  const c = cim.replace(/(dél|észak)\s*[-–]\s*(?=kelet|nyugat)/gi, '$1');
  for (const [re, t] of sz) if (re.test(c)) return t;
  return null;
}

/** A címben felsorolt égtájak (pl. „Ny-i, D-i homlokzatok” → Ny, D) sorrendben. */
export function homlokzatIranyok(cim: string): Tajolas[] {
  const ki: Tajolas[] = []; const re = /(?:^|[^A-ZÁÉÍÓÖŐÚÜŰ])(ÉNY|ÉK|DNY|DK|É|K|D|NY)\s*[-–]\s*I\b/g; let m: RegExpExecArray | null;
  const u = cim.toUpperCase(); while ((m = re.exec(u))) { const t = IRANY[m[1]!]; if (t && !ki.includes(t)) ki.push(t); re.lastIndex = m.index + m[0].length - 1; }
  return ki;
}
/**
 * A lap homlokzatcímei nézetenként. A több égtájat felsoroló felirat (a lap címe: „Ny-i, D-i homlokzatok”) nem egy nézet
 * címe, ha nézetcímek is vannak. Ha a nézetcímek egyike sem szerepel a lap címében (másolt, el nem írt nézetcím), a lap
 * címében felsorolt égtájak érvényesek, a nézetcímek sorrendjében (fentről lefelé, balról jobbra).
 */
export function homlokzatCimek(lap: Lap): { x: number; y: number; t: Tajolas }[] {
  const osszes = lap.szovegek.filter((t) => /homlokzat/i.test(t.s));
  const lapCim = osszes.map((t) => ({ t, ir: homlokzatIranyok(t.s) })).filter((x) => x.ir.length >= 2);
  const nezet = osszes.filter((t) => !lapCim.some((x) => x.t === t)).flatMap((t) => { const ir = homlokzatIrany(t.s); return ir ? [{ x: t.x, y: t.y, t: ir }] : []; });
  if (!nezet.length) return lapCim.flatMap(({ t }) => { const ir = homlokzatIrany(t.s); return ir ? [{ x: t.x, y: t.y, t: ir }] : []; });
  const lc = lapCim.length === 1 ? lapCim[0]!.ir : null;
  if (lc && lc.length === nezet.length && !nezet.some((n) => lc.includes(n.t))) {
    const sor = [...nezet].sort((a, b) => (Math.abs(a.y - b.y) > 20 ? a.y - b.y : a.x - b.x));
    return sor.map((n, i) => ({ ...n, t: lc[i]! }));
  }
  return nezet;
}

const rgb = (s: string) => { const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(s); return m ? [1, 2, 3].map((i) => parseInt(m[i]!, 16)) as [number, number, number] : null; };

export function homlokzatElemez(lap: Lap): HomlokzatEredmeny {
  const figy: string[] = [];
  // rajzterület: a jelmagyarázat / pecsét előtt
  const jm = lap.szovegek.filter((t) => /^(megjegyzések|anyagjelölések|homlokzati anyagok|építtető|megrendelő)\b/i.test(t.s.trim())).map((t) => t.x);
  const xmax = jm.length ? Math.min(...jm) - 10 : lap.szel;
  const kit = lap.utvonalak.filter((u) => u.muvelet !== 'stroke' && u.bbox[2] <= xmax);
  const w = (b: BB) => b[2] - b[0], h = (b: BB) => b[3] - b[1];

  // lépték: pecsét „1:100”, ennek hiányában a szintjelekből
  const M = meretaranyKeres(lap.szovegek);
  const szint = lap.szovegek.filter((t) => t.x < xmax && /^[+±-]?\d{1,2},\d{2}$/.test(t.s.trim())).map((t) => ({ y: t.y, z: Number(t.s.trim().replace('±', '').replace(',', '.')) }));
  let mag: ((y: number) => number) | null = null, mPerPtSzint: number | null = null;
  if (szint.length >= 3) {
    const my = szint.reduce((s, p) => s + p.y, 0) / szint.length, mz = szint.reduce((s, p) => s + p.z, 0) / szint.length;
    const sxx = szint.reduce((s, p) => s + (p.y - my) ** 2, 0);
    if (sxx > 0) { const b = szint.reduce((s, p) => s + (p.y - my) * (p.z - mz), 0) / sxx; if (b < 0) { mag = (y) => mz + b * (y - my); mPerPtSzint = -b; } }
  }
  const mPerPt = M ? (25.4 / 72) / 1000 * M : mPerPtSzint;
  if (!mPerPt) return { irany: null, mPerPt: null, ablakok: [], panelA: 0, uvegSzin: null, keretSzin: null, figyelmeztetesek: ['A homlokzat léptéke nem olvasható ki (nincs „1:100” felirat és szintjel).'] };
  if (M && mPerPtSzint && Math.abs(mPerPtSzint / mPerPt - 1) > 0.05) figy.push(`A szintjelekből számolt lépték eltér a pecsétben megadottól (1:${M}) – a szintmagasságok bizonytalanok.`);

  // üvegszín: kékes árnyalatú, közepesen világos kitöltés, a legnagyobb összterülettel
  const szinA = new Map<string, number>();
  for (const u of kit) { const c = rgb(u.toltoSzin); if (!c) continue; const [r, g, b] = c; const l = (Math.max(r, g, b) + Math.min(r, g, b)) / 510; if (b > r + 8 && g >= r && l > 0.4 && l < 0.92) szinA.set(u.toltoSzin, (szinA.get(u.toltoSzin) ?? 0) + w(u.bbox) * h(u.bbox)); }
  const uvegSzin = [...szinA.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  if (!uvegSzin) return { irany: null, mPerPt, ablakok: [], panelA: 0, uvegSzin: null, keretSzin: null, figyelmeztetesek: ['A homlokzaton nem található színezett üvegfelület – a nyílászárók nem ismerhetők fel (színezett homlokzat kell).'] };
  let uveg = kit.filter((u) => u.toltoSzin === uvegSzin).map((u) => [...u.bbox] as BB);

  // keretszín: az üveg széleihez simuló vékony sávok leggyakoribb színe
  const VEK = 3.0 / (mPerPt / 0.03528); // ~10 cm
  const kSzam = new Map<string, number>(), osszDb = new Map<string, number>();
  for (const u of kit) osszDb.set(u.toltoSzin, (osszDb.get(u.toltoSzin) ?? 0) + 1);
  for (const u of kit) {
    if (u.toltoSzin === uvegSzin || Math.min(w(u.bbox), h(u.bbox)) > VEK) continue;
    if (uveg.some((g) => (Math.abs(u.bbox[2] - g[0]) < 0.6 || Math.abs(u.bbox[0] - g[2]) < 0.6 || Math.abs(u.bbox[3] - g[1]) < 0.6 || Math.abs(u.bbox[1] - g[3]) < 0.6) && u.bbox[0] < g[2] + VEK && u.bbox[2] > g[0] - VEK && u.bbox[1] < g[3] + VEK && u.bbox[3] > g[1] - VEK)) kSzam.set(u.toltoSzin, (kSzam.get(u.toltoSzin) ?? 0) + 1);
  }
  // az árnyékréteg is követi a keret alakját: a színt az üveghez simuló sávok aránya (és nem darabszáma) dönti el
  const keretSzin = [...kSzam.entries()].filter(([, n]) => n >= Math.max(4, 0.3 * Math.max(...kSzam.values()))).sort((a, b) => b[1] / osszDb.get(b[0])! - a[1] / osszDb.get(a[0])!)[0]?.[0] ?? null;
  const keret = kit.filter((u) => u.toltoSzin === keretSzin).map((u) => u.bbox as BB);
  const hsav = keret.filter((c) => h(c) <= VEK && w(c) > VEK);

  // korlátoszlop / rúd mögött szétvágott üvegdarabok összevonása: előbb vízszintesen, aztán függőlegesen
  uveg.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const vv: BB[] = [];
  for (const g of uveg) { const o = vv.find((o) => Math.abs(o[1] - g[1]) < 0.5 && Math.abs(o[3] - g[3]) < 0.5 && g[0] - o[2] > -0.2 && g[0] - o[2] < 1.2); if (o) o[2] = Math.max(o[2], g[2]); else vv.push([...g]); }
  vv.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  uveg = [];
  for (const g of vv) { const o = uveg.find((o) => Math.abs(o[0] - g[0]) < 0.8 && Math.abs(o[2] - g[2]) < 0.8 && g[1] - o[3] < 4 && g[3] > o[1]); if (o) { o[1] = Math.min(o[1], g[1]); o[3] = Math.max(o[3], g[3]); } else uveg.push([...g]); }

  const takarok = kit.filter((u) => u.toltoSzin !== uvegSzin && u.toltoSzin !== keretSzin && h(u.bbox) >= 3).map((u) => u.bbox as BB);
  const ablakok: HomlokzatAblak[] = [];
  for (const g of uveg) {
    if (h(g) * mPerPt < 0.2 || w(g) * mPerPt < 0.15) continue;
    const fent = hsav.filter((c) => c[0] <= g[0] + 0.6 && c[2] >= g[2] - 0.6 && c[3] >= g[1] - 4.5 && c[3] <= g[1] + 0.6);
    if (!fent.length) continue;
    const fe = fent.reduce((a, c) => (c[1] < a[1] ? c : a));
    const lent = hsav.filter((c) => c[0] <= g[0] + 0.6 && c[2] >= g[2] - 0.6 && c[1] <= g[3] + 4.5 && c[1] >= g[3] - 0.6);
    let x0 = fe[0], x1 = fe[2], y1: number, takart = false;
    if (lent.length) { const le = lent.reduce((a, c) => (c[3] > a[3] ? c : a)); y1 = le[3]; x0 = Math.min(x0, le[0]); x1 = Math.max(x1, le[2]); }
    else {
      // korlát mögött: a korlát aljáig; födémszél, attika mögött: az üveg alja + keretvastagság
      const k = takarok.filter((c) => c[1] >= g[3] - 1 && c[1] <= g[3] + 6 && c[0] <= g[0] + 1 && c[2] >= g[2] - 1);
      const korlat = k.filter((c) => h(c) * mPerPt >= 0.42);
      y1 = korlat.length ? Math.max(...korlat.map((c) => c[3])) : g[3] + h(fe);
      takart = true;
    }
    const r: BB = [x0, fe[1], x1, y1];
    if (ablakok.some((a) => a.bbox.every((v, i) => Math.abs(v - r[i]!) < 0.8))) continue;
    ablakok.push({ szel: Math.round(w(r) * mPerPt * 100) / 100, mag: Math.round(h(r) * mPerPt * 100) / 100, z: mag ? Math.round(mag(y1) * 100) / 100 : null, takart, bbox: r });
  }

  // keretszínű tömör panelek (fém burkolat): nem ablakon belüli, nem redőnytok (ablak feletti alacsony sáv)
  const pan = keret.filter((c) => h(c) > VEK && w(c) > VEK);
  const egyedi: BB[] = [];
  for (const c of pan) {
    if (ablakok.some((a) => c[0] >= a.bbox[0] - 0.5 && c[2] <= a.bbox[2] + 0.5 && c[1] >= a.bbox[1] - 0.5 && c[3] <= a.bbox[3] + 0.5)) continue;
    if (h(c) * mPerPt < 0.32 && ablakok.some((a) => Math.abs(c[3] - a.bbox[1]) < 0.8 && c[0] <= a.bbox[0] + 1 && c[2] >= a.bbox[2] - 1)) continue;
    if (!egyedi.some((d) => d.every((v, i) => Math.abs(v - c[i]!) < 0.5))) egyedi.push(c);
  }
  const panelA = Math.round(egyedi.reduce((s, c) => s + w(c) * h(c), 0) * mPerPt * mPerPt * 10) / 10;
  if (ablakok.some((a) => a.takart)) figy.push(`${ablakok.filter((a) => a.takart).length} nyílászáró alsó része takart (korlát, attika mögött) – a magasságuk becsült.`);
  return { irany: null, mPerPt, ablakok, panelA, uvegSzin, keretSzin, figyelmeztetesek: figy };
}

/**
 * Vonalas (színezés nélküli) homlokzat nyílászáró-kereteinek indexe: a tengelyirányú vonalak egy vonalba eső darabjai
 * összefűzve. A nyílászáró magasságát egy (alaprajzon mért) szélességhez keressük: két függőleges vonal a szélesség
 * távolságában, és köztük legalább két vízszintes vonal, amely pontosan a két függőlegesig tart (tok felső és alsó éle).
 */
export interface VonalIndex { mPerPt: number; fugg: { x: number; a: number; b: number }[]; vizsz: { y: number; a: number; b: number }[] }

export function vonalIndex(lap: Lap, tartalekM?: number): VonalIndex | null {
  // lépték a feliratból; hibás / hiányzó felirat („M 1:00”) esetén a méretláncokból, végül a tervcsomag alaprajzi léptéke
  const M = meretaranyKeres(lap.szovegek) || meretaranyKotabol(lap.szovegek, lap.utvonalak) || tartalekM || null;
  if (!M) return null;
  const mPerPt = (25.4 / 72) / 1000 * M;
  const jm = lap.szovegek.filter((t) => /^(megjegyzések|anyagjelölések|homlokzati anyagok|felületek|építtető|megrendelő|tervező)\b/i.test(t.s.trim())).map((t) => t.x);
  const xmax = jm.length ? Math.min(...jm) - 10 : lap.szel;
  const min = 0.25 / mPerPt;
  const v = new Map<number, [number, number][]>(), hz = new Map<number, [number, number][]>();
  for (const u of lap.utvonalak) {
    if (u.muvelet === 'none' || u.bbox[0] > xmax) continue;
    for (const p of u.pontok) for (let i = 0; i + 3 < p.length; i += 2) {
      const ax = p[i]!, ay = p[i + 1]!, bx = p[i + 2]!, by = p[i + 3]!;
      if (Math.abs(ax - bx) < 0.05 && Math.abs(ay - by) >= min) { const k = Math.round(ax * 4); const l = v.get(k) ?? []; l.push([Math.min(ay, by), Math.max(ay, by)]); v.set(k, l); }
      else if (Math.abs(ay - by) < 0.05 && Math.abs(ax - bx) >= min * 0.5) { const k = Math.round(ay * 4); const l = hz.get(k) ?? []; l.push([Math.min(ax, bx), Math.max(ax, bx)]); hz.set(k, l); }
    }
  }
  const fuz = (l: [number, number][]) => { l.sort((a, b) => a[0] - b[0]); const o: [number, number][] = []; for (const s of l) { const u = o[o.length - 1]; if (u && s[0] <= u[1] + 0.03 / mPerPt) u[1] = Math.max(u[1], s[1]); else o.push([...s]); } return o; };
  const fugg: VonalIndex['fugg'] = [], vizsz: VonalIndex['vizsz'] = [];
  for (const [k, l] of v) for (const [a, b] of fuz(l)) fugg.push({ x: k / 4, a, b });
  for (const [k, l] of hz) for (const [a, b] of fuz(l)) vizsz.push({ y: k / 4, a, b });
  fugg.sort((p, q) => p.x - q.x); vizsz.sort((p, q) => p.y - q.y);
  return { mPerPt, fugg, vizsz };
}

export interface HomlokzatKeret { x0: number; x1: number; y0: number; y1: number; szel: number; mag: number; takart: boolean }

/**
 * Nyílászárókeretek a vonalas homlokzaton: egy vízszintes (a tok felső éle), amelynek mindkét végénél egy onnan lefelé
 * induló függőleges van; belül (2–15 cm-re) mindkét oldalon újabb függőleges (szárny / üvegléc – a korlát üvegtáblája,
 * a burkolati panel egyszerű téglalap); alul a függőlegeseket záró vízszintes, vagy ha a keret alja takart (elöl korlát,
 * mellvéd), a takarás alatti első, a szélességet ≥ 90 %-ban lefedő vízszintes. Az egymásba ágyazott keretekből a külső.
 */
export function keretek(ix: VonalIndex): HomlokzatKeret[] {
  const { mPerPt, fugg, vizsz } = ix;
  const vt = 0.06 / mPerPt;
  const also = (x: number) => { let lo = 0, hi = fugg.length; while (lo < hi) { const m = (lo + hi) >> 1; if (fugg[m]!.x < x) lo = m + 1; else hi = m; } return lo; };
  const alsoY = (y: number) => { let lo = 0, hi = vizsz.length; while (lo < hi) { const m = (lo + hi) >> 1; if (vizsz[m]!.y < y) lo = m + 1; else hi = m; } return lo; };
  const indulo = (x: number, y: number) => { let leg: VonalIndex['fugg'][number] | null = null; for (let k = also(x - vt); k < fugg.length && fugg[k]!.x <= x + vt; k++) { const F = fugg[k]!; if (Math.abs(F.a - y) <= vt && (!leg || F.b > leg.b)) leg = F; } return leg; };
  const ki: HomlokzatKeret[] = [];
  for (const T of vizsz) {
    const W = (T.b - T.a) * mPerPt; if (W < 0.35 || W > 6) continue;
    const A = indulo(T.a, T.y), B = indulo(T.b, T.y); if (!A || !B) continue;
    const y0 = T.y, yb = Math.min(A.b, B.b); if ((yb - y0) * mPerPt < 0.3) continue;
    let y1: number | null = null, takart = false;
    // záró vízszintes a függőlegesek végénél
    for (let k = alsoY(yb - vt); k < vizsz.length && vizsz[k]!.y <= yb + vt; k++) { const H = vizsz[k]!; if (Math.abs(H.a - A.x) <= vt && Math.abs(H.b - B.x) <= vt) y1 = H.y; }
    if (y1 === null) {
      let tak = false;
      for (let k = alsoY(yb - vt); k < vizsz.length && vizsz[k]!.y <= yb + vt; k++) { const H = vizsz[k]!; if (H.a <= A.x - 0.1 / mPerPt && H.b >= B.x + 0.1 / mPerPt) tak = true; }
      if (!tak) continue;
      for (let k = alsoY(yb + 0.3 / mPerPt); k < vizsz.length && vizsz[k]!.y <= yb + 1.4 / mPerPt && y1 === null; k++) {
        const y = vizsz[k]!.y; const sz: [number, number][] = [];
        for (let q = k; q < vizsz.length && vizsz[q]!.y <= y + 0.5; q++) { const H = vizsz[q]!; const a = Math.max(H.a, A.x), b = Math.min(H.b, B.x); if (b > a) sz.push([a, b]); }
        sz.sort((p, q) => p[0] - q[0]); let fed = 0, veg = A.x; for (const [a, b] of sz) { if (b > veg) { fed += b - Math.max(a, veg); veg = b; } }
        if (fed >= 0.9 * (B.x - A.x)) y1 = y;
      }
      if (y1 === null) continue;
      takart = true;
    }
    const lat = Math.min(y1, yb);
    const belso = (x0: number, irany: number) => {
      const lo = Math.min(x0 + irany * 0.02 / mPerPt, x0 + irany * 0.15 / mPerPt), hi = Math.max(x0 + irany * 0.02 / mPerPt, x0 + irany * 0.15 / mPerPt);
      for (let k = also(lo); k < fugg.length && fugg[k]!.x <= hi; k++) { const F = fugg[k]!; if (Math.min(F.b, lat) - Math.max(F.a, y0) >= 0.6 * (lat - y0)) return true; }
      return false;
    };
    if (!belso(A.x, 1) || !belso(B.x, -1)) continue;
    const mag = (y1 - y0) * mPerPt; if (mag < 0.3 || mag > 3.3) continue;
    ki.push({ x0: A.x, x1: B.x, y0, y1, szel: Math.round(W * 100) / 100, mag: Math.round(mag * 100) / 100, takart });
  }
  // egymásba ágyazott keretek (tok → szárny) és ismétlődések: a külső marad
  const e = 0.02 / mPerPt;
  return ki.filter((k, i) => !ki.some((m, j) => j !== i && m.x0 <= k.x0 + e && m.x1 >= k.x1 - e && m.y0 <= k.y0 + e && m.y1 >= k.y1 - e && ((m.x1 - m.x0) * (m.y1 - m.y0) > (k.x1 - k.x0) * (k.y1 - k.y0) + e || j < i)));
}

/** A szélességhez (m) illő keretek magasságai (m), gyakoriság szerint. */
export function keretMagassagok(ix: VonalIndex, szel: number): { mag: number; db: number }[] {
  const db = new Map<number, number>();
  for (const k of keretek(ix)) if (Math.abs(k.szel - szel) <= 0.04) { const r = Math.round(k.mag * 20) / 20; db.set(r, (db.get(r) ?? 0) + 1); }
  return [...db.entries()].map(([mag, n]) => ({ mag, db: n })).sort((a, b) => b.db - a.db || b.mag - a.mag);
}
