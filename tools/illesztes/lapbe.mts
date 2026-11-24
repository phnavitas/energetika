import * as pdfjs from '../../apps/web/node_modules/pdfjs-dist/legacy/build/pdf.mjs';
import * as fs from 'fs';
import { lapKinyer } from '../../packages/terv/src/kinyeres.ts';
import { pdfZonakNyers } from '../../packages/terv/src/zonak.ts';
export async function lapBe(f: string, n = 1): Promise<any> {
  const bajt = new Uint8Array(fs.readFileSync(f));
  const zn = (await pdfZonakNyers(bajt.slice())).get(n - 1);
  const doc = await (pdfjs as any).getDocument({ data: bajt, verbosity: 0 }).promise;
  const page = await doc.getPage(n);
  const lap: any = await lapKinyer(pdfjs, page, await doc.getOptionalContentConfig());
  const vpz = page.getViewport({ scale: 1 });
  if (zn) lap.zonak = zn.map((z) => ({ nev: z.nev, pontok: z.pdf.map(([x, y]) => vpz.convertToViewportPoint(x, y)) }));
  return lap;
}
