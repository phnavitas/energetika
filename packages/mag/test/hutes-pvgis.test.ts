import { describe, it, expect } from 'vitest';
import { hutesRendszer, pvgis } from '../src/index.js';
import { kezel } from '../../../worker/index.js';

describe('hűtés 11.1', () => {
  it('split klíma: Q · cH · εszab / SEER', () => {
    const r = hutesRendszer(1000, { nev: 'Split', gep: { tipus: 'tabla', kod: 'split' }, cH: 'direkt_elparologtato', szab: 'direkt' });
    expect(r.tetelek[0]!.Q).toBeCloseTo(1000 * 1.45 * 1.13 / 2.5, 6);
    expect(r.tetelek[0]!.energiahordozo).toBe('villamos');
  });
  it('passzív talajhőcserélő: 1 kWh / 10 kWh', () => {
    const r = hutesRendszer(800, { nev: 'Passzív', gep: { tipus: 'passziv_talaj' }, cH: 'klimagerenda_16_18', szab: 'viz_16_18' });
    expect(r.tetelek[0]!.Q).toBeCloseTo(80, 6);
  });
  it('gázmotoros hőszivattyú gázt fogyaszt', () => {
    const r = hutesRendszer(1000, { nev: 'Gáz', gep: { tipus: 'tabla', kod: 'gaz_hsz' }, cH: 'fancoil_6_12', szab: 'viz_6_12' });
    expect(r.tetelek[0]!.energiahordozo).toBe('fosszilis_gaz');
    expect(r.tetelek[0]!.Q).toBeCloseTo(1000 * 1.25 * 1.13 / 1.4, 6);
  });
});

const minta = {
  inputs: { location: { latitude: 47.58, longitude: 18.39, elevation: 160 }, meteo_data: { radiation_db: 'PVGIS-SARAH3', year_min: 2005, year_max: 2023, use_horizon: true }, pv_module: { technology: 'c-Si', peak_power: 30, system_loss: 14 } },
  outputs: {
    monthly: { fixed: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, E_d: 10, E_m: 1000 + i * 100, 'H(i)_d': 3, 'H(i)_m': 50 + i, SD_m: 80 })) },
    totals: { fixed: { E_d: 100, E_m: 1500, E_y: 18600, 'H(i)_d': 4, 'H(i)_m': 55, 'H(i)_y': 666, SD_y: 900, l_aoi: -2.8, l_spec: '1.5', l_tg: -5.2, l_total: -19.6 } },
  },
};
const be = { lat: 47.58, lon: 18.39, kWp: 30, veszteseg: 14, hajlasszog: 35, azimut: 0, elhelyezes: 'building' as const };

describe('PVGIS', () => {
  it('feldolgozás', () => {
    const e = pvgis.pvgisFeldolgoz(minta, be, 'u', '2026-10-19');
    expect(e.havi).toHaveLength(12);
    expect(e.ossz.E_y).toBe(18600);
    expect(e.ossz.l_spec).toBe(1.5);
    expect(e.meteo.sugarzasDb).toBe('PVGIS-SARAH3');
    expect(pvgis.pvgisErvenyes(e, be)).toBe(true);
    expect(pvgis.pvgisErvenyes(e, { ...be, kWp: 31 })).toBe(false);
  });
  it('hibás válasz', () => {
    expect(() => pvgis.pvgisFeldolgoz({ outputs: {} }, be, 'u')).toThrow(/12 havi/);
  });
});

describe('worker proxy', () => {
  const env = { ASSETS: { fetch: async () => new Response('asset') } };
  it('PVGIS paraméterek ellenőrzése és továbbítás', async () => {
    let hivott = '';
    const f = async (u: string) => { hivott = u; return new Response(JSON.stringify(minta)); };
    const v = await kezel(new Request('https://x/api/pvgis?lat=47.58&lon=18.39&peakpower=30&loss=14&angle=35&aspect=0'), env, f as typeof fetch);
    expect(v.status).toBe(200);
    expect(hivott).toContain('re.jrc.ec.europa.eu/api/v5_3/PVcalc');
    expect(hivott).toContain('outputformat=json');
    expect(v.headers.get('x-pvgis-url')).toBe(hivott);
  });
  it('rossz koordináta 400', async () => {
    const v = await kezel(new Request('https://x/api/pvgis?lat=10&lon=18&peakpower=3&loss=14&angle=35&aspect=0'), env, (async () => new Response('')) as typeof fetch);
    expect(v.status).toBe(400);
  });
  it('minden más az eszközökhöz', async () => {
    const v = await kezel(new Request('https://x/'), env);
    expect(await v.text()).toBe('asset');
  });
});

describe('PVGIS fájl', () => {
  it('bemenet a fájlból', () => {
    const f = { ...minta, inputs: { ...minta.inputs, mounting_system: { fixed: { slope: { value: 35, optimal: false }, azimuth: { value: -20, optimal: false }, type: 'building-integrated' } } } };
    expect(pvgis.pvgisBemenetFajlbol(f)).toEqual({ lat: 47.58, lon: 18.39, kWp: 30, veszteseg: 14, hajlasszog: 35, azimut: -20, elhelyezes: 'building' });
  });
});

import { szerkezetSablon } from '../src/index.js';
import { ALAP_ANYAGOK } from '../src/alapkatalogus.js';
describe('szerkezetsablonok', () => {
  it('minden réteg létező, λ-val vagy R-rel bíró anyagra hivatkozik', () => {
    for (const s of szerkezetSablon.SZERKEZET_SABLONOK) for (const r of s.retegek) {
      const a = ALAP_ANYAGOK.find((x) => x.id === r.anyagId);
      expect(a, `${s.kod}: ${r.anyagId}`).toBeTruthy();
      expect(a!.lambda ?? a!.R, `${s.kod}: ${r.anyagId}`).toBeTruthy();
    }
  });
});
