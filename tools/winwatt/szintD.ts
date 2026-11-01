/**
 * WinWatt-összevetés – D szint: a rendszerenkénti végenergiákból (WinWatt értékei) a primerenergia- és CO₂-indikátorok
 * (7. melléklet súlyozó tényezők, 14. fejezet). Futtatás: npx tsx tools/winwatt/szintD.ts
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { SULYOZO, type Energiahordozo } from '../../packages/mag/src/tablak/sulyozo.js';

const DIR = join(import.meta.dirname, 'minta');
const HORD: Record<string, Energiahordozo> = { 'villamos energia': 'villamos', 'környezeti hő': 'kornyezeti_ho', 'napenergia (PV villamos)': 'nap_pv' };
const ROVID: Record<string, string> = { 'Fűtési rendszer': 'EF', 'Melegvíz-termelő rendszer': 'EHMV', 'Hűtési rendszer': 'EH', 'Légtechnikai rendszer': 'ELT', 'Világítási rendszer': 'EV', 'Beépített világítás': 'EV' };

for (const f of readdirSync(DIR).filter((x) => x.endsWith('.json')).sort()) {
  const ww = JSON.parse(readFileSync(join(DIR, f), 'utf8'));
  const AN = ww.eredmeny['Hasznos alapterület'] as number;
  console.log(`\n=== ${f}  AN ${AN}  Ep WW ${ww.eredmeny['Enren,fajl']}`);
  let ossz = 0;
  for (const r of ww.rendszerek as { rendszer: string; ertekek: Record<string, number[]>; vegenergia?: { kulcs: string; Q: number; hordozo: string }[] }[]) {
    const pf = ROVID[r.rendszer]; if (!pf) continue;
    let nren = 0, ren = 0, co2 = 0; const tetelek: string[] = []; let pv = 0;
    for (const v of r.vegenergia ?? []) {
      if (v.hordozo === 'exportált villamos energia') continue;
      if (v.hordozo === 'napenergia (PV villamos)') { pv = v.Q; continue; }
      const h = HORD[v.hordozo]; if (!h) { tetelek.push(`?${v.hordozo}`); continue; }
      const s = SULYOZO[h]; nren += v.Q * s.fnren; ren += v.Q * s.fren; co2 += v.Q * s.fCO2 / 1000; tetelek.push(`${h} ${v.Q}`);
    }
    for (const k of Object.keys(r.ertekek)) if (/^W.*,vég$/.test(k)) { const W = r.ertekek[k]![0]!; const s = SULYOZO.villamos; nren += W * s.fnren; ren += W * s.fren; co2 += W * s.fCO2 / 1000; tetelek.push(`seged ${W}`); }
    if (pv) { const e = SULYOZO.export_halozat, t = SULYOZO.nap_pv; nren -= pv * (e.fnren - t.fnren); ren -= pv * (e.fren - t.fren); co2 -= pv * (e.fCO2 - t.fCO2) / 1000; tetelek.push(`PV export ${pv}`); }
    const w = (k: string) => r.ertekek[`${pf}${k}`]?.[0] ?? r.ertekek[`EPV${k}`]?.[0];
    const sor = (nev: string, mi: number, wwv: number | undefined) => `${nev} mi ${mi.toFixed(2)} / WW ${wwv ?? '–'}${wwv !== undefined && Math.abs(mi - wwv) > 0.02 + Math.abs(wwv) * 0.002 ? '  ←' : ''}`;
    console.log(`  ${r.rendszer} [${tetelek.join(', ')}]\n     ${sor('nren', nren / AN, w(',nren,fajl'))} · ${sor('ren', ren / AN, w(',ren,fajl'))} · ${sor('CO2', co2 / AN, w(',CO2,fajl'))}`);
    ossz += nren / AN;
  }
  console.log(`  Σ nren mi ${ossz.toFixed(2)} / WW ${ww.eredmeny['Enren,fajl']} (tagok: ${ww.eredmeny.Enren_tagok?.join(' + ')})`);
}
