/**
 * A metszet rajzolatából (rétegzett PDF: a fal- / tartószerkezet-réteg átmetszett kitöltései) kiolvasott geometria.
 * Térdfal: a födémsávra (vízszintes, ≥ 3 m széles, 12–60 cm vastag kitöltés) a széléhez közel (≤ 1,2 m) ráálló, felül
 * szabadon végződő (fölötte nincs födém) függőleges falkitöltés magassága – a tetőtéri padló és a tetősík / koszorú közt.
 */
import type { Lap, Utvonal } from './kinyeres';

const FAL = /\bfal\b|fal-szerk|falak|főfal|fal,|tartószerkezet|pillér|\bvb\b|födém/i;
const NEM = /válasz|burkolat|csempe|bútor|terep|magasság|méretez|felirat|környezet/i;
const EPULET = /épület|egyéb szerkezeti/i;

export function terdfalGeometria(lap: Lap, mPerPt: number): number | null {
  // kitöltés, vagy (a csak vonallal rajzoló irodáknál, pl. „_ÉPÜLET” réteg) zárt körvonal
  const zartE = (u: Utvonal) => u.pontok.some((p) => p.length >= 8 && Math.hypot(p[0]! - p[p.length - 2]!, p[1]! - p[p.length - 1]!) < 0.5) || u.zart.some(Boolean);
  const fills = lap.utvonalak.filter((u) => !!u.reteg && (FAL.test(u.reteg) || EPULET.test(u.reteg)) && !NEM.test(u.reteg) && u.muvelet !== 'none' && (u.muvelet !== 'stroke' || zartE(u)));
  if (!fills.length) return null;
  const m = (v: number) => v * mPerPt;
  const fodem = fills.filter((u) => m(u.bbox[2] - u.bbox[0]) >= 3 && m(u.bbox[3] - u.bbox[1]) >= 0.12 && m(u.bbox[3] - u.bbox[1]) <= 0.6);
  // függőleges falkitöltések, az egymásra rakott darabok (koszorú, falazat) oszlopba fűzve
  const fd = fills.filter((u) => { const w = m(u.bbox[2] - u.bbox[0]); return w >= 0.1 && w <= 0.8 && m(u.bbox[3] - u.bbox[1]) >= 0.1; })
    .map((u) => [...u.bbox] as [number, number, number, number]).sort((a, b) => a[0] - b[0] || a[3] - b[3]);
  const osz: [number, number, number, number][] = [];
  for (const b of fd) {
    const o = osz.find((c) => Math.min(c[2], b[2]) - Math.max(c[0], b[0]) > 0.5 * Math.min(c[2] - c[0], b[2] - b[0]) && (Math.abs(c[1] - b[3]) <= 0.05 / mPerPt || Math.abs(b[1] - c[3]) <= 0.05 / mPerPt || (b[1] < c[3] && b[3] > c[1])));
    if (o) { o[0] = Math.min(o[0], b[0]); o[1] = Math.min(o[1], b[1]); o[2] = Math.max(o[2], b[2]); o[3] = Math.max(o[3], b[3]); } else osz.push(b);
  }
  const jel: number[] = [];
  for (const c of osz) {
    const h = m(c[3] - c[1]); if (h < 0.3 || h > 2.2) continue;
    const cx = (c[0] + c[2]) / 2;
    // a fal alja a födém tetején, a födém széléhez közel
    const f = fodem.find((s) => Math.abs(s.bbox[1] - c[3]) <= 0.08 / mPerPt && cx >= s.bbox[0] - 1.2 / mPerPt && cx <= s.bbox[2] + 1.2 / mPerPt && (m(Math.abs(cx - s.bbox[0])) <= 1.2 || m(Math.abs(cx - s.bbox[2])) <= 1.2));
    if (!f) continue;
    // fölötte (0,5 m-en belül) nincs födém – a fal a tetőbe fut, nem a következő szint födémjébe
    if (fodem.some((s) => s !== f && s.bbox[3] <= c[1] + 0.05 / mPerPt && s.bbox[3] >= c[1] - 0.5 / mPerPt && s.bbox[0] <= cx && s.bbox[2] >= cx)) continue;
    jel.push(Math.round(h * 100) / 100);
  }
  if (!jel.length) return null;
  jel.sort((a, b) => a - b);
  return jel[Math.floor((jel.length - 1) / 2)]!;
}

export type { Utvonal };

/** Vízszintes szerkezeti sáv a metszeten: a PDF-réteg, a felső és alsó síkja (m, ±0,00-hoz) és a rajzolt szélessége. */
export interface FodemSav { reteg: string; zFelso: number; zAlso: number; vastag: number; szel: number;
  /** A metszetlap azonosítója (a több metszet sávjai külön láncolódnak). */
  lap?: number }

const SZINTJEL = /^([±+\-−–])\s?(\d{1,3}[,.]\d{2,3})$/;
const SAV_NEM = /terep|k[öo]rnyezet|k[üu]lt[ée]ri|j[áa]rda|m[ée]retez|felirat|b[úu]tor/i;

/**
 * A metszet vízszintes kitöltött sávjai (födém, aljzat, padlórétegek, tetőrétegek): legalább 1,5 m széles, 1–60 cm vastag
 * kitöltés, PDF-réteggel. A magasság a szintjelekből (±/+/− előjeles „+2,60”): a jel függőleges helye és értéke közti
 * lineáris kapcsolat (a léptéket is ez adja) – a jelek többségével egyező meredekség.
 */
export function fodemSavok(lap: Lap): FodemSav[] { return metszetElemek(lap).savok; }

/** Kis keresztmetszetű kitöltött elem a metszeten (koszorú, áthidaló, pillér, falmetszet): réteg, felső / alsó sík (m),
 * szélesség (m) és a lapon a vízszintes helye (pt). */
export interface MetszetElem { reteg: string; zFelso: number; zAlso: number; magas: number; szel: number; x: number; lap?: number }

/** A metszet vízszintes sávjai (fodemSavok) és kis keresztmetszetű elemei (12–150 cm széles, 10–150 cm magas kitöltés). */
export function metszetElemek(lap: Lap): { savok: FodemSav[]; kisElemek: MetszetElem[]; mPt?: number } {
  // vízszintes vonaldarabok (a szintjel vonalához)
  const vv: [number, number, number][] = [];
  for (const u of lap.utvonalak) if (u.muvelet !== 'fill' && u.muvelet !== 'none') for (const p of u.pontok) for (let i = 0; i + 3 < p.length; i += 2)
    if (Math.abs(p[i + 3]! - p[i + 1]!) < 0.05 && Math.abs(p[i + 2]! - p[i]!) > 2) vv.push([Math.min(p[i]!, p[i + 2]!), Math.max(p[i]!, p[i + 2]!), p[i + 1]!]);
  // a jel helye a hozzá tartozó (alatta / fölötte, a szövegmagasság 1,5-szeresén belüli, vele átfedő) vonal, ennek híján a szöveg
  const jelY = (t: { x: number; y: number; meret: number; szel: number }) => {
    let leg: number | null = null, d0 = 1.5 * t.meret;
    for (const [x0, x1, y] of vv) if (x0 <= t.x + t.szel + t.meret && x1 >= t.x - t.meret && Math.abs(y - t.y) < d0) { d0 = Math.abs(y - t.y); leg = y; }
    return leg ?? t.y;
  };
  const jel = lap.szovegek.filter((t) => Math.abs(t.szog) < 2).map((t) => ({ t, m: SZINTJEL.exec(t.s.replace(/\s+/g, ' ').trim()) }))
    .filter((x) => x.m).map((x) => ({ y: jelY(x.t), v: (/[\-−–]/.test(x.m![1]!) ? -1 : 1) * Number(x.m![2]!.replace(',', '.')) }));
  if (jel.length < 2) return { savok: [], kisElemek: [] };
  // meredekség (m / pt): a jelpárok meredekségei közül a legtöbb párral (± 2 %) egyező
  const mer: number[] = [];
  for (let i = 0; i < jel.length; i++) for (let j = i + 1; j < jel.length; j++) { const dv = jel[j]!.v - jel[i]!.v, dy = jel[j]!.y - jel[i]!.y; if (Math.abs(dv) >= 1 && Math.abs(dy) > 1) mer.push(dv / dy); }
  if (!mer.length) return { savok: [], kisElemek: [] };
  let k = mer[0]!, kDb = 0;
  for (const c of mer) { const db = mer.filter((d) => Math.abs(d - c) <= 0.02 * Math.abs(c)).length; if (db > kDb) { kDb = db; k = c; } }
  const egy = mer.filter((d) => Math.abs(d - k) <= 0.02 * Math.abs(k)).sort((a, b) => a - b); k = egy[Math.floor(egy.length / 2)]!;
  // tengelymetszet: a meredekséggel egyező jelek medián eltolása
  // (egy lapon több metszet is lehet egymás alatt: a jelek tengelymetszet szerint csoportosítva, mindegyik a saját
  // függőleges sávjában érvényes)
  const csop: { b: number; y0: number; y1: number; n: number }[] = [];
  for (const j of jel) { const bj = j.v - k * j.y; const c = csop.find((q) => Math.abs(q.b - bj) <= 0.04);
    if (c) { c.b = (c.b * c.n + bj) / (c.n + 1); c.n++; c.y0 = Math.min(c.y0, j.y); c.y1 = Math.max(c.y1, j.y); } else csop.push({ b: bj, y0: j.y, y1: j.y, n: 1 }); }
  const ervenyes = csop.filter((c) => c.n >= 2);
  if (!ervenyes.length) return { savok: [], kisElemek: [] };
  const mPt = Math.abs(k);
  const z = (y: number) => { const c = ervenyes.reduce((p, q) => { const d = (x: typeof q) => (y < x.y0 ? x.y0 - y : y > x.y1 ? y - x.y1 : 0); return d(q) < d(p) ? q : p; }); return k * y + c.b; };
  const savok: FodemSav[] = [], kisElemek: MetszetElem[] = [];
  for (const u of lap.utvonalak) {
    if (u.muvelet === 'stroke' || u.muvelet === 'none' || !u.reteg || SAV_NEM.test(u.reteg)) continue;
    const w = (u.bbox[2] - u.bbox[0]) * mPt, h = (u.bbox[3] - u.bbox[1]) * mPt;
    if (w >= 0.12 && w <= 1.5 && h >= 0.1 && h <= 1.5 && u.pontok.length === 1) {
      const z1 = Math.max(z(u.bbox[1]), z(u.bbox[3])), z0 = Math.min(z(u.bbox[1]), z(u.bbox[3])), r2 = (v: number) => Math.round(v * 100) / 100;
      if (!kisElemek.some((q) => Math.abs(q.x - u.bbox[0]) < 0.5 && Math.abs(q.zFelso - z1) < 0.01 && Math.abs(q.zAlso - z0) < 0.01))
        kisElemek.push({ reteg: u.reteg, zFelso: r2(z1), zAlso: r2(z0), magas: r2(z1 - z0), szel: r2(w), x: u.bbox[0] });
      continue;
    }
    if (w < 1.5 || h < 0.01 || h > 0.6) continue;
    const z1 = Math.max(z(u.bbox[1]), z(u.bbox[3])), z0 = Math.min(z(u.bbox[1]), z(u.bbox[3]));
    const r2 = (v: number) => Math.round(v * 100) / 100;
    const m = savok.find((s) => s.reteg === u.reteg && Math.abs(s.zFelso - z1) < 0.02 && Math.abs(s.vastag - (z1 - z0)) < 0.02);
    if (m) m.szel = r2(m.szel + w); else savok.push({ reteg: u.reteg, zFelso: r2(z1), zAlso: r2(z0), vastag: r2(z1 - z0), szel: r2(w) });
  }
  // a földszinti kész padló a ±0,00: ha a padlóréteg (burkolat, aljzat) legfelső, széles sávja ± 35 cm-en belül van, de
  // nem a nullán (a szintjel vonala a szövegtől eltérő helyen), a magasságok ehhez igazítva
  const padlo = savok.filter((s) => PADLO_RETEG.test(s.reteg) && s.szel >= 3 && Math.abs(s.zFelso) <= 0.35).sort((p, q) => q.zFelso - p.zFelso)[0];
  if (padlo && Math.abs(padlo.zFelso) > 0.02) { const d = padlo.zFelso; for (const s of [...savok, ...kisElemek]) { s.zFelso = Math.round((s.zFelso - d) * 100) / 100; s.zAlso = Math.round((s.zAlso - d) * 100) / 100; } }
  return { savok: savok.sort((p, q) => q.zFelso - p.zFelso), kisElemek: kisElemek.sort((p, q) => q.zFelso - p.zFelso), mPt };
}
const PADLO_RETEG = /padl[óo]|burkolat|aljzat|esztrich/i;

/**
 * A metszet ferde (a hajlásszöggel ± 2°-on belül emelkedő / lejtő) vonalainak összhossza méterben – a magastetőt a ferde
 * tetősíkok rajzolata igazolja (a „25°” felirat egymagában lehet lépcső, előtető, lejtés is). Méretezés, felirat, terep
 * rétegei nem számítanak; lépték: a szintjelekből (metszetElemek), ennek híján 1:100.
 */
export function ferdeTetoHossz(lap: Lap, hajlas: number, mPerPt = 0.0352778): number {
  let L = 0;
  for (const u of lap.utvonalak) {
    if (u.reteg && /m[ée]retez|felirat|terep|k[öo]rnyezet|jel/i.test(u.reteg)) continue;
    for (const p of u.pontok) for (let i = 0; i + 3 < p.length; i += 2) {
      const dx = p[i + 2]! - p[i]!, dy = p[i + 3]! - p[i + 1]!, l = Math.hypot(dx, dy) * mPerPt; if (l < 0.3) continue;
      const a = (Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI;
      if (Math.abs(a - hajlas) <= 2) L += l;
    }
  }
  return Math.round(L * 10) / 10;
}

/**
 * A tető hajlásszöge a metszet rajzolatából, ha nincs szögfelirat: a 15–60°-os, legalább 1 m-es ferde szakaszok
 * hossza fokonként; a legnagyobb összhosszú fok (± 1° átlaga), ha ott emelkedő és lejtő szakasz is van (≥ 2–2 m,
 * összesen ≥ 6 m – két tetősík). Méretezés, felirat, terep rétegei nem számítanak.
 */
export function tetoHajlasRajzbol(lap: Lap, mPerPt = 0.0352778): number | null {
  const fok = new Map<number, { L: number; fel: number; le: number; sz: number }>();
  for (const u of lap.utvonalak) {
    if (u.reteg && /m[ée]retez|felirat|terep|k[öo]rnyezet|jel/i.test(u.reteg)) continue;
    for (const p of u.pontok) for (let i = 0; i + 3 < p.length; i += 2) {
      const dx = p[i + 2]! - p[i]!, dy = p[i + 3]! - p[i + 1]!, l = Math.hypot(dx, dy) * mPerPt; if (l < 1) continue;
      const a = (Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI; if (a < 15 || a > 60) continue;
      const k = Math.round(a), q = fok.get(k) ?? { L: 0, fel: 0, le: 0, sz: 0 };
      q.L += l; q.sz += a * l; if (dx * dy < 0) q.fel += l; else q.le += l; fok.set(k, q);
    }
  }
  const leg = [...fok.entries()].sort((a, b) => b[1].L - a[1].L)[0];
  if (!leg) return null;
  const kor = [leg[0] - 1, leg[0], leg[0] + 1].map((k) => fok.get(k)).filter((q): q is NonNullable<typeof q> => !!q);
  const L = kor.reduce((t, q) => t + q.L, 0), fel = kor.reduce((t, q) => t + q.fel, 0), le = kor.reduce((t, q) => t + q.le, 0);
  if (L < 6 || fel < 2 || le < 2) return null;
  return Math.round((kor.reduce((t, q) => t + q.sz, 0) / L) * 2) / 2;
}

/** Ereszkiállás-jelöltek a metszetből: a tetőhajlású (±2°) szakaszok alsó vége és az alatta álló
 *  legkülső falkitöltés külső síkja közti vízszintes távolság (m). Csak 0,15–1,5 m közti értékek. */
export function ereszKiallasok(lap: Lap, hajlas: number, mPerPt = 0.0352778): number[] {
  const also: { x: number; y: number; dir: number }[] = [];
  for (const u of lap.utvonalak) {
    if (u.reteg && /m[ée]retez|felirat|terep|k[öo]rnyezet|jel/i.test(u.reteg)) continue;
    for (const p of u.pontok) for (let i = 0; i + 3 < p.length; i += 2) {
      const dx = p[i + 2]! - p[i]!, dy = p[i + 3]! - p[i + 1]!;
      if (Math.hypot(dx, dy) * mPerPt < 1) continue;
      const a = (Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI;
      if (Math.abs(a - hajlas) > 2) continue;
      const [lx, ly, hx] = p[i + 1]! > p[i + 3]! ? [p[i]!, p[i + 1]!, p[i + 2]!] : [p[i + 2]!, p[i + 3]!, p[i]!];
      also.push({ x: lx, y: ly, dir: Math.sign(lx - hx) });
    }
  }
  const falak = lap.utvonalak.filter((u) => {
    if (u.muvelet === 'stroke' || u.muvelet === 'none') return false;
    const w = (u.bbox[2] - u.bbox[0]) * mPerPt, h = (u.bbox[3] - u.bbox[1]) * mPerPt;
    return h > 1.5 && w > 0.1 && w < 0.8;
  });
  const tav = 1.6 / mPerPt, le = 2 / mPerPt;
  const ki: number[] = [];
  for (const e of also) {
    const jel = falak.filter((f) => f.bbox[1] > e.y - 5 && f.bbox[1] < e.y + le &&
      (e.dir > 0 ? f.bbox[2] <= e.x + 1 && e.x - f.bbox[2] < tav : f.bbox[0] >= e.x - 1 && f.bbox[0] - e.x < tav));
    if (!jel.length) continue;
    const kulso = e.dir > 0 ? Math.max(...jel.map((f) => f.bbox[2])) : Math.min(...jel.map((f) => f.bbox[0]));
    const d = Math.abs(e.x - kulso) * mPerPt;
    if (d >= 0.15 && d <= 1.5) ki.push(d);
  }
  return ki;
}

/** A jelöltek leggyakoribb 10 cm-es ablakának mediánja (≥ 3 jelölt kell), egyébként undefined. */
export function ereszKiallas(jeloltek: number[]): number | undefined {
  if (jeloltek.length < 3) return undefined;
  const db = new Map<number, number>();
  for (const v of jeloltek) for (const k of [Math.floor(v / 0.05), Math.floor(v / 0.05) - 1]) db.set(k, (db.get(k) ?? 0) + 1);
  const [k] = [...db].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]!;
  const s = jeloltek.filter((v) => v >= k * 0.05 && v < (k + 2) * 0.05).sort((a, b) => a - b);
  if (s.length < 3) return undefined;
  return Math.round(s[Math.floor(s.length / 2)]! * 100) / 100;
}
