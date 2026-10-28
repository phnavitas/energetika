import { it } from 'vitest';
import fs from 'fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { lapKinyer } from './kinyeres';
it('l', async () => {
  const S = '/tmp/claude-0/-home-claude/d74a0257-ad71-59dc-93d5-73ac2faf1751/scratchpad/';
  const doc = await (pdfjs as any).getDocument({ data: new Uint8Array(fs.readFileSync(S + 'et/06.pdf')) }).promise;
  const lap = await lapKinyer(pdfjs, await doc.getPage(1));
  for (const u of lap.utvonalak) {
    const b = u.bbox; if (b[0] > 1685 && b[2] < 1712 && b[1] > 1090 && b[3] < 1215 && b[3] - b[1] > 20) console.log(u.muvelet, b.map((x) => x.toFixed(1)).join(','), u.vastagsag.toFixed(2), u.vonalSzin, u.toltoSzin, u.pontok.map((p) => p.length).join('/'));
  }
}, 100000);
