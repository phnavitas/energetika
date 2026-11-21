/**
 * Méretfelirat nélküli (alaprajzon mért szélességű) nyílások magassága a homlokzatról: a homlokzati rajz
 * nyílászárókereteit a homlokzat címe szerinti égtájon az alaprajz azonos irányú homlokzatának nyílásaihoz illesztjük
 * (egy vízszintes eltolás, amelynél a legtöbb szélesség és helyzet egyezik), és a mért nyílás helyén álló keret
 * magasságát vesszük. Több szint keretei egymás felett: a szint sorszáma szerint alulról.
 */
import type { Lap } from './kinyeres';
import type { TervNyilas } from './nyilaszarok';
import { homlokzatCimek, keretek, vonalIndex, type HomlokzatKeret } from './homlokzat';
import { nezetLyukak } from './homlokzatProfil';

/** Szélességtűrés az illesztésnél: az alaprajzi falnyílás és a homlokzati tok mérete eltérhet (tokbeépítés, takarás). */
const SZT = 0.2;
const AZ: Record<string, number> = { 'É': 0, 'ÉK': 45, 'K': 90, 'DK': 135, 'D': 180, 'DNy': 225, 'Ny': 270, 'ÉNy': 315 };
const szogKul = (a: number, b: number) => { const d = Math.abs((((a - b) % 360) + 540) % 360 - 180); return d; };

export interface HomlokzatRajz { az: number; mPerPt: number; keretek: HomlokzatKeret[] }

/** Egy homlokzati lap rajzai (címenként) a kereteikkel. */
export function homlokzatRajzok(lap: Lap, tartalekM?: number): HomlokzatRajz[] {
  const ix = vonalIndex(lap, tartalekM); if (!ix) return [];
  const cimek = homlokzatCimek(lap).map((c) => ({ x: c.x, y: c.y, az: AZ[c.t]! }));
  if (!cimek.length) return [];
  // a rajzcím a rajz alatt vagy fölött áll (lapon belül egységesen): mindkét elrendezéssel hozzárendeljük a kereteket
  // a legközelebbi címhez, és az a változat érvényes, amelyben a keretek összesen közelebb esnek a címükhöz
  // a vonalas keretek mellé a falkitöltés téglalap alakú lyukai (kitöltéssel rajzolt homlokzat), ha nem fedik egymást
  const kk0 = keretek(ix);
  const fed = (a: HomlokzatKeret, b: HomlokzatKeret) => { const ix0 = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)), iy0 = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0)); return ix0 * iy0 > 0.3 * Math.min((a.x1 - a.x0) * (a.y1 - a.y0), (b.x1 - b.x0) * (b.y1 - b.y0)); };
  const kk = [...kk0, ...nezetLyukak(lap, ix.mPerPt).filter((l) => !kk0.some((k) => fed(k, l)))];
  const rendel = (alatta: boolean) => {
    const ki = cimek.map((c) => ({ az: c.az, mPerPt: ix.mPerPt, keretek: [] as HomlokzatKeret[] }));
    let ossz = 0;
    for (const k of kk) {
      let leg = -1, pont = Infinity;
      cimek.forEach((c, i) => { const dy = alatta ? c.y - k.y1 : k.y0 - c.y; if (dy < 0) return; const p = dy + 0.5 * Math.abs(c.x - (k.x0 + k.x1) / 2); if (p < pont) { pont = p; leg = i; } });
      if (leg >= 0) { ki[leg]!.keretek.push(k); ossz += pont; } else ossz += 1e4;
    }
    return { ki, ossz };
  };
  const a = rendel(true), f = rendel(false);
  return (f.ossz < a.ossz ? f : a).ki.filter((r) => r.keretek.length);
}

/**
 * Egy homlokzati rajz illesztése az alaprajzhoz a nyílások szerint: a ±60°-on belüli lapirányok közül az, amelynél egy
 * vízszintes eltolással (o: homlokzati x, m = s(nyílás) + o) a legtöbb nyílás szélessége és helyzete egyezik a keretekkel
 * (legalább kettő). `kulso`: az alaprajz külső nyílásai (lapkoordináta).
 */
export function homlokzatEltolas(rz: HomlokzatRajz, kulso: TervNyilas[], mPerPt: number, eszakSzog: number): { ir: number; o: number; tam: number } | null {
  const s = (n: TervNyilas) => { const t = n.irany! * Math.PI / 180; return (-Math.cos(t) * n.x - Math.sin(t) * n.y) * mPerPt; };
  const e = (k: HomlokzatKeret) => (k.x0 + k.x1) / 2 * rz.mPerPt;
  let leg: { ir: number; o: number; tam: number } | null = null;
  for (const ir of [0, 90, 180, 270]) {
    if (szogKul(ir - eszakSzog, rz.az) > 60) continue;
    const sajat = kulso.filter((n) => n.kulso && n.irany === ir && n.fajta !== 'falfulke');
    for (const n of sajat) for (const k of rz.keretek) {
      if (Math.abs(k.szel - n.szel) > SZT) continue;
      const c = e(k) - s(n);
      const t = sajat.filter((m) => rz.keretek.some((q) => Math.abs(q.szel - m.szel) <= SZT && Math.abs(e(q) - s(m) - c) <= 0.25)).length;
      if (!leg || t > leg.tam) leg = { ir, o: c, tam: t };
    }
  }
  return leg && leg.tam >= 2 ? leg : null;
}

/**
 * A homlokzat szerinti mellvédmagasság (m) azoknál a feliratos ablakoknál, amelyeknél eltér az alaprajzi „pm” értéktől
 * (25 cm – 1 m; egyszintes épületen): a homlokzati rajz illesztése a nyílások szerint (homlokzatEltolas), a nyílás helyén álló azonos szélességű
 * keret alsó éle a lap szintjeleiből (a kerethez legközelebbi szintjel-oszlop lineáris illesztése). A szintjel felirata
 * és a szintvonal közti eltolást laponként a feliratos ablakok mellvédmagasságai (medián) igazítják ki – az eltérés így
 * a többségtől eltérő ablak.
 */
export function homlokzatMellvedek(nyilasok: TervNyilas[], mPerPt: number, eszakSzog: number, lapok: Lap[], tartalekM?: number, szint = 0, szintDb = 1): Map<TervNyilas, number> {
  const ki = new Map<TervNyilas, number>();
  // (csak egyszintes épületen: több szintnél a keret szinthez rendelése és a szintjelek kiigazítása bizonytalan)
  if (szintDb !== 1 || szint !== 0) return ki;
  const kulso = nyilasok.filter((n) => n.kulso && n.irany !== null && n.fajta !== 'falfulke');
  const s = (n: TervNyilas) => { const t = n.irany! * Math.PI / 180; return (-Math.cos(t) * n.x - Math.sin(t) * n.y) * mPerPt; };
  for (const lap of lapok) {
    const rajzok = homlokzatRajzok(lap, tartalekM); if (!rajzok.length) continue;
    const jelek = lap.szovegek.flatMap((t) => { const m = /^([±+-])\s?(\d{1,2}),(\d{2})$/.exec(t.s.trim()); return m ? [{ x: t.x, y: t.y, v: (m[1] === '-' ? -1 : 1) * Number(`${m[2]}.${m[3]}`) }] : []; });
    const oszlopok: (typeof jelek)[] = [];
    for (const j of [...jelek].sort((a, b) => a.x - b.x)) { const o = oszlopok.find((c) => Math.abs(c[0]!.x - j.x) < 8); if (o) o.push(j); else oszlopok.push([j]); }
    const jo = oszlopok.filter((o) => o.length >= 3);
    const zFv = (cx: number, cy: number) => {
      const o = jo.filter((c) => Math.min(...c.map((j) => j.y)) - 30 <= cy && Math.max(...c.map((j) => j.y)) + 30 >= cy).sort((a, b) => Math.abs(a[0]!.x - cx) - Math.abs(b[0]!.x - cx))[0];
      if (!o) return null;
      const n = o.length, sx = o.reduce((q, j) => q + j.y, 0), sy = o.reduce((q, j) => q + j.v, 0), sxx = o.reduce((q, j) => q + j.y * j.y, 0), sxy = o.reduce((q, j) => q + j.y * j.v, 0);
      const b = (n * sxy - sx * sy) / (n * sxx - sx * sx); if (!(b < 0)) return null;
      const a = (sy - b * sx) / n; return (y: number) => a + b * y;
    };
    const par: { n: TervNyilas; alja: number }[] = [];
    for (const rz of rajzok) {
      const il = homlokzatEltolas(rz, kulso, mPerPt, eszakSzog); if (!il) continue;
      for (const n of kulso) {
        if (n.irany !== il.ir || n.mert || n.pm === null || n.fajta !== 'ablak') continue;
        const x = s(n) + il.o;
        const jok = rz.keretek.filter((k) => Math.abs((k.x0 + k.x1) / 2 * rz.mPerPt - x) <= 0.25 && Math.abs(k.szel - n.szel) <= 0.1 && !k.takart).sort((a, b) => b.y1 - a.y1);
        const k = jok.length === 1 ? jok[0] : undefined; if (!k) continue;
        const z = zFv((k.x0 + k.x1) / 2, (k.y0 + k.y1) / 2); if (!z) continue;
        par.push({ n, alja: z(k.y1) });
      }
    }
    if (par.length < 3) continue;
    const elt = par.map((p) => p.n.pm! - p.alja).sort((a, b) => a - b), d = elt[elt.length >> 1]!;
    // (a kiigazítás csak akkor megbízható, ha a feliratos ablakok legalább fele ± 5 cm-en belül egyezik vele)
    if (elt.filter((v) => Math.abs(v - d) <= 0.05).length < par.length / 2) continue;
    for (const p of par) { const v = Math.round((p.alja + d) * 100) / 100, e = Math.abs(v - p.n.pm!); if (e >= 0.25 && e <= 1 && v >= 0 && v <= 2.2 && !ki.has(p.n)) ki.set(p.n, v); }
  }
  return ki;
}

/**
 * A homlokzattal nem egyező feliratos ablakok / erkélyajtók: a homlokzati rajz illesztése után (homlokzatEltolas, legalább
 * 3 egyező nyílás és az irány nyílásainak fele) a nyílás helyén (±25 cm) nincs keret (`hom: null`), vagy az ott álló
 * keretek egyike sem egyezik a felirattal (szélesség ± 20 cm, a nem takart keret magassága ± 20 cm) – `hom`: a
 * legközelebbi keret mérete (m). Több szint keretei egymás felett: bármelyik szint egyező kerete elég.
 */
export function homlokzatElteresek(nyilasok: TervNyilas[], mPerPt: number, eszakSzog: number, lapok: Lap[], tartalekM?: number, szintDb = 1): Map<TervNyilas, { szel: number; mag: number } | null> {
  const ki = new Map<TervNyilas, { szel: number; mag: number } | null>(), egyezik = new Set<TervNyilas>();
  // (csak egyszintes épületen: több szintnél a keretek szinthez rendelése bizonytalan)
  if (szintDb !== 1) return ki;
  const kulso = nyilasok.filter((n) => n.kulso && n.irany !== null && n.fajta !== 'falfulke');
  const s = (n: TervNyilas) => { const t = n.irany! * Math.PI / 180; return (-Math.cos(t) * n.x - Math.sin(t) * n.y) * mPerPt; };
  for (const lap of lapok) {
    for (const rz of homlokzatRajzok(lap, tartalekM)) {
      const il = homlokzatEltolas(rz, kulso, mPerPt, eszakSzog); if (!il) continue;
      const sajat = kulso.filter((n) => n.irany === il.ir);
      // (megbízható illesztés: az irány nyílásainak legalább 60 %-a egyezik egy kerettel)
      if (il.tam < 3 || il.tam < 0.6 * sajat.length) continue;
      const e = (k: HomlokzatKeret) => (k.x0 + k.x1) / 2 * rz.mPerPt;
      // (a rajz kiterjedésén kívül eső nyílás – másik szárny, takart rész – nem eltérés)
      const x0 = Math.min(...rz.keretek.map((k) => k.x0 * rz.mPerPt)) - 0.5, x1 = Math.max(...rz.keretek.map((k) => k.x1 * rz.mPerPt)) + 0.5;
      for (const n of sajat) {
        if (n.mert || !(n.mag > 0) || (n.fajta !== 'ablak' && n.fajta !== 'erkelyajto') || egyezik.has(n)) continue;
        const x = s(n) + il.o; if (x < x0 || x > x1) continue;
        const ott = rz.keretek.filter((k) => Math.abs(e(k) - x) <= 0.25 + Math.max(0, (k.szel - n.szel) / 2));
        const jo = ott.some((k) => Math.abs(k.szel - n.szel) <= SZT && (k.takart || Math.abs(k.mag - n.mag) <= SZT));
        if (jo) { egyezik.add(n); ki.delete(n); continue; }
        if (!ott.length) { if (!ki.has(n)) ki.set(n, null); continue; }
        const k = [...ott].sort((a, b) => Math.abs(a.szel - n.szel) + Math.abs(a.mag - n.mag) - Math.abs(b.szel - n.szel) - Math.abs(b.mag - n.mag))[0]!;
        ki.set(n, { szel: Math.round(k.szel * 100) / 100, mag: Math.round(k.mag * 100) / 100 });
      }
    }
  }
  return ki;
}

export interface MertMagassag { mag: number; takart: boolean; /** homlokzat: helyzet szerint illesztett keret; szelesseg: azonos szélességű keretek leggyakoribb magassága; becsult: alapérték */ forras: 'homlokzat' | 'szelesseg' | 'becsult' }

/**
 * A mért (mag = 0) nyílások magassága. `nyilasok`: az alaprajz összes külső nyílása (a feliratosak is – ezek segítik
 * az illesztést), `mPerPt` az alaprajz léptéke, `eszakSzog` az északjel, `szint` / `szintDb` a lap szintjének
 * sorszáma alulról és a szintek száma.
 */
export function mertMagassagok(nyilasok: TervNyilas[], mPerPt: number, eszakSzog: number, rajzok: HomlokzatRajz[], szint = 0, szintDb = 1): Map<TervNyilas, MertMagassag> {
  const ki = new Map<TervNyilas, MertMagassag>();
  const kulso = nyilasok.filter((n) => n.kulso && n.irany !== null && n.fajta !== 'falfulke');
  // vetület a homlokzat síkjára, a homlokzat felé néző szemlélő bal→jobb irányában (m)
  const s = (n: TervNyilas) => { const t = n.irany! * Math.PI / 180; return (-Math.cos(t) * n.x - Math.sin(t) * n.y) * mPerPt; };
  const e = (rz: HomlokzatRajz, k: HomlokzatKeret) => (k.x0 + k.x1) / 2 * rz.mPerPt;
  // rajzonként a hozzá legjobban illeszkedő alaprajzi homlokzat (lapirány): az északjel és a homlokzat címe 45° körül
  // kétértelmű lehet („keleti” az ÉK-i homlokzat), ezért a ±60°-on belüli irányok közül a legtöbb egyezés dönt
  for (const rz of rajzok) {
    let legjobb: { o: number; tam: number; sajat: TervNyilas[] } | null = null;
    for (const ir of [0, 90, 180, 270]) {
      if (szogKul(ir - eszakSzog, rz.az) > 60) continue;
      const sajat = kulso.filter((n) => n.irany === ir);
      if (!sajat.some((n) => n.mert)) continue;
      const jel: number[] = [];
      for (const n of sajat) for (const k of rz.keretek) if (Math.abs(k.szel - n.szel) <= SZT) jel.push(e(rz, k) - s(n));
      for (const c of jel) {
        const t = sajat.filter((n) => rz.keretek.some((k) => Math.abs(k.szel - n.szel) <= SZT && Math.abs(e(rz, k) - s(n) - c) <= 0.25)).length;
        if (!legjobb || t > legjobb.tam) legjobb = { o: c, tam: t, sajat };
      }
    }
    if (!legjobb || legjobb.tam < 2) continue;
    const { o, sajat } = legjobb;
    for (const n of sajat) {
      if (!n.mert || ki.has(n)) continue;
      const jo = rz.keretek.filter((k) => Math.abs(e(rz, k) - (s(n) + o)) <= 0.4 && Math.abs(k.szel - n.szel) <= 0.3).sort((a, b) => b.y1 - a.y1);
      if (!jo.length) continue;
      const k = jo.length === szintDb ? jo[szint]! : jo.length === 1 ? jo[0]! : jo.reduce((a, b) => (Math.abs(b.szel - n.szel) < Math.abs(a.szel - n.szel) ? b : a));
      ki.set(n, { mag: k.mag, takart: k.takart, forras: 'homlokzat' });
    }
  }
  // tartalék: az azonos (± 8 cm) szélességű keretek leggyakoribb magassága – előbb az azonos égtájú rajzokon, aztán bárhol;
  // ha nincs ilyen keret, alapérték (1,6 m feletti szélesség: padlóig érő üvegezés 2,40 m, egyébként ablak 1,50 m)
  for (const n of kulso) {
    if (!n.mert || ki.has(n)) continue;
    const gyak = (rk: HomlokzatRajz[]) => { const m = new Map<number, number>(); for (const r of rk) for (const k of r.keretek) if (Math.abs(k.szel - n.szel) <= 0.08) { const h = Math.round(k.mag * 20) / 20; m.set(h, (m.get(h) ?? 0) + 1); } return [...m.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0]; };
    const h = gyak(rajzok.filter((r) => szogKul(n.irany! - eszakSzog, r.az) <= 60)) ?? gyak(rajzok);
    ki.set(n, h !== undefined ? { mag: h, takart: false, forras: 'szelesseg' } : { mag: n.szel >= 1.6 ? 2.4 : 1.5, takart: false, forras: 'becsult' });
  }
  return ki;
}

/**
 * Északjel nélküli alaprajz: az észak iránya a homlokzati rajzokból. A címükben égtájat viselő homlokzatok
 * nyílászárókereteit minden szóba jöhető északirány (45°-onként) mellett az alaprajz megfelelő homlokzatának
 * nyílásaihoz illesztjük (szélesség és egymáshoz viszonyított helyzet); az az irány, amelynél a legtöbb nyílás
 * egyezik. Csak egyértelmű győztes esetén ad eredményt (≥ 4 egyezés, a második legjobb legfeljebb kétharmada).
 */
export function eszakHomlokzatbol(nyilasok: TervNyilas[], mPerPt: number, rajzok: HomlokzatRajz[]): number | null {
  const kulso = nyilasok.filter((n) => n.kulso && n.irany !== null && n.fajta !== 'falfulke' && n.szel > 0.3);
  if (!rajzok.length || kulso.length < 4) return null;
  const s = (n: TervNyilas) => { const t = n.irany! * Math.PI / 180; return (-Math.cos(t) * n.x - Math.sin(t) * n.y) * mPerPt; };
  const e = (rz: HomlokzatRajz, k: HomlokzatKeret) => (k.x0 + k.x1) / 2 * rz.mPerPt;
  const pont = (eszak: number) => {
    let ossz = 0;
    for (const rz of rajzok) {
      const sajat = kulso.filter((n) => szogKul(n.irany! - eszak, rz.az) <= 22.5);
      if (sajat.length < 2) continue;
      let leg = 0;
      for (const n of sajat) for (const k of rz.keretek) {
        if (Math.abs(k.szel - n.szel) > SZT) continue;
        const c = e(rz, k) - s(n);
        const t = sajat.filter((m) => rz.keretek.some((q) => Math.abs(q.szel - m.szel) <= SZT && Math.abs(e(rz, q) - s(m) - c) <= 0.25)).length;
        if (t > leg) leg = t;
      }
      ossz += leg;
    }
    return ossz;
  };
  const ered = [0, 45, 90, 135, 180, 225, 270, 315].map((sz) => ({ sz, p: pont(sz) })).sort((a, b) => b.p - a.p);
  return ered[0]!.p >= 4 && ered[1]!.p <= (2 / 3) * ered[0]!.p ? ered[0]!.sz : null;
}

export interface HomlokzatTetoAblak { az: number; szel: number; hossz: number; alja: number }

/**
 * Tetősík ablakok a homlokzatról (ha az alaprajzon nincs méretfeliratuk): a homlokzati rajz azon keretei, amelyek alja a
 * térdfal teteje (tetőtéri padló + térdfal) fölött van – az eresz felőli homlokzaton ezek a tetősíkban ülnek. A magasság
 * a lap szintjeleiből (a kerethez legközelebbi szintjel-oszlop lineáris illesztése); a tetősík menti hossz a látszó
 * magasság / sin(hajlásszög), a szélesség a látszó szélesség.
 */
export function tetoAblakokHomlokzatrol(lap: Lap, kuszob: number, hajlas: number, tartalekM?: number): HomlokzatTetoAblak[] {
  const rajzok = homlokzatRajzok(lap, tartalekM); if (!rajzok.length) return [];
  const jelek = lap.szovegek.flatMap((t) => { const m = /^([±+-])\s?(\d{1,2}),(\d{2})$/.exec(t.s.trim()); return m ? [{ x: t.x, y: t.y, v: (m[1] === '-' ? -1 : 1) * Number(`${m[2]}.${m[3]}`) }] : []; });
  const oszlopok: (typeof jelek)[] = [];
  for (const j of [...jelek].sort((a, b) => a.x - b.x)) { const o = oszlopok.find((c) => Math.abs(c[0]!.x - j.x) < 8); if (o) o.push(j); else oszlopok.push([j]); }
  const jo = oszlopok.filter((o) => o.length >= 3);
  const ki: HomlokzatTetoAblak[] = [];
  const sin = Math.sin(hajlas * Math.PI / 180);
  for (const r of rajzok) for (const k of r.keretek) {
    const cy = (k.y0 + k.y1) / 2, cx = (k.x0 + k.x1) / 2;
    // a kerettel azonos magasságtartományt lefedő, hozzá vízszintesen legközelebbi szintjel-oszlop
    const o = jo.filter((c) => Math.min(...c.map((j) => j.y)) <= cy && Math.max(...c.map((j) => j.y)) >= cy).sort((a, b) => Math.abs(a[0]!.x - cx) - Math.abs(b[0]!.x - cx))[0];
    if (!o) continue;
    // y → szint (legkisebb négyzetek)
    const n = o.length, sx = o.reduce((s, j) => s + j.y, 0), sy = o.reduce((s, j) => s + j.v, 0), sxx = o.reduce((s, j) => s + j.y * j.y, 0), sxy = o.reduce((s, j) => s + j.y * j.v, 0);
    const b = (n * sxy - sx * sy) / (n * sxx - sx * sx); if (!(b < 0)) continue;
    const a = (sy - b * sx) / n;
    const alja = a + b * k.y1;
    if (alja < kuszob) continue;
    ki.push({ az: r.az, szel: k.szel, hossz: Math.round(k.mag / sin * 100) / 100, alja: Math.round(alja * 100) / 100 });
  }
  return ki;
}

/** Tetőfelület a ferde él alatt? (a homlokzati rajz területén: tetőrétegű kitöltés, ill. ≥ 40 rövid vonal / m² –
 *  héjazat-sraffozás – az él alatt 0,3–0,9 m-rel, az él középső 60 %-a mentén, a minták többségén) */
function tetoFeluletAlatt(lap: Lap, [bx0, by0, bx1, by1]: number[], m: number): (x0: number, y0: number, x1: number, y1: number) => boolean {
  const TETO = /tet[őo]|h[ée]j|cser[ée]p|fed[ée]s|zsindely|pala\b/i;
  // (a tetőréteg kitöltésének sokszöge – nem a befoglalója: a ferde oromdeszka, a tetőszél-sáv befoglalója az egész
  // oromháromszöget lefedné; Tata-Nyárfa: az oromfal így kontylapnak látszott)
  const kitolt: number[][][] = [], kozep: [number, number][] = [];
  for (const u of lap.utvonalak) {
    if (u.muvelet === 'none' || u.bbox[2] < bx0 || u.bbox[0] > bx1 || u.bbox[3] < by0 || u.bbox[1] > by1) continue;
    if (u.muvelet !== 'stroke' && u.reteg && TETO.test(u.reteg)) kitolt.push(u.pontok);
    for (const p of u.pontok) for (let i = 0; i + 3 < p.length; i += 2) {
      const l = Math.hypot(p[i + 2]! - p[i]!, p[i + 3]! - p[i + 1]!) * m; if (l > 0.02 && l < 0.6) kozep.push([(p[i]! + p[i + 2]!) / 2, (p[i + 1]! + p[i + 3]!) / 2]);
    }
  }
  const R = 0.25 / m, A = Math.PI * 0.25 * 0.25;
  const suru = (pts: [number, number][], x: number, y: number) => pts.reduce((n, [cx, cy]) => n + ((cx - x) ** 2 + (cy - y) ** 2 <= R * R ? 1 : 0), 0) / A;
  const benne = (pk: number[][], x: number, y: number) => { let be = false; for (const p of pk) { const n = p.length / 2; for (let i = 0, j = n - 1; i < n; j = i++) { const xi = p[2 * i]!, yi = p[2 * i + 1]!, xj = p[2 * j]!, yj = p[2 * j + 1]!; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) be = !be; } } return be; };
  const teto = (x: number, y: number) => kitolt.some((pk) => benne(pk, x, y)) || suru(kozep, x, y) >= 40;
  return (x0, y0, x1, y1) => {
    let igen = 0, db = 0;
    for (const t of [0.2, 0.35, 0.5, 0.65, 0.8]) for (const d of [0.3, 0.6, 0.9]) {
      // (a lap y lefelé nő: „alatta” = nagyobb y)
      db++; if (teto(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + d / m)) igen++;
    }
    return igen > db / 2;
  };
}

/**
 * Oromfalak a homlokzaton: a tető hajlásszögével (±4°) futó, legalább 1 m-es ferde vonalak vízszintes vetületének
 * uniója rajzonként (m) – az oromzat (nyeregtető vége) a homlokzaton ferde tetőszélként látszik, az eresz vízszintesként.
 * A rajz területe: a hozzá rendelt keretek befoglalója, kibővítve (a cím szerinti rajzhoz tartozó vonalak).
 * Trapéz alakú tetőkontúr (két ferde él, köztük vízszintes gerinc) kontyolt tető oldalnézete: `kontyOldal`, oromzat nélkül.
 */
export function oromSzelessegek(lap: Lap, hajlas: number, tartalekM?: number, opt: { kontyNelkul?: boolean } = {}): { az: number; orom: number; kontyOldal?: boolean }[] {
  const rajzok = homlokzatRajzok(lap, tartalekM); if (!rajzok.length) return [];
  const ki: { az: number; orom: number; kontyOldal?: boolean }[] = [];
  for (const r of rajzok) {
    const m = r.mPerPt;
    const kx0 = Math.min(...r.keretek.map((k) => k.x0)), kx1 = Math.max(...r.keretek.map((k) => k.x1));
    let bx0 = kx0 - 12 / m, bx1 = kx1 + 12 / m;
    const by0 = Math.min(...r.keretek.map((k) => k.y0)) - 5 / m, by1 = Math.max(...r.keretek.map((k) => k.y1)) + 1 / m;
    // (a kibővített terület nem nyúlhat át a lap másik, mellette álló homlokzatrajzára – Tata-Nyárfa: a délkeleti nézet
    // 12 m-es sávja a délnyugati oromfalát is befogta)
    // (csak a teljes modell tetőjénél – a Navitherm tetőtér-geometriája a régi szabállyal)
    if (opt.kontyNelkul) for (const q of rajzok) { if (q === r) continue;
      const qx0 = Math.min(...q.keretek.map((k) => k.x0)), qx1 = Math.max(...q.keretek.map((k) => k.x1));
      const qy0 = Math.min(...q.keretek.map((k) => k.y0)), qy1 = Math.max(...q.keretek.map((k) => k.y1));
      if (qy1 < by0 || qy0 > by1) continue;
      if (qx1 <= kx0) bx0 = Math.max(bx0, (qx1 + kx0) / 2); else if (qx0 >= kx1) bx1 = Math.min(bx1, (qx0 + kx1) / 2); }
    // kontyolt tetővég: szemből a kontylap ugyanúgy a tető hajlásával futó háromszög, mint az oromfal – de a ferde él
    // alatt tetőfelület van (tetőréteg kitöltése, ill. sűrű héjazat-sraffozás), oromfalnál falfelület
    const tetoAlatta = opt.kontyNelkul ? tetoFeluletAlatt(lap, [bx0, by0, bx1, by1], m) : null;
    const tart: [number, number][] = [];
    // a ferde élek felső végpontja (bal oldali emelkedő: a felső vég jobbra; jobb oldali süllyedő: balra) és a vízszintes vonalak
    const felsoBal: [number, number][] = [], felsoJobb: [number, number][] = [], vizsz: [number, number, number][] = [];
    for (const u of lap.utvonalak) {
      if (u.muvelet === 'none' || u.bbox[2] < bx0 || u.bbox[0] > bx1 || u.bbox[3] < by0 || u.bbox[1] > by1) continue;
      for (const p of u.pontok) for (let i = 0; i + 3 < p.length; i += 2) {
        const dx = Math.abs(p[i + 2]! - p[i]!), dy = Math.abs(p[i + 3]! - p[i + 1]!);
        if (dy * m < 0.02 && dx * m >= 0.3) vizsz.push([Math.min(p[i]!, p[i + 2]!), Math.max(p[i]!, p[i + 2]!), (p[i + 1]! + p[i + 3]!) / 2]);
        if (Math.hypot(dx, dy) * m < 1) continue;
        const sz = Math.atan2(dy, dx) * 180 / Math.PI;
        if (Math.abs(sz - hajlas) > 4) continue;
        const [fx, fy, ax] = p[i + 1]! < p[i + 3]! ? [p[i]!, p[i + 1]!, p[i + 2]!] : [p[i + 2]!, p[i + 3]!, p[i]!];
        (fx > ax ? felsoBal : felsoJobb).push([fx, fy]);
        if (tetoAlatta?.(p[i]!, p[i + 1]!, p[i + 2]!, p[i + 3]!)) continue;
        tart.push([Math.min(p[i]!, p[i + 2]!), Math.max(p[i]!, p[i + 2]!)]);
      }
    }
    // kontyolt tető oldalnézetben: a két ferde él nem találkozik, felső végeiket (azonos magasságban, ≥ 0,5 m-re) vízszintes
    // gerincvonal köti össze – trapéz. A ferde élek itt a kontylapok oldalról, nem oromzatok.
    const kontyOldal = felsoBal.some(([xb, yb]) => felsoJobb.some(([xj, yj]) => {
      if ((xj - xb) * m < 0.5 || Math.abs(yj - yb) * m > 0.15) return false;
      const fed = vizsz.filter(([a, b, y]) => Math.abs(y - (yb + yj) / 2) * m <= 0.15 && b > xb && a < xj).map(([a, b]) => [Math.max(a, xb), Math.min(b, xj)] as [number, number]).sort((q, w) => q[0] - w[0]);
      let o = 0, v = -Infinity; for (const [a, b] of fed) { if (b > v) { o += b - Math.max(a, v); v = b; } }
      return o >= 0.8 * (xj - xb);
    }));
    if (kontyOldal) { ki.push({ az: r.az, orom: 0, kontyOldal: true }); continue; }
    tart.sort((a, b) => a[0] - b[0]);
    let ossz = 0, veg = -Infinity;
    for (const [a, b] of tart) { if (b > veg) { ossz += b - Math.max(a, veg); veg = b; } }
    ki.push({ az: r.az, orom: Math.round(ossz * m * 100) / 100 });
  }
  return ki;
}
