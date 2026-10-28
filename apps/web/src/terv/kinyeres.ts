/**
 * PDF tervlap nyers tartalmának kinyerése pdf.js-szel: szövegelemek és vektoros útvonalak oldal-koordinátában
 * (pont, bal felső origó, y lefelé). A pdf.js névteret paraméterként kapja, így böngészőben és Node-ban is fut.
 */
export interface Szoveg { s: string; x: number; y: number; meret: number; szog: number; szel: number }
export interface Utvonal { pontok: number[][]; zart: boolean[]; muvelet: 'stroke' | 'fill' | 'fillStroke' | 'none'; vastagsag: number; vonalSzin: string; toltoSzin: string; bbox: [number, number, number, number];
  /** Mintázattal (tiling pattern) kitöltött felület. */
  minta?: boolean }
export interface Lap { szel: number; mag: number; szovegek: Szoveg[]; utvonalak: Utvonal[] }

type M = [number, number, number, number, number, number];
const szoroz = (a: M, b: M): M => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
const alkalmaz = (m: M, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

const szin = (a: unknown): string => {
  if (typeof a === 'string') return a;
  if (Array.isArray(a) && typeof a[0] === 'string') return a[0];
  if (Array.isArray(a) || ArrayBuffer.isView(a)) { const v = Array.from(a as ArrayLike<number>); return '#' + v.slice(0, 3).map((x) => Math.round(x <= 1 && v.every((y) => y <= 1) ? x * 255 : x).toString(16).padStart(2, '0')).join(''); }
  return '#000000';
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function lapKinyer(pdfjs: any, page: any): Promise<Lap> {
  const vp = page.getViewport({ scale: 1 });
  const alap: M = vp.transform as M; // PDF → nézet (y lefelé)
  const tc = await page.getTextContent();
  const szovegek: Szoveg[] = [];
  for (const it of tc.items as { str: string; transform: number[]; width: number }[]) {
    if (!it.str || !it.str.trim()) continue;
    const t = it.transform as M;
    const [x, y] = alkalmaz(alap, t[4], t[5]);
    const meret = Math.hypot(t[2], t[3]);
    szovegek.push({ s: it.str, x, y, meret, szog: Math.atan2(t[1], t[0]) * 180 / Math.PI, szel: it.width });
  }
  const ol = await page.getOperatorList();
  const O = pdfjs.OPS;
  const utvonalak: Utvonal[] = [];
  let ctm: M = alap;
  const verem: { ctm: M; lw: number; vs: string; ts: string; minta: boolean }[] = [];
  let lw = 1, vs = '#000000', ts = '#000000', minta = false;
  const formVerem: M[] = [];
  for (let i = 0; i < ol.fnArray.length; i++) {
    const fn = ol.fnArray[i], a = ol.argsArray[i];
    switch (fn) {
      case O.save: verem.push({ ctm, lw, vs, ts, minta }); break;
      case O.restore: { const s = verem.pop(); if (s) ({ ctm, lw, vs, ts, minta } = s); break; }
      case O.transform: ctm = szoroz(ctm, a as M); break;
      case O.paintFormXObjectBegin: formVerem.push(ctm); if (a?.[0]) ctm = szoroz(ctm, a[0] as M); break;
      case O.paintFormXObjectEnd: ctm = formVerem.pop() ?? ctm; break;
      case O.setLineWidth: lw = a[0]; break;
      case O.setStrokeRGBColor: case O.setStrokeColor: vs = szin(a); break;
      case O.setFillRGBColor: case O.setFillColor: ts = szin(a); minta = false; break;
      case O.setStrokeGray: vs = szin([a[0], a[0], a[0]]); break;
      case O.setFillGray: ts = szin([a[0], a[0], a[0]]); minta = false; break;
      // mintázattal (tiling pattern) kitöltött felület – jellemzően sraffozott falmetszet; a mintázat vonalszíne adja a színt
      case O.setFillColorN: {
        if (Array.isArray(a) && a[0] === 'TilingPattern') {
          const belso = a[2] as { fnArray?: number[]; argsArray?: unknown[] } | undefined;
          const k = belso?.fnArray?.findIndex((f) => f === O.setStrokeRGBColor || f === O.setStrokeColor || f === O.setFillRGBColor) ?? -1;
          const c = k >= 0 ? szin(belso!.argsArray![k]) : '#808080';
          // a mintázat nem egybefüggő kitöltés: a nagyon világos vonalszín is „színes” falmetszetnek számít
          ts = /^#(f[0-9a-f]){3}$/i.test(c) ? '#d0d0d0' : c; minta = true;
        } else { ts = szin(a); minta = false; }
        break;
      }
      case O.constructPath: {
        const [rajz, [buf]] = a as [number, [ArrayLike<number> | null]];
        if (!buf) break;
        const pontok: number[][] = []; const zart: boolean[] = [];
        let akt: number[] = [];
        let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
        const add = (x: number, y: number) => { const [px, py] = alkalmaz(ctm, x, y); akt.push(px, py); minx = Math.min(minx, px); maxx = Math.max(maxx, px); miny = Math.min(miny, py); maxy = Math.max(maxy, py); };
        const lezar = (z: boolean) => { if (akt.length >= 4) { pontok.push(akt); zart.push(z); } akt = []; };
        for (let j = 0; j < buf.length;) {
          const op = buf[j++];
          if (op === 0) { lezar(false); add(buf[j]!, buf[j + 1]!); j += 2; }
          else if (op === 1) { add(buf[j]!, buf[j + 1]!); j += 2; }
          else if (op === 2) { add(buf[j + 4]!, buf[j + 5]!); j += 6; }
          else if (op === 3) { add(buf[j + 2]!, buf[j + 3]!); j += 4; }
          else if (op === 4) { lezar(true); }
          else break;
        }
        lezar(false);
        const muvelet = rajz === O.stroke || rajz === O.closeStroke ? 'stroke' : rajz === O.fill || rajz === O.eoFill ? 'fill' : rajz === O.fillStroke || rajz === O.eoFillStroke || rajz === O.closeFillStroke || rajz === O.closeEOFillStroke ? 'fillStroke' : 'none';
        if (muvelet === 'none' || !pontok.length) break;
        const sk = Math.sqrt(Math.abs(ctm[0] * ctm[3] - ctm[1] * ctm[2]));
        utvonalak.push({ pontok, zart, muvelet, vastagsag: lw * sk, vonalSzin: vs, toltoSzin: ts, bbox: [minx, miny, maxx, maxy], ...(minta && muvelet !== 'stroke' ? { minta: true } : {}) });
        break;
      }
    }
  }
  return { szel: vp.width, mag: vp.height, szovegek, utvonalak };
}
