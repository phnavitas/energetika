import { describe, it, expect } from 'vitest';
import type { Lap, Szoveg, Utvonal } from './kinyeres';
import { alaprajzElemez, egtaj, eszakjelKeres, pecsetek, jegyzekSorok, szovegJavit } from './alaprajz';
import { raszterEpit } from './raszter';
import { nyilasFeliratok, nyilasokHozzarendel } from './nyilaszarok';
import { retegrendBlokkok, szerepBecsles, retegekEpit, szintekKeres } from './metszet';

const M = 100; // 1:100
const mPerPt = (25.4 / 72) / 1000 * M;
const pt = (m: number) => m / mPerPt;
const t = (s: string, x: number, y: number, meret = 9, szog = 0): Szoveg => ({ s, x, y, meret, szog, szel: s.length * meret * 0.5 });
const teglalap = (x0: number, y0: number, x1: number, y1: number, toltoSzin = '#c0c0c0'): Utvonal => ({
  pontok: [[x0, y0, x1, y0, x1, y1, x0, y1, x0, y0]], zart: [true], muvelet: 'fill', vastagsag: 0, vonalSzin: '#000000', toltoSzin, bbox: [x0, y0, x1, y1],
});
const vonal = (x0: number, y0: number, x1: number, y1: number): Utvonal => ({ pontok: [[x0, y0, x1, y1]], zart: [false], muvelet: 'stroke', vastagsag: 0.25, vonalSzin: '#000000', toltoSzin: '#000000', bbox: [Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1)] });

/** Egy 4 × 3 m-es (belméret) helyiség 0,4 m-es falakkal, a felső falban 1,2 m-es ablakkal, a lap közepén. */
function mintaLap(): Lap {
  const ox = 300, oy = 300, v = pt(0.4), W = pt(4), H = pt(3), ab0 = ox + v + pt(1.4), ab1 = ab0 + pt(1.2);
  const ut: Utvonal[] = [
    teglalap(ox, oy, ab0, oy + v), teglalap(ab1, oy, ox + 2 * v + W, oy + v), // felső fal, ablaknyílással
    teglalap(ox, oy + v + H, ox + 2 * v + W, oy + 2 * v + H), // alsó
    teglalap(ox, oy + v, ox + v, oy + v + H), teglalap(ox + v + W, oy + v, ox + 2 * v + W, oy + v + H), // oldalak
    vonal(ab0, oy + v * 0.4, ab1, oy + v * 0.4), vonal(ab0, oy + v * 0.6, ab1, oy + v * 0.6), // tok, üvegezés
  ];
  const cx = ox + v + W / 2, cy = oy + v + H / 2;
  const sz: Szoveg[] = [
    t('M=1:100', 100, 100, 16),
    t('1.01', cx - 9, cy - 18), t('SZOBA', cx - 12, cy - 9), t('laminált parketta', cx - 38, cy), t('12,00 m²', cx - 18, cy + 9),
    // nyílásfelirat a fal fölött: szélesség / magasság, „pm 90” a belső oldalon
    // (a vízszintes falnál a feliratok 90°-kal elforgatva, egymás mellett: a „felső” sor a nagyobb x felé esik)
    t('120', (ab0 + ab1) / 2 + 2, oy - 22, 7.8, -90), t('150', (ab0 + ab1) / 2 - 10, oy - 22, 7.8, -90), t('pm 90', (ab0 + ab1) / 2 - 11, oy + v + 8, 7.8),
  ];
  return { szel: 1200, mag: 900, szovegek: sz, utvonalak: ut };
}

describe('tervbeolvasás – alaprajz', () => {
  it('ligatúrák javítása', () => {
    expect(szovegJavit('lam.parkeƩa')).toBe('lam.parketta');
    expect(szovegJavit('staƟka')).toBe('statika');
  });

  it('helyiségpecsét és helyiségjegyzék', () => {
    const lap = mintaLap();
    const p = pecsetek(lap.szovegek);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ kod: '1.01', nev: 'Szoba', burkolat: 'laminált parketta', A: 12 });
    const j = jegyzekSorok([t('L01.', 10, 50), t('03', 30, 50), t('konyha', 50, 50), t('kerámia', 120, 50), t('7,05', 200, 50), t('100,30 m²', 200, 70)]);
    expect(j).toHaveLength(1);
    expect(j[0]).toMatchObject({ kod: 'L01.03', nev: 'konyha', burkolat: 'kerámia', A: 7.05, egyseg: 'L01' });
    const e = alaprajzElemez(lap);
    expect(e.meretarany).toBe(100);
  });

  it('külső fal hossza a nettó belső méretből, ablak a falnyíláshoz rendelve', () => {
    const lap = mintaLap();
    const e = alaprajzElemez(lap);
    const r = raszterEpit(lap, e.mPerPt!, e.helyisegek);
    const H = r.helyisegek[0]!;
    expect(H.szivarog).toBe(false);
    expect(H.A).toBeGreaterThan(11.5); expect(H.A).toBeLessThan(12.5);
    const kulso = (ir: number) => H.szakaszok.filter((s) => s.tul === 'kulso' && s.irany === ir).reduce((a, s) => a + s.hossz, 0);
    expect(kulso(0)).toBeCloseTo(4, 0); expect(kulso(180)).toBeCloseTo(4, 0);
    expect(kulso(90)).toBeCloseTo(3, 0); expect(kulso(270)).toBeCloseTo(3, 0);
    const f = nyilasFeliratok(lap.szovegek);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ szel: 1.2, mag: 1.5, pm: 0.9 });
    const ny = nyilasokHozzarendel(f, r);
    expect(ny[0]).toMatchObject({ helyiseg: 0, irany: 0, kulso: true, fajta: 'ablak' });
  });

  it('északjel „É” betűvel és égtáj-átszámítás', () => {
    const lap: Lap = { szel: 600, mag: 600, szovegek: [t('É', 300, 240, 10)], utvonalak: [{ ...teglalap(290, 250, 310, 300, '#000000'), pontok: [[300, 250, 310, 300, 290, 300, 300, 250]] }] };
    const e = eszakjelKeres(lap)!;
    expect(e.forras).toBe('betu');
    expect(Math.abs(((e.szog + 180) % 360) - 180)).toBeLessThan(15);
    expect(egtaj(0, 0)).toBe('É'); expect(egtaj(90, 0)).toBe('K'); expect(egtaj(0, 315)).toBe('ÉK'); expect(egtaj(180, 315)).toBe('DNy');
  });
});

describe('tervbeolvasás – metszet', () => {
  const sor = (y: number, v: string, l: string) => [t(v, 93, y), t(l, 124, y)];
  const sz: Szoveg[] = [
    t('F01', 94, 100, 10), t('KÜLSŐ FAL RÉTEGREND', 124, 100, 10),
    ...sor(111, '1 cm', 'belső cementvakolat'), ...sor(120, '30 cm', 'vázkerámia falazat'), ...sor(129, '15 cm', 'EPS80 hőszigetelő vakolatrendszer'), ...sor(138, '1 rtg.', 'külső nemesvakolat'),
    t('P03', 303, 100, 10), t('PADLÁSFÖDÉM RÉTEGREND', 333, 100, 10),
    t('1 rtg.', 302, 111), t('páraáteresztő védőfólia', 333, 111), t('30 cm', 302, 120), t('kőzetgyapot hőszigetelés,', 333, 120), t('szeglemezes tetőszerkezet', 333, 129),
    t('1 rtg.', 302, 138), t('tűzgátló gipszkarton', 333, 138), t('3 rtg.', 302, 147), t('festés', 333, 147),
    t('±0,00', 411, 307, 7.8), t('+2,66', 411, 238, 7.8), t('+3,05', 411, 220, 7.8), t('+5,77', 411, 143, 7.8),
    t('-0,05', 643, 308, 7.8), t('+2,84', 643, 226, 7.8), t('+5,77', 643, 143, 7.8),
  ];
  it('rétegrend-blokkok, szerep, katalógusanyag', () => {
    const b = retegrendBlokkok(sz);
    expect(b.map((x) => x.kod)).toEqual(['F01', 'P03']);
    const f01 = b[0]!; const s = szerepBecsles(f01, b);
    expect(s.szerep).toBe('fal');
    const r = retegekEpit(f01, s, () => 'x');
    expect(r.map((x) => x.anyagId)).toEqual(['cement_vakolat', 'vazkeramia_30', 'eps80_feher', 'nemesvakolat']);
    expect(r.map((x) => x.dCm)).toEqual([1, 30, 15, 0.3]);
    const p03 = b[1]!; const s3 = szerepBecsles(p03, b);
    expect(s3.szerep).toBe('padlas');
    const r3 = retegekEpit(p03, s3, () => 'x');
    // belülről kifelé: festés (kimarad), gipszkarton, hőszigetelés (a folytatósor összevonva), fólia
    expect(r3[0]!.kimarad).toBeTruthy();
    expect(r3[1]!.anyagId).toBe('gipszkarton_rb');
    expect(r3[2]!.forras).toContain('szeglemezes tetőszerkezet');
    expect(r3[2]!.megjegyzes).toBeTruthy();
  });
  it('szintszám és belmagasság a szintjelekből (a gerinc nem födém)', () => {
    const s = szintekKeres(sz);
    expect(s.szintszam).toBe(1);
    expect(s.belmagassag).toEqual([2.66]);
    expect(s.terepszint).toBe(-0.05);
  });
});
