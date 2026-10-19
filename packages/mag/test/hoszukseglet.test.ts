/** Helyiségenkénti hőszükséglet – kézi számítással ellenőrzött eset. */
import { describe, expect, it } from 'vitest';
import { hoszukseglet as H } from '../src/index.js';

const alap: H.HszBemenet = { thetaE: -15, thetaME: 10.9, n50: 3, vedettseg: 'mersekelt', Gw: 1, helyisegek: [] };
const szoba: H.HelyisegHszBemenet = {
  id: 's', nev: 'Szoba', A: 15, V: 40, thetaInt: 20, nmin: 0.5, nyilasok: 'tobb',
  elemek: [
    { tipus: 'kulso', nev: 'fal', A: 10, U: 0.2 },
    { tipus: 'kulso', nev: 'ablak', A: 2, U: 0.8 },
    { tipus: 'futetlen', nev: 'padlás', A: 15, U: 0.15, bu: 0.9 },
    { tipus: 'talaj', nev: 'padló', A: 15, Uequiv: 0.2 },
    { tipus: 'szomszed', nev: 'fürdő', A: 8, U: 1.5, thetaSzomszed: 24 },
  ],
};

describe('MSZ EN 12831 szerinti helyiségenkénti hőszükséglet', () => {
  const r = H.helyisegHoszukseglet({ ...alap, helyisegek: [szoba] }).helyisegek[0]!;
  it('transzmisszió tagjai', () => {
    expect(r.HTie).toBeCloseTo(10 * 0.2 + 2 * 0.8, 9);
    expect(r.HTiue).toBeCloseTo(15 * 0.15 * 0.9, 9);
    expect(r.HTig).toBeCloseTo(1.45 * ((20 - 10.9) / 35) * 15 * 0.2, 9);
    expect(r.HTij).toBeCloseTo(((20 - 24) / 35) * 8 * 1.5, 9);
    expect(r.PhiT).toBeCloseTo((r.HTie + r.HTiue + r.HTig + r.HTij) * 35, 9);
  });
  it('szellőzés: V̇ = max(2·V·n50·e·ε, nmin·V)', () => {
    expect(r.Vinf).toBeCloseTo(2 * 40 * 3 * 0.03, 9);
    expect(r.Vszamitott).toBeCloseTo(Math.max(7.2, 20), 9);
    expect(r.PhiV).toBeCloseTo(0.34 * 20 * 35, 9);
  });
  it('hővisszanyerés: V̇inf + nmin·V·(1 − ηr)', () => {
    const h = H.helyisegHoszukseglet({ ...alap, hovisszanyeres: { etaR: 0.8 }, helyisegek: [szoba] }).helyisegek[0]!;
    expect(h.Vszamitott).toBeCloseTo(7.2 + 20 * 0.2, 9);
  });
  it('összegzés és fajlagos érték', () => {
    const e = H.helyisegHoszukseglet({ ...alap, helyisegek: [szoba, { ...szoba, id: 'b', fRH: 10 }] });
    expect(e.osszesen).toBeCloseTo(2 * r.PhiHL + 150, 9);
    expect(r.fajlagos).toBeCloseTo(r.PhiHL / 15, 9);
  });
});
