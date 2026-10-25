/**
 * Metszet elemzése (2. kör): rétegrend-feliratok („F01 KÜLSŐ FAL RÉTEGREND” fejléc alatt „vastagság + megnevezés”
 * sorok), a szerkezet szerepe és rétegei az anyagkatalógusra képezve; szintmagasság-jelek alapján szintszám és belmagasság.
 */
import type { Szoveg } from './kinyeres';
import { szovegJavit, szamErtek } from './alaprajz';
import type { Szerep, RetegUI } from '../modell';

export interface TervReteg {
  /** Vastagság cm-ben; null: „--” (pl. termett talaj) vagy nincs megadva. */
  dCm: number | null;
  /** „3 rtg.” – rétegszámmal megadott vékony bevonat (festés, glett). */
  rtg?: number;
  leiras: string;
}
export interface TervRetegrend {
  kod: string; cim: string; retegek: TervReteg[];
  x: number; y: number;
}

const FEJLEC_KOD = /^[A-ZÁÉ]{1,3}[-.]?\d{1,3}[a-z]?[*'’]{0,3}$/;
const FEJLEC_CIM = /rétegrend|rétegfelépítés|réteg-?rend/i;
/** Szerkezetnév a rétegrend-fejlécben („homlokzati fal”, „emelet födém”, „zöldtető”). */
const SZERKEZET_SZO = /fal\b|fal |padló|padlo|födém|fodem|tető|teto|lemez|aljzat|szerkezet|rétegrend/i;
const VASTAG = /^(\d+(?:[,.]\d+)?)\s*(cm|mm|m)\.?$|^(\d+)\s*rtg\.?$|^-{1,3}$|^–$/i;

function vastagsag(s: string): { dCm: number | null; rtg?: number } | null {
  // „10+8 cm” → 18 cm; „2-6 cm” (lejtésben) → 4 cm átlag
  s = s.trim().replace(/^\(\s*/, '').replace(/\)+$/, '')
    // „22+ cm” (lejtésképzés: legalább) → 22 cm
    .replace(/^(\d+(?:[,.]\d+)?)\s*\+\s*(?=cm|mm|m\b)/, '$1 ')
    // „0/5 cm” (változó vastagság) → átlag
    .replace(/^(\d+(?:[,.]\d+)?)\s*\/\s*(\d+(?:[,.]\d+)?)/, (_m, a: string, b: string) => String((szamErtek(a) + szamErtek(b)) / 2).replace('.', ','))
    .replace(/^(\d+(?:[,.]\d+)?)\s*\+\s*(\d+(?:[,.]\d+)?)/, (_m, a: string, b: string) => String(szamErtek(a) + szamErtek(b)).replace('.', ','))
    .replace(/^(\d+(?:[,.]\d+)?)\s*[-–]\s*(\d+(?:[,.]\d+)?)/, (_m, a: string, b: string) => String((szamErtek(a) + szamErtek(b)) / 2).replace('.', ','));
  const m = VASTAG.exec(s);
  if (!m) return null;
  if (m[1]) { const v = szamErtek(m[1]); const e = m[2]!.toLowerCase(); return { dCm: e === 'mm' ? v / 10 : e === 'm' ? v * 100 : v }; }
  if (m[3]) return { dCm: null, rtg: Number(m[3]) };
  return { dCm: null };
}

/** Egy sorba eső szövegdarabok összefűzése (a közel érintkezőket szóköz nélkül: „hőszigetelé” + „s”). */
function sorFuz(t: Szoveg[]): string {
  const r = [...t].sort((a, b) => a.x - b.x);
  let s = '';
  for (let i = 0; i < r.length; i++) {
    const elozo = r[i - 1];
    const res = elozo ? r[i]!.x - (elozo.x + elozo.szel) : 0;
    s += (i && res > r[i]!.meret * 0.15 ? ' ' : '') + szovegJavit(r[i]!.s);
  }
  return s.replace(/\s+/g, ' ').trim();
}

/** Egy szövegdarabba írt „vastagság + leírás” („1,8 mm PVC vízszigetelés”, „5+2 cm kerámia burkolat”) két darabra bontva. */
const EGYBEN_SOR = /^(\(?\s*\d+(?:[,.]\d+)?(?:\s*[-–+/]\s*\d+(?:[,.]\d+)?)?\s*\+?\s*(?:cm|mm|m)\.?|\(?\s*\d+\s*rtg\.?)\s+(\p{L}.*)$/u;
function egybenBont(t: Szoveg): Szoveg[] {
  const m = EGYBEN_SOR.exec(t.s.trim());
  if (!m) return [t];
  const n = Math.max(1, t.s.trim().length), xL = t.x + t.szel * (t.s.trim().length - m[2]!.length) / n;
  return [{ ...t, s: m[1]!, szel: t.szel * m[1]!.length / n }, { ...t, s: m[2]!, x: xL, szel: t.x + t.szel - xL }];
}

export function retegrendBlokkok(sz: Szoveg[]): TervRetegrend[] {
  const vsz = sz.filter((t) => Math.abs(t.szog) < 2).flatMap(egybenBont);
  const fejlecek: { kod: Szoveg; cim: Szoveg }[] = [];
  for (const k of vsz) {
    const egyben = /^([A-ZÁÉ]{1,3}[-.]?\d{1,3}[a-z]?)\s+(\S.{3,})$/.exec(szovegJavit(k.s));
    if (egyben && SZERKEZET_SZO.test(egyben[2]!)) {
      const kodResz = k.szel * egyben[1]!.length / Math.max(1, szovegJavit(k.s).length);
      fejlecek.push({ kod: { ...k, s: egyben[1]!, szel: kodResz }, cim: { ...k, s: egyben[2]!, x: k.x + kodResz + k.meret * 0.3, szel: k.szel - kodResz } });
      continue;
    }
    if (!FEJLEC_KOD.test(k.s.trim())) continue;
    let cim = vsz.filter((t) => t !== k && Math.abs(t.y - k.y) < k.meret * 0.4 && t.x > k.x && t.x - (k.x + k.szel) < k.meret * 6)
      .sort((a, b) => a.x - b.x)[0];
    // a fejléc több szövegdarabból is állhat („Általános” + „FÖDÉM RÉTEGREND”)
    let cimT = cim;
    while (cimT) {
      const c = cimT;
      const kov = vsz.filter((t) => t !== c && t !== k && Math.abs(t.y - c.y) < c.meret * 0.3 && t.x > c.x + c.szel - c.meret * 0.5 && t.x - (c.x + c.szel) < c.meret * 1.5 && Math.abs(t.meret - c.meret) < c.meret * 0.15)
        .sort((a, b) => a.x - b.x)[0];
      if (!kov) break;
      cimT = { ...c, s: c.s + ' ' + kov.s, szel: kov.x + kov.szel - c.x };
      if (cimT.s.length > 80) break;
    }
    if (cimT) cim = cimT;
    if (cim && (FEJLEC_CIM.test(cim.s) || (cim.s === cim.s.toUpperCase() && /\p{L}{4}/u.test(cim.s)) || (cim.meret >= k.meret * 0.9 && SZERKEZET_SZO.test(cim.s)))) fejlecek.push({ kod: k, cim });
  }
  const ki: TervRetegrend[] = [];
  for (const { kod, cim } of fejlecek) {
    const xV = kod.x, xL0 = cim.x;
    // a blokk szélessége: a következő, azonos sorban jobbra lévő fejlécig
    // oszlopszélesség: a fejlécek oszlopainak távolsága (a legjobb szélső oszlopnál a szomszédé)
    const oszlopX = [...new Set(fejlecek.map((f) => Math.round(f.kod.x / 5) * 5))].sort((a, b) => a - b);
    const lepes = oszlopX.slice(1).map((v, i) => v - oszlopX[i]!).filter((d) => d > kod.meret * 5);
    const szel = lepes.length ? Math.min(...lepes) : kod.meret * 30;
    const jobb = fejlecek.filter((f) => f.kod !== kod && Math.abs(f.kod.y - kod.y) < kod.meret && f.kod.x > kod.x).map((f) => f.kod.x).sort((a, b) => a - b)[0] ?? kod.x + szel;
    const lent = fejlecek.filter((f) => f.kod !== kod && Math.abs(f.kod.x - kod.x) < kod.meret * 2 && f.kod.y > kod.y).map((f) => f.kod.y).sort((a, b) => a - b)[0] ?? Infinity;
    const tagok = vsz.filter((t) => t.s.trim() && t.y > kod.y + kod.meret * 0.4 && t.y < lent - kod.meret * 0.4 && t.x >= xV - kod.meret && t.x < jobb - kod.meret * 0.5 && t !== cim);
    // csak a rétegsorok betűméretével egyező szövegek (a mellette lévő rajzpecsét, megjegyzés nem)
    {
      const m = tagok.filter((t) => VASTAG.test(t.s.trim()) || /^(cm|mm|rtg\.?)$/i.test(t.s.trim()) || /^\d+(?:[,.]\d+)?$/.test(t.s.trim())).map((t) => t.meret).sort((a, b) => a - b);
      const med = m[m.length >> 1];
      if (med) for (let i = tagok.length - 1; i >= 0; i--) if (Math.abs(tagok[i]!.meret - med) > med * 0.1) tagok.splice(i, 1);
    }
    // a leírások oszlopa: a sorok betűs (nem mértékegység) szövegeinek bal széle
    const betus = tagok.filter((t) => /\p{L}{3}/u.test(t.s) && !/^(cm|mm|rtg\.?)$/i.test(t.s.trim()) && !VASTAG.test(t.s.trim()));
    // a leírásoszlop bal széle: a betűs darabok leggyakoribb kezdő x-e (egy-egy oszlopon kívül írt sor ne tolja el)
    let xL = xL0;
    if (betus.length) {
      const db = new Map<number, number>([[Math.round(xL0 / (kod.meret * 0.5)), 1]]); // a fejléc címe is szavaz
      for (const t of betus) { const kx = Math.round(t.x / (kod.meret * 0.5)); db.set(kx, (db.get(kx) ?? 0) + 1); }
      const leggy = [...db.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]![0];
      xL = Math.min(...betus.filter((t) => Math.abs(t.x / (kod.meret * 0.5) - leggy) <= 1).map((t) => t.x));
    }
    // a leírásoszlopon túl kezdődő szöveg (szomszédos rajzpecsét, megjegyzés) nem a blokk része
    for (let i = tagok.length - 1; i >= 0; i--) if (tagok[i]!.x > xL + kod.meret * 12) tagok.splice(i, 1);
    // sorokba rendezés
    const sorok: Szoveg[][] = [];
    for (const t of [...tagok].sort((a, b) => a.y - b.y)) {
      const s = sorok.find((r) => Math.abs(r[0]!.y - t.y) < t.meret * 0.45);
      if (s) s.push(t); else sorok.push([t]);
    }
    const retegek: TervReteg[] = [];
    let elozoY = kod.y;
    for (const r of sorok) {
      const y = r[0]!.y;
      if (y - elozoY > kod.meret * 2.6) break; // a blokk vége
      elozoY = y;
      // vastagság: a leírásoszloptól balra eső, betűt (a mértékegységen kívül) nem tartalmazó darabok
      const betuE = (t: Szoveg) => /\p{L}{3}/u.test(t.s.replace(/\b(cm|mm|rtg)\b\.?/gi, ''));
      const bal = r.filter((t) => t.x < xL - kod.meret * 0.3 && !betuE(t));
      const jobbR = r.filter((t) => !bal.includes(t));
      // a vastagság-oszlopban kezdődő leírás („kültéri vakolat”) önálló réteg, nem az előző folytatása
      const balraKezd = jobbR.some((t) => t.x < xL - kod.meret * 0.3);
      const v = bal.length ? vastagsag(sorFuz(bal)) : null;
      const leiras = sorFuz(jobbR).replace(/^[.,]$/, '').replace(/\)\s*\)$/, ')');
      if (!v && /:$/.test(leiras)) continue; // „vizeshelyiségben:” – feltétel-felirat
      if (!leiras && !v) continue;
      if (v) retegek.push({ ...v, leiras });
      else if (balraKezd) retegek.push({ dCm: null, leiras });
      else if (retegek.length && retegek.at(-1)!.leiras.endsWith(',')) retegek.at(-1)!.leiras += ' ' + leiras;
      else if (retegek.length && /^[a-záéíóöőúüű(]/.test(leiras)) retegek.at(-1)!.leiras += ' ' + leiras;
      else retegek.push({ dCm: null, leiras });
    }
    // valódi rétegrend-tábla: legalább két réteg vastagsággal (a rajzon álló szerkezetjelölő felirat nem ilyen)
    // (kifejezetten „rétegrend” fejlécű táblánál egy is elég)
    if (retegek.filter((r) => r.dCm !== null || r.rtg).length >= (FEJLEC_CIM.test(cim.s) ? 1 : 2)) ki.push({ kod: kod.s.trim(), cim: sorFuz([cim]).replace(/\s*rétegrend(je)?\s*$/i, '').trim(), retegek, x: kod.x, y: kod.y });
  }
  return ki;
}

// ——— szerep és anyag ———

export interface SzerepBecsles {
  szerep: Szerep | null;
  /** Nem a hőburok része (válaszfal, terasz, tetőfedés hideg padlás fölött) – alapból nem kerül át. */
  kihagy?: string;
  /** Feltételesen hőburok: terepszint alatti fűtött helyiségnél (fűtött pince) a talajjal érintkező fal, ill. padló – akkor átkerül. */
  feltetel?: 'terepAlatt';
  kovetelmenyKod: string;
  hoaramIrany: 'vizszintes' | 'felfele' | 'lefele';
  kulsoOldal: 'kulso' | 'futetlen' | 'belso';
}

export function szerepBecsles(rr: TervRetegrend, mind: TervRetegrend[]): SzerepBecsles {
  const c = (rr.cim + ' ' + rr.kod).toLowerCase();
  const reteg = rr.retegek.map((r) => r.leiras.toLowerCase()).join(' | ');
  const vanPadlasfodem = mind.some((m) => /padlásfödém|padlasfodem/i.test(m.cim));
  // rétegek sorrendje (a táblában kívülről befelé / felülről lefelé): hőszigetelés a födém fölött vagy alatt
  const fodemI = rr.retegek.map((r) => /vasbeton|födém|fodem|monolit|zárófödém/i.test(r.leiras)).lastIndexOf(true);
  const hoszI = rr.retegek.flatMap((r, i) => /hőszigetel|hoszigetel|\bxps\b|\beps\b|\bpir\b|kőzetgyapot|rockwool|ásványgyapot|üveggyapot/i.test(r.leiras) && (r.dCm ?? 0) >= 8 ? [i] : []);
  const vizsz = /vízszigetel|vizszigetel|csapadékvíz|pvc|bitumenes/i.test(reteg);
  const lapostetoRetegek = fodemI >= 0 && vizsz && hoszI.some((i) => i < fodemI);
  const alulSzigetelt = fodemI >= 0 && hoszI.some((i) => i > fodemI) && !hoszI.some((i) => i < fodemI);
  if (/terasz|erkély/.test(c) && (/tető|teto/.test(c) || lapostetoRetegek)) return { szerep: 'teto', kovetelmenyKod: 'lapostető', hoaramIrany: 'felfele', kulsoOldal: 'kulso' };
  if (/terasz|járda|erkély|burkolt felület/.test(c)) return { szerep: null, kihagy: 'Külső burkolat, nem a hőburok része.', kovetelmenyKod: '', hoaramIrany: 'lefele', kulsoOldal: 'kulso' };
  if (/válaszfal|valaszfal/.test(c)) return { szerep: 'belso', kihagy: 'Belső válaszfal – két fűtött tér között.', kovetelmenyKod: '', hoaramIrany: 'vizszintes', kulsoOldal: 'belso' };
  if (/belső teherhordó|belső fal|teherhordó fal/.test(c) && !/külső|homlokzat/.test(c)) return { szerep: 'belso', kihagy: 'Belső fal – fűtött terek között nincs hőáram (fűtetlen helyiség, pl. garázs felé a határolásnál választható).', kovetelmenyKod: '', hoaramIrany: 'vizszintes', kulsoOldal: 'belso' };
  if (/lakáselválasztó|lakaselvalaszto|elválasztó fal/.test(c)) return { szerep: 'belso', kihagy: 'Fűtött lakások közötti fal (azonos hőmérsékletű terek között nincs hőáram).', kovetelmenyKod: 'szomszedos_futott', hoaramIrany: 'vizszintes', kulsoOldal: 'belso' };
  if (/lábazat|labazat|pincefal|talajjal érintkező fal/.test(c)) return { szerep: 'fal', kihagy: 'Lábazati / talajjal érintkező fal – fűtött pince esetén a pincefal (talajjal érintkező fal) rétegrendje, egyébként a padló kerületi hőszigetelésénél (perem) vehető figyelembe.', feltetel: 'terepAlatt', kovetelmenyKod: 'talajjal_erintkezo_fal', hoaramIrany: 'vizszintes', kulsoOldal: 'kulso' };
  if (/garázs felett|garazs felett|pince felett/.test(c) && /tető|teto/.test(c)) return { szerep: null, kihagy: 'Fűtetlen garázs / pince feletti tető – nem a fűtött hőburok része.', kovetelmenyKod: '', hoaramIrany: 'felfele', kulsoOldal: 'kulso' };
  if (/garázs felett|garazs felett|pince felett|pince feletti|pincefödém/.test(c) && /födém|fodem|padló|padlo/.test(c)) return { szerep: 'pincefodem', kovetelmenyKod: 'also_zarofodem', hoaramIrany: 'lefele', kulsoOldal: 'futetlen' };
  if (/konzol|áthajtó|árkád|kiugr/.test(c) && /födém|fodem/.test(c)) return { szerep: 'pincefodem', kovetelmenyKod: 'arkadfodem', hoaramIrany: 'lefele', kulsoOldal: 'kulso' };
  if (/(emelet|közbenső|kozbenso|szintek közötti|általános)/.test(c) && /födém|fodem/.test(c) && !/padlás|padlas/.test(c)) return { szerep: 'belso', kihagy: 'Fűtött szintek közötti födém – nincs hőáram.', kovetelmenyKod: '', hoaramIrany: 'lefele', kulsoOldal: 'belso' };
  if (/padlás fal|padlas fal|padlástér felé|padlásfal/.test(c)) return { szerep: 'fal', kovetelmenyKod: 'futott_futetlen_fal', hoaramIrany: 'vizszintes', kulsoOldal: 'futetlen' };
  if (/garázs|garazs/.test(c) && /padló|padlo/.test(c)) return { szerep: 'padlo', kihagy: 'Garázs / pince padlója – csak a terepszint alatti fűtött helyiségek (pl. pincei lépcsőház, gépészet) alatt hőburok.', feltetel: 'terepAlatt', kovetelmenyKod: 'talajon_fekvo_padlo', hoaramIrany: 'lefele', kulsoOldal: 'kulso' };
  if (/pincefal|terepszint alatt|terepszint alatti/.test(c)) return { szerep: 'fal', kihagy: 'Pincefal (terepszint alatt) – fűtött pince esetén a talajjal érintkező falként kerül át.', feltetel: 'terepAlatt', kovetelmenyKod: 'talajjal_erintkezo_fal', hoaramIrany: 'vizszintes', kulsoOldal: 'kulso' };
  if (/padlásfödém|padlasfodem|zárófödém/.test(c)) return { szerep: 'padlas', kovetelmenyKod: 'padlasfodem', hoaramIrany: 'felfele', kulsoOldal: 'futetlen' };
  if (/lapostető|lapos tető|járható tető|nem járható tető|zöldtető|zöld tető|alacs\.? hajlású|alacsony hajlású/.test(c)) return { szerep: 'teto', kovetelmenyKod: 'lapostető', hoaramIrany: 'felfele', kulsoOldal: 'kulso' };
  if (/magastető|tető|teto/.test(c)) {
    if (vanPadlasfodem || /padlás|padlas/.test(c) || /padlástér|padlas/.test(reteg)) return { szerep: 'teto', kihagy: 'Hideg padlás fölötti tetőfedés – a hőburok a padlásfödém.', kovetelmenyKod: 'futott_tetoter', hoaramIrany: 'felfele', kulsoOldal: 'kulso' };
    return { szerep: 'teto', kovetelmenyKod: 'futott_tetoter', hoaramIrany: 'felfele', kulsoOldal: 'kulso' };
  }
  if (/pincefödém|pince feletti/.test(c)) return { szerep: 'pincefodem', kovetelmenyKod: 'also_zarofodem', hoaramIrany: 'lefele', kulsoOldal: 'futetlen' };
  if (/padló|padlo|aljzat/.test(c)) return { szerep: 'padlo', kovetelmenyKod: 'talajon_fekvo_padlo', hoaramIrany: 'lefele', kulsoOldal: 'kulso' };
  if (/fal/.test(c)) return { szerep: 'fal', kovetelmenyKod: 'homlokzati_fal', hoaramIrany: 'vizszintes', kulsoOldal: 'kulso' };
  // a címből nem derül ki – a rétegek sorrendjéből: födém fölötti hőszigetelés + vízszigetelés → lapostető; csak a födém alatti → fűtetlen tér / külső levegő feletti födém
  if (lapostetoRetegek) return { szerep: 'teto', kovetelmenyKod: 'lapostető', hoaramIrany: 'felfele', kulsoOldal: 'kulso' };
  if (alulSzigetelt) return { szerep: 'pincefodem', kovetelmenyKod: 'also_zarofodem', hoaramIrany: 'lefele', kulsoOldal: 'futetlen' };
  return { szerep: null, kihagy: 'A szerkezet szerepe nem állapítható meg a címből.', kovetelmenyKod: '', hoaramIrany: 'vizszintes', kulsoOldal: 'kulso' };
}

/** Rétegleírás → katalógusanyag. `kimarad`: a réteg a hőtechnikai számításban nem szerepel (indoklással). */
export function anyagKepez(leiras: string, dCm: number | null, szerep: Szerep | null): { anyagId?: string; legreteg?: 'zart' | 'intenziv'; kimarad?: string; megjegyzes?: string } {
  const n = leiras.toLowerCase();
  if (/^[–-]?\s*(festés|glettelés|glett\b|alapozó)/.test(n) || (/festés|glettelés|alapozó/.test(n) && !/vakolat|gipszkarton|beton|falazat/.test(n))) return { kimarad: 'Bevonat – elhanyagolható hővezetési ellenállás.' };
  if (/alumínium|aluminium|fémlemez|trapézlemez|hpl|kompozit/.test(n) && /burkolat|lemez/.test(n)) return { kimarad: 'Átszellőztetett homlokzatburkolat – a légrésen kívüli réteg nem számít.' };
  if (/termett talaj|talaj$|^talaj/.test(n)) return { kimarad: 'Talaj – a talajon fekvő padló számítása (MSZ EN ISO 13370) külön veszi figyelembe.' };
  if (/feltöltés/.test(n) && szerep === 'padlo') return { kimarad: 'Talajra kerülő feltöltés – a talajjal együtt a padlószámítás része.' };
  if (/cserép|cserepfed|lécezés|ellenléc|tetőfólia/.test(n)) return { kimarad: 'Átszellőztetett tetőfedés rétege.' };
  if (/padlástér|padlásté/.test(n)) return { kimarad: 'Fűtetlen padlástér.' };
  if (/légrés/.test(n)) return { legreteg: /kiszellőz|átszellőz|szellőztetett/.test(n) ? 'intenziv' : 'zart' };
  if (/kent vízszig|kenhető|kent szigetelés/.test(n)) return { kimarad: 'Kent vízszigetelés – elhanyagolható vastagság.' };
  if (/filc|geotextil|szűrőréteg|szuroreteg|üvegszövet|háló\b/.test(n)) return { kimarad: 'Vékony elválasztó / szűrő / erősítő réteg – elhanyagolható hővezetési ellenállás.' };
  if (/vízelvezető|vizelvezeto|vízmegtartó|szivárgó|szivargo|drain|dombor/.test(n)) return { kimarad: 'Vízelvezető / szivárgó réteg – a hőtechnikai számításban nem vesszük figyelembe.' };
  if (/kultúrkeverék|ültetőközeg|termőföld|földvisszatöltés|visszatöltés|vegetáció/.test(n)) return { kimarad: 'Zöldtető-ültetőközeg / visszatöltés – a hőtechnikai számításban nem vesszük figyelembe.' };
  if (/pvc lemez|pvc szig|tpo|fpo/.test(n) && (dCm === null || dCm < 0.5)) return { kimarad: 'Műanyag vízszigetelő lemez – elhanyagolható hővezetési ellenállás.' };
  if (/(szelemen|gerenda|fedélszerkezet|fedélszék|rácsos|tartóváz|váz|léc).*(közte|között)/.test(n)) return { kimarad: 'Teherhordó váz – a közte lévő hőszigetelés külön rétegként szerepel; a fa részarányát ellenőrizd.', megjegyzes: 'Inhomogén réteg.' };
  if (/cd profil|ud profil|direktrögzítő|álmennyezeti váz/.test(n)) return { legreteg: 'zart', megjegyzes: 'Álmennyezeti szerelőváz – zárt légrétegként.' };
  if (/elasztomer|bitumen|bit\. ?lemez|talajnedv|vízszig/.test(n)) return { anyagId: 'bitumenes_lemez' };
  if (/pe fólia|polietilén|pe párazáró|párazáró|technológiai szig|védőfólia|páraáteresztő|tetőfólia/.test(n)) return { anyagId: 'pe_folia' };
  if (/gipszkarton|gipszrost/.test(n)) return { anyagId: /rost/.test(n) ? 'gipszrost' : 'gipszkarton_rb' };
  if (/\bosb\b/.test(n)) return { anyagId: 'osb' };
  if (/heratekta|tektalan/.test(n)) {
    // többrétegű fagyapot lap: a gyártói R a lapvastagság szerint; a legközelebbi (a vastagabbnál nem nagyobb) lap egyenértékű λ-jával
    const d = dCm ?? 0;
    const tekt = /tektalan|kőzetgyapot|smarttec/.test(n);
    const sor = tekt ? [5, 7.5, 10, 12.5, 15, 20] : [5, 7.5, 10, 12.5, 15];
    const v = sor.reduce((a, b) => (Math.abs(b - d) < Math.abs(a - d) ? b : a));
    const id = tekt ? `tektalan_a2_st_${Math.round(v * 10)}` : `heratekta_c3_031_${Math.round(v * 10)}`;
    return { anyagId: id, megjegyzes: `${tekt ? 'Tektalan A2-SmartTec (kőzetgyapot magos)' : 'Heratekta C3 031 (grafitos EPS magos)'} ${String(v).replace('.', ',')} cm-es lap gyártói R-je alapján${Math.abs(v - d) > 0.5 ? ` – a ${String(d).replace('.', ',')} cm-es vastagsághoz egyenértékű λ-val; ellenőrizd a terv szerinti terméket (kőzetgyapot vagy EPS mag)` : ''}.` };
  }
  if (/fagyapot|heraklith/.test(n)) return { anyagId: 'fagyapot_heraklith' };
  if (/laminált|parketta/.test(n)) return { anyagId: 'parketta' };
  // általános / meg nem nevezett padlóburkolat: greslap / kerámia
  if (/klinker|tégla ?burkolat|téglaburkolat|burkolótégla/.test(n)) return { anyagId: 'tomor_tegla_falazat', megjegyzes: 'Téglaburkolat – ha mögötte átszellőztetett légrés van, a burkolat kimarad.' };
  if (/burkolat|greslap|gres\b/.test(n) && !/fal ?burkolat|tető|térburkol/.test(n)) return { anyagId: 'keramia' };
  if (/kerámia padló|krámia|kerámia burkolat|járólap|greslap|csempe/.test(n)) return { anyagId: 'keramia' };
  if (/esztrich|aljzatbeton|aljzatkiegyenlít/.test(n)) return { anyagId: 'esztrich_cement' };
  if (/lejtbeton|szerelőbeton|szerelobeton|kavicsbeton|beton ágyazat/.test(n)) return { anyagId: 'beton_2200' };
  if (/vasalt aljzat|vasbeton|monolit beton|alaplemez/.test(n)) return { anyagId: 'vasbeton_2300' };
  if (/zsalukő|zsaluelem/.test(n)) return { anyagId: 'zsalufal_leier_beton' };
  if (/zúzott ?kő|kavics/.test(n)) return { anyagId: 'kavics_homok' };
  if (/xps|extrudált/.test(n)) {
    const d = dCm ?? 0;
    if (/top ?70/.test(n)) return { anyagId: d <= 6 ? 'at_xps70_50_60' : 'at_xps70_80_140' };
    if (/top ?50/.test(n)) return { anyagId: 'at_xps50tb' };
    if (/top ?30/.test(n) || (/top/.test(n) && !/top ?p/.test(n))) return { anyagId: d <= 6 ? 'at_xps30_30_60' : d <= 12 ? 'at_xps30_70_120' : 'at_xps30_140_160', megjegyzes: d > 16 ? 'XPS TOP 30: 160 mm felett nincs gyártói érték, a 140–160 mm-es λ-val (a többrétegű fektetés miatt).' : undefined };
    return { anyagId: 'xps_labazati' };
  }
  if (/grafit ?reflex/.test(n)) return { anyagId: 'at_grafit_reflex' };
  if (/fixrock/.test(n)) return { anyagId: 'rw_fixrock_fb1' };
  if (/multirock/.test(n)) return { anyagId: 'rw_multirock' };
  if (/deltarock/.test(n)) return { anyagId: 'rw_deltarock' };
  if (/hardrock/.test(n)) return { anyagId: 'rw_hardrock_max' };
  if (/steprock/.test(n)) return { anyagId: 'rw_steprock_nd' };
  if (/\bpir\b|poliizocianur/.test(n)) return { anyagId: /kingspan|therma/.test(n) ? 'kingspan_tr26' : 'bauder_pir_fa' };
  if (/eps ?100|lépésálló/.test(n)) return { anyagId: /grafit/.test(n) ? 'eps100_grafit' : 'eps100_feher' };
  if (/eps ?80|eps ?70|homlokzati eps|hőszigetelő vakolatrendszer/.test(n)) return { anyagId: /grafit/.test(n) ? 'eps80_grafit' : 'eps80_feher' };
  if (/eps|polisztirol/.test(n)) return { anyagId: szerep === 'padlo' ? (/grafit/.test(n) ? 'eps100_grafit' : 'eps100_feher') : (/grafit/.test(n) ? 'eps80_grafit' : 'eps80_feher') };
  if (/kőzetgyapot|közetgyapot|kozetgyapot|ásványgyapot|üveggyapot/.test(n)) {
    const tartoval = /szeglemez|szarufa|gerenda|fa ?váz|tetőszerkezet|profil/.test(n);
    const id = szerep === 'fal' ? 'kozetgyapot_homlokzati' : szerep === 'teto' ? 'asvanyiyapot_szarufa' : 'asvanyiyapot_lemez_padlas';
    return { anyagId: id, megjegyzes: tartoval ? 'Inhomogén réteg (faszerkezet a hőszigetelés síkjában) – a fa részarányát ellenőrizd, szükség esetén csökkentsd a λ-t vagy vedd fel kétirányú rétegként.' : undefined };
  }
  if (/vázkerámia|porotherm|kerámia falaz|hanggátló/.test(n)) {
    const d = dCm ?? 0;
    if (/hanggátló/.test(n)) return { megjegyzes: 'Hanggátló falazóblokk – λ-ját a gyártói adatlapból add meg.' };
    if (/x-?th/.test(n)) {
      const rapid = /rapid|dryx|dryfix/.test(n);
      if (Math.abs(d - 30) < 1) return { anyagId: rapid ? 'pth30_xtherm_rapid' : 'pth30_xtherm_m5l', megjegyzes: rapid ? undefined : 'Porotherm 30 X-therm M5L habarccsal – Rapid (Dryx) falazásnál válts a Rapid változatra.' };
      if (Math.abs(d - 38) < 1) return { anyagId: rapid ? 'pth38_xtherm_rapid' : 'porotherm_38_xtherm_m5l' };
      if (Math.abs(d - 44) < 1) return { anyagId: rapid ? 'porotherm_44_xtherm_rapid' : 'pth44_xtherm_m5l' };
      if (Math.abs(d - 50) < 1) return { anyagId: 'pth50_xtherm_rapid' };
    }
    if (Math.abs(d - 30) < 1) return { anyagId: 'vazkeramia_30' };
    if (Math.abs(d - 38) < 1) return { anyagId: 'porotherm_38_nf_m25' };
    if (Math.abs(d - 44) < 1) return { anyagId: 'porotherm_44_xtherm_rapid' };
    if (Math.abs(d - 25) < 1) return { anyagId: 'tt_porotherm_25' };
    return { megjegyzes: 'Ehhez a vastagsághoz nincs katalógusbeli vázkerámia – λ-t adj meg.' };
  }
  if (/pórusbeton|ytong|gázbeton/.test(n)) return { anyagId: (dCm ?? 0) >= 37 ? 'ytong_classic_375' : 'ytong_p2_05_30' };
  if (/tömör tégla|kisméretű tégla/.test(n)) return { anyagId: 'tomor_tegla_falazat' };
  if (/mészhomok|silka/.test(n)) return { anyagId: 'meszhomok_silka_1800' };
  if (/nemesvakolat|vékonyvakolat|szilikon|lábazati vakolat|külső .*vakolat/.test(n) && (dCm === null || dCm < 1)) return { anyagId: 'nemesvakolat' };
  if (/cementvakolat|cementhabarcs/.test(n)) return { anyagId: 'cement_vakolat' };
  if (/gipsz ?vakolat|glettvakolat/.test(n)) return { anyagId: 'gipsz_vakolat' };
  if (/vakolat/.test(n)) return { anyagId: 'meszcement_vakolat' };
  if (/gipszkarton|gipszrost/.test(n)) return { anyagId: /rost/.test(n) ? 'gipszrost' : 'gipszkarton_rb' };
  if (/osb/.test(n)) return { anyagId: 'osb' };
  if (/clt/.test(n)) return { anyagId: 'clt' };
  if (/deszka|fenyő|puhafa|szarufa|gerenda/.test(n)) return { anyagId: 'puhafa' };
  if (/térkő|térburkoló/.test(n)) return { kimarad: 'Külső burkolat.' };
  return {};
}

/** Alapértelmezett vastagság a „N rtg.” rétegekhez (cm), ha katalógusanyag van mögöttük. */
const RTG_CM: Record<string, number> = { pe_folia: 0.02, bitumenes_lemez: 0.4, gipszkarton_rb: 1.25, gipszrost: 1.25, nemesvakolat: 0.3 };

export interface TervRetegUI extends RetegUI { forras: string; kimarad?: string; megjegyzes?: string }

/** Rétegrend → program-rétegek (belülről kifelé, ahogy a modell várja). */
export function retegekEpit(rr: TervRetegrend, sz: SzerepBecsles, ujId: () => string): TervRetegUI[] {
  const ki: TervRetegUI[] = [];
  for (const r of rr.retegek) {
    const k = anyagKepez(r.leiras, r.dCm, sz.szerep);
    const leirasVastag = r.dCm === null && !r.rtg ? /^(\d+(?:[,.]\d+)?)\s*cm\b/.exec(r.leiras) : null;
    let dCm = r.dCm ?? (leirasVastag ? Number(leirasVastag[1]!.replace(',', '.')) : k.anyagId && r.rtg ? (RTG_CM[k.anyagId] ?? 0) * r.rtg : 0);
    if (k.anyagId === 'pe_folia' && r.dCm === null) dCm = 0.02;
    const forras = `${r.dCm !== null ? `${String(r.dCm).replace('.', ',')} cm` : r.rtg ? `${r.rtg} rtg.` : '–'} ${r.leiras}`;
    ki.push({ id: ujId(), anyagId: k.kimarad ? undefined : k.anyagId, nev: k.anyagId ? undefined : r.leiras, dCm: Math.round(dCm * 100) / 100, legreteg: k.legreteg, forras, kimarad: k.kimarad, megjegyzes: k.megjegyzes });
  }
  // A tervlapok a rétegeket általában belülről kifelé (falnál) ill. felülről lefelé (padló, födém) sorolják.
  // A program rétegsorrendje: belső oldaltól a külső felé – padlónál és padlásfödémnél ez megegyezik a felülről/alulról olvasással:
  // padló: felülről (belső) lefelé (talaj) ✓; padlásfödém: a terv felülről (padlás, külső) sorol → megfordítjuk.
  // A sorrendet a tartalomból döntjük el: melyik végén van a belső (festés, belső vakolat, gipszkarton) ill. a külső
  // (vékonyvakolat, padlástér, kavics, cserép, talaj) réteg. Padlónál/pincefödémnél a felső (burkolat) oldal a belső.
  const BELSO = /belső|festés|glettel|gipszkarton|álmennyezet|parketta|padlóburkolat/;
  const KULSO = /padlástér|vékonyvakolat|nemesvakolat|szilikon|kavics|cserép|zöldtető|kultúrkeverék|talaj|lábazati vakolat|homlokzatburkolat|alumínium|teraszburkolat/;
  const elso = (rr.retegek[0]?.leiras ?? '').toLowerCase(), utolso = (rr.retegek.at(-1)?.leiras ?? '').toLowerCase();
  const pont = (t: string) => (BELSO.test(t) ? 1 : 0) - (KULSO.test(t) ? 1 : 0);
  if (sz.szerep === 'padlo' || sz.szerep === 'pincefodem') {
    if (pont(utolso) > pont(elso)) ki.reverse();
  } else if (pont(elso) < pont(utolso)) ki.reverse();
  else if (pont(elso) === pont(utolso) && (sz.szerep === 'padlas' || sz.szerep === 'teto') && !BELSO.test(elso)) ki.reverse();
  return ki;
}

// ——— szintek ———

export interface SzintEredmeny {
  /** Szintmagasság-jelek (m), oszloponként. */
  szintek: number[];
  /** Fűtött szintek száma. */
  szintszam: number;
  /** Belmagasság szintenként (m). */
  belmagassag: number[];
  /** Padlószintek (m). */
  padlo: number[];
  terepszint?: number;
  gerinc?: number;
  figyelmeztetes: string[];
}

const SZINT = /^([±+\-−–]?)\s?(\d{1,3}[,.]\d{2,3})$/;

export function szintekKeres(sz: Szoveg[]): SzintEredmeny {
  const jelek = sz.filter((t) => Math.abs(t.szog) < 2).map((t) => ({ t, m: SZINT.exec(szovegJavit(t.s)) })).filter((x) => x.m && (x.m[1] || /,\d{2}$/.test(x.m[2]!)))
    .filter((x) => x.m![1] !== '' || x.t.s.includes('±'))
    .map((x) => ({ x: x.t.x, y: x.t.y, ertek: (x.m![1] === '-' || x.m![1] === '−' || x.m![1] === '–' ? -1 : 1) * szamErtek(x.m![2]!), meret: x.t.meret }));
  const fig: string[] = [];
  const fuggoMeretek = sz.filter((t) => Math.abs(Math.abs(t.szog) - 90) < 3 && /^\d,\d{2}$/.test(t.s.trim())).map((t) => szamErtek(t.s));
  if (!jelek.length) return { szintek: [], szintszam: 1, belmagassag: [], padlo: [], figyelmeztetes: ['Szintmagasság-jelet (pl. „±0,00”, „+2,70”) nem találtam a metszeten.'] };
  // oszlopok: közel azonos x
  const oszlopok: (typeof jelek)[] = [];
  for (const j of [...jelek].sort((a, b) => a.x - b.x)) { const o = oszlopok.find((c) => Math.abs(c[0]!.x - j.x) < j.meret * 2); if (o) o.push(j); else oszlopok.push([j]); }
  // belső oszlop: van benne ±0,00 (a negatív értékei alapozási szintek lehetnek); külső: terepszint (negatív), ±0,00 nélkül
  const kulsoErtekek = new Set<number>();
  // (csak a negatív – terep alatti – értékek; a pozitív szintjelek a homlokzati oszlopban is valódi szintek lehetnek)
  for (const o of oszlopok) if (o.some((j) => j.ertek < 0) && !o.some((j) => j.ertek === 0)) for (const j of o) if (j.ertek < 0) kulsoErtekek.add(j.ertek);
  const belso = oszlopok.filter((o) => o.some((j) => j.ertek === 0));
  const ertekek = [...new Set((belso.length ? belso.flat() : jelek).map((j) => j.ertek))].sort((a, b) => a - b);
  const belsoTiszta = ertekek.filter((v) => v === 0 || !kulsoErtekek.has(v) || !belso.length);
  const padlo: number[] = []; const bm: number[] = [];
  let f = belsoTiszta.includes(0) ? 0 : belsoTiszta[0]!;
  for (let k = 0; k < 6; k++) {
    // födém alsó síkja: a függőleges méretszámmal igazolt magasság, ill. amely fölött 15–80 cm-en belül újabb szint (födém teteje) van
    const legfelso = Math.max(...jelek.map((j) => j.ertek));
    const jeloltek = belsoTiszta.filter((v) => v >= f + 2.2 && v <= f + 4.2 && v < legfelso);
    const pont = (c: number) => (fuggoMeretek.some((m) => Math.abs(m - (c - f)) < 0.015) ? 2 : 0) + (belsoTiszta.some((v) => v > c + 0.15 && v <= c + 0.8) ? 1 : 0);
    const c = jeloltek.sort((a, b) => pont(b) - pont(a) || a - b)[0];
    if (c === undefined) break;
    padlo.push(f); bm.push(Math.round((c - f) * 100) / 100);
    const kov = belsoTiszta.find((v) => v > c && v <= c + 0.8);
    if (kov === undefined) break;
    f = kov;
  }
  if (!bm.length) fig.push('A belmagasságot nem tudtam megállapítani a szintjelekből – add meg kézzel.');
  const terep = [...kulsoErtekek].filter((v) => v < 0 && v > -0.6).sort((a, b) => b - a)[0];
  const gerinc = Math.max(...jelek.map((j) => j.ertek));
  return { szintek: [...new Set(jelek.map((j) => j.ertek))].sort((a, b) => a - b), szintszam: Math.max(1, bm.length), belmagassag: bm, padlo, terepszint: terep, gerinc, figyelmeztetes: fig };
}
