/**
 * Szkennelt távhő-adatszolgáltatás (Lechner-űrlap) kiolvasása: a táblázat rácsvonalainak felismerése a lap képén,
 * majd cellánkénti szövegfelismerés (OCR) – a számoszlopok csak számjegyre és tizedesvesszőre szűkítve.
 * A rácsfelismerés tiszta függvény (szürkeárnyalatos kép → cellák), a böngészős rész (pdf.js renderelés,
 * Tesseract.js) külön, lusta betöltéssel.
 */
export interface Racs { x: number[]; y: number[] }

/** Vízszintes vonalak: a sor leghosszabb sötét futása a kép szélességének legalább ennyi része. */
const VIZSZ_ARANY = 0.25;

/** A lap képén a táblázatok rácsa (függőleges és vízszintes vonalak középvonala, pixelben). */
export function racsKeres(g: Uint8Array, w: number, h: number, kuszob = 170): Racs[] {
  const sotet = (x: number, y: number) => g[y * w + x]! < kuszob;
  // a szkennelt vonal szaggatott és 1–3 px vastag: a sort a szomszédaival összevonva (függőleges tágítás) vizsgáljuk
  const sotet3 = (x: number, y: number) => sotet(x, y) || (y > 0 && sotet(x, y - 1)) || (y < h - 1 && sotet(x, y + 1));
  // 1. vízszintes vonalak: a leghosszabb (legfeljebb 4 px réssel) sötét futás
  const sorok: { y: number; x0: number; x1: number }[] = [];
  for (let y = 0; y < h; y++) {
    let best = 0, bx = 0, run = 0, rx = 0, hiany = 0;
    for (let x = 0; x < w; x++) {
      if (sotet3(x, y)) { if (run === 0) rx = x; run += 1 + hiany; hiany = 0; if (run > best) { best = run; bx = rx; } }
      else if (run > 0 && hiany < 4) hiany++;
      else { run = 0; hiany = 0; }
    }
    if (best > w * VIZSZ_ARANY) {
      // a vonal kiterjedése: a 30 px-nél hosszabb futások uniója (a szaggatott vonal darabjai)
      let x0 = bx, x1 = bx + best, r0 = -1;
      for (let x = 0; x <= w; x++) {
        const d = x < w && sotet3(x, y);
        if (d && r0 < 0) r0 = x;
        if (!d && r0 >= 0) { if (x - r0 >= 30) { x0 = Math.min(x0, r0); x1 = Math.max(x1, x); } r0 = -1; }
      }
      sorok.push({ y, x0, x1 });
    }
  }
  // egymás melletti sorok egy vonal; a vonal helye a leghosszabb futású sor
  const vonalak: { y: number; x0: number; x1: number; hossz: number }[] = [];
  for (const s of sorok) {
    const u = vonalak.at(-1);
    if (u && s.y - u.y <= 3) { if (s.x1 - s.x0 > u.hossz) Object.assign(u, { y: s.y, x0: s.x0, x1: s.x1, hossz: s.x1 - s.x0 }); }
    else vonalak.push({ ...s, hossz: s.x1 - s.x0 });
  }
  // függőleges lefedettség egy oszlopban (±1 px)
  const fugg = (x: number, ya: number, yb: number) => {
    let n = 0;
    for (let y = ya; y <= yb; y++) if (sotet(x, y) || (x > 0 && sotet(x - 1, y)) || (x < w - 1 && sotet(x + 1, y))) n++;
    return n / Math.max(1, yb - ya + 1);
  };
  const keret = (x: number, ya: number, yb: number) => { for (let d = -6; d <= 6; d++) if (x + d >= 0 && x + d < w && fugg(x + d, ya, yb) > 0.8) return true; return false; };
  // 2. táblázatok: egymást követő vonalpárok, amelyek közötti sávot bal és jobb oldalon függőleges keret zárja
  const ki: Racs[] = [];
  let t: typeof vonalak = [];
  const lezar = () => {
    if (t.length >= 2) {
      const x0 = Math.round(Math.min(...t.map((v) => v.x0))), x1 = Math.round(Math.max(...t.map((v) => v.x1)));
      const y0 = Math.round(t[0]!.y), y1 = Math.round(t.at(-1)!.y);
      const oszl: number[] = [];
      for (let x = Math.max(0, x0 - 20); x <= Math.min(w - 1, x1 + 20); x++) if (fugg(x, y0, y1) > 0.6) oszl.push(x);
      const xs: number[] = [];
      let kezd = -1, elozo = -10;
      for (const x of oszl) { if (x - elozo > 4) { if (kezd >= 0) xs.push((kezd + elozo) / 2); kezd = x; } elozo = x; }
      if (kezd >= 0) xs.push((kezd + elozo) / 2);
      if (xs.length >= 3) ki.push({ x: xs, y: t.map((v) => v.y) });
    }
    t = [];
  };
  for (let i = 0; i < vonalak.length; i++) {
    const v = vonalak[i]!;
    if (!t.length) { t.push(v); continue; }
    const u = t.at(-1)!;
    const zart = Math.abs(v.x0 - u.x0) < w * 0.03 && Math.abs(v.x1 - u.x1) < w * 0.03 && keret(Math.round(u.x0), Math.round(u.y) + 2, Math.round(v.y) - 2) && keret(Math.round(u.x1), Math.round(u.y) + 2, Math.round(v.y) - 2);
    if (zart) t.push(v); else { lezar(); t.push(v); }
  }
  lezar();
  return ki;
}

/**
 * Ferde szkennelés kiegyenesítése: a sötét képpontok vízszintes vetületének „élessége” (négyzetösszeg) a szög
 * függvényében (±3°, 0,05° lépés); a legélesebb szöggel visszaforgatva. Visszaadja az új képet és a szöget.
 */
export function kiegyenesit(g: Uint8Array, w: number, h: number, kuszob = 170): { g: Uint8Array; szog: number } {
  const pontok: number[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x += 3) if (g[y * w + x]! < kuszob) pontok.push(x, y);
  let legjobb = 0, szog = 0;
  for (let a = -3; a <= 3.0001; a += 0.05) {
    const t = Math.tan((a * Math.PI) / 180);
    const hist = new Float64Array(h + 2 * w);
    for (let i = 0; i < pontok.length; i += 2) { const yy = Math.round(pontok[i + 1]! - pontok[i]! * t) + w; if (yy >= 0 && yy < hist.length) hist[yy]!++; }
    let e = 0; for (const v of hist) e += v * v;
    if (e > legjobb) { legjobb = e; szog = a; }
  }
  if (Math.abs(szog) < 0.04) return { g, szog: 0 };
  const t = Math.tan((szog * Math.PI) / 180);
  const ki = new Uint8Array(w * h).fill(255);
  // nyírás (kis szögre elég): az x oszlop képpontjai x·tan(szög)-gel feljebb kerülnek
  for (let x = 0; x < w; x++) {
    const d = Math.round(x * t);
    for (let y = 0; y < h; y++) { const ys = y + d; if (ys >= 0 && ys < h) ki[y * w + x] = g[ys * w + x]!; }
  }
  return { g: ki, szog };
}

/** A tényezőtáblázat(ok): 7 függőleges vonal (település, rendszer, nren, ren, tot, CO₂) – egy táblázat a szkennelésben
 * több darabra is eshet; 5 vonal: régi (7/2006 TNM) űrlap. */
export function tenyezoTablak(r: Racs[]): { tablak: Racs[]; tnm: boolean } {
  // a szkennelésben szétesett táblázatdarabok (azonos oszlopvonalak, közeli sávok) összefűzése – a köztük lévő sáv is sor
  const tablak: Racs[] = [];
  for (const t of r.filter((q) => q.x.length === 7)) {
    const u = tablak.at(-1);
    const sorMag = u ? (u.y.at(-1)! - u.y[0]!) / Math.max(1, u.y.length - 1) : 0;
    if (u && u.x.every((x, i) => Math.abs(x - t.x[i]!) < 10) && t.y[0]! - u.y.at(-1)! < Math.max(3 * sorMag, 160)) u.y.push(...t.y);
    else tablak.push({ x: [...t.x], y: [...t.y] });
  }
  for (const t of tablak) {
    // közeli (≤ 12 px) vonalak összevonása; a hiányzó sorvonal miatt kétszeres magasságú sávok felosztása
    const y = t.y.sort((p, q) => p - q).filter((v, i, a) => i === 0 || v - a[i - 1]! > 12);
    const mag = y.slice(1).map((v, i) => v - y[i]!).slice(1).sort((p, q) => p - q);
    const med = mag.length ? mag[Math.floor(mag.length / 2)]! : 0;
    const uj: number[] = [y[0]!];
    for (let i = 1; i < y.length; i++) {
      const d = y[i]! - y[i - 1]!, k = med > 0 && i > 1 ? Math.round(d / med) : 1;
      for (let q = 1; q < k; q++) uj.push(y[i - 1]! + (d * q) / k);
      uj.push(y[i]!);
    }
    t.y = uj;
  }
  return { tablak, tnm: r.some((q) => q.x.length === 5 && q.y.length >= 3) };
}

/** OCR-szöveg → szám (tizedesvessző/pont; a rácsmaradvány-karakterek eldobva). */
export function ocrSzam(s: string): number | null {
  const t = s.replace(/[|\]\[)(}{!lI—–_-]/g, '').replace(/\s+/g, '').replace(/\.(?=\d{3}$)/, ',').replace(',', '.');
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : null;
}

type CellaOcr = (t: Racs, i: number, j: number, szam: boolean) => Promise<string>;

/** A táblázat(ok) adatsorai: legalább 3 szám, ebből legalább 2 tizedesjeggyel (a szkennelési foltok kiszűrése). */
export async function tablakOlvas(tablak: Racs[], cella: CellaOcr): Promise<TavhoPdfSor[]> {
  const sorok: TavhoPdfSor[] = [];
  for (const t of tablak) for (let i = 0; i < t.y.length - 1; i++) {
    const n: string[] = [];
    for (const j of [2, 3, 4, 5]) n.push(await cella(t, i, j, true));
    const v = n.map((x, q) => {
      const e = ocrSzam(x);
      // a tényezők (nren, ren, tot) 10 alattiak: elveszett tizedesvessző esetén az első számjegy után
      return e !== null && q < 3 && e >= 10 && /^\d{2,5}$/.test(x.trim()) ? Number(`${x.trim()[0]}.${x.trim().slice(1)}`) : e;
    });
    if (v.filter((x) => x !== null).length < 3 || n.filter((x) => /\d[,.]\d/.test(x)).length < 1 || n.filter((x) => /\d{2}/.test(x) || /\d[,.]\d/.test(x)).length < 2) continue;
    const telepules = (await cella(t, i, 0, false)).replace(/\s+/g, ' ').replace(/[|!]/g, '').trim();
    const rendszer = (await cella(t, i, 1, false)).replace(/\s+/g, ' ').replace(/[|!]/g, '').trim();
    const [fnren, fren, ftot, fCO2] = v as (number | null)[];
    const ellenorzott = tavhoSorRendben({ fnren: fnren ?? null, fren: fren ?? null, ftot: ftot ?? null, fCO2: fCO2 ?? null });
    sorok.push({ telepules, rendszer: rendszer || telepules, fnren: fnren ?? null, fren: fren ?? null, ftot: ftot ?? null, fCO2: fCO2 ?? null, ellenorzott });
  }
  return sorok;
}

// ---------------------------------------------------------------------------------------------
// Böngészős rész: pdf.js renderelés + Tesseract.js

import { tavhoSorRendben, type TavhoPdfEredmeny, type TavhoPdfSor } from './tavhoPdf';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TWorker = any;
let workerIgeret: Promise<TWorker> | null = null;
async function tesseract(): Promise<{ szoveg: TWorker; szam: TWorker }> {
  workerIgeret ??= (async () => {
    const { createWorker } = await import('tesseract.js');
    const opt = { langPath: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/hun@1.0.0/4.0.0_best_int', gzip: true };
    const szoveg = await createWorker('hun', 1, opt);
    const szam = await createWorker('hun', 1, opt);
    await szam.setParameters({ tessedit_char_whitelist: '0123456789,.', tessedit_pageseg_mode: '7' as never });
    await szoveg.setParameters({ tessedit_pageseg_mode: '7' as never });
    return { szoveg, szam };
  })();
  return workerIgeret;
}

/** A szkennelt PDF tényezőtáblázatának kiolvasása (cellánkénti OCR). */
export async function tavhoOcr(adat: ArrayBuffer, halad?: (s: string) => void): Promise<TavhoPdfEredmeny & { ocr: true; tnm?: boolean }> {
  const { pdfjsBetolt } = await import('./terv/elemzes');
  const pdfjs = await pdfjsBetolt();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(adat), verbosity: 0, isEvalSupported: false }).promise;
  const sorok: TavhoPdfSor[] = [];
  let tnm = false;
  for (let p = 1; p <= Math.min(doc.numPages, 3); p++) {
    halad?.(`lap ${p}/${doc.numPages} renderelése…`);
    const lap = await doc.getPage(p);
    const vp = lap.getViewport({ scale: 200 / 72 });
    const c = document.createElement('canvas'); c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    await lap.render({ canvasContext: ctx, viewport: vp }).promise;
    const id = ctx.getImageData(0, 0, c.width, c.height).data;
    const g = new Uint8Array(c.width * c.height);
    for (let i = 0; i < g.length; i++) g[i] = (id[i * 4]! * 0.3 + id[i * 4 + 1]! * 0.59 + id[i * 4 + 2]! * 0.11) | 0;
    const ke = kiegyenesit(g, c.width, c.height);
    if (ke.szog) { // a vásznat is kiegyenesítjük, hogy a kivágott cellák egyenesek legyenek
      const img = ctx.createImageData(c.width, c.height);
      for (let i = 0; i < ke.g.length; i++) { img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = ke.g[i]!; img.data[i * 4 + 3] = 255; }
      ctx.putImageData(img, 0, 0);
    }
    const { tablak, tnm: regi } = tenyezoTablak(racsKeres(ke.g, c.width, c.height));
    if (!tablak.length) { if (regi) tnm = true; continue; }
    halad?.('szövegfelismerés…');
    const ocr = await tesseract();
    sorok.push(...await tablakOlvas(tablak, async (t, i, j, szam) => {
      const xa = Math.round(t.x[j]! + 5), xb = Math.round(t.x[j + 1]! - 5), ya = Math.round(t.y[i]! + 5), yb = Math.round(t.y[i + 1]! - 5);
      if (xb - xa < 8 || yb - ya < 8) return '';
      const k = document.createElement('canvas'); k.width = (xb - xa) + 20; k.height = (yb - ya) + 20;
      const kc = k.getContext('2d')!; kc.fillStyle = '#fff'; kc.fillRect(0, 0, k.width, k.height);
      kc.drawImage(c, xa, ya, xb - xa, yb - ya, 10, 10, xb - xa, yb - ya);
      const r = await (szam ? ocr.szam : ocr.szoveg).recognize(k);
      return (r.data.text as string).trim();
    }));
  }
  return { adatEv: null, sorok, szkennelt: true, ocr: true, ...(tnm && !sorok.length ? { tnm: true } : {}) };
}
