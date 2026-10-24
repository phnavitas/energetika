/**
 * Távhőszolgáltatói adatszolgáltatás (9/2023 ÉKM 8. §, Lechner-űrlap) PDF-jének kiolvasása oszlophelyesen:
 * a „f távhő nren / ren / tot / CO2” fejléc oszlopaihoz rendeljük a számokat, a sorneveket a „Településnév” és
 * „A távhőrendszer megnevezése” oszlop szerint. Ellenőrzés: nren + ren = tot (±0,005) és CO₂ a nren-hez illő
 * tartományban – ami ezen elbukik, „ellenőrizendő”. Szkennelt (szöveg nélküli) PDF-ből nem olvasható ki adat.
 */
export interface TavhoPdfTetel { szoveg: string; x: number; y: number; w: number; h: number }
export interface TavhoPdfSor { telepules: string; rendszer: string; fnren: number | null; fren: number | null; ftot: number | null; fCO2: number | null; ellenorzott: boolean; megjegyzes?: string }
export interface TavhoPdfEredmeny {
  adatEv: number | null; sorok: TavhoPdfSor[]; szkennelt: boolean;
  /** Az értékek forrása: a PDF szövege, kézi kiolvasás (szkennelt, beépített lista) vagy szövegfelismerés. */
  forras?: 'szoveg' | 'kezi' | 'ocr';
  /** Régi (7/2006 TNM) adatszolgáltatás – 9/2023 ÉKM szerinti tényező nincs. */
  elavult?: string;
}
/** nren + ren = tot (±0,005) és a CO₂ a nren-hez illő tartományban. */
export const tavhoSorRendben = (s: { fnren: number | null; fren: number | null; ftot: number | null; fCO2: number | null }) =>
  s.fnren !== null && s.fren !== null && s.ftot !== null && s.fCO2 !== null
  && Math.abs(s.fnren + s.fren - s.ftot) < 0.005 && s.fCO2 <= 450 * s.fnren + 50 && s.fCO2 >= 150 * s.fnren - 40;

const szamT = (s: string) => { const t = s.replace(/\s+/g, '').replace(',', '.'); return /^\d+(\.\d+)?$/.test(t) ? Number(t) : null; };
const tisztit = (s: string) => s.replace(/\s+/g, ' ').replace(/^[,\s]+|[,\s]+$/g, '');

export function tavhoPdfElemez(lapok: TavhoPdfTetel[][]): TavhoPdfEredmeny {
  const ossz = lapok.map((l) => l.map((i) => i.szoveg).join(' ')).join(' ');
  if (ossz.replace(/\s/g, '').length < 50) return { adatEv: null, sorok: [], szkennelt: true };
  const evm = ossz.replace(/(\d)\s+(?=\d)/g, '$1').match(/(20\d\d)\s*\.?\s*é\s*v\s*\w*\s+termelési/);
  const sorok: TavhoPdfSor[] = [];
  for (const lap of lapok) {
    const it = lap.filter((i) => i.szoveg.trim());
    const cx = (i: TavhoPdfTetel) => i.x + i.w / 2;
    const hN = it.find((i) => /nren/i.test(i.szoveg));
    if (!hN) continue;
    const kozel = (re: RegExp) => it.find((i) => re.test(i.szoveg) && Math.abs(i.y - hN.y) < 25);
    const hT = kozel(/tot\b/i), hC = kozel(/CO\s*2?$|CO2/i), hR = kozel(/(^|\s)ren\b/i);
    if (!hT || !hC) continue;
    const oszl = [cx(hN), hR ? cx(hR) : (cx(hN) + cx(hT)) / 2, cx(hT), cx(hC)];
    const hRendszer = it.find((i) => /megnevez/i.test(i.szoveg) && Math.abs(i.y - hN.y) < 40);
    const lab = it.filter((i) => /9\/2023|Kelt|Figyelem/.test(i.szoveg) && i.y < hN.y - 5).sort((a, b) => b.y - a.y)[0];
    const yAlj = lab ? lab.y : -Infinity;
    const bal = Math.min(...oszl) - (oszl[1]! - oszl[0]!) * 0.6;
    const sav: { y: number; it: TavhoPdfTetel[] }[] = [];
    for (const i of it.filter((x) => x.y < hN.y - 4 && x.y > yAlj + 2).sort((a, b) => b.y - a.y)) {
      const s = sav.find((r) => Math.abs(r.y - i.y) < Math.max(3, i.h * 0.6));
      if (s) s.it.push(i); else sav.push({ y: i.y, it: [i] });
    }
    const szamos: { y: number; vals: (number | null)[]; nev: TavhoPdfTetel[] }[] = [], nevek: { y: number; nev: TavhoPdfTetel[] }[] = [];
    for (const s of sav) {
      const cols: string[][] = [[], [], [], []], nev: TavhoPdfTetel[] = [];
      for (const i of s.it.sort((a, b) => a.x - b.x)) {
        if (cx(i) >= bal && /^[\d\s,.]+$/.test(i.szoveg)) {
          let k = 0, d = Infinity;
          oszl.forEach((c, j) => { const e = Math.abs(cx(i) - c); if (e < d) { d = e; k = j; } });
          cols[k]!.push(i.szoveg);
        } else nev.push(i);
      }
      const vals = cols.map((c) => (c.length ? szamT(c.join('')) : null));
      if (vals.filter((v) => v !== null).length >= 3) szamos.push({ y: s.y, vals, nev }); else if (nev.length) nevek.push({ y: s.y, nev });
    }
    // a több sorba tört nevek a legközelebbi számos sorhoz
    for (const n of nevek) {
      let b: typeof szamos[number] | null = null, d = Infinity;
      for (const s of szamos) { const e = Math.abs(s.y - n.y); if (e < d) { d = e; b = s; } }
      if (b && d < 40) b.nev.push(...n.nev);
    }
    for (const s of szamos) {
      const nv = s.nev.sort((a, b) => (b.y - a.y) || (a.x - b.x));
      const hat = hRendszer ? hRendszer.x - 5 : null;
      const telepules = tisztit(nv.filter((i) => hat !== null && i.x < hat).map((i) => i.szoveg).join(' '));
      const rendszer = tisztit(nv.filter((i) => hat === null || i.x >= hat).map((i) => i.szoveg).join(' '));
      let [fnren, fren, ftot, fCO2] = s.vals as [number | null, number | null, number | null, number | null];
      if (fren === null && fnren !== null && ftot !== null) fren = Math.round((ftot - fnren) * 1e4) / 1e4;
      const ellenorzott = fnren !== null && fren !== null && ftot !== null && fCO2 !== null
        && Math.abs(fnren + fren - ftot) < 0.005 && fCO2 <= 450 * fnren + 50 && fCO2 >= 150 * fnren - 40;
      sorok.push({ telepules, rendszer: rendszer || telepules, fnren, fren, ftot, fCO2, ellenorzott });
    }
  }
  return { adatEv: evm ? Number(evm[1]) : null, sorok, szkennelt: false };
}

/** A PDF szövegelemei laponként (pdf.js). */
export async function tavhoPdfOlvas(adat: ArrayBuffer): Promise<TavhoPdfEredmeny> {
  const { pdfjsBetolt } = await import('./terv/elemzes');
  const pdfjs = await pdfjsBetolt();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(adat), verbosity: 0, isEvalSupported: false }).promise;
  const lapok: TavhoPdfTetel[][] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const c = await (await doc.getPage(i)).getTextContent();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    lapok.push(c.items.filter((x: any) => 'str' in x).map((x: any) => ({ szoveg: x.str as string, x: x.transform[4] as number, y: x.transform[5] as number, w: x.width as number, h: (x.height as number) || Math.abs(x.transform[3] as number) })));
  }
  return tavhoPdfElemez(lapok);
}
