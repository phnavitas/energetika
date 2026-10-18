/**
 * Gépi szellőzés (6.12, 10.17, 10.20) és napelem (13.1, 14.7) – kézzel ellenőrizhető esetek.
 */
import { describe, expect, it } from 'vitest';
import { zonaHaviMerleg, szellozesRendszer, indikatorok, epuletSzamitas, gepeszet, type ZonaBemenet } from '../src/index.js';
import { epulet as tarjan } from './tarjan-modell.js';

const zona: ZonaBemenet = {
  nev: 'Z', AN: 100, V: 266, thetaF: 20, thetaH: 26, nSzuks: 0.5, nfilt: 0.03, qb: 5, CmEffFajl: 190,
  elemek: [{ tipus: 'opak', nev: 'fal', A: 100, U: 0.2, chi: 0, hatar: { tipus: 'kulso' } }],
};

describe('gépi szellőzés hővisszanyeréssel (6.12)', () => {
  it('Hszell,F = 0,35·(VLT·(1−ηr) + nfilt·V)', () => {
    const e = zonaHaviMerleg({ ...zona, gepiSzellozes: { etaR: 0.8 } });
    expect(e.havi[0]!.Hszell).toBeCloseTo(0.35 * (0.5 * 266 * 0.2 + 0.03 * 266), 9);
  });
  it('hűtési módban a hővisszanyerés nem számít', () => {
    const a = zonaHaviMerleg(zona), b = zonaHaviMerleg({ ...zona, gepiSzellozes: { etaR: 0.8 } });
    expect(b.havi[6]!.Hszell_H).toBeCloseTo(a.havi[6]!.Hszell_H, 9);
  });
  it('részleges üzemidő: a kikapcsolt időben természetes szellőzés (6.13–6.14)', () => {
    const e = zonaHaviMerleg({ ...zona, gepiSzellozes: { etaR: 0.8, uzemArany: 0.5 } });
    expect(e.havi[0]!.Hszell).toBeCloseTo(0.35 * (0.5 * 266 * (0.5 * 0.2 + 0.5) + 0.03 * 266), 9);
  });
  it('csökkenti a nettó fűtési igényt', () => {
    expect(zonaHaviMerleg({ ...zona, gepiSzellozes: { etaR: 0.8 } }).QFnetEv).toBeLessThan(zonaHaviMerleg(zona).QFnetEv);
  });
});

describe('ventilátor villamos energia', () => {
  it('ErP: W = V·MISC·SPI·t / CTRL^x (10.17)', () => {
    const r = szellozesRendszer({ nev: 's', V: 133, uzemora: 8760, ventilator: { mod: 'erp', SPI: 0.00035, misc: 'legcsatornas', ctrl: 'kozponti_igeny', x: 'fokozatmentes' } });
    expect(r.reszletek.Wvent).toBeCloseTo((133 * 1.1 * 0.00035 * 8760) / 1.5 ** 2, 6);
    expect(r.cel).toBe('szellozes');
  });
  it('nyomásesés: W = V·Δp/(3600·η)·t/1000 (10.20), η a 10.8. táblázatból', () => {
    const r = szellozesRendszer({ nev: 's', V: 133, uzemora: 8760, ventilator: { mod: 'nyomas', dp: 200, etaVent: null } });
    expect(r.reszletek.Wvent).toBeCloseTo(((133 * 200) / (3600 * 0.4)) * 8760 / 1000, 6);
  });
});

describe('napelem (13.1, 14.7)', () => {
  it('13.1. táblázat interpolációja', () => {
    expect(gepeszet.napelemTermeles(1, 'D', 30)).toBe(1080);
    expect(gepeszet.napelemTermeles(2, 'DK_DNy', 35)).toBeCloseTo(2 * 1025, 9);
    expect(gepeszet.napelemTermeles(1, 'K_Ny', 90)).toBe(527);
  });
  it('export súlyozása: Wexp·(fexp − fterm)', () => {
    const i = indikatorok([], 100, 0, 1000);
    expect(i.celonkent.export.nren).toBeCloseTo(1000 * 2.3, 9);
    expect(i.celonkent.export.ren).toBeCloseTo(1000 * (0.3 - 1), 9);
    expect(i.osszes.nren).toBeCloseTo(-2300, 9);
    expect(i.fajlagos.ECO2Fajl).toBeCloseTo(-(1000 * (455 - 74)) / 1000 / 100, 9);
  });
  it('a tarjáni épületen 3 kWp déli 30°: Enren csökkenése 3·1080·2,3/AN', () => {
    const b = tarjan;
    const alap = epuletSzamitas(b).indikatorok.fajlagos.EnrenFajl;
    const pv = epuletSzamitas({ ...b, napelem: [{ nev: 'PV', kWp: 3, tajolas: 'D', hajlasszog: 30 }] });
    expect(alap - pv.indikatorok.fajlagos.EnrenFajl).toBeCloseTo((3 * 1080 * 2.3) / b.AN, 6);
    expect(pv.napelem[0]!.W).toBe(3240);
  });
});

describe('napkollektor (9.5, 9.7)', () => {
  it('táblázati sarokpont és k = 0,821 + … (9.7)', () => {
    const r = gepeszet.kollektorTermeles('sik', 4, 100, 45, 0);
    const i = gepeszet.KOLLEKTOR_FELULET.indexOf(4), j = gepeszet.KOLLEKTOR_A_RENDSZER.indexOf(100);
    expect(r.Qmax).toBe(gepeszet.KOLLEKTOR_SIK[i]![j]);
    expect(r.k).toBeCloseTo(-1.17e-4 * 45 ** 2 + 9.11e-3 * 45 + 0.821, 9);
  });
});
