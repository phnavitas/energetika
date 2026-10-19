/**
 * Cloudflare Worker: a statikus felület kiszolgálása mellett két szűk proxy a böngészőből közvetlenül nem hívható
 * szolgáltatásokhoz. A PVGIS API nem engedi a böngészős (AJAX) hívást, ezért itt, szerveroldalon kérdezzük le.
 *   GET /api/pvgis?lat&lon&peakpower&loss&angle&aspect&mountingplace  → PVGIS 5.3 PVcalc (JSON)
 *   GET /api/geokod?q=<cím>                                          → OpenStreetMap Nominatim (1 találat, HU)
 * Minden más kérés a statikus eszközökhöz megy.
 */
const PVGIS = 'https://re.jrc.ec.europa.eu/api/v5_3/PVcalc';
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const UA = 'ekm-energetika/1.0 (+https://energetika.balazs-ambrus.workers.dev)';

const json = (adat, status = 200, extra = {}) => new Response(JSON.stringify(adat), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
});

function szam(sp, nev, min, max, kotelezo = true) {
  const s = sp.get(nev);
  if (s === null || s === '') { if (kotelezo) throw new Error(`Hiányzó paraméter: ${nev}`); return null; }
  const v = Number(s);
  if (!Number.isFinite(v) || v < min || v > max) throw new Error(`Érvénytelen paraméter: ${nev} (${min}…${max})`);
  return v;
}

/** Kérés kezelése; a fetch-et paraméterként kapja, hogy tesztelhető legyen. */
export async function kezel(request, env, f = fetch, gyorsitotar = null) {
  const url = new URL(request.url);
  if (request.method !== 'GET') return json({ hiba: 'Csak GET kérés engedélyezett.' }, 405);

  if (url.pathname === '/api/pvgis') {
    let cel;
    try {
      const sp = url.searchParams;
      const p = new URLSearchParams({
        lat: String(szam(sp, 'lat', 45.5, 48.7)), lon: String(szam(sp, 'lon', 16, 23)),
        peakpower: String(szam(sp, 'peakpower', 0.01, 100000)), loss: String(szam(sp, 'loss', 0, 50)),
        angle: String(szam(sp, 'angle', 0, 90)), aspect: String(szam(sp, 'aspect', -180, 180)),
        mountingplace: sp.get('mountingplace') === 'free' ? 'free' : 'building',
        pvtechchoice: 'crystSi', usehorizon: '1', outputformat: 'json',
      });
      cel = `${PVGIS}?${p}`;
    } catch (e) { return json({ hiba: e.message }, 400); }
    const kesz = gyorsitotar ? await gyorsitotar.match(cel) : null;
    if (kesz) return new Response(kesz.body, { headers: { 'content-type': 'application/json; charset=utf-8', 'x-pvgis-url': cel, 'x-gyorsitotar': '1' } });
    const v = await f(cel, { headers: { 'user-agent': UA, accept: 'application/json' } });
    const szoveg = await v.text();
    if (!v.ok) return json({ hiba: `PVGIS hiba (${v.status}): ${szoveg.slice(0, 300)}` }, 502);
    const valasz = new Response(szoveg, { headers: { 'content-type': 'application/json; charset=utf-8', 'x-pvgis-url': cel, 'cache-control': 'public, max-age=86400' } });
    if (gyorsitotar) await gyorsitotar.put(cel, valasz.clone());
    return valasz;
  }

  if (url.pathname === '/api/geokod') {
    const q = (url.searchParams.get('q') ?? '').trim();
    if (q.length < 3 || q.length > 200) return json({ hiba: 'Adj meg címet vagy települést.' }, 400);
    const cel = `${NOMINATIM}?${new URLSearchParams({ q, format: 'jsonv2', limit: '1', countrycodes: 'hu', 'accept-language': 'hu' })}`;
    const v = await f(cel, { headers: { 'user-agent': UA, accept: 'application/json' } });
    if (!v.ok) return json({ hiba: `Címkereső hiba (${v.status})` }, 502);
    const t = await v.json();
    if (!Array.isArray(t) || !t.length) return json({ hiba: 'A címet nem találtam.' }, 404);
    return json({ lat: Number(t[0].lat), lon: Number(t[0].lon), nev: t[0].display_name, forras: 'OpenStreetMap Nominatim' });
  }

  return env.ASSETS.fetch(request);
}

export default {
  fetch(request, env) {
    const gy = typeof caches !== 'undefined' ? caches.default : null;
    return kezel(request, env, fetch, gy).catch((e) => json({ hiba: `Belső hiba: ${e.message}` }, 500));
  },
};
