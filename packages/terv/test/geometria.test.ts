import { describe, expect, it } from 'vitest';
import { tetoHaromszogek, egyenesVazTeto, kifeleTol } from '../src/tetoModell';
import { poligonKulonbseg } from '../src/poligonKulonbseg';

type P2 = [number, number];
const forg = (p: P2[], fok: number): P2[] => p.map(([x, y]) => { const a = (fok * Math.PI) / 180; return [x * Math.cos(a) - y * Math.sin(a) + 50, x * Math.sin(a) + y * Math.cos(a) - 20]; });
const felulet = (h: [number, number, number][][]) => h.reduce((s, [a, b, c]) => {
  const u = [b![0] - a![0], b![1] - a![1], b![2] - a![2]], v = [c![0] - a![0], c![1] - a![1], c![2] - a![2]];
  return s + Math.hypot(u[1]! * v[2]! - u[2]! * v[1]!, u[2]! * v[0]! - u[0]! * v[2]!, u[0]! * v[1]! - u[1]! * v[0]!) / 2; }, 0);
const L: P2[] = [[0, 0], [12, 0], [12, 4], [5, 4], [5, 10], [0, 10]];

describe('magastető-geometria', () => {
  it('elforgatott derékszögű körvonal: ugyanaz a tető, mint tengelyirányban', () => {
    const a = tetoHaromszogek({ korvonal: L, hajlas: 30, kiallas: 0.5 })!, b = tetoHaromszogek({ korvonal: forg(L, 33), hajlas: 30, kiallas: 0.5 })!;
    expect(b.mod).toBe('derekszogu');
    expect(felulet(b.haromszogek)).toBeCloseTo(felulet(a.haromszogek), 6);
  });
  it('konvex, nem derékszögű körvonal: kontyolt tető az élsíkok alsó burkolójából', () => {
    const t = tetoHaromszogek({ korvonal: [[0, 0], [12, 0], [10, 6], [2, 6]], hajlas: 30, kiallas: 0 })!;
    expect(t.mod).toBe('konvex');
    // azonos hajlású síkok: felület = vetület / cos(hajlás)
    expect(felulet(t.haromszogek)).toBeCloseTo(60 / Math.cos(Math.PI / 6), 4);
  });
  it('nem konvex, ferde élű körvonal: egyenes váz, a vetület az ereszvonalon belüli terület', () => {
    const t = tetoHaromszogek({ korvonal: [[0, 0], [12, 0], [12, 4], [6, 4], [4, 6], [4, 10], [0, 10]], hajlas: 30, kiallas: 0 })!;
    expect(t.mod).toBe('vaz');
    expect(felulet(t.haromszogek)).toBeCloseTo(74 / Math.cos(Math.PI / 6), 4);
  });
  it('egyenes váz derékszögű körvonalon = a téglalapos módszer', () => {
    const a = tetoHaromszogek({ korvonal: L, hajlas: 30, kiallas: 0.5 })!, v = egyenesVazTeto(kifeleTol(L, 0.5), 30)!;
    // (azonos hajlás: felület = ereszvonalon belüli vetület / cos – a téglalapos háló átfedő darabokat is tartalmazhat)
    expect(felulet(v)).toBeCloseTo(101 / Math.cos(Math.PI / 6), 6);
    const zMax = (h: [number, number, number][][]) => Math.max(...h.flat().map((p) => p[2]!));
    expect(zMax(v)).toBeCloseTo(zMax(a.haromszogek), 6);
  });
});

describe('lapostető: szintkörvonalak különbsége', () => {
  it('terület, szabad szél és falcsatlakozás', () => {
    const k = poligonKulonbseg([[[0, 0], [10, 0], [10, 8], [0, 8]]], [[[0.04, -0.03], [6, 0.02], [6, 8.05], [0, 7.96]]]);
    expect(k.terulet).toBeCloseTo(32, 6); expect(k.szel).toBeCloseTo(16, 6); expect(k.csatl).toBeCloseTo(8, 6); expect(k.poligonok).toHaveLength(1);
  });
  it('lyukas eredmény két lyuk nélküli darabra bontva', () => {
    const k = poligonKulonbseg([[[0, 0], [10, 0], [10, 8], [0, 8]]], [[[3, 3], [6, 3], [6, 5], [3, 5]]]);
    expect(k.terulet).toBeCloseTo(74, 6); expect(k.csatl).toBeCloseTo(10, 6); expect(k.szel).toBeCloseTo(36, 6); expect(k.poligonok).toHaveLength(2);
  });
});
