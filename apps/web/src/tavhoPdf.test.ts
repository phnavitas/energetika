/** Távhő-adatszolgáltatási PDF-ek oszlophelyes kiolvasása – valós e-építés PDF-ek szövegelemeivel (pdf.js kimenet). */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { tavhoPdfElemez, type TavhoPdfTetel } from './tavhoPdf';

const minta = JSON.parse(readFileSync(new URL('./terv/minta/tavho_pdf_tetelek.json', import.meta.url), 'utf8')) as Record<string, [string, number, number, number, number][][]>;
const lap = (id: string) => minta[id]!.map((l) => l.map(([szoveg, x, y, w, h]): TavhoPdfTetel => ({ szoveg, x, y, w, h })));

describe('távhő PDF', () => {
  it('Veolia: négy rendszer, több sorba tört településnév', () => {
    const e = tavhoPdfElemez(lap('971'));
    expect(e.adatEv).toBe(2025);
    expect(e.sorok.map((s) => [s.telepules, s.rendszer, s.fnren, s.fren, s.fCO2, s.ellenorzott])).toEqual([
      ['Zirc', 'Zirc Város Távfűtési rendszere', 1.38, 0, 374, true],
      ['Algyő', 'Algyő Városi Távhőrendszer', 1.38, 0, 374, true],
      ['Cegléd', 'Cegléd Városi Távhőrendszer', 1.039, 0.003, 279.413, true],
      ['Budapest, XV. Szilas parki lakótelep', 'Szilas parki lakótelep', 1.38, 0, 374, true],
    ]);
  });
  it('Kapuvár: számjegyenként tördelt számok', () => {
    const e = tavhoPdfElemez(lap('948'));
    expect(e.sorok).toHaveLength(4);
    expect(e.sorok[0]).toMatchObject({ telepules: 'Kapuvár', rendszer: 'Ifjúság úti rendszer', fnren: 1.37, fren: 0.004, ftot: 1.374, fCO2: 372.37, ellenorzott: true });
  });
  it('MVM OTSZ: tördelt CO₂ („394,” + „156”), több település', () => {
    const e = tavhoPdfElemez(lap('1024'));
    expect(e.adatEv).toBe(2024);
    expect(e.sorok.map((s) => [s.telepules, s.rendszer, s.fnren, s.fCO2, s.ellenorzott])).toEqual([
      ['Szolnok', 'Széchenyi körzet', 1.466, 394.156, true], ['Szolnok', 'József A. körzet', 1.516, 403.782, true],
      ['Szolnok', 'Móra F. körzet', 1.448, 386.659, true], ['Szolnok', 'TVM körzet', 1.467, 393.996, true],
      ['Oroszlány', 'Távfűtés', 1.36, 364.409, true], ['Bokod', 'Távfűtés', 1.34, 360.315, true],
    ]);
  });
  it('szkennelt (szöveg nélküli) PDF', () => {
    expect(tavhoPdfElemez([[{ szoveg: '1', x: 0, y: 0, w: 5, h: 10 }]]).szkennelt).toBe(true);
  });
});
