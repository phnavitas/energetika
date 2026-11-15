/**
 * A 2D tervből épített épületmodell és ugyanazon projekt IFC-jének összevetése (a tervfelismerés pontossága a
 * mennyiségi kiíráshoz). Az IFC-t az ELBA olvasója (vendor/elba-bim-olvaso.js, `ElbaBimOlvaso.olvas`) bontja ki;
 * itt annak kivonatát vetjük össze a modellel: falak vastagság (és külső / belső) szerint, nyílászárók, helyiségek.
 * A modell szerkezete (packages/terv epulet.ts EpuletModell) itt csak a felhasznált mezőkkel szerepel.
 */

type Oldal = { fajta: string };
export interface ModellFal { szint: string; vastag: number; h: number; hossz: number; sikHossz: number; bal: Oldal; jobb: Oldal; profil?: { t: number; z: number }[] }
export interface ModellNyilas { szint: string; szel: number; mag: number; fajta: string }
export interface ModellTer { szint: string; A: number; kategoria: string }
export interface ModellSzint { id: string; nev: string; z0: number }
export interface ModellEpulet { szintek: ModellSzint[]; terek: ModellTer[]; falak: ModellFal[]; nyilasok: ModellNyilas[] }

/** Az ELBA IFC-kivonatának felhasznált része. */
export interface IfcKivonat {
  szintek: { id: number; nev: string; magassag: number }[];
  elemek: { ifc: string; nev?: string; tipusNev?: string; szint?: string; retegek?: { anyag: string; vast: number }[];
    menny?: { L?: number | null; A?: number | null; V?: number | null }; q?: Record<string, number>; pset?: Record<string, Record<string, unknown>> }[];
  helyisegek: { szint: string; terulet: number; belso?: boolean }[];
}

export interface OsszevetSor { csoport: string; mertek: string; modell: number; ifc: number; elteres: number | null }

const kerek = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const vastagOszt = (v: number) => `${Math.round(v * 20) * 5} cm`;
const FAL = /^IFCWALL/i, ABLAK = /^IFCWINDOW/i, AJTO = /^IFCDOOR/i;

/** IFC-fal: vastagság (rétegrend összege / q.Vastagság / Width), tengelyhossz, magasság, bruttó oldalfelület. */
function ifcFal(e: IfcKivonat['elemek'][number]) {
  const q = e.q ?? {};
  const v = (e.retegek?.reduce((s, r) => s + (r.vast || 0), 0) || q['Vastagság'] || q['Width'] || 0) as number;
  const L = (q['Length'] ?? e.menny?.L ?? q['Hossz'] ?? 0) as number;
  const h = (q['Height'] ?? q['Magasság'] ?? 0) as number;
  const A = (q['GrossSideArea'] ?? (L && h ? L * h : 0)) as number;
  const V = (q['GrossVolume'] ?? e.menny?.V ?? A * v) as number;
  const ext = e.pset?.['Pset_WallCommon']?.['IsExternal'];
  return { v, L, h, A, V, kulso: ext === undefined ? null : ext === true || ext === 'T' || ext === '.T.' };
}

export function osszevet(md: ModellEpulet, ifc: IfcKivonat): OsszevetSor[] {
  const sorok: OsszevetSor[] = [];
  const add = (csoport: string, mertek: string, a: number, b: number) => sorok.push({ csoport, mertek, modell: kerek(a), ifc: kerek(b), elteres: b > 0 ? kerek(((a - b) / b) * 100, 1) : a > 0 ? null : 0 });

  add('szintek', 'db', md.szintek.length, ifc.szintek.length);

  // falak: vastagság (ha az IFC jelöli, külső / belső) szerint – tengelyhossz, bruttó oldalfelület, térfogat
  const iFalak = ifc.elemek.filter((e) => FAL.test(e.ifc)).map(ifcFal);
  const kulsoJel = iFalak.some((f) => f.kulso !== null);
  const mKulso = (f: ModellFal) => f.bal.fajta !== 'ter' || f.jobb.fajta !== 'ter';
  const mA = (f: ModellFal) => { if (f.profil && f.profil.length > 1) { let A = 0; for (let i = 1; i < f.profil.length; i++) A += ((f.profil[i]!.t - f.profil[i - 1]!.t) * (f.profil[i]!.z + f.profil[i - 1]!.z)) / 2; return A * f.hossz; } return f.hossz * f.h; };
  const mCs = (f: ModellFal) => `${kulsoJel ? (mKulso(f) ? 'külső ' : 'belső ') : ''}fal ${vastagOszt(f.vastag)}`;
  const iCs = (f: ReturnType<typeof ifcFal>) => `${kulsoJel ? (f.kulso ? 'külső ' : 'belső ') : ''}fal ${vastagOszt(f.v)}`;
  const csop = [...new Set([...md.falak.map(mCs), ...iFalak.map(iCs)])].sort();
  const ossz = { m: [0, 0, 0], i: [0, 0, 0] };
  for (const cs of csop) {
    const mf = md.falak.filter((f) => mCs(f) === cs), xf = iFalak.filter((f) => iCs(f) === cs);
    const m = [mf.reduce((s, f) => s + f.hossz, 0), mf.reduce((s, f) => s + mA(f), 0), mf.reduce((s, f) => s + mA(f) * f.vastag, 0)];
    const i = [xf.reduce((s, f) => s + f.L, 0), xf.reduce((s, f) => s + f.A, 0), xf.reduce((s, f) => s + f.V, 0)];
    add(cs, 'hossz m', m[0]!, i[0]!); add(cs, 'felület m²', m[1]!, i[1]!); add(cs, 'térfogat m³', m[2]!, i[2]!);
    for (let k = 0; k < 3; k++) { ossz.m[k]! += m[k]!; ossz.i[k]! += i[k]!; }
  }
  add('falak összesen', 'hossz m', ossz.m[0]!, ossz.i[0]!); add('falak összesen', 'felület m²', ossz.m[1]!, ossz.i[1]!); add('falak összesen', 'térfogat m³', ossz.m[2]!, ossz.i[2]!);

  // nyílászárók
  const mAjto = (n: ModellNyilas) => /ajto|kapu/.test(n.fajta);
  const nyA = (e: IfcKivonat['elemek'][number]) => (e.q?.['GrossArea'] ?? e.q?.['Area'] ?? e.menny?.A ?? 0) as number;
  for (const [nev, mN, iN] of [['ablak', md.nyilasok.filter((n) => !mAjto(n)), ifc.elemek.filter((e) => ABLAK.test(e.ifc))], ['ajtó', md.nyilasok.filter(mAjto), ifc.elemek.filter((e) => AJTO.test(e.ifc))]] as const) {
    add(nev, 'db', mN.length, iN.length);
    add(nev, 'felület m²', mN.reduce((s, n) => s + n.szel * n.mag, 0), iN.reduce((s, e) => s + nyA(e), 0));
  }

  // helyiségek (a belsők), összesen és szintenként
  const iH = ifc.helyisegek.filter((h) => h.belso !== false);
  add('helyiségek', 'db', md.terek.length, iH.length);
  add('helyiségek', 'alapterület m²', md.terek.reduce((s, t) => s + t.A, 0), iH.reduce((s, h) => s + h.terulet, 0));
  for (const sz of md.szintek) {
    const iSz = ifc.szintek.find((s) => Math.abs(s.magassag - sz.z0) < 0.6); if (!iSz) continue;
    add(`${sz.nev} ↔ ${iSz.nev}`, 'helyiségek m²', md.terek.filter((t) => t.szint === sz.id).reduce((s, t) => s + t.A, 0), iH.filter((h) => h.szint === iSz.nev).reduce((s, h) => s + h.terulet, 0));
  }
  return sorok;
}
