/**
 * Cloudflare Worker: a statikus felület kiszolgálása mellett két szűk proxy a böngészőből közvetlenül nem hívható
 * szolgáltatásokhoz. A PVGIS API nem engedi a böngészős (AJAX) hívást, ezért itt, szerveroldalon kérdezzük le.
 *   GET /api/pvgis?lat&lon&peakpower&loss&angle&aspect&mountingplace  → PVGIS 5.3 PVcalc (JSON)
 *   GET /api/geokod?q=<cím>                                          → OpenStreetMap Nominatim (1 találat, HU)
 *   GET /api/tavho                                                   → távhőszolgáltatók közzétett súlyozó tényezői
 *       (9/2023 ÉKM 8. § (1)); a szolgáltatói oldalakról olvasva, 30 napig gyorsítótárazva, havonta (cron) frissítve
 *   GET /api/tavho/keres?telepules=&szolgaltato=                     → az e-építés (Lechner) távhőszolgáltatói nyilvántartása:
 *       szolgáltatók, ellátott települések, évenkénti adatszolgáltatási PDF-ek (1 napig gyorsítótárazva)
 *   GET /api/tavho/pdf?id=<n>                                        → egy adatszolgáltatási PDF (változatlan, 1 évig gyorsítótárazva);
 *       a tényezőket a böngésző olvassa ki belőle (pdf.js)
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
const EEPITES = 'https://www.e-epites.hu/e-tanusitas/tavho/nyilvanos';
const html2szoveg = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();

/** A lekérdező találati táblázata: soronként rövid név, részletek-azonosító, teljes név, székhely, legutóbbi dokumentum. */
export function eepitesTalalatok(html) {
  const tb = /<tbody>([\s\S]*?)<\/tbody>/.exec(html);
  if (!tb) return [];
  return tb[1].split(/<tr[^>]*>/).slice(1).map((sor) => {
    const cellak = [...sor.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
    const r = /reszletek(?:;jsessionid=[^?"]*)?\?id=(\d+)"[^>]*>([^<]*)</.exec(sor);
    const d = /download(?:;jsessionid=[^?"]*)?\?id=(\d+)/.exec(sor);
    if (!r) return null;
    return { id: Number(r[1]), rovidNev: html2szoveg(r[2]), teljesNev: html2szoveg(cellak[1] ?? ''), szekhely: html2szoveg(cellak[2] ?? ''), dokId: d ? Number(d[1]) : null };
  }).filter(Boolean);
}

/** A részletek oldal: ellátott települések és az évenkénti nyilvános dokumentumok. */
export function eepitesReszletek(html) {
  const t = /Ellátott települések:\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/.exec(html);
  const telepulesek = t ? html2szoveg(t[1]).split(/\s*,\s*/).filter(Boolean) : [];
  const dokumentumok = [...html.matchAll(/<span>\s*(\d{4})\s*<\/span>\s*:\s*<a href="[^"]*download(?:;jsessionid=[^?"]*)?\?id=(\d+)"[^>]*>([^<]*)<\/a>/g)]
    .map((m) => ({ ev: Number(m[1]), id: Number(m[2]), nev: html2szoveg(m[3]) }));
  return { telepulesek, dokumentumok };
}

async function eepitesKeres(f, telepules, szolgaltato) {
  // a lekérdezés munkamenethez kötött: az űrlap action-je hordozza a jsessionid-t
  const g = await f(`${EEPITES}/lekerdezes`, { headers: { 'user-agent': UA, accept: 'text/html' } });
  if (!g.ok) throw new Error(`e-építés: HTTP ${g.status}`);
  const lap = await g.text();
  const act = /<form[^>]*action="([^"]+)"/.exec(lap)?.[1];
  if (!act) throw new Error('e-építés: a lekérdező űrlap nem található');
  const suti = (g.headers.get('set-cookie') ?? '').split(/,(?=\s*\w+=)/).map((x) => x.split(';')[0].trim()).filter(Boolean).join('; ');
  const v = await f(new URL(act, 'https://www.e-epites.hu').toString(), {
    method: 'POST',
    headers: { 'user-agent': UA, accept: 'text/html', 'content-type': 'application/x-www-form-urlencoded', ...(suti ? { cookie: suti } : {}) },
    body: new URLSearchParams({ telepulesNev: telepules, szolgaltatoNev: szolgaltato }).toString(),
  });
  if (!v.ok) throw new Error(`e-építés: HTTP ${v.status}`);
  const talalat = eepitesTalalatok(await v.text()).slice(0, 12);
  const szolgaltatok = [];
  for (const t of talalat) {
    const r = await f(`${EEPITES}/reszletek?id=${t.id}`, { headers: { 'user-agent': UA, accept: 'text/html', ...(suti ? { cookie: suti } : {}) } });
    szolgaltatok.push({ ...t, ...(r.ok ? eepitesReszletek(await r.text()) : { telepulesek: [], dokumentumok: [] }), reszletek: `${EEPITES}/reszletek?id=${t.id}` });
  }
  return { forras: `${EEPITES}/lekerdezes`, lekerve: new Date().toISOString(), szolgaltatok };
}
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

/**
 * AI-ELLENŐRZÉS (2026-11-22): a Tervből lépés önellenőrzése által megjelölt alaprajzi lap képe (a felismert hőburokkal,
 * helyiségekkel a rajzon) egy képfelismerő modellnek, amely megmondja, hol hibás a felismerés. A kép a hőburok környéke
 * (a szövegmező nélkül) – személyes adat ne menjen ki. Védelem: a kérés `x-ai-token` fejléce = env.AI_TOKEN (titok),
 * az Anthropic kulcs env.ANTHROPIC_API_KEY (titok; `npx wrangler secret put …`). Kép ≤ 4 MB.
 *   POST /api/ai-ellenorzes  { kep: base64 PNG, kontextus: { helyisegek, burok, jelzesek } }  →  { valasz: {...} }
 */
const AI_MODELL = 'claude-sonnet-5-5';
const AI_PROMPT = `Magyar építészeti alaprajz (PDF-ből) képét kapod, rajta egy program által felismert eredménnyel:
- narancs szaggatott vonal: a hőburok (a fűtött tér határa, a külső falak külső síkján kellene futnia),
- színes kitöltés: a felismert helyiségek, feliratuk mellett a rajzi terület ("rajzon" = a felismert terület, ha eltér),
- piros "nincs fal" címke: a hőburok ott nem falon fut.
A kontextus JSON-ban a program saját jelzései és a helyiséglista.
Feladat: nézd meg, hol hibás a felismerés (a hőburok kifolyik-e a falakon túl, kimarad-e fűtött rész, helyiség rosszul
körülhatárolt-e, hiányzik-e fal vagy nyílás, rossz-e egy helyiség besorolása – pl. terasz, garázs, tároló fűtöttként).
A "hely" a hiba helye a képen, pixelben, a lehető legszűkebben: a hőburok-hibánál a hibás burokszakasz és a helyes fal
környéke együtt, hiányzó falnál maga a fal. Ha a hiba egy helyiség besorolása, add meg a "helyiseg" (pontosan a kontextus
helyiséglistájában szereplő név) és a "besorolas" mezőt. Válaszolj CSAK JSON-nal:
{"rendben": bool, "hibak": [{"tipus": "burok_kifolyik"|"burok_hianyzik"|"helyiseg_hibas"|"fal_hianyzik"|"nyilas_hianyzik"|"besorolas"|"egyeb",
"leiras": "rövid magyar mondat", "hely": [x0,y0,x1,y1] (a kép pixelei, ha meghatározható), "javaslat": "rövid magyar mondat",
"helyiseg": "név" (csak besorolási hibánál), "besorolas": "futott"|"futetlen"|"kulter" (csak besorolási hibánál)}],
"epulet": {"szintek_szama": szám vagy null, "teto": "lapos"|"nyereg"|"konty"|"felnyereg"|"osszetett"|"nem latszik"}}`;

async function aiEllenorzes(request, env, f) {
  if (request.method !== 'POST') return json({ hiba: 'POST kérés kell.' }, 405);
  if (!env.ANTHROPIC_API_KEY || !env.AI_TOKEN) return json({ hiba: 'Az AI-ellenőrzés nincs beállítva (ANTHROPIC_API_KEY, AI_TOKEN titok).' }, 503);
  if (request.headers.get('x-ai-token') !== env.AI_TOKEN) return json({ hiba: 'Érvénytelen AI-token.' }, 403);
  let be;
  try { be = await request.json(); } catch { return json({ hiba: 'Érvénytelen JSON.' }, 400); }
  const kep = typeof be?.kep === 'string' ? be.kep.replace(/^data:image\/png;base64,/, '') : '';
  if (!kep || kep.length > 5_600_000) return json({ hiba: 'Hiányzó vagy túl nagy kép (≤ 4 MB PNG).' }, 400);
  const kontextus = JSON.stringify(be.kontextus ?? {}).slice(0, 20000);
  const v = await f('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: env.AI_MODELL || AI_MODELL, max_tokens: 2000, messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: kep } },
      { type: 'text', text: `${AI_PROMPT}\n\nKontextus: ${kontextus}` }] }] }),
  });
  if (!v.ok) return json({ hiba: `Az AI-szolgáltatás hibát adott (${v.status}).`, reszlet: (await v.text()).slice(0, 500) }, 502);
  const adat = await v.json();
  const szoveg = (adat.content ?? []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
  const m = /\{[\s\S]*\}/.exec(szoveg);
  let valasz = null; try { valasz = m ? JSON.parse(m[0]) : null; } catch { /* */ }
  return json({ valasz, nyers: valasz ? undefined : szoveg.slice(0, 4000), modell: adat.model, tokenek: adat.usage });
}

/** Kérés kezelése; a fetch-et paraméterként kapja, hogy tesztelhető legyen. */
export async function kezel(request, env, f = fetch, gyorsitotar = null) {
  const url = new URL(request.url);
  if (url.pathname === '/api/ai-ellenorzes') return aiEllenorzes(request, env, f);
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

  if (url.pathname === '/api/tavho/keres') {
    const tel = (url.searchParams.get('telepules') ?? '').trim().slice(0, 100), szo = (url.searchParams.get('szolgaltato') ?? '').trim().slice(0, 100);
    if (tel.length < 2 && szo.length < 2) return json({ hiba: 'Adj meg települést vagy szolgáltatónevet.' }, 400);
    const kulcs = `https://ekm-gyorsitotar.local/tavho/keres/v1?t=${encodeURIComponent(tel.toLowerCase())}&s=${encodeURIComponent(szo.toLowerCase())}`;
    const kesz = gyorsitotar && url.searchParams.get('friss') !== '1' ? await gyorsitotar.match(kulcs) : null;
    if (kesz) return new Response(kesz.body, { headers: { 'content-type': 'application/json; charset=utf-8', 'x-gyorsitotar': '1' } });
    let adat;
    try { adat = await eepitesKeres(f, tel, szo); } catch (e) { return json({ hiba: e.message }, 502); }
    const valasz = new Response(JSON.stringify(adat), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=86400' } });
    if (gyorsitotar) await gyorsitotar.put(kulcs, valasz.clone());
    return valasz;
  }

  if (url.pathname === '/api/tavho/pdf') {
    const id = url.searchParams.get('id') ?? '';
    if (!/^\d{1,7}$/.test(id)) return json({ hiba: 'Érvénytelen dokumentum-azonosító.' }, 400);
    const cel = `${EEPITES}/download?id=${id}`;
    const kesz = gyorsitotar ? await gyorsitotar.match(cel) : null;
    if (kesz) return new Response(kesz.body, { headers: { 'content-type': 'application/pdf', 'x-gyorsitotar': '1' } });
    const v = await f(cel, { headers: { 'user-agent': UA, accept: 'application/pdf' } });
    if (!v.ok || !/pdf/i.test(v.headers.get('content-type') ?? '')) return json({ hiba: `e-építés dokumentum: HTTP ${v.status}` }, 502);
    const valasz = new Response(await v.arrayBuffer(), { headers: { 'content-type': 'application/pdf', 'cache-control': 'public, max-age=31536000, immutable' } });
    if (gyorsitotar) await gyorsitotar.put(cel, valasz.clone());
    return valasz;
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
