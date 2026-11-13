/**
 * Nyílászárók felismerése (4. kör): a nyílásméret-feliratok (két egymás alatti szám: szélesség / magasság, cm;
 * mellette „pm 90” mellvédmagasság) párosítása a falnyílásokkal, helyiséghez és homlokzati irányhoz rendelése.
 */
import type { Szoveg, Lap } from './kinyeres';
import type { Raszter } from './raszter';
import { szovegJavit } from './alaprajz';

export interface TervNyilas {
  /** Szélesség, magasság (m). */
  szel: number; mag: number;
  /** Mellvédmagasság (m); null: nincs felirat (ajtó). */
  pm: number | null;
  /** A felirat középpontja (pt). */
  x: number; y: number;
  /** Helyiség indexe a raszterben (pecsétsorrend), és a homlokzat lapiránya (0 fel, 90 jobb, 180 le, 270 bal). */
  helyiseg: number | null;
  irany: number | null;
  kulso: boolean;
  /** A fal iránya a lapon (a feliratpárból). */
  fal?: 'v' | 'f';
  fajta: 'ablak' | 'erkelyajto' | 'bejarati_ajto' | 'bejarati_uvegajto' | 'garazskapu' | 'belso_ajto' | 'falfulke' | 'fuggonyfal';
  /** Méretfelirat nélküli nyílás: a szélesség az alaprajzon mért falnyílás, a magasság a homlokzatról (vagy becsült). */
  mert?: { magForras: 'homlokzat' | 'homlokzat_takart' | 'becsult' };
  /** A hozzárendelt (áthidalt) falnyílás befoglalója a lapon (pt): x0, y0, x1, y1 – a megjelenítéshez. */
  hely?: [number, number, number, number];
  /** A homlokzati irány becsült (a felirathoz legközelebbi falszakasz alapján, nem a nyílásfolt átnézéséből). */
  iranyTipp?: boolean;
  /** Belső nyílásnál a túloldali helyiség indexe a raszterben (fűtetlen helyiség felé nyíló ajtóhoz). */
  masik?: number;
  /** Méretláncba írt feliratból (lásd NyilasFelirat.lanc). */
  lanc?: boolean;
}

/** Nyílásméret cm-ben; a „+30” toldás (redőnytok, tokszélesítés) a magasság mellett – a nyílásméret az első szám. */
const SZAM = /^\d{2,3}(?:\s*\+\s*\d{1,3})?$/;
// a „+30” toldás (redőnytok a falnyílásban) a falnyílás része: „240+30” → 270 (falnyílás-méret, mint a WinWatt-bevitelben)
const szamCm = (s: string) => s.trim().split('+').reduce((t, v) => t + Number(v.trim()), 0);
/** Méterben írt nyílásméret (kapuknál gyakori: „2,65” / „2,40”). */
const SZAM_M = /^\d,\d{2}$/;
const mSzam = (s: string) => Number(s.trim().replace(',', '.'));
const PM = /^(?:pm|ph|mv|p\.m\.?|p|mellvéd|parapet)\s*[.:=]?\s*([+-]?\d{1,3}(?:[,.]\d{1,2})?)\s*(cm|m)?$/i;
/** Egy szövegben, mellvéd elöl: „pm 90 240 175” (mellvéd, szélesség, magasság). */
const PM_ELOL = /^(?:pm|p)\s*(\d{1,3})\s+(\d{2,3})\s+(\d{2,3})$/i;
/** Egy szövegben: „90/150”, „90x150”, „90×150”, opcionálisan mellvéddel: „90/150 pm 90”. */
const EGYBEN = /^(\d{2,3})\s*[\/x×*]\s*(\d{2,3})(?:\s*[,;]?\s*(?:pm|ph|mv|p\.m\.?|mellvéd)\s*[.:=]?\s*([+-]?\d{1,3}))?$/i;
const pmErtek = (v: string, e?: string) => { const x = Number(v.replace(',', '.')); return e?.toLowerCase() === 'm' || (v.includes(',') || v.includes('.')) && x < 3 ? x : x / 100; };

function geom(t: Szoveg) {
  const th = t.szog * Math.PI / 180;
  const dir = [Math.cos(th), -Math.sin(th)] as const, fel = [-Math.sin(th), -Math.cos(th)] as const;
  const cx = t.x + dir[0] * t.szel / 2 + fel[0] * t.meret * 0.35, cy = t.y + dir[1] * t.szel / 2 + fel[1] * t.meret * 0.35;
  return { dir, fel, cx, cy };
}

export interface NyilasFelirat { szel: number; mag: number; pm: number | null; x: number; y: number; /** A fal iránya a lapon: vízszintes / függőleges. */ fal: 'v' | 'f'; /** Méterben írt, kapuméretű feliratpár: csak garázs jellegű helyiségben, falnyíláshoz kötve fogadjuk el. */ kapuJelolt?: boolean;
  /** Mellvéd nélküli, méterben (vegyesen) írt ajtóméret-pár: csak külső falnyíláshoz kötve fogadjuk el. */ ajtoJelolt?: boolean;
  /** Méretláncba írt nyílásméret (ArchiCAD: a lánc szakasza fölött a szélesség, alatta a magasság, „(p85)” mellvéd): a
   *  homlokzattól távolabb is állhat – a falnyíláshoz a fal menti vetülete köti (lancNyilasok). */ lanc?: boolean }

/** Méret szövegből cm-ben: „75” → 75, „2,40” → 240. */
const cmErtek = (v: string) => (v.includes(',') || v.includes('.') ? Math.round(Number(v.replace(',', '.')) * 100) : Number(v));
/**
 * Falnyílás- és tokméret egy feliratban: „2,60 (2,40)”, „(1,80) 1,80”, „75 (75)”, „pm -20 (0)”, „pm 1,75 (1,80)” –
 * a zárójeles érték a nyílászáró (tok) mérete, a másik a falnyílásé. A nyílászáró felületét a falnyílás méretével
 * számoljuk (a fal ennyivel kevesebb), ezért a feliratot a zárójel nélküli értékre (cm) cseréljük; a mellvédnél a
 * zárójeles (kész padlótól mért) érték marad.
 */
function tokMeret(t: Szoveg): Szoveg {
  const s = t.s.trim();
  const SZ = '([+-]?\\d{1,3}(?:,\\d{1,2})?)';
  const pm = new RegExp(`^(pm|ph|mv)\\s*${SZ}\\s*\\(${SZ}\\)$`, 'i').exec(s);
  if (pm) return { ...t, s: `pm ${cmErtek(pm[3]!)}` };
  const m = new RegExp(`^(?:${SZ}\\s*\\(${SZ}\\)|\\(${SZ}\\)\\s*${SZ})$`).exec(s);
  if (!m) return t;
  const v = cmErtek(m[1] ?? m[4]!);
  return v >= 30 && v <= 600 ? { ...t, s: String(v) } : t;
}

/** A két (egymás fölötti) szám között a szöveg irányával párhuzamos, hosszú, mindkét oldalon túlnyúló vonal fut-e. */
/**
 * Két párhuzamos méretlánc egymás alatti számai: mindkét számnak saját hosszú méretvonala van, ugyanazon az oldalán
 * (a szám a vonala fölé írva) – a nyílásfelirat két száma között egyetlen vonal fut (tört- vagy falvonal).
 */
/** Rétegnév, amelyen biztosan nem méretvonal van (kert, terep, burkolat). */
const NEM_MERET_RETEG = /kert|környezet|kornyezet|site|terep|járda|jarda|burkolat|növény|noveny|tereprendez|parkol|út\b/i;

function ketMeretvonalE(a: Szoveg, b: Szoveg, utvonalak: { muvelet: string; pontok: number[][]; bbox: number[]; reteg?: string }[]): boolean {
  const ga = geom(a);
  const sajat = (t: Szoveg): { d: number }[] => {
    const g = geom(t); const sz = Math.max(t.szel, t.meret); const ki: { d: number }[] = [];
    for (const u of utvonalak) {
      if (u.muvelet === 'fill') continue;
      // rétegezett rajzon csak a méretezés rétegén (a kert, járda, terep vonalai nem méretvonalak)
      if (u.reteg && NEM_MERET_RETEG.test(u.reteg)) continue;
      if (g.cx < u.bbox[0]! - 2 * t.meret || g.cx > u.bbox[2]! + 2 * t.meret || g.cy < u.bbox[1]! - 2 * t.meret || g.cy > u.bbox[3]! + 2 * t.meret) continue;
      for (const p of u.pontok) for (let i = 0; i + 3 < p.length; i += 2) {
        const x1 = p[i]!, y1 = p[i + 1]!, x2 = p[i + 2]!, y2 = p[i + 3]!;
        const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy); if (L < 5 * sz) continue;
        if (Math.abs((dx * ga.dir[0] + dy * ga.dir[1]) / L) < 0.995) continue;
        const d = (x1 - g.cx) * ga.fel[0] + (y1 - g.cy) * ga.fel[1];
        if (Math.abs(d) > t.meret * 0.9) continue;
        const tt = ((g.cx - x1) * dx + (g.cy - y1) * dy) / (L * L), fel = (sz * 1.2) / L;
        if (tt > fel && tt < 1 - fel) ki.push({ d });
      }
    }
    return ki;
  };
  const va = sajat(a), vb = sajat(b);
  // ugyanazon az oldalon (előjel), és nem ugyanaz a vonal (a két szám között futó egyetlen vonal a nyílásfeliraté)
  const gb = geom(b); const kozt = (gb.cx - ga.cx) * ga.fel[0] + (gb.cy - ga.cy) * ga.fel[1];
  return va.some((x) => vb.some((y) => Math.sign(x.d) === Math.sign(y.d) && Math.abs(x.d - (y.d + kozt)) > a.meret * 0.5));
}

function meretlancE(a: Szoveg, b: Szoveg, utvonalak: { muvelet: string; pontok: number[][]; bbox: number[] }[]): boolean {
  const ga = geom(a), gb = geom(b);
  const mx = (ga.cx + gb.cx) / 2, my = (ga.cy + gb.cy) / 2; const sz = Math.max(a.szel, b.szel);
  const perpTav = Math.abs((gb.cx - ga.cx) * ga.fel[0] + (gb.cy - ga.cy) * ga.fel[1]);
  for (const u of utvonalak) {
    if (u.muvelet === 'fill') continue;
    if (mx < u.bbox[0]! - perpTav || mx > u.bbox[2]! + perpTav || my < u.bbox[1]! - perpTav || my > u.bbox[3]! + perpTav) continue;
    for (const p of u.pontok) for (let i = 0; i + 3 < p.length; i += 2) {
      const x1 = p[i]!, y1 = p[i + 1]!, x2 = p[i + 2]!, y2 = p[i + 3]!;
      const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy); if (L < 4 * sz) continue;
      // párhuzamos a szöveggel
      if (Math.abs((dx * ga.dir[0] + dy * ga.dir[1]) / L) < 0.995) continue;
      // a két szám között (merőleges távolság a középponttól kisebb, mint a számok távolságának fele)
      const d = (mx - x1) * ga.fel[0] + (my - y1) * ga.fel[1];
      if (Math.abs(d) > perpTav * 0.45) continue;
      // a számok mindkét oldalán túlnyúlik
      const t = ((mx - x1) * dx + (my - y1) * dy) / (L * L);
      const fel = (sz * 1.5) / L;
      if (!(t > fel && t < 1 - fel)) continue;
      // méretvonal-jel (rövid ferde vagy merőleges vonás, ill. pont) a vonalon, a számpár közelében (≤ 4 szövegszélesség)
      const ux = dx / L, uy = dy / L; const meret = Math.max(a.meret, b.meret);
      const vx = x1 + dx * t, vy = y1 + dy * t;
      for (const u2 of utvonalak) {
        if (u2.bbox[2]! - u2.bbox[0]! > 2.5 * meret || u2.bbox[3]! - u2.bbox[1]! > 2.5 * meret) continue;
        const cx = (u2.bbox[0]! + u2.bbox[2]!) / 2, cy = (u2.bbox[1]! + u2.bbox[3]!) / 2;
        const menti = (cx - vx) * ux + (cy - vy) * uy, kereszt = Math.abs((cx - vx) * -uy + (cy - vy) * ux);
        if (Math.abs(menti) > 4 * sz || kereszt > 0.6 * meret) continue;
        // a vonás nem párhuzamos a méretvonallal (ferde / merőleges jel), vagy kitöltött pont
        if (u2.muvelet === 'fill') return true;
        for (const q of u2.pontok) for (let j = 0; j + 3 < q.length; j += 2) { const ex = q[j + 2]! - q[j]!, ey = q[j + 3]! - q[j + 1]!, el = Math.hypot(ex, ey); if (el > 0.3 * meret && Math.abs((ex * ux + ey * uy) / el) < 0.9) return true; }
      }
    }
  }
  return false;
}

export function nyilasFeliratok(sz0: Szoveg[], utvonalak?: { muvelet: string; pontok: number[][]; bbox: number[] }[]): NyilasFelirat[] {
  const sz = sz0.map(tokMeret);
  const szamok = sz.filter((t) => SZAM.test(t.s.trim()) && szamCm(t.s) >= 30 && szamCm(t.s) <= 600);
  const pmek = sz.map((t) => ({ t, m: PM.exec(szovegJavit(t.s)) })).filter((x) => x.m);
  // „pm” és a szám külön szövegelemben
  for (const t of sz) {
    if (!/^(pm|mv|ph)\.?:?$/i.test(t.s.trim())) continue;
    const g = geom(t);
    const sz2 = sz.find((u) => u !== t && /^[+-]?\d{1,3}$/.test(u.s.trim()) && Math.abs(u.szog - t.szog) < 2 && Math.hypot(geom(u).cx - g.cx, geom(u).cy - g.cy) < t.meret * 2.5);
    if (sz2) pmek.push({ t, m: PM.exec(`pm ${sz2.s.trim()}`) });
  }
  const hasznalt = new Set<Szoveg>(); const pmHasznalt = new Set<Szoveg>();
  const ki: NyilasFelirat[] = [];
  for (const a of szamok) {
    if (hasznalt.has(a)) continue;
    const ga = geom(a);
    let legjobb: { b: Szoveg; perp: number } | null = null;
    for (const b of szamok) {
      if (b === a || hasznalt.has(b) || Math.abs(b.szog - a.szog) > 2 || Math.abs(b.meret - a.meret) > a.meret * 0.15) continue;
      const gb = geom(b);
      const dx = gb.cx - ga.cx, dy = gb.cy - ga.cy;
      const menti = Math.abs(dx * ga.dir[0] + dy * ga.dir[1]);
      const perp = dx * ga.fel[0] + dy * ga.fel[1];
      if (menti > a.meret * 1.0 || Math.abs(perp) < a.meret * 0.9 || Math.abs(perp) > a.meret * 1.9) continue;
      if (!legjobb || Math.abs(perp) < Math.abs(legjobb.perp)) legjobb = { b, perp };
    }
    if (!legjobb) continue;
    // méretlánc: a két szám között a szöveg irányával párhuzamos, a számoknál jóval hosszabb (≥ 4 szövegszélesség)
    // vonal fut, amely a számok mindkét oldalán túlnyúlik – a nyílásfelirat törtvonala rövid (≈ a szám szélessége)
    // (kikapcsolva: a nyílásfelirat törtvonala sok tervben a falsíkon futó hosszú vonal – a valódi feliratokat is kiszűrte)
    if (utvonalak && (globalThis as { MERETLANC_SZURES?: boolean }).MERETLANC_SZURES && meretlancE(a, legjobb.b, utvonalak)) continue;
    // a „fel” irányban lévő a szélesség, alatta a magasság
    const [felso, also] = legjobb.perp > 0 ? [legjobb.b, a] : [a, legjobb.b];
    const gb = geom(legjobb.b);
    const x = (ga.cx + gb.cx) / 2, y = (ga.cy + gb.cy) / 2;
    // mellvédfelirat: a nyílás tengelyében (a pár „fel” iránya a fal iránya), a faltól legfeljebb ~5 betűmagasságra
    let pm: (typeof pmek)[number] | undefined; let pmT = Infinity;
    for (const q of pmek) {
      if (pmHasznalt.has(q.t)) continue;
      const g = geom(q.t); const dx = g.cx - x, dy = g.cy - y;
      const menti = Math.abs(dx * ga.fel[0] + dy * ga.fel[1]), keresztben = Math.abs(dx * ga.dir[0] + dy * ga.dir[1]);
      if (menti > a.meret * 1.2 || keresztben > a.meret * 4.8) continue;
      if (keresztben < pmT) { pmT = keresztben; pm = q; }
    }
    // a fal túloldalára, a nyílás tengelyébe írt mellvéd („pm -20 (0)” a helyiség felőli oldalon): tágabb keresés
    if (!pm) for (const q of pmek) {
      if (pmHasznalt.has(q.t)) continue;
      const g = geom(q.t); const dx = g.cx - x, dy = g.cy - y;
      const menti = Math.abs(dx * ga.fel[0] + dy * ga.fel[1]), keresztben = Math.abs(dx * ga.dir[0] + dy * ga.dir[1]);
      if (menti > a.meret * 2.2 || keresztben > a.meret * 11) continue;
      if (keresztben < pmT) { pmT = keresztben; pm = q; }
    }
    if (pm) pmHasznalt.add(pm.t);
    hasznalt.add(a); hasznalt.add(legjobb.b);
    let szel = szamCm(felso.s) / 100, mag = szamCm(also.s) / 100;
    // ajtó felcserélt sorrendben („240 / 90”): mellvéd nélkül, ajtómagasságú felső és ajtószélességű alsó szám
    if (!pm && szel >= 1.9 && mag <= 1.2) [szel, mag] = [mag, szel];
    ki.push({ szel, mag, pm: pm ? pmErtek(pm.m![1]!, pm.m![2]) : null, x, y, fal: Math.abs(ga.fel[0]) >= Math.abs(ga.fel[1]) ? 'v' : 'f' });
  }
  // méterben írt nyílásméret mellvéddel („1,80 / 1,50” + „pm: 90”): a mellvédfelirat igazolja, hogy nyílászáró (a
  // méretlánc számai mellett nincs mellvéd) – bármilyen méretben
  const mHasznalt = new Set<Szoveg>();
  {
    // vegyes írásmód is: az 1 m alatti méret cm-ben, a többi méterben („90 / 2,40”, „1,20 / 50”)
    const vegyes = (t: Szoveg) => SZAM.test(t.s.trim()) && !hasznalt.has(t) && szamCm(t.s) >= 30 && szamCm(t.s) < 100;
    const mSz = (t: Szoveg) => (SZAM_M.test(t.s.trim()) ? mSzam(t.s) : szamCm(t.s) / 100);
    const mind = sz.filter((t) => (SZAM_M.test(t.s.trim()) && mSzam(t.s) >= 0.3 && mSzam(t.s) <= 6) || vegyes(t));
    const ajtok: { a: Szoveg; b: Szoveg; w: number; h: number; x: number; y: number; fal: 'v' | 'f' }[] = [];
    // előbb a párok, utána a mellvédfeliratok a legközelebbi pártól kezdve (a szomszédos ajtópár ne vigye el az ablak mellvédjét)
    const parok: { a: Szoveg; b: Szoveg; w: number; h: number; x: number; y: number; fal: 'v' | 'f'; cmPar: boolean; mPar: boolean }[] = [];
    const parban = new Set<Szoveg>();
    for (const a of mind) {
      if (parban.has(a)) continue;
      const ga = geom(a);
      let legjobb: { b: Szoveg; perp: number } | null = null;
      for (const b of mind) {
        if (b === a || parban.has(b) || Math.abs(b.szog - a.szog) > 2 || Math.abs(b.meret - a.meret) > a.meret * 0.15) continue;
        const gb = geom(b); const dx = gb.cx - ga.cx, dy = gb.cy - ga.cy;
        const menti = Math.abs(dx * ga.dir[0] + dy * ga.dir[1]), perp = dx * ga.fel[0] + dy * ga.fel[1];
        if (menti > a.meret * 1.0 || Math.abs(perp) < a.meret * 0.9 || Math.abs(perp) > a.meret * 1.9) continue;
        if (!legjobb || Math.abs(perp) < Math.abs(legjobb.perp)) legjobb = { b, perp };
      }
      if (!legjobb) continue;
      const gb = geom(legjobb.b);
      const [felso, also] = legjobb.perp > 0 ? [legjobb.b, a] : [a, legjobb.b];
      const cmPar = !SZAM_M.test(a.s.trim()) && !SZAM_M.test(legjobb.b.s.trim());
      const mPar = SZAM_M.test(a.s.trim()) && SZAM_M.test(legjobb.b.s.trim());
      // két cm-es szám párja az első körben dőlt el
      if (cmPar) continue;
      parban.add(a); parban.add(legjobb.b);
      parok.push({ a, b: legjobb.b, w: mSz(felso), h: mSz(also), x: (ga.cx + gb.cx) / 2, y: (ga.cy + gb.cy) / 2, fal: Math.abs(ga.fel[0]) >= Math.abs(ga.fel[1]) ? 'v' : 'f', cmPar, mPar });
    }
    const jeloltPm = parok.flatMap((P, pi) => pmek.filter((q) => !pmHasznalt.has(q.t)).map((q) => ({ pi, q, d: Math.hypot(geom(q.t).cx - P.x, geom(q.t).cy - P.y) })).filter((e) => e.d <= P.a.meret * 5)).sort((u, v) => u.d - v.d);
    const parPm = new Map<number, (typeof pmek)[number]>();
    for (const e of jeloltPm) { if (parPm.has(e.pi) || pmHasznalt.has(e.q.t)) continue; const P = parok[e.pi]!; if (P.h < 0.3 || P.h > 3.5) continue; parPm.set(e.pi, e.q); pmHasznalt.add(e.q.t); }
    parok.forEach((P, pi) => {
      const pm = parPm.get(pi);
      // vegyes / méteres pár mellvéd nélkül csak ajtóméretű lehet
      if (!pm) { if (P.mPar && P.w >= 0.7 && P.w <= 1.3 && P.h >= 2.0 && P.h <= 2.6) ajtok.push({ a: P.a, b: P.b, w: P.w, h: P.h, x: P.x, y: P.y, fal: P.fal }); return; }
      mHasznalt.add(P.a); mHasznalt.add(P.b);
      ki.push({ szel: P.w, mag: P.h, pm: pmErtek(pm.m![1]!, pm.m![2]), x: P.x, y: P.y, fal: P.fal });
    });
    for (const d of ajtok) {
      if (mHasznalt.has(d.a) || mHasznalt.has(d.b)) continue;
      mHasznalt.add(d.a); mHasznalt.add(d.b);
      ki.push({ szel: d.w, mag: d.h, pm: null, x: d.x, y: d.y, fal: d.fal, ajtoJelolt: true });
    }
  }
  const mPar: NyilasFelirat[] = []; const parSzoveg = new Map<NyilasFelirat, [Szoveg, Szoveg]>();
  // méterben írt kapuméretek (szélesség ≥ 1,8 m, magasság 1,8–6 m) – a méretláncok számaitól a hozzárendelés választja el
  const mSzamok = sz.filter((t) => SZAM_M.test(t.s.trim()) && mSzam(t.s) >= 1.8 && mSzam(t.s) <= 6 && !mHasznalt.has(t));
  for (const a of mSzamok) {
    if (mHasznalt.has(a)) continue;
    const ga = geom(a);
    let legjobb: { b: Szoveg; perp: number } | null = null;
    for (const b of mSzamok) {
      if (b === a || mHasznalt.has(b) || Math.abs(b.szog - a.szog) > 2 || Math.abs(b.meret - a.meret) > a.meret * 0.15) continue;
      const gb = geom(b); const dx = gb.cx - ga.cx, dy = gb.cy - ga.cy;
      const menti = Math.abs(dx * ga.dir[0] + dy * ga.dir[1]), perp = dx * ga.fel[0] + dy * ga.fel[1];
      if (menti > a.meret * 1.0 || Math.abs(perp) < a.meret * 0.9 || Math.abs(perp) > a.meret * 1.9) continue;
      if (!legjobb || Math.abs(perp) < Math.abs(legjobb.perp)) legjobb = { b, perp };
    }
    if (!legjobb) continue;
    const [felso, also] = legjobb.perp > 0 ? [legjobb.b, a] : [a, legjobb.b];
    const w = mSzam(felso.s), h = mSzam(also.s);
    // magasabb (3,2–6 m) csak csarnokkapu lehet: legalább 4 m széles, és a közelében (≤ 25 betűméret) „kapu” felirat áll –
    // a lakóépület függőleges méretláncpárjai nem
    const gb0 = geom(legjobb.b);
    const kapuSzoveg = () => sz.some((t) => /kapu/i.test(t.s) && Math.hypot(t.x - (ga.cx + gb0.cx) / 2, t.y - (ga.cy + gb0.cy) / 2) < a.meret * 25);
    if (h < 1.8 || h > 6 || (h > 3.2 && !(w >= 4 && kapuSzoveg()))) continue;
    // két párhuzamos méretlánc egymás alatti számai („2,72” / „2,74⁵”): a számpár között méretvonal fut – nem kapu
    if (utvonalak && !kapuSzoveg() && ketMeretvonalE(a, legjobb.b, utvonalak)) continue;
    const gb = geom(legjobb.b);
    mHasznalt.add(a); mHasznalt.add(legjobb.b);
    ki.push({ szel: w, mag: h, pm: null, x: (ga.cx + gb.cx) / 2, y: (ga.cy + gb.cy) / 2, fal: Math.abs(ga.fel[0]) >= Math.abs(ga.fel[1]) ? 'v' : 'f', kapuJelolt: true });
    if (!kapuSzoveg()) { mPar.push(ki[ki.length - 1]!); parSzoveg.set(ki[ki.length - 1]!, [felso, also]); }
  }
  // méretláncba írt nyílásméretek (ArchiCAD): a lánc szakasza fölött a szélesség méterben, alatta a magasság (méterben,
  // vagy cm-ben „(p85)” mellvéddel). Ha a lapon legalább 3 ilyen pár van, és a magasságok közül egy legalább kétszer
  // ismétlődik, a „kapuméretű” párok is ilyen nyílásméretek (nem kapuk), és a keskenyebb (< 1,8 m) párokat is felvesszük.
  {
    const LANC_ALSO = /^(\d{1,3}(?:,\d{1,2})?)\s*\(\s*p\s*[.:=]?\s*([+-]?\d{1,3}(?:,\d{1,2})?)\s*\)$/i;
    const ertek = (v: string) => (v.includes(',') ? mSzam(v) : Number(v) / 100);
    // felső szám: méterben (a ≥ 1,8 m-es csak „(p…)” mellvédes alsóval – a méteres párokat a kapuág már vizsgálta), vagy
    // cm-ben („80” / „1,30 (p1,15)”), szintén csak mellvédes alsóval
    const felsoE = (t: Szoveg) => { const v = t.s.trim(); return SZAM_M.test(v) ? mSzam(v) >= 0.4 && mSzam(v) <= 6 : /^\d{2,3}$/.test(v) && Number(v) >= 40 && Number(v) <= 600; };
    const csakPm = (t: Szoveg) => !SZAM_M.test(t.s.trim()) || mSzam(t.s) >= 1.8;
    const kicsi: NyilasFelirat[] = []; const kHasznalt = new Set<Szoveg>();
    // alulról felfelé: három egymás alá írt számnál („1,60” lánc / „1,10” / „2,45”) az alsó kettő a felirat
    const magassag = (t: Szoveg) => { const g = geom(t); return g.cx * g.fel[0] + g.cy * g.fel[1]; };
    const felsok = sz.filter((t) => felsoE(t) && !mHasznalt.has(t)).sort((x, y) => magassag(x) - magassag(y));
    for (const a of felsok) {
      if (kHasznalt.has(a)) continue;
      const ga = geom(a); let legjobb: { b: Szoveg; perp: number } | null = null;
      for (const b of sz) {
        if (b === a || mHasznalt.has(b) || kHasznalt.has(b) || Math.abs(b.szog - a.szog) > 2 || Math.abs(b.meret - a.meret) > a.meret * 0.15) continue;
        const bs = b.s.trim(); if (!(LANC_ALSO.test(bs) || (!csakPm(a) && SZAM_M.test(bs)))) continue;
        const gb = geom(b); const dx = gb.cx - ga.cx, dy = gb.cy - ga.cy;
        const menti = Math.abs(dx * ga.dir[0] + dy * ga.dir[1]), perp = dx * ga.fel[0] + dy * ga.fel[1];
        // az alsó szám a felső alatt (a szöveg „lefelé” iránya: −fel)
        if (menti > a.meret * 1.6 || perp > -a.meret * 0.9 || perp < -a.meret * 1.9) continue;
        if (!legjobb || Math.abs(perp) < Math.abs(legjobb.perp)) legjobb = { b, perp };
      }
      if (!legjobb) continue;
      const bs = legjobb.b.s.trim(); const m = LANC_ALSO.exec(bs);
      const h = m ? ertek(m[1]!) : mSzam(bs); let pm = m ? ertek(m[2]!) : null; if (pm !== null && (pm < -0.5 || pm > 2.5)) pm = null;
      if (h < 0.3 || h > 3.2) continue;
      if (utvonalak && ketMeretvonalE(a, legjobb.b, utvonalak)) continue;
      const gb = geom(legjobb.b); kHasznalt.add(a); kHasznalt.add(legjobb.b);
      const f: NyilasFelirat = { szel: ertek(a.s.trim()), mag: h, pm, x: (ga.cx + gb.cx) / 2, y: (ga.cy + gb.cy) / 2, fal: Math.abs(ga.fel[0]) >= Math.abs(ga.fel[1]) ? 'v' : 'f', lanc: true };
      kicsi.push(f); parSzoveg.set(f, [a, legjobb.b]);
    }
    // két párhuzamos méretlánc egymás alatti számai (nem nyílásfelirat): a nyílásfelirat két száma ugyanannak a
    // láncszakasznak a közepére van írva (a középpontjuk a lánc mentén egybeesik), a két lánc számai a saját szakaszuk
    // közepén – ezek csak akkor esnek egymás alá, ha a két szakasz azonos (és akkor a két szám is egyenlő)
    const lancSzam = (f: NyilasFelirat) => {
      const p = parSzoveg.get(f); if (!p || f.szel === f.mag) return true;
      const g0 = geom(p[0]), g1 = geom(p[1]);
      // (a felirat két sora szorosan egymás alatt – ≤ 1,35 betűméret –, a két lánc sortávja nagyobb)
      return Math.abs((g1.cx - g0.cx) * g0.dir[0] + (g1.cy - g0.cy) * g0.dir[1]) > p[0].meret * 0.25
        || Math.abs((g1.cx - g0.cx) * g0.fel[0] + (g1.cy - g0.cy) * g0.fel[1]) > p[0].meret * 1.35;
    };
    const osszes = [...mPar, ...kicsi].filter((f) => !lancSzam(f));
    // (a mellvéd nélküli ajtóméret-párok – „1,10 / 2,45” a falnál – is számítanak az ismétlődő magasságba)
    const db = new Map<number, number>(); for (const f of [...osszes, ...ki.filter((f) => f.ajtoJelolt)]) db.set(f.mag, (db.get(f.mag) ?? 0) + 1);
    if (osszes.length >= 3 && Math.max(0, ...db.values()) >= 2) {
      for (const f of mPar) f.lanc = true;
      ki.push(...kicsi);
      for (let i = ki.length - 1; i >= 0; i--) if (ki[i]!.lanc && !osszes.includes(ki[i]!)) ki.splice(i, 1);
    }
  }
  // egy szövegben, mellvéddel elöl: „pm 90 240 175”
  for (const t of sz) {
    const m = PM_ELOL.exec(szovegJavit(t.s)); if (!m) continue;
    const g = geom(t);
    ki.push({ szel: Number(m[2]) / 100, mag: Number(m[3]) / 100, pm: Number(m[1]) / 100, x: g.cx, y: g.cy, fal: Math.abs(g.dir[0]) >= Math.abs(g.dir[1]) ? 'v' : 'f' });
  }
  // egy szövegben megadott méretek
  for (const t of sz) {
    const m = EGYBEN.exec(szovegJavit(t.s)); if (!m) continue;
    const w = Number(m[1]), h = Number(m[2]); if (w < 30 || h < 30) continue;
    const g = geom(t);
    let pm: number | null = m[3] !== undefined ? Number(m[3]) / 100 : null;
    if (pm === null) {
      const q = pmek.filter((x) => !pmHasznalt.has(x.t)).map((x) => ({ x, d: Math.hypot(geom(x.t).cx - g.cx, geom(x.t).cy - g.cy) })).filter((x) => x.d < t.meret * 4.8).sort((a, b) => a.d - b.d)[0];
      if (q) { pmHasznalt.add(q.x.t); pm = pmErtek(q.x.m![1]!, q.x.m![2]); }
    }
    ki.push({ szel: w / 100, mag: h / 100, pm, x: g.cx, y: g.cy, fal: Math.abs(g.dir[0]) >= Math.abs(g.dir[1]) ? 'v' : 'f' });
  }
  return ki;
}

/**
 * Falfülke: a feliratozott „nyílás” helyén a fal sraffozása nem szakad meg (a fülke csak a falvastagság egy részét
 * veszi el – radiátor-, redőny-, bútorfülke). Vizsgálat: a felirat mögötti falsávban, a nyílás szélességén a rövid
 * ferde sraffvonalak sűrűsége legalább fele a szomszédos falpilléreken mértnek. Ablaknál, ajtónál a nyílás
 * szakaszán a falsávban tok-, üveg- és szárnyvonalak vannak, sraff nincs.
 */
export function falfulkeE(f: { x: number; y: number; szel: number; fal?: 'v' | 'f'; irany?: number | null }, r: Raszter, lap: Lap): boolean {
  const ptPx = r.mPerPt / r.px;
  const fx = Math.round((f.x - r.x0) * ptPx), fy = Math.round((f.y - r.y0) * ptPx);
  const vizsz = f.fal ? f.fal === 'v' : f.irany === 0 || f.irany === 180;
  const falPx = (x: number, y: number) => x >= 0 && y >= 0 && x < r.w && y < r.h && !!r.fal[y * r.w + x];
  const maxD = Math.round(0.9 / r.px);
  for (const s of [1, -1]) {
    let d0 = -1;
    for (let d = 0; d <= maxD; d++) { const x = vizsz ? fx : fx + s * d, y = vizsz ? fy + s * d : fy; if (falPx(x, y)) { d0 = d; break; } }
    if (d0 < 0) continue;
    let d1 = d0; while (d1 - d0 < Math.round(0.8 / r.px)) { const x = vizsz ? fx : fx + s * (d1 + 1), y = vizsz ? fy + s * (d1 + 1) : fy; if (!falPx(x, y)) break; d1++; }
    // csak helyiséget határoló falsáv: a sáv egyik oldalán 0,3 m-en belül helyiség van (a járda, lábazat, kavicssáv
    // sraffozott sávja a fal előtt nem fülke)
    const hely = (d: number) => { const x = vizsz ? fx : fx + s * d, y = vizsz ? fy + s * d : fy; return x >= 0 && y >= 0 && x < r.w && y < r.h && r.cimke[y * r.w + x]! >= 2; };
    const kk = Math.round(0.3 / r.px); let helyMellett = false;
    for (let k = 1; k <= kk && !helyMellett; k++) helyMellett = hely(d0 - k) || hely(d1 + k);
    // a felirat és a falsáv között áthidalt falnyílás van: ez a nyílás maga (a fal külső része nyitott), nem fülke
    let nyilasElotte = false;
    // (a falsáv mögött, ill. előtte 0,3 m-en belül is: a nyílás a fal belső / külső rétegében van áthidalva)
    for (let d = 0; d <= d1 + Math.round(0.3 / r.px) && !nyilasElotte; d++) { const x = vizsz ? fx : fx + s * d, y = vizsz ? fy + s * d : fy; nyilasElotte = x >= 0 && y >= 0 && x < r.w && y < r.h && !!r.nyilas[y * r.w + x]; }
    if (nyilasElotte) continue;
    if (!helyMellett) continue;
    // falsáv lapkoordinátában: a fal mentén [a0, a1], keresztben [c0, c1]
    const toPt = (px: number) => px / ptPx;
    const keresztben = [s * d0, s * d1].map((v) => (vizsz ? r.y0 + toPt(fy + v) : r.x0 + toPt(fx + v))).sort((a, b) => a - b) as [number, number];
    const kozep = vizsz ? f.x : f.y;
    const felSz = f.szel * 0.4 / r.mPerPt, pill = 0.45 / r.mPerPt, res = f.szel * 0.5 / r.mPerPt + 0.12 / r.mPerPt;
    if (keresztben[1] - keresztben[0] < 0.05 / r.mPerPt) continue;
    // a nyílás szakasza, és 2 m-en belül mindkét irányban 0,45 m-es falpillér-ablakok (a szomszédos nyílásokon túl is)
    const sav: [number, number][] = [[kozep - felSz, kozep + felSz]];
    for (let e = 0; e < 2.0 / r.mPerPt; e += 0.3 / r.mPerPt) { sav.push([kozep - res - e - pill, kozep - res - e]); sav.push([kozep + res + e, kozep + res + e + pill]); }
    const db = sav.map(() => 0);
    const amin = Math.min(...sav.map((x) => x[0])), amax = Math.max(...sav.map((x) => x[1]));
    for (const u of lap.utvonalak) {
      if (u.muvelet !== 'stroke') continue;
      const [bx0, by0, bx1, by1] = u.bbox;
      const c0 = vizsz ? by0 : bx0, c1 = vizsz ? by1 : bx1, a0 = vizsz ? bx0 : by0, a1 = vizsz ? bx1 : by1;
      if (c1 < keresztben[0] || c0 > keresztben[1] || a1 < amin || a0 > amax) continue;
      for (const p of u.pontok) for (let i = 0; i + 3 < p.length; i += 2) {
        const dx = p[i + 2]! - p[i]!, dy = p[i + 3]! - p[i + 1]!; const l = Math.hypot(dx, dy) * r.mPerPt;
        if (l < 0.01 || l > 0.8) continue;
        const sz = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI) % 90; if (sz < 15 || sz > 75) continue;
        const mx = (p[i]! + p[i + 2]!) / 2, my = (p[i + 1]! + p[i + 3]!) / 2;
        const c = vizsz ? my : mx, a = vizsz ? mx : my;
        if (c < keresztben[0] || c > keresztben[1]) continue;
        sav.forEach(([s0, s1], k) => { if (a >= s0 && a <= s1) db[k]!++; });
      }
    }
    const nyilasSuru = db[0]! / (sav[0]![1] - sav[0]![0]);
    // a falpillér-ablakok sűrűségének mediánja (a nem sraffozott – nyílásba eső – ablakok nélkül); egy-egy sűrűbben
    // sraffozott elem (pillér, kémény) nem dönti el
    const suruk = sav.slice(1).map((x, k) => db[k + 1]! / (x[1] - x[0])).filter((v) => v > 0).sort((a, b) => a - b);
    const pillerSuru = suruk.length ? suruk[Math.floor(suruk.length / 2)]! : 0;
    if (pillerSuru > 0 && db[0]! >= 3 && nyilasSuru >= 0.5 * pillerSuru) return true;
  }
  return false;
}

/**
 * A feliratokat a raszter nyílásaihoz rendeli: a felirathoz legközelebbi áthidalt nyílás (≤ 1,3 m), majd a nyílás
 * előtti helyiségfal-szakasz adja a helyiséget és a homlokzat irányát; ha a szakasz túloldala külső tér, a nyílás külső.
 */
/** A hozzárendelésben (a felirat közelében) falnyíláshoz kötött méretlánc-feliratok – a lancNyilasok ezeket kihagyja. */
const lancHozzarendelt = new WeakSet<NyilasFelirat>();

export function nyilasokHozzarendel(feliratok: NyilasFelirat[], r: Raszter, nevek: string[] = [], tipusLap = false): TervNyilas[] {
  const LAKO = /nappali|szoba|háló|halo\b|konyha|étkez|etkez|dolgozó|gyerek|living|apartman|stúdió|studio/i;
  const GARAZS = /gar[aá]zs|gépkocsi|gepkocsi|beálló|autó/i;
  const ptPx = r.mPerPt / r.px;
  const ki: TervNyilas[] = []; const kiFolt: number[] = [];
  const vanPm = feliratok.some((f) => f.pm !== null);
  // az áthidalt nyílások foltjai; a pixelenkénti irány a vízszintes és függőleges nyílásfutam hosszából
  const W = r.w, H = r.h;
  const hf = new Uint16Array(W * H), vf = new Uint16Array(W * H);
  for (let y = 0; y < H; y++) { let x = 0; while (x < W) { if (!r.nyilas[y * W + x]) { x++; continue; } let e = x; while (e < W && r.nyilas[y * W + e]) e++; for (let q = x; q < e; q++) hf[y * W + q] = e - x; x = e; } }
  for (let x = 0; x < W; x++) { let y = 0; while (y < H) { if (!r.nyilas[y * W + x]) { y++; continue; } let e = y; while (e < H && r.nyilas[e * W + x]) e++; for (let q = y; q < e; q++) vf[q * W + x] = e - y; y = e; } }
  const komp = new Int32Array(W * H); let kompDb = 0;
  for (let i = 0; i < W * H; i++) {
    if (!r.nyilas[i] || komp[i]) continue;
    const id = ++kompDb; const sor = [i]; komp[i] = id;
    for (let k = 0; k < sor.length; k++) {
      const q = sor[k]!, x = q % W;
      for (const n of [x > 0 ? q - 1 : -1, x < W - 1 ? q + 1 : -1, q - W, q + W]) if (n >= 0 && n < W * H && r.nyilas[n] && !komp[n]) { komp[n] = id; sor.push(n); }
    }
  }
  // a nyílásfoltok befoglalója (rácspont)
  const kompBB = Array.from({ length: kompDb + 1 }, () => [Infinity, Infinity, -Infinity, -Infinity]);
  for (let i = 0; i < W * H; i++) { const c = komp[i]!; if (!c) continue; const b = kompBB[c]!, x = i % W, y = (i / W) | 0; if (x < b[0]!) b[0] = x; if (y < b[1]!) b[1] = y; if (x > b[2]!) b[2] = x; if (y > b[3]!) b[3] = y; }
  const kompHely = (c: number): [number, number, number, number] => { const b = kompBB[c]!; return [r.x0 + b[0]! / ptPx, r.y0 + b[1]! / ptPx, r.x0 + (b[2]! + 1) / ptPx, r.y0 + (b[3]! + 1) / ptPx]; };
  for (const f of feliratok) {
    // a keskenyebb méretlánc-felirat csak a láncból, vetülettel köthető (lancNyilasok) – a közelében álló, a falra
    // merőleges magassági méretpár („0,90” / „1,20”) nem nyílásfelirat
    if (f.lanc && !f.kapuJelolt) continue;
    const fx = Math.round((f.x - r.x0) * ptPx), fy = Math.round((f.y - r.y0) * ptPx);
    const R = Math.round(1.3 / r.px);
    // jelölt nyílásfoltok távolság szerint; elsőként a felirat irányával egyező (azonos falsávú) foltok
    const legkozelebb = new Map<number, { i: number; d: number; v: boolean }>();
    for (let y = Math.max(0, fy - R); y <= Math.min(r.h - 1, fy + R); y++) for (let x = Math.max(0, fx - R); x <= Math.min(r.w - 1, fx + R); x++) {
      const i = y * r.w + x; if (!r.nyilas[i]) continue;
      const v = hf[i]! >= vf[i]!; const k = komp[i]! * 2 + (v ? 1 : 0);
      const d = (x - fx) ** 2 + (y - fy) ** 2;
      const m = legkozelebb.get(k); if (!m || d < m.d) legkozelebb.set(k, { i, d, v });
    }
    const kozelMax = (0.3 / r.px) ** 2;
    const jeloltek = [...legkozelebb.entries()].filter(([, m]) => m.v === (f.fal === 'v') || m.d <= kozelMax)
      .sort((a, b) => (Number(a[1].v !== (f.fal === 'v')) - Number(b[1].v !== (f.fal === 'v'))) || a[1].d - b[1].d);
    const maxL = Math.round(1.6 / r.px);
    const vizsgal = (best: number, v?: boolean) => {
      // a nyílásból a négy irányban a falon/nyíláson át: egyik oldalon helyiség, a másikon külső tér vagy másik helyiség
      const bx = best % r.w, by = (best / r.w) | 0;
      const talal = (dx: number, dy: number): number => {
        let x = bx, y = by;
        for (let k = 0; k < maxL; k++) {
          x += dx; y += dy; if (x < 0 || y < 0 || x >= r.w || y >= r.h) return 0;
          const i = y * r.w + x; if (r.fal[i] || r.nyilas[i]) continue;
          const c = r.cimke[i]!; if (c) return c;
        }
        return 0;
      };
      let p: { h: number; irany: number; kulso: boolean; masik?: number } | null = null;
      // a nyílásfolt irányára merőleges átnézés előbb (vízszintes folt: fel / le)
      const iranyok = ([[0, -1, 0], [1, 0, 90], [0, 1, 180], [-1, 0, 270]] as const).slice().sort((a, b) => (v === undefined ? 0 : Number((a[0] === 0) !== v) - Number((b[0] === 0) !== v)));
      // a folt egyértelműen hosszúkás (a hossza ≥ 2 × vastagsága): a rá merőleges átnézés a nyílás valódi átjárása – ha
      // ott két különböző helyiség van, belső nyílás (a homlokzati fal mellé eső belső ajtó nem lesz külső)
      const hosszukas = v !== undefined && Math.max(hf[best]!, vf[best]!) >= 2 * Math.min(hf[best]!, vf[best]!);
      for (const [n, [dx, dy, ir]] of iranyok.entries()) {
        const elol = talal(dx, dy), hatul = talal(-dx, -dy);
        if (n === 0 && hosszukas && hatul >= 2 && elol >= 2 && elol !== hatul) { p = { h: hatul - 2, irany: ir, kulso: false, masik: elol - 2 }; break; }
        // a helyiségből (hátul) a nyíláson át kifelé (elöl) nézünk
        if (hatul >= 2 && elol === 1) { p = { h: hatul - 2, irany: ir, kulso: true }; break; }
        if (hatul >= 2 && elol >= 2 && elol !== hatul && !p) p = { h: hatul - 2, irany: ir, kulso: false, masik: elol - 2 };
      }
      return p;
    };
    // az első olyan folt, amely helyiséghez tartozik (a járdaszegély, kerítés „nyílásai” kiesnek)
    let p: { h: number; irany: number; kulso: boolean; masik?: number } | null = null;
    let elteroIrany = false; let folt = 0; let tipp = false;
    for (const [, { i, v }] of jeloltek.slice(0, 6)) { p = vizsgal(i, v); if (p) { elteroIrany = v !== (f.fal === 'v'); folt = komp[i]!; break; } }
    // ajtófelirat, de csak a feliratra merőleges falban találtunk nyílást (az ajtónyílás nincs áthidalva, pl. fedett
    // terasz felé nyíló bejárat): a felirat irányával egyező, közeli (≤ 1 m) külső falszakasz előbb
    if (p && elteroIrany && f.pm === null && f.mag >= 1.9) {
      let leg: { h: number; irany: number; d: number } | null = null;
      r.helyisegek.forEach((H, h) => H.szakaszok.forEach((s) => {
        if (s.tul !== 'kulso' || ((s.irany === 0 || s.irany === 180) !== (f.fal === 'v'))) return;
        for (const q of s.pontok) { const d = Math.hypot(q[0] - f.x, q[1] - f.y) * r.mPerPt; if (d < 1.0 && (!leg || d < leg.d)) leg = { h, irany: s.irany, d }; }
      }));
      if (leg) { p = { h: (leg as { h: number }).h, irany: (leg as { irany: number }).irany, kulso: true }; tipp = true; }
    }
    if (!p) {
      // ha a nyílás nincs áthidalva (pl. a tok, üvegezés kitöltése falként zárja), a felirathoz legközelebbi,
      // a felirat irányával egyező külső falszakasz adja a helyiséget és a homlokzatot
      // mellvéd nélküli ajtófelirat csak a fal közvetlen közelében (≤ 0,6 m): a beljebb írt ajtófelirat (zuhanyfülke, szauna,
      // fürdő ajtaja) a homlokzati fal közelében is belső ajtó
      const dMax = f.pm === null && f.mag >= 1.9 ? 0.6 : 1.6;
      let leg: { h: number; irany: number; d: number } | null = null;
      r.helyisegek.forEach((H, h) => H.szakaszok.forEach((s) => {
        if (s.tul !== 'kulso' || ((s.irany === 0 || s.irany === 180) !== (f.fal === 'v'))) return;
        for (const q of s.pontok) { const d = Math.hypot(q[0] - f.x, q[1] - f.y) * r.mPerPt; if (d < dMax && (!leg || d < leg.d)) leg = { h, irany: s.irany, d }; }
      }));
      if (leg) { p = { h: (leg as { h: number }).h, irany: (leg as { irany: number }).irany, kulso: true }; tipp = true; }
    }
    if (!jeloltek.length && !p) continue;
    const kulso = !!p?.kulso;
    const garazsban = p ? GARAZS.test(nevek[p.h] ?? '') : false;
    // méterben írt kapupár: csak falnyíláshoz kötve, garázsban (vagy nagyon széles nyílásnál) – különben méretlánc-részlet
    if (f.kapuJelolt && !(p && kulso && (garazsban || f.szel >= 2.2))) continue;
    if (f.ajtoJelolt && !(p && kulso && jeloltek.length)) continue;
    // feliratozott mellvédű tervben a mellvéd nélküli, ajtómagasságnál alacsonyabb „nyílás” valójában méretlánc-részlet
    if (vanPm && f.pm === null && f.mag < 1.9) continue;
    // lakóhelyiség (nappali, szoba, konyha) külső ajtaja erkély- / teraszajtó (a széles is: tolóajtó), nem bejárati ajtó és nem kapu
    const lako = p ? LAKO.test(nevek[p.h] ?? '') : false;
    const kapu = kulso && f.pm === null && f.mag >= 1.8 && (garazsban ? f.kapuJelolt || f.szel >= 1.8 : !lako && f.kapuJelolt && f.szel >= 2.2);
    const fajta: TervNyilas['fajta'] = kapu ? 'garazskapu' : !kulso ? 'belso_ajto' : f.pm !== null && f.pm > 0.05 ? 'ablak' : f.pm !== null ? 'erkelyajto' : f.mag >= 1.9 ? (tipusLap || lako ? 'erkelyajto' : 'bejarati_ajto') : 'ablak';
    if (f.lanc) lancHozzarendelt.add(f);
    ki.push({ ...f, helyiseg: p?.h ?? null, irany: p?.irany ?? null, kulso, fajta, ...(folt && !elteroIrany ? { hely: kompHely(folt) } : {}), ...(!kulso && p?.masik !== undefined ? { masik: p.masik } : {}), ...(kulso && tipp ? { iranyTipp: true } : {}) });
    kiFolt.push(folt && !elteroIrany ? folt : 0);
  }
  // tömör homlokzati betét (pl. alumíniumburkolatú panel a portálban): a felirata egy másik felirat nyílásfoltjához
  // kötődik, a foltcsoport nyitott (falkitöltés nélküli) hossza nem fér el a feliratok összszélességével, és a felirat
  // alatti falszakaszban a fal teljes vastagságában falkitöltés (sraff) van; csak padlóig érő (mellvéd nélküli) elem
  const zartOszlop = (b: number[], vizsz: boolean, t: number): boolean => {
    for (let u = vizsz ? b[1]! : b[0]!; u <= (vizsz ? b[3]! : b[2]!); u++) { const i = vizsz ? u * W + t : t * W + u; if (i >= 0 && i < W * H && r.fal[i]) return true; }
    return false;
  };
  const tomor = (n: TervNyilas, b: number[], vizsz: boolean): boolean => {
    const fk = vizsz ? (n.x - r.x0) * ptPx : (n.y - r.y0) * ptPx; const fel = n.szel / r.px / 2;
    let zart = 0, ossz = 0;
    for (let t = Math.round(fk - fel * 0.8); t <= Math.round(fk + fel * 0.8); t++) { ossz++; if (zartOszlop(b, vizsz, t)) zart++; }
    return ossz > 0 && zart / ossz >= 0.6;
  };
  // a felirattal érintett foltok csoportjai (egymást érintő / átfedő befoglalók)
  const csop = new Map<number, number>();
  const fold = [...new Set(kiFolt.filter((c) => c))];
  const gyoker = (c: number): number => { while (csop.has(c) && csop.get(c) !== c) c = csop.get(c)!; return c; };
  for (const c of fold) csop.set(c, c);
  for (let a = 0; a < fold.length; a++) for (let q = a + 1; q < fold.length; q++) {
    const A = kompBB[fold[a]!]!, B = kompBB[fold[q]!]!;
    if (A[0]! <= B[2]! + 2 && B[0]! <= A[2]! + 2 && A[1]! <= B[3]! + 2 && B[1]! <= A[3]! + 2) csop.set(gyoker(fold[q]!), gyoker(fold[a]!));
  }
  const csopBB = new Map<number, number[]>(), csopTag = new Map<number, number[]>();
  kiFolt.forEach((c, k) => {
    if (!c) return; const g = gyoker(c), b = kompBB[c]!;
    const m = csopBB.get(g); csopBB.set(g, m ? [Math.min(m[0]!, b[0]!), Math.min(m[1]!, b[1]!), Math.max(m[2]!, b[2]!), Math.max(m[3]!, b[3]!)] : [...b]);
    csopTag.set(g, [...(csopTag.get(g) ?? []), k]);
  });
  const kidob = new Set<number>();
  for (const [g, tagok] of csopTag) {
    if (tagok.length < 2) continue;
    const b = csopBB.get(g)!; const vizsz = b[2]! - b[0]! >= b[3]! - b[1]!;
    const [lo, hi] = vizsz ? [b[0]!, b[2]!] : [b[1]!, b[3]!];
    let nyitott = 0; for (let t = lo; t <= hi; t++) if (!zartOszlop(b, vizsz, t)) nyitott++;
    const ossz = tagok.reduce((s2, k) => s2 + ki[k]!.szel, 0);
    if (ossz <= nyitott * r.px * 1.1 + 0.1) continue;
    for (const k of tagok) if (ki[k]!.kulso && (ki[k]!.pm ?? 0) <= 0.05 && ki[k]!.mag >= 1.9 && tomor(ki[k]!, b, vizsz)) kidob.add(k);
  }
  if ((globalThis as any).DBGNYH) for (const k of kidob) console.log('TOMOR', ki[k]!.szel, ki[k]!.mag, ki[k]!.pm, ki[k]!.x.toFixed(0), ki[k]!.y.toFixed(0));
  return ki.filter((_, k) => !kidob.has(k));
}

/**
 * Függönyfal / üvegfal (felirat nélküli, széles üvegezett falszakasz) a raszter jelöltjeiből: csak a fűtött helyiség és a
 * külső tér határán (az egyik oldalon pecsételt helyiség, a másikon külső tér), és ha a sávban nincs méretfeliratos nyílás.
 * A magasság 0 – átvételkor a belmagasság.
 */
export function fuggonyfalak(r: Raszter, feliratos: TervNyilas[], pecsetek: { x: number; y: number }[] = []): TervNyilas[] {
  const ki: TervNyilas[] = [];
  const cimke = (x: number, y: number) => {
    const xi = Math.floor((x - r.x0) * r.mPerPt / r.px), yi = Math.floor((y - r.y0) * r.mPerPt / r.px);
    return xi < 0 || yi < 0 || xi >= r.w || yi >= r.h ? 1 : r.cimke[yi * r.w + xi]!;
  };
  for (const g of r.uvegfalak) {
    const cx = (g.x0 + g.x1) / 2, cy = (g.y0 + g.y1) / 2;
    const fel = (g.fuggo ? g.x1 - g.x0 : g.y1 - g.y0) / 2 + 0.35 / r.mPerPt;
    // két oldal: függőleges elemnél balra / jobbra, vízszintesnél fel / le; a hossz mentén három ponton
    const oldal = (jel: number) => {
      const c = [0.25, 0.5, 0.75].map((t) => {
        const x = g.fuggo ? cx + jel * fel : g.x0 + (g.x1 - g.x0) * t, y = g.fuggo ? g.y0 + (g.y1 - g.y0) * t : cy + jel * fel;
        return cimke(x, y);
      });
      const h = c.filter((v) => v >= 2);
      if (h.length >= 2) return h.sort((a, b) => c.filter((v) => v === b).length - c.filter((v) => v === a).length)[0]!;
      if (c.filter((v) => v === 1).length >= 2) return 1;
      // a raszterben fel nem töltött belső tér (pl. lépcső rajzelemeivel tagolt lépcsőház): a legközelebbi pecsét ezen az oldalon (≤ 6 m)
      if (c.filter((v) => v === 0).length >= 2) {
        let leg = -1, d0 = 6 / r.mPerPt;
        pecsetek.forEach((pp, i) => {
          const oldalon = g.fuggo ? (pp.x - cx) * jel > 0 : (pp.y - cy) * jel > 0;
          const d = Math.hypot(pp.x - cx, pp.y - cy);
          if (oldalon && d < d0) { d0 = d; leg = i; }
        });
        if (leg >= 0) return leg + 2;
      }
      return -1;
    };
    const a = oldal(-1), b = oldal(1);
    if (!((a >= 2 && b === 1) || (b >= 2 && a === 1))) continue;
    // méretfeliratos nyílás a sávban → az egy (széles) ablak / ajtó, nem függönyfal
    const L = g.fuggo ? [g.y0, g.y1] : [g.x0, g.x1];
    if (feliratos.some((n) => n.kulso && n.helyiseg !== null && (g.fuggo ? Math.abs(n.x - cx) < 1.5 / r.mPerPt && n.y > L[0]! && n.y < L[1]! : Math.abs(n.y - cy) < 1.5 / r.mPerPt && n.x > L[0]! && n.x < L[1]!))) continue;
    const helyiseg = (a >= 2 ? a : b) - 2;
    const irany = g.fuggo ? (a === 1 ? 270 : 90) : (a === 1 ? 0 : 180);
    ki.push({ szel: Math.round(g.hossz * 100) / 100, mag: 0, pm: 0, x: cx, y: cy, helyiseg, irany, kulso: true, fajta: 'fuggonyfal', hely: [Math.min(g.x0, g.x1), Math.min(g.y0, g.y1), Math.max(g.x0, g.x1), Math.max(g.y0, g.y1)] });
  }
  return ki;
}

/**
 * Méretfelirat nélküli nyílások (pl. csak típusjellel – „AB-05A” – jelölt ablak, amelynek mérete a konszignációban van):
 * a raszter áthidalt falnyílása a fűtött helyiség és a külső tér határán. A szélesség a falnyílás mért hossza, a magasság
 * 0 – átvételkor a homlokzatról mérjük, ennek hiányában becsüljük. Ami mellett méretfeliratos nyílás vagy függönyfal van,
 * az nem kerül ide.
 */
/**
 * Méretláncba írt nyílásméretek (nyilasFeliratok: lanc) a már felismert külső falnyílásokhoz: a felirat a fal menti
 * vetületével a falnyílás szakaszára esik (a lánc a homlokzattól több méterre is futhat), a fal iránya egyezik, és a
 * felirat szélessége elfér a falnyílásban (± 0,3 m). Több jelölt közül a falhoz legközelebbi. A felirat adja a
 * szélességet és a magasságot; a mellvéd a feliratból („(p85)”) vagy a nyílás melletti „P: 90” szövegből.
 */
export function lancNyilasok(feliratok: NyilasFelirat[], nyilasok: TervNyilas[], r: Raszter, szovegek: Szoveg[], nevek: string[] = []): void {
  const BEJ = /előtér|eloter|szélfogó|szelfogo|bejárat|bejarat|lépcső|lepcso|közlekedő|kozlekedo|hall/i;
  const tol = 0.3 / r.mPerPt, maxTav = 8 / r.mPerPt;
  const pmek = szovegek.map((t) => ({ t, m: PM.exec(szovegJavit(t.s)) })).filter((x) => x.m);
  const kesz = new Set<TervNyilas>();
  for (const f of feliratok) {
    if (!f.lanc || lancHozzarendelt.has(f)) continue;
    // a közelben (≤ 1,5 m) már van azonos szélességű külső nyílás: annak (más irányba írt) felirata
    if (nyilasok.some((n) => n.kulso && !n.mert && Math.abs(n.szel - f.szel) < 0.05 && Math.hypot(n.x - f.x, n.y - f.y) * r.mPerPt < 1.5)) continue;
    const vizsz = f.fal === 'f'; const fel = f.szel / 2 / r.mPerPt;
    let leg: { n: TervNyilas; d: number } | null = null;
    for (const n of nyilasok) {
      // csak a felirat nélküli (mért) falnyílás és a felirat nélküli üvegfal kaphat méretet a láncból
      if (!n.kulso || kesz.has(n) || n.irany === null || n.irany === undefined || !(n.mert || n.fajta === 'fuggonyfal')) continue;
      if ((n.irany === 0 || n.irany === 180) !== vizsz) continue;
      const h = n.hely ?? [n.x - n.szel / 2 / r.mPerPt, n.y - n.szel / 2 / r.mPerPt, n.x + n.szel / 2 / r.mPerPt, n.y + n.szel / 2 / r.mPerPt];
      const [a0, a1] = vizsz ? [h[0], h[2]] : [h[1], h[3]]; const c = vizsz ? f.x : f.y;
      if (c - fel < a0 - tol || c + fel > a1 + tol) continue;
      const d = Math.abs(vizsz ? f.y - n.y : f.x - n.x); if (d > maxTav) continue;
      if (!leg || d < leg.d) leg = { n, d };
    }
    let uj: TervNyilas | null = null;
    if (!leg) {
      // a vetületben nincs felismert falnyílás (a raszter a nyílást falnak látta): a felirat felőli, vele párhuzamos,
      // a felirat szakaszát lefedő külső falszakasz (helyiség-határ) a falnyílás helye
      let fs: { h: number; irany: number; d: number; c: number } | null = null;
      r.helyisegek.forEach((H, h) => H.szakaszok.forEach((sz) => {
        if (sz.tul !== 'kulso' || (sz.irany === 0 || sz.irany === 180) !== vizsz) return;
        const nx = sz.irany === 90 ? 1 : sz.irany === 270 ? -1 : 0, ny = sz.irany === 180 ? 1 : sz.irany === 0 ? -1 : 0;
        const menti = sz.pontok.map((q) => (vizsz ? q[0] : q[1])); if (!menti.length) return;
        const c = vizsz ? f.x : f.y;
        if (c - fel < Math.min(...menti) - tol || c + fel > Math.max(...menti) + tol) return;
        const q = sz.pontok[0]!; const d = (f.x - q[0]) * nx + (f.y - q[1]) * ny;
        if (d <= 0 || d > maxTav) return;
        if (!fs || d < fs.d) fs = { h, irany: sz.irany, d, c: vizsz ? q[1] : q[0] };
      }));
      if (!fs) continue;
      const F = fs as { h: number; irany: number; d: number; c: number };
      // ugyanott már van (más feliratú) külső nyílás → nem kettőzzük
      if (nyilasok.some((n) => n.kulso && n.irany === F.irany && Math.abs((vizsz ? n.x - f.x : n.y - f.y)) < fel + tol && Math.abs(vizsz ? n.y - F.c : n.x - F.c) < 1 / r.mPerPt)) continue;
      uj = { szel: f.szel, mag: f.mag, pm: null, x: vizsz ? f.x : F.c, y: vizsz ? F.c : f.y, helyiseg: F.h, irany: F.irany, kulso: true, fajta: 'ablak', fal: f.fal, iranyTipp: true };
      nyilasok.push(uj); leg = { n: uj, d: F.d };
    }
    const n = leg.n; kesz.add(n);
    let pm = f.pm;
    if (pm === null) {
      const q = pmek.map((x) => ({ x, d: Math.hypot(x.t.x - n.x, x.t.y - n.y) * r.mPerPt })).filter((x) => x.d < 1.5).sort((a, b) => a.d - b.d)[0];
      if (q) pm = pmErtek(q.x.m![1]!, q.x.m![2]);
    }
    const nev = nevek[n.helyiseg ?? -1] ?? '';
    const fajta: TervNyilas['fajta'] = /gar[aá]zs|gépkocsi|gepkocsi|beálló/i.test(nev) && pm === null && f.mag >= 1.8 ? 'garazskapu' : pm !== null && pm > 0.05 ? 'ablak' : pm !== null || f.mag >= 1.9 ? (BEJ.test(nev) ? 'bejarati_ajto' : 'erkelyajto') : 'ablak';
    const { mert: _m, ...tobbi } = n;
    Object.assign(n, { ...tobbi, szel: f.szel, mag: f.mag, pm, fajta, lanc: true });
    delete n.mert;
  }
}

export function jeloletlenNyilasok(r: Raszter, meglevo: TervNyilas[]): TervNyilas[] {
  const { w, h, px } = r; const ki: TervNyilas[] = [];
  const latott = new Uint8Array(w * h);
  const lapX = (gx: number) => r.x0 + gx * px / r.mPerPt, lapY = (gy: number) => r.y0 + gy * px / r.mPerPt;
  const cimke = (gx: number, gy: number) => { const x = Math.round(gx), y = Math.round(gy); return x < 0 || y < 0 || x >= w || y >= h ? 1 : r.cimke[y * w + x]!; };
  for (let i = 0; i < w * h; i++) {
    if (!r.nyilas[i] || latott[i]) continue;
    const komp = [i]; latott[i] = 1; let x0 = i % w, x1 = x0, y0 = (i / w) | 0, y1 = y0;
    for (let k = 0; k < komp.length; k++) {
      const q = komp[k]!, x = q % w, y = (q / w) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const n of [x > 0 ? q - 1 : -1, x < w - 1 ? q + 1 : -1, q - w, q + w]) if (n >= 0 && n < w * h && r.nyilas[n] && !latott[n]) { latott[n] = 1; komp.push(n); }
    }
    const szx = (x1 - x0 + 1) * px, szy = (y1 - y0 + 1) * px;
    const fuggo = szy > szx; const L = Math.max(szx, szy), v = Math.min(szx, szy);
    if (L < 0.5 || L > 6 || v > 0.9) continue;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, fel = v / 2 / px + 0.35 / px;
    const oldal = (jel: number) => {
      const c = [0.25, 0.5, 0.75].map((t) => (fuggo ? cimke(cx + jel * fel, y0 + (y1 - y0) * t) : cimke(x0 + (x1 - x0) * t, cy + jel * fel)));
      const hh = c.filter((q) => q >= 2); if (hh.length >= 2) return hh[0]!;
      return c.filter((q) => q === 1).length >= 2 ? 1 : -1;
    };
    const a = oldal(-1), b = oldal(1);
    if (!((a >= 2 && b === 1) || (b >= 2 && a === 1))) continue;
    const X = lapX(cx + 0.5), Y = lapY(cy + 0.5), fl = (L / 2 + 0.3) / r.mPerPt, ke = 1.5 / r.mPerPt;
    // (a feliratos nyílás teljes szélességével: a nyílás tokosztással, áthidalóval két foltra bomló része sem külön nyílás)
    if (meglevo.some((n) => { const fl2 = fl + (n.szel ?? 0) / 2 / r.mPerPt; return n.kulso && (fuggo ? Math.abs(n.x - X) < ke && Math.abs(n.y - Y) < fl2 : Math.abs(n.y - Y) < ke && Math.abs(n.x - X) < fl2); })) continue;
    if (r.uvegfalak.some((g) => g.fuggo === fuggo && (fuggo ? Math.abs((g.x0 + g.x1) / 2 - X) < ke && Y > g.y0 && Y < g.y1 : Math.abs((g.y0 + g.y1) / 2 - Y) < ke && X > g.x0 && X < g.x1))) continue;
    const helyiseg = (a >= 2 ? a : b) - 2;
    const irany = fuggo ? (a === 1 ? 270 : 90) : (a === 1 ? 0 : 180);
    ki.push({ szel: Math.round(L * 100) / 100, mag: 0, pm: null, x: X, y: Y, helyiseg, irany, kulso: true, fajta: 'ablak', mert: { magForras: 'becsult' }, hely: [lapX(x0), lapY(y0), lapX(x1 + 1), lapY(y1 + 1)] });
  }
  // ugyanannak a nyílásnak a falsávon belül egymás mellett / mögött futó foltjai (tok, üvegezés, párkány vonalai): azonos
  // helyiség és irány, a fal mentén átfedő (≤ 0,2 m réssel) és a falra merőlegesen ≤ 0,6 m-re lévő foltok egy nyílás
  const tol = 0.2 / r.mPerPt, mer = 0.6 / r.mPerPt;
  for (let i = ki.length - 1; i >= 0; i--) {
    const a = ki[i]!, ha = a.hely!; const fa = ha[3] - ha[1] > ha[2] - ha[0];
    const j = ki.findIndex((b, k) => {
      if (k === i || b.helyiseg !== a.helyiseg || b.irany !== a.irany) return false;
      const hb = b.hely!; if ((hb[3] - hb[1] > hb[2] - hb[0]) !== fa) return false;
      return fa ? hb[1] - tol <= ha[3] && ha[1] - tol <= hb[3] && Math.abs((ha[0] + ha[2]) / 2 - (hb[0] + hb[2]) / 2) <= mer
        : hb[0] - tol <= ha[2] && ha[0] - tol <= hb[2] && Math.abs((ha[1] + ha[3]) / 2 - (hb[1] + hb[3]) / 2) <= mer;
    });
    if (j < 0) continue;
    const b = ki[j]!, hb = b.hely!;
    const h: [number, number, number, number] = [Math.min(ha[0], hb[0]), Math.min(ha[1], hb[1]), Math.max(ha[2], hb[2]), Math.max(ha[3], hb[3])];
    const L = (fa ? h[3] - h[1] : h[2] - h[0]) * r.mPerPt;
    ki[j] = { ...b, szel: Math.round(Math.min(L, Math.max(a.szel, b.szel) + 0.3) * 100) / 100, x: (h[0] + h[2]) / 2, y: (h[1] + h[3]) / 2, hely: h };
    ki.splice(i, 1);
  }
  return ki;
}

/** Tetősík ablak az alaprajzon: a ferde tetőben, a helyiség fölött rajzolt, átlósan áthúzott (X) téglalap. */
export interface TetoablakJel {
  /** A raszter helyiségindexe (a jel középpontja alatti helyiség). */
  helyiseg: number;
  /** Méret (m): a felirat szerint, ennek híján a jelből (a ferde hossz becsült). */
  szel: number; mag: number; pm: number | null;
  /** A tetősík lejtésének iránya a lapon (0 / 90 / 180 / 270): a jel hossztengelyén a közelebbi külső fal felé. */
  irany: number;
  /** A tető hajlásszöge a jel vetületi hosszából és a felirat szerinti hosszból (fok), ha van felirat. */
  hajlas?: number;
  x: number; y: number;
  /** Felirat nélkül, a jel méretéből becsült. */
  becsult?: boolean;
}

const TETO_RETEG = /tet[őo]|roof|h[ée]jal|ablak|window|ny[ií]l[aá]sz[aá]r[oó]|tet[őo]ablak|velux|fakro/i;

/**
 * Tetősík ablakok az alaprajzon: tengelyirányú, zárt téglalap (0,4–1,4 × 0,5–2,0 m), amelyet mindkét átlója mentén
 * vonalak húznak át (X – a tetőablak szokásos jele, a kémény, akna is ilyen, ezért: rétegzett rajzon a tető- vagy
 * nyílászáró-rétegen, rétegek nélkül csak a jel szélességével egyező méretfelirattal). A jel középpontja helyiségben
 * (vagy ≤ 1 m-re tőle). Méret: a jel mellett (≤ 3 m) a jel szélességével (± 12 cm) egyező szám és a mellette (egymás
 * mellett / alatt) álló, legalább a jel vetületi hosszát kiadó szám (cm-ben vagy méterben: „78” / „1,40”);
 * mellvéd: a közeli „P 1,54”, „pm 1,54”.
 */
export function tetoablakJelek(lap: Lap, r: Raszter): TetoablakJel[] {
  const m = r.mPerPt; if (!m) return [];
  const reteges = lap.utvonalak.some((u) => u.reteg);
  const atlok: { x1: number; y1: number; x2: number; y2: number; bb: number[] }[] = [];
  const teglak: { b: number[]; reteg?: string }[] = [];
  for (const u of lap.utvonalak) {
    for (const p of u.pontok) {
      const n = p.length / 2;
      for (let i = 0; i + 3 < p.length; i += 2) {
        const x1 = p[i]!, y1 = p[i + 1]!, x2 = p[i + 2]!, y2 = p[i + 3]!;
        const dx = Math.abs(x2 - x1), dy = Math.abs(y2 - y1);
        if (dx > 0.5 && dy > 0.5 && dx * m < 2.2 && dy * m < 2.2) atlok.push({ x1, y1, x2, y2, bb: [Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)] });
      }
      // zárt, tengelyirányú négyszög (4 csúcs, ill. 5 a záró ponttal)
      if (n !== 4 && n !== 5) continue;
      const xs = new Set<number>(), ys = new Set<number>(); let jo = true;
      for (let i = 0; i < 4; i++) { xs.add(Math.round(p[2 * i]! * 4) / 4); ys.add(Math.round(p[2 * i + 1]! * 4) / 4); }
      for (let i = 0; i < n - 1 && jo; i++) { const dx = Math.abs(p[2 * i + 2]! - p[2 * i]!), dy = Math.abs(p[2 * i + 3]! - p[2 * i + 1]!); if (dx > 0.3 && dy > 0.3) jo = false; }
      if (!jo || xs.size !== 2 || ys.size !== 2) continue;
      const b = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
      const a = (b[2]! - b[0]!) * m, c = (b[3]! - b[1]!) * m;
      if (Math.min(a, c) < 0.4 || Math.min(a, c) > 1.4 || Math.max(a, c) < 0.5 || Math.max(a, c) > 2.0 || Math.max(a, c) / Math.min(a, c) > 3) continue;
      teglak.push({ b, reteg: u.reteg });
    }
  }
  // átlós jel a kereten belül: X (két átló) vagy a lejtés irányába mutató nyíl / kettős V – legalább egy-egy emelkedő és
  // eső ferde vonal (a rövidebb oldal ≥ 40 %-ának megfelelő vetülettel), de legfeljebb 8 (a sraffozás sűrű és egyirányú)
  const fedett = (b: number[]) => {
    const tol = 1.0, rov = Math.min(b[2]! - b[0]!, b[3]! - b[1]!);
    const bent = atlok.filter((s) => s.bb[0]! >= b[0]! - tol && s.bb[2]! <= b[2]! + tol && s.bb[1]! >= b[1]! - tol && s.bb[3]! <= b[3]! + tol && Math.max(s.bb[2]! - s.bb[0]!, s.bb[3]! - s.bb[1]!) >= 0.4 * rov);
    if (bent.length < 2 || bent.length > 8) return false;
    const emel = bent.filter((s) => (s.x2 - s.x1) * (s.y2 - s.y1) > 0).length;
    return emel >= 1 && bent.length - emel >= 1;
  };
  const jelek: { b: number[]; reteg?: string }[] = [];
  // harmadik alak: üres, szaggatott keret a helyiség belsejében, benne / mellette a nyílás típusjelével („AB-16”)
  const TJ = /^[A-ZÁÉ]{1,3}\s*[-–]\s*\d{1,3}[A-Z]?$/i;
  const tjek = lap.szovegek.filter((t) => TJ.test(t.s.trim())).map((t) => geom(t));
  const ptPx0 = m / r.px;
  const kodos = (b: number[]) => {
    const e = 0.3 / m;
    if (!tjek.some((g) => g.cx >= b[0]! - e && g.cx <= b[2]! + e && g.cy >= b[1]! - e && g.cy <= b[3]! + e)) return false;
    // a keret teljesen helyiségben, falpixel nélkül (nem falban lévő nyílás, nem a tetőfelülnézet)
    const x0 = Math.floor((b[0]! - r.x0) * ptPx0), x1 = Math.ceil((b[2]! - r.x0) * ptPx0), y0 = Math.floor((b[1]! - r.y0) * ptPx0), y1 = Math.ceil((b[3]! - r.y0) * ptPx0);
    if (x0 < 0 || y0 < 0 || x1 >= r.w || y1 >= r.h) return false;
    // a keretben lévő helyiség (a többségi címke: a jel közepén a típusjel felirata takarhat)
    const db = new Map<number, number>();
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const c = r.cimke[y * r.w + x]!; if (c >= 2) db.set(c, (db.get(c) ?? 0) + 1); }
    if (db.size !== 1) return false;
    const [h0, hdb] = [...db.entries()][0]!; if (hdb < 0.25 * (x1 - x0 + 1) * (y1 - y0 + 1)) return false; // a keret vonalai, a felirat és a közeli rajzi vonalak tintája nem helyiségpixel
    // a tetőablak vetülete a térdfalra is átnyúlhat: a falpixel legfeljebb a keret harmada, más helyiség nem lehet benne
    let falpx = 0, ossz = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const c = r.cimke[y * r.w + x]!; ossz++; if (r.fal[y * r.w + x]) falpx++; else if (c >= 2 && c !== h0) return false; }
    if (falpx > ossz / 3) return false;
    return true;
  };
  const kodosak = new Set<number[]>(), szaggatott = new Set<number[]>();
  // szaggatott keret (darabokra bontott vonalakból): rövid, tengelyirányú darabokból összefűzött szaggatott vonalak,
  // a típusjelet körülvevő legkisebb, négy ilyen vonalból álló négyszög
  {
    type D = { k: number; a: number; b: number; db: number };
    const vizsz: D[] = [], fugg: D[] = [];
    const nyers: { f: boolean; k: number; a: number; b: number }[] = [];
    for (const u of lap.utvonalak) for (const p of u.pontok) for (let i = 0; i + 3 < p.length; i += 2) {
      const x1 = p[i]!, y1 = p[i + 1]!, x2 = p[i + 2]!, y2 = p[i + 3]!, L = Math.hypot(x2 - x1, y2 - y1) * m;
      if (L < 0.01 || L > 0.2) continue;
      if (Math.abs(y2 - y1) < 0.02 * Math.abs(x2 - x1)) nyers.push({ f: false, k: (y1 + y2) / 2, a: Math.min(x1, x2), b: Math.max(x1, x2) });
      else if (Math.abs(x2 - x1) < 0.02 * Math.abs(y2 - y1)) nyers.push({ f: true, k: (x1 + x2) / 2, a: Math.min(y1, y2), b: Math.max(y1, y2) });
    }
    const hez = 0.12 / m, kt = 0.3;
    for (const f of [false, true]) {
      const sor = nyers.filter((q) => q.f === f).sort((p1, p2) => p1.k - p2.k || p1.a - p2.a);
      const cel = f ? fugg : vizsz; const nyitott: D[] = [];
      for (const q of sor) {
        const d = nyitott.find((x) => Math.abs(x.k - q.k) < kt && q.a - x.b < hez && q.a >= x.a - hez);
        if (d) { d.b = Math.max(d.b, q.b); d.db++; } else { const n = { k: q.k, a: q.a, b: q.b, db: 1 }; nyitott.push(n); cel.push(n); }
      }
    }
    const vonal = (l: D[]) => l.filter((x) => x.db >= 4);
    const V = vonal(vizsz), F = vonal(fugg);
    // két egyforma, párhuzamos szaggatott vonal a jel két oldalán (a keret másik két oldalát más vonal takarhatja)
    const egyezik = (p1: D, p2: D) => Math.abs(p1.a - p2.a) * m < 0.05 && Math.abs(p1.b - p2.b) * m < 0.05;
    for (const g of tjek) {
      let b: number[] | null = null;
      for (const f of [true, false]) {
        const L = f ? F : V, kc = f ? g.cx : g.cy, ac = f ? g.cy : g.cx;
        const elo = L.filter((x) => x.k < kc && x.a <= ac && x.b >= ac).sort((p1, p2) => p2.k - p1.k)[0];
        const uta = L.filter((x) => x.k > kc && x.a <= ac && x.b >= ac).sort((p1, p2) => p1.k - p2.k)[0];
        if (!elo || !uta || !egyezik(elo, uta)) continue;
        b = f ? [elo.k, Math.min(elo.a, uta.a), uta.k, Math.max(elo.b, uta.b)] : [Math.min(elo.a, uta.a), elo.k, Math.max(elo.b, uta.b), uta.k];
        break;
      }
      if (!b) continue;
      const a = (b[2]! - b[0]!) * m, c = (b[3]! - b[1]!) * m;
      if (Math.min(a, c) < 0.4 || Math.min(a, c) > 1.4 || Math.max(a, c) < 0.5 || Math.max(a, c) > 2.0) continue;
      if (teglak.some((x) => Math.abs(x.b[0]! - b![0]!) * m < 0.1 && Math.abs(x.b[1]! - b![1]!) * m < 0.1)) continue;
      teglak.push({ b }); szaggatott.add(b);
    }
  }
  for (const t of teglak) {
    if (!fedett(t.b)) { if (!szaggatott.has(t.b) || !kodos(t.b)) continue; kodosak.add(t.b); }
    // egymásba rajzolt keretek (tok, szárny): a legkülső marad
    const cx = (t.b[0]! + t.b[2]!) / 2, cy = (t.b[1]! + t.b[3]!) / 2;
    const i = jelek.findIndex((j) => Math.hypot((j.b[0]! + j.b[2]!) / 2 - cx, (j.b[1]! + j.b[3]!) / 2 - cy) * m < 0.15);
    if (i < 0) jelek.push(t);
    else if ((t.b[2]! - t.b[0]!) * (t.b[3]! - t.b[1]!) > (jelek[i]!.b[2]! - jelek[i]!.b[0]!) * (jelek[i]!.b[3]! - jelek[i]!.b[1]!)) jelek[i] = { b: t.b, reteg: t.reteg ?? jelek[i]!.reteg };
    else if (!jelek[i]!.reteg && t.reteg) jelek[i]!.reteg = t.reteg;
  }
  const szamErt = (s: string) => { const v = s.trim(); return /^\d,\d{2}$/.test(v) ? Number(v.replace(',', '.')) : /^\d{2,3}$/.test(v) ? Number(v) / 100 : null; };
  const szamok = lap.szovegek.map((t) => ({ t, v: szamErt(t.s) })).filter((x) => x.v !== null) as { t: Szoveg; v: number }[];
  const pmek = lap.szovegek.map((t) => ({ t, mm: PM.exec(szovegJavit(t.s)) })).filter((x) => x.mm);
  const ki: TetoablakJel[] = [];
  const ptPx = m / r.px;
  for (const j of jelek) {
    const [x0, y0, x1, y1] = j.b as [number, number, number, number];
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const fuggo = y1 - y0 >= x1 - x0; // a hossztengely a lapon függőleges
    const rovid = Math.min(x1 - x0, y1 - y0) * m, hosszu = Math.max(x1 - x0, y1 - y0) * m;
    // felirat: a jel szélességét adó szám és a mellette álló hossz
    let felirat: { szel: number; mag: number; x: number; y: number } | null = null; let leg = 3 / m;
    for (const a of szamok) {
      if (Math.abs(a.v - rovid) > 0.12) continue;
      const ga = geom(a.t); const d = Math.hypot(ga.cx - cx, ga.cy - cy); if (d > leg) continue;
      const b = szamok.find((q) => {
        if (q === a || Math.abs(q.t.szog - a.t.szog) > 2 || q.v < Math.max(0.8, hosszu * 0.9) || q.v > 2.0) return false;
        const gb = geom(q.t); const dx = gb.cx - ga.cx, dy = gb.cy - ga.cy;
        const menti = Math.abs(dx * ga.dir[0] + dy * ga.dir[1]), perp = Math.abs(dx * ga.fel[0] + dy * ga.fel[1]);
        return menti <= a.t.meret * 1.0 && perp >= a.t.meret * 0.8 && perp <= a.t.meret * 1.9;
      });
      if (!b) continue;
      leg = d; felirat = { szel: a.v, mag: b.v, x: ga.cx, y: ga.cy };
    }
    if (!kodosak.has(j.b) && (reteges ? !(j.reteg && TETO_RETEG.test(j.reteg)) && !felirat : !felirat)) continue;
    // helyiség: a jel középpontja alatt, ennek híján a legközelebbi helyiségpixel (≤ 1 m)
    const gx = Math.round((cx - r.x0) * ptPx), gy = Math.round((cy - r.y0) * ptPx);
    let h = -1;
    if (gx >= 0 && gy >= 0 && gx < r.w && gy < r.h && r.cimke[gy * r.w + gx]! >= 2) h = r.cimke[gy * r.w + gx]! - 2;
    else {
      const R = Math.round(1 / r.px); let d0 = Infinity;
      for (let y = Math.max(0, gy - R); y <= Math.min(r.h - 1, gy + R); y++) for (let x = Math.max(0, gx - R); x <= Math.min(r.w - 1, gx + R); x++) {
        const c = r.cimke[y * r.w + x]!; const d = (x - gx) ** 2 + (y - gy) ** 2; if (c >= 2 && d < d0) { d0 = d; h = c - 2; }
      }
    }
    if (h < 0 || !r.helyisegek[h]) continue;
    // lejtésirány: a hossztengely két vége közül a helyiség közelebbi külső fala felé
    const iranyok = fuggo ? [0, 180] : [90, 270];
    let irany = iranyok[0]!, dMin = Infinity;
    for (const s of r.helyisegek[h]!.szakaszok) {
      if (s.tul !== 'kulso' || !iranyok.includes(s.irany)) continue;
      for (const q of s.pontok) { const d = fuggo ? Math.abs(q[1] - cy) : Math.abs(q[0] - cx); if (d < dMin) { dMin = d; irany = s.irany; } }
    }
    const pmJ = pmek.map((x) => ({ x, d: Math.hypot(geom(x.t).cx - cx, geom(x.t).cy - cy) * m })).filter((x) => x.d <= 3).sort((a, b) => a.d - b.d)[0];
    const pm = pmJ ? pmErtek(pmJ.x.mm![1]!, pmJ.x.mm![2]) : null;
    const szel = felirat ? felirat.szel : Math.round(rovid * 100) / 100;
    const mag = felirat ? felirat.mag : Math.round(hosszu / Math.cos(Math.PI / 4) * 100) / 100;
    const hajlas = felirat && hosszu < felirat.mag ? Math.round(Math.acos(hosszu / felirat.mag) * 180 / Math.PI) : undefined;
    ki.push({ helyiseg: h, szel, mag, pm, irany, ...(hajlas ? { hajlas } : {}), x: cx, y: cy, ...(felirat ? {} : { becsult: true }) });
  }
  return ki;
}
