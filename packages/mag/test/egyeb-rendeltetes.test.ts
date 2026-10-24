/**
 * Egyéb rendeltetés: profil (2. függ. 2.1.), szakaszos fűtés (2.5.), világítás (12.1), referenciaépület (5. melléklet),
 * követelmény = 0,8 · referencia (2. melléklet 2.3).
 */
import { describe, expect, it } from 'vitest';
import { epuletSzamitas, vilagitasRendszer, zonaHaviMerleg, profilok, type EpuletBemenet, type ZonaBemenet } from '../src/index.js';
import { epulet as tarjan } from './tarjan-modell.js';

const vil = { nev: 'v', A: 100, MV: 500, FH: 120, etaVil: 0.5, Ffe: 1, Fkihaszn: 0.2, szabalyozas: 'kezi' as const, tnappal: 2250, tejjel: 250, Fnappal: 0.55, vesz: false, standby: false };

describe('világítás (12.1–12.2)', () => {
  it('WV = Ffe·P·Fszab·(tn·Fn + té)/1000·A, P = MV/(FH·η)', () => {
    const r = vilagitasRendszer(vil);
    const P = 500 / (120 * 0.5);
    expect(r.reszletek.P).toBeCloseTo(P, 9);
    expect(r.reszletek.W).toBeCloseTo((P * 1 * (2250 * 0.55 + 250) / 1000) * 100, 6);
    expect(r.cel).toBe('vilagitas');
  });
  it('Fszab a 12.5. táblázatból, interpolálva', () => {
    expect(profilok.fszab('kezi', 0.3)).toBe(0.9);
    expect(profilok.fszab('auto_be_ki', 0.25)).toBeCloseTo(0.85, 9);
    expect(profilok.fszab('kezi_be_auto_ki', 0.2)).toBe(0.8);
  });
});

describe('profilok', () => {
  it('oktatás: júl.–aug. nincs használat, éves 2200 h', () => {
    const p = profilok.profil('osztalyterem')!;
    const h = profilok.haviHasznalatiOrak(p);
    expect(h[6]).toBe(0); expect(h[7]).toBe(0);
    expect(profilok.evesHasznalatiOra(p)).toBe(2200);
  });
  it('iroda: 2750 h/év', () => {
    expect(profilok.evesHasznalatiOra(profilok.profil('nagy_iroda')!)).toBeCloseTo(2750, 6);
  });
  it('σF egyéb rendeltetésnél (2.5.): programozható, τ < 24 h → 0,9', () => {
    expect(profilok.sigmaFEgyeb(true, 20)).toBe(0.9);
    expect(profilok.sigmaFEgyeb(true, 30)).toBe(0.95);
    expect(profilok.sigmaFEgyeb(false, 20)).toBe(1);
  });
  it('a szellőzés a használati időarányban (6.10)', () => {
    const z: ZonaBemenet = { nev: 'Z', AN: 100, V: 300, thetaF: 20, thetaH: 26, nSzuks: 2, nfilt: 0.06, qb: 8, CmEffFajl: 190, elemek: [], termSzellozesHavi: Array(12).fill(0.25) };
    expect(zonaHaviMerleg(z).havi[0]!.Hszell).toBeCloseTo(0.35 * (2 * 0.25 + 0.06) * 300, 9);
  });
});

describe('referenciaépület (5. melléklet) és követelmény', () => {
  const egyeb: EpuletBemenet = {
    ...tarjan, rendeltetes: 'egyeb',
    zonak: tarjan.zonak.map((z) => ({ ...z, rendeltetes: 'egyeb' as const, thetaF: 20, nSzuks: (6 * z.AN) / z.V, termSzellozesIdoarany: 2750 / 8760, qb: 8 })),
    vilagitas: [{ ...vil, A: tarjan.AN }],
  };
  const e = epuletSzamitas(egyeb);
  it('teljes referenciaépület, követelmény = 0,8 · Eref', () => {
    expect(e.referenciaEpulet.teljes).toBe(true);
    expect(e.referenciaEpulet.EnrenFajl).toBeGreaterThan(0);
    expect(e.kovetelmeny.kozelNulla.EnrenMax).toBeCloseTo(0.8 * e.referenciaEpulet.EnrenFajl, 9);
    expect(e.kovetelmeny.kozelNulla.ECO2Max).toBeCloseTo(0.8 * e.referenciaEpulet.ECO2Fajl, 9);
    expect(e.kovetelmeny.jelentosFelujitas.EnrenMax).toBeCloseTo(e.referenciaEpulet.EnrenFajl, 9);
  });
  it('a világítás beszámít, a referenciában kézi kapcsolású LED', () => {
    expect(e.indikatorok.celonkent.vilagitas.nren).toBeGreaterThan(0);
    expect(e.rendszerErtekeles.vilagitas?.szazalek).toBeCloseTo(100, 6); // azonos adatokkal (LED, kézi, parabola) 100%
  });
  it('lakóépületnél a világítás nem számít be', () => {
    const l = epuletSzamitas({ ...tarjan, vilagitas: [{ ...vil, A: tarjan.AN }] });
    expect(l.indikatorok.celonkent.vilagitas.nren).toBe(0);
    expect(l.figyelmeztetesek.some((f) => f.kod === 'VILAGITAS_LAKO')).toBe(true);
  });
  it('a referenciaépület határolóinak U-je a követelmény', () => {
    const rz = e.referenciaEpulet.zonak![0]!;
    expect(rz.QFnetEv).toBeGreaterThan(0);
  });
});
