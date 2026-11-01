/**
 * A WinWatt szerkezettáblájából hiányzó ablakadatok pótlása a havi Qs-táblához illesztve:
 *  – tájolás nélküli sorok égtája (egy közös csoportként),
 *  – tetősík-/felülvilágító ablakok dőlése (0/30/45/60°),
 *  – külső árnyékolás: egy közös F (fűtés) – ha 1-hez közeli és a havi hiba kicsi, a Gs-táblánk és a 6.27 képlet egyezik.
 * Futtatás: npx tsx tools/winwatt/ablakIllesztes.ts
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sugarzasiHozam, TAJOLASOK, type Tajolas } from '../../packages/mag/src/tablak/klima.js';
import { szerkezetSor, type Szerk } from './szintB.js';

const DIR = join(import.meta.dirname, 'minta');
type Dolt = 0 | 30 | 45 | 60 | 90;
const tetoAblak = (s: Szerk) => /tetősík|tetőablak|velux|felülvil|bevilágító|kupola/i.test(s.nev);

function qsHavi(sorok: Szerk[], taj: (s: Szerk) => Tajolas, dolt: (s: Szerk) => Dolt, f: (s: Szerk) => number): number[] {
  return Array.from({ length: 12 }, (_, m) => sorok.reduce((a, s) => {
    if (!s.Au || !s.g) return a;
    const d = dolt(s);
    return a + s.Au * 0.9 * s.g * f(s) * sugarzasiHozam(d === 0 ? null : taj(s), d === 0 ? 0 : d, m);
  }, 0));
}
const relHiba = (mi: number[], ww: number[]) => Math.sqrt(mi.reduce((a, x, m) => a + ((x - ww[m]!) / ww[m]!) ** 2, 0) / 12);
const skala = (mi: number[], ww: number[]) => ww.reduce((a, x, m) => a + x * mi[m]!, 0) / mi.reduce((a, x) => a + x * x, 0);

const eredmenyek: Record<string, unknown> = {};
for (const f of readdirSync(DIR).filter((x) => x.endsWith('.json')).sort()) {
  const ww = JSON.parse(readFileSync(join(DIR, f), 'utf8'));
  const Fz = ww.zonak.havi as Record<string, { Qs: number }[]>;
  const fJelek = Object.keys(Fz).filter((k) => k.startsWith('F'));
  if (!fJelek.length) continue;
  const wwQs = Array.from({ length: 12 }, (_, m) => fJelek.reduce((a, j) => a + (Fz[j]![m]?.Qs ?? 0), 0));
  const sorok = (ww.szerkezetek as string[]).map(szerkezetSor).filter((x): x is Szerk => !!x && !!x.Au && !!x.g);
  const nincsTaj = sorok.filter((s) => !s.taj && !s.vizszintes);
  const teto = sorok.filter(tetoAblak);
  let leg = { hiba: Infinity, tj: 'É' as Tajolas, d: 90 as Dolt, F: 1, mi: [] as number[] };
  for (const tj of nincsTaj.length ? TAJOLASOK : (['É'] as Tajolas[])) {
    for (const d of (teto.length ? [0, 30, 45, 60] : [90]) as Dolt[]) {
      const mi = qsHavi(sorok, (s) => s.taj ?? tj, (s) => (tetoAblak(s) ? d : s.vizszintes ? 0 : 90), () => 1);
      const F = skala(mi, wwQs);
      const h = relHiba(mi.map((x) => x * F), wwQs);
      if (h < leg.hiba) leg = { hiba: h, tj, d, F, mi };
    }
  }
  const h1 = relHiba(leg.mi, wwQs);
  console.log(`${f.padEnd(24)} üvegezett sor ${String(sorok.length).padStart(2)} · ${nincsTaj.length ? `${nincsTaj.length} tájolás nélküli → ${leg.tj}` : 'tájolás mind megvan'} · ${teto.length ? `${teto.length} tetőablak → ${leg.d}°` : 'tetőablak nincs'} · F=1: havi hiba ${(h1 * 100).toFixed(1)}% · illesztett F ${leg.F.toFixed(3)}: ${(leg.hiba * 100).toFixed(1)}%`);
  console.log(`${''.padEnd(24)} havi mi/WW (F=1): ${leg.mi.map((x, m) => (x / wwQs[m]!).toFixed(2)).join(' ')}`);
  eredmenyek[f] = { hianyzoTajolas: nincsTaj.length ? leg.tj : null, tetoablakDoles: teto.length ? leg.d : null, arnyekolasF: Number(leg.F.toFixed(3)), haviHibaF1: h1, haviHiba: leg.hiba };
}
writeFileSync(join(import.meta.dirname, 'ablak-potlas.json'), JSON.stringify(eredmenyek, null, 1));
