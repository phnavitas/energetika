/**
 * WinWatt-összevetés – B szint: a szerkezettáblából (A, U*, Aü, g, gárny, tájolás) és a zónaadatokból
 * számolt H-értékek, szoláris nyereség és szellőzési tényező a WinWatt havi táblájához mérve.
 * Futtatás: npx tsx tools/winwatt/szintB.ts [minta-szűrő]
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { sugarzasiHozam, TAJOLASOK, HONAP_ORAK, type Tajolas } from '../../packages/mag/src/tablak/klima.js';
import { B_EJJEL } from '../../packages/mag/src/tablak/epuletfizika.js';

const DIR = join(import.meta.dirname, 'minta');
const n = (s: string) => (s === '-' ? null : Number(s.replace(',', '.')));
const TAJ: Record<string, Tajolas> = { 'É': 'É', 'ÉK': 'ÉK', 'K': 'K', 'DK': 'DK', 'D': 'D', 'DNY': 'DNy', 'DNy': 'DNy', 'NY': 'Ny', 'Ny': 'Ny', 'ÉNY': 'ÉNy', 'ÉNy': 'ÉNy' };

export interface Szerk { nev: string; taj: Tajolas | null; vizszintes: boolean; U: number | null; Ucs: number | null; A: number | null; L: number | null; AU: number | null; Au: number | null; g: number | null; garny: number | null; talaj: boolean; belso: boolean }

export function szerkezetSor(s: string): Szerk | null {
  const t = s.trim().split(/\s+/);
  // a számoszlopok a sor végén: U U* A Ψ L AU*+L Aü g gárny (a hiányzó „-”)
  let i = t.length; while (i > 0 && /^(-|-?\d+(,\d+)?)$/.test(t[i - 1]!)) i--;
  const sz = t.slice(i).map(n);
  if (sz.length < 6) return null;
  let elo = t.slice(0, i);
  let vizszintes = false;
  if (elo.length && /^(függőleges|vízszintes|\d+°?)$/.test(elo[elo.length - 1]!)) { vizszintes = elo[elo.length - 1] === 'vízszintes'; elo = elo.slice(0, -1); }
  let taj: Tajolas | null = null;
  if (elo.length && TAJ[elo[elo.length - 1]!]) { taj = TAJ[elo[elo.length - 1]!]!; elo = elo.slice(0, -1); }
  const nev = elo.join(' ');
  const [U, Ucs, A, , L, AU, Au, g, garny] = sz as (number | null)[];
  const talaj = /padló \(ta|padló talajon|talajon/i.test(nev);
  const belso = /belső fal|ajtó \(bels|fűtetlen/i.test(nev);
  if (/felülvilá|tető|padlásf|födém/i.test(nev) && !/fal/i.test(nev)) vizszintes = vizszintes || /felülvilá/i.test(nev);
  return { nev, taj, vizszintes, U: U ?? null, Ucs: Ucs ?? null, A: A ?? null, L: L ?? null, AU: AU ?? null, Au: Au ?? null, g: g ?? null, garny: garny ?? null, talaj, belso };
}

const qs = (sor: Szerk[], m: number, taj: (s: Szerk) => Tajolas | null, fH: (s: Szerk) => number) =>
  sor.reduce((a, s) => a + (s.Au && s.g ? (s.Au * 0.9 * s.g * fH(s) * sugarzasiHozam(s.vizszintes ? null : taj(s), s.vizszintes ? 0 : 90, m)) : 0), 0);

if (process.argv[1]?.endsWith('szintB.ts')) {
  const szuro = process.argv[2] ?? '';
  for (const f of readdirSync(DIR).filter((x) => x.endsWith('.json') && x.includes(szuro)).sort()) {
    const ww = JSON.parse(readFileSync(join(DIR, f), 'utf8'));
    const sorok: Szerk[] = (ww.szerkezetek as string[]).map(szerkezetSor).filter((x): x is Szerk => !!x);
    const zon = ww.zonak; const F = zon.havi.F1, H = zon.havi.H1;
    console.log(`\n=== ${f}  (${sorok.length} szerkezetsor, ${sorok.filter((s) => s.Au).length} üvegezett)`);
    if (!F) { console.log('  nincs havi tábla'); continue; }
    // H-tényezők: Σ AU*+L
    const kulso = sorok.filter((s) => !s.talaj && !s.belso), belso = sorok.filter((s) => s.belso), talaj = sorok.filter((s) => s.talaj);
    const sum = (l: Szerk[]) => l.reduce((a, s) => a + (s.AU ?? 0), 0);
    const Fz = zon.havi; const jelek = Object.keys(Fz).filter((k) => k.startsWith('F'));
    const W = (k: string) => jelek.reduce((a, j) => a + (Fz[j][0][k] ?? 0), 0);
    console.log(`  Htr,D  szerk. ${sum(kulso).toFixed(1)}  WW ${W('Htr,D').toFixed(1)}   Htr,x ${sum(belso).toFixed(1)} / ${W('Htr,x').toFixed(1)}   Htr,T ${sum(talaj).toFixed(1)} / ${W('Htr,T').toFixed(1)}`);
    // Qs: a hiányzó tájolású sorokhoz a legjobban illeszkedő égtáj
    const WQs = (pref: string, m: number) => Object.keys(Fz).filter((k) => k.startsWith(pref)).reduce((a, j) => a + (Fz[j][m]?.Qs ?? 0), 0);
    const nincsTaj = sorok.filter((s) => s.Au && !s.taj && !s.vizszintes);
    let becsult: Tajolas | null = null;
    const hiba = (tj: Tajolas | null, fF: number) => { let e = 0; for (let m = 0; m < 12; m++) { const q = qs(sorok, m, (s) => s.taj ?? tj, () => fF); e += (q - WQs('F', m)) ** 2; } return e; };
    if (nincsTaj.length) { becsult = TAJOLASOK.reduce((b, tj) => (hiba(tj, 1) < hiba(b, 1) ? tj : b), TAJOLASOK[0]!); console.log(`  ${nincsTaj.length} üvegezett sor tájolás nélkül → legjobban illeszkedő: ${becsult}`); }
    const tj = (s: Szerk) => s.taj ?? becsult;
    const sorF: string[] = [], sorH: string[] = [];
    for (let m = 0; m < 12; m++) {
      const qF = qs(sorok, m, tj, () => 1); const qH = qs(sorok, m, tj, (s) => s.garny ?? 1);
      sorF.push(`${(qF / WQs('F', m)).toFixed(3)}`); if (H) sorH.push(`${(qH / WQs('H', m)).toFixed(3)}`);
    }
    console.log(`  Qs fűtés  mi/WW havonta: ${sorF.join(' ')}`);
    if (H) console.log(`  Qs hűtés  mi/WW havonta: ${sorH.join(' ')}`);
    // szellőzés (csak egy zónás lakóépületnél egyszerű)
    const hz = zon.hasznalati[0], he = zon.hoegyensuly[0], sz = zon.szamitasi.find((x: { jel: string }) => x.jel === 'F1');
    if (hz && he && sz && hz.nSzuks !== null && jelek.length === 1) {
      const HF = 0.35 * (hz.nSzuks + he.nfilt) * sz.V;
      console.log(`  Hszell fűtés mi ${HF.toFixed(1)}  WW ${F[0].Hszell}`);
      if (H) {
        const mi = H.map((_: unknown, m: number) => HF + (m >= 4 && m <= 8 && he.nEjjel ? 0.35 * B_EJJEL * (7 / 24) * he.nEjjel * sz.V : 0));
        console.log(`  Hszell hűtés mi ${mi.map((x: number) => x.toFixed(0)).join(' ')}`);
        console.log(`               WW ${H.map((r: { Hszell: number }) => r.Hszell.toFixed(0)).join(' ')}`);
      }
    }
  }
}
