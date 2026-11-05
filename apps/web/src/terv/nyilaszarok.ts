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
  /** Mellvéd nélküli, méterben (vegyesen) írt ajtóméret-pár: csak külső falnyíláshoz kötve fogadjuk el. */ ajtoJelolt?: boolean }

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
    const gb = geom(legjobb.b);
    mHasznalt.add(a); mHasznalt.add(legjobb.b);
    ki.push({ szel: w, mag: h, pm: null, x: (ga.cx + gb.cx) / 2, y: (ga.cy + gb.cy) / 2, fal: Math.abs(ga.fel[0]) >= Math.abs(ga.fel[1]) ? 'v' : 'f', kapuJelolt: true });
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
export function nyilasokHozzarendel(feliratok: NyilasFelirat[], r: Raszter, nevek: string[] = [], tipusLap = false): TervNyilas[] {
  const LAKO = /nappali|szoba|háló|halo\b|konyha|étkez|etkez|dolgozó|gyerek|living/i;
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
      let p: { h: number; irany: number; kulso: boolean } | null = null;
      // a nyílásfolt irányára merőleges átnézés előbb (vízszintes folt: fel / le)
      const iranyok = ([[0, -1, 0], [1, 0, 90], [0, 1, 180], [-1, 0, 270]] as const).slice().sort((a, b) => (v === undefined ? 0 : Number((a[0] === 0) !== v) - Number((b[0] === 0) !== v)));
      // a folt egyértelműen hosszúkás (a hossza ≥ 2 × vastagsága): a rá merőleges átnézés a nyílás valódi átjárása – ha
      // ott két különböző helyiség van, belső nyílás (a homlokzati fal mellé eső belső ajtó nem lesz külső)
      const hosszukas = v !== undefined && Math.max(hf[best]!, vf[best]!) >= 2 * Math.min(hf[best]!, vf[best]!);
      for (const [n, [dx, dy, ir]] of iranyok.entries()) {
        const elol = talal(dx, dy), hatul = talal(-dx, -dy);
        if (n === 0 && hosszukas && hatul >= 2 && elol >= 2 && elol !== hatul) { p = { h: hatul - 2, irany: ir, kulso: false }; break; }
        // a helyiségből (hátul) a nyíláson át kifelé (elöl) nézünk
        if (hatul >= 2 && elol === 1) { p = { h: hatul - 2, irany: ir, kulso: true }; break; }
        if (hatul >= 2 && elol >= 2 && elol !== hatul && !p) p = { h: hatul - 2, irany: ir, kulso: false };
      }
      return p;
    };
    // az első olyan folt, amely helyiséghez tartozik (a járdaszegély, kerítés „nyílásai” kiesnek)
    let p: { h: number; irany: number; kulso: boolean } | null = null;
    let elteroIrany = false; let folt = 0;
    for (const [, { i, v }] of jeloltek.slice(0, 6)) { p = vizsgal(i, v); if (p) { elteroIrany = v !== (f.fal === 'v'); folt = komp[i]!; break; } }
    // ajtófelirat, de csak a feliratra merőleges falban találtunk nyílást (az ajtónyílás nincs áthidalva, pl. fedett
    // terasz felé nyíló bejárat): a felirat irányával egyező, közeli (≤ 1 m) külső falszakasz előbb
    if (p && elteroIrany && f.pm === null && f.mag >= 1.9) {
      let leg: { h: number; irany: number; d: number } | null = null;
      r.helyisegek.forEach((H, h) => H.szakaszok.forEach((s) => {
        if (s.tul !== 'kulso' || ((s.irany === 0 || s.irany === 180) !== (f.fal === 'v'))) return;
        for (const q of s.pontok) { const d = Math.hypot(q[0] - f.x, q[1] - f.y) * r.mPerPt; if (d < 1.0 && (!leg || d < leg.d)) leg = { h, irany: s.irany, d }; }
      }));
      if (leg) p = { h: (leg as { h: number }).h, irany: (leg as { irany: number }).irany, kulso: true };
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
      if (leg) p = { h: (leg as { h: number }).h, irany: (leg as { irany: number }).irany, kulso: true };
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
    ki.push({ ...f, helyiseg: p?.h ?? null, irany: p?.irany ?? null, kulso, fajta, ...(folt && !elteroIrany ? { hely: kompHely(folt) } : {}) });
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
  return ki;
}
