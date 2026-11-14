/**
 * ArchiCAD-ből exportált PDF helyiségzónái: a lapszótár `/BSISpaces` tömbje `/Type /Space` elemekből áll, mindegyikben
 * a zóna neve (`/Title`, pl. „F09 Közlekedő”) és körvonala (`/Path`, PDF-koordinátában). A zóna a modell helyisége: a
 * fal belső síkjáig tart (ferde falnál is), az ajtóbéllet külön darab azonos névvel. A pdf.js ezt a kulcsot nem adja
 * ki, ezért a pdf-lib olvassa (a tömörített objektumfolyamokban lévőt is).
 */
export interface Zona {
  /** A zóna neve (szám + név, pl. „12 nappali”). */
  nev: string;
  /** Körvonal lapkoordinátában (pt, bal felső origó, y lefelé): [x, y] pontok. */
  pontok: [number, number][];
}

/** A PDF oldalanként (0-tól) a zónák PDF-koordinátában; üres térkép, ha a PDF-ben nincs zóna vagy nem olvasható. */
export async function pdfZonakNyers(adat: Uint8Array): Promise<Map<number, { nev: string; pdf: [number, number][] }[]>> {
  const ki = new Map<number, { nev: string; pdf: [number, number][] }[]>();
  // gyors előszűrés: a kulcs neve a nyers bájtok közt (a lapszótár nincs objektumfolyamban tömörítve) – ha nincs, nem töltjük be
  if (!tartalmaz(adat, 'BSISpaces')) return ki;
  try {
    const { PDFDocument, PDFName, PDFArray, PDFDict, PDFNumber, PDFString, PDFHexString } = await import('pdf-lib');
    const doc = await PDFDocument.load(adat, { ignoreEncryption: true, updateMetadata: false, throwOnInvalidObject: false });
    const szoveg = (o: unknown): string => (o instanceof PDFString || o instanceof PDFHexString ? o.decodeText() : '');
    doc.getPages().forEach((p, i) => {
      const t = p.node.lookup(PDFName.of('BSISpaces'));
      if (!(t instanceof PDFArray)) return;
      const l: { nev: string; pdf: [number, number][] }[] = [];
      for (let k = 0; k < t.size(); k++) {
        const z = t.lookup(k);
        if (!(z instanceof PDFDict)) continue;
        const ut = z.lookup(PDFName.of('Path'));
        if (!(ut instanceof PDFArray)) continue;
        const pontok: [number, number][] = [];
        for (let j = 0; j < ut.size(); j++) {
          const q = ut.lookup(j);
          if (q instanceof PDFArray && q.size() >= 2) {
            const x = q.lookup(0), y = q.lookup(1);
            if (x instanceof PDFNumber && y instanceof PDFNumber) pontok.push([x.asNumber(), y.asNumber()]);
          }
        }
        if (pontok.length >= 3) l.push({ nev: szoveg(z.lookup(PDFName.of('Title'))).trim(), pdf: pontok });
      }
      if (l.length) ki.set(i, l);
    });
  } catch { /* nem olvasható PDF-szerkezet: zóna nélkül */ }
  return ki;
}

function tartalmaz(a: Uint8Array, s: string): boolean {
  const b = Array.from(s, (c) => c.charCodeAt(0));
  outer: for (let i = 0; i + b.length <= a.length; i++) { for (let j = 0; j < b.length; j++) if (a[i + j] !== b[j]) continue outer; return true; }
  return false;
}

/** Sokszög előjeles területe (pt²). */
export function poliTer(p: [number, number][]): number {
  let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i]!, b = p[(i + 1) % p.length]!; s += a[0] * b[1] - b[0] * a[1]; }
  return s / 2;
}

/** Pont a sokszögben (páros-páratlan szabály). */
export function poliBenne(p: [number, number][], x: number, y: number): boolean {
  let b = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i]!, [xj, yj] = p[j]!;
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) b = !b;
  }
  return b;
}

/** A zóna egy biztosan belső pontja: a súlypont, ha bent van; különben a legszélesebb vízszintes metszet közepe. */
export function belsoPont(p: [number, number][]): [number, number] {
  const A = poliTer(p); let cx = 0, cy = 0;
  for (let i = 0; i < p.length; i++) { const a = p[i]!, b = p[(i + 1) % p.length]!; const f = a[0] * b[1] - b[0] * a[1]; cx += (a[0] + b[0]) * f; cy += (a[1] + b[1]) * f; }
  if (Math.abs(A) > 1e-9) { cx /= 6 * A; cy /= 6 * A; if (poliBenne(p, cx, cy)) return [cx, cy]; }
  const ys = p.map((q) => q[1]); const y0 = Math.min(...ys), y1 = Math.max(...ys);
  let leg: [number, number] = p[0]!, lsz = -1;
  for (let k = 1; k < 20; k++) {
    const y = y0 + (y1 - y0) * k / 20; const xs: number[] = [];
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, yi] = p[i]!, [xj, yj] = p[j]!; if ((yi > y) !== (yj > y)) xs.push(((xj - xi) * (y - yi)) / (yj - yi) + xi); }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) if (xs[i + 1]! - xs[i]! > lsz) { lsz = xs[i + 1]! - xs[i]!; leg = [(xs[i]! + xs[i + 1]!) / 2, y]; }
  }
  return leg;
}

/** A zónák egy lap részletére (lapFeloszt): amelyek belső pontja a részhez tartozik. */
export function zonakSzur(l: Zona[] | undefined, benne: (x: number, y: number) => boolean): Zona[] | undefined {
  if (!l?.length) return undefined;
  const r = l.filter((z) => { const [x, y] = belsoPont(z.pontok); return benne(x, y); });
  return r.length ? r : undefined;
}

