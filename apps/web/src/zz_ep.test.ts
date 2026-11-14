import { it } from 'vitest';
import { readFileSync, writeFileSync } from 'fs';
import { lapKinyer } from '@terv/kinyeres';
import { alaprajzFeldolgoz, lapFeloszt } from '@terv/elemzes';
import { epuletModell, modellOsszeg } from '@terv/epulet';
it('ep', async () => {
  const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(process.env.F!)) }).promise;
  const oc = await doc.getOptionalContentConfig(); const l0: any = await lapKinyer(pdfjs, await doc.getPage(1), oc); const rs = lapFeloszt(l0);
  const a: any = alaprajzFeldolgoz((rs.length ? rs[0]! : { lap: l0 }).lap);
  const kat = new Map<number, any>(); a.magHelyisegek.forEach((h: any, ri: number) => { if (!h.kulter) kat.set(ri, 'futott'); });
  const adat = new Map<number, any>(); a.magHelyisegek.forEach((h: any, ri: number) => adat.set(ri, { kod: h.kod, nev: h.nev, A: h.A, burkolat: h.burkolat }));
  const bm = Number(process.env.BM ?? 2.7);
  const md = epuletModell([{ lap: 0, a, szintek: [{ id: 'F', nev: 'Földszint', kod: 'F', z0: 0, h: bm + 0.35, belmag: bm }], m: (x, y) => [x * a.e.mPerPt, y * a.e.mPerPt], kategoria: kat, adat }]);
  console.log('OSSZ', JSON.stringify(modellOsszeg(md)));
  console.log('DB', md.terek.length, md.falak.length, md.nyilasok.length, md.fodemek.length);
  const kulsoFut = md.falak.filter((f) => f.burok === 'kulso'); console.log('BUROKFAL hossz', kulsoFut.reduce((t, f) => t + f.hossz, 0).toFixed(1), 'x belmag', (kulsoFut.reduce((t, f) => t + f.hossz, 0) * bm).toFixed(1));
  writeFileSync(process.env.KI!, JSON.stringify(md));
}, 600000);
