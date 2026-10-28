import { it } from 'vitest';
import fs from 'fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { lapKinyer } from './kinyeres';
import { alaprajzFeldolgoz } from './elemzes';
it('f', async () => {
  const S = '/tmp/claude-0/-home-claude/d74a0257-ad71-59dc-93d5-73ac2faf1751/scratchpad/';
  for (const f of (process.env.F ?? 'et/06.pdf').split(',')) {
    const doc = await (pdfjs as any).getDocument({ data: new Uint8Array(fs.readFileSync(S + f)) }).promise;
    const lap = await lapKinyer(pdfjs, await doc.getPage(1));
    const al = alaprajzFeldolgoz(lap);
    console.log(f, 'FF', JSON.stringify(al.nyilasok.filter((n) => n.fajta === 'fuggonyfal').map((n) => [Math.round(n.x), Math.round(n.y), n.szel, n.irany, al.magHelyisegek[n.helyiseg!]?.nev])));
  }
}, 300000);
