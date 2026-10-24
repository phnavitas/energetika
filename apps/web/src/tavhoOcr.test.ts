/** Szkennelt táblázat rácsfelismerése (szintetikus képpel) és az OCR-számértelmezés. */
import { describe, expect, it } from 'vitest';
import { racsKeres, kiegyenesit, tenyezoTablak, ocrSzam } from './tavhoOcr';

/** 7 oszlopvonalas, 5 sorvonalas táblázat (fejléc + 3 sor), enyhén ferdén, szaggatott vonalakkal. */
function kep(ferde = 0) {
  const w = 1600, h = 1200, g = new Uint8Array(w * h).fill(255);
  const xs = [100, 300, 900, 1050, 1200, 1350, 1500], ys = [400, 490, 540, 590, 640];
  const pont = (x: number, y: number) => { const yy = Math.round(y + x * ferde); if (yy >= 0 && yy < h && x >= 0 && x < w) g[yy * w + x] = 0; };
  for (const y of ys) for (let x = 100; x <= 1500; x++) if (x % 37 !== 0) { pont(x, y); pont(x, y + 1); }
  for (const x of xs) for (let y = 400; y <= 640; y++) { pont(x, y); pont(x + 1, y); }
  return { g, w, h };
}

describe('szkennelt táblázat', () => {
  it('egyenes rács: 7 × 5 vonal', () => {
    const { g, w, h } = kep();
    const r = racsKeres(g, w, h);
    const t = tenyezoTablak(r).tablak;
    expect(t).toHaveLength(1);
    expect(t[0]!.x.map((x, i) => Math.abs(x - [100, 300, 900, 1050, 1200, 1350, 1500][i]!) <= 1.5)).toEqual(Array(7).fill(true));
    expect(t[0]!.y).toHaveLength(5);
  });
  it('ferde szkennelés kiegyenesítése (0,3°)', () => {
    const { g, w, h } = kep(Math.tan((0.3 * Math.PI) / 180));
    const k = kiegyenesit(g, w, h);
    expect(Math.abs(k.szog - 0.3)).toBeLessThan(0.06);
    expect(tenyezoTablak(racsKeres(k.g, w, h)).tablak[0]?.y).toHaveLength(5);
  });
  it('OCR-szám: tizedesvessző, rácsmaradvány', () => {
    expect(ocrSzam('1,483]')).toBe(1.483);
    expect(ocrSzam('| 0,004')).toBe(0.004);
    expect(ocrSzam('397,229')).toBe(397.229);
    expect(ocrSzam('')).toBeNull();
  });
});
