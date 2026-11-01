/**
 * Regressziós összevetés valós WinWatt-számításokkal (tools/winwatt/minta – a WinWatt PDF-ből kinyert számadatok).
 * A szint: a zóna havi mérlege a WinWatt köztes értékeivel. Ismert, dokumentált eltérés: a WinWatt aug./szept.
 * 20,9/17,7 °C-kal számol a rendelet 21,0/17,8 °C-a helyett – ez éves szinten < 0,3 %.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { szintA } from '../../../tools/winwatt/szintA.js';
import { SULYOZO } from '../src/tablak/sulyozo.js';

const DIR = join(import.meta.dirname, '../../../tools/winwatt/minta');
const mintak = readdirSync(DIR).filter((f) => f.endsWith('.json')).sort();

describe('WinWatt-összevetés', () => {
  for (const f of mintak) {
    const ww = JSON.parse(readFileSync(join(DIR, f), 'utf8'));
    it(`${f}: éves nettó fűtési/hűtési igény a WinWatt köztes értékeivel`, () => {
      const { osszeg } = szintA(f, ww);
      for (const s of osszeg) {
        const m = /QF,net WW (\d+) \/ mi (\d+)/.exec(s)!;
        expect(Math.abs(+m[2]! - +m[1]!)).toBeLessThanOrEqual(Math.max(5, +m[1]! * 0.005));
        const h = /QH,net WW (\d+) \/ mi (\d+)/.exec(s);
        if (h) expect(Math.abs(+h[2]! - +h[1]!)).toBeLessThanOrEqual(Math.max(5, +h[1]! * 0.015));
      }
    });
    it(`${f}: primerenergia a WinWatt végenergiáiból`, () => {
      const AN = ww.eredmeny['Hasznos alapterület'] as number;
      let nren = 0;
      for (const r of ww.rendszerek as { ertekek: Record<string, number[]>; vegenergia?: { Q: number; hordozo: string }[] }[]) {
        for (const v of r.vegenergia ?? []) {
          if (v.hordozo === 'villamos energia') nren += v.Q * SULYOZO.villamos.fnren;
          else if (v.hordozo === 'környezeti hő') nren += v.Q * SULYOZO.kornyezeti_ho.fnren;
          else if (v.hordozo === 'napenergia (PV villamos)') nren -= v.Q * (SULYOZO.export_halozat.fnren - SULYOZO.nap_pv.fnren);
          else if (v.hordozo === 'távhő') { const t = ww.tavho as number | undefined; nren += v.Q * (t ?? NaN); }
        }
        for (const k of Object.keys(r.ertekek)) if (/^W.*,vég$/.test(k)) nren += r.ertekek[k]![0]! * SULYOZO.villamos.fnren;
      }
      if (Number.isNaN(nren)) return; // szolgáltatói súlyozó (távhő) – a PDF-ből még nem olvassuk
      expect(nren / AN).toBeCloseTo(ww.eredmeny['Enren,fajl'], 0);
    });
  }
});
