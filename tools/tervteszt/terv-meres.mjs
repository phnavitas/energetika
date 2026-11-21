// Tervből lépés fej nélküli futtatása egy minta PDF-lapjain (Playwright, a vite preview ellen).
// Kimenet: <ki>.json (a projekt az átvétel után), <ki>_epulet.json (épületmodell), <ki>_modell3d.json, <ki>.log
// Használat: PORT=4181 node tools/tervteszt/terv-meres.mjs <pdf-mappa> <ki-előtag>
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require('/usr/local/lib/node_modules/playwright'); }
const [dir, ki] = process.argv.slice(2);
const fajlok = fs.readdirSync(dir).filter((f) => /\.pdf$/i.test(f)).sort().map((f) => path.join(dir, f));
const b = await pw.chromium.launch();
const p = await b.newPage({ viewport: { width: 1500, height: 1000 } });
const hibak = []; p.on('pageerror', (e) => hibak.push(String(e)));
const log = []; const L = (...x) => { log.push(x.join(' ')); };
p.on('console', (m) => { if (/munkaszál/.test(m.text())) L('KONZOL', m.text().slice(0, 200)); });
const v = (ms) => new Promise((r) => setTimeout(r, ms));
const k = async (szoveg, hol = 'button') => { const e = p.locator(hol, { hasText: szoveg }).first(); await e.click({ timeout: 15000 }); };
await p.goto(`http://localhost:${process.env.PORT ?? 4181}/`, { waitUntil: 'networkidle' });
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('ekm-profil', JSON.stringify({ nev: 'Teszt', jogosultsag: 'TÉ 11-0000', email: '', telefon: '', kamara: 'MEK' })); });
await p.reload({ waitUntil: 'networkidle' });
try { await k('Folytatás belépés nélkül'); } catch { /* */ } await v(300);
await k('Új projekt'); await v(300); await k('Üres projekt indítása'); await v(500);
await k('Tervből', '.lepesek button'); await v(300);
await p.locator('main input[type=file]').first().setInputFiles(fajlok);
for (let i = 0; i < 400; i++) {
  const kesz = await p.evaluate(() => [...document.querySelectorAll('main button')].some((x) => /Összes kijelölt alaprajz átvétele|Átvétel a projektbe/.test(x.textContent) && !x.disabled) && !document.querySelector('.halad'));
  if (kesz) break; await v(3000);
}
await v(1500);
L('LAPOK', await p.evaluate(() => [...document.querySelectorAll('main table')][0]?.innerText.replace(/\n/g, ' | ').slice(0, 3000) ?? ''));
L('FIGY', (await p.evaluate(() => [...document.querySelectorAll('.figyelmeztetes')].map((d) => d.innerText).join(' | '))));
const ep = await p.evaluate(() => { try { return globalThis.__epulet?.() ?? null; } catch (e) { return { hiba: String(e) }; } });
fs.writeFileSync(`${ki}_epulet.json`, JSON.stringify(ep));
const szm = await p.evaluate(() => { try { return globalThis.__szobaMag?.() ?? null; } catch (e) { return { hiba: String(e) }; } }); L("SZOBAMAG", JSON.stringify(szm));
const m3 = await p.evaluate(() => { try { return globalThis.__modell3d?.() ?? null; } catch (e) { return { hiba: String(e) }; } });
fs.writeFileSync(`${ki}_modell3d.json`, JSON.stringify(m3));
// átvétel
const osszes = await p.evaluate(() => [...document.querySelectorAll('main button')].some((x) => /Összes kijelölt alaprajz átvétele/.test(x.textContent)));
await k(osszes ? 'Összes kijelölt alaprajz átvétele' : 'Átvétel a projektbe'); await v(800);
try { const d = p.locator('button.gomb.fo', { hasText: /^Átvétel$/ }); if (await d.count()) await d.first().click(); } catch { /* */ }
for (let i = 0; i < 100; i++) { const x = await p.evaluate(() => localStorage.getItem('ekm-projekt-v1')); if (x && JSON.parse(x).feluletek?.length) break; await v(1000); }
await v(2500);
L('UZ', await p.evaluate(() => [...document.querySelectorAll('main li, main .kesz, main .figyelmeztetes')].map((d) => d.innerText).filter((t) => t.length > 8).slice(0, 80).join(' | ')));
const proj = await p.evaluate(() => localStorage.getItem('ekm-projekt-v1'));
fs.writeFileSync(`${ki}.json`, proj ?? 'null');
L('HIBAK', JSON.stringify(hibak));
fs.writeFileSync(`${ki}.log`, log.join('\n'));
await b.close();
console.log('kész', ki, hibak.length ? 'HIBÁK: ' + hibak.length : '');
