/**
 * WinWatt-összevetés – A szint: a zóna havi energiamérlege a WinWatt saját köztes értékeivel
 * (Htr,D, Htr,x, Htr,T, Hszell, Qs havonta, Cm, qb, θ). Ha itt eltérés van, az a 6. fejezet
 * mérlegképleteiben (σ, τ, a, η, QF,net, QH,net) van, nem a bemenetekben.
 * Futtatás: npx tsx tools/winwatt/szintA.ts [minta-szűrő]
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { zonaHaviMerleg, type ZonaBemenet } from '../../packages/mag/src/energiamerleg.js';
import { KULSO_HOMERSEKLET_HAVI } from '../../packages/mag/src/tablak/klima.js';

// WW_TE=1: a WinWatt által használt havi külső hőmérséklet (aug. 20,9, szept. 17,7 °C a rendelet 21,0 / 17,8 helyett)
if (process.env.WW_TE) { const t = KULSO_HOMERSEKLET_HAVI as number[]; t[7] = 20.9; t[8] = 17.7; }

type Sor = Record<string, number | null>;
interface WW {
  zonak: {
    hasznalati: { nev: string; A: number; thetaF: number; thetaH: number; nSzuks: number | null; VLTA: number | null; tnap: number; napEv: number; qb: number }[];
    hoegyensuly: { A: number | null; CmFajl: number | null; nfilt: number | null; nEjjel: number | null; futesProg: boolean; hutesKikapcs: boolean }[];
    szamitasi: { jel: string; tipus: string; te: number; A: number; V: number; CmFajl: number; Qnet: number | null }[];
    havi: Record<string, Sor[]>;
  };
}

const DIR = join(import.meta.dirname, 'minta');
const szuro = process.argv[2] ?? '';
const v = (x: number | null | undefined) => x ?? 0;

export interface Elteres { minta: string; zona: string; honap: number; tetel: string; ww: number; mi: number }

export function szintA(nev: string, ww: WW): { elteresek: Elteres[]; osszeg: string[] } {
  const el: Elteres[] = []; const osszeg: string[] = [];
  const z = ww.zonak;
  for (const sz of z.szamitasi.filter((x) => x.tipus === 'fűtés')) {
    const F = z.havi[sz.jel]; if (!F?.length) continue;
    const hJel = sz.jel.replace('F', 'H');
    const H = z.havi[hJel];
    const hz = z.hasznalati.find((h) => Math.abs(h.A - sz.A) < 0.2) ?? z.hasznalati[0]!;
    const he = z.hoegyensuly[0];
    const egyeb = hz.nSzuks === null;
    const zb: ZonaBemenet = {
      nev: sz.jel, AN: sz.A, V: sz.V, thetaF: sz.te, thetaH: z.szamitasi.find((x) => x.jel === hJel)?.te ?? hz.thetaH,
      nSzuks: 0.5, nfilt: 0, qb: hz.qb, CmEffFajl: sz.CmFajl, hutott: !!H, futesProgramozhato: (he?.futesProg ?? false) || (F[0]!['σ'] ?? 1) < 1,
      ...(egyeb ? { rendeltetes: 'egyeb' as const } : {}),
      elemek: [
        // Htr,D fűtésben és hűtésben (társított szerkezet miatt eltérhet): UFutes a fűtési, U a hűtési érték
        { tipus: 'nyilaszaro', nev: 'HtrD', A: 1, U: v(H?.[0]?.['Htr,D'] ?? F[0]!['Htr,D']), UFutes: v(F[0]!['Htr,D']), hatar: { tipus: 'kulso' }, tajolas: 'D', hajlasszog: 90, Au: 0, gn: 0 },
        { tipus: 'opak', nev: 'HtrX', A: v(F[0]!['Htr,x']), U: 1, chi: 0, hatar: { tipus: 'futetlen_b', bTel: 1, bNyar: 1 } },
        { tipus: 'talaj', nev: 'HtrT', A: v(F[0]!['Htr,T']), UT: 1, P: 0, psiPF: 0 },
      ],
    };
    const e = zonaHaviMerleg(zb, {
      QsdFelulbiralas: F.map((r) => v(r['Qs'])), QsdHFelulbiralas: H?.map((r) => v(r['Qs'])),
      HszellFFelulbiralas: F.map((r) => v(r['Hszell'])), HszellHFelulbiralas: H?.map((r) => v(r['Hszell'])),
      HtrXHFelulbiralas: H?.map((r) => v(r['Htr,x'])),
    });
    const hasonlit = (zona: string, honap: number, tetel: string, wwv: number | null | undefined, mi: number, tur = 0.01, abs = 1) => {
      if (wwv === null || wwv === undefined) return;
      if (Math.abs(mi - wwv) > Math.max(abs, Math.abs(wwv) * tur)) el.push({ minta: nev, zona, honap, tetel, ww: wwv, mi });
    };
    let QFw = 0, QFm = 0, QHw = 0, QHm = 0;
    e.havi.forEach((h, m) => {
      const f = F[m]!;
      hasonlit(sz.jel, m + 1, 'Qveszt', f['Qveszt'], h.Qveszt);
      hasonlit(sz.jel, m + 1, 'Qnyer', f['Qnyer'], h.Qnyer);
      hasonlit(sz.jel, m + 1, 'Qb', f['Qb'], h.Qb);
      hasonlit(sz.jel, m + 1, 'τ', f['τ'], h.tau, 0.01, 0.15);
      if (f['QF,net']! > 0 || h.QFnet > 0) hasonlit(sz.jel, m + 1, 'ηF', f['ηF/H'], h.eta * 100, 0.005, 0.3);
      hasonlit(sz.jel, m + 1, 'QF,net', f['QF,net'], h.QFnet, 0.01, 2);
      QFw += v(f['QF,net']); QFm += h.QFnet;
      if (H) {
        const g = H[m]!;
        hasonlit(hJel, m + 1, 'Qlead', g['Qlead'], h.Qlead);
        hasonlit(hJel, m + 1, 'Qterh', g['Qterh'], h.Qterh);
        hasonlit(hJel, m + 1, 'τH', g['τ'], h.Hszell_H ? 0 : 0, 1, 1e9); // τH nincs külön kiírva nálunk
        if (g['QH,net']! > 0 || h.QHnet > 0) hasonlit(hJel, m + 1, 'ηH', g['ηF/H'], h.etaH * 100, 0.005, 0.3);
        hasonlit(hJel, m + 1, 'QH,net', g['QH,net'], h.QHnet, 0.01, 2);
        QHw += v(g['QH,net']); QHm += h.QHnet;
      }
    });
    const qWW = (ww as unknown as { eredmeny: Record<string, number> }).eredmeny['Fajlagos hőveszteségtényező'];
    const egyZona = z.szamitasi.filter((x) => x.tipus === 'fűtés').length === 1;
    osszeg.push(`${nev} ${sz.jel}: QF,net WW ${QFw.toFixed(0)} / mi ${QFm.toFixed(0)} kWh (${(((QFm - QFw) / (QFw || 1)) * 100).toFixed(2)}%)` + (H ? ` · ${hJel}: QH,net WW ${QHw.toFixed(0)} / mi ${QHm.toFixed(0)} kWh` : '') + (egyZona && qWW ? ` · q WW ${qWW} / mi ${e.q.toFixed(3)} W/m³K` : ''));
  }
  return { elteresek: el, osszeg };
}

if (process.argv[1]?.endsWith('szintA.ts')) {
  for (const f of readdirSync(DIR).filter((x) => x.endsWith('.json') && x.includes(szuro)).sort()) {
    const ww = JSON.parse(readFileSync(join(DIR, f), 'utf8')) as WW;
    const { elteresek, osszeg } = szintA(f.replace('.json', ''), ww);
    for (const s of osszeg) console.log(s);
    for (const x of elteresek) console.log(`   ${x.zona} ${String(x.honap).padStart(2)}. hó ${x.tetel.padEnd(7)} WW ${x.ww.toFixed(1).padStart(9)}  mi ${x.mi.toFixed(1).padStart(9)}`);
  }
}
