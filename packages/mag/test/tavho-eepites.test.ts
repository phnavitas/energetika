/** e-építés távhő-nyilvántartás: a worker HTML-feldolgozása és a munkamenetes lekérdezés (rögzített HTML-mintával). */
import { describe, expect, it } from 'vitest';
import { eepitesTalalatok, eepitesReszletek, kezel } from '../../../worker/index.js';

const LISTA = `<form action="/e-tanusitas/tavho/nyilvanos/lekerdezes;jsessionid=ABC" method="post"></form><table><tbody>
  <tr>
    <td class="align-middle">
      <a href="/e-tanusitas/tavho/nyilvanos/reszletek;jsessionid=ABC?id=35" title="Részletek megtekintése" target="_blank">BKM Nonprofit Zrt.</a>
    </td>
    <td class="align-middle">BKM Budapesti Közművek Nonprofit Zártkörűen Működő Részvénytársaság</td>
    <td class="align-middle">Budapest</td>
    <td class="align-middle">1116</td>
    <td class="align-middle">Kalotaszeg utca 31.</td>
    <td class="text-center"><a href="http://www.fotav.hu/" target="_blank">weboldal</a></td>
    <td class="text-center" title="Publikus dokumentum megtekintése">
      <a href="/e-tanusitas/tavho/nyilvanos/download;jsessionid=ABC?id=1002" 
         target="_blank">dokumentum</a>
    </td>
  </tr>
</tbody></table>`;
const RESZLET = `<table><tbody>
  <tr><td class="fw-bold align-top text-nowrap">Ellátott települések:</td>
      <td>Baj, Tatabánya</td></tr>
  <tr><td class="fw-bold align-top text-nowrap">Publikus dokumentumok:</td><td>
    <div><span>2024</span>:
      <a href="/e-tanusitas/tavho/nyilvanos/download;jsessionid=ABC?id=788" 
         target="_blank">Adatlap (2).pdf</a></div>
    <div><span>2025</span>:
      <a href="/e-tanusitas/tavho/nyilvanos/download;jsessionid=ABC?id=928" 
         target="_blank">Kisérő levél+ adalap1.pdf</a></div>
  </td></tr></tbody></table>`;

describe('e-építés távhő', () => {
  it('találati sor', () => {
    expect(eepitesTalalatok(LISTA)).toEqual([{ id: 35, rovidNev: 'BKM Nonprofit Zrt.', teljesNev: 'BKM Budapesti Közművek Nonprofit Zártkörűen Működő Részvénytársaság', szekhely: 'Budapest', dokId: 1002 }]);
  });
  it('részletek: települések, évenkénti dokumentumok', () => {
    expect(eepitesReszletek(RESZLET)).toEqual({ telepulesek: ['Baj', 'Tatabánya'], dokumentumok: [{ ev: 2024, id: 788, nev: 'Adatlap (2).pdf' }, { ev: 2025, id: 928, nev: 'Kisérő levél+ adalap1.pdf' }] });
  });
  it('lekérdezés: GET (munkamenet) → POST az action-re → részletek', async () => {
    const hivasok: string[] = [];
    const f = (async (u: string, o?: RequestInit) => {
      hivasok.push(`${o?.method ?? 'GET'} ${u} ${o?.body ?? ''}`);
      if (u.endsWith('/lekerdezes')) return new Response(LISTA, { headers: { 'set-cookie': 'JSESSIONID=ABC; Path=/; HttpOnly' } });
      if (u.includes('lekerdezes;jsessionid=ABC')) return new Response(LISTA);
      return new Response(RESZLET);
    }) as unknown as typeof fetch;
    const v = await kezel(new Request('https://x/api/tavho/keres?telepules=Tatab%C3%A1nya'), { ASSETS: { fetch: () => new Response('') } }, f);
    const j = await v.json() as { szolgaltatok: { telepulesek: string[]; dokumentumok: unknown[] }[] };
    expect(hivasok[1]).toBe('POST https://www.e-epites.hu/e-tanusitas/tavho/nyilvanos/lekerdezes;jsessionid=ABC telepulesNev=Tatab%C3%A1nya&szolgaltatoNev=');
    expect(j.szolgaltatok[0]!.telepulesek).toEqual(['Baj', 'Tatabánya']);
    expect(j.szolgaltatok[0]!.dokumentumok).toHaveLength(2);
  });
  it('PDF: csak számos azonosító', async () => {
    const v = await kezel(new Request('https://x/api/tavho/pdf?id=1;rm'), { ASSETS: { fetch: () => new Response('') } }, (async () => new Response('')) as unknown as typeof fetch);
    expect(v.status).toBe(400);
  });
});
