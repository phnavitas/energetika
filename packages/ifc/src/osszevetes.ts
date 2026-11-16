/**
 * A 2D tervből épített épületmodell és ugyanazon projekt IFC-jének összevetése (a tervfelismerés pontossága a
 * mennyiségi kiíráshoz). Az IFC-t az ELBA olvasója (vendor/elba-bim-olvaso.cjs, `ElbaBimOlvaso.olvas`) bontja ki.
 *
 * Falak – az ELBA pdf-ifc-osszevetes.js szabályai szerint:
 * - IFC-fal: IFCWALL, ill. ArchiCAD-osztályozás / elemtípus szerint „Fal” (a proxy-exportnál is);
 * - a mérete az összetevő-mennyiségekből (réteges fal magja külön elem – ilyenkor csak ezek számítanak), különben
 *   a fal hossza (belső / külső oldal átlaga) és vastagsága;
 * - a rétegek (hőszigetelés, lábazat, vakolat, burkolat, üveg, fém) nem falak, külön összesítve;
 * - csak az alaprajzi metszősíkot (a szint padlója + 1,2 m) átmetsző fal számít – amit az alaprajz nem mutat
 *   (koszorú, attika), azt nem kérjük számon.
 * A modellben a fal vastagsága a mag: a rajz szerinti rétegrendből a nem-réteg (szerkezeti) rétegek összege.
 * Csoportosítás szintenként, a magvastagság 5 cm-re kerekítve: hossz (m).
 */

type Oldal = { fajta: string };
export interface ModellFal { szint: string; vastag: number; mag?: number; szerkezet?: string; h: number; hossz: number; bal: Oldal; jobb: Oldal;
  retegek?: { reteg?: string; sraff: boolean; vastag: number }[] }
export interface ModellNyilas { szint: string; szel: number; mag: number; fajta: string }
export interface ModellTer { szint: string; A: number; kategoria: string }
export interface ModellSzint { id: string; nev: string; z0: number }
export interface ModellEpulet { szintek: ModellSzint[]; terek: ModellTer[]; falak: ModellFal[]; nyilasok: ModellNyilas[] }

type Elem = { ifc: string; gid?: string; folia?: string; nev?: string; tipusNev?: string; anyag?: string; szint?: string; oszt?: string; hely?: { z?: number | null };
  retegek?: { anyag: string; vast: number }[]; menny?: { L?: number | null; A?: number | null; V?: number | null };
  q?: Record<string, number>; pset?: Record<string, Record<string, unknown>> };
/** Az ELBA IFC-kivonatának felhasznált része. */
export interface IfcKivonat { szintek: { id: number; nev: string; magassag: number }[]; elemek: Elem[]; helyisegek: { szint: string; terulet: number; belso?: boolean }[] }

export interface OsszevetSor { csoport: string; mertek: string; modell: number; ifc: number; elteres: number | null }

const kerek = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const RETEG_JEL = /h[őo]szigetel|szigetel[ée]s|l[áa]bazat|[üu]veg|f[ée]m|bur?kolat|vakolat|^r[ée]teg/i;

/** Elem befoglaló doboza (m, a ±0-hoz mért z) – a mennyiség nélküli exportnál (pl. iTWO-proxy) a fal mérete ebből. */
export type Doboz = { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number };
let DOBOZ: Record<string, Doboz> = {};
function falE(e: Elem) {
  if (/^IFCWALL/.test(e.ifc)) return true;
  // proxy-export: a típusnév / anyag / fólia mondja (FAL - POROTHERM…, SZERKEZET - … FAL)
  // (a nyílászáró-proxy – „ajtó 21”, „ablak …” – a fal fóliáján is ülhet: az nem fal)
  if (/PROXY/.test(e.ifc) && /^(ajt[óo]|ablak|kapu|nyíl[áa]s|tet[őo]ablak)/i.test(e.tipusNev ?? e.nev ?? '')) return false;
  if (/PROXY/.test(e.ifc) && (/^fal\b/i.test(e.tipusNev ?? e.anyag ?? '') || /\bfal\b/i.test(e.folia ?? ''))) return true;
  if (e.oszt === 'Fal') return true;
  return (e.pset?.['ArchiCADProperties'] as Record<string, unknown> | undefined)?.['Elemtípus'] === 'Fal';
}
function falMeret(e: Elem): { v: number; hossz: number; magassag: number | null; mod: 'osszetevo' | 'falhossz' | 'doboz'; z?: number } | null {
  const q = e.q ?? {};
  const v1 = q['Téglalap összetevő szélessége'], h1 = q['Téglalap összetevő magassága'], A1 = q['Összetevő vetített területe (bruttó)'];
  if (v1 && h1 && A1) return { v: v1, hossz: A1 / h1, magassag: h1, mod: 'osszetevo' };
  const v2 = q['Vastagság'] ?? q['Szélesség'], b = q['Fal hossza a belső oldalon'], k = q['Fal hossza a külső oldalon'];
  if (v2 && (b != null || k != null)) { const L = b != null && k != null ? (b + k) / 2 : (b ?? k)!; if (L > 0) return { v: v2, hossz: L, magassag: q['Magasság'] ?? null, mod: 'falhossz' }; }
  // befoglaló doboz (tengelyirányú fal): hossz a hosszabb, vastagság a rövidebb vízszintes oldal
  const d = e.gid ? DOBOZ[e.gid] : undefined;
  if (d) { const dx = d.x1 - d.x0, dy = d.y1 - d.y0; if (Math.max(dx, dy) > 0.1) return { v: Math.min(dx, dy), hossz: Math.max(dx, dy), magassag: d.z1 - d.z0, mod: 'doboz', z: d.z0 }; }
  return null;
}
/** A modellfal magvastagsága: a rétegrendből a szerkezeti rétegek (név szerint nem réteg; név híján a sraffozott). */
function magVastag(f: ModellFal): number {
  if (f.mag) return f.mag;
  if (!f.retegek?.length) return f.vastag;
  // a réteg neve dönt, ha megkülönbözteti a rétegeket; különben a sraffozott a szerkezeti (a hőszigetelés sima)
  const nevek = new Set(f.retegek.map((r) => RETEG_JEL.test(r.reteg ?? '')));
  const mag = f.retegek.filter((r) => (nevek.size > 1 ? !RETEG_JEL.test(r.reteg ?? '') : r.sraff));
  const s = mag.reduce((t, r) => t + r.vastag, 0);
  return s > 0.04 ? s : f.vastag;
}
const oszt5 = (v: number) => Math.round(v * 20) * 5;

export function osszevet(md: ModellEpulet, ifc: IfcKivonat, vagasFolott = 1.2, dobozok: Record<string, Doboz> = {}): OsszevetSor[] {
  DOBOZ = dobozok;
  const sorok: OsszevetSor[] = [];
  const add = (csoport: string, mertek: string, a: number, b: number) => sorok.push({ csoport, mertek, modell: kerek(a), ifc: kerek(b), elteres: b > 0 ? kerek(((a - b) / b) * 100, 1) : a > 0 ? null : 0 });

  // szintpárok: a modell szintje ↔ az IFC azonos (±0,6 m) magasságú szintje
  const parok = md.szintek.flatMap((sz) => { const i = ifc.szintek.find((s) => Math.abs(s.magassag - sz.z0) < 0.6); return i ? [{ m: sz, i }] : []; });
  add('szintek (párosítva)', 'db', parok.length, md.szintek.length);
  for (const { m, i } of parok) add(`${m.nev} ↔ ${i.nev}`, 'padlószint m', m.z0, i.magassag);

  let osszM = 0, osszI = 0;
  for (const { m: msz, i: isz } of parok) {
    // IFC: a szint falai; a szint padlója a falkezdetek alsó negyedének átlaga, a metszősík fölötte vagasFolott-tal
    const ef = ifc.elemek.filter((e) => falE(e) && e.szint === isz.nev);
    const zk = ef.map((e) => e.hely?.z ?? (e.gid ? DOBOZ[e.gid]?.z0 : undefined)).filter((z): z is number => typeof z === 'number').sort((a, b) => a - b);
    const n = Math.max(1, Math.floor(zk.length / 4)), padlo = zk.length ? zk.slice(0, n).reduce((a, b) => a + b, 0) / n : 0, vagas = padlo + vagasFolott;
    let falak: { v: number; hossz: number; mod: string }[] = [];
    const retegek = new Map<string, number>();
    for (const e of ef) {
      const m = falMeret(e); if (!m) continue;
      const z = m.z ?? e.hely?.z;
      if (typeof z === 'number' && m.magassag && !(z < vagas && z + m.magassag > vagas)) continue;
      if (RETEG_JEL.test(e.anyag ?? '')) { retegek.set(e.anyag ?? '?', (retegek.get(e.anyag ?? '?') ?? 0) + m.hossz); continue; }
      falak.push(m);
    }
    if (falak.some((w) => w.mod === 'osszetevo')) falak = falak.filter((w) => w.mod === 'osszetevo');
    // (a „hatar” – helyiséghatár, nem fal – nem számít)
    const mf = md.falak.filter((f) => f.szint === msz.id && f.szerkezet !== 'hatar');
    const csop = [...new Set([...falak.map((w) => oszt5(w.v)), ...mf.map((f) => oszt5(magVastag(f)))])].sort((a, b) => a - b);
    const cim = `${msz.nev} ↔ ${isz.nev}`;
    for (const c of csop) {
      const a = mf.filter((f) => oszt5(magVastag(f)) === c).reduce((s, f) => s + f.hossz, 0), b = falak.filter((w) => oszt5(w.v) === c).reduce((s, w) => s + w.hossz, 0);
      add(`${cim}: fal ${c} cm`, 'hossz m', a, b);
    }
    const a = mf.reduce((s, f) => s + f.hossz, 0), b = falak.reduce((s, w) => s + w.hossz, 0);
    add(`${cim}: falak`, 'hossz m', a, b); osszM += a; osszI += b;
    // egyezés: vastagság-csoportonként a kisebbik hossz összege / az IFC hossza (a vastagság is számít)
    let egy = 0; for (const c of csop) egy += Math.min(mf.filter((f) => oszt5(magVastag(f)) === c).reduce((s, f) => s + f.hossz, 0), falak.filter((w) => oszt5(w.v) === c).reduce((s, w) => s + w.hossz, 0));
    add(`${cim}: falak vastagsággal egyező része`, 'hossz m', egy, b);
    for (const [nev, L] of retegek) add(`${cim}: réteg ${nev}`, 'hossz m (IFC)', 0, L);
  }
  add('falak összesen (párosított szintek)', 'hossz m', osszM, osszI);

  // nyílászárók (IFC: ablak / ajtó entitás vagy név szerint)
  const ablakE = (e: Elem) => /^IFCWINDOW/.test(e.ifc) || (/PROXY/.test(e.ifc) && /^ablak/i.test(e.tipusNev ?? e.nev ?? ''));
  const ajtoE = (e: Elem) => /^IFCDOOR/.test(e.ifc) || (/PROXY/.test(e.ifc) && /ajt[óo]|kapu/i.test(e.tipusNev ?? e.nev ?? ''));
  const mAjto = (n: ModellNyilas) => /ajto|kapu/.test(n.fajta);
  for (const [nev, mN, iN] of [['ablak', md.nyilasok.filter((n) => !mAjto(n)), ifc.elemek.filter(ablakE)], ['ajtó', md.nyilasok.filter(mAjto), ifc.elemek.filter(ajtoE)]] as const) add(nev, 'db', mN.length, iN.length);
  // szintenként: az összes nyílászáró, és ebből a szélesség szerint (± 6 cm) párosítható (az ablak / ajtó besorolás a két
  // oldalon eltérhet – pl. a padlóig érő ablak a modellben erkélyajtó)
  const iSzel = (e: Elem): number | null => { const q = e.q ?? {}; const v = q['Szélesség'] ?? q['OverallWidth'] ?? q['Width'] ?? q['Hossz'];
    if (v) return v; const d = e.gid ? DOBOZ[e.gid] : undefined; return d ? Math.max(d.x1 - d.x0, d.y1 - d.y0) : null; };
  for (const { m: sz, i: iSz } of parok) {
    const mN = md.nyilasok.filter((n) => n.szint === sz.id), iN = ifc.elemek.filter((e) => (ablakE(e) || ajtoE(e)) && e.szint === iSz.nev);
    add(`${sz.nev} ↔ ${iSz.nev}`, 'nyílászáró db', mN.length, iN.length);
    const sz2 = iN.map(iSzel).filter((v): v is number => v !== null).sort((x, y) => x - y), maradt = mN.map((n) => n.szel).sort((x, y) => x - y);
    let par = 0; for (const w of sz2) { const k = maradt.findIndex((v) => Math.abs(v - w) <= 0.06); if (k >= 0) { par++; maradt.splice(k, 1); } }
    if (sz2.length) add(`${sz.nev} ↔ ${iSz.nev}`, 'nyílászáró db szélesség szerint párosítva', par, sz2.length);
  }

  // pillérek és gerendák / koszorúk: a név (az iTWO-export a profil típusnevét adja: „VASBETON pillér 250” a koszorú is) és
  // az entitás nem elég – az alak dönt: pillér a függőleges (≥ 1,5 m magas, vízszintesen ≤ 0,8 m), gerenda / koszorú a
  // vízszintes (≥ 1 m hosszú, 0,1–0,9 m magas), lemez a mindkét irányban ≥ 2 m széles, vékony elem; a hőszigetelés-
  // burkolat (XPS a pillér körül) és a többi réteg nem tartószerkezet
  // (a jelölt: pillér / gerenda entitás, a típusnévben pillér / gerenda / oszlop – az elemnév nem: ott „…oszlophoz” is
  // akad –, ill. a fal-fólián álló, pillér alakú elem; nem tartószerkezet a tetőkiegészítő, járda, burkolat, korlát)
  const alak = (d: Doboz) => { const a = Math.max(d.x1 - d.x0, d.y1 - d.y0), b = Math.min(d.x1 - d.x0, d.y1 - d.y0), h = d.z1 - d.z0;
    return h >= 1.5 && a <= 0.8 ? 'pillér' : b >= 2 && h <= 0.5 ? 'lemez' : a >= 1 && h >= 0.1 && h <= 0.9 ? 'gerenda' : 'egyéb'; };
  const NEM_TARTO = /eresz|dobozol|csatorna|lefoly|j[áa]rda|szeg[ée]ly|burkolat|korl[áa]t|kiegész/i;
  const tarto = ifc.elemek.filter((e) => { const d = e.gid ? DOBOZ[e.gid] : undefined;
      // (a fal-fólián csak a közel négyzetes, beton / acél / profil elem – a falazott falcsonk, pillérnyi falvég nem pillér)
      const negyzet = !!d && Math.max(d.x1 - d.x0, d.y1 - d.y0) <= 1.6 * Math.min(d.x1 - d.x0, d.y1 - d.y0);
      return /COLUMN|BEAM|MEMBER/.test(e.ifc) || /pill[ée]r|gerend|oszlop/i.test(e.tipusNev ?? '')
        || (falE(e) && !!d && alak(d) === 'pillér' && negyzet && /beton|\bvb\b|ac[ée]l|profil/i.test(`${e.tipusNev ?? ''} ${e.anyag ?? ''} ${e.folia ?? ''}`)); })
    .map((e) => ({ e, d: e.gid ? DOBOZ[e.gid] : undefined, reteg: RETEG_JEL.test(`${e.anyag ?? ''} ${e.tipusNev ?? ''}`), nem: NEM_TARTO.test(`${e.tipusNev ?? ''} ${e.folia ?? ''}`) }));
  const tSor = new Map<string, { db: number; L: number }>();
  for (const { d, reteg, nem } of tarto) { const k = reteg ? 'réteg (hőszigetelés stb.)' : nem ? 'nem tartószerkezet (eresz, csatorna, járda…)' : d ? alak(d) : 'méret nélkül'; const v = tSor.get(k) ?? { db: 0, L: 0 }; v.db++; if (d && k === 'gerenda') v.L += Math.max(d.x1 - d.x0, d.y1 - d.y0); tSor.set(k, v); }
  for (const [k, v] of tSor) { add(`pillér / gerenda jelölt (IFC): ${k}`, 'db (IFC)', 0, v.db); if (k === 'gerenda') add(`pillér / gerenda jelölt (IFC): ${k}`, 'hossz m (IFC)', 0, v.L); }

  // helyiségek
  const iH = ifc.helyisegek.filter((h) => h.belso !== false);
  add('helyiségek', 'db', md.terek.length, iH.length);
  add('helyiségek', 'alapterület m²', md.terek.reduce((s, t) => s + t.A, 0), iH.reduce((s, h) => s + h.terulet, 0));
  for (const { m: sz, i: iSz } of parok) add(`${sz.nev} ↔ ${iSz.nev}`, 'helyiségek m²', md.terek.filter((t) => t.szint === sz.id).reduce((s, t) => s + t.A, 0), iH.filter((h) => h.szint === iSz.nev).reduce((s, h) => s + h.terulet, 0));
  return sorok;
}
