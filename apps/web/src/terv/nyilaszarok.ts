/**
 * Nyílászárók felismerése (4. kör): a nyílásméret-feliratok (két egymás alatti szám: szélesség / magasság, cm;
 * mellette „pm 90” mellvédmagasság) párosítása a falnyílásokkal, helyiséghez és homlokzati irányhoz rendelése.
 */
import type { Szoveg } from './kinyeres';
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
  fajta: 'ablak' | 'erkelyajto' | 'bejarati_ajto' | 'garazskapu' | 'belso_ajto';
}

const SZAM = /^\d{2,3}$/;
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
  const szamok = sz.filter((t) => SZAM.test(t.s.trim()) && Number(t.s) >= 30 && Number(t.s) <= 600);
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
    let szel = Number(felso.s) / 100, mag = Number(also.s) / 100;
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
 * A feliratokat a raszter nyílásaihoz rendeli: a felirathoz legközelebbi áthidalt nyílás (≤ 1,3 m), majd a nyílás
 * előtti helyiségfal-szakasz adja a helyiséget és a homlokzat irányát; ha a szakasz túloldala külső tér, a nyílás külső.
 */
export function nyilasokHozzarendel(feliratok: NyilasFelirat[], r: Raszter, nevek: string[] = [], tipusLap = false): TervNyilas[] {
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
    const kapu = kulso && f.pm === null && f.mag >= 1.8 && (f.kapuJelolt || (garazsban && f.szel >= 1.8) || f.szel >= 2.2);
    const fajta: TervNyilas['fajta'] = kapu ? 'garazskapu' : !kulso ? 'belso_ajto' : f.pm !== null && f.pm > 0.05 ? 'ablak' : f.pm !== null ? 'erkelyajto' : f.mag >= 1.9 ? (tipusLap ? 'erkelyajto' : 'bejarati_ajto') : 'ablak';
    ki.push({ ...f, helyiseg: p?.h ?? null, irany: p?.irany ?? null, kulso, fajta });
  }
  return ki;
}
