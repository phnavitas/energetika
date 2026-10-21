/**
 * Cloudflare Worker: a statikus felület kiszolgálása mellett két szűk proxy a böngészőből közvetlenül nem hívható
 * szolgáltatásokhoz. A PVGIS API nem engedi a böngészős (AJAX) hívást, ezért itt, szerveroldalon kérdezzük le.
 *   GET /api/pvgis?lat&lon&peakpower&loss&angle&aspect&mountingplace  → PVGIS 5.3 PVcalc (JSON)
 *   GET /api/geokod?q=<cím>                                          → OpenStreetMap Nominatim (1 találat, HU)
 *   GET /api/tavho                                                   → távhőszolgáltatók közzétett súlyozó tényezői
 *       (9/2023 ÉKM 8. § (1)); a szolgáltatói oldalakról olvasva, 30 napig gyorsítótárazva, havonta (cron) frissítve
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

/** A súlyozó tényezőket közzétevő szolgáltatói oldalak (egy oldalon több rendszer is lehet). */
export const TAVHO_FORRASOK = [
  { szolgaltato: 'Veolia – Tata', telepules: 'Tata', url: 'https://tavho.veolia.hu/tata/primerenergiatenyezo-tata' },
  { szolgaltato: 'BAKONY-TÁVHŐ Kft.', telepules: 'Ajka', url: 'https://tavho.veolia.hu/bakonytavho_kft/epuletek-energetikai-bakonytavho' },
  { szolgaltato: 'NÁNÁSHŐ Kft.', telepules: 'Hajdúnánás', url: 'https://tavho.veolia.hu/nanasho_kft/epuletek-energetikai-nanasho' },
  { szolgaltato: 'Veolia – Dorog', telepules: 'Dorog', url: 'https://tavho.veolia.hu/dorog/epuletenergetika-dorog' },
];
const TAVHO_KULCS = 'https://ekm-gyorsitotar.local/tavho/v1';
const szamHu = (s) => Number(String(s).replace(/\s/g, '').replace(',', '.'));

/** A szolgáltatói oldal szövegéből a „ftávhő nren= / ren = / CO2=” hármasok, a rendszer nevével (a megelőző sor). */
export function tavhoOldal(html) {
  const szoveg = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<(br|\/p|\/div|\/h\d|\/li|\/tr)[^>]*>/gi, '\n').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/[ \t]+/g, ' ');
  const sorok = szoveg.split('\n').map((x) => x.trim()).filter(Boolean);
  const ki = [];
  for (let i = 0; i < sorok.length; i++) {
    const m = /f\s*táv\s*hő\s*,?\s*nren\s*=\s*([\d.,]+)/i.exec(sorok[i]);
    if (!m) continue;
    const blokk = sorok.slice(i, i + 6).join(' ');
    const ren = /f\s*táv\s*hő\s*,?\s*ren\s*=\s*([\d.,]+)/i.exec(blokk), co2 = /CO2\s*=\s*([\d.,]+)/i.exec(blokk);
    let nev = '';
    for (let j = i - 1; j >= Math.max(0, i - 4); j--) { const t = sorok[j]; if (t.length < 90 && !t.includes('=') && !/alapján|számítás|rendelet|friss[ií]tve|tényező/i.test(t)) { nev = t; break; } }
    const ev = /(20\d\d)\.?\s*évi/i.exec(sorok.slice(Math.max(0, i - 4), i + 1).join(' '));
    ki.push({ rendszer: nev, fnren: szamHu(m[1]), fren: ren ? szamHu(ren[1]) : 0, fCO2: co2 ? szamHu(co2[1]) : null, adatEv: ev ? Number(ev[1]) : null });
  }
  const fr = /Friss[ií]tve:?\s*(\d{4}\.\s*\d{2}\.\s*\d{2})/i.exec(szoveg);
  return { rendszerek: ki.filter((x) => Number.isFinite(x.fnren)), frissitve: fr ? fr[1].replace(/\s/g, '') : null };
}

async function tavhoLekeres(f) {
  const rendszerek = []; const hibak = [];
  for (const q of TAVHO_FORRASOK) {
    try {
      const v = await f(q.url, { headers: { 'user-agent': UA, accept: 'text/html' } });
      if (!v.ok) { hibak.push(`${q.szolgaltato}: HTTP ${v.status}`); continue; }
      const o = tavhoOldal(await v.text());
      for (const r of o.rendszerek) rendszerek.push({ szolgaltato: q.szolgaltato, telepules: q.telepules, ...r, forras: q.url, frissitve: o.frissitve });
    } catch (e) { hibak.push(`${q.szolgaltato}: ${e.message}`); }
  }
  return { lekerve: new Date().toISOString(), rendszerek, hibak };
}

async function tavhoFrissit(f, gyorsitotar) {
  const adat = await tavhoLekeres(f);
  const valasz = new Response(JSON.stringify(adat), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=2592000' } });
  if (gyorsitotar && adat.rendszerek.length) await gyorsitotar.put(TAVHO_KULCS, valasz.clone());
  return valasz;
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

  if (url.pathname === '/api/tavho') {
    const kesz = gyorsitotar && url.searchParams.get('friss') !== '1' ? await gyorsitotar.match(TAVHO_KULCS) : null;
    if (kesz) return new Response(kesz.body, { headers: { 'content-type': 'application/json; charset=utf-8', 'x-gyorsitotar': '1' } });
    return tavhoFrissit(f, gyorsitotar);
  }

  return env.ASSETS.fetch(request);
}

export default {
  fetch(request, env) {
    const gy = typeof caches !== 'undefined' ? caches.default : null;
    return kezel(request, env, fetch, gy).catch((e) => json({ hiba: `Belső hiba: ${e.message}` }, 500));
  },
  // havi frissítés (wrangler.jsonc triggers.crons): a távhő-tényezők újraolvasása a gyorsítótárba
  scheduled(_ev, _env, ctx) {
    const gy = typeof caches !== 'undefined' ? caches.default : null;
    ctx.waitUntil(tavhoFrissit(fetch, gy));
  },
};
