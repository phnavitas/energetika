/**
 * A hőhíd-modul kapcsolata a projekttel: paraméterek a projekt rétegrendjeiből és nyílászáróiból, ajánlott csomópontok,
 * javasolt hosszak, és a számítás (Ψ: Rsi = 0,13; felületi hőmérséklet: Rsi = 0,25 m²K/W, MSZ EN ISO 13788).
 */
import type { Projekt, HohidUI, Retegrend } from '../modell';
import { retegrendSzamitas, ujId } from '../modell';
import { megold, type Megoldas } from './szamito';
import { HOHID_SABLONOK, sablon, alapParameterek, type HohidSablon, type Csomopont } from './katalogus';

const SZIG_LAMBDA = 0.06;

function falReszek(r: Retegrend) {
  const e = retegrendSzamitas(r);
  const l = r.retegek.map((x, i) => ({ d: x.dCm / 100, R: e.retegR[i] ?? 0 })).filter((x) => x.d > 0);
  const lam = (x: { d: number; R: number }) => (x.R > 0 ? x.d / x.R : 1);
  const szig = l.filter((x) => lam(x) <= SZIG_LAMBDA);
  const nem = l.filter((x) => lam(x) > SZIG_LAMBDA);
  const fo = [...nem].sort((a, b) => b.d - a.d)[0];
  const foIdx = fo ? l.indexOf(fo) : -1;
  const belso = l.slice(0, Math.max(0, foIdx)).filter((x) => lam(x) > SZIG_LAMBDA);
  const sum = (a: typeof l) => a.reduce((s, x) => s + x.d, 0), Rsum = (a: typeof l) => a.reduce((s, x) => s + x.R, 0);
  return {
    di: sum(szig), lamI: sum(szig) > 0 ? sum(szig) / Rsum(szig) : 0.039,
    dw: fo?.d ?? 0.3, lamW: fo ? lam(fo) : 0.5,
    dv: sum(belso), Rv: Rsum(belso),
  };
}

/** A csomópont paraméterei a projekt külső fal / padlásfödém rétegrendjéből és az első ablaktípusból. */
export function projektParameterek(p: Projekt, s: HohidSablon): { param: Record<string, number>; forras: string[] } {
  const param = alapParameterek(s); const forras: string[] = [];
  const fal = p.retegrendek.find((r) => r.szerep === 'fal' && r.kulsoOldal === 'kulso');
  if (fal) {
    try {
      const f = falReszek(fal);
      Object.assign(param, { di: round(f.di), lamI: round(f.lamI, 4), dw: round(f.dw), lamW: round(f.lamW, 4), dv: round(Math.min(f.dv, 0.05)) });
      forras.push(`külső fal: ${fal.nev}`);
    } catch { /* hiányos rétegrend */ }
  }
  if (s.kod === 'padlasfodem_fal') {
    const fd = p.retegrendek.find((r) => r.szerep === 'padlas');
    if (fd) {
      try {
        const e = retegrendSzamitas(fd);
        const l = fd.retegek.map((x, i) => ({ d: x.dCm / 100, R: e.retegR[i] ?? 0 })).filter((x) => x.d > 0.005);
        const szig = l.filter((x) => x.R > 0 && x.d / x.R <= SZIG_LAMBDA), tarto = l.filter((x) => !(x.R > 0 && x.d / x.R <= SZIG_LAMBDA));
        const dA = szig.reduce((s2, x) => s2 + x.d, 0), RA = szig.reduce((s2, x) => s2 + x.R, 0);
        const dF = tarto.reduce((s2, x) => s2 + x.d, 0), RF = tarto.reduce((s2, x) => s2 + x.R, 0);
        if (dA > 0) Object.assign(param, { dA: round(dA), lamA: round(dA / RA, 4) });
        if (dF > 0) Object.assign(param, { dF: round(Math.max(dF, 0.01)), lamF: round(RF > 0 ? dF / RF : 2.3, 4) });
        forras.push(`padlásfödém: ${fd.nev}`);
      } catch { /* hiányos */ }
    }
  }
  if (s.kod === 'ablak_kava') {
    const n = p.nyilaszarok.find((x) => x.komponens);
    if (n?.komponens) { Object.assign(param, { Uf: n.komponens.Uk, Ug: n.komponens.Ug, bf: round(n.komponens.keretMm / 1000) }); forras.push(`nyílászáró: ${n.nev}`); }
  }
  return { param, forras };
}
const round = (x: number, n = 3) => Math.round(x * 10 ** n) / 10 ** n;

/** Javasolt hossz a projekt geometriájából (m); null: nem becsülhető. */
export function javasoltHossz(p: Projekt, s: HohidSablon): { hossz: number; leiras: string } | null {
  const h = p.helyisegek.length ? p.helyisegek.reduce((a, x) => a + x.h * x.A, 0) / Math.max(1e-9, p.helyisegek.reduce((a, x) => a + x.A, 0)) : 2.7;
  const szint = Math.max(1, p.meta.szintek || 1);
  if (s.kod === 'padlasfodem_fal') {
    const P = p.feluletek.filter((f) => f.fajta === 'opak' && f.hatar === 'kulso' && p.retegrendek.find((r) => r.id === f.retegrendId)?.szerep === 'fal').reduce((a, f) => a + (f.meret?.hossz ?? (f.A ?? 0) / h), 0);
    return P > 0 ? { hossz: round(P, 2), leiras: 'a homlokzati falak hosszának összege' } : null;
  }
  if (s.kod === 'ablak_kava') {
    let L = 0;
    for (const f of p.feluletek) { if (f.fajta !== 'nyilaszaro' || f.hatar !== 'kulso') continue; const n = p.nyilaszarok.find((x) => x.id === f.nyilaszaroId); if (n) L += 2 * (n.szelesseg + n.magassag) * (f.darab ?? 1); }
    return L > 0 ? { hossz: round(L, 2), leiras: 'a külső nyílászárók kerületének összege' } : null;
  }
  if (s.kod === 'kulso_sarok') {
    const ir = new Set(p.feluletek.filter((f) => f.fajta === 'opak' && f.hatar === 'kulso' && f.tajolas).map((f) => f.tajolas)).size;
    const sarok = Math.max(4, ir);
    return { hossz: round(sarok * h * szint, 2), leiras: `${sarok} sarok × ${round(h, 2)} m belmagasság${szint > 1 ? ` × ${szint} szint` : ''}` };
  }
  return null;
}

/** Ajánlott csomópontok a projekt szerkezetei alapján. */
export function ajanlott(p: Projekt): Set<string> {
  const a = new Set<string>(['kulso_sarok']);
  if (p.retegrendek.some((r) => r.szerep === 'padlas')) a.add('padlasfodem_fal');
  if (p.feluletek.some((f) => f.fajta === 'nyilaszaro')) a.add('ablak_kava');
  if (p.retegrendek.some((r) => r.szerep === 'belso')) a.add('t_csatlakozas');
  return a;
}

export interface HohidSzamitas { csomopont: Csomopont; m: Megoldas; mf: Megoldas; eredmeny: NonNullable<HohidUI['eredmeny']> }

export function hohidSzamol(h: HohidUI, felbontas = 0.01): HohidSzamitas | null {
  const s = sablon(h.sablon); if (!s) return null;
  const c = s.epit({ ...alapParameterek(s), ...h.param });
  const m = megold(c.geometria, { thetaI: h.thetaI, thetaE: h.thetaE, Rsi: 0.13, Rse: 0.04 }, felbontas);
  const mf = megold(c.geometria, { thetaI: h.thetaI, thetaE: h.thetaE, Rsi: 0.25, Rse: 0.04 }, felbontas);
  const psiE = m.L2D - c.karimak.reduce((a, k) => a + k.U * k.lKulso, 0);
  const psiI = m.L2D - c.karimak.reduce((a, k) => a + k.U * k.lBelso, 0);
  return { csomopont: c, m, mf, eredmeny: { L2D: m.L2D, psiE, psiI, thetaSiMin: mf.thetaSiMin, fRsi: (mf.thetaSiMin - h.thetaE) / (h.thetaI - h.thetaE), karimak: c.karimak } };
}

export function ujHohid(p: Projekt, kod: string): HohidUI {
  const s = sablon(kod)!;
  const { param } = projektParameterek(p, s);
  const jh = javasoltHossz(p, s);
  return { id: ujId(), nev: s.nev, sablon: kod, param, thetaI: 20, thetaE: -13, hossz: jh?.hossz ?? 0, meretrendszer: 'belso', szamit: true, hatar: 'kulso' };
}

export { HOHID_SABLONOK };
