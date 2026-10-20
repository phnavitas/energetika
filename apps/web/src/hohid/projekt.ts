/**
 * A hőhíd-modul kapcsolata a projekttel: paraméterek a projekt rétegrendjeiből és nyílászáróiból, ajánlott csomópontok,
 * javasolt hosszak, és a számítás (Ψ: Rsi = 0,13; felületi hőmérséklet: Rsi = 0,25 m²K/W, MSZ EN ISO 13788).
 */
import type { Projekt, HohidUI, Retegrend } from '../modell';
import { retegrendSzamitas, ujId, padloKerulet } from '../modell';
import { megold, type Megoldas, type Geometria, type Peremfeltetel } from './szamito';
import SzamitoWorker from './szamito.worker?worker&inline';
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
  if (s.csoport === 'labazat') {
    const pf = p.feluletek.find((f) => f.fajta === 'padlo' && f.padlo);
    const pr = pf && p.retegrendek.find((r) => r.id === pf.retegrendId);
    if (pr) {
      try {
        const e = retegrendSzamitas(pr);
        const l = pr.retegek.map((x, i) => ({ d: x.dCm / 100, R: e.retegR[i] ?? 0 })).filter((x) => x.d > 0.003);
        const sz = (x: { d: number; R: number }) => x.R > 0 && x.d / x.R <= SZIG_LAMBDA;
        const i0 = l.findIndex(sz); let i1 = i0; while (i1 + 1 < l.length && sz(l[i1 + 1]!)) i1++;
        const felso = i0 >= 0 ? l.slice(0, i0) : [], szig = i0 >= 0 ? l.slice(i0, i1 + 1) : [], also = i0 >= 0 ? l.slice(i1 + 1).filter((x) => !sz(x)) : l;
        const ds = (a: typeof l) => a.reduce((q, x) => q + x.d, 0), Rs = (a: typeof l) => a.reduce((q, x) => q + x.R, 0);
        if (ds(felso) > 0) Object.assign(param, { dE: round(ds(felso)), lamE: round(ds(felso) / Math.max(1e-6, Rs(felso)), 3) });
        Object.assign(param, { dP: round(ds(szig)), ...(ds(szig) > 0 ? { lamP: round(ds(szig) / Rs(szig), 4) } : {}) });
        if (ds(also) > 0) { const k = s.kod === 'labazat_lemez' ? 'S' : 'A'; Object.assign(param, { [`d${k}`]: round(ds(also)), [`lam${k}`]: round(ds(also) / Math.max(1e-6, Rs(also)), 3) }); }
        forras.push(`padló: ${pr.nev}`);
      } catch { /* hiányos */ }
    }
    const pe = pf?.padlo?.perem;
    if (pe && pe.dCm > 0) { Object.assign(param, { dl: round(pe.dCm / 100), lamL: round(pe.dCm / 100 / Math.max(1e-6, pe.R), 4), ...(pe.irany === 'fuggoleges' ? { D: round(pe.D, 2) } : {}) }); }
    if (pf?.A && pf.padlo) { const P = padloKerulet(p, pf); if (P > 0) param.B = round(Math.min(40, Math.max(2, pf.A / (0.5 * P))), 1); }
  }
  if (s.kod === 'lapos_teto_attika') {
    const tr = p.retegrendek.find((r) => r.szerep === 'teto');
    if (tr) {
      try {
        const e = retegrendSzamitas(tr);
        const l = tr.retegek.map((x, i) => ({ d: x.dCm / 100, R: e.retegR[i] ?? 0 })).filter((x) => x.d > 0.005);
        const szig = l.filter((x) => x.R > 0 && x.d / x.R <= SZIG_LAMBDA), tarto = l.filter((x) => !(x.R > 0 && x.d / x.R <= SZIG_LAMBDA)).sort((a, b) => b.d - a.d)[0];
        const d = szig.reduce((q, x) => q + x.d, 0), R = szig.reduce((q, x) => q + x.R, 0);
        if (d > 0) Object.assign(param, { dR: round(d), lamR: round(d / R, 4) });
        if (tarto) Object.assign(param, { dF: round(tarto.d), lamF: round(tarto.R > 0 ? tarto.d / tarto.R : 2.3, 3) });
        forras.push(`lapostető: ${tr.nev}`);
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
  if (s.csoport === 'labazat') {
    const P = p.feluletek.filter((f) => f.fajta === 'padlo' && f.padlo).reduce((a, f) => a + padloKerulet(p, f), 0);
    return P > 0 ? { hossz: round(P, 2), leiras: 'a talajon fekvő padló kerülete' } : null;
  }
  if (s.kod === 'lapos_teto_attika') {
    const P = p.feluletek.filter((f) => f.fajta === 'opak' && f.hatar === 'kulso' && p.retegrendek.find((r) => r.id === f.retegrendId)?.szerep === 'fal').reduce((a, f) => a + (f.meret?.hossz ?? (f.A ?? 0) / h), 0) / szint;
    return P > 0 ? { hossz: round(P, 2), leiras: 'a homlokzati falak hossza egy szintre' } : null;
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
  if (p.feluletek.some((f) => f.fajta === 'padlo')) { a.add('labazat_lemez'); a.add('labazat_savalap'); }
  if (p.retegrendek.some((r) => r.szerep === 'teto')) a.add('lapos_teto_attika');
  return a;
}

export interface HohidSzamitas { csomopont: Csomopont; m: Megoldas; mf: Megoldas; eredmeny: NonNullable<HohidUI['eredmeny']> }

const PF = (h: HohidUI): Peremfeltetel[] => [{ thetaI: h.thetaI, thetaE: h.thetaE, Rsi: 0.13, Rse: 0.04 }, { thetaI: h.thetaI, thetaE: h.thetaE, Rsi: 0.25, Rse: 0.04 }];
function elokeszit(h: HohidUI, felbontas: number) {
  const s = sablon(h.sablon); if (!s) return null;
  const c = s.epit({ ...alapParameterek(s), ...h.param });
  // talajos modell: a finom zónán kívül fokozatosan durvuló rács; 2 cm-es finom rács elég (az 1 cm-essel 0,001 W/mK-en belül egyezik)
  return { c, cel: c.geometria.finom ? Math.max(felbontas, 0.02) : felbontas };
}
function osszerak(h: HohidUI, c: Csomopont, m: Megoldas, mf: Megoldas): HohidSzamitas {
  const psiE = m.L2D - c.karimak.reduce((a, k) => a + k.U * k.lKulso, 0);
  const psiI = m.L2D - c.karimak.reduce((a, k) => a + k.U * k.lBelso, 0);
  return { csomopont: c, m, mf, eredmeny: { L2D: m.L2D, psiE, psiI, thetaSiMin: mf.thetaSiMin, fRsi: (mf.thetaSiMin - h.thetaE) / (h.thetaI - h.thetaE), karimak: c.karimak } };
}

export function hohidSzamol(h: HohidUI, felbontas = 0.01): HohidSzamitas | null {
  const e = elokeszit(h, felbontas); if (!e) return null;
  const [pf, pff] = PF(h);
  return osszerak(h, e.c, megold(e.c.geometria, pf!, e.cel), megold(e.c.geometria, pff!, e.cel));
}

let worker: Worker | null = null, workerHibas = false, sorszam = 0;
const varo = new Map<number, (v: { ms?: Megoldas[]; hiba?: string; tartalek?: boolean }) => void>();
function munkas(): Worker | null {
  if (workerHibas) return null;
  if (worker) return worker;
  try {
    worker = new SzamitoWorker();
    worker.onmessage = (e: MessageEvent<{ id: number; ms?: Megoldas[]; hiba?: string }>) => { const f = varo.get(e.data.id); varo.delete(e.data.id); f?.(e.data); };
    // pl. a beágyazó oldal tartalombiztonsági szabálya tiltja a workert: szinkron tartalék
    worker.onerror = () => { workerHibas = true; worker?.terminate(); worker = null; for (const [id, f] of varo) { varo.delete(id); f({ tartalek: true }); } };
    return worker;
  } catch { workerHibas = true; return null; }
}
/** A számítás háttérszálon (Web Worker), hogy a felület ne akadjon meg; ha nincs worker, szinkron. */
export async function hohidSzamolHatter(h: HohidUI, felbontas = 0.01): Promise<HohidSzamitas | null> {
  const e = elokeszit(h, felbontas); if (!e) return null;
  const w = munkas();
  if (!w) return hohidSzamol(h, felbontas);
  const id = ++sorszam;
  const v = await new Promise<{ ms?: Megoldas[]; hiba?: string; tartalek?: boolean }>((ok) => { varo.set(id, ok); w.postMessage({ id, g: e.c.geometria as Geometria, pfs: PF(h), cel: e.cel }); });
  if (v.tartalek) return hohidSzamol(h, felbontas);
  if (!v.ms) throw new Error(v.hiba ?? 'hőhíd-számítási hiba');
  return osszerak(h, e.c, v.ms[0]!, v.ms[1]!);
}

export function ujHohid(p: Projekt, kod: string): HohidUI {
  const s = sablon(kod)!;
  const { param } = projektParameterek(p, s);
  const jh = javasoltHossz(p, s);
  const padloId = s.csoport === 'labazat' ? p.feluletek.find((f) => f.fajta === 'padlo' && !(p.hohidak ?? []).some((x) => x.padloId === f.id))?.id : undefined;
  return { id: ujId(), nev: s.nev, sablon: kod, param, thetaI: 20, thetaE: -13, hossz: jh?.hossz ?? 0, meretrendszer: 'belso', szamit: true, hatar: 'kulso', ...(padloId ? { padloId } : {}) };
}

export { HOHID_SABLONOK };
