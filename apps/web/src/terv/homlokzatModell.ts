/**
 * Alaprajz + homlokzat összevetése: a homlokzati nézet (fal-réteg sziluettje) az alaprajz homlokzati falaihoz illesztve
 * (vízszintesen a nyílászárók szélessége és egymáshoz viszonyított helyzete, függőlegesen a nyílások mellvédje szerint),
 * és ebből a falszakasz tényleges magassága a szint padlója és mennyezete között – oromfalnál, térdfalnál, eltérő
 * párkánymagasságnál is a rajz szerint.
 */
import type { TervNyilas } from './nyilaszarok';
import type { HomlokzatKeret } from './homlokzat';
import type { NezetOszlopok } from './homlokzatProfil';

/** Egy homlokzati nézet: a fal-sziluett oszlopai, a benne felismert nyílászárókeretek, a lépték és (ha a címből ismert) az égtáj. */
export interface HomlokzatNezetAdat { ny: NezetOszlopok; keretek: HomlokzatKeret[]; mPerPt: number; az?: number; /** A homlokzati lap sorszáma (az azonos lapon lévő nézetek függőleges alapja közös módon adódik). */ lap?: number }

const SZT = 0.12;
const szogKul = (a: number, b: number) => { const d = Math.abs((((a - b) % 360) + 360) % 360); return Math.min(d, 360 - d); };

interface Illesztes { v: HomlokzatNezetAdat; o: number; y0: number; tam: number; /** A függőleges alap legalább 3 nyílás mellvédjéből (nem a sziluett aljából). */ biztos?: boolean }

export interface FalMagassagModell {
  /** Az illesztett homlokzatok (alaprajzi irány → illesztés) száma. */
  db: number;
  /** Az illesztések szövegesen (ellenőrzéshez). */
  leiras: string[];
  /**
   * A homlokzaton látszó, az alaprajzon nem jelölt nyílások (a nézet illesztett kereteiből, amelyekhez az alaprajzon nincs
   * nyílás): szint sávjába eső keretek, a falszakasz alapján a helyiséghez rendelve. `falak` elemei: irány, pontok és a
   * helyiség (tetszőleges) azonosítója.
   */
  pluszNyilasok<T>(falak: { irany: number; pontok: [number, number][]; h: T }[], zf: number, zc: number): { h: T; irany: number; szel: number; mag: number; pm: number }[];
  /** A falszakasz átlagos magassága (m) a [zf, zc] szintsávban, ha a homlokzaton (≥ 60 %-ban) látszik; különben null. */
  magassag(irany: number, pontok: [number, number][], zf: number, zc: number): number | null;
}

/**
 * `nyilasok`: az alaprajz nyílásai (a feliratos, mellvédes nyílások rögzítik a függőleges helyzetet), `mPerPt` az
 * alaprajz léptéke, `zf` a lap padlószintje (m, ±0,00-hoz), `nezetek` a homlokzati rajzok nézetei.
 */
export function falMagassagModell(nyilasok: TervNyilas[], mPerPt: number, eszakSzog: number, nezetek: HomlokzatNezetAdat[], zf: number, falak: { irany: number; pontok: [number, number][] }[] = [],
  /** Az épület teljes alaprajzi kiterjedése (m) a homlokzat irányában (az összes fal vetülete): ablak nélküli homlokzat illesztéséhez. */
  kiterjedes?: (irany: number) => [number, number] | null): FalMagassagModell {
  const kulso = nyilasok.filter((n) => n.kulso && n.irany !== null && n.fajta !== 'falfulke' && n.szel > 0.3);
  const s = (t: number, x: number, y: number) => { const r = t * Math.PI / 180; return (-Math.cos(r) * x - Math.sin(r) * y) * mPerPt; };
  const iranyok = [...new Set(kulso.map((n) => n.irany!))];
  // minden (nézet, alaprajzi irány) párra a legjobb illesztés: a keretek szélessége és egymáshoz viszonyított helyzete
  // (a nézet címe – égtája – csak egyenlő egyezésnél dönt: a címek elírása, hiánya nem akadály)
  const jeloltek: Illesztes[] = [];
  for (const ir of iranyok) {
    const sajat = kulso.filter((n) => n.irany === ir);
    for (const v of nezetek) {
      const e = (k: HomlokzatKeret) => (k.x0 + k.x1) / 2 * v.mPerPt;
      let leg: Illesztes | null = null;
      for (const n of sajat) for (const k of v.keretek) {
        if (Math.abs(k.szel - n.szel) > SZT) continue;
        const c = e(k) - s(ir, n.x, n.y);
        const parok: { n: TervNyilas; k: HomlokzatKeret }[] = [];
        for (const m of sajat) { const q = v.keretek.find((q) => Math.abs(q.szel - m.szel) <= SZT && Math.abs(e(q) - s(ir, m.x, m.y) - c) <= 0.25); if (q) parok.push({ n: m, k: q }); }
        const cimJo = v.az === undefined || szogKul(ir - eszakSzog, v.az) <= 60;
        if (parok.length < 2) continue;
        // függőleges helyzet: a keret alja = padló + mellvéd (ajtó: 0). Többszintes homlokzaton minden szint kerete jelölt:
        // a párok szerinti lehetséges ±0,00-szintek közül az, amelyikkel a legtöbb nyílás egyezik, egyenlőség esetén a fal
        // sziluettjének aljához (a terephez) legközelebbi
        const jel: number[][] = parok.map(({ n: m }) => { const pm = m.pm ?? (m.mag >= 1.9 ? 0 : null); if (pm === null) return []; return v.keretek.filter((q) => Math.abs(q.szel - m.szel) <= SZT && Math.abs(e(q) - s(ir, m.x, m.y) - c) <= 0.25).map((q) => q.y1 + (zf + pm) / v.mPerPt); });
        let alja = -Infinity; for (let q = 0; q < v.ny.alja.length; q++) { const a = v.ny.alja[q]!; if (!Number.isNaN(a) && a > alja) alja = a; }
        // mellvéd nélküli (mért, felirat nélküli) nyílásoknál a függőleges alap a fal-sziluett alja (≈ terep / ±0,00)
        const mellvedbol = jel.flat().length > 0;
        const minden = jel.flat(); if (!minden.length && parok.length >= 3) minden.push(alja), jel.length = 0, jel.push([alja], [alja]);
        if (!minden.length) continue;
        let y0 = minden[0]!, egyezo = 0, tav = Infinity;
        for (const y of minden) {
          const db = jel.filter((l) => l.some((z) => Math.abs(z - y) * v.mPerPt <= 0.3)).length;
          const d = Math.abs(y - alja) * v.mPerPt;
          if (db > egyezo || (db === egyezo && d < tav)) { egyezo = db; y0 = y; tav = d; }
        }
        if (egyezo < 2) continue;
        // a homlokzat az irány falait lefedi-e (a falak oszlopaiban van fal-sziluett)
        const fl = falak.filter((f) => f.irany === ir);
        let L = 0, Lf = 0;
        for (const f of fl) {
          const ss = f.pontok.map(([x, y]) => s(ir, x, y)); if (!ss.length) continue;
          const xa = (Math.min(...ss) + c) / v.mPerPt, xb = (Math.max(...ss) + c) / v.mPerPt;
          const ca = Math.floor((xa - v.ny.x0) / v.ny.dx), cb = Math.ceil((xb - v.ny.x0) / v.ny.dx);
          for (let q = ca; q <= cb; q++) { L++; if (q >= 0 && q < v.ny.teto.length && !Number.isNaN(v.ny.teto[q]!)) Lf++; }
        }
        const fed = L ? Lf / L : 1;
        if (fed < 0.7) continue;
        const tam = egyezo + 3 * fed + (cimJo ? 0.5 : 0);
        if (leg && tam <= leg.tam) continue;
        leg = { v, o: c, y0, tam, biztos: mellvedbol && egyezo >= 3 };
      }
      if (leg) jeloltek.push({ ...leg, ...{ ir } } as Illesztes & { ir: number });
    }
  }
  // mohó hozzárendelés: egy nézet egy irányhoz, egy irány egy nézethez (a legtöbb egyezés előbb)
  const ill = new Map<number, Illesztes>(); const foglalt = new Set<HomlokzatNezetAdat>();
  for (const j of (jeloltek as (Illesztes & { ir: number })[]).sort((a2, b2) => b2.tam - a2.tam)) {
    if (ill.has(j.ir) || foglalt.has(j.v)) continue;
    ill.set(j.ir, j); foglalt.add(j.v);
  }
  // ablak nélküli (vagy kevés ablakos) homlokzat: a nézet fal-sziluettjének szélessége az épület alaprajzi kiterjedésével
  // egyezik (± 5 %, ± 0,5 m), az égtáj a nézet címe szerint stimmel; a függőleges alap a lap már illesztett nézeteiből
  // (a ±0,00 és a fal-sziluett alja közti különbség), ennek híján a sziluett alja
  if (kiterjedes) {
    const szel = (v: HomlokzatNezetAdat): [number, number, number] | null => {
      let a = -1, b = -1, alja = -Infinity;
      for (let q = 0; q < v.ny.teto.length; q++) if (!Number.isNaN(v.ny.teto[q]!)) { if (a < 0) a = q; b = q; alja = Math.max(alja, v.ny.alja[q]!); }
      return a < 0 ? null : [(v.ny.x0 + a * v.ny.dx) * v.mPerPt, (v.ny.x0 + (b + 1) * v.ny.dx) * v.mPerPt, alja];
    };
    const iranyokF = [...new Set(falak.map((f) => f.irany))].filter((ir) => !ill.has(ir));
    for (const ir of iranyokF) {
      const k = kiterjedes(ir); if (!k) continue; const W = k[1] - k[0];
      let leg: { v: HomlokzatNezetAdat; o: number; y0: number; d: number } | null = null;
      for (const v of nezetek) {
        if (foglalt.has(v) || v.az === undefined || szogKul(ir - eszakSzog, v.az) > 30) continue;
        const sz = szel(v); if (!sz) continue; const w = sz[1] - sz[0];
        const d = Math.abs(w - W); if (d > Math.max(0.5, 0.05 * W)) continue;
        // a lap illesztett nézeteiből a ±0,00 és a sziluett alja közti különbség
        const tars = [...ill.values()].filter((x) => x.v.lap !== undefined && x.v.lap === v.lap).map((x) => { const s2 = szel(x.v); return s2 ? x.y0 - s2[2] : null; }).filter((x): x is number => x !== null);
        const y0 = sz[2] + (tars.length ? tars.sort((a2, b2) => a2 - b2)[Math.floor(tars.length / 2)]! : 0);
        if (!leg || d < leg.d) leg = { v, o: sz[0] - k[0], y0, d };
      }
      if (leg) { ill.set(ir, { v: leg.v, o: leg.o, y0: leg.y0, tam: 0 }); foglalt.add(leg.v); }
    }
  }
  return {
    db: ill.size,
    leiras: [...ill.entries()].map(([ir, v]) => `${ir}→${v.v.az ?? '?'}@${Math.round(v.v.ny.bb[0])},${Math.round(v.v.ny.bb[1])} tám ${v.tam.toFixed(1)}`),
    pluszNyilasok(fl, zf0, zc) {
      const ki: { h: (typeof fl)[number]['h']; irany: number; szel: number; mag: number; pm: number }[] = [];
      for (const [ir, il] of ill) {
        // csak biztos illesztésnél: legalább 3 nyílás mellvédje egyezik (a kiterjedés vagy a sziluett alja szerinti illesztés
        // függőlegesen / vízszintesen pontatlanabb – téves többletnyílás)
        const mE = il.v.mPerPt; const sajat = kulso.filter((n) => n.irany === ir);
        const fi = fl.filter((f) => f.irany === ir).map((f) => { const ss = f.pontok.map(([x, y]) => s(ir, x, y)); return { f, a: Math.min(...ss), b: Math.max(...ss) }; });
        for (const q of il.v.keretek) {
          const za = (il.y0 - q.y1) * mE, zt = (il.y0 - q.y0) * mE;
          if (za < zf0 - 0.15 || za > zc - 0.3 || zt > zc + 0.4) continue;
          const sc = (q.x0 + q.x1) / 2 * mE - il.o;
          // (a keret közepe egy alaprajzi nyílás szélességén belül: annak osztása – pl. függönyfal, ajtó oldalvilágítója)
          if (sajat.some((n) => Math.abs(s(ir, n.x, n.y) - sc) <= Math.max(0.3, q.szel / 2, n.szel / 2 + 0.1))) continue;
          // azonos szélességű alaprajzi nyílás a közelben (más irányú falszakaszon – beugrás, ferde fal, eltérő falsík): már megvan
          if (nyilasok.some((n) => n.kulso && Math.abs(n.szel - q.szel) <= 0.1 && Math.abs(s(ir, n.x, n.y) - sc) <= Math.max(0.6, q.szel))) continue;
          const f = fi.find((x) => sc >= x.a - 0.1 && sc <= x.b + 0.1); if (!f) continue;
          ki.push({ h: f.f.h, irany: ir, szel: q.szel, mag: q.mag, pm: Math.max(0, Math.round((za - zf0) * 100) / 100) });
        }
      }
      return ki;
    },
    magassag(irany, pontok, zf0, zc) {
      let il = ill.get(irany);
      if (!il) { let d = 11; for (const [ir, v] of ill) { const dd = szogKul(ir, irany); if (dd < d) { d = dd; il = v; } } }
      if (!il || !pontok.length) return null;
      const ss = pontok.map(([x, y]) => s(irany, x, y)); const s0 = Math.min(...ss), s1 = Math.max(...ss);
      const ny = il.v.ny; const mE = il.v.mPerPt; const xa = (s0 + il.o) / mE, xb = (s1 + il.o) / mE;
      const ca = Math.max(0, Math.floor((xa - ny.x0) / ny.dx)), cb = Math.min(ny.teto.length - 1, Math.ceil((xb - ny.x0) / ny.dx));
      const ossz = Math.max(1, Math.ceil((xb - xa) / ny.dx));
      let db = 0, sum = 0;
      for (let c = ca; c <= cb; c++) {
        const t = ny.teto[c]!, a = ny.alja[c]!; if (Number.isNaN(t)) continue;
        const zt = (il.y0 - t) * mE, za = (il.y0 - a) * mE;
        // a fal alja a lábazatnál (külön rétegen) rajzolódhat: a szint padlójáig számítjuk, ha 0,8 m-en belül van
        const also = za <= zf0 + 0.8 ? zf0 : za;
        sum += Math.max(0, Math.min(zt, zc) - also); db++;
      }
      return db >= 0.6 * ossz ? Math.round((sum / db) * 100) / 100 : null;
    },
  };
}
