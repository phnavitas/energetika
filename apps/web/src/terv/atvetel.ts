/**
 * A tervből felismert adatok átvétele a projektbe: helyiségek (helyiségenkénti külső falhosszal), rétegrendek,
 * homlokzati falfelületek tájolás szerint, talajon fekvő padló, padlásfödém, nyílászáró-típusok és -felületek.
 */
import type { Projekt, Retegrend, Felulet, NyilaszaroTipus, HelyisegKategoria, Helyiseg } from '../modell';
import { ujId, sablonbolNyilaszaro, retegrendAutoNev } from '../modell';
import { nyilaszaroSablon as NS } from '@mag/index';
import type { Tajolas } from '@mag/tablak/klima';
import type { TervRetegUI, SzerepBecsles, TervRetegrend } from './metszet';
import { egtaj } from './alaprajz';

export interface AtvettHelyiseg {
  kod?: string; nev: string; burkolat?: string; A: number; kategoria: HelyisegKategoria;
  /** Külső falak a homlokzat lapiránya szerint (nettó belső hossz, m). */
  falak: { irany: number; hossz: number }[];
  /** Fal fűtetlen, gyengén kapcsolt helyiség (pl. garázs) felé. */
  futetlenFalak?: { hossz: number; fele: string }[];
}
export interface AtvettRetegrend { rr: TervRetegrend; becsles: SzerepBecsles; retegek: TervRetegUI[] }
export interface AtvettNyilas {
  fajta: 'ablak' | 'erkelyajto' | 'bejarati_ajto';
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
  /** Forrás a megjegyzésekhez (fájlnév). */
  forras?: string;
}

const kerek = (x: number, n = 2) => Math.round(x * 10 ** n) / 10 ** n;

function nyilaszaroTipus(p: Projekt, ny: AtvettNyilas): NyilaszaroTipus {
  const meret = `${String(Math.round(ny.szel * 100))}×${String(Math.round(ny.mag * 100))}`;
  if (ny.fajta === 'bejarati_ajto') {
    return { id: ujId(), nev: `Bejárati ajtó ${meret}`, kovetelmenyKod: 'ajto', szelesseg: ny.szel, magassag: ny.mag, uwKezi: 1.2, gn: 0 };
  }
  // az építés (ill. nyílászárócsere) évének megfelelő kortipikus ablak; új épületnél háromrétegű üvegezésű műanyag
  const ev = p.meta.nyilaszaroCsereEv ?? p.meta.epitesiEv;
  const s = NS.NYILASZARO_SABLONOK.filter((x) => x.anyag === 'pvc' && ev >= x.korszak[0] && ev <= x.korszak[1]).at(-1)
    ?? NS.NYILASZARO_SABLONOK.find((x) => x.kod === 'pvc_3r')!;
  const n = sablonbolNyilaszaro(s, { id: ujId(), szelesseg: ny.szel, magassag: ny.mag, kovetelmenyKod: 'ablak_fa_pvc' });
  n.nev = `${ny.fajta === 'erkelyajto' ? 'Erkélyajtó' : 'Ablak'} ${meret} – ${s.nev.charAt(0).toLowerCase()}${s.nev.slice(1)}`;
  return n;
}

/** Alkalmazza az átvételt a projekt (piszkozat) példányán. */
export function tervAtvesz(p: Projekt, a: TervAtvetel): { uzenetek: string[] } {
  const uz: string[] = [];
  if (a.csere) {
    p.helyisegek = []; p.feluletek = [];
    p.nyilaszarok = p.nyilaszarok.filter(() => false);
  }
  p.meta.szintek = a.szintszam;

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
    r.nevKezi = true;
    p.retegrendek.push(r);
    rrId[x.rr.kod] = r.id;
  }
  const keres = (sz: string, kizar?: string) => a.retegrendek.find((x) => x.becsles.szerep === sz && !x.becsles.kihagy && x.rr.kod !== kizar);
  const fal = keres('fal'); const padlas = keres('padlas'); const padlok = a.retegrendek.filter((x) => x.becsles.szerep === 'padlo' && !x.becsles.kihagy);
  if (!fal) uz.push('Külső fal rétegrendet nem találtam a metszeten – a homlokzati falfelületekhez válassz rétegrendet.');
  const falRid = fal ? rrId[fal.rr.kod] : undefined;

  // helyiségek
  const helyIdk: string[] = [];
  const legfelso = true, foldszint = true; // egyszintes beolvasás: az alaprajz szintje a legalsó és a legfelső is
  for (const h of a.helyisegek) {
    const id = ujId(); helyIdk.push(id);
    const hz: Helyiseg = {
      id, nev: h.kod ? `${h.nev} (${h.kod})` : h.nev, kategoria: h.kategoria, A: kerek(h.A), h: a.belmagassag,
      hsz: {
        kulsoFalak: falRid ? h.falak.filter((f) => f.hossz >= 0.2).map((f) => ({ id: ujId(), retegrendId: falRid, hossz: kerek(f.hossz) })) : [],
        padlas: legfelso && !!padlas, padlo: foldszint && !!padlok.length, szomszedok: [],
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
    const f: Felulet = { id: ujId(), nev: `Homlokzati fal – ${t}`, fajta: 'opak', retegrendId: falRid, hatar: 'kulso', tajolas: t, hajlasszog: 90, meret: { hossz, magassag: a.belmagassag }, A: kerek(hossz * a.belmagassag), chi: 0.2 };
    p.feluletek.push(f); falFel[ir] = f.id;
  }

  // fal fűtetlen helyiség felé (b tényezővel)
  const futetlen = new Map<string, number>();
  for (const h of a.helyisegek.filter(burok)) for (const f of h.futetlenFalak ?? []) futetlen.set(f.fele, (futetlen.get(f.fele) ?? 0) + f.hossz);
  const belsoFal = a.retegrendek.find((x) => x.becsles.szerep === 'fal' && /teherhordó|belső/i.test(x.rr.cim));
  for (const [fele, hossz] of futetlen) {
    const b = /garázs|garazs/i.test(fele) ? 'garazs' : 'futetlen_helyiseg';
    p.feluletek.push({ id: ujId(), nev: `Fal – ${fele} felé`, fajta: 'opak', retegrendId: (belsoFal && rrId[belsoFal.rr.kod]) ?? falRid, hatar: b, hajlasszog: 90, tajolas: null, meret: { hossz: kerek(hossz), magassag: a.belmagassag }, A: kerek(hossz * a.belmagassag), chi: 0.1 });
  }

  // talajon fekvő padló(k) – burkolat szerint a megfelelő padló-rétegrendre; a kerület a terület arányában oszlik meg
  const futott = a.helyisegek.filter((h) => h.kategoria !== 'gyengen_kapcsolt');
  const Aossz = futott.reduce((s, h) => s + h.A, 0);
  const Possz = a.helyisegek.filter(burok).reduce((s, h) => s + h.falak.reduce((q, f) => q + f.hossz, 0), 0);
  if (padlok.length && Aossz > 0) {
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
  if (padlas && Aossz > 0) p.feluletek.push({ id: ujId(), nev: 'Padlásfödém', fajta: 'opak', retegrendId: rrId[padlas.rr.kod], hatar: 'padlas', A: kerek(Aossz), tajolas: null, hajlasszog: 0, chi: 0.1 });

  // nyílászárók: típus méret és fajta szerint, felület helyiség × tájolás × típus szerint darabszámmal
  const tipusok = new Map<string, NyilaszaroTipus>();
  const csoport = new Map<string, { ny: AtvettNyilas; db: number; tipus: NyilaszaroTipus }>();
  for (const ny of a.nyilasok) {
    if (a.helyisegek[ny.helyiseg] && !burok(a.helyisegek[ny.helyiseg]!)) continue;
    const k = `${ny.fajta}|${ny.szel}|${ny.mag}`;
    let t = tipusok.get(k);
    if (!t) { t = nyilaszaroTipus(p, ny); tipusok.set(k, t); p.nyilaszarok.push(t); }
    const ck = `${ny.helyiseg}|${ny.irany}|${k}`;
    const c = csoport.get(ck); if (c) c.db++; else csoport.set(ck, { ny, db: 1, tipus: t });
  }
  for (const { ny, db, tipus } of csoport.values()) {
    const h = a.helyisegek[ny.helyiseg];
    const t: Tajolas = egtaj(ny.irany, a.eszakSzog);
    p.feluletek.push({
      id: ujId(), nev: `${h ? h.nev : ''} – ${tipus.nev.split(' – ')[0]}`, helyisegId: helyIdk[ny.helyiseg], fajta: 'nyilaszaro', nyilaszaroId: tipus.id,
      hatar: 'kulso', darab: db, tajolas: t, hajlasszog: 90, szuloId: falFel[ny.irany],
    });
  }
  return { uzenetek: uz };
}
