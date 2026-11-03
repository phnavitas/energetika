/**
 * Rajzpecsét (szövegmező) adatainak kinyerése a tervlapról: a címke alatti (balra igazított) vagy mellette lévő érték.
 * Projekt neve, építés helyszíne (cím), helyrajzi szám, ±0,00 szint, építtető / megrendelő, felelős tervező, terv neve,
 * típusa, dátuma, léptéke.
 */
import type { Szoveg } from './kinyeres';
import { szovegJavit } from './alaprajz';

export interface PecsetAdat {
  projekt?: string; helyszin?: string; hrsz?: string; szint?: string;
  epitteto?: string; epittetoCim?: string; megrendelo?: string; tervezo?: string; tervezoNy?: string; iroda?: string;
  tervNev?: string; tervTipus?: string; datum?: string; leptek?: string;
  cim?: { irsz: string; telepules: string; kozterulet: string; jelleg: string; hazszam: string };
}

const CIMKEK: [keyof PecsetAdat, RegExp, 'alatta' | 'mellette'][] = [
  ['projekt', /^(projekt|projekt neve|beruházás|tárgy|munka megnevezése|épület megnevezése|létesítmény|építmény|terv|munka|tervezési feladat)$/, 'alatta'],
  ['helyszin', /^(építés helyszíne|építkezés helyszíne|építési helyszín|helyszín|építési hely|építés helye|cím, hrsz|helyszín, hrsz)$/, 'alatta'],
  ['hrsz', /^(helyrajzi szám|hrsz\.?)$/, 'alatta'],
  ['szint', /^(épület )?±0,00 szintje$/, 'alatta'],
  ['epitteto', /^építtető$/, 'alatta'],
  ['megrendelo', /^megrendelő$/, 'alatta'],
  ['iroda', /^(fővállalkozó tervező|generáltervező|tervező iroda|tervező cég)$/, 'alatta'],
  ['tervezo', /^(felelős építész tervező|vezető tervező|felelős tervező|vezető építész tervező)$/, 'mellette'],
  // ennek hiányában a „tervező” / „építész tervező” címke
  ['tervezo', /^(építész tervező|tervező|építész)$/, 'mellette'],
  ['tervTipus', /^(terv ?típusa?|tervfajta|terv fajtája|tervfázis|munkarész)$/, 'alatta'],
  ['tervNev', /^(terv neve|rajz neve|tervlap neve|rajz|rajz megnevezése|tervlap)$/, 'alatta'],
  ['datum', /^dátum$/, 'alatta'],
  ['leptek', /^(lépték|méretarány)$/, 'alatta'],
];
const norm = (s: string) => szovegJavit(s).trim().toLowerCase().replace(/[:.]$/, '').replace(/\s+/g, ' ');
const MINDEN_CIMKE = /^(terv|tervfajta|tervező|rajzszám|munka|munka megnevezése|épület megnevezése|építkezés helyszíne|építési helyszín|megjegyzések?|rajz|terv típus|generáltervező|építész tervező|felelős tervező|vezető tervező|építész|ellenőrizte|tervlapkód.*|projekt|építés helyszíne|helyrajzi szám|(épület )?±0,00 szintje|építtető|megrendelő|fővállalkozó tervező|generáltervező|tervezők|terv típusa|terv neve|fájlnév|tervlap mérete|lépték|oldalszám|azonosító szám|dátum|revíziótörténet|cím|tel|telefon|email|e-mail|kelte|hatálya|étdr iratazonosító|név és engedély szám)$/;
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
        if (!ertek.length) {
          // „Terv:  CSALÁDI HÁZ ÉPÍTÉSE” – az érték a címke mellett (azonos sorban), és alatta, vele egy vonalban folytatódhat
          const m0 = vizszintes.filter((t) => t !== l && Math.abs(t.y - l.y) < 2 && t.x > l.x + l.szel - 1 && t.x < l.x + l.szel + 120 && !cimkeE(t)).sort((a, b) => a.x - b.x)[0];
          if (m0) {
            ertek = [m0];
            if (kulcs === 'projekt' || kulcs === 'helyszin' || kulcs === 'tervTipus') {
              for (let k = 0, y = m0.y; k < 3; k++) {
                const kov = vizszintes.find((t) => Math.abs(t.x - m0.x) < 3 && t.y > y + 2 && t.y < y + m0.meret * 2 && !cimkeE(t));
                if (!kov || vizszintes.some((c) => cimkeE(c) && Math.abs(c.y - kov.y) < 2 && c.x < kov.x && c.x > l.x - 3)) break;
                ertek.push(kov); y = kov.y;
              }
            } else if (kulcs === 'epitteto' || kulcs === 'megrendelo') {
              const kov = vizszintes.find((t) => Math.abs(t.x - m0.x) < 3 && t.y > m0.y + 2 && t.y < m0.y + m0.meret * 2 && !cimkeE(t));
              if (kov) ki.epittetoCim ??= szovegJavit(kov.s).trim();
            }
          }
        }
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
            if (nyj && !ki.tervezo) ki.tervezoNy = nyj.s.trim();
          }
        }
        const ny = ertek[0] && vizszintes.find((t) => Math.abs(t.x - ertek[0]!.x) < 3 && t.y > ertek[0]!.y + 2 && t.y < ertek[0]!.y + 14);
        if (!ki.tervezo && ny && /^[A-ZÉ]{1,3}(-[A-Z]{1,2})?\s*\d{2}-\d{3,6}$/.test(ny.s.trim())) ki.tervezoNy = ny.s.trim();
      }
      const s = ertek.map((t) => szovegJavit(t.s).trim()).join(' ').replace(/\s+/g, ' ').trim();
      if (s && s !== '-' && !ki[kulcs]) { (ki as Record<string, unknown>)[kulcs] = s; break; }
    }
  }
  // egy szövegben „címke: érték” (pl. „ÉPÍTTETŐ: SZENDREI EDINA”, „- TERVEZŐ: MANDEL GÁBOR É11-0308”)
  for (const t of vizszintes) {
    const m = /^[-–\s]*(építtető|megrendelő|felelős (?:építész )?tervező|vezető tervező|tervező)\s*:\s*(.+)$/i.exec(szovegJavit(t.s).trim()); if (!m) continue;
    const c = m[1]!.toLowerCase(), v = m[2]!.trim();
    if ((c === 'építtető') && !ki.epitteto) ki.epitteto = v;
    else if (c === 'megrendelő' && !ki.megrendelo) ki.megrendelo = v;
    else if (/tervező/.test(c) && !ki.tervezo) { const ny = /\s([A-ZÉ]{1,3}(?:-[A-Z]{1,2})?\s*-?\s*\d{2}-\d{3,6})$/.exec(v); ki.tervezo = ny ? v.slice(0, ny.index).trim() : v; if (ny) ki.tervezoNy ??= ny[1]!.trim(); }
  }
  for (const k of ['epitteto', 'megrendelo'] as const) if (ki[k]) ki[k] = ki[k]!.replace(/^(név|neve)\s*:\s*/i, '');
  for (const k of ['epitteto', 'megrendelo', 'projekt', 'helyszin'] as const) if (ki[k]) ki[k] = ki[k]!.replace(/\s+,/g, ',').replace(/[,;]\s*$/, '').trim();
  // a helyrajzi szám csak szám lehet („0739/17”, „1709”) – a címke alatti más címke nem az
  if (ki.hrsz && !/^\s*(hrsz\.?\s*:?\s*)?\d+(?:\/[0-9A-Z]+)*\s*$/i.test(ki.hrsz)) delete ki.hrsz;
  // helyszín a projekt megnevezéséből, ill. bárhol a lapon: „2890 TATA, FAZEKAS UTCA 5. 1709 HRSZ.” (az építtető címe nem)
  if (!ki.helyszin) {
    const CIM = /(\d{4})\.?\s+([A-ZÁÉÍÓÖŐÚÜŰ][\p{L}-]+)\s*,\s*([\p{L}. -]+?\s(?:utca|u\.|út|tér|köz|sor|sétány|krt\.?|körút|dűlő|fasor|lakótelep|ltp\.?|park|rakpart|liget))\s*(\d+[\w/.-]*)?/iu;
    const HRSZ = /(?:hrsz\.?\s*:?\s*(\d+(?:\/[0-9A-Z]+)*))|(?:(\d+(?:\/[0-9A-Z]+)*)\s*hrsz)/i;
    // a szövegelemek soronként összefűzve (a hrsz gyakran külön elem ugyanabban a sorban)
    const sorok: string[] = [];
    for (const t of vizszintes) { const sor = vizszintes.filter((u) => Math.abs(u.y - t.y) < 1.5 && Math.abs(u.meret - t.meret) < 1 && u.x >= t.x && u.x < t.x + t.szel + 300).sort((a, b) => a.x - b.x); sorok.push(sor.map((u) => szovegJavit(u.s)).join(' ')); }
    const jeloltek = [ki.projekt ?? '', ...sorok].filter((x) => CIM.test(x) && !/(cím|tel|e-?mail)\s*:/i.test(x) && (!ki.epittetoCim || !x.includes(ki.epittetoCim)));
    const v = jeloltek.find((x) => HRSZ.test(x)) ?? jeloltek[0];
    if (v) {
      const m = CIM.exec(v)!; const h = HRSZ.exec(v);
      const nagy = (x: string) => x.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_q, a: string, b: string) => a + b.toUpperCase());
      ki.helyszin = `${m[1]} ${nagy(m[2]!)}, ${nagy(m[3]!).replace(/\b(Utca|Út|Tér|Köz|Sor|Sétány|Körút|Dűlő|Fasor|Lakótelep|Park|Rakpart|Liget)\b/, (x) => x.toLowerCase()).replace(/\bU\.$/, 'utca')}${m[4] ? ` ${m[4].replace(/\.$/, '')}` : ''}`;
      if (h && !ki.hrsz) ki.hrsz = h[1] ?? h[2];
      if (ki.projekt && ki.projekt.includes(m[0])) ki.projekt = ki.projekt.slice(0, ki.projekt.indexOf(m[0])).replace(/[\s,;-]+$/, '').trim() || ki.projekt;
    }
  }
  if (ki.helyszin) {
    // „H-2800 Tatabánya, Petőfi Sándor utca Hrsz.: 6151/152” → cím + hrsz
    const h = /,?\s*hrsz\.?\s*:?\s*([0-9]+(?:\/[0-9A-Z]+)*)\s*\.?\s*$/i.exec(ki.helyszin);
    if (h) { ki.hrsz ??= h[1]; ki.helyszin = ki.helyszin.slice(0, h.index).replace(/[,;]\s*$/, '').trim(); }
    ki.helyszin = ki.helyszin.replace(/^H\s*-\s*(?=\d{4}\b)/, '');
    ki.cim = cimBont(ki.helyszin);
    // utca nélküli helyszín („2800 Tatabánya HRSZ 0739/17” → „2800 Tatabánya”): irányítószám és település
    if (!ki.cim) { const m = /^(\d{4})\s+([\p{L} -]+?)\s*$/u.exec(ki.helyszin); if (m) ki.cim = { irsz: m[1]!, telepules: m[2]!, kozterulet: '', jelleg: '', hazszam: '' }; }
  }
  if (ki.hrsz) ki.hrsz = ki.hrsz.replace(/^hrsz\.?:?\s*/i, '');
  if (!ki.szint) {
    // „±0,00 = 152,06 mBf” a szövegmezőben bárhol
    const t = vizszintes.find((x) => /[±+]\s*0[,.]00\s*m?\s*=\s*\d/.test(x.s));
    if (t) ki.szint = t.s.replace(/^.*?=\s*/, '').trim();
  }
  return ki;
}
