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
}

/** Nyílásméret cm-ben; a „+30” toldás (redőnytok, tokszélesítés) a magasság mellett – a nyílásméret az első szám. */
const SZAM = /^\d{2,3}(?:\s*\+\s*\d{1,3})?$/;
const szamCm = (s: string) => Number(s.trim().split('+')[0]);
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

export interface NyilasFelirat { szel: number; mag: number; pm: number | null; x: number; y: number; /** A fal iránya a lapon: vízszintes / függőleges. */ fal: 'v' | 'f'; /** Méterben írt, kapuméretű feliratpár: csak garázs jellegű helyiségben, falnyíláshoz kötve fogadjuk el. */ kapuJelolt?: boolean }

export function nyilasFeliratok(sz: Szoveg[]): NyilasFelirat[] {
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
    if (pm) pmHasznalt.add(pm.t);
    hasznalt.add(a); hasznalt.add(legjobb.b);
    let szel = szamCm(felso.s) / 100, mag = szamCm(also.s) / 100;
    // ajtó felcserélt sorrendben („240 / 90”): mellvéd nélkül, ajtómagasságú felső és ajtószélességű alsó szám
    if (!pm && szel >= 1.9 && mag <= 1.2) [szel, mag] = [mag, szel];
    ki.push({ szel, mag, pm: pm ? pmErtek(pm.m![1]!, pm.m![2]) : null, x, y, fal: Math.abs(ga.fel[0]) >= Math.abs(ga.fel[1]) ? 'v' : 'f' });
  }
  // méterben írt kapuméretek (szélesség ≥ 1,8 m, magasság 1,8–3,2 m) – a méretláncok számaitól a hozzárendelés választja el
  const mSzamok = sz.filter((t) => SZAM_M.test(t.s.trim()) && mSzam(t.s) >= 1.8 && mSzam(t.s) <= 6);
  const mHasznalt = new Set<Szoveg>();
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
    if (h < 1.8 || h > 3.2) continue;
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
  const ki: TervNyilas[] = [];
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
    const vizsgal = (best: number) => {
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
      for (const [dx, dy, ir] of [[0, -1, 0], [1, 0, 90], [0, 1, 180], [-1, 0, 270]] as const) {
        const elol = talal(dx, dy), hatul = talal(-dx, -dy);
        // a helyiségből (hátul) a nyíláson át kifelé (elöl) nézünk
        if (hatul >= 2 && elol === 1) { p = { h: hatul - 2, irany: ir, kulso: true }; break; }
        if (hatul >= 2 && elol >= 2 && elol !== hatul && !p) p = { h: hatul - 2, irany: ir, kulso: false };
      }
      return p;
    };
    // az első olyan folt, amely helyiséghez tartozik (a járdaszegély, kerítés „nyílásai” kiesnek)
    let p: { h: number; irany: number; kulso: boolean } | null = null;
    for (const [, { i }] of jeloltek.slice(0, 6)) { p = vizsgal(i); if (p) break; }
    if (!p) {
      // ha a nyílás nincs áthidalva (pl. a tok, üvegezés kitöltése falként zárja), a felirathoz legközelebbi,
      // a felirat irányával egyező külső falszakasz adja a helyiséget és a homlokzatot
      let leg: { h: number; irany: number; d: number } | null = null;
      r.helyisegek.forEach((H, h) => H.szakaszok.forEach((s) => {
        if (s.tul !== 'kulso' || ((s.irany === 0 || s.irany === 180) !== (f.fal === 'v'))) return;
        for (const q of s.pontok) { const d = Math.hypot(q[0] - f.x, q[1] - f.y) * r.mPerPt; if (d < 1.6 && (!leg || d < leg.d)) leg = { h, irany: s.irany, d }; }
      }));
      if (leg) p = { h: (leg as { h: number }).h, irany: (leg as { irany: number }).irany, kulso: true };
    }
    if (!jeloltek.length && !p) continue;
    const kulso = !!p?.kulso;
    const garazsban = p ? GARAZS.test(nevek[p.h] ?? '') : false;
    // méterben írt kapupár: csak falnyíláshoz kötve, garázsban (vagy nagyon széles nyílásnál) – különben méretlánc-részlet
    if (f.kapuJelolt && !(p && kulso && (garazsban || f.szel >= 2.2))) continue;
    // feliratozott mellvédű tervben a mellvéd nélküli, ajtómagasságnál alacsonyabb „nyílás” valójában méretlánc-részlet
    if (vanPm && f.pm === null && f.mag < 1.9) continue;
    // lakóhelyiség (nappali, szoba, konyha) külső ajtaja erkély- / teraszajtó (a széles is: tolóajtó), nem bejárati ajtó és nem kapu
    const lako = p ? LAKO.test(nevek[p.h] ?? '') : false;
    const kapu = kulso && f.pm === null && f.mag >= 1.8 && (garazsban ? f.kapuJelolt || f.szel >= 1.8 : !lako && f.kapuJelolt && f.szel >= 2.2);
    const fajta: TervNyilas['fajta'] = kapu ? 'garazskapu' : !kulso ? 'belso_ajto' : f.pm !== null && f.pm > 0.05 ? 'ablak' : f.pm !== null ? 'erkelyajto' : f.mag >= 1.9 ? (tipusLap || lako ? 'erkelyajto' : 'bejarati_ajto') : 'ablak';
    ki.push({ ...f, helyiseg: p?.h ?? null, irany: p?.irany ?? null, kulso, fajta });
  }
  return ki;
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
    ki.push({ szel: Math.round(g.hossz * 100) / 100, mag: 0, pm: 0, x: cx, y: cy, helyiseg, irany, kulso: true, fajta: 'fuggonyfal' });
  }
  return ki;
}
