/** Összevetés a WinWatt 9.54 jegyzőkönyvvel (tarjáni tesztépület): npm run osszevetes */
import { epuletSzamitas } from '../packages/mag/src/index.js';
import { epulet, WW_QS } from '../packages/mag/test/tarjan-modell.js';

const e = epuletSzamitas(epulet, { QsdFelulbiralas: { F1: WW_QS } });
const s = epuletSzamitas(epulet);
const z = e.zonak[0]!;
const sorok: [string, number | string, number | string, string][] = [
  ['qF,net [kWh/m²a]', z.qFnet, 40.07, 'kWh/m²a'],
  ['q fajlagos hőveszteség-tényező', e.qm, 0.136, 'W/m³K'],
  ['Enren,fajl', e.indikatorok.fajlagos.EnrenFajl, 51.04, 'kWh/m²a'],
  ['ECO2,fajl', e.indikatorok.fajlagos.ECO2Fajl, 11.61, 'kg/m²a'],
  ['Fűtés Enren', e.indikatorok.celonkent.futes.nren / 100.5, 31.79, 'kWh/m²a'],
  ['HMV Enren', e.indikatorok.celonkent.hmv.nren / 100.5, 19.25, 'kWh/m²a'],
  ['Hálózati villamos', e.indikatorok.megujulo.halozatiVillamos, 22.19, 'kWh/m²a'],
  ['Környezeti hő', e.indikatorok.megujulo.kornyezetiHo, 56.04, 'kWh/m²a'],
  ['Aktív megújuló', e.indikatorok.megujulo.aktivMegujulo, 62.7, 'kWh/m²a'],
  ['Passzív megújuló', e.indikatorok.megujulo.passzivMegujulo, 32.35, 'kWh/m²a'],
  ['Ref. fűtés Enren', e.rendszerErtekeles.futes!.EnrenRef, 5563.2, 'kWh/a'],
  ['Ref. HMV Enren', e.rendszerErtekeles.hmv!.EnrenRef, 4731.2, 'kWh/a'],
  ['Besorolás', `${e.besorolas.energetikai} (${e.besorolas.energetikaiSzazalek.toFixed(1)}%)`, 'A+ (67.2%)', ''],
  ['CO₂ besorolás', `${e.besorolas.CO2} (${e.besorolas.CO2Szazalek.toFixed(1)}%)`, 'A+ (58.0%)', ''],
  ['Nyári hővédelem mutató', e.nyariHovedelem.mutato ?? '–', 0.044, ''],
  ['Saját Qs-sel qF,net (feltételezett tájolás)', s.zonak[0]!.qFnet, 40.07, 'kWh/m²a'],
];
const f = (v: number | string) => (typeof v === 'number' ? v.toFixed(v < 1 ? 3 : 2) : v);
console.log('Megnevezés'.padEnd(44), 'Számítómag'.padStart(14), 'WinWatt'.padStart(12), '  Eltérés');
for (const [n, a, b, m] of sorok) {
  const elt = typeof a === 'number' && typeof b === 'number' ? `${(((a - b) / b) * 100).toFixed(2)}%` : '';
  console.log(n.padEnd(44), String(f(a)).padStart(14), String(f(b)).padStart(12), ' ', elt.padStart(8), m);
}
if (e.figyelmeztetesek.length) {
  console.log('\nFigyelmeztetések:');
  for (const w of new Map(e.figyelmeztetesek.map((x) => [x.kod + x.uzenet, x])).values()) console.log(` • [${w.kod}] ${w.uzenet}${w.forras ? ` (${w.forras})` : ''}`);
}
