/**
 * Méretvonal-ellenőrzés: a raszterből mért külső falhosszat a homlokzaton kívüli méretláncok (kótavonalak)
 * értékeivel veti össze. A tervek szinte mindig tartalmaznak a helyiségek belső méretét mutató külső méretláncot;
 * ha a mért hosszhoz közeli kótaérték a szakasz vetületében áll, a kótaértéket vesszük (pontos tervi méret).
 */
import type { Szoveg } from './kinyeres';
import type { Raszter } from './raszter';
import { szovegJavit } from './alaprajz';

interface Kota { ertek: number; cx: number; cy: number; fuggo: boolean }

function kozeppont(t: Szoveg) {
  const th = t.szog * Math.PI / 180;
  const dir = [Math.cos(th), -Math.sin(th)] as const, fel = [-Math.sin(th), -Math.cos(th)] as const;
  return { cx: t.x + dir[0] * t.szel / 2 + fel[0] * t.meret * 0.35, cy: t.y + dir[1] * t.szel / 2 + fel[1] * t.meret * 0.35 };
}

/** Méretszámok: „3,20” (m), „3,79⁵” (a felső indexes 5 mm elhagyva), „70”, „15” (cm). */
export function kotak(sz: Szoveg[]): Kota[] {
  const ki: Kota[] = [];
  for (const t of sz) {
    const s = szovegJavit(t.s);
    const fuggo = Math.abs(Math.abs(t.szog) - 90) < 3; if (!fuggo && Math.abs(t.szog) > 3) continue;
    let ertek: number | null = null;
    if (/^\d{1,2},\d{2}$/.test(s)) ertek = Number(s.replace(',', '.'));
    else if (/^\d{2,3}$/.test(s) && Number(s) >= 10 && Number(s) < 100) ertek = Number(s) / 100;
    if (ertek === null) continue;
    const { cx, cy } = kozeppont(t);
    ki.push({ ertek, cx, cy, fuggo });
  }
  return ki;
}

/**
 * A raszter külső falszakaszainak hosszát a kótákhoz igazítja (helyben módosít). Visszaadja az igazított szakaszok számát.
 */
export function kotaEllenoriz(r: Raszter, sz: Szoveg[]): number {
  const k = kotak(sz);
  let db = 0;
  for (const H of r.helyisegek) for (const s of H.szakaszok) {
    if (s.tul !== 'kulso' || s.hossz < 0.3 || !s.pontok.length) continue;
    const vizsz = s.irany === 0 || s.irany === 180;
    const menti = s.pontok.map((p) => (vizsz ? p[0] : p[1]));
    const kereszt = s.pontok.map((p) => (vizsz ? p[1] : p[0]));
    const a = Math.min(...menti), b = Math.max(...menti);
    const sik = s.irany === 0 || s.irany === 270 ? Math.min(...kereszt) : Math.max(...kereszt);
    const kifele = s.irany === 0 || s.irany === 270 ? -1 : 1;
    const span = (b - a) * r.mPerPt + r.px;
    const max = 9 / r.mPerPt;
    let leg: Kota | null = null;
    for (const q of k) {
      // a homlokzattal párhuzamos méretlánc: vízszintes homlokzatnál vízszintes szám, függőlegesnél elforgatott
      if (q.fuggo === vizsz) continue;
      const m = vizsz ? q.cx : q.cy, x = vizsz ? q.cy : q.cx;
      const tav = (x - sik) * kifele; if (tav < 0.3 / r.mPerPt || tav > max) continue;
      if (m < a - 0.1 / r.mPerPt || m > b + 0.1 / r.mPerPt) continue;
      // a szám a szakasz közepe táján áll (a méretlánc egy szakaszának közepére írják)
      const kozep = (a + b) / 2; if (Math.abs(m - kozep) > (b - a) * 0.35 + 0.15 / r.mPerPt) continue;
      if (q.ertek > span + 0.12 || Math.abs(q.ertek - s.hossz) > Math.max(0.3, s.hossz * 0.1)) continue;
      if (!leg || Math.abs(q.ertek - s.hossz) < Math.abs(leg.ertek - s.hossz)) leg = q;
    }
    if (leg) { s.meres = s.hossz; s.kota = leg.ertek; s.hossz = leg.ertek; db++; }
  }
  return db;
}
