/**
 * Tetőforma a felülnézetből (helyszínrajz, tetőfelülnézet): a tetősíkok metszésvonalai – az élgerinc (konty) és a vápa a
 * főirányokhoz képest 45°-os, a gerinc a főirányban fut. Egy gerinc két vége: élgerincek találkozása (konty / vápa), vagy
 * szabad vég az ereszvonalon (oromzat – nyeregtető vége). A felülnézetből így biztosabban eldől, hogy a tető végei
 * kontyoltak-e, mint a homlokzat körvonalából (a kontylap oldalnézetben háromszög, mint az oromzat).
 */
import type { Lap } from './kinyeres';

export interface TetoFelulnezet {
  /** a tető főiránya a lapon (fok, 0–90) */
  tengely: number;
  /** kontyolt végek (élgerinc-pár találkozása a gerinc végén) száma */
  konty: number;
  /** gerincvég élgerinc nélkül (oromzat) */
  orom: number;
  /** a végek iránya a lapon (fok, 0 = jobbra, 90 = lefelé – a lap y-tengelye szerint): kontyolt vég, ill. oromzat */
  vegek: { hely: [number, number]; irany: number; fajta: 'konty' | 'orom'; csoport: number }[];
  /** összefüggő tetők (pl. a szomszéd épületeké is): befoglaló (pt) */
  csoportok: { x0: number; y0: number; x1: number; y1: number }[];
  /** a felismert gerincek és élgerincek (lapkoordináta, pt) – megjelenítéshez */
  gerincek: [number, number, number, number][];
  elgerincek: [number, number, number, number][];
}

type Sz = { x0: number; y0: number; x1: number; y1: number; L: number; a: number; reteg: string };

export function tetoFelulnezet(lap: Lap): TetoFelulnezet | null {
  const sz: Sz[] = [];
  for (const u of lap.utvonalak) {
    if (u.muvelet !== 'stroke' && u.muvelet !== 'fillStroke') continue;
    for (const p of u.pontok) for (let i = 0; i + 3 < p.length; i += 2) {
      const x0 = p[i]!, y0 = p[i + 1]!, x1 = p[i + 2]!, y1 = p[i + 3]!, L = Math.hypot(x1 - x0, y1 - y0);
      if (L < 15) continue;
      sz.push({ x0, y0, x1, y1, L, a: (((Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI) + 180) % 180, reteg: u.reteg ?? '' });
    }
  }
  if (sz.length < 6) return null;
  // főirány: az élgerincpárok (egymásra merőleges 45°-os szakaszok, közös végponttal) iránya – minden szögre próbálva
  const kozos = (p: Sz, q: Sz, tol: number) => {
    const P = [[p.x0, p.y0], [p.x1, p.y1]], Q = [[q.x0, q.y0], [q.x1, q.y1]];
    for (const a of P) for (const b of Q) if (Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!) <= tol) return a as [number, number];
    return null;
  };
  const tol = 2;
  // V alakú párok: két szakasz közös végponttal, egymásra merőlegesen (± 4°)
  const csucsok: { p: [number, number]; a: Sz; b: Sz }[] = [];
  const racs = new Map<string, number[]>(); const kulcs = (x: number, y: number) => `${Math.round(x / 4)}|${Math.round(y / 4)}`;
  sz.forEach((s, i) => { for (const [x, y] of [[s.x0, s.y0], [s.x1, s.y1]]) for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { const k = `${Math.round(x! / 4) + dx}|${Math.round(y! / 4) + dy}`; const l = racs.get(k) ?? []; l.push(i); racs.set(k, l); } });
  for (let i = 0; i < sz.length; i++) {
    const s = sz[i]!;
    for (const [x, y] of [[s.x0, s.y0], [s.x1, s.y1]]) for (const j of racs.get(kulcs(x!, y!)) ?? []) {
      if (j <= i) continue; const t = sz[j]!;
      const d = Math.abs(((s.a - t.a) % 180 + 180) % 180 - 90); if (d > 4) continue;
      const p = kozos(s, t, tol); if (p) csucsok.push({ p, a: s, b: t });
    }
  }
  if (!csucsok.length) return nyeregteto(sz);
  // a főirány: a V-párok szögfelezője (mod 90) – a leggyakoribb
  const hist = new Map<number, number>();
  for (const c of csucsok) { const t = Math.round((((c.a.a + 45) % 90) + 90) % 90); hist.set(t % 90, (hist.get(t % 90) ?? 0) + Math.min(c.a.L, c.b.L)); }
  // (a jelölt főirányok közül az, amelyikben a legtöbb kontyolt gerincvég ismerhető fel)
  let leg: { tengely: number; konty: number; orom: number; gerincek: Set<Sz>; elgerincek: Set<Sz>; hossz: number; vegek: TetoFelulnezet['vegek'] } | null = null;
  for (const tengely of [...hist.entries()].sort((p, q) => q[1] - p[1]).slice(0, 6).map(([t]) => t)) {
    const diag = (s: Sz) => Math.abs(((s.a - tengely - 45) % 90 + 90 + 45) % 90 - 45) <= 4;
    const tengelyMenti = (s: Sz) => { const d = ((s.a - tengely) % 90 + 90) % 90; return Math.min(d, 90 - d) <= 3; };
    // élgerinc-csúcsok: két 45°-os szakasz V-je, és a csúcsból tengelyirányú szakasz (gerinc) indul
    const elgerincek = new Set<Sz>(), gerincek = new Set<Sz>(); const vegek: TetoFelulnezet['vegek'] = [];
    let konty = 0;
    const vegKozel = (s: Sz, p: [number, number]) => Math.hypot(s.x0 - p[0], s.y0 - p[1]) <= tol || Math.hypot(s.x1 - p[0], s.y1 - p[1]) <= tol;
    const csucsLista: [number, number][] = [];
    for (const c of csucsok) {
      if (!diag(c.a) || !diag(c.b)) continue;
      if (csucsLista.some((q) => Math.hypot(q[0] - c.p[0], q[1] - c.p[1]) <= tol)) continue;
      const g = (racs.get(kulcs(c.p[0], c.p[1])) ?? []).map((k) => sz[k]!).filter((s) => tengelyMenti(s) && s.L >= 20 && vegKozel(s, c.p));
      // (a gerinc a V szögfelezőjének irányában, a V-vel ellentétes oldalra indul)
      const vx = (c.a.x0 + c.a.x1) / 2 + (c.b.x0 + c.b.x1) / 2 - 2 * c.p[0], vy = (c.a.y0 + c.a.y1) / 2 + (c.b.y0 + c.b.y1) / 2 - 2 * c.p[1];
      const vl = Math.hypot(vx, vy) || 1;
      const gerinc = g.filter((s) => { const ox = (s.x0 + s.x1) / 2 - c.p[0], oy = (s.y0 + s.y1) / 2 - c.p[1]; return (ox * vx + oy * vy) / (Math.hypot(ox, oy) * vl || 1) < -0.95; }).sort((p, q) => q.L - p.L)[0];
      if (!gerinc) continue;
      // (a V felőli oldalon is induló gerinc: vápacsatlakozás – két tömeg találkozása –, nem kontyolt vég)
      if (g.some((s) => s.L >= 1.2 * Math.max(c.a.L, c.b.L) && (() => { const ox = (s.x0 + s.x1) / 2 - c.p[0], oy = (s.y0 + s.y1) / 2 - c.p[1]; return (ox * vx + oy * vy) / (Math.hypot(ox, oy) * vl || 1) > 0.95; })())) continue;
      csucsLista.push(c.p); konty++; elgerincek.add(c.a); elgerincek.add(c.b); gerincek.add(gerinc);
      vegek.push({ hely: c.p, irany: (((Math.atan2(vy, vx) * 180) / Math.PI) + 360) % 360, fajta: 'konty', csoport: -1 });
    }
    // oromzat: a gerinc másik vége szabad (nem ér élgerinchez / vápához, ill. másik gerinchez)
    let orom = 0;
    for (const g of gerincek) for (const p of [[g.x0, g.y0], [g.x1, g.y1]] as [number, number][]) {
      const kapcs = (racs.get(kulcs(p[0], p[1])) ?? []).map((k) => sz[k]!).filter((s) => s !== g && vegKozel(s, p) && (diag(s) || tengelyMenti(s)));
      // (T-csatlakozás: a gerinc vége egy másik – rá merőleges – gerinc belsejébe fut: a szárny gerince a főtető gerincéhez
      // csatlakozik, ez nem szabad vég – Maschek: a déli szárnyak gerince a főgerincnél nem oromzat)
      const rajtaP = (e: Sz) => { const t = ((p[0] - e.x0) * (e.x1 - e.x0) + (p[1] - e.y0) * (e.y1 - e.y0)) / (e.L * e.L); const d = Math.abs((p[0] - e.x0) * (e.y1 - e.y0) - (p[1] - e.y0) * (e.x1 - e.x0)) / e.L; return t > 0.02 && t < 0.98 && d <= tol; };
      const tBe = sz.some((e) => e !== g && e.L >= 20 && tengelyMenti(e) && Math.abs(((e.a - g.a) % 180 + 180) % 180 - 90) <= 4 && rajtaP(e));
      if (!tBe && !kapcs.some((s) => diag(s)) && !kapcs.some((s) => gerincek.has(s))) { orom++; const q = Math.hypot(g.x0 - p[0], g.y0 - p[1]) < 1 ? [g.x1, g.y1] : [g.x0, g.y0]; vegek.push({ hely: p, irany: (((Math.atan2(p[1] - q[1]!, p[0] - q[0]!) * 180) / Math.PI) + 360) % 360, fajta: 'orom', csoport: -1 }); }
    }

    // (a főirányban fut a rajz zöme – ereszvonal, cserépsraff –; a 45°-kal elforgatott „értelmezés” az ereszsarkokat
    // venné kontynak: a főirányú vonalhossz dönt)
    const hossz = sz.filter(tengelyMenti).reduce((t, x) => t + x.L, 0);
    if (konty && (!leg || hossz > leg.hossz)) leg = { tengely, konty, orom, gerincek, elgerincek, hossz, vegek };
  }
  if (!leg) return nyeregteto(sz);
  const { tengely, konty, orom, gerincek, elgerincek, vegek } = leg;
  // összefüggő tetők: a gerincek és élgerincek közös végpontjai szerint (union–find)
  const elemek = [...gerincek, ...elgerincek], apa = elemek.map((_, i) => i);
  const gy = (i: number): number => (apa[i] === i ? i : (apa[i] = gy(apa[i]!)));
  for (let i = 0; i < elemek.length; i++) for (let j = i + 1; j < elemek.length; j++) if (kozos(elemek[i]!, elemek[j]!, tol) || (() => {
    // (T-csatlakozás: a vápa / élgerinc vége a gerinc belsejében)
    const [p, q] = [elemek[i]!, elemek[j]!];
    const rajta = (e: Sz, x: number, y: number) => { const L = e.L, t = ((x - e.x0) * (e.x1 - e.x0) + (y - e.y0) * (e.y1 - e.y0)) / (L * L); const d = Math.abs((x - e.x0) * (e.y1 - e.y0) - (y - e.y0) * (e.x1 - e.x0)) / L; return t > 0 && t < 1 && d <= tol; };
    return rajta(p, q.x0, q.y0) || rajta(p, q.x1, q.y1) || rajta(q, p.x0, p.y0) || rajta(q, p.x1, p.y1); })()) apa[gy(i)] = gy(j);
  const csopId = new Map<number, number>(); const csoportok: TetoFelulnezet['csoportok'] = [];
  elemek.forEach((e, i) => { const r = gy(i); let c = csopId.get(r); if (c === undefined) { c = csoportok.length; csopId.set(r, c); csoportok.push({ x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }); }
    const b = csoportok[c]!; b.x0 = Math.min(b.x0, e.x0, e.x1); b.y0 = Math.min(b.y0, e.y0, e.y1); b.x1 = Math.max(b.x1, e.x0, e.x1); b.y1 = Math.max(b.y1, e.y0, e.y1); });
  for (const v of vegek) { const i = elemek.findIndex((e) => Math.hypot(e.x0 - v.hely[0], e.y0 - v.hely[1]) <= tol || Math.hypot(e.x1 - v.hely[0], e.y1 - v.hely[1]) <= tol); v.csoport = i >= 0 ? csopId.get(gy(i))! : -1; }
  const ki = (s: Sz) => [s.x0, s.y0, s.x1, s.y1] as [number, number, number, number];
  const eredm: TetoFelulnezet = { tengely, konty, orom, vegek, csoportok, gerincek: [...gerincek].map(ki), elgerincek: [...elgerincek].map(ki) };
  // (a kontyos tetők mellett a lapon lévő nyeregtetők is – a kontyos csoportokkal nem átfedők)
  const ny = nyeregteto(sz);
  if (ny) for (const [k, b] of ny.csoportok.entries()) {
    if (csoportok.some((c) => c.x0 < b.x1 && b.x0 < c.x1 && c.y0 < b.y1 && b.y0 < c.y1)) continue;
    const id = eredm.csoportok.length; eredm.csoportok.push(b);
    for (const v of ny.vegek) if (v.csoport === k) { eredm.vegek.push({ ...v, csoport: id }); eredm.orom++; }
    eredm.gerincek.push(...ny.gerincek.filter((g) => Math.min(g[0], g[2]) >= b.x0 - 1 && Math.max(g[0], g[2]) <= b.x1 + 1 && Math.min(g[1], g[3]) >= b.y0 - 1 && Math.max(g[1], g[3]) <= b.y1 + 1));
  }
  return eredm;
}

/**
 * Nyeregtető a felülnézetben (élgerinc nélkül): a gerinc két, vele párhuzamos, azonos hosszú ereszvonal között, tőlük
 * egyenlő (± 6 %) távolságra fut, és a két vége a gerincre merőleges oromszegélyen van – a két ereszvonal végeit is ez
 * köti össze (zárt téglalap a gerinccel kettéosztva). A gerinc két vége oromzat. (Tata-Nyárfa: a helyszínrajzon a
 * tetősíkok sraffozásával, élgerinc nélkül.) Párhuzamos társnak a gerinc teljes hosszát (≥ 90 %) kísérő, legkülső
 * vonal számít – a cserépsorok (a gerinccel párhuzamos sraffozás) a kettő között vannak.
 */
function nyeregteto(sz: Sz[]): TetoFelulnezet | null {
  const tol = 2;
  const jel = sz.filter((s) => s.L >= 30);
  const talalt: { g: Sz; b: { x0: number; y0: number; x1: number; y1: number }; a: number }[] = [];
  for (const g of jel) {
    const ux = (g.x1 - g.x0) / g.L, uy = (g.y1 - g.y0) / g.L, nx = -uy, ny = ux;
    const dPk: number[] = [], dNk: number[] = [];
    for (const q of jel) {
      if (q === g || Math.abs(((q.a - g.a) % 180 + 180 + 90) % 180 - 90) > 2) continue;
      const t0 = (q.x0 - g.x0) * ux + (q.y0 - g.y0) * uy, t1 = (q.x1 - g.x0) * ux + (q.y1 - g.y0) * uy;
      const lo = Math.min(t0, t1), hi = Math.max(t0, t1);
      if (Math.abs(lo) > 0.06 * g.L || Math.abs(hi - g.L) > 0.06 * g.L) continue;
      const d = ((q.x0 + q.x1) / 2 - g.x0) * nx + ((q.y0 + q.y1) / 2 - g.y0) * ny;
      if (d > 5) dPk.push(d); else if (d < -5) dNk.push(-d);
    }
    // (a két oldal egyenlő távolságú párjai közül a legkülső – az eresz; a kerítés, telekhatár egyik oldalon sem tükrös)
    let dP = 0, dN = 0;
    for (const p of dPk) for (const q of dNk) if (Math.abs(p - q) <= 0.06 * Math.max(p, q) && Math.min(p, q) > Math.min(dP, dN)) { dP = p; dN = q; }
    if (!(dP > 5 && dN > 5)) continue;
    const W = dP + dN; if (g.L < 0.3 * W || g.L > 5 * W) continue;
    // a gerinc két végén merőleges oromszegély, a két ereszvonalig
    // (az oromszegély a gerincnél két darabban is lehet: a darabok uniója fedje az eresztől ereszig tartó szakaszt)
    const veg = (px: number, py: number) => {
      const iv = sz.filter((q) => Math.abs(((q.a - g.a) % 180 + 180) % 180 - 90) <= 2 && Math.abs((px - q.x0) * (q.y1 - q.y0) - (py - q.y0) * (q.x1 - q.x0)) / q.L <= tol)
        .map((q) => { const t0 = (q.x0 - px) * nx + (q.y0 - py) * ny, t1 = (q.x1 - px) * nx + (q.y1 - py) * ny; return [Math.min(t0, t1), Math.max(t0, t1)] as [number, number]; }).sort((p, q) => p[0] - q[0]);
      let v = -dN + 0.1 * W; for (const [lo, hi] of iv) { if (lo > v + tol) break; v = Math.max(v, hi); }
      return v >= dP - 0.1 * W && iv.some(([lo]) => lo <= -dN + 0.1 * W); };
    if (!veg(g.x0, g.y0) || !veg(g.x1, g.y1)) continue;
    // tetőfelület jele mindkét tetősíkon: legalább 6, a gerinccel párhuzamos (cserépsor) vagy rá merőleges (esésvonal)
    // sraffvonal a gerinc és az eresz között – a középvonallal kettéosztott telek, épületkörvonal nem tető
    const sik = (lo: number, hi: number) => sz.filter((q) => {
      if (q === g) return false;
      const d = Math.abs(((q.a - g.a) % 180 + 180) % 180); const par = Math.min(d, 180 - d) <= 3, mer = Math.abs(d - 90) <= 3; if (!par && !mer) return false;
      const t = ((q.x0 + q.x1) / 2 - g.x0) * ux + ((q.y0 + q.y1) / 2 - g.y0) * uy, e = ((q.x0 + q.x1) / 2 - g.x0) * nx + ((q.y0 + q.y1) / 2 - g.y0) * ny;
      return t > 0.05 * g.L && t < 0.95 * g.L && e > lo + 0.08 * (hi - lo) && e < hi - 0.08 * (hi - lo); }).length;
    if (sik(0, dP) < 6 || sik(-dN, 0) < 6) continue;
    // a gerinc nem a sraffozás egyik vonala: mellette (a tetőszélesség 15 %-án belül) nincs vele párhuzamos vonal – a
    // sűrű, egyenközű mintázatban (burkolat, parkolócsík) a középső vonal sem gerinc
    if (sz.some((q) => { if (q === g) return false; const d = Math.abs(((q.a - g.a) % 180 + 180) % 180); if (Math.min(d, 180 - d) > 3) return false;
      const e = Math.abs(((q.x0 + q.x1) / 2 - g.x0) * nx + ((q.y0 + q.y1) / 2 - g.y0) * ny), t = ((q.x0 + q.x1) / 2 - g.x0) * ux + ((q.y0 + q.y1) / 2 - g.y0) * uy;
      return e > 0.3 && e < 0.15 * (dP + dN) && t > 0 && t < g.L; })) continue;
    const P = [[g.x0 + nx * dP, g.y0 + ny * dP], [g.x1 + nx * dP, g.y1 + ny * dP], [g.x0 - nx * dN, g.y0 - ny * dN], [g.x1 - nx * dN, g.y1 - ny * dN]];
    const b = { x0: Math.min(...P.map((q) => q[0]!)), y0: Math.min(...P.map((q) => q[1]!)), x1: Math.max(...P.map((q) => q[0]!)), y1: Math.max(...P.map((q) => q[1]!)) };
    // (ugyanaz a tető – más gerincjelölttel – csak egyszer)
    if (talalt.some((t) => Math.abs(t.b.x0 - b.x0) < 3 && Math.abs(t.b.y0 - b.y0) < 3 && Math.abs(t.b.x1 - b.x1) < 3 && Math.abs(t.b.y1 - b.y1) < 3)) continue;
    talalt.push({ g, b, a: g.a });
  }
  if (!talalt.length) return null;
  const vegek: TetoFelulnezet['vegek'] = [];
  talalt.forEach(({ g }, i) => {
    const ir = ((Math.atan2(g.y1 - g.y0, g.x1 - g.x0) * 180) / Math.PI + 360) % 360;
    vegek.push({ hely: [g.x1, g.y1], irany: ir, fajta: 'orom', csoport: i }, { hely: [g.x0, g.y0], irany: (ir + 180) % 360, fajta: 'orom', csoport: i });
  });
  return { tengely: Math.round(((talalt[0]!.a % 90) + 90) % 90), konty: 0, orom: vegek.length, vegek, csoportok: talalt.map((t) => t.b), gerincek: talalt.map(({ g }) => [g.x0, g.y0, g.x1, g.y1] as [number, number, number, number]), elgerincek: [] };
}


/**
 * A tető ereszvonala (alaprajzi körvonala) a felülnézetből, lapkoordinátában (pt): a tetőfelület a felülnézeten sűrűn
 * vonalazott (héjazat-sraffozás, gerinc, élgerinc, vápa) – a csoport befoglalója (+2 m) körüli vonalakat rácsra rajzolva
 * (5 cm-es cella, a tető főirányába forgatva) és morfológiai zárással (r = 0,5 m) tömbbé olvasztva a tetőváz pontjait
 * tartalmazó összefüggő tömb a tető; a belső lyukak kitöltve, a 0,3 m-nél kisebb lépcsők elhagyva. Null, ha a tömb a
 * rács széléig ér, vagy a befoglaló 1,6-szorosánál nagyobb.
 */
export function tetoKontur(lap: Lap, b: { x0: number; y0: number; x1: number; y1: number }, vaz: [number, number, number, number][], mPt: number, tengely: number, zarM = 0.5): [number, number][] | null {
  if (!vaz.length) return null;
  const mg = 2 / mPt, cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  const t = (-tengely * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
  const forgat = (x: number, y: number): [number, number] => [(x - cx) * c - (y - cy) * s, (x - cx) * s + (y - cy) * c];
  const R = Math.hypot(b.x1 - b.x0, b.y1 - b.y0) / 2 + mg;
  const px = 0.05 / mPt, w = Math.ceil((2 * R) / px), h = w;
  if (w > 4000) return null;
  const vonal = new Uint8Array(w * h);
  const rajz = (ax: number, ay: number, bx: number, by: number) => { const [x0, y0] = forgat(ax, ay), [x1, y1] = forgat(bx, by); const n = Math.max(1, Math.ceil((Math.hypot(x1 - x0, y1 - y0) / px) * 2));
    for (let k = 0; k <= n; k++) { const x = Math.floor((x0 + ((x1 - x0) * k) / n + R) / px), y = Math.floor((y0 + ((y1 - y0) * k) / n + R) / px); if (x >= 0 && y >= 0 && x < w && y < h) vonal[y * w + x] = 1; } };
  for (const u of lap.utvonalak) {
    if (u.muvelet === 'none' || u.bbox[2] < cx - R || u.bbox[0] > cx + R || u.bbox[3] < cy - R || u.bbox[1] > cy + R) continue;
    u.pontok.forEach((p, j) => { const n = p.length / 2; for (let i = 0; i + 1 < n; i++) rajz(p[2 * i]!, p[2 * i + 1]!, p[2 * i + 2]!, p[2 * i + 3]!);
      if ((u.zart[j] || u.muvelet !== 'stroke') && n >= 3) rajz(p[2 * n - 2]!, p[2 * n - 1]!, p[0]!, p[1]!); });
  }
  // zárás: tágítás, majd szűkítés r-rel (sorok, oszlopok mentén – négyzetes elem)
  const r = Math.max(1, Math.round(zarM / 0.05));
  const tagit1 = (m: Uint8Array, vizsz: boolean, ertek: number) => { const o = new Uint8Array(w * h);
    for (let a = 0; a < (vizsz ? h : w); a++) { let utolso = -1e9; for (let q = 0; q < (vizsz ? w : h); q++) { const i = vizsz ? a * w + q : q * w + a; if (m[i] === ertek) utolso = q; if (q - utolso <= r) o[i] = 1; }
      utolso = 1e9; for (let q = (vizsz ? w : h) - 1; q >= 0; q--) { const i = vizsz ? a * w + q : q * w + a; if (m[i] === ertek) utolso = q; if (utolso - q <= r) o[i] = 1; } } return o; };
  const tag = tagit1(tagit1(vonal, true, 1), false, 1);
  // szűkítés = a komplemens tágítása
  const kom = tagit1(tagit1(tag, true, 0), false, 1);
  const tomb = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) tomb[i] = tag[i] && !kom[i] ? 1 : 0;
  // a tetőváz pontjait tartalmazó tömb(ök)
  const be = new Uint8Array(w * h); const sor: number[] = [];
  for (const [a, b2, c2, d] of vaz) { const [x0, y0] = forgat(a, b2), [x1, y1] = forgat(c2, d);
    for (let k = 0; k <= 20; k++) { const x = Math.floor((x0 + ((x1 - x0) * k) / 20 + R) / px), y = Math.floor((y0 + ((y1 - y0) * k) / 20 + R) / px); if (x < 0 || y < 0 || x >= w || y >= h) continue; const i = y * w + x; if (tomb[i] && !be[i]) { be[i] = 1; sor.push(i); } } }
  let szel = false;
  for (let k = 0; k < sor.length; k++) { const i = sor[k]!, x = i % w; if (x === 0 || x === w - 1 || i < w || i >= w * (h - 1)) { szel = true; break; }
    for (const j of [i - 1, i + 1, i - w, i + w]) if (tomb[j] && !be[j]) { be[j] = 1; sor.push(j); } }
  if ((globalThis as any).TKDBG) { const buf = new Uint8Array(w * h * 3).fill(255); for (let i = 0; i < w * h; i++) { if (tomb[i]) { buf[i * 3] = 200; buf[i * 3 + 1] = 220; buf[i * 3 + 2] = 255; } if (be[i]) { buf[i * 3] = 250; buf[i * 3 + 1] = 200; buf[i * 3 + 2] = 150; } if (vonal[i]) { buf[i * 3] = 0; buf[i * 3 + 1] = 0; buf[i * 3 + 2] = 0; } } (globalThis as any).TKDBG(w, h, buf); }
  if (szel) return null;
  if (sor.length > 1.6 * ((b.x1 - b.x0 + 2 / mPt) * (b.y1 - b.y0 + 2 / mPt)) / (px * px)) return null;
  // lyukak kitöltése: a kívülről el nem érhető nem-tető cellák is a tető
  const kint = new Uint8Array(w * h); const s2: number[] = [];
  for (let x = 0; x < w; x++) for (const y of [0, h - 1]) { const i = y * w + x; if (!be[i] && !kint[i]) { kint[i] = 1; s2.push(i); } }
  for (let y = 0; y < h; y++) for (const x of [0, w - 1]) { const i = y * w + x; if (!be[i] && !kint[i]) { kint[i] = 1; s2.push(i); } }
  for (let k = 0; k < s2.length; k++) { const i = s2[k]!, x = i % w; for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) if (j >= 0 && j < w * h && !be[j] && !kint[j]) { kint[j] = 1; s2.push(j); } }
  for (let i = 0; i < w * h; i++) be[i] = kint[i] ? 0 : 1;
  if ((globalThis as any).TKDBG) { const buf = new Uint8Array(w * h * 3).fill(255); for (let i = 0; i < w * h; i++) { if (be[i]) { buf[i * 3] = 250; buf[i * 3 + 1] = 200; buf[i * 3 + 2] = 150; } if (vonal[i]) { buf[i * 3] = 0; buf[i * 3 + 1] = 0; buf[i * 3 + 2] = 0; } } (globalThis as any).TKDBG(w, h, buf); }
  // körvonal: a cellahatárok élei hurokba fűzve – a leghosszabb hurok
  const el = new Map<string, [number, number]>();
  const B = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && !!be[y * w + x];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { if (!be[y * w + x]) continue;
    if (!B(x, y - 1)) el.set(`${x},${y}`, [x + 1, y]); if (!B(x + 1, y)) el.set(`${x + 1},${y}`, [x + 1, y + 1]);
    if (!B(x, y + 1)) el.set(`${x + 1},${y + 1}`, [x, y + 1]); if (!B(x - 1, y)) el.set(`${x},${y + 1}`, [x, y]); }
  let leg: [number, number][] = []; const latott = new Set<string>();
  for (const k of el.keys()) { if (latott.has(k)) continue; const hurok: [number, number][] = []; let p = k;
    while (!latott.has(p)) { latott.add(p); const [x, y] = p.split(',').map(Number) as [number, number]; hurok.push([x, y]); const q = el.get(p); if (!q) break; p = `${q[0]},${q[1]}`; }
    if (hurok.length > leg.length) leg = hurok; }
  if (leg.length < 4) return null;
  const egyenes = (q: [number, number][]) => q.filter((p, i) => { const a = q[(i + q.length - 1) % q.length]!, d = q[(i + 1) % q.length]!; return Math.abs((p[0] - a[0]) * (d[1] - p[1]) - (p[1] - a[1]) * (d[0] - p[0])) > 1e-9; });
  let pts = egyenes(leg.map(([x, y]) => [x * px - R, y * px - R] as [number, number]));
  const min = 0.3 / mPt;
  for (let kor = 0; kor < 400 && pts.length > 4; kor++) {
    const n = pts.length; let i = -1;
    for (let k = 0; k < n; k++) { const a = pts[k]!, d = pts[(k + 1) % n]!; if (Math.hypot(d[0] - a[0], d[1] - a[1]) < min) { i = k; break; } }
    if (i < 0) break;
    const a = pts[(i + n - 1) % n]!, p = pts[i]!, q = pts[(i + 1) % n]!, d = pts[(i + 2) % n]!;
    const vizsz = Math.abs(q[1] - p[1]) < 1e-9, la = Math.hypot(p[0] - a[0], p[1] - a[1]), ld = Math.hypot(d[0] - q[0], d[1] - q[1]);
    if (vizsz) { const x = la >= ld ? p[0] : q[0]; if (la >= ld) d[0] = x; else a[0] = x; p[0] = x; q[0] = x; }
    else { const y = la >= ld ? p[1] : q[1]; if (la >= ld) d[1] = y; else a[1] = y; p[1] = y; q[1] = y; }
    pts = egyenes(pts.filter((rr, k) => { const e = pts[(k + n - 1) % n]!; return Math.hypot(rr[0] - e[0], rr[1] - e[1]) > 1e-9; }));
  }
  const vissza = ([x, y]: [number, number]): [number, number] => [cx + x * c + y * s, cy - x * s + y * c];
  return pts.map(vissza);
}
