// VAK MÉRÉS (2026-11-22): a Tervből lépés egy előre nem vizsgált minta lapjain, a felismerés önellenőrzésével.
// Minden alaprajzi lapra: az önellenőrzés jelzései, a feliratától eltérő helyiségek, képernyőkép a 2D rajzról és a 3D-ről.
// Kimenet: <ki>_vak.json (laponként), <ki>_lapN.png, <ki>_3d.png
// Használat: PORT=4181 node tools/tervteszt/vak-meres.mjs <pdf-mappa vagy .zip> <ki-előtag>
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require('/usr/local/lib/node_modules/playwright'); }
const [forras, ki] = process.argv.slice(2);
const fajlok = /\.zip$/i.test(forras) ? [forras] : fs.readdirSync(forras).filter((f) => /\.pdf$/i.test(f)).sort().map((f) => path.join(forras, f));
const b = await pw.chromium.launch();
const p = await b.newPage({ viewport: { width: 1500, height: 1100 }, deviceScaleFactor: 1 });
const hibak = []; p.on('pageerror', (e) => hibak.push(String(e)));
const v = (ms) => new Promise((r) => setTimeout(r, ms));
const k = async (szoveg, hol = 'button') => { const e = p.locator(hol, { hasText: szoveg }).first(); await e.click({ timeout: 15000 }); };
await p.goto(`http://localhost:${process.env.PORT ?? 4181}/`, { waitUntil: 'networkidle' });
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('ekm-profil', JSON.stringify({ nev: 'Teszt', jogosultsag: 'TÉ 11-0000', email: '', telefon: '', kamara: 'MEK' })); });
await p.reload({ waitUntil: 'networkidle' });
try { await k('Folytatás belépés nélkül'); } catch { /* */ } await v(300);
await k('Új projekt'); await v(300); await k('Üres projekt indítása'); await v(500);
await k('Tervből', '.lepesek button'); await v(300);
const t0 = Date.now();
await p.locator('main input[type=file]').first().setInputFiles(fajlok);
for (let i = 0; i < 400; i++) {
  const kesz = await p.evaluate(() => [...document.querySelectorAll('main button')].some((x) => /Összes kijelölt alaprajz átvétele|Átvétel a projektbe/.test(x.textContent) && !x.disabled) && !document.querySelector('.halad'));
  if (kesz) break; await v(3000);
}
await v(1500);
const ido = Math.round((Date.now() - t0) / 1000);
const allapot = await p.evaluate(() => ({ halad: document.querySelector('.halad')?.textContent ?? null, hiba: [...document.querySelectorAll('.hiba-doboz')].map((d) => d.textContent).join(' | '), gombok: [...document.querySelectorAll('main button')].map((x) => x.textContent).filter((t) => /átvétel|Átvétel/.test(t ?? '')).slice(0, 5) }));
if (process.env.VAKDBG) await p.screenshot({ path: `${ki}_allapot.png`, fullPage: false });
// (a rögzített / ragadós sávok – átvétel-sáv, fejléc – ne takarják ki a rajz képét)
await p.evaluate(() => { for (const e of document.querySelectorAll('body *')) { const s = getComputedStyle(e); if ((s.position === 'fixed' || s.position === 'sticky') && !e.querySelector('svg image')) e.style.display = 'none'; } });
// a lapok (a „Alaprajz” választó opciói) – az alaprajzi lapokon végigmenve
const opciok = await p.evaluate(() => { const s = [...document.querySelectorAll('main select')].find((x) => [...x.options].some((o) => /oldal/.test(o.text))); return s ? [...s.options].filter((o) => o.value !== '-1').map((o) => ({ v: o.value, t: o.text })) : []; });
const lapok = [];
for (const o of opciok) {
  await p.evaluate((val) => { const s = [...document.querySelectorAll('main select')].find((x) => [...x.options].some((q) => /oldal/.test(q.text))); s.value = val; s.dispatchEvent(new Event('change', { bubbles: true })); }, o.v);
  await v(2500);
  const adat = await p.evaluate(() => {
    const on = [...document.querySelectorAll('main [role=status]')].find((d) => /Önellenőrzés/.test(d.textContent));
    const svg = [...document.querySelectorAll('main svg text')].map((t) => t.textContent ?? '');
    return { onellenorzes: on ? [...on.querySelectorAll('li')].map((l) => ({ szoveg: l.textContent, sulyos: !!l.getAttribute('style') })) : [],
      helyisegek: svg.filter((t) => / m²/.test(t)).length, rajzonElter: svg.filter((t) => /\(rajzon /.test(t)), nincsFal: svg.filter((t) => /nincs fal/.test(t)).length,
      figyelmeztetes: [...document.querySelectorAll('main .figyelmeztetes')].map((d) => d.textContent).slice(0, 12) };
  });
  // csak az alaprajzi lapok (ahol helyiség van)
  if (!adat.helyisegek && !adat.onellenorzes.length) continue;
  const n = lapok.length + 1;
  const rajz = p.locator('main svg').filter({ has: p.locator('image') }).first();
  try { await rajz.screenshot({ path: `${ki}_lap${n}.png` }); } catch { await p.screenshot({ path: `${ki}_lap${n}.png` }); }
  lapok.push({ lap: o.t, ...adat });
}
// 3D
try { await p.locator('button', { hasText: /^3D$/ }).first().click(); await v(4000); await p.screenshot({ path: `${ki}_3d.png` }); } catch { /* */ }
const ossz = { minta: path.basename(forras), ido, allapot, lapok, hibak,
  pont: lapok.reduce((t, l) => t + l.onellenorzes.filter((j) => j.sulyos).length * 3 + l.onellenorzes.filter((j) => !j.sulyos).length, 0) };
fs.writeFileSync(`${ki}_vak.json`, JSON.stringify(ossz, null, 1));
await b.close();
console.log('VAK', path.basename(forras), 'lap', lapok.length, 'súlyos', lapok.reduce((t, l) => t + l.onellenorzes.filter((j) => j.sulyos).length, 0), 'figyelem', lapok.reduce((t, l) => t + l.onellenorzes.filter((j) => !j.sulyos).length, 0), 'nincsFal-él', lapok.reduce((t, l) => t + l.nincsFal, 0), hibak.length ? 'HIBÁK ' + hibak.length : '');
