/**
 * Rajzpecsét (szövegmező) adatainak kinyerése a tervlapról: a címke alatti (balra igazított) vagy mellette lévő érték.
 * Projekt neve, építés helyszíne (cím), helyrajzi szám, ±0,00 szint, építtető / megrendelő, felelős tervező, terv neve,
 * típusa, dátuma, léptéke.
 */
import type { Szoveg } from './kinyeres';
import { szovegJavit } from './alaprajz';

export interface PecsetAdat {
  projekt?: string; helyszin?: string; hrsz?: string; szint?: string;
  epitteto?: string; megrendelo?: string; tervezo?: string; tervezoNy?: string; iroda?: string;
  tervNev?: string; tervTipus?: string; datum?: string; leptek?: string;
  cim?: { irsz: string; telepules: string; kozterulet: string; jelleg: string; hazszam: string };
}

const CIMKEK: [keyof PecsetAdat, RegExp, 'alatta' | 'mellette'][] = [
  ['projekt', /^(projekt|projekt neve|beruházás|tárgy|munka megnevezése|épület megnevezése|létesítmény|építmény)$/, 'alatta'],
  ['helyszin', /^(építés helyszíne|építkezés helyszíne|építési helyszín|helyszín|építési hely|építés helye|cím, hrsz|helyszín, hrsz)$/, 'alatta'],
  ['hrsz', /^(helyrajzi szám|hrsz\.?)$/, 'alatta'],
  ['szint', /^(épület )?±0,00 szintje$/, 'alatta'],
  ['epitteto', /^építtető$/, 'alatta'],
  ['megrendelo', /^megrendelő$/, 'alatta'],
  ['iroda', /^(fővállalkozó tervező|generáltervező|tervező iroda|tervező cég)$/, 'alatta'],
  ['tervezo', /^(felelős építész tervező|vezető tervező|felelős tervező)$/, 'mellette'],
  ['tervTipus', /^terv ?típusa?$/, 'alatta'],
  ['tervNev', /^(terv neve|rajz neve|tervlap neve|rajz|rajz megnevezése|tervlap)$/, 'alatta'],
  ['datum', /^dátum$/, 'alatta'],
  ['leptek', /^(lépték|méretarány)$/, 'alatta'],
];
const norm = (s: string) => szovegJavit(s).trim().toLowerCase().replace(/[:.]$/, '').replace(/\s+/g, ' ');
const MINDEN_CIMKE = /^(munka megnevezése|épület megnevezése|építkezés helyszíne|építési helyszín|megjegyzések?|rajz|terv típus|generáltervező|építész tervező|felelős tervező|vezető tervező|építész|ellenőrizte|tervlapkód.*|projekt|építés helyszíne|helyrajzi szám|(épület )?±0,00 szintje|építtető|megrendelő|fővállalkozó tervező|generáltervező|tervezők|terv típusa|terv neve|fájlnév|tervlap mérete|lépték|oldalszám|azonosító szám|dátum|revíziótörténet|cím|tel|telefon|email|e-mail|kelte|hatálya|étdr iratazonosító|név és engedély szám)$/;
const JELLEG: Record<string, string> = { 'u': 'utca', 'u.': 'utca', 'utca': 'utca', 'út': 'út', 'krt': 'körút', 'krt.': 'körút', 'körút': 'körút', 'tér': 'tér', 'köz': 'köz', 'sor': 'sor', 'sétány': 'sétány', 'dűlő': 'dűlő', 'lakótelep': 'lakótelep', 'ltp': 'lakótelep', 'ltp.': 'lakótelep', 'fasor': 'fasor', 'park': 'park', 'tere': 'tér', 'liget': 'liget', 'rakpart': 'rakpart' };

/** „2831 Tarján, Kenderesi u. 33.” → részek. */
export function cimBont(s: string): PecsetAdat['cim'] | undefined {
  const m = /^\s*(\d{4})\s+([^,]+?)\s*,\s*(.+?)\s*$/.exec(s);
  if (!m) return undefined;
  const tobbi = m[3]!.trim();
  const sz = tobbi.split(/\s+/);
  let ji = -1;
  for (let i = sz.length - 1; i >= 0; i--) if (JELLEG[sz[i]!.toLowerCase()]) { ji = i; break; }
  if (ji < 0) return { irsz: m[1]!, telepules: m[2]!, kozterulet: tobbi, jelleg: '', hazszam: '' };
  return { irsz: m[1]!, telepules: m[2]!, kozterulet: sz.slice(0, ji).join(' '), jelleg: JELLEG[sz[ji]!.toLowerCase()]!, hazszam: sz.slice(ji + 1).join(' ').replace(/\.$/, '') };
}

export function pecsetKinyer(szovegek: Szoveg[]): PecsetAdat {
  const vizszintes = szovegek.filter((t) => Math.abs(t.szog) < 2 && t.s.trim());
  const ki: PecsetAdat = {};
  const cimkeE = (t: Szoveg) => MINDEN_CIMKE.test(norm(t.s));
  for (const [kulcs, re, hol] of CIMKEK) {
    const L = vizszintes.filter((t) => re.test(norm(t.s)));
    for (const l of L) {
      let ertek: Szoveg[] = [];
      if (hol === 'alatta') {
        // a címke alatt, balra igazítva (± 6 pt), legfeljebb ~4 sornyira; a következő címkéig
        const alatta = vizszintes.filter((t) => t !== l && t.meret >= 3 && Math.abs(t.x - l.x) < 6 && t.y > l.y + l.meret * 0.3 && t.y < l.y + Math.max(30, l.meret * 5)).sort((a, b) => a.y - b.y);
        const elso = alatta.findIndex((t) => cimkeE(t));
        ertek = (elso < 0 ? alatta : alatta.slice(0, elso)).slice(0, 1);
        // azonos sorban folytatódó szöveg (pl. „Földszinti alaprajz - "A"” + „épület”)
        if (ertek[0]) { const e0 = ertek[0]; ertek.push(...vizszintes.filter((t) => t !== e0 && Math.abs(t.y - e0.y) < 1.5 && t.x > e0.x && t.x < e0.x + e0.szel + e0.meret * 1.5 && Math.abs(t.meret - e0.meret) < 1).sort((a, b) => a.x - b.x)); }
      } else {
        const mellette = vizszintes.filter((t) => Math.abs(t.y - l.y) < 2 && t.x > l.x + 20 && t.x < l.x + 200 && !cimkeE(t)).sort((a, b) => a.x - b.x);
        ertek = mellette.slice(0, 1);
        if (!ertek.length) {
          // név a címke alatt, mellette a névjegyzéki szám (pl. „Páll Ákos  É 11-0297”)
          const al = vizszintes.filter((t) => Math.abs(t.x - l.x) < 6 && t.y > l.y + 2 && t.y < l.y + Math.max(16, l.meret * 2.5) && !cimkeE(t)).sort((a, b) => a.y - b.y)[0];
          if (al) {
            ertek = [al];
            const nyj = vizszintes.find((t) => Math.abs(t.y - al.y) < 1.5 && t.x > al.x && t.x < al.x + al.szel + 40 && /^[A-ZÉ]{1,3}(-[A-Z]{1,2})?\s*\d{2}-\d{3,6}$/.test(t.s.trim()));
            if (nyj) ki.tervezoNy = nyj.s.trim();
          }
        }
        const ny = ertek[0] && vizszintes.find((t) => Math.abs(t.x - ertek[0]!.x) < 3 && t.y > ertek[0]!.y + 2 && t.y < ertek[0]!.y + 14);
        if (ny && /^[A-ZÉ]{1,3}(-[A-Z]{1,2})?\s*\d{2}-\d{3,6}$/.test(ny.s.trim())) ki.tervezoNy = ny.s.trim();
      }
      const s = ertek.map((t) => szovegJavit(t.s).trim()).join(' ').replace(/\s+/g, ' ').trim();
      if (s && s !== '-' && !ki[kulcs]) { (ki as Record<string, unknown>)[kulcs] = s; break; }
    }
  }
  for (const k of ['epitteto', 'megrendelo', 'projekt', 'helyszin'] as const) if (ki[k]) ki[k] = ki[k]!.replace(/\s+,/g, ',').replace(/[,;]\s*$/, '').trim();
  if (ki.helyszin) {
    // „H-2800 Tatabánya, Petőfi Sándor utca Hrsz.: 6151/152” → cím + hrsz
    const h = /,?\s*hrsz\.?\s*:?\s*([0-9]+(?:\/[0-9A-Z]+)*)\s*$/i.exec(ki.helyszin);
    if (h) { ki.hrsz ??= h[1]; ki.helyszin = ki.helyszin.slice(0, h.index).replace(/[,;]\s*$/, '').trim(); }
    ki.helyszin = ki.helyszin.replace(/^H\s*-\s*(?=\d{4}\b)/, '');
    ki.cim = cimBont(ki.helyszin);
  }
  if (ki.hrsz) ki.hrsz = ki.hrsz.replace(/^hrsz\.?:?\s*/i, '');
  if (!ki.szint) {
    // „±0,00 = 152,06 mBf” a szövegmezőben bárhol
    const t = vizszintes.find((x) => /±\s*0[,.]00\s*=\s*\d/.test(x.s));
    if (t) ki.szint = t.s.replace(/^.*?=\s*/, '').trim();
  }
  return ki;
}
