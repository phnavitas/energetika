// Használat (apps/web-ből): npx tsx --tsconfig tsconfig.json ../../tools/illesztes/lapok.mts <mintamappa> <futás_epulet.json>
import { lapBe } from './lapbe.mts';
import { lapSzerep } from '../../packages/terv/src/elemzes.ts';
import { meretaranyKeres, eszakjelKeres } from '../../packages/terv/src/alaprajz.ts';
import { meretlancok } from '../../packages/terv/src/meretlanc.ts';
import { homlokzatCimek } from '../../packages/terv/src/homlokzat.ts';
import * as I from '../../packages/terv/src/illesztes.ts';
import * as fs from 'fs';
const [dir, ep] = process.argv.slice(2) as [string, string];
const e = JSON.parse(fs.readFileSync(ep, 'utf8'));
const T = (p: any) => Math.abs(p.reduce((s: number, q: any, i: number) => { const u = p[(i + 1) % p.length]; return s + q[0] * u[1] - u[0] * q[1]; }, 0)) / 2;
const fod = new Map<string, any[]>(); for (const q of e.fodemek) if (q.folott) fod.set(q.folott, [...(fod.get(q.folott) ?? []), ...q.poligonok]);
const konturNagy = [...fod.values()].sort((a, b) => b.reduce((s: number, p: any) => s + T(p), 0) - a.reduce((s: number, p: any) => s + T(p), 0))[0] ?? [];
const konturMind = [...fod.values()].flat();
const lapok: any[] = [];
for (const f of fs.readdirSync(dir).filter((x) => /\.pdf$/i.test(x)).sort()) { const lap = await lapBe(dir + '/' + f); const sz = /helysz/i.test(f) ? 'helysz' : lapSzerep(lap, f).szerep; const M = meretaranyKeres(lap.szovegek, lap.utvonalak); const mPt = 25.4 / 72 / 1000 * (M ?? 100); lapok.push({ f, lap, sz, M, mPt }); }
const alapok = lapok.filter((l) => l.sz === 'alaprajz'); if (!alapok.length) { console.log('nincs alaprajz'); process.exit(0); }
for (const l of lapok) { l.T = I.tengelyjelek(l.lap, l.mPt); l.L = meretlancok(l.lap, l.mPt).map((q) => ({ fg: q.fuggo, J: q.jelek.map((j) => j * l.mPt) })).filter((q) => q.J[q.J.length - 1]! - q.J[0]! >= 3); }
const ref = [...alapok].sort((a, b) => b.T.length - a.T.length)[0];
const refCs = [...new Set(ref.T.map((q: any) => q.csalad))] as string[];
let eszak: number | null = null; for (const a of alapok) { const ej = eszakjelKeres(a.lap); if (ej) { eszak = ej.szog; break; } }
const metszetBetuk = [...new Set(lapok.filter((l) => l.sz === 'metszet').flatMap((l) => l.lap.szovegek.map((t: any) => t.s.trim().match(/^([A-Z0-9]{1,2})\s*[-–]\s*\1\b/)?.[1]).filter(Boolean)))];
const ossz: Record<string, number> = { tengely: 0, lanc: 0, geometria: 0, szint: 0, nincs: 0 };
const ill = new Set<any>([ref]); const nincsL: any[] = [];
const sor: string[] = [];
for (const l of lapok) {
  if (l === ref || !['alaprajz', 'helysz', 'homlokzat', 'metszet'].includes(l.sz) && !/tet[őo]/i.test(l.f)) continue;
  // 1) tengely
  let t = 0; for (const g of I.tengelyCsoportok(l.T)) { if (refCs.some((c) => I.tengelyIllesztes(ref.T.filter((q: any) => q.csalad === c), g))) t++; }
  if (t) { ill.add(l); ossz.tengely!++; sor.push(`  ${l.sz.padEnd(9)} ${l.f.slice(0, 30).padEnd(30)} TENGELY (${t} csoport)`); continue; }
  // 2) lánc (belső jel is egyezik)
  let lc = 0; for (const q of l.L) { if (l.sz !== 'helysz' && l.sz !== 'alaprajz' && q.fg) continue; for (const a of alapok) if (a.L.some((r: any) => { const m = I.lancEgyezes(r.J, q.J); return m && m.db >= 1 && m.pont >= 0.99; })) { lc++; break; } }
  if (lc) { ill.add(l); ossz.lanc!++; sor.push(`  ${l.sz.padEnd(9)} ${l.f.slice(0, 30).padEnd(30)} LÁNC (${lc} lánc)`); continue; }
  // 3) geometria
  let g = '';
  if (l.sz === 'helysz') { const r = I.helyszinIllesztes(l.lap, konturNagy, l.mPt); if (r && r.talalat >= 0.95) g = `helyszín ${(r.talalat * 100).toFixed(0)}%`; }
  if (l.sz === 'homlokzat') { const r = I.homlokzatCimesIllesztes(l.lap, l.mPt, konturMind, eszak ?? 0, homlokzatCimek(l.lap)).filter((q) => q.sarok >= 0.95); if (r.length) g = `${r.length} feliratos nézet`; }
  if (l.sz === 'metszet' && process.env.METSZET_GEOM) { // (negatív kontroll szerint nem bizonyít – csak kísérletnek)
    const betuk = I.metszetJelek(l.lap).map((q) => q.jel);
    let db = 0;
    for (const a of alapok) { const LK = (e.lapok ?? []).find((q: any) => lapok[q.lap] === a); if (!LK) continue;
      for (const v of I.metszesVonalak(a.lap, [...new Set(betuk)], LK.mPerPt)) {
        const A = [v.a[0] * LK.mPerPt + LK.o[0], v.a[1] * LK.mPerPt + LK.o[1]] as [number, number], B = [v.b[0] * LK.mPerPt + LK.o[0], v.b[1] * LK.mPerPt + LK.o[1]] as [number, number];
        const t = I.metszesKontur(A, B, konturMind); if (t.length < 2) continue; const W = t[t.length - 1]! - t[0]!;
        for (const M of l.M ? [l.M] : [50, 100, 200]) { const mp = 25.4 / 72 / 1000 * M; if (I.homlokzatNezetek(l.lap, mp, true).some((n) => Math.abs((n.b - n.a) - W) / W <= 0.08)) { db++; break; } }
      } if (db) break; }
    if (db) g = `${db} metszésvonal szélességgel`;
    // falsík-minta: a metszésvonal mentén az alaprajzi falak síkjai a metszet függőlegesein (≥ 70 %)
    if (!g) for (const a of alapok) { const LK = (e.lapok ?? []).find((q: any) => lapok[q.lap] === a); if (!LK) continue;
      const falak = e.falak.filter((f: any) => !LK.szintek?.[0] || f.szint === LK.szintek[0]);
      for (const v of I.metszesVonalak(a.lap, [...new Set(betuk)], LK.mPerPt)) {
        const A = [v.a[0] * LK.mPerPt + LK.o[0], v.a[1] * LK.mPerPt + LK.o[1]], B = [v.b[0] * LK.mPerPt + LK.o[0], v.b[1] * LK.mPerPt + LK.o[1]];
        const Lc = Math.hypot(B[0]! - A[0]!, B[1]! - A[1]!), ux = (B[0]! - A[0]!) / Lc, uy = (B[1]! - A[1]!) / Lc; const sik: number[] = [];
        for (const f of falak) { const ex = f.b[0] - f.a[0], ey = f.b[1] - f.a[1]; const d = ux * ey - uy * ex; if (Math.abs(d) < 1e-9) continue;
          const s2 = ((f.a[0] - A[0]!) * ey - (f.a[1] - A[1]!) * ex) / d, r = ((f.a[0] - A[0]!) * uy - (f.a[1] - A[1]!) * ux) / d; if (r < 0 || r > 1) continue;
          const fel = (f.vastag ?? 0.3) / 2 / (Math.abs(d) / Math.hypot(ex, ey)); sik.push(s2 - fel, s2 + fel); }
        for (const M of l.M ? [l.M] : [50, 100]) { const r = I.falsikIllesztes(l.lap, 25.4 / 72 / 1000 * M, sik); if (r && r.db / r.N >= 0.7) { g = `falsík-minta ${r.db}/${r.N}${l.M ? '' : ` (1:${M})`}`; break; } }
        if (g) break; }
      if (g) break; }
  }
  if (g) { ill.add(l); ossz.geometria!++; sor.push(`  ${l.sz.padEnd(9)} ${l.f.slice(0, 30).padEnd(30)} GEOMETRIA (${g})`); continue; }
  nincsL.push(l);
}
// 4) szintjelek (metszet, homlokzat): ≥ 2 közös szint az alaprajzokkal, vagy ≥ 8 a már illesztett lapokkal
const alapSzint = alapok.flatMap((a) => I.szintjelek(a.lap).map((q) => q.z));
const nez = new Map<any, I.SzintNezet[]>(); for (const l of lapok) if (['metszet', 'homlokzat'].includes(l.sz)) nez.set(l, I.szintNezetek(l.lap, l.M));
for (let kor = 0; kor < 3; kor++) { let valt = false;
  for (const l of nincsL) { if (ill.has(l) || !nez.get(l)?.length) continue; const Z = nez.get(l)!.flatMap((n) => n.z);
    const kA = I.szintKozos(Z, alapSzint), kL = I.szintKozos(Z, [...ill].flatMap((q) => (nez.get(q) ?? []).flatMap((n) => n.z)));
    if (kA >= 2 || kL >= 8) { ill.add(l); l.szint = `${nez.get(l)!.length} nézet; ${kA} közös az alaprajzzal, ${kL} az illesztett lapokkal`; valt = true; } }
  if (!valt) break; }
for (const l of nincsL) { if (l.szint) { ossz.szint!++; sor.push(`  ${l.sz.padEnd(9)} ${l.f.slice(0, 30).padEnd(30)} SZINT (${l.szint})`); } else { ossz.nincs!++; sor.push(`  ${l.sz.padEnd(9)} ${l.f.slice(0, 30).padEnd(30)} –`); } }
console.log(dir.split('/').pop(), JSON.stringify(ossz)); console.log(sor.join('\n'));
