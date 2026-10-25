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
import type { klima } from '@mag/index';

type Tajolas = (typeof klima.TAJOLASOK)[number];
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
  for (const [re, t] of sz) if (re.test(cim)) return t;
  return null;
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
