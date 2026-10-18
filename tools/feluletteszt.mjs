import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
const [,, url, ki] = process.argv;
const b = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: chromium.args, headless: true });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900 });
const hibak = [], naplo = [];
p.on('pageerror', (e) => hibak.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') hibak.push(m.text()); });
const var_ = (ms) => new Promise((r) => setTimeout(r, ms));
const kattint = async (szoveg, sel = 'button') => {
  const ok = await p.evaluate((s, sel) => { const l = [...document.querySelectorAll(sel)].filter((x) => !x.disabled); const el = l.find((x) => x.textContent.replace('·', '').trim() === s) ?? l.find((x) => x.textContent.trim().includes(s)); el?.click(); return !!el; }, szoveg, sel);
  if (!ok) throw new Error('Nincs gomb: ' + szoveg);
  await var_(400);
};
const kep = async (n) => { await p.evaluate(() => window.scrollTo(0, 0)); await p.screenshot({ path: `${ki}/${n}.png`, fullPage: true }); };
const szoveg = () => p.evaluate(() => document.body.innerText);
const ellenoriz = async (nev, felt) => { const ok = await felt(); naplo.push(`${ok ? '✓' : '✗'} ${nev}`); };
const gepel = async (sel, s) => { await p.$eval(sel, (el) => { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); }); await p.type(sel, s); };

await p.goto(url, { waitUntil: 'networkidle0' });
await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: 'networkidle0' });
await kep('01-belepes');
await ellenoriz('belépő képernyő', async () => (await szoveg()).includes('Folytatás belépés nélkül'));
await gepel('input[type=email]', 'anna@iroda.hu'); await gepel('input[type=password]', 'rossz');
await kattint('Belépés', 'button[type=submit]'); await var_(300);
await ellenoriz('hibás jelszó üzenet', async () => (await szoveg()).includes('Hibás e-mail cím vagy jelszó'));
await gepel('input[type=password]', 'jelszo123'); await kattint('Belépés', 'button[type=submit]'); await var_(600);
await kep('02-iroda-letrehozas');
await ellenoriz('iroda létrehozás képernyő', async () => (await szoveg()).includes('Iroda létrehozása'));
await gepel('input[type=text]', 'PH Navitas Kft.'); await kattint('Iroda létrehozása', 'button[type=submit]'); await var_(800);
await ellenoriz('projektek nézet, üres lista', async () => (await szoveg()).includes('még nincs mentett projekt'));
await kep('03-projektek-ures');
await kattint('A szerkesztett projekt mentése újként'); await var_(600);
await ellenoriz('mentve állapot', async () => (await szoveg()).includes('Mentve '));
await kattint('Rétegrendek', '.lepesek button'); await var_(300);
// első réteg vastagságának módosítása
await p.evaluate(() => { const i = document.querySelector('.retegek-tabla input.szammezo'); i.focus(); i.value = '2,5'; i.dispatchEvent(new Event('input', { bubbles: true })); i.blur(); });
await var_(200);
await ellenoriz('módosítva állapot', async () => (await szoveg()).includes('Módosítva') || (await szoveg()).includes('Mentés…'));
await var_(2000);
await ellenoriz('automatikus mentés lefutott', async () => (await p.evaluate(() => window.__hamis.hivasok.includes('ment'))) && (await szoveg()).includes('Mentve '));
await ellenoriz('verzió 2 a szerveren', async () => (await p.evaluate(() => window.__hamis.projektek[0].verzio)) === 2);
await kattint('Mentés a könyvtárba'); await var_(400);
await ellenoriz('rétegrend a könyvtárban', async () => (await p.evaluate(() => window.__hamis.retegrendek.length)) === 1);
await kep('04-retegrend-konyvtarba');
// könyvtár: új anyag
await kattint('Irodai könyvtár', '.masodlagos button'); await var_(300);
await kattint('Új anyag'); await var_(200);
await p.evaluate(() => {
  const inp = [...document.querySelectorAll('form.kartya input[type=text]')];
  const set = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
  set(inp[0], 'Grafitos EPS 80 (próba)');
  set(document.querySelector('form.kartya input.szammezo'), '0,031');
  set(inp[inp.length - 1], 'TNY 0123-CPR-2024');
});
await var_(200);
await kep('05-konyvtar-uj-anyag');
await kattint('Mentés', 'form.kartya button[type=submit]'); await var_(500);
await ellenoriz('anyag elmentve', async () => (await p.evaluate(() => window.__hamis.anyagok.length)) === 1 && (await szoveg()).includes('Grafitos EPS 80'));
await kattint('Rétegrendek ('); await var_(200);
await kep('06-konyvtar-retegrendek');
// rétegrend-építőben megjelenik az irodai anyag
await kattint('Rétegrendek', '.lepesek button'); await var_(300);
await ellenoriz('irodai anyag a legördülőben', async () => p.evaluate(() => [...document.querySelectorAll('.retegek-tabla optgroup')].some((g) => g.label === 'Irodai könyvtár')));
await p.evaluate(() => { const s = document.querySelector('.retegek-tabla select'); const o = [...s.options].find((x) => x.textContent.includes('Grafitos')); s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })); });
await var_(1800);
await ellenoriz('anyag-pillanatkép a projektben', async () => p.evaluate(() => (window.__hamis.projektek[0].dokumentum.anyagok ?? []).some((a) => a.nev.includes('Grafitos'))));
// ütközés
await p.evaluate(() => { window.__hamis.projektek[0].verzio += 5; });
await p.evaluate(() => { const i = document.querySelector('.retegek-tabla input.szammezo'); i.focus(); i.value = '3'; i.dispatchEvent(new Event('input', { bubbles: true })); i.blur(); });
await var_(2000);
await ellenoriz('ütközés jelzése', async () => (await szoveg()).includes('valaki más is módosította'));
await kep('07-utkozes');
await kattint('Az enyém'); await var_(800);
await ellenoriz('ütközés feloldva, mentve', async () => !(await szoveg()).includes('valaki más is módosította') && (await szoveg()).includes('Mentve '));
// eredmény: rögzítés
await kattint('Eredmény', '.lepesek button'); await var_(300);
await kattint('XML előnézet letöltése'); await var_(800);
await ellenoriz('számítás rögzítve', async () => (await p.evaluate(() => window.__hamis.szamitasok.length)) === 1);
// iroda: meghívás
await kattint('Iroda', '.masodlagos button'); await var_(400);
await gepel('input[type=email]', 'Kollega@Iroda.hu'); await kattint('Meghívás', 'button[type=submit]'); await var_(400);
await ellenoriz('meghívó felvéve', async () => (await szoveg()).includes('kollega@iroda.hu'));
await kep('08-iroda');
await kattint('Projektek', '.masodlagos button'); await var_(400);
await kattint('Új üres projekt'); await var_(600);
await kattint('Projektek', '.masodlagos button'); await var_(400);
await kep('09-projektek');
await ellenoriz('két projekt a listában', async () => (await p.evaluate(() => document.querySelectorAll('.projekt-tabla tbody tr').length)) === 2);
// mobil nézet
await p.setViewport({ width: 390, height: 844 }); await var_(300);
await kep('10-mobil-projektek');
await kattint('Kilépés'); await var_(500);
await ellenoriz('kilépés után belépő képernyő', async () => (await szoveg()).includes('Folytatás belépés nélkül'));
await kattint('Folytatás belépés nélkül'); await var_(400);
await ellenoriz('helyi mód működik', async () => (await szoveg()).includes('Összesített energetikai jellemző'));
console.log(naplo.join('\n'));
console.log(JSON.stringify({ hibak }));
await b.close();
