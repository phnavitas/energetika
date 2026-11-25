/**
 * A metszet rajzolatából (rétegzett PDF: a fal- / tartószerkezet-réteg átmetszett kitöltései) kiolvasott geometria.
 * Térdfal: a födémsávra (vízszintes, ≥ 3 m széles, 12–60 cm vastag kitöltés) a széléhez közel (≤ 1,2 m) ráálló, felül
 * szabadon végződő (fölötte nincs födém) függőleges falkitöltés magassága – a tetőtéri padló és a tetősík / koszorú közt.
 */
import type { Lap, Utvonal } from './kinyeres';

const FAL = /\bfal\b|fal-szerk|falak|főfal|fal,|tartószerkezet|pillér|\bvb\b|födém/i;
const NEM = /válasz|burkolat|csempe|bútor|terep|magasság|méretez|felirat|környezet/i;
const EPULET = /épület|egyéb szerkezeti/i;

export function terdfalGeometria(lap: Lap, mPerPt: number, padlo?: number): number | null {
  const g = terdfalFodemre(lap, mPerPt);
  return g !== null || padlo === undefined ? g : terdfalAtmeno(lap, padlo);
}

/**
 * Térdfal a szintjelekből, ha a falazat a tetőtéri födémen át folytonos (a födém a fal belső síkjáig ér – a falmetszet
 * egy darab az alsó szinttől a tetőig, Tata-Nyárfa): a tetőtér padlószintje alól induló, fölötte 0,3–2,2 m-rel végződő
 * függőleges falkitöltés (csak felső – ≥ 2 m-en lévő – tetőtéri szintnél, felirat szerinti térdfal-tipp híján; bármely réteg – a falazat a szerkesztővonalak fóliáján is lehet –, a nem szerkezeti rétegek
 * nélkül) tetejének magassága a padló fölött; a falak mediánja.
 */
function terdfalAtmeno(lap: Lap, padlo: number): number | null {
  const lk = szintLekepezes(lap); if (!lk) return null;
  const { z, mPt } = lk;
  const fd = lap.utvonalak.filter((u) => u.muvelet !== 'stroke' && u.muvelet !== 'none' && !(u.reteg && (NEM.test(u.reteg) || SAV_NEM.test(u.reteg))))
    .filter((u) => { const w = (u.bbox[2] - u.bbox[0]) * mPt; return w >= 0.1 && w <= 0.8 && (u.bbox[3] - u.bbox[1]) * mPt >= 0.1; })
    .map((u) => [...u.bbox] as [number, number, number, number]).sort((a, b) => a[0] - b[0] || a[3] - b[3]);
  const osz: [number, number, number, number][] = [];
  for (const b of fd) {
    const o = osz.find((c) => Math.min(c[2], b[2]) - Math.max(c[0], b[0]) > 0.5 * Math.min(c[2] - c[0], b[2] - b[0]) && (Math.abs(c[1] - b[3]) <= 0.05 / mPt || Math.abs(b[1] - c[3]) <= 0.05 / mPt || (b[1] < c[3] && b[3] > c[1])));
    if (o) { o[0] = Math.min(o[0], b[0]); o[1] = Math.min(o[1], b[1]); o[2] = Math.max(o[2], b[2]); o[3] = Math.max(o[3], b[3]); } else osz.push(b);
  }
  const jel: number[] = [];
  for (const c of osz) {
    const zt = Math.max(z(c[1]), z(c[3])), zb = Math.min(z(c[1]), z(c[3]));
    if (zb < padlo - 0.1 && zt - zb >= 2 && zt > padlo + 0.3 && zt - padlo <= 2.2) jel.push(Math.round((zt - padlo) * 100) / 100);
  }
  if (jel.length < 2) return null;
  jel.sort((a, b) => a - b);
  return jel[Math.floor((jel.length - 1) / 2)]!;
}

/**
 * ATTIKA a metszet geometriájából (Balázs, 2026-11-22: „nem rétegként kell az attika, hanem hossz-magasság-szélesség"):
 * lapostetőnél a legfelső födém szélén (± 1,2 m) álló, a födém tetején / alatta induló, annál 0,2–2 m-rel magasabbra
 * nyúló függőleges kitöltés (fal). Magastetőnél (a legfelső födém fölött hosszú ferde vonal) nincs – ott az ilyen fal
 * térdfal. A magasság a födém tetejétől, a szélesség a falvastagság (mediánok); a hossz az alaprajzból jön.
 */
export function attikaGeometria(lap: Lap): { magas: number; szel: number; zFelso: number; db: number } | null {
  const lk = szintLekepezes(lap); if (!lk) return null;
  const { z, mPt } = lk;
  const fd = lap.utvonalak.filter((u) => u.muvelet !== 'stroke' && u.muvelet !== 'none' && !(u.reteg && (NEM.test(u.reteg) || SAV_NEM.test(u.reteg))));
  const zT = (b: number[]) => Math.max(z(b[1]!), z(b[3]!)), zA = (b: number[]) => Math.min(z(b[1]!), z(b[3]!));
  // födémsávok: ≥ 3 m széles, 0,12–0,6 m vastag kitöltések; a legfelső
  const fodem = fd.filter((u) => (u.bbox[2] - u.bbox[0]) * mPt >= 3 && (u.bbox[3] - u.bbox[1]) * mPt >= 0.12 && (u.bbox[3] - u.bbox[1]) * mPt <= 0.6);
  if (!fodem.length) return null;
  const felso = fodem.reduce((p, q) => (zT(q.bbox) > zT(p.bbox) ? q : p));
  const zf = zT(felso.bbox);
  // magastető: a legfelső födém fölé emelkedő ferde vonalak (szarufa, tetősík) – együtt ≥ 4 m
  let ferde = 0;
  for (const u of lap.utvonalak) for (const p of u.pontok) for (let i = 0; i + 3 < p.length; i += 2) {
    const dx = Math.abs(p[i + 2]! - p[i]!) * mPt, dy = Math.abs(p[i + 3]! - p[i + 1]!) * mPt, L = Math.hypot(dx, dy);
    if (L < 1 || dx < 0.2 || dy < 0.2) continue;
    const a = (Math.atan2(dy, dx) * 180) / Math.PI; if (a < 8 || a > 75) continue;
    if (Math.max(z(p[i + 1]!), z(p[i + 3]!)) > zf + 0.3 && Math.min(p[i]!, p[i + 2]!) < felso.bbox[2] + 2 / mPt && Math.max(p[i]!, p[i + 2]!) > felso.bbox[0] - 2 / mPt) ferde += L;
  }
  if (ferde >= 4) return null;
  // függőleges falkitöltések oszlopba fűzve
  const fl = fd.filter((u) => { const w = (u.bbox[2] - u.bbox[0]) * mPt; return w >= 0.1 && w <= 0.8 && (u.bbox[3] - u.bbox[1]) * mPt >= 0.1; })
    .map((u) => [...u.bbox] as [number, number, number, number]).sort((a, b) => a[0] - b[0] || a[3] - b[3]);
  const osz: [number, number, number, number][] = [];
  for (const b of fl) {
    const o = osz.find((c) => Math.min(c[2], b[2]) - Math.max(c[0], b[0]) > 0.5 * Math.min(c[2] - c[0], b[2] - b[0]) && (Math.abs(c[1] - b[3]) <= 0.05 / mPt || Math.abs(b[1] - c[3]) <= 0.05 / mPt || (b[1] < c[3] && b[3] > c[1])));
    if (o) { o[0] = Math.min(o[0], b[0]); o[1] = Math.min(o[1], b[1]); o[2] = Math.max(o[2], b[2]); o[3] = Math.max(o[3], b[3]); } else osz.push(b);
  }
  const mag: number[] = [], szel: number[] = [], tet: number[] = [];
  for (const c of osz) {
    const cx = (c[0] + c[2]) / 2; const zt = zT(c), za = zA(c);
    if (Math.min(Math.abs(cx - felso.bbox[0]), Math.abs(cx - felso.bbox[2])) * mPt > 1.2) continue;
    if (za > zf + 0.1 || zt < zf + 0.2 || zt > zf + 2) continue;
    mag.push(zt - zf); szel.push((c[2] - c[0]) * mPt); tet.push(zt);
  }
  if (!mag.length) return null;
  const med = (l: number[]) => { const q = [...l].sort((a, b) => a - b); return q[Math.floor((q.length - 1) / 2)]!; };
  const r2 = (v: number) => Math.round(v * 100) / 100;
  return { magas: r2(med(mag)), szel: r2(med(szel)), zFelso: r2(med(tet)), db: mag.length };
}

function terdfalFodemre(lap: Lap, mPerPt: number): number | null {
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

/** A metszet szintjeleiből a lap függőleges koordinátájának (pt) leképezése magasságra (m, ±0,00-hoz): a jelpárok
 *  leggyakoribb meredeksége és a tengelymetszet szerinti csoportok (egy lapon több metszet is lehet egymás alatt). */
export function szintLekepezes(lap: Lap): { z: (y: number) => number; mPt: number; csoportok: { b: number; y0: number; y1: number; n: number }[] } | null {
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
  if (jel.length < 2) return null;
  // meredekség (m / pt): a jelpárok meredekségei közül a legtöbb párral (± 2 %) egyező
  const mer: number[] = [];
  for (let i = 0; i < jel.length; i++) for (let j = i + 1; j < jel.length; j++) { const dv = jel[j]!.v - jel[i]!.v, dy = jel[j]!.y - jel[i]!.y; if (Math.abs(dv) >= 1 && Math.abs(dy) > 1) mer.push(dv / dy); }
  if (!mer.length) return null;
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
  if (!ervenyes.length) return null;
  const z = (y: number) => { const c = ervenyes.reduce((p, q) => { const d = (x: typeof q) => (y < x.y0 ? x.y0 - y : y > x.y1 ? y - x.y1 : 0); return d(q) < d(p) ? q : p; }); return k * y + c.b; };
  return { z, mPt: Math.abs(k), csoportok: ervenyes };
}

/** A metszet vízszintes sávjai (fodemSavok) és kis keresztmetszetű elemei (12–150 cm széles, 10–150 cm magas kitöltés). */
export function metszetElemek(lap: Lap): { savok: FodemSav[]; kisElemek: MetszetElem[]; mPt?: number } {
  const lk = szintLekepezes(lap);
  if (!lk) return { savok: [], kisElemek: [] };
  const { z, mPt } = lk;
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
    // sraffozás: sok (≥ 8) azonos irányú szakasz egy útvonalban – nem tetősík
    { const db = new Map<number, number>(); let n = 0;
      for (const p of u.pontok) for (let i = 0; i + 3 < p.length; i += 2) { const dx = p[i + 2]! - p[i]!, dy = p[i + 3]! - p[i + 1]!; if (!dx && !dy) continue; n++; const k = Math.round((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 180; db.set(k, (db.get(k) ?? 0) + 1); }
      if (n >= 8 && Math.max(...db.values()) >= 0.8 * n) continue; }
    for (const p of u.pontok) for (let i = 0; i + 3 < p.length; i += 2) {
      const dx = p[i + 2]! - p[i]!, dy = p[i + 3]! - p[i + 1]!, l = Math.hypot(dx, dy) * mPerPt; if (l < 1) continue;
      const a = (Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI; if (a < 15 || a > 60) continue;
      const k = Math.round(a), q = fok.get(k) ?? { L: 0, fel: 0, le: 0, sz: 0 };
      q.L += l; q.sz += a * l; if (dx * dy < 0) q.fel += l; else q.le += l; fok.set(k, q);
    }
  }
  // a tető mindkét irányban lejt: a legtöbb kétirányú (min(fel, le)) hosszú szakasz szöge
  const ket = (k: number) => { const kk = [k - 1, k, k + 1].map((x) => fok.get(x)).filter((q): q is NonNullable<typeof q> => !!q); return Math.min(kk.reduce((t, q) => t + q.fel, 0), kk.reduce((t, q) => t + q.le, 0)); };
  const leg = [...fok.entries()].sort((a, b) => ket(b[0]) - ket(a[0]) || b[1].L - a[1].L)[0];
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
  // (falsíkonként egy érték – a tetőrétegek – héjazat, léc, deszka – egymás alatti vonalai ugyanazt az ereszt mérik: a
  // legkülsőbb –, különben a sok párhuzamos vonallal rajzolt oldal elnyomja a többit; Bibic)
  const falankent = new Map<string, number>();
  for (const e of also) {
    const jel = falak.filter((f) => f.bbox[1] > e.y - 5 && f.bbox[1] < e.y + le &&
      (e.dir > 0 ? f.bbox[2] <= e.x + 1 && e.x - f.bbox[2] < tav : f.bbox[0] >= e.x - 1 && f.bbox[0] - e.x < tav));
    if (!jel.length) continue;
    const kulso = e.dir > 0 ? Math.max(...jel.map((f) => f.bbox[2])) : Math.min(...jel.map((f) => f.bbox[0]));
    const d = Math.abs(e.x - kulso) * mPerPt;
    if (d >= 0.15 && d <= 1.5) { const k = `${e.dir}|${Math.round(kulso * mPerPt / 0.3)}`; falankent.set(k, Math.max(falankent.get(k) ?? 0, d)); }
  }
  return [...falankent.values()];
}

/** A jelöltek (falsíkonként egy) leggyakoribb 10 cm-es ablakának mediánja – egyenlőségnél a kisebb –, egyébként undefined. */
export function ereszKiallas(jeloltek: number[]): number | undefined {
  if (jeloltek.length < 2) return undefined;
  // (a nagy – 1,2 m-nél nagyobb – kiállás csak helyenként – előtető, fedett bejárat – lehet, körben nem: ha van kisebb
  // jelölt is, az számít; Balázs, 2026-11-21: „1,47 kiállás biztosan sok, csak bizonyos helyen lehet”)
  if (jeloltek.some((v) => v <= 1.0)) jeloltek = jeloltek.filter((v) => v <= 1.25);
  if (jeloltek.length < 2) return jeloltek.length === 1 ? Math.round(jeloltek[0]! * 100) / 100 : undefined;
  const db = new Map<number, number>();
  for (const v of jeloltek) for (const k of [Math.floor(v / 0.05), Math.floor(v / 0.05) - 1]) db.set(k, (db.get(k) ?? 0) + 1);
  const [k] = [...db].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]!;
  const s = jeloltek.filter((v) => v >= k * 0.05 && v < (k + 2) * 0.05).sort((a, b) => a - b);
  if (!s.length) return undefined;
  return Math.round(s[Math.floor(s.length / 2)]! * 100) / 100;
}

/** A metszet egy rajza (egy lapon több metszet is lehet): a szintjelek szerinti függőleges lépték (m / pt), az épület
 *  vízszintes kiterjedése a lapon (pt) és a benne mért belmagasság-sávok. */
export interface BelmagSavok {
  /** A rajz függőleges sávja a lapon (pt). */
  y0: number; y1: number;
  /** m / pt (a vízszintes is ezzel a léptékkel). */
  mPt: number;
  /** Az épület vízszintes kiterjedése a rajzon (pt): a falmetszetek (kitöltött, ≥ 1,5 m magas elemek) széle. */
  s0: number; s1: number;
  /** Egymás melletti sávok (pt), mindegyik a benne írt függőleges belmagasság-méretszámmal (m). */
  savok: { s0: number; s1: number; h: number }[];
}

/**
 * Belmagasság-sávok a metszetből: a rajzba írt függőleges méretszámok (2,2–12 m – a padlótól a födém / tető alsó síkjáig)
 * a vízszintes helyükkel. Csak az a rajz számít, amelyben legalább két, egymástól ≥ 0,5 m-rel eltérő belmagasság van
 * (eltérő magasságú épületrészek, pl. csarnok + fejépület); a sávhatár a két méretszám közti legerősebb falmetszet.
 */
export function belmagassagSavok(lap: Lap): BelmagSavok[] {
  const vv: [number, number, number][] = [];
  for (const u of lap.utvonalak) if (u.muvelet !== 'fill' && u.muvelet !== 'none') for (const p of u.pontok) for (let i = 0; i + 3 < p.length; i += 2)
    if (Math.abs(p[i + 3]! - p[i + 1]!) < 0.05 && Math.abs(p[i + 2]! - p[i]!) > 2) vv.push([Math.min(p[i]!, p[i + 2]!), Math.max(p[i]!, p[i + 2]!), p[i + 1]!]);
  const jelY = (t: { x: number; y: number; meret: number; szel: number }) => {
    let leg: number | null = null, d0 = 1.5 * t.meret;
    for (const [x0, x1, y] of vv) if (x0 <= t.x + t.szel + t.meret && x1 >= t.x - t.meret && Math.abs(y - t.y) < d0) { d0 = Math.abs(y - t.y); leg = y; }
    return leg ?? t.y;
  };
  const jel = lap.szovegek.filter((t) => Math.abs(t.szog) < 2).map((t) => ({ t, m: SZINTJEL.exec(t.s.replace(/\s+/g, ' ').trim()) }))
    .filter((x) => x.m).map((x) => ({ y: jelY(x.t), x: x.t.x, v: (/[\-−–]/.test(x.m![1]!) ? -1 : 1) * Number(x.m![2]!.replace(',', '.')) }));
  if (jel.length < 2) return [];
  const mer: number[] = [];
  for (let i = 0; i < jel.length; i++) for (let j = i + 1; j < jel.length; j++) { const dv = jel[j]!.v - jel[i]!.v, dy = jel[j]!.y - jel[i]!.y; if (Math.abs(dv) >= 1 && Math.abs(dy) > 1) mer.push(dv / dy); }
  if (!mer.length) return [];
  const ki: BelmagSavok[] = [];
  // (lapon belül eltérő léptékű rajzok is lehetnek: a meredekségek csoportjai külön)
  const kk: number[] = [];
  for (const c of mer) { if (kk.some((q) => Math.abs(q - c) <= 0.02 * Math.abs(q))) continue; if (mer.filter((d) => Math.abs(d - c) <= 0.02 * Math.abs(c)).length >= 2) kk.push(c); }
  const csop: { k: number; b: number; y0: number; y1: number; x0: number; x1: number; n: number }[] = [];
  for (const k of kk) for (const j of jel) {
    const bj = j.v - k * j.y; const c = csop.find((q) => q.k === k && Math.abs(q.b - bj) <= 0.04);
    if (c) { c.b = (c.b * c.n + bj) / (c.n + 1); c.n++; c.y0 = Math.min(c.y0, j.y); c.y1 = Math.max(c.y1, j.y); c.x0 = Math.min(c.x0, j.x); c.x1 = Math.max(c.x1, j.x); }
    else csop.push({ k, b: bj, y0: j.y, y1: j.y, x0: j.x, x1: j.x, n: 1 });
  }
  const ervenyes = csop.filter((c) => c.n >= 3).sort((a, b) => b.n - a.n);
  const fogl: [number, number][] = [];
  for (const c of ervenyes) {
    if (fogl.some(([a, b]) => c.y0 < b && c.y1 > a)) continue; // (átfedő csoport: a több jelet adó marad)
    fogl.push([c.y0, c.y1]);
    const mPt = Math.abs(c.k);
    // a rajz falmetszetei: kitöltött, ≥ 1,5 m magas, ≤ 1,6 m széles elemek a rajz függőleges sávjában
    const falak = lap.utvonalak.filter((u) => u.muvelet !== 'stroke' && u.muvelet !== 'none' && u.bbox[1] >= c.y0 - 2 / mPt && u.bbox[3] <= c.y1 + 2 / mPt
      && (u.bbox[3] - u.bbox[1]) * mPt >= 1.5 && (u.bbox[2] - u.bbox[0]) * mPt <= 1.6 && u.bbox[0] >= c.x0 - 5 / mPt && u.bbox[2] <= c.x1 + 5 / mPt);
    // az épület kiterjedése: a szintjelek (a rajz két szélén, kívül) és a falmetszetek közül a legkülső
    // (a rajz minden szintjele – a más tengelymetszetű csoportba sorolt, a rajz másik szélén álló jelek is)
    const sajat = jel.filter((j) => j.y >= c.y0 - 1 && j.y <= c.y1 + 1);
    const s0 = Math.min(c.x0, ...sajat.map((j) => j.x), ...falak.map((u) => u.bbox[0])), s1 = Math.max(c.x1, ...sajat.map((j) => j.x), ...falak.map((u) => u.bbox[2]));
    // függőleges méretszámok a rajzban (belmagasság: a padlótól a födém / tető alsó síkjáig)
    const meret = lap.szovegek.filter((t) => Math.abs(Math.abs(t.szog) - 90) < 2 && /^\d{1,2},\d{2}$/.test(t.s.trim()) && t.x > s0 && t.x < s1 && t.y > c.y0 && t.y < c.y1)
      .map((t) => ({ s: t.x, h: Number(t.s.trim().replace(',', '.')) })).filter((m) => m.h >= 2.2 && m.h <= 12).sort((a, b) => a.s - b.s);
    if (meret.length < 2) continue;
    const hs = meret.map((m) => m.h);
    if (Math.max(...hs) - Math.min(...hs) < 0.5) continue;
    // sávok: két méretszám közt falmetszet áll → külön tér (a sávhatár a fal közepe); fal nélkül egy tér, a nagyobbik
    // értékkel (a kisebb a nyílás – kapu, ajtó – mérete)
    const savok: BelmagSavok['savok'] = [];
    let elo = s0, aktH = meret[0]!.h, aktS = meret[0]!.s;
    for (let i = 1; i < meret.length; i++) {
      const m = meret[i]!;
      const koz = falak.filter((u) => u.bbox[0] > aktS && u.bbox[2] < m.s).sort((a, b) => (b.bbox[3] - b.bbox[1]) - (a.bbox[3] - a.bbox[1]))[0];
      if (!koz || Math.abs(m.h - aktH) < 0.5) { aktH = Math.max(aktH, m.h); aktS = m.s; continue; }
      const hatar = (koz.bbox[0] + koz.bbox[2]) / 2;
      savok.push({ s0: elo, s1: hatar, h: aktH }); elo = hatar; aktH = m.h; aktS = m.s;
    }
    savok.push({ s0: elo, s1: s1, h: aktH });
    if (new Set(savok.map((q) => q.h)).size < 2) continue;
    ki.push({ y0: c.y0, y1: c.y1, mPt, s0, s1, savok });
  }
  return ki;
}

/** A padlóig (a földszinti padló közelébe) lefutó magastető (A alakú ház): a tetősík belső alsó élének magassága
 *  (térdfal, m) és a belső gerinc magassága (m), a padlóhoz (±0,00) mérve. */
export interface PadloigTeto { terdfal: number; gerinc: number }

/**
 * A metszeten a tető a földszinti padlóig fut le (A alakú ház): a hajlásszögű (± 2°), legalább 2 m-es emelkedő és lejtő
 * tetővonalak közös gerinccel, alsó végük mindkét oldalon a ±0,00 közelében (−0,6 … +1,5 m) – a tető alatt nincs
 * szintmagas külső fal. Ha a tető alatt mindkét oldalon a padlóra álló, legalább 1,9 m magas falmetszet áll (a tetőn
 * belüli fal), az szint, nem tetőtér: null. A magasság a szintjelekből (szintLekepezes).
 */
export function padloigEroTeto(lap: Lap, hajlas: number, mPerPt?: number): PadloigTeto | null {
  const lk = szintLekepezes(lap); if (!lk) return null;
  // ismert léptéknél (rajzi méretarány) a szintjelek csak a ±0,00 helyét adják: a kevés (két) jelből számolt meredekség
  // pontatlan lehet (a jel vonala más szerkezeté); a rajz csak a jelcsoport sávjától 3 m-en belül számít
  const k0 = lk.z(1) - lk.z(0), mPt = mPerPt ?? lk.mPt;
  const csop = (y: number) => lk.csoportok.reduce((p, q) => { const d = (x: typeof q) => (y < x.y0 ? x.y0 - y : y > x.y1 ? y - x.y1 : 0); return d(q) < d(p) ? q : p; });
  const z = (y: number) => { const c = csop(y); return mPerPt ? (-c.b / k0 - y) * mPerPt * Math.sign(-k0) : k0 * y + c.b; };
  const kozel = (y: number) => { const c = csop(y); return (y < c.y0 ? c.y0 - y : y > c.y1 ? y - c.y1 : 0) * mPt <= 3; };
  const NEM_TETO = /m[ée]retez|felirat|terep|k[öo]rnyezet|jel|b[úu]tor|szerkeszt|n[öo]v[ée]ny|fa\b/i;
  type Sz = { ax: number; ay: number; lx: number; ly: number; dir: number; L: number };
  const sz: Sz[] = [];
  for (const u of lap.utvonalak) {
    if (u.reteg && NEM_TETO.test(u.reteg)) continue;
    for (const p of u.pontok) for (let i = 0; i + 3 < p.length; i += 2) {
      const dx = p[i + 2]! - p[i]!, dy = p[i + 3]! - p[i + 1]!, L = Math.hypot(dx, dy) * mPt; if (L < 2) continue;
      const a = (Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI; if (Math.abs(a - hajlas) > 2) continue;
      // felső (gerinc felőli) és alsó vég; dir: az alsó vég a gerinctől jobbra (+1) vagy balra (−1)
      const [ax, ay, lx, ly] = p[i + 1]! < p[i + 3]! ? [p[i]!, p[i + 1]!, p[i + 2]!, p[i + 3]!] : [p[i + 2]!, p[i + 3]!, p[i]!, p[i + 1]!];
      sz.push({ ax, ay, lx, ly, dir: Math.sign(lx - ax), L });
    }
  }
  if (sz.length < 2) return null;
  // gerincenként (a felső végek 0,5 m-en belül), a leghosszabb vonalak gerincétől
  const kesz = new Set<Sz>(); let leg: PadloigTeto | null = null;
  for (const s0 of [...sz].sort((a, b) => b.L - a.L)) {
    if (kesz.has(s0)) continue;
    const cs = sz.filter((s) => Math.hypot(s.ax - s0.ax, s.ay - s0.ay) * mPt <= 0.5 || (Math.abs(s.ax - s0.ax) * mPt <= 0.5 && s.ay >= s0.ay - 0.1 / mPt && (s.ay - s0.ay) * mPt <= 1.2));
    for (const s of cs) kesz.add(s);
    const bal = cs.filter((s) => s.dir < 0), jobb = cs.filter((s) => s.dir > 0);
    if (!bal.length || !jobb.length || !cs.every((s) => kozel(s.ly))) continue;
    // a leghosszabb vonal alsó vége oldalanként (a külső, a talajig érő síkok), ill. a belső felület alsó vége (a
    // legmagasabb alsó vég a leghosszabb vonal 1,5 m-es környezetében)
    const also = (t: Sz[]) => { const h = Math.max(...t.map((s) => s.L)); const k = t.filter((s) => s.L >= h - 1.5); return { kulso: Math.min(...k.map((s) => z(s.ly))), belso: Math.max(...k.map((s) => z(s.ly))), x: k.reduce((q, s) => q + s.lx, 0) / k.length }; };
    const b = also(bal), j = also(jobb);
    if (b.kulso < -0.6 || j.kulso < -0.6 || b.belso > 1.5 || j.belso > 1.5) continue;
    if (Math.abs(j.x - b.x) * mPt < 3) continue;
    // a tetőn belüli, szintmagas fal (a padlóra álló, ≥ 1,9 m magas falmetszet a tetősík alatt mindkét oldalon): szint
    const tetoZ = (x: number, t: Sz[]) => { const s = t.reduce((p, q) => (q.L > p.L ? q : p)); const f = (x - s.ax) / ((s.lx - s.ax) || 1); return z(s.ay + f * (s.ly - s.ay)); };
    const falOldal = (t: Sz[], o: { x: number }) => lap.utvonalak.some((u) => {
      if (u.muvelet === 'stroke' || u.muvelet === 'none' || (u.reteg && NEM_TETO.test(u.reteg))) return false;
      const w = (u.bbox[2] - u.bbox[0]) * mPt, h = (u.bbox[3] - u.bbox[1]) * mPt; if (w < 0.08 || w > 0.8 || h < 1.9) return false;
      const cx = (u.bbox[0] + u.bbox[2]) / 2; if ((cx - o.x) * (b.x < j.x ? (t === bal ? 1 : -1) : (t === bal ? -1 : 1)) < 0.2 / mPt) return false;
      const zA = z(u.bbox[3]), zF = z(u.bbox[1]);
      return Math.abs(zA) <= 0.4 && zF - zA >= 1.9 && Math.abs(zF - tetoZ(cx, t)) <= 0.6;
    });
    if (falOldal(bal, b) && falOldal(jobb, j)) return null;
    // a belső gerinc: a gerinc alatti (1,2 m-en belüli) legalsó csúcs – a tetőszerkezet belső síkja
    const r2 = (v: number) => Math.round(v * 100) / 100;
    const ki = { terdfal: r2(Math.max(0, Math.min(b.belso, j.belso))), gerinc: r2(Math.min(...cs.map((s) => z(s.ay)))) };
    if (!leg || ki.gerinc > leg.gerinc) leg = ki;
  }
  return leg;
}

/** A metszet- és homlokzatlapok szintjelei (pozitív): érték, hány lapon szerepel, és szerepel-e homlokzaton. */
export interface SzintJelDb { v: number; db: number; hom: boolean }
export function szintJelekLapokrol(lapok: { lap: Lap; homlokzat: boolean }[]): SzintJelDb[] {
  const db = new Map<number, number>(), hom = new Set<number>();
  for (const { lap: l, homlokzat } of lapok) { const egy = new Set<number>(); for (const t of l.szovegek) { if (Math.abs(t.szog) > 2) continue; const m = SZINTJEL.exec(t.s.replace(/\s+/g, ' ').trim()); if (!m || /[\-−–]/.test(m[1]!)) continue; egy.add(Number(m[2]!.replace(',', '.'))); } for (const v of egy) { db.set(v, (db.get(v) ?? 0) + 1); if (homlokzat) hom.add(v); } }
  const vanHom = lapok.some((l) => l.homlokzat);
  return [...db.entries()].map(([v, n]) => ({ v, db: n, hom: !vanHom || hom.has(v) }));
}

/**
 * Az eresz és a gerinc magassága a szintjelekből (metszet, homlokzat): a lapokon legalább kétszer kiírt jelek közül az a
 * pár, amely a tető hajlásával és a tetőtest külső szélességével (W, a gerincre merőlegesen) összefér: gerinc − eresz =
 * (W / 2 + kiállás) · tg(hajlás), 0,2–1,2 m-es kiállással (a kiírt kiállás, ill. 0,5 m körül a legjobb; a közel azonos
 * jók közül a több lapon kiírt pár). Az eresz a homlokzaton is kiírt jel (a tetőszél – csatorna – magassága).
 */
export function ereszGerincJelekbol(jelek: SzintJelDb[], hajlas: number, W: number | [number, number], zMin: number, kiallas?: number): { zEresz: number; gerinc: number; kiallas: number } | null {
  const db = new Map(jelek.map((j) => [j.v, j.db]));
  const jel = jelek.filter((j) => j.db >= 2);
  // W: a tetőtest szélessége – vagy tartomány (a szárny szélessége … a legnagyobb beírt kör átmérője: bevágásos, L / T
  // alakú körvonalnál a kettő közt van a valódi; 2026-11-25, Oroszlány / Dad)
  const [W0, W1] = typeof W === 'number' ? [W, W] : W;
  const tg = Math.tan((hajlas * Math.PI) / 180); if (!(tg > 0) || !(W1 > 2)) return null;
  const jo: { e: number; g: number; k: number; d: number }[] = [];
  const kp = kiallas ?? 0.5;
  const keres = (ej: SzintJelDb[]) => { for (const E of ej) { const e = E.v; if (e < zMin || !E.hom) continue; for (const { v: g } of jel) { if (g < e + 1) continue;
    const lo = Math.max(0.2, (g - e) / tg - W1 / 2), hi = Math.min(1.2, (g - e) / tg - W0 / 2); if (lo > hi) continue;
    const k = Math.max(lo, Math.min(hi, kp));
    jo.push({ e, g, k, d: Math.abs(k - kp) }); } } };
  keres(jel);
  // (a homlokzaton egyszer írt eresz – a többi nézeten nincs kótázva –, a legalább kétszer szereplő gerinccel: Tata-Nyárfa
  // +4,77 / +7,60)
  if (!jo.length) keres(jelek.filter((j) => j.db === 1 && j.hom));
  if (!jo.length) return null;
  jo.sort((a, b) => a.d - b.d);
  const kozel = jo.filter((x) => x.d - jo[0]!.d < 0.15);
  const n = (x: typeof jo[number]) => (db.get(x.e) ?? 0) * 100 + (db.get(x.g) ?? 0);
  kozel.sort((a, b) => n(b) - n(a) || a.d - b.d);
  if (kozel.length > 1 && n(kozel[0]!) === n(kozel[1]!) && (kozel[0]!.e !== kozel[1]!.e || kozel[0]!.g !== kozel[1]!.g)) return null;
  const r2 = (v: number) => Math.round(v * 100) / 100;
  return { zEresz: r2(kozel[0]!.e), gerinc: r2(kozel[0]!.g), kiallas: r2(kozel[0]!.k) };
}
