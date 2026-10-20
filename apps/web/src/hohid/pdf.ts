/**
 * Hőhíd-számítás dokumentálása PDF-ben: a jegyzőkönyv fejezete és önálló hőhíd-jegyzőkönyv (pdfmake).
 */
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import type { Projekt, HohidUI } from '../modell';
import { sablon, alapParameterek } from './katalogus';
import { hohidSzamol } from './projekt';
import { izotermRajz, geometriaRajz } from './rajz';

const f = (x: number, n = 3) => x.toLocaleString('hu-HU', { minimumFractionDigits: n, maximumFractionDigits: n });

/** Egy hőhíd tartalma: leírás, paraméterek, eredmények, geometria- és izotermás ábra. */
export function hohidTartalom(h: HohidUI, cim: (t: string) => Content): Content[] {
  const s = sablon(h.sablon); if (!s) return [];
  const sz = hohidSzamol(h, 0.012); if (!sz) return [];
  const cvG = document.createElement('canvas'); geometriaRajz(cvG, sz.csomopont.geometria, 520);
  const cvI = document.createElement('canvas'); izotermRajz(cvI, sz.csomopont.geometria, sz.mf, h.thetaI, h.thetaE, 640);
  const p = { ...alapParameterek(s), ...h.param };
  const e = sz.eredmeny;
  const psi = h.meretrendszer === 'kulso' ? e.psiE : e.psiI;
  return [
    cim(h.nev),
    { text: s.leiras, fontSize: 7.5, color: '#555', margin: [0, 0, 0, 4] },
    {
      columns: [
        { width: 230, stack: [
          { text: 'Paraméterek', bold: true, margin: [0, 0, 0, 2] },
          { table: { widths: ['*', 60], body: s.parameterek.map((q) => [{ text: q.nev, fontSize: 7 }, { text: `${q.egyseg === 'm' ? f(p[q.kulcs]! * 100, 1) + ' cm' : f(p[q.kulcs]!, 3) + ' ' + q.egyseg}`, fontSize: 7, alignment: 'right' }]) }, layout: 'lightHorizontalLines' },
          { text: `Peremfeltétel: θi = ${h.thetaI} °C, θe = ${h.thetaE} °C; Rsi = 0,13 (Ψ), 0,25 m²K/W (felületi hőmérséklet), Rse = 0,04 m²K/W.`, fontSize: 6.5, color: '#666', margin: [0, 4, 0, 0] },
        ] },
        { width: '*', stack: [{ image: cvG.toDataURL('image/png'), fit: [270, 200] }] },
      ], columnGap: 14, margin: [0, 0, 0, 6],
    },
    { image: cvI.toDataURL('image/png'), fit: [515, 330], margin: [0, 0, 0, 4] },
    ({
      table: { widths: ['*', 80], body: [
        [{ text: 'Kétdimenziós hőátbocsátási tényező, L2D', fontSize: 7.5 }, { text: `${f(e.L2D)} W/mK`, alignment: 'right', fontSize: 7.5 }],
        ...e.karimak.map((k) => [{ text: `${k.nev}: U = ${f(k.U)} W/m²K, l = ${f(h.meretrendszer === 'kulso' ? k.lKulso : k.lBelso, 2)} m`, fontSize: 7.5 }, { text: `${f(k.U * (h.meretrendszer === 'kulso' ? k.lKulso : k.lBelso))} W/mK`, alignment: 'right', fontSize: 7.5 }]),
        [{ text: `Vonalmenti hőátbocsátási tényező Ψ (${h.meretrendszer === 'kulso' ? 'külső' : 'belső'} méretrendszer)`, bold: true, fontSize: 8 }, { text: `${f(psi)} W/mK`, bold: true, alignment: 'right', fontSize: 8 }],
        [{ text: `Ψ a másik méretrendszerben (${h.meretrendszer === 'kulso' ? 'belső' : 'külső'})`, fontSize: 7.5 }, { text: `${f(h.meretrendszer === 'kulso' ? e.psiI : e.psiE)} W/mK`, alignment: 'right', fontSize: 7.5 }],
        [{ text: 'Legalacsonyabb belső felületi hőmérséklet θsi,min / fRsi', fontSize: 7.5 }, { text: `${f(e.thetaSiMin, 1)} °C / ${f(e.fRsi)}`, alignment: 'right', fontSize: 7.5 }],
        [{ text: 'Hossz a projektben, hőveszteség Ψ·l', fontSize: 7.5 }, { text: `${f(h.hossz, 2)} m · ${f(psi * h.hossz)} W/K`, alignment: 'right', fontSize: 7.5 }],
      ] }, layout: 'lightHorizontalLines', margin: [0, 0, 0, 4],
    } as unknown as Content),
    { text: 'Számítás: MSZ EN ISO 10211 szerinti kétdimenziós, állandósult hővezetés, véges térfogatos módszer (≤ 1,2 cm-es rács); Ψ = L2D − Σ Uj·lj. Az izotermás ábra az Rsi = 0,25 m²K/W-os (felületi páralecsapódás, penészedés vizsgálati) változatot mutatja.', fontSize: 6.5, color: '#666', margin: [0, 0, 0, 10] },
  ];
}

/** Önálló hőhíd-jegyzőkönyv. */
export async function hohidPdf(p: Projekt, hidak: HohidUI[]): Promise<Uint8Array> {
  const pdfMake = (await import('pdfmake/build/pdfmake')).default;
  pdfMake.vfs = (await import('pdfmake/build/vfs_fonts')).default as unknown as Record<string, string>;
  let n = 0;
  const cim = (t: string): Content => ({ text: `${++n}. ${t}`, fontSize: 11.5, bold: true, margin: [0, 10, 0, 4], headlineLevel: 1 } as Content);
  const tartalom: Content[] = [
    { text: 'Hőhíd-számítás (MSZ EN ISO 10211)', fontSize: 16, bold: true },
    { text: `${p.meta.nev || 'Projekt'}${p.meta.telepules ? ` – ${p.meta.telepules}` : ''}`, fontSize: 10, margin: [0, 2, 0, 2] },
    { text: [p.tanusito.nev, p.tanusito.jogosultsag, new Date().toLocaleDateString('hu-HU')].filter(Boolean).join(' · '), fontSize: 8, color: '#666', margin: [0, 0, 0, 8] },
    ...hidak.flatMap((h, i) => (i ? [{ text: '', pageBreak: 'before' } as Content] : []).concat(hohidTartalom(h, cim))),
  ];
  const dd: TDocumentDefinitions = { pageSize: 'A4', pageMargins: [40, 40, 40, 40], content: tartalom, defaultStyle: { font: 'Roboto', fontSize: 8 }, info: { title: `Hőhíd-számítás – ${p.meta.nev}` } };
  return new Promise((ok, hiba) => { try { pdfMake.createPdf(dd).getBuffer((b: Uint8Array) => ok(new Uint8Array(b))); } catch (err) { hiba(err); } });
}
