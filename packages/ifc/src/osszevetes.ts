/**
 * A 2D tervből épített épületmodell és ugyanazon projekt IFC-modelljének összevetése (a tervfelismerés pontossága a
 * mennyiségi kiíráshoz): szintenkénti és összesített mennyiségek elemcsoportonként, eltéréssel.
 * A modell szerkezete (packages/terv epulet.ts EpuletModell) itt csak a felhasznált mezőkkel szerepel.
 */
import type { IfcModell } from './olvaso';
import { elemMennyiseg } from './mennyiseg';

type Oldal = { fajta: string };
export interface ModellFal { szint: string; vastag: number; h: number; hossz: number; sikHossz: number; bal: Oldal; jobb: Oldal; belsoMag?: number; profil?: { t: number; z: number }[]; csatlakozas?: number }
export interface ModellNyilas { szint: string; szel: number; mag: number; fajta: string; burok: unknown }
export interface ModellTer { szint: string; A: number; kategoria: string; poligonok: unknown[] }
export interface ModellSzint { id: string; nev: string; z0: number; h: number; belmag: number }
export interface ModellEpulet { szintek: ModellSzint[]; terek: ModellTer[]; falak: ModellFal[]; nyilasok: ModellNyilas[] }

export interface OsszevetSor { csoport: string; mertek: string; modell: number; ifc: number; elteres: number | null }

const kerek = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const vastagOszt = (v: number) => `${Math.round(v * 20) * 5} cm`;

export function osszevet(md: ModellEpulet, ifc: IfcModell): OsszevetSor[] {
  const sorok: OsszevetSor[] = [];
  const add = (csoport: string, mertek: string, a: number, b: number) => sorok.push({ csoport, mertek, modell: kerek(a), ifc: kerek(b), elteres: b > 0 ? kerek(((a - b) / b) * 100, 1) : a > 0 ? null : 0 });
  const iq = ifc.elemek.filter((e) => e.tipus !== 'IFCOPENINGELEMENT').map((e) => ({ e, q: elemMennyiseg(ifc, e) }));

  // szintek
  add('szintek', 'db', md.szintek.length, ifc.szintek.length);

  // falak: külső / belső, vastagság szerint – tengelyhossz, egyik oldali felület (bruttó), térfogat (bruttó)
  const mKulso = (f: ModellFal) => f.bal.fajta !== 'ter' || f.jobb.fajta !== 'ter';
  const iKulso = (e: (typeof iq)[number]['e']) => { const v = Object.entries(e.p).find(([k]) => /IsExternal$/i.test(k))?.[1]; return v === true || v === 'T' || v === '.T.'; };
  const mFalak = md.falak, iFalak = iq.filter((x) => x.q.kategoria === 'fal');
  const vanKulsoJel = iFalak.some((x) => Object.keys(x.e.p).some((k) => /IsExternal$/i.test(k)));
  const falCsop = new Set<string>();
  for (const f of mFalak) falCsop.add(`${vanKulsoJel ? (mKulso(f) ? 'külső' : 'belső') + ' ' : ''}fal ${vastagOszt(f.vastag)}`);
  for (const x of iFalak) falCsop.add(`${vanKulsoJel ? (iKulso(x.e) ? 'külső' : 'belső') + ' ' : ''}fal ${vastagOszt(x.q.vastag?.v ?? 0)}`);
  const mFalA = (f: ModellFal) => { const L = f.hossz; if (f.profil && f.profil.length > 1) { let A = 0; for (let i = 1; i < f.profil.length; i++) A += (f.profil[i]!.t - f.profil[i - 1]!.t) * (f.profil[i]!.z + f.profil[i - 1]!.z) / 2; return A * L; } return L * f.h; };
  let osszM = { L: 0, A: 0, V: 0 }, osszI = { L: 0, A: 0, V: 0 };
  for (const cs of [...falCsop].sort()) {
    const mf = mFalak.filter((f) => `${vanKulsoJel ? (mKulso(f) ? 'külső' : 'belső') + ' ' : ''}fal ${vastagOszt(f.vastag)}` === cs);
    const xf = iFalak.filter((x) => `${vanKulsoJel ? (iKulso(x.e) ? 'külső' : 'belső') + ' ' : ''}fal ${vastagOszt(x.q.vastag?.v ?? 0)}` === cs);
    const m = { L: mf.reduce((s, f) => s + f.hossz, 0), A: mf.reduce((s, f) => s + mFalA(f), 0), V: mf.reduce((s, f) => s + mFalA(f) * f.vastag, 0) };
    const i = { L: xf.reduce((s, x) => s + (x.q.hossz?.v ?? 0), 0), A: xf.reduce((s, x) => s + (x.q.Abrutto?.v ?? x.q.Anetto?.v ?? 0), 0), V: xf.reduce((s, x) => s + (x.q.Vbrutto?.v ?? x.q.Vnetto?.v ?? 0), 0) };
    add(cs, 'hossz m', m.L, i.L); add(cs, 'felület m²', m.A, i.A); add(cs, 'térfogat m³', m.V, i.V);
    osszM = { L: osszM.L + m.L, A: osszM.A + m.A, V: osszM.V + m.V }; osszI = { L: osszI.L + i.L, A: osszI.A + i.A, V: osszI.V + i.V };
  }
  add('falak összesen', 'hossz m', osszM.L, osszI.L); add('falak összesen', 'felület m²', osszM.A, osszI.A); add('falak összesen', 'térfogat m³', osszM.V, osszI.V);

  // nyílászárók (a modellben a fal nyílásai: ablak / ajtó a fajta szerint)
  const mAjto = (n: ModellNyilas) => /ajto|kapu/.test(n.fajta);
  for (const [nev, mN, iN] of [['ablak', md.nyilasok.filter((n) => !mAjto(n)), iq.filter((x) => x.q.kategoria === 'ablak')], ['ajtó', md.nyilasok.filter(mAjto), iq.filter((x) => x.q.kategoria === 'ajto')]] as const) {
    add(nev, 'db', mN.length, iN.length);
    add(nev, 'felület m²', mN.reduce((s, n) => s + n.szel * n.mag, 0), iN.reduce((s, x) => s + (x.q.Abrutto?.v ?? 0), 0));
  }
  // terek
  const iTer = iq.filter((x) => x.q.kategoria === 'ter');
  add('helyiségek', 'db', md.terek.length, iTer.length);
  add('helyiségek', 'nettó alapterület m²', md.terek.reduce((s, t) => s + t.A, 0), iTer.reduce((s, x) => s + (x.q.Anetto?.v ?? x.q.Abrutto?.v ?? 0), 0));
  // szintenként: a helyiségek alapterülete
  for (const sz of md.szintek) {
    const iSz = ifc.szintek.find((s) => Math.abs(s.z - sz.z0) < 0.6);
    if (!iSz) continue;
    add(`${sz.nev} ↔ ${iSz.nev}`, 'helyiségek m²', md.terek.filter((t) => t.szint === sz.id).reduce((s, t) => s + t.A, 0), iTer.filter((x) => x.e.szint === iSz.id).reduce((s, x) => s + (x.q.Anetto?.v ?? x.q.Abrutto?.v ?? 0), 0));
  }
  return sorok;
}
