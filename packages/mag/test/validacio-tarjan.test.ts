/**
 * Validáció: Kétlakásos lakóépület, Tarján (1. lakás), WinWatt fecske 9.54 (2026. 2. 5.) jegyzőkönyv, 2026.05.22.
 * A bemenő adatok a jegyzőkönyvből származnak. A jegyzőkönyv négy ablaknál nem közli a tájolást, ezért a havi
 * direkt szoláris nyereséget (Qs) a jegyzőkönyv 6. oldaláról vesszük át – a többi lépést a mag maga számolja.
 */
import { describe, it, expect } from 'vitest';
import { nyilaszaroU, nyilaszaroArnyekoloval, zonaHaviMerleg, epuletSzamitas, futesiRendszer, hmvRendszer, indikatorok } from '../src/index.js';
import { WW_QS, WW_QFNET, WW_QVESZT, fal, padlas, padlo, ablakTipus, zona, szab, epulet } from './tarjan-modell.js';

describe('Tarján – határoló szerkezetek (1. függ. 4. fejezet)', () => {
  it('homlokzati fal rétegtervi U = 0,176, eredő (χ = 0,30) = 0,229', () => {
    expect(fal.U).toBeCloseTo(0.176, 3);
    expect(fal.U * 1.3).toBeCloseTo(0.229, 3);
  });
  it('padlásfödém rétegtervi U = 0,136, eredő (χ = 0,10) = 0,150', () => {
    expect(padlas.U).toBeCloseTo(0.136, 3);
    expect(padlas.U * 1.1).toBeCloseTo(0.150, 3);
  });
  it('talajon fekvő padló UT,p = 0,157 (4.23 + 4.32 + 4.33)', () => {
    expect(padlo.UTp).toBeCloseTo(0.157, 3);
  });
  it('ablak 1,5×1,5 m U = 0,81 (4.16), árnyékolóval fűtésre 0,788 (4.18)', () => {
    expect(nyilaszaroU(ablakTipus)).toBeCloseTo(0.81, 2);
    expect(nyilaszaroArnyekoloval(0.81, 0.12)).toBeCloseTo(0.78847, 4);
  });
});

describe('Tarján – havi energiamérleg (1. függ. 6. fejezet)', () => {
  const e = zonaHaviMerleg(zona, { QsdFelulbiralas: WW_QS });
  it('hőátviteli tényezők: Htr,D 40,1 · Htr,x 13,6 · Htr,T 19,6 · Hszell 49,6 W/K', () => {
    const jan = e.havi[0]!;
    expect(jan.HtrD).toBeCloseTo(40.1, 1);
    expect(jan.HtrX).toBeCloseTo(13.6, 1);
    expect(jan.HtrT).toBeCloseTo(19.6, 1);
    expect(jan.Hszell).toBeCloseTo(49.6, 1);
    expect(jan.tau).toBeCloseTo(42.5, 1);
  });
  it('havi veszteség és nettó fűtési igény a jegyzőkönyv szerint (okt–ápr)', () => {
    for (const m of [0, 1, 2, 3, 9, 10, 11]) {
      expect(Math.abs(e.havi[m]!.Qveszt - WW_QVESZT[m]!)).toBeLessThan(3);
      expect(Math.abs(e.havi[m]!.QFnet - WW_QFNET[m]!)).toBeLessThan(3);
    }
  });
  it('éves QF,net = 4027 kWh, qF,net = 40,07 kWh/m²a', () => {
    expect(e.QFnetEv).toBeGreaterThan(4027 * 0.995);
    expect(e.QFnetEv).toBeLessThan(4027 * 1.005);
    expect(e.qFnet).toBeCloseTo(40.07, 0);
  });
  it('fajlagos hőveszteség-tényező q = 0,136 W/m³K (6.53)', () => {
    expect(e.q).toBeCloseTo(0.136, 3);
  });
});

describe('Tarján – teljes épület, indikátorok, besorolás', () => {
  // Validációs futás: a WinWatt havi Qs-ével. Mellette a saját szoláris számítás (feltételezett tájolásokkal) – tájékoztató.
  const e = epuletSzamitas(epulet, { QsdFelulbiralas: { F1: WW_QS } });
  const sajat = epuletSzamitas(epulet);
  const QFnetWW = e.zonak[0]!.QFnetEv;

  it('εF,szab = 1,012 (8.11–8.12)', () => {
    expect(szab.epszilon).toBeCloseTo(1.012, 3);
  });
  it('saját szoláris számítással (feltételezett tájolások) a nettó igény nagyságrendileg egyezik (< 10%)', () => {
    expect(Math.abs(sajat.zonak[0]!.QFnetEv / QFnetWW - 1)).toBeLessThan(0.1);
  });

  it('fűtés és HMV indikátorok a WinWatt Qs-ével: Enren 51,04 · ECO2 11,61', () => {
    // a fűtési rendszert a WinWatt-Qs-szel kapott nettó igényre újraszámoljuk
    const f = futesiRendszer(epulet.futes[0]!, QFnetWW, 100.5);
    const h = hmvRendszer(epulet.hmv[0]!);
    const ind = indikatorok([f, h], 100.5);
    expect(f.reszletek.QSzall).toBeCloseTo(0.70 * 100.5, 0);
    expect(f.reszletek.wSziv).toBeCloseTo(3.51, 2);
    expect(ind.celonkent.futes.nren / 100.5).toBeCloseTo(31.79, 1);
    expect(ind.celonkent.hmv.nren / 100.5).toBeCloseTo(19.25, 1);
    expect(ind.fajlagos.EnrenFajl).toBeCloseTo(51.04, 1);
    expect(ind.fajlagos.ECO2Fajl).toBeCloseTo(11.61, 1);
    expect(ind.megujulo.halozatiVillamos).toBeCloseTo(22.19, 1);
    expect(ind.megujulo.kornyezetiHo).toBeCloseTo(56.04, 1);
    expect(ind.megujulo.aktivMegujulo).toBeCloseTo(62.70, 1);
    expect(ind.megujulo.tavolbanTermelt).toBeCloseTo(6.66, 1);
    expect(h.reszletek.tarArany).toBeCloseTo(0.239, 3);
    expect(h.reszletek.szallArany).toBeCloseTo(0.10, 3);
  });

  it('követelmények: közel nulla 76 / 20 / 0,33 · jelentős felújítás 143,08 / 0,46', () => {
    expect(e.kovetelmeny.kozelNulla.EnrenMax).toBe(76);
    expect(e.kovetelmeny.kozelNulla.ECO2Max).toBe(20);
    expect(e.kovetelmeny.kozelNulla.qmMax).toBeCloseTo(0.33, 2);
    expect(e.kovetelmeny.jelentosFelujitas.EnrenMax).toBeCloseTo(143.08, 1);
    expect(e.kovetelmeny.jelentosFelujitas.qmMax).toBeCloseTo(0.46, 2);
  });

  it('besorolás: A+ (≈ 67%) és CO₂ A+ (≈ 58%)', () => {
    expect(e.besorolas.energetikai).toBe('A+');
    expect(e.besorolas.CO2).toBe('A+');
    expect(e.besorolas.energetikaiSzazalek).toBeGreaterThan(64);
    expect(e.besorolas.energetikaiSzazalek).toBeLessThan(70);
  });

  it('rendszerértékelés: referencia fűtés 5563,2 · HMV 4731,2 kWh/a, mindkettő „kiváló”', () => {
    const f = e.rendszerErtekeles.futes!;
    const h = e.rendszerErtekeles.hmv!;
    expect(Math.abs(f.EnrenRef - 5563.2) / 5563.2).toBeLessThan(0.003);
    expect(Math.abs(h.EnrenRef - 4731.2) / 4731.2).toBeLessThan(0.002);
    expect(f.minosites).toBe('kivalo');
    expect(h.minosites).toBe('kivalo');
  });

  it('szerkezetminősítés az XML szerint: fal Good, padlás Good, padló Excellent, ablak 0,77 Excellent', () => {
    const m = Object.fromEntries(e.szerkezetek.map((s) => [s.nev, s.minosites]));
    expect(m['F01 Homlokzati fal']).toBe('jo');
    expect(m['P03 Padlásfödém']).toBe('jo');
    expect(m['P01 Padló']).toBe('kivalo');
    expect(m['Ablak 1']).toBe('kivalo');
    expect(m['Ablak 2']).toBe('jo');
    expect(m['Bejárati ajtó']).toBe('jo');
    expect(e.szerkezetek.every((s) => s.megfelel !== false)).toBe(true);
  });
});
