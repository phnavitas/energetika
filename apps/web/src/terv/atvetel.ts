/**
 * A tervből felismert adatok átvétele a projektbe: helyiségek (helyiségenkénti külső falhosszal), rétegrendek,
 * homlokzati falfelületek tájolás szerint, talajon fekvő padló, padlásfödém, nyílászáró-típusok és -felületek.
 */
import { AJTO_KAPU_SABLONOK } from '../katalogus';
import type { Projekt, Retegrend, Felulet, NyilaszaroTipus, HelyisegKategoria, Helyiseg } from '../modell';
import { ujId, fuggonyfalTipus, sablonbolNyilaszaro, retegrendAutoNev, feluletekOsszevon, SZEREP_ALAP } from '../modell';
import { nyilaszaroSablon as NS, szerkezetSablon as SS } from '@mag/index';
import type { Tajolas } from '@mag/tablak/klima';
import type { TervRetegUI, SzerepBecsles, TervRetegrend } from './metszet';
import { egtaj, szintNev } from './alaprajz';

export interface AtvettHelyiseg {
  kod?: string; nev: string; burkolat?: string; A: number; kategoria: HelyisegKategoria;
  /** Teljes (geometriai) alapterület, ha A a hasznos alapterület (tetőtér: „H:” és „T:” terület) – a tető vízszintes vetületéhez. */
  teljesA?: number;
  /** Lakás / egység megjelenő neve (csoportosításhoz). */
  egyseg?: string;
  /** Külső falak a homlokzat lapiránya szerint (nettó belső hossz, m). */
  /** Külső falszakaszok; `talaj`: a fal mögött az épület körvonalán kívüli tér (terepszint alatt: talaj). */
  falak: { irany: number; hossz: number; talaj?: boolean; /** A homlokzatról mért falmagasság (m) a szint sávjában. */ magassag?: number }[];
  /** Fal fűtetlen, gyengén kapcsolt helyiség (pl. garázs) felé. */
  futetlenFalak?: { hossz: number; fele: string }[];
}
export interface AtvettRetegrend { rr: TervRetegrend; becsles: SzerepBecsles; retegek: TervRetegUI[] }
export interface AtvettNyilas {
  fajta: 'ablak' | 'erkelyajto' | 'bejarati_ajto' | 'bejarati_uvegajto' | 'garazskapu' | 'fuggonyfal';
  szel: number; mag: number; pm: number | null;
  /** Index az `helyisegek` tömbben. */
  helyiseg: number; irany: number;
  /** A tájolás becsült (ellenőrizendő). */
  iranyTipp?: boolean;
  /** Fűtetlen (gyengén kapcsolt) helyiség felé nyíló ajtó: annak a neve (a „Fal – … felé” felületből vonódik le). */
  fele?: string;
}
export interface TervAtvetel {
  helyisegek: AtvettHelyiseg[];
  retegrendek: AtvettRetegrend[];
  nyilasok: AtvettNyilas[];
  /** Az észak iránya a lap „felfelé” irányától, óramutató szerint (fok). */
  eszakSzog: number;
  belmagassag: number;
  szintszam: number;
  /** Fal átlagos teljes vastagsága (cm) – a padló–fal csatlakozáshoz. */
  falVastagsagCm?: number;
  /** A meglévő helyiségek, felületek és nyílászárók cseréje (különben hozzáadás). */
  csere: boolean;
  /** Talajon fekvő padló átvétele (földszinti lakás / szint); alapból igen. */
  padloAt?: boolean;
  /** Padlásfödém / tető átvétele (legfelső szint); alapból igen. */
  tetoAt?: boolean;
  /** Ha a metszetről nincs külső fal: ebből a szerkezetsablonból jön létre (pl. típusalaprajz-mintalapnál). */
  alapFalSablon?: string;
  /** Forrás a megjegyzésekhez (fájlnév). */
  forras?: string;
  /** Terepszint alatti szint (pince, alagsor): a fűtött helyiségek külső falai talajjal érintkező falak, a padlójuk talajon fekvő padló a megadott mélységben. */
  terepAlatt?: boolean;
  /** A terepszint alatti padló mélysége a terepszinttől [m]. */
  terepMelyseg?: number;
  /** Tetőtér-beépítés (a lap a tetőteret ábrázolja): a metszet hajlásszöge és térdfalmagassága – az eresz felőli falak
   * térdfalak, a ferde tetősáv a térdfal és a belmagasság (kalapfödém) között, a többi vízszintes födém. */
  tetoter?: { hajlas: number; terdfal: number | null; belmagassag?: number | null; /** a homlokzatokról mért oromzat-szélesség (m) alaprajzi irányonként (0/90/180/270) */ orom?: Record<number, number> };
  /** Fűtetlen szomszédos épülethez csatlakozó fal hossza (m, egy szintre): fal fűtetlen tér felé. */
  szomszedFutetlen?: number;
  /** Tetősík ablakok (tetőtérben a falhoz nem rendelt, helyiségen belüli méretfelirat): a ferde tetőből vonódnak le,
   * a legközelebbi eresz menti homlokzat tájolásával (tav: homlokzati irány → távolság, m). */
  tetoablakok?: { helyiseg: number; szel: number; mag: number; tav?: Record<number, number>; irany?: number; /** a jelből és a feliratból számolt tetőhajlás (fok) */ hajlas?: number }[];
  /** Az alaprajz által ábrázolt szintek (pl. ['1', '2'] – azonos 1. és 2. emelet): a helyiségek szintenként, a falak, nyílászárók szintszámszorosan. */
  szintek?: string[];
}

const kerek = (x: number, n = 2) => Math.round(x * 10 ** n) / 10 ** n;
const sz2 = (x: number) => x.toLocaleString('hu-HU', { maximumFractionDigits: 2 });

const CSOPORT_NEV = { ablak: 'Ablakok', erkelyajto: 'Erkélyajtók', bejarati_ajto: 'Bejárati ajtók', bejarati_uvegajto: 'Bejárati ajtók', garazskapu: 'Garázskapuk', fuggonyfal: 'Függönyfalak' } as const;
/** A fajtának megfelelő nyílászáró-csoport (szükség esetén létrehozza). */
function csoportFajta(p: Projekt, fajta: AtvettNyilas['fajta'], leiras?: string): string {
  const nev = leiras ? `${CSOPORT_NEV[fajta]} – ${leiras.charAt(0).toLowerCase()}${leiras.slice(1)}` : CSOPORT_NEV[fajta];
  p.nyilaszaroCsoportok ??= [];
  let c = p.nyilaszaroCsoportok.find((x) => x.nev === nev);
  if (!c) { c = { id: ujId(), nev }; p.nyilaszaroCsoportok.push(c); }
  return c.id;
}

function nyilaszaroTipus(p: Projekt, ny: AtvettNyilas): NyilaszaroTipus {
  const meret = `${String(Math.round(ny.szel * 100))}×${String(Math.round(ny.mag * 100))}`;
  if (ny.fajta === 'bejarati_ajto') {
    return { id: ujId(), nev: `Bejárati ajtó ${meret}`, kovetelmenyKod: 'ajto', szelesseg: ny.szel, magassag: ny.mag, uwKezi: 1.2, gn: 0, csoportId: csoportFajta(p, 'bejarati_ajto') };
  }
  if (ny.fajta === 'fuggonyfal') { const t = fuggonyfalTipus(ujId(), ny.szel, ny.mag); t.csoportId = csoportFajta(p, 'fuggonyfal'); return t; }
  if (ny.fajta === 'garazskapu') {
    const k = AJTO_KAPU_SABLONOK.find((x) => x.kod === 'kapu_szekc_42')!;
    return { id: ujId(), nev: `Garázskapu ${meret}`, kovetelmenyKod: 'kapu', szelesseg: ny.szel, magassag: ny.mag, uwKezi: k.U, gn: 0, sablonKod: k.kod, csoportId: csoportFajta(p, 'garazskapu') };
  }
  // az építés (ill. nyílászárócsere) évének megfelelő kortipikus ablak; új épületnél háromrétegű üvegezésű műanyag
  const ev = p.meta.nyilaszaroCsereEv ?? p.meta.epitesiEv;
  const s = NS.NYILASZARO_SABLONOK.filter((x) => x.anyag === 'pvc' && ev >= x.korszak[0] && ev <= x.korszak[1]).at(-1)
    ?? NS.NYILASZARO_SABLONOK.find((x) => x.kod === 'pvc_3r')!;
  const n = sablonbolNyilaszaro(s, { id: ujId(), szelesseg: ny.szel, magassag: ny.mag, kovetelmenyKod: 'ablak_fa_pvc' });
  n.nev = `${ny.fajta === 'erkelyajto' ? 'Erkélyajtó' : ny.fajta === 'bejarati_uvegajto' ? 'Bejárati ajtó (üvegezett)' : 'Ablak'} ${meret}`;
  // üvegezett bejárati ajtó: a követelmény az ajtóé (1. melléklet), a hőátbocsátás az üvegezett szerkezeté
  if (ny.fajta === 'bejarati_uvegajto') n.kovetelmenyKod = 'ajto';
  n.csoportId = csoportFajta(p, ny.fajta, s.nev);
  return n;
}

/** Alkalmazza az átvételt a projekt (piszkozat) példányán. */
export function tervAtvesz(p: Projekt, a: TervAtvetel): { uzenetek: string[] } {
  const uz: string[] = [];
  if (a.csere) {
    // felülírás: a korábbi helyiségek, felületek, nyílászárók és a korábban tervből átvett rétegrendek törlődnek
    p.helyisegek = []; p.feluletek = [];
    p.nyilaszarok = p.nyilaszarok.filter(() => false);
    p.nyilaszaroCsoportok = [];
    p.retegrendek = p.retegrendek.filter((r) => !r.tervbol);
    for (const h of p.hohidak ?? []) delete h.padloId;
  }
  const retegAlairas = (r: Pick<Retegrend, 'szerep' | 'retegek'>) => JSON.stringify([r.szerep, r.retegek.map((l) => [l.anyagId ?? l.nev ?? '', l.dCm, l.lambda ?? null, l.R ?? null, l.legreteg ?? null])]);
  // több lakás: többlakásos (egyéb) lakóépület – a HMV nettó igénye 30 kWh/m²a (2. függ. 2.2. táblázat), nem a családi ház 25-je
  const lakasok = new Set(a.helyisegek.map((h) => h.egyseg).filter((e): e is string => !!e && /lakás/i.test(e)));
  const lakasBetu = new Set(a.helyisegek.map((h) => /^[A-ZÁÉ]{1,2}\.\w+\.L\.?\d+/i.exec(h.kod ?? '')?.[0]).filter(Boolean));
  if ((lakasok.size >= 2 || lakasBetu.size >= 2) && p.meta.kategoria === 'csaladi_haz') { p.meta.kategoria = 'egyeb_lakoepulet'; uz.push('Több lakás: az épület kategóriája „egyéb (többlakásos) lakóépület” lett – HMV nettó igény 30 kWh/m²a (2. függ. 2.2.).'); }
  const szintek = a.szintek?.length ? a.szintek : [''];
  const n = szintek.length;
  p.meta.szintek = a.csere ? Math.max(a.szintszam, n) : Math.max(p.meta.szintek ?? 1, a.szintszam);

  // rétegrendek
  // a kód nem egyedi (ugyanaz a jel több lapon más szerkezetet jelölhet: „VR01” tető és fal) – a blokkhoz kötjük
  const rrIdM = new Map<object, string>();
  for (const x of a.retegrendek) {
    if (!x.becsles.szerep) continue;
    const r: Retegrend = {
      id: ujId(), nev: '', szerep: x.becsles.szerep, kovetelmenyKod: x.becsles.kovetelmenyKod || 'homlokzati_fal',
      hoaramIrany: x.becsles.hoaramIrany, kulsoOldal: x.becsles.kulsoOldal,
      retegek: x.retegek.filter((l) => !l.kimarad && (l.dCm > 0 || l.legreteg)).map((l) => {
        const { forras: _f, kimarad: _k, megjegyzes: _m, ...ui } = l; void _f; void _k; void _m;
        return { ...ui, id: ujId() };
      }),
    };
    const auto = retegrendAutoNev(r);
    r.nev = auto ? `${x.rr.kod} ${auto}` : `${x.rr.kod} ${x.rr.cim.charAt(0)}${x.rr.cim.slice(1).toLowerCase()}`;
    r.nevKezi = true; r.tervbol = true;
    // hozzáadáskor az azonos rétegrend nem duplikálódik
    const meglevo = !a.csere ? p.retegrendek.find((q) => retegAlairas(q) === retegAlairas(r)) : undefined;
    if (meglevo) { rrIdM.set(x.rr, meglevo.id); continue; }
    p.retegrendek.push(r);
    rrIdM.set(x.rr, r.id);
  }
  const keres = (sz: string, kizar?: string) => a.retegrendek.find((x) => x.becsles.szerep === sz && !x.becsles.kihagy && x.rr.kod !== kizar);
  const fal = keres('fal'); const padlas = keres('padlas');
  // padlásfödém híján a legfelső szint tetője a (lapos) tető rétegrend – a fűtetlen garázs / pince feletti tető nem
  const teto = padlas ? undefined : a.retegrendek.find((x) => x.becsles.szerep === 'teto' && !x.becsles.kihagy && !/garázs|garazs|pince/i.test(x.rr.cim));
  // terepszint alatti szintnél a feltételes (pince-) rétegrendek is számítanak
  const terep = !!a.terepAlatt;
  const padlok = a.retegrendek.filter((x) => x.becsles.szerep === 'padlo' && (!x.becsles.kihagy || (terep && x.becsles.feltetel === 'terepAlatt')));
  const talajFal = a.retegrendek.find((x) => x.becsles.kovetelmenyKod === 'talajjal_erintkezo_fal' && (!x.becsles.kihagy || (terep && x.becsles.feltetel === 'terepAlatt')));
  const z = a.terepMelyseg ?? a.belmagassag + 0.3;
  if (!fal) uz.push('Külső fal rétegrendet nem találtam a metszeten – a homlokzati falfelületekhez válassz rétegrendet.');
  let falRid = fal ? rrIdM.get(fal.rr) : undefined;
  if (!falRid && a.alapFalSablon) {
    const t = SS.SZERKEZET_SABLONOK.find((x) => x.kod === a.alapFalSablon);
    if (t) {
      const r: Retegrend = { id: ujId(), nev: '', nevKezi: false, szerep: t.szerep, ...SZEREP_ALAP[t.szerep], retegek: t.retegek.map((x) => ({ id: ujId(), anyagId: x.anyagId, dCm: x.dCm })) };
      r.nev = retegrendAutoNev(r);
      const meglevo = p.retegrendek.find((q) => q.nev === r.nev);
      if (meglevo) falRid = meglevo.id; else { p.retegrendek.push(r); falRid = r.id; }
      { const i = uz.findIndex((x) => /Külső fal rétegrendet nem találtam/.test(x)); if (i >= 0) uz.splice(i, 1); }
      uz.push(`Külső fal: „${t.nev}” szerkezetsablon (${t.csoport}) – a Rétegrendek lépésben pontosítható.`);
    }
  }

  // helyiségek
  const helyIdk: string[] = [];
  // egyszintes beolvasás: alapból az alaprajz szintje a legalsó és a legfelső is; közbenső lakásnál kikapcsolható
  const legfelso = a.tetoAt !== false, foldszint = a.padloAt !== false;
  const szintCimke = (sz: string) => (sz === 'P' ? 'pince' : sz === 'F' ? 'fszt.' : sz === 'T' ? 'tetőtér' : `${sz}. em.`);
  for (const [si, sz] of szintek.entries()) for (const h of a.helyisegek) {
    const id = ujId(); if (si === 0) helyIdk.push(id);
    // a szintenként ismétlődő kód („A.1.L.1.”) a többi szinten a szint számával
    const kod = h.kod && n > 1 && sz ? h.kod.replace(new RegExp(`^([A-ZÁÉ]{1,2}\\.)${szintek[0]}(\\.)`), (_m, a: string, b: string) => `${a}${sz}${b}`) : h.kod;
    const hz: Helyiseg = {
      id, nev: (kod ? `${h.nev} (${kod})` : h.nev) + (n > 1 && kod === h.kod && sz ? ` – ${szintCimke(sz)}` : ''), kategoria: h.kategoria, A: kerek(h.A), h: a.belmagassag,
      ...(sz ? { szint: szintNev(sz) } : {}), ...(h.egyseg ? { egyseg: h.egyseg.replace(/ · (földszint|pince|tetőtér|\d+\. emelet)/, '') } : {}),
      hsz: {
        kulsoFalak: falRid ? h.falak.filter((f) => f.hossz >= 0.3).map((f) => ({ id: ujId(), retegrendId: falRid, hossz: kerek(f.hossz) })) : [],
        padlas: legfelso && si === n - 1 && (!!padlas || !!teto), padlo: (foldszint || terep) && si === 0 && !!padlok.length, szomszedok: [],
      },
    };
    p.helyisegek.push(hz);
  }

  // homlokzati falak tájolás szerint
  const falFel: Record<number, string> = {};
  let homDb = 0;
  // a fűtetlen (gyengén kapcsolt) helyiség – pl. garázs – külső fala és nyílászárói nem a hőburok részei
  const burok = (h: AtvettHelyiseg) => h.kategoria !== 'gyengen_kapcsolt';
  const iranyok = terep ? [] : [...new Set(a.helyisegek.filter(burok).flatMap((h) => h.falak.map((f) => f.irany)))].sort((x, y) => x - y);
  if (terep) {
    // terepszint alatt: a fűtött helyiségek „külső” (nem helyiséggel határos) falai talajjal érintkező falak (4.27–4.28, 6.6)
    // a talaj felé eső szakaszok (az épület körvonalán) – a többi a szint fűtetlen belső tere (pl. mélygarázs) felé néz
    const hossz = kerek(a.helyisegek.filter(burok).reduce((s, h) => s + h.falak.filter((f) => f.talaj).reduce((q, f) => q + f.hossz, 0), 0));
    const belsoH = kerek(a.helyisegek.filter(burok).reduce((s, h) => s + h.falak.filter((f) => !f.talaj).reduce((q, f) => q + f.hossz, 0), 0));
    if (belsoH >= 0.2) {
      const nev = a.helyisegek.find((h) => !burok(h) && /garázs|garazs|parkoló|parkolo/i.test(h.nev))?.nev ?? a.helyisegek.find((h) => !burok(h))?.nev;
      const hat = nev && /mélygarázs|melygarazs|parkoló|parkolo/i.test(nev) ? 'melygarazs' : nev && /garázs|garazs/i.test(nev) ? 'garazs' : 'pince';
      p.feluletek.push({ id: ujId(), nev: `Pincefal – ${nev ? nev.toLowerCase() : 'fűtetlen pincetér'} felé`, fajta: 'opak', retegrendId: talajFal ? rrIdM.get(talajFal.rr) : falRid, hatar: hat, tajolas: null, hajlasszog: 90, meret: { hossz: kerek(belsoH * n), magassag: a.belmagassag }, A: kerek(belsoH * n * a.belmagassag), chi: 0.1 });
      uz.push(`Terepszint alatti szint: ${sz2(belsoH * n)} m fal a fűtetlen ${nev ? `„${nev}”` : 'pincetér'} felé (b-tényezővel).`);
    }
    if (hossz >= 0.2) {
      const rid = talajFal ? rrIdM.get(talajFal.rr) : falRid;
      p.feluletek.push({ id: ujId(), nev: 'Pincefal – talajjal érintkező', fajta: 'opak', retegrendId: rid, hatar: 'kulso', tajolas: null, hajlasszog: 90, meret: { hossz: kerek(hossz * n), magassag: kerek(z) }, A: kerek(hossz * n * z), chi: 0, talajFal: { z: kerek(z) } });
      uz.push(`Terepszint alatti szint: ${sz2(hossz * n)} m talajjal érintkező fal ${sz2(z)} m mélységig${talajFal ? ` (${talajFal.rr.kod}${talajFal.rr.cim ? ` „${talajFal.rr.cim}”` : ""})` : ' – a metszeten nincs pincefal-rétegrend, a Határolás lépésben válassz'}. A talaj felé esőnek az épület (pinceszint) körvonalán lévő szakaszokat vettem – a Határolás lépésben ellenőrizd.`);
    }
  }
  const iranyHossz = (ir: number) => a.helyisegek.filter(burok).reduce((s, h) => s + h.falak.filter((f) => f.irany === ir).reduce((q, f) => q + f.hossz, 0), 0);
  // tetőtér: az eresz a hosszabb homlokzatpár mentén fut (nyeregtető) – ott térdfal és ferde tetősáv, a másik pár oromfal
  const tt = a.tetoter && a.tetoter.terdfal !== null && legfelso ? a.tetoter : null;
  // (a ferde – pl. a lapon elforgatott épület 8°-os – falak a legközelebbi fő irányhoz számítanak)
  const tengely = (ir: number) => (Math.round(ir / 90) * 90) % 360;
  const tengelyHossz = (ax: number) => a.helyisegek.filter(burok).reduce((s, h) => s + h.falak.filter((f) => tengely(f.irany) === ax).reduce((q, f) => q + f.hossz, 0), 0);
  const ereszIr = tt ? (tengelyHossz(0) + tengelyHossz(180) >= tengelyHossz(90) + tengelyHossz(270) ? [0, 180] : [90, 270]) : [];
  // eresz menti hossz irányonként: a homlokzatról mért oromzat-szélesség levonásával (összetett, pl. L alakú tetőnél a
  // homlokzaton az eresz és a szárny oromzata is látszik); homlokzati rajz híján a hosszabb homlokzatpár az eresz
  const ereszHossz: Record<number, number> = {};
  if (tt) {
    const orom = tt.orom ?? {};
    const sajat = (ir: number) => (orom[ir] !== undefined ? Math.max(0, tengelyHossz(ir) - orom[ir]!) : null);
    for (const ir of [0, 90, 180, 270]) {
      const L = tengelyHossz(ir); if (L < 0.2) continue;
      const e = sajat(ir);
      ereszHossz[ir] = e !== null ? e : ereszIr.includes(ir) ? L : 0;
    }
  }
  for (const ir of iranyok) {
    const hossz = kerek(iranyHossz(ir));
    if (hossz < 0.2) continue;
    const t = egtaj(ir, a.eszakSzog);
    // a homlokzati rajz szerinti falmagasság (alaprajz + homlokzat összevetése): ha az irány falainak legalább 80 %-a
    // látszik a homlokzaton, a felület a mért magasságokkal (oromfal, térdfal, eltérő párkány a rajz szerint)
    { const fl = a.helyisegek.filter(burok).flatMap((h) => h.falak.filter((f) => f.irany === ir));
      const mert = fl.filter((f) => f.magassag !== undefined).reduce((q, f) => q + f.hossz, 0);
      if (mert >= 0.8 * hossz) {
        const A = fl.reduce((q, f) => q + f.hossz * (f.magassag ?? a.belmagassag), 0);
        const f: Felulet = { id: ujId(), nev: `Homlokzati fal – ${t}`, fajta: 'opak', retegrendId: falRid, hatar: 'kulso', tajolas: t, hajlasszog: 90, meret: { hossz: kerek(hossz * n), magassag: kerek(A / hossz) }, A: kerek(A * n), chi: 0.2 };
        p.feluletek.push(f); falFel[ir] = f.id; homDb++;
        continue;
      } }
    // (a fő irány eresz menti hossza a hozzá tartozó irányok közt arányosan)
    const ax = tengely(ir), Lax = tengelyHossz(ax);
    const Le = tt && Lax > 0 ? Math.min(hossz, hossz * Math.min(1, (ereszHossz[ax] ?? 0) / Lax)) : 0;
    if (tt && Le >= 0.2) {
      // eresz menti rész: térdfal; a maradék oromfal (a belmagasságig, a két felső sarokháromszög nélkül – közelítés)
      const m = tt.terdfal!;
      const f: Felulet = { id: ujId(), nev: `Térdfal – ${t}`, fajta: 'opak', retegrendId: falRid, hatar: 'kulso', tajolas: t, hajlasszog: 90, meret: { hossz: kerek(Le * n), magassag: m }, A: kerek(Le * n * m), chi: 0.2 };
      p.feluletek.push(f); falFel[ir] = f.id;
      if (hossz - Le < 0.2) continue;
    }
    const Lo = hossz - Le;
    const wOrom = tt ? Math.max(0, (a.belmagassag - tt.terdfal!) / Math.tan(tt.hajlas * Math.PI / 180)) : 0;
    // oromfal: a teljes belmagasságú téglalapból a két ferde sarok (w × (belmag − térdfal) / 2) levonva, ha elég széles
    const levon = tt && Lo > 2 * wOrom ? wOrom * (a.belmagassag - tt.terdfal!) : 0;
    const f: Felulet = { id: ujId(), nev: tt ? `Oromfal (tetőtér) – ${t}` : `Homlokzati fal – ${t}`, fajta: 'opak', retegrendId: falRid, hatar: 'kulso', tajolas: t, hajlasszog: 90, ...(levon ? {} : { meret: { hossz: kerek(Lo * n), magassag: a.belmagassag } }), A: kerek((Lo * a.belmagassag - levon) * n), chi: 0.2 };
    p.feluletek.push(f); if (!falFel[ir] || Lo > Le) falFel[ir] = f.id;
  }

  if (homDb) uz.push(`${homDb} homlokzati falfelület a homlokzati rajz szerinti falmagassággal (az alaprajzi falak a homlokzati nézethez illesztve: oromfal, térdfal, eltérő párkánymagasság) – ellenőrizd a Határolás lépésben.`);
  // fal fűtetlen helyiség felé (b tényezővel)
  const futetlen = new Map<string, number>();
  if (a.szomszedFutetlen && a.szomszedFutetlen >= 0.3) futetlen.set('szomszédos (fűtetlen) épület', a.szomszedFutetlen);
  for (const h of a.helyisegek.filter(burok)) for (const f of h.futetlenFalak ?? []) futetlen.set(f.fele, (futetlen.get(f.fele) ?? 0) + f.hossz);
  const belsoFal = a.retegrendek.find((x) => x.becsles.szerep === 'fal' && /teherhordó|belső/i.test(x.rr.cim));
  const futFel: Record<string, { id: string; hatar: 'garazs' | 'futetlen_helyiseg' }> = {};
  for (const [fele, hossz] of futetlen) {
    const b = /garázs|garazs/i.test(fele) ? 'garazs' : 'futetlen_helyiseg';
    const fid = ujId(); futFel[fele] = { id: fid, hatar: b };
    p.feluletek.push({ id: fid, nev: `Fal – ${fele} felé`, fajta: 'opak', retegrendId: (belsoFal && rrIdM.get(belsoFal.rr)) ?? falRid, hatar: b, hajlasszog: 90, tajolas: null, meret: { hossz: kerek(hossz * n), magassag: a.belmagassag }, A: kerek(hossz * n * a.belmagassag), chi: 0.1 });
  }

  // talajon fekvő padló(k) – burkolat szerint a megfelelő padló-rétegrendre; a kerület a terület arányában oszlik meg
  const futott = a.helyisegek.filter((h) => h.kategoria !== 'gyengen_kapcsolt');
  const Aossz = futott.reduce((s, h) => s + h.A, 0);
  // a legfelső szint feletti szerkezet (tető, kalapfödém) vízszintes vetülete a teljes alapterület szerint
  const AossT = futott.reduce((s, h) => s + (h.teljesA ?? h.A), 0);
  // terepszint alatt csak a talaj felé eső kerület kitett (a fűtetlen belső tér felé eső nem)
  const Possz = a.helyisegek.filter(burok).reduce((s, h) => s + h.falak.filter((f) => !terep || f.talaj).reduce((q, f) => q + f.hossz, 0), 0);
  const pinceFodem = a.retegrendek.find((x) => x.becsles.szerep === 'pincefodem' && x.becsles.kovetelmenyKod === 'also_zarofodem' && !x.becsles.kihagy);
  if (foldszint && !terep && pinceFodem && Aossz > 0) {
    const garazs = /garázs|garazs/i.test(pinceFodem.rr.cim);
    const fodId = ujId();
    // a legalsó szint helyiségeinek padlója ez a födém (a hőszükségletben b-tényezővel), nem talajon fekvő
    for (const id of helyIdk) { const h = p.helyisegek.find((x) => x.id === id); if (h?.hsz) { h.hsz.padlo = true; h.hsz.padloFeluletId = fodId; } }
    p.feluletek.push({ id: fodId, nev: `Födém – fűtetlen ${garazs ? 'garázs' : 'pince'} felett`, fajta: 'opak', retegrendId: rrIdM.get(pinceFodem.rr), hatar: garazs ? 'melygarazs' : 'pince', A: kerek(Aossz), tajolas: null, hajlasszog: 0, chi: 0.1 });
    uz.push(`A legalsó fűtött szint padlója a(z) ${pinceFodem.rr.kod}${pinceFodem.rr.cim ? ` „${pinceFodem.rr.cim}”` : ""} födém (fűtetlen ${garazs ? 'mélygarázs' : 'pince'} felett, b-tényezővel).`);
  } else if ((foldszint || terep) && padlok.length && Aossz > 0) {
    const elsoReteg = (x: AtvettRetegrend) => x.retegek.find((l) => !l.kimarad)?.forras.toLowerCase() ?? '';
    // fűtött helyiség alá nem kerül a garázs / tároló padlója; a vizes helyiség a „vizes” padlót kapja
    const futottPadlok = padlok.filter((x) => !/garázs|garazs|tároló|pince/i.test(x.rr.cim)) .length ? padlok.filter((x) => !/garázs|garazs|tároló|pince/i.test(x.rr.cim)) : padlok;
    const valaszt = (h: AtvettHelyiseg) => {
      const vizes = futottPadlok.find((x) => /vizes|nedves/i.test(x.rr.cim));
      if (vizes && /fürdő|furdo|wc|zuh|mosó|zuhany|kád/i.test(h.nev)) return vizes;
      const b = (h.burkolat ?? '').toLowerCase();
      const kulcs = /kerámia|csempe|gres|járólap|kő/.test(b) ? /kerámia|krámia|csempe|gres|járólap|kő/ : /parkett|lamin/.test(b) ? /parkett|lamin/ : null;
      const nemVizes = futottPadlok.filter((x) => !/vizes|nedves/i.test(x.rr.cim));
      const lista = nemVizes.length ? nemVizes : futottPadlok;
      return (kulcs && lista.find((x) => kulcs.test(elsoReteg(x)))) || lista[0]!;
    };
    const csop = new Map<AtvettRetegrend, number>();
    for (const h of futott) { const r = valaszt(h); csop.set(r, (csop.get(r) ?? 0) + h.A); }
    for (const [r, A] of csop) {
      p.feluletek.push({
        id: ujId(), nev: `Talajon fekvő padló – ${r.rr.kod}`, fajta: 'padlo', retegrendId: rrIdM.get(r.rr), hatar: 'kulso', A: kerek(A),
        padlo: { P: kerek(Possz * A / Aossz), dfCm: a.falVastagsagCm ?? (fal ? kerek(fal.retegek.filter((l) => !l.kimarad).reduce((s, l) => s + l.dCm, 0), 1) : 45), z: terep ? kerek(z) : 0, psiPF: terep ? 0 : 0.15 },
      });
    }
    if (csop.size > 1) uz.push('A padló több rétegrendre bontva: a kitett kerület a területek arányában oszlik meg (azonos B′ jellemző méret).');
  } else if ((foldszint || terep) && !padlok.length && Aossz > 0) {
    // a metszeten nincs padló-rétegrend (pl. a rétegrendek külön lapon, csak jellel): a felület a helyes méretével
    // átkerül, a rétegrendet a felhasználó választja
    p.feluletek.push({
      id: ujId(), nev: 'Talajon fekvő padló', fajta: 'padlo', hatar: 'kulso', A: kerek(Aossz),
      padlo: { P: kerek(Possz), dfCm: a.falVastagsagCm ?? 45, z: terep ? kerek(z) : 0, psiPF: terep ? 0 : 0.15 },
    });
    uz.push(`Padló-rétegrendet nem találtam a metszeten: a talajon fekvő padló (${sz2(Aossz)} m²) rétegrend nélkül került át – válaszd ki a Határolás lépésben.`);
  }
  // tetőtér: a térdfal és a kalapfödém (belmagasság) közti ferde tetősáv az eresz menti homlokzatokon; vízszintes
  // vetülete a tetőtér alapterületéből levonódik (a maradék a kalapfödém / padlásfödém)
  let AFelso = AossT;
  if (tt && AossT > 0) {
    const alfa = tt.hajlas * Math.PI / 180;
    const w = Math.max(0, (a.belmagassag - tt.terdfal!) / Math.tan(alfa));
    const tetoRr = a.retegrendek.find((x) => x.becsles.szerep === 'teto' && !x.becsles.kihagy && !/garázs|garazs|pince/i.test(x.rr.cim)) ?? padlas;
    let vetulet = 0;
    for (const ir of Object.keys(ereszHossz).map(Number)) {
      const L = ereszHossz[ir]!; if (L < 0.2) continue;
      const v = Math.min(L * w, AossT / 2); vetulet += v;
      const t = egtaj(ir, a.eszakSzog);
      p.feluletek.push({ id: ujId(), nev: `Ferde tető (tetőtér, ${sz2(tt.hajlas)}°) – ${t}`, fajta: 'opak', retegrendId: tetoRr ? rrIdM.get(tetoRr.rr) : undefined, hatar: 'kulso', A: kerek(v / Math.cos(alfa)), tajolas: t, hajlasszog: ([30, 45, 60] as const).reduce((b, x) => (Math.abs(x - tt.hajlas) < Math.abs(b - tt.hajlas) ? x : b)), chi: 0.1 });
    }
    AFelso = Math.max(0, AossT - vetulet);
    // tetősík ablakok a ferde tetőben
    const ferdeId: Record<number, string> = {};
    for (const f of p.feluletek.slice(-4)) for (const ir of [0, 90, 180, 270]) if (f.nev.endsWith(`– ${egtaj(ir, a.eszakSzog)}`) && f.nev.startsWith('Ferde tető')) ferdeId[ir] = f.id;
    const csop = new Map<string, { helyiseg: number; ir: number; szel: number; mag: number; db: number }>();
    for (const ta of a.tetoablakok ?? []) {
      if (!a.helyisegek[ta.helyiseg] || !burok(a.helyisegek[ta.helyiseg]!)) continue;
      // tájolás: a homlokzatról ismert irány, ill. az alaprajzi felirathoz legközelebbi külső fal iránya (összetett,
      // pl. L alakú tetőnél az eresz nem csak a fő homlokzatpáron van)
      const ir = ta.irany ?? Number(Object.entries(ta.tav ?? {}).sort((x, y) => x[1] - y[1])[0]?.[0] ?? ereszIr[0]);
      const k = `${ta.helyiseg}|${ir}|${ta.szel}|${ta.mag}`;
      const c = csop.get(k); if (c) c.db++; else csop.set(k, { helyiseg: ta.helyiseg, ir, szel: ta.szel, mag: ta.mag, db: 1 });
    }
    const hsz = ([30, 45, 60] as const).reduce((b, x) => (Math.abs(x - tt.hajlas) < Math.abs(b - tt.hajlas) ? x : b));
    let tdb = 0;
    for (const c of csop.values()) {
      const meret = `${String(Math.round(c.szel * 100))}×${String(Math.round(c.mag * 100))}`;
      let t = p.nyilaszarok.find((x) => x.kovetelmenyKod === 'tetosik_ablak' && Math.abs(x.szelesseg - c.szel) < 1e-6 && Math.abs(x.magassag - c.mag) < 1e-6);
      if (!t) {
        const s = NS.NYILASZARO_SABLONOK.find((x) => x.kod === 'pvc_3r')!;
        t = sablonbolNyilaszaro(s, { id: ujId(), szelesseg: c.szel, magassag: c.mag, kovetelmenyKod: 'tetosik_ablak' });
        t.nev = `Tetősík ablak ${meret}`; t.kovetelmenyKod = 'tetosik_ablak'; t.csoportId = csoportFajta(p, 'ablak', 'tetősík ablak');
        p.nyilaszarok.push(t);
      }
      const h = a.helyisegek[c.helyiseg]!;
      // szülő: az azonos irányú ferde tetősáv, ennek híján a nagyobbik
      const szulo = ferdeId[c.ir] ?? Object.values(ferdeId).sort((x, y) => (p.feluletek.find((f) => f.id === y)?.A ?? 0) - (p.feluletek.find((f) => f.id === x)?.A ?? 0))[0];
      p.feluletek.push({ id: ujId(), nev: `${h.nev} – Tetősík ablak ${meret}`, helyisegId: helyIdk[c.helyiseg], fajta: 'nyilaszaro', nyilaszaroId: t.id, hatar: 'kulso', darab: c.db * n, tajolas: egtaj(c.ir, a.eszakSzog), hajlasszog: hsz, szuloId: szulo });
      tdb += c.db;
    }
    if (tdb) uz.push(`Tetőtér: ${tdb} tetősík ablak (${(a.tetoablakok ?? []).some((x) => x.irany !== undefined) ? 'a homlokzatokról: a térdfal teteje feletti keretek, a látszó magasság / sin(hajlásszög)' : 'a tetőtéri alaprajz falhoz nem köthető méretfeliratai'}) – a ferde tetőből vonódnak le.`);
    uz.push(`Tetőtér: ${sz2(tt.hajlas)}°-os tető, ${sz2(tt.terdfal!)} m térdfal (metszet); eresz menti hossz ${Object.entries(ereszHossz).filter(([, v]) => v >= 0.2).map(([ir, v]) => `${egtaj(Number(ir), a.eszakSzog)} ${sz2(kerek(v))} m`).join(', ')}${tt.orom && Object.keys(tt.orom).length ? ' (a homlokzatokon látszó oromzatok levonásával)' : ' (a hosszabb homlokzatpár)'}; ferde tetősáv ${sz2(kerek(w))} m vízszintes szélességben (${sz2(kerek(vetulet / Math.cos(alfa)))} m²), vízszintes födém ${sz2(kerek(AFelso))} m². Az oromfalak a belmagasságig, a ferde sarkok nélkül – a Határolás lépésben ellenőrizd.`);
  }
  if (legfelso && padlas && AFelso > 0) p.feluletek.push({ id: ujId(), nev: tt ? 'Padlásfödém (kalapfödém)' : 'Padlásfödém', fajta: 'opak', retegrendId: rrIdM.get(padlas.rr), hatar: 'padlas', A: kerek(AFelso), tajolas: null, hajlasszog: 0, chi: 0.1 });
  else if (legfelso && teto && AFelso > 0) {
    p.feluletek.push({ id: ujId(), nev: 'Tető – legfelső szint felett', fajta: 'opak', retegrendId: rrIdM.get(teto.rr), hatar: 'kulso', A: kerek(AFelso), tajolas: null, hajlasszog: 0, chi: 0.1 });
    const tobb = a.retegrendek.filter((x) => x.becsles.szerep === 'teto' && !x.becsles.kihagy && x !== teto).length;
    uz.push(`Padlásfödém nincs: a legfelső szint tetője a(z) ${teto.rr.kod}${teto.rr.cim ? ` „${teto.rr.cim}”` : ""} (${sz2(Aossz)} m², a helyiségek nettó alapterülete)${tobb ? ` – a metszeten még ${tobb} tető-rétegrend van, a Határolás lépésben bontsd a tényleges tetőfelületek szerint` : ''}.`);
  }
  else if (legfelso && AFelso > 0) {
    p.feluletek.push({ id: ujId(), nev: 'Tető / padlásfödém – legfelső szint felett', fajta: 'opak', hatar: 'kulso', A: kerek(AFelso), tajolas: null, hajlasszog: 0, chi: 0.1 });
    uz.push(`Tető- és padlásfödém-rétegrendet nem találtam a metszeten: a legfelső szint feletti felület (${sz2(Aossz)} m²) rétegrend nélkül került át – válaszd ki a Határolás lépésben (padlásfödémnél a határ: fűtetlen padlás).`);
  }
  // tetősík ablakok tetőtéri adatok (metszet) nélkül: az alaprajzi jelükből – a legfelső szint feletti felületből vonódnak le
  if (!tt && a.tetoablakok?.length) {
    const fent = [...p.feluletek].reverse().find((f) => f.fajta === 'opak' && f.hajlasszog === 0 && /legfelső szint felett|Padlásfödém|Tető/.test(f.nev) && f.nev !== 'Talajon fekvő padló');
    const csop = new Map<string, { helyiseg: number; ir: number; szel: number; mag: number; hajlas?: number; db: number }>();
    for (const ta of a.tetoablakok) {
      if (!a.helyisegek[ta.helyiseg] || !burok(a.helyisegek[ta.helyiseg]!)) continue;
      const ir = ta.irany ?? Number(Object.entries(ta.tav ?? {}).sort((x, y) => x[1] - y[1])[0]?.[0] ?? 0);
      const k = `${ta.helyiseg}|${ir}|${ta.szel}|${ta.mag}`;
      const c = csop.get(k); if (c) c.db++; else csop.set(k, { helyiseg: ta.helyiseg, ir, szel: ta.szel, mag: ta.mag, hajlas: ta.hajlas, db: 1 });
    }
    let tdb = 0; const hajlasok = new Set<number>();
    for (const c of csop.values()) {
      const meret = `${String(Math.round(c.szel * 100))}×${String(Math.round(c.mag * 100))}`;
      let t = p.nyilaszarok.find((x) => x.kovetelmenyKod === 'tetosik_ablak' && Math.abs(x.szelesseg - c.szel) < 1e-6 && Math.abs(x.magassag - c.mag) < 1e-6);
      if (!t) {
        const s = NS.NYILASZARO_SABLONOK.find((x) => x.kod === 'pvc_3r')!;
        t = sablonbolNyilaszaro(s, { id: ujId(), szelesseg: c.szel, magassag: c.mag, kovetelmenyKod: 'tetosik_ablak' });
        t.nev = `Tetősík ablak ${meret}`; t.kovetelmenyKod = 'tetosik_ablak'; t.csoportId = csoportFajta(p, 'ablak', 'tetősík ablak');
        p.nyilaszarok.push(t);
      }
      const hsz = ([30, 45, 60] as const).reduce((b, x) => (Math.abs(x - (c.hajlas ?? 45)) < Math.abs(b - (c.hajlas ?? 45)) ? x : b));
      if (c.hajlas) hajlasok.add(c.hajlas);
      const h = a.helyisegek[c.helyiseg]!;
      p.feluletek.push({ id: ujId(), nev: `${h.nev} – Tetősík ablak ${meret}`, helyisegId: helyIdk[c.helyiseg], fajta: 'nyilaszaro', nyilaszaroId: t.id, hatar: 'kulso', darab: c.db * n, tajolas: egtaj(c.ir, a.eszakSzog), hajlasszog: hsz, ...(fent ? { szuloId: fent.id } : {}) });
      tdb += c.db;
    }
    if (tdb) uz.push(`${tdb} tetősík ablak az alaprajzi jelük (áthúzott keret) és feliratuk alapján${hajlasok.size ? `; a tető hajlása a jel vetületi hosszából ≈ ${[...hajlasok].map((x) => `${x}°`).join(', ')}` : ''}${fent ? ` – a(z) „${fent.nev}” felületből vonódnak le` : ''}. A ferde tetőt (metszet nélkül) nem bontottam külön: a Határolás lépésben ellenőrizd a tetőfelületet és az ablakok tájolását.`);
  }

  // nyílászárók: típus méret és fajta szerint, felület helyiség × tájolás × típus szerint darabszámmal
  const tipusok = new Map<string, NyilaszaroTipus>();
  const csoport = new Map<string, { ny: AtvettNyilas; db: number; tipus: NyilaszaroTipus }>();
  // függönyfal: a magassága a belmagasság (a felirat nélküli üvegfal a szint teljes magasságában fut)
  const nyilasok = a.nyilasok.map((ny) => (ny.fajta === 'fuggonyfal' && !(ny.mag > 0) ? { ...ny, mag: a.belmagassag } : ny));
  for (const ny of nyilasok) {
    if (a.helyisegek[ny.helyiseg] && !burok(a.helyisegek[ny.helyiseg]!)) continue;
    const k = `${ny.fajta}|${ny.szel}|${ny.mag}`;
    let t = tipusok.get(k);
    if (!t && !a.csere) {
      // hozzáadáskor a meglévő, azonos méretű és fajtájú típus használható
      const kk = ny.fajta === 'garazskapu' ? 'kapu' : ny.fajta === 'fuggonyfal' ? 'fuggonyfal' : ny.fajta === 'bejarati_ajto' || ny.fajta === 'bejarati_uvegajto' ? 'ajto' : null;
      t = p.nyilaszarok.find((x) => Math.abs(x.szelesseg - ny.szel) < 1e-6 && Math.abs(x.magassag - ny.mag) < 1e-6 && (kk ? x.kovetelmenyKod === kk : x.kovetelmenyKod !== 'ajto' && x.kovetelmenyKod !== 'kapu' && x.kovetelmenyKod !== 'fuggonyfal') && (ny.fajta !== 'erkelyajto') === !/^Erkélyajtó/.test(x.nev) && (ny.fajta === 'bejarati_uvegajto') === /üvegezett/.test(x.nev));
      if (t) tipusok.set(k, t);
    }
    if (!t) { t = nyilaszaroTipus(p, ny); tipusok.set(k, t); p.nyilaszarok.push(t); }
    const ck = `${ny.helyiseg}|${ny.irany}|${k}|${ny.fele ?? ''}|${ny.iranyTipp ? 't' : ''}`;
    const c = csoport.get(ck); if (c) c.db++; else csoport.set(ck, { ny, db: 1, tipus: t });
  }
  for (const { ny, db, tipus } of csoport.values()) {
    const h = a.helyisegek[ny.helyiseg];
    const t: Tajolas = egtaj(ny.irany, a.eszakSzog);
    const ff = ny.fele ? futFel[ny.fele] : undefined;
    p.feluletek.push({
      id: ujId(), nev: `${h ? h.nev : ''} – ${tipus.nev.split(' – ')[0]}${ny.fele ? ` (${ny.fele} felé)` : ''}`, helyisegId: helyIdk[ny.helyiseg], fajta: 'nyilaszaro', nyilaszaroId: tipus.id,
      ...(ny.iranyTipp && !ny.fele ? { tajolasTipp: true } : {}),
      hatar: ny.fele ? ff?.hatar ?? (/garázs|garazs/i.test(ny.fele) ? 'garazs' : 'futetlen_helyiseg') : 'kulso', darab: db * n, tajolas: ny.fele ? null : t, hajlasszog: 90, szuloId: ny.fele ? ff?.id : falFel[ny.irany],
      ...(szintek.some(Boolean) ? { szintek: szintek.filter(Boolean).map((sz) => szintNev(sz)) } : {}),
    });
  }
  const nyilasNelkul = a.nyilasok.filter((ny) => !ny.fele && (!a.helyisegek[ny.helyiseg] || burok(a.helyisegek[ny.helyiseg]!)) && !falFel[ny.irany]).length;
  if (nyilasNelkul) uz.push(`${nyilasNelkul} nyílászáróhoz nem tartozik homlokzati fal azonos irányban – a falból nem vonódik le, a Határolás lépésben rendeld falhoz.`);
  // azonos falfelületek, padlók összevonása (ismételt, mellé olvasott beolvasásnál is egy felület tájolásonként)
  if (n > 1) uz.push(`${n} azonos szint (${szintek.map(szintCimke).join(', ')}): a helyiségek szintenként, a homlokzati falak és nyílászárók ${n}-szeresen kerültek át.`);
  const ossze = feluletekOsszevon(p, (f) => f.fajta !== 'nyilaszaro');
  if (ossze) uz.push(`${ossze} azonos felület összevonva (azonos szerkezet, határ és tájolás).`);
  return { uzenetek: uz };
}
