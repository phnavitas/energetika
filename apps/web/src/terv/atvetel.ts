/**
 * A tervből felismert adatok átvétele a projektbe: helyiségek (helyiségenkénti külső falhosszal), rétegrendek,
 * homlokzati falfelületek tájolás szerint, talajon fekvő padló, padlásfödém, nyílászáró-típusok és -felületek.
 */
import { AJTO_KAPU_SABLONOK } from '../katalogus';
import type { Projekt, Retegrend, Felulet, NyilaszaroTipus, HelyisegKategoria, Helyiseg } from '../modell';
import { ujId, sablonbolNyilaszaro, retegrendAutoNev, feluletekOsszevon, SZEREP_ALAP } from '../modell';
import { nyilaszaroSablon as NS, szerkezetSablon as SS } from '@mag/index';
import type { Tajolas } from '@mag/tablak/klima';
import type { TervRetegUI, SzerepBecsles, TervRetegrend } from './metszet';
import { egtaj, szintNev } from './alaprajz';

export interface AtvettHelyiseg {
  kod?: string; nev: string; burkolat?: string; A: number; kategoria: HelyisegKategoria;
  /** Lakás / egység megjelenő neve (csoportosításhoz). */
  egyseg?: string;
  /** Külső falak a homlokzat lapiránya szerint (nettó belső hossz, m). */
  falak: { irany: number; hossz: number }[];
  /** Fal fűtetlen, gyengén kapcsolt helyiség (pl. garázs) felé. */
  futetlenFalak?: { hossz: number; fele: string }[];
}
export interface AtvettRetegrend { rr: TervRetegrend; becsles: SzerepBecsles; retegek: TervRetegUI[] }
export interface AtvettNyilas {
  fajta: 'ablak' | 'erkelyajto' | 'bejarati_ajto' | 'bejarati_uvegajto' | 'garazskapu';
  szel: number; mag: number; pm: number | null;
  /** Index az `helyisegek` tömbben. */
  helyiseg: number; irany: number;
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
  /** Az alaprajz által ábrázolt szintek (pl. ['1', '2'] – azonos 1. és 2. emelet): a helyiségek szintenként, a falak, nyílászárók szintszámszorosan. */
  szintek?: string[];
}

const kerek = (x: number, n = 2) => Math.round(x * 10 ** n) / 10 ** n;

const CSOPORT_NEV = { ablak: 'Ablakok', erkelyajto: 'Erkélyajtók', bejarati_ajto: 'Bejárati ajtók', bejarati_uvegajto: 'Bejárati ajtók', garazskapu: 'Garázskapuk' } as const;
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
  const rrId: Record<string, string> = {};
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
    if (meglevo) { rrId[x.rr.kod] = meglevo.id; continue; }
    p.retegrendek.push(r);
    rrId[x.rr.kod] = r.id;
  }
  const keres = (sz: string, kizar?: string) => a.retegrendek.find((x) => x.becsles.szerep === sz && !x.becsles.kihagy && x.rr.kod !== kizar);
  const fal = keres('fal'); const padlas = keres('padlas'); const padlok = a.retegrendek.filter((x) => x.becsles.szerep === 'padlo' && !x.becsles.kihagy);
  if (!fal) uz.push('Külső fal rétegrendet nem találtam a metszeten – a homlokzati falfelületekhez válassz rétegrendet.');
  let falRid = fal ? rrId[fal.rr.kod] : undefined;
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
        padlas: legfelso && si === n - 1 && !!padlas, padlo: foldszint && si === 0 && !!padlok.length, szomszedok: [],
      },
    };
    p.helyisegek.push(hz);
  }

  // homlokzati falak tájolás szerint
  const falFel: Record<number, string> = {};
  // a fűtetlen (gyengén kapcsolt) helyiség – pl. garázs – külső fala és nyílászárói nem a hőburok részei
  const burok = (h: AtvettHelyiseg) => h.kategoria !== 'gyengen_kapcsolt';
  const iranyok = [...new Set(a.helyisegek.filter(burok).flatMap((h) => h.falak.map((f) => f.irany)))].sort((x, y) => x - y);
  for (const ir of iranyok) {
    const hossz = kerek(a.helyisegek.filter(burok).reduce((s, h) => s + h.falak.filter((f) => f.irany === ir).reduce((q, f) => q + f.hossz, 0), 0));
    if (hossz < 0.2) continue;
    const t = egtaj(ir, a.eszakSzog);
    const f: Felulet = { id: ujId(), nev: `Homlokzati fal – ${t}`, fajta: 'opak', retegrendId: falRid, hatar: 'kulso', tajolas: t, hajlasszog: 90, meret: { hossz: kerek(hossz * n), magassag: a.belmagassag }, A: kerek(hossz * n * a.belmagassag), chi: 0.2 };
    p.feluletek.push(f); falFel[ir] = f.id;
  }

  // fal fűtetlen helyiség felé (b tényezővel)
  const futetlen = new Map<string, number>();
  for (const h of a.helyisegek.filter(burok)) for (const f of h.futetlenFalak ?? []) futetlen.set(f.fele, (futetlen.get(f.fele) ?? 0) + f.hossz);
  const belsoFal = a.retegrendek.find((x) => x.becsles.szerep === 'fal' && /teherhordó|belső/i.test(x.rr.cim));
  for (const [fele, hossz] of futetlen) {
    const b = /garázs|garazs/i.test(fele) ? 'garazs' : 'futetlen_helyiseg';
    p.feluletek.push({ id: ujId(), nev: `Fal – ${fele} felé`, fajta: 'opak', retegrendId: (belsoFal && rrId[belsoFal.rr.kod]) ?? falRid, hatar: b, hajlasszog: 90, tajolas: null, meret: { hossz: kerek(hossz * n), magassag: a.belmagassag }, A: kerek(hossz * n * a.belmagassag), chi: 0.1 });
  }

  // talajon fekvő padló(k) – burkolat szerint a megfelelő padló-rétegrendre; a kerület a terület arányában oszlik meg
  const futott = a.helyisegek.filter((h) => h.kategoria !== 'gyengen_kapcsolt');
  const Aossz = futott.reduce((s, h) => s + h.A, 0);
  const Possz = a.helyisegek.filter(burok).reduce((s, h) => s + h.falak.reduce((q, f) => q + f.hossz, 0), 0);
  const pinceFodem = a.retegrendek.find((x) => x.becsles.szerep === 'pincefodem' && x.becsles.kovetelmenyKod === 'also_zarofodem' && !x.becsles.kihagy);
  if (foldszint && pinceFodem && Aossz > 0) {
    const garazs = /garázs|garazs/i.test(pinceFodem.rr.cim);
    p.feluletek.push({ id: ujId(), nev: `Födém – fűtetlen ${garazs ? 'garázs' : 'pince'} felett`, fajta: 'opak', retegrendId: rrId[pinceFodem.rr.kod], hatar: garazs ? 'melygarazs' : 'pince', A: kerek(Aossz), tajolas: null, hajlasszog: 0, chi: 0.1 });
    uz.push(`A legalsó fűtött szint padlója a(z) ${pinceFodem.rr.kod} „${pinceFodem.rr.cim}” födém (fűtetlen ${garazs ? 'mélygarázs' : 'pince'} felett, b-tényezővel).`);
  } else if (foldszint && padlok.length && Aossz > 0) {
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
        id: ujId(), nev: `Talajon fekvő padló – ${r.rr.kod}`, fajta: 'padlo', retegrendId: rrId[r.rr.kod], hatar: 'kulso', A: kerek(A),
        padlo: { P: kerek(Possz * A / Aossz), dfCm: a.falVastagsagCm ?? (fal ? kerek(fal.retegek.filter((l) => !l.kimarad).reduce((s, l) => s + l.dCm, 0), 1) : 45), z: 0, psiPF: 0.15 },
      });
    }
    if (csop.size > 1) uz.push('A padló több rétegrendre bontva: a kitett kerület a területek arányában oszlik meg (azonos B′ jellemző méret).');
  }
  if (legfelso && padlas && Aossz > 0) p.feluletek.push({ id: ujId(), nev: 'Padlásfödém', fajta: 'opak', retegrendId: rrId[padlas.rr.kod], hatar: 'padlas', A: kerek(Aossz), tajolas: null, hajlasszog: 0, chi: 0.1 });

  // nyílászárók: típus méret és fajta szerint, felület helyiség × tájolás × típus szerint darabszámmal
  const tipusok = new Map<string, NyilaszaroTipus>();
  const csoport = new Map<string, { ny: AtvettNyilas; db: number; tipus: NyilaszaroTipus }>();
  for (const ny of a.nyilasok) {
    if (a.helyisegek[ny.helyiseg] && !burok(a.helyisegek[ny.helyiseg]!)) continue;
    const k = `${ny.fajta}|${ny.szel}|${ny.mag}`;
    let t = tipusok.get(k);
    if (!t && !a.csere) {
      // hozzáadáskor a meglévő, azonos méretű és fajtájú típus használható
      const kk = ny.fajta === 'garazskapu' ? 'kapu' : ny.fajta === 'bejarati_ajto' || ny.fajta === 'bejarati_uvegajto' ? 'ajto' : null;
      t = p.nyilaszarok.find((x) => Math.abs(x.szelesseg - ny.szel) < 1e-6 && Math.abs(x.magassag - ny.mag) < 1e-6 && (kk ? x.kovetelmenyKod === kk : x.kovetelmenyKod !== 'ajto' && x.kovetelmenyKod !== 'kapu') && (ny.fajta !== 'erkelyajto') === !/^Erkélyajtó/.test(x.nev) && (ny.fajta === 'bejarati_uvegajto') === /üvegezett/.test(x.nev));
      if (t) tipusok.set(k, t);
    }
    if (!t) { t = nyilaszaroTipus(p, ny); tipusok.set(k, t); p.nyilaszarok.push(t); }
    const ck = `${ny.helyiseg}|${ny.irany}|${k}`;
    const c = csoport.get(ck); if (c) c.db++; else csoport.set(ck, { ny, db: 1, tipus: t });
  }
  for (const { ny, db, tipus } of csoport.values()) {
    const h = a.helyisegek[ny.helyiseg];
    const t: Tajolas = egtaj(ny.irany, a.eszakSzog);
    p.feluletek.push({
      id: ujId(), nev: `${h ? h.nev : ''} – ${tipus.nev.split(' – ')[0]}`, helyisegId: helyIdk[ny.helyiseg], fajta: 'nyilaszaro', nyilaszaroId: tipus.id,
      hatar: 'kulso', darab: db * n, tajolas: t, hajlasszog: 90, szuloId: falFel[ny.irany],
      ...(szintek.some(Boolean) ? { szintek: szintek.filter(Boolean).map((sz) => szintNev(sz)) } : {}),
    });
  }
  const nyilasNelkul = a.nyilasok.filter((ny) => (!a.helyisegek[ny.helyiseg] || burok(a.helyisegek[ny.helyiseg]!)) && !falFel[ny.irany]).length;
  if (nyilasNelkul) uz.push(`${nyilasNelkul} nyílászáróhoz nem tartozik homlokzati fal azonos irányban – a falból nem vonódik le, a Határolás lépésben rendeld falhoz.`);
  // azonos falfelületek, padlók összevonása (ismételt, mellé olvasott beolvasásnál is egy felület tájolásonként)
  if (n > 1) uz.push(`${n} azonos szint (${szintek.map(szintCimke).join(', ')}): a helyiségek szintenként, a homlokzati falak és nyílászárók ${n}-szeresen kerültek át.`);
  const ossze = feluletekOsszevon(p, (f) => f.fajta !== 'nyilaszaro');
  if (ossze) uz.push(`${ossze} azonos felület összevonva (azonos szerkezet, határ és tájolás).`);
  return { uzenetek: uz };
}
