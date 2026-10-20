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

const FEJLEC_KOD = /^[A-ZÁÉ]{1,3}[-.]?\d{1,3}[a-z]?[*'’]?$/;
const FEJLEC_CIM = /rétegrend|rétegfelépítés|réteg-?rend/i;
const VASTAG = /^(\d+(?:[,.]\d+)?)\s*(cm|mm|m)\.?$|^(\d+)\s*rtg\.?$|^-{1,3}$|^–$/i;

function vastagsag(s: string): { dCm: number | null; rtg?: number } | null {
  const m = VASTAG.exec(s.trim());
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

export function retegrendBlokkok(sz: Szoveg[]): TervRetegrend[] {
  const vsz = sz.filter((t) => Math.abs(t.szog) < 2);
  const fejlecek: { kod: Szoveg; cim: Szoveg }[] = [];
  for (const k of vsz) {
    if (!FEJLEC_KOD.test(k.s.trim())) continue;
    const cim = vsz.filter((t) => t !== k && Math.abs(t.y - k.y) < k.meret * 0.4 && t.x > k.x && t.x - (k.x + k.szel) < k.meret * 6)
      .sort((a, b) => a.x - b.x)[0];
    if (cim && (FEJLEC_CIM.test(cim.s) || (cim.s === cim.s.toUpperCase() && /\p{L}{4}/u.test(cim.s)))) fejlecek.push({ kod: k, cim });
  }
  const ki: TervRetegrend[] = [];
  for (const { kod, cim } of fejlecek) {
    const xV = kod.x, xL = cim.x;
    // a blokk szélessége: a következő, azonos sorban jobbra lévő fejlécig
    // oszlopszélesség: a fejlécek oszlopainak távolsága (a legjobb szélső oszlopnál a szomszédé)
    const oszlopX = [...new Set(fejlecek.map((f) => Math.round(f.kod.x / 5) * 5))].sort((a, b) => a - b);
    const lepes = oszlopX.slice(1).map((v, i) => v - oszlopX[i]!).filter((d) => d > kod.meret * 5);
    const szel = lepes.length ? Math.min(...lepes) : kod.meret * 30;
    const jobb = fejlecek.filter((f) => f.kod !== kod && Math.abs(f.kod.y - kod.y) < kod.meret && f.kod.x > kod.x).map((f) => f.kod.x).sort((a, b) => a - b)[0] ?? kod.x + szel;
    const lent = fejlecek.filter((f) => f.kod !== kod && Math.abs(f.kod.x - kod.x) < kod.meret * 2 && f.kod.y > kod.y).map((f) => f.kod.y).sort((a, b) => a - b)[0] ?? Infinity;
    const tagok = vsz.filter((t) => t.y > kod.y + kod.meret * 0.4 && t.y < lent - kod.meret * 0.4 && t.x >= xV - kod.meret && t.x < jobb - kod.meret * 0.5 && t !== cim);
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
      const bal = r.filter((t) => t.x < xL - kod.meret * 0.3);
      const jobbR = r.filter((t) => t.x >= xL - kod.meret * 0.3);
      const v = bal.length ? vastagsag(sorFuz(bal)) : null;
      const leiras = sorFuz(jobbR).replace(/^[.,]$/, '');
      if (!leiras && !v) continue;
      if (v) retegek.push({ ...v, leiras });
      else if (retegek.length && retegek.at(-1)!.leiras.endsWith(',')) retegek.at(-1)!.leiras += ' ' + leiras;
      else if (retegek.length && /^[a-záéíóöőúüű(]/.test(leiras)) retegek.at(-1)!.leiras += ' ' + leiras;
      else retegek.push({ dCm: null, leiras });
    }
    // valódi rétegrend-tábla: legalább két réteg vastagsággal (a rajzon álló szerkezetjelölő felirat nem ilyen)
    if (retegek.filter((r) => r.dCm !== null || r.rtg).length >= 2) ki.push({ kod: kod.s.trim(), cim: sorFuz([cim]).replace(/\s*rétegrend(je)?\s*$/i, '').trim(), retegek, x: kod.x, y: kod.y });
  }
  return ki;
}

// ——— szerep és anyag ———

export interface SzerepBecsles {
  szerep: Szerep | null;
  /** Nem a hőburok része (válaszfal, terasz, tetőfedés hideg padlás fölött) – alapból nem kerül át. */
  kihagy?: string;
  kovetelmenyKod: string;
  hoaramIrany: 'vizszintes' | 'felfele' | 'lefele';
  kulsoOldal: 'kulso' | 'futetlen' | 'belso';
}

export function szerepBecsles(rr: TervRetegrend, mind: TervRetegrend[]): SzerepBecsles {
  const c = (rr.cim + ' ' + rr.kod).toLowerCase();
  const reteg = rr.retegek.map((r) => r.leiras.toLowerCase()).join(' | ');
  const vanPadlasfodem = mind.some((m) => /padlásfödém|padlasfodem/i.test(m.cim));
  if (/terasz|járda|erkély|burkolt felület/.test(c)) return { szerep: null, kihagy: 'Külső burkolat, nem a hőburok része.', kovetelmenyKod: '', hoaramIrany: 'lefele', kulsoOldal: 'kulso' };
  if (/válaszfal|valaszfal/.test(c)) return { szerep: 'belso', kihagy: 'Belső válaszfal – két fűtött tér között.', kovetelmenyKod: '', hoaramIrany: 'vizszintes', kulsoOldal: 'belso' };
  if (/belső teherhordó|belső fal|teherhordó fal/.test(c) && !/külső|homlokzat/.test(c)) return { szerep: 'belso', kihagy: 'Belső fal – fűtött terek között nincs hőáram (fűtetlen helyiség, pl. garázs felé a határolásnál választható).', kovetelmenyKod: '', hoaramIrany: 'vizszintes', kulsoOldal: 'belso' };
  if (/lakáselválasztó|lakaselvalaszto|elválasztó fal/.test(c)) return { szerep: 'belso', kihagy: 'Fűtött lakások közötti fal (azonos hőmérsékletű terek között nincs hőáram).', kovetelmenyKod: 'szomszedos_futott', hoaramIrany: 'vizszintes', kulsoOldal: 'belso' };
  if (/lábazat|labazat|pincefal|talajjal érintkező fal/.test(c)) return { szerep: 'fal', kihagy: 'Lábazati / talajjal érintkező fal – a padló kerületi hőszigetelésénél (perem) vehető figyelembe.', kovetelmenyKod: 'talajjal_erintkezo_fal', hoaramIrany: 'vizszintes', kulsoOldal: 'kulso' };
  if (/padlásfödém|padlasfodem|zárófödém/.test(c)) return { szerep: 'padlas', kovetelmenyKod: 'padlasfodem', hoaramIrany: 'felfele', kulsoOldal: 'futetlen' };
  if (/magastető|tető|teto/.test(c)) {
    if (vanPadlasfodem || /padlástér|padlas/.test(reteg)) return { szerep: 'teto', kihagy: 'Hideg padlás fölötti tetőfedés – a hőburok a padlásfödém.', kovetelmenyKod: 'teto', hoaramIrany: 'felfele', kulsoOldal: 'kulso' };
    return { szerep: 'teto', kovetelmenyKod: 'teto', hoaramIrany: 'felfele', kulsoOldal: 'kulso' };
  }
  if (/pincefödém|pince feletti/.test(c)) return { szerep: 'pincefodem', kovetelmenyKod: 'futetlen_pince_feletti_fodem', hoaramIrany: 'lefele', kulsoOldal: 'futetlen' };
  if (/padló|padlo|aljzat/.test(c)) return { szerep: 'padlo', kovetelmenyKod: 'talajon_fekvo_padlo', hoaramIrany: 'lefele', kulsoOldal: 'kulso' };
  if (/fal/.test(c)) return { szerep: 'fal', kovetelmenyKod: 'homlokzati_fal', hoaramIrany: 'vizszintes', kulsoOldal: 'kulso' };
  return { szerep: null, kihagy: 'A szerkezet szerepe nem állapítható meg a címből.', kovetelmenyKod: '', hoaramIrany: 'vizszintes', kulsoOldal: 'kulso' };
}

/** Rétegleírás → katalógusanyag. `kimarad`: a réteg a hőtechnikai számításban nem szerepel (indoklással). */
export function anyagKepez(leiras: string, dCm: number | null, szerep: Szerep | null): { anyagId?: string; legreteg?: 'zart' | 'intenziv'; kimarad?: string; megjegyzes?: string } {
  const n = leiras.toLowerCase();
  if (/festés|glettelés|glett\b|alapozó/.test(n)) return { kimarad: 'Bevonat – elhanyagolható hővezetési ellenállás.' };
  if (/termett talaj|talaj$|^talaj/.test(n)) return { kimarad: 'Talaj – a talajon fekvő padló számítása (MSZ EN ISO 13370) külön veszi figyelembe.' };
  if (/feltöltés/.test(n) && szerep === 'padlo') return { kimarad: 'Talajra kerülő feltöltés – a talajjal együtt a padlószámítás része.' };
  if (/cserép|cserepfed|lécezés|ellenléc|tetőfólia/.test(n)) return { kimarad: 'Átszellőztetett tetőfedés rétege.' };
  if (/padlástér|padlásté/.test(n)) return { kimarad: 'Fűtetlen padlástér.' };
  if (/légrés/.test(n)) return { legreteg: /kiszellőz|átszellőz|szellőztetett/.test(n) ? 'intenziv' : 'zart' };
  if (/kent vízszig|kenhető/.test(n)) return { kimarad: 'Kent vízszigetelés – elhanyagolható vastagság.' };
  if (/elasztomer|bitumen|bit\. ?lemez|talajnedv|vízszig/.test(n)) return { anyagId: 'bitumenes_lemez' };
  if (/pe fólia|pe párazáró|párazáró|technológiai szig|védőfólia|páraáteresztő/.test(n)) return { anyagId: 'pe_folia' };
  if (/laminált|parketta/.test(n)) return { anyagId: 'parketta' };
  // általános / meg nem nevezett padlóburkolat: greslap / kerámia
  if (/burkolat|greslap|gres\b/.test(n) && !/fal ?burkolat|tető|térburkol/.test(n)) return { anyagId: 'keramia' };
  if (/kerámia padló|krámia|kerámia burkolat|járólap|greslap|csempe/.test(n)) return { anyagId: 'keramia' };
  if (/esztrich|aljzatbeton/.test(n)) return { anyagId: 'esztrich_cement' };
  if (/vasalt aljzat|vasbeton|monolit beton|alaplemez/.test(n)) return { anyagId: 'vasbeton_2300' };
  if (/zsalukő|zsaluelem/.test(n)) return { anyagId: 'zsalufal_leier_beton' };
  if (/zúzott ?kő|kavics/.test(n)) return { anyagId: 'kavics_homok' };
  if (/xps|extrudált/.test(n)) return { anyagId: 'xps_labazati' };
  if (/eps ?100|lépésálló/.test(n)) return { anyagId: /grafit/.test(n) ? 'eps100_grafit' : 'eps100_feher' };
  if (/eps ?80|eps ?70|homlokzati eps|hőszigetelő vakolatrendszer/.test(n)) return { anyagId: /grafit/.test(n) ? 'eps80_grafit' : 'eps80_feher' };
  if (/eps|polisztirol/.test(n)) return { anyagId: szerep === 'padlo' ? 'eps100_feher' : 'eps80_feher' };
  if (/kőzetgyapot|ásványgyapot|üveggyapot/.test(n)) {
    const tartoval = /szeglemez|szarufa|gerenda|fa ?váz|tetőszerkezet|profil/.test(n);
    const id = szerep === 'fal' ? 'kozetgyapot_homlokzati' : szerep === 'teto' ? 'asvanyiyapot_szarufa' : 'asvanyiyapot_lemez_padlas';
    return { anyagId: id, megjegyzes: tartoval ? 'Inhomogén réteg (faszerkezet a hőszigetelés síkjában) – a fa részarányát ellenőrizd, szükség esetén csökkentsd a λ-t vagy vedd fel kétirányú rétegként.' : undefined };
  }
  if (/vázkerámia|porotherm|kerámia falaz|hanggátló/.test(n)) {
    const d = dCm ?? 0;
    if (/hanggátló/.test(n)) return { megjegyzes: 'Hanggátló falazóblokk – λ-ját a gyártói adatlapból add meg.' };
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
    let dCm = r.dCm ?? (k.anyagId && r.rtg ? (RTG_CM[k.anyagId] ?? 0) * r.rtg : 0);
    if (k.anyagId === 'pe_folia' && r.dCm === null) dCm = 0.02;
    const forras = `${r.dCm !== null ? `${String(r.dCm).replace('.', ',')} cm` : r.rtg ? `${r.rtg} rtg.` : '–'} ${r.leiras}`;
    ki.push({ id: ujId(), anyagId: k.kimarad ? undefined : k.anyagId, nev: k.anyagId ? undefined : r.leiras, dCm: Math.round(dCm * 100) / 100, legreteg: k.legreteg, forras, kimarad: k.kimarad, megjegyzes: k.megjegyzes });
  }
  // A tervlapok a rétegeket általában belülről kifelé (falnál) ill. felülről lefelé (padló, födém) sorolják.
  // A program rétegsorrendje: belső oldaltól a külső felé – padlónál és padlásfödémnél ez megegyezik a felülről/alulról olvasással:
  // padló: felülről (belső) lefelé (talaj) ✓; padlásfödém: a terv felülről (padlás, külső) sorol → megfordítjuk.
  if (sz.szerep === 'padlas' || sz.szerep === 'teto') ki.reverse();
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
  for (const o of oszlopok) if (o.some((j) => j.ertek < 0) && !o.some((j) => j.ertek === 0)) for (const j of o) kulsoErtekek.add(j.ertek);
  const belso = oszlopok.filter((o) => o.some((j) => j.ertek === 0));
  const ertekek = [...new Set((belso.length ? belso.flat() : jelek).map((j) => j.ertek))].sort((a, b) => a - b);
  const belsoTiszta = ertekek.filter((v) => v === 0 || !kulsoErtekek.has(v) || !belso.length);
  const padlo: number[] = []; const bm: number[] = [];
  let f = belsoTiszta.includes(0) ? 0 : belsoTiszta[0]!;
  for (let k = 0; k < 6; k++) {
    // födém alsó síkja: a függőleges méretszámmal igazolt magasság, ill. amely fölött 15–80 cm-en belül újabb szint (födém teteje) van
    const jeloltek = belsoTiszta.filter((v) => v >= f + 2.2 && v <= f + 4.2);
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
