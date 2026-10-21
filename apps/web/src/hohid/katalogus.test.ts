/**
 * A hőhíd-katalógus validálása a svájci BFE Wärmebrückenkatalog (2002) táblázataival: külső méretrendszerű Ψe,
 * U_fal = 0,20 W/m²K (U_tető = 0,20), Backstein λ = 0,44, vasbeton λ = 2,3, hőszigetelés λ = 0,04 W/mK.
 * Tűrés: ± 0,04 W/mK (a katalógus rétegvastagságai, felületi ellenállásai nem minden esetben ismertek pontosan).
 */
import { describe, it, expect } from 'vitest';
import { sablon, alapParameterek } from './katalogus';
import { megold } from './szamito';

const Rsi = 0.13, Rse = 0.04, BS = 0.44, VB = 2.3;
function psiE(kod: string, p: Record<string, number>) {
  const s = sablon(kod)!; const c = s.epit({ ...alapParameterek(s), ...p });
  const m = megold(c.geometria, { thetaI: 20, thetaE: 0, Rsi, Rse }, 0.012);
  return m.L2D - c.karimak.reduce((a, k) => a + k.U * k.lKulso, 0);
}
const diKulso = (dw: number, lamW: number) => 0.04 * (1 / 0.2 - Rsi - Rse - dw / lamW - 0.015 / 0.8);
const diBelso = (dw: number, lamW: number) => 0.04 * (1 / 0.2 - Rsi - Rse - dw / lamW - 0.0125 / 0.25);
const dTeto = 0.04 * (1 / 0.2 - 0.17 - 0.2 / VB);
const fal = (dw: number, lamW: number, belso = false) => ({ dw, lamW, di: belso ? diBelso(dw, lamW) : diKulso(dw, lamW), lamI: 0.04, L: 1.5 });

const ESETEK: [string, string, Record<string, number>, number][] = [
  ['1.1-A1 erkélylemez átvezetve, Backstein', 'erkelylemez', { ...fal(0.175, BS), dS: 0.2, lamS: VB, Lb: 1.5, lamTB: 0 }, 0.75],
  ['1.1-A1 erkélylemez átvezetve, vasbeton', 'erkelylemez', { ...fal(0.18, VB), dS: 0.2, lamS: VB, Lb: 1.5, lamTB: 0 }, 0.92],
  ['3.1-A1 lapostető előtető és attika nélkül', 'lapos_teto_attika', { ...fal(0.175, BS), dF: 0.2, lamF: VB, dR: dTeto, lamR: 0.04, hAt: 0, dAt: 0, dTop: 0 }, -0.06],
  ['1.3-A5 attika vasbeton, 4 cm szigeteléssel', 'lapos_teto_attika', { ...fal(0.18, VB), dF: 0.2, lamF: VB, dR: dTeto, lamR: 0.04, hAt: 0.8, lamAt: VB, dAt: 0.04, dTop: 0.04 }, 0.26],
  ['1.3-A6 attika tégla, 4 cm szigeteléssel', 'lapos_teto_attika', { ...fal(0.175, BS), dF: 0.2, lamF: VB, dR: dTeto, lamR: 0.04, hAt: 0.8, lamAt: BS, dAt: 0.04, dTop: 0.04 }, 0.04],
  ['1.2-A1 előtető hőszigeteletlenül', 'lapos_teto_eloteto', { ...fal(0.175, BS), dF: 0.2, lamF: VB, dR: dTeto, lamR: 0.04, Lb: 1.0, dE: 0 }, 0.51],
  ['2.1-I1 födém, belső szigetelés, Backstein', 'fodem_belso_szig', { ...fal(0.175, BS, true), dS: 0.2, lamS: VB, dSt: 0 }, 0.68],
  ['2.1-I1 födém, belső szigetelés, vasbeton', 'fodem_belso_szig', { ...fal(0.18, VB, true), dS: 0.2, lamS: VB, dSt: 0 }, 0.78],
  ['2.1-I1 + 4 cm homlokzati födémszigetelés', 'fodem_belso_szig', { ...fal(0.175, BS, true), dS: 0.2, lamS: VB, dSt: 0.04 }, 0.48],
  ['2.3-I1 belső fal, belső szigetelés, Backstein', 't_belso_szig', { ...fal(0.175, BS, true), dI: 0.125, lamB: BS }, 0.13],
  ['2.3-I1 belső fal, belső szigetelés, vasbeton', 't_belso_szig', { ...fal(0.18, VB, true), dI: 0.125, lamB: BS }, 0.17],
];

describe('hőhíd-katalógus a BFE Wärmebrückenkatalog (2002) értékeihez', () => {
  for (const [nev, kod, p, vart] of ESETEK) it(`${nev}: Ψe ≈ ${vart}`, () => { expect(Math.abs(psiE(kod, p) - vart)).toBeLessThan(0.04); });
});
