import { describe, it, expect } from 'vitest';
import { tavhoOldal, kezel } from '../../../worker/index.js';

const HTML = `<div><h2>Tata Városi rendszer</h2><p>A 2025. évi szolgáltatási adatok alapján:</p><p>ftávhő nren=0,85</p><p>ftávhő ren = 1,056</p><p>ftávhő CO2=211,428</p>
<h2>Tata Gesztenye fasor</h2><p>A szolgáltató a 8. melléklet szerinti számítást nem végezte el.</p><p>ftávhő nren=1,38</p><p>ftávhő ren = 0,00</p><p>ftávhő CO2=374</p><p>Frissítve: 2026.02.16.</p></div>`;

describe('távhő-tényezők (9/2023 ÉKM 8. § (1)) a szolgáltatói oldalról', () => {
  it('rendszerenként kiolvassa a nren, ren, CO2 értéket és a frissítés dátumát', () => {
    const o = tavhoOldal(HTML);
    expect(o.frissitve).toBe('2026.02.16');
    expect(o.rendszerek).toEqual([
      { rendszer: 'Tata Városi rendszer', fnren: 0.85, fren: 1.056, fCO2: 211.428, adatEv: 2025 },
      { rendszer: 'Tata Gesztenye fasor', fnren: 1.38, fren: 0, fCO2: 374, adatEv: null },
    ]);
  });
  it('az /api/tavho minden forrásoldalt lekér és összesít', async () => {
    const r = await kezel(new Request('https://x/api/tavho'), { ASSETS: { fetch: () => new Response('') } }, (async () => new Response(HTML)) as unknown as typeof fetch, null);
    const j = await r.json() as { rendszerek: { szolgaltato: string }[]; hibak: string[] };
    expect(j.hibak).toEqual([]);
    expect(j.rendszerek.length).toBe(8);
  });
});
