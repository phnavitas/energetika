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
  /** csoportonként a kiterjedést adó pontok (pt): a gerinc / élgerinc végei, nyeregtetőnél az eresz sarkai – az elforgatott
   * (a tető főirányú) befoglalóhoz */
  pontok: [number, number][][];
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
  // (a vápák nincsenek a gerinc/élgerinc-hálóban: egy L / T alakú tető két tömege két csoport lenne – a fedésben
  // átfedő csoportok egy tető; két külön tető élgerinc-befoglalói nem fedik egymást)
  const cs0 = csoportok.splice(0); const uj = cs0.map((_, i) => i);
  for (let valt = true; valt;) { valt = false;
    for (let i = 0; i < cs0.length; i++) for (let j = i + 1; j < cs0.length; j++) {
      if (uj[i] === uj[j]) continue; const a = cs0[i]!, b = cs0[j]!;
      if (a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1) { const t = uj[j]!, f = uj[i]!; for (let k = 0; k < uj.length; k++) if (uj[k] === t) uj[k] = f; valt = true; }
    } }
  const ujId = new Map<number, number>();
  cs0.forEach((b, i) => { let c = ujId.get(uj[i]!); if (c === undefined) { c = csoportok.length; ujId.set(uj[i]!, c); csoportok.push({ ...b }); }
    const t = csoportok[c]!; t.x0 = Math.min(t.x0, b.x0); t.y0 = Math.min(t.y0, b.y0); t.x1 = Math.max(t.x1, b.x1); t.y1 = Math.max(t.y1, b.y1); });
  for (const [r, c] of csopId) csopId.set(r, ujId.get(uj[c]!)!);
  for (const v of vegek) { const i = elemek.findIndex((e) => Math.hypot(e.x0 - v.hely[0], e.y0 - v.hely[1]) <= tol || Math.hypot(e.x1 - v.hely[0], e.y1 - v.hely[1]) <= tol); v.csoport = i >= 0 ? csopId.get(gy(i))! : -1; }
  const ki = (s: Sz) => [s.x0, s.y0, s.x1, s.y1] as [number, number, number, number];
  const pontok: [number, number][][] = csoportok.map(() => []);
  elemek.forEach((e, i) => { const c = csopId.get(gy(i)); if (c !== undefined) pontok[c]!.push([e.x0, e.y0], [e.x1, e.y1]); });
  const eredm: TetoFelulnezet = { tengely, konty, orom, vegek, csoportok, pontok, gerincek: [...gerincek].map(ki), elgerincek: [...elgerincek].map(ki) };
  // (a kontyos tetők mellett a lapon lévő nyeregtetők is – a kontyos csoportokkal nem átfedők)
  const ny = nyeregteto(sz);
  if (ny) for (const [k, b] of ny.csoportok.entries()) {
    if (csoportok.some((c) => c.x0 < b.x1 && b.x0 < c.x1 && c.y0 < b.y1 && b.y0 < c.y1)) continue;
    const id = eredm.csoportok.length; eredm.csoportok.push(b); eredm.pontok.push(ny.pontok[k]!);
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
  const talalt: { g: Sz; b: { x0: number; y0: number; x1: number; y1: number }; a: number; P: [number, number][] }[] = [];
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
    talalt.push({ g, b, a: g.a, P: P as [number, number][] });
  }
  if (!talalt.length) return null;
  const vegek: TetoFelulnezet['vegek'] = [];
  talalt.forEach(({ g }, i) => {
    const ir = ((Math.atan2(g.y1 - g.y0, g.x1 - g.x0) * 180) / Math.PI + 360) % 360;
    vegek.push({ hely: [g.x1, g.y1], irany: ir, fajta: 'orom', csoport: i }, { hely: [g.x0, g.y0], irany: (ir + 180) % 360, fajta: 'orom', csoport: i });
  });
  return { tengely: Math.round(((talalt[0]!.a % 90) + 90) % 90), konty: 0, orom: vegek.length, vegek, csoportok: talalt.map((t) => t.b), pontok: talalt.map((t) => t.P), gerincek: talalt.map(({ g }) => [g.x0, g.y0, g.x1, g.y1] as [number, number, number, number]), elgerincek: [] };
}

/**
 * Az alaprajzi épülethez (befoglaló méretei m-ben, csökkenő sorrendben) illő tető a felülnézeten: az egyes tetőcsoportok és
 * a közeli (≤ 1,5 m) csoportok egyesítései közül az, amelynek a tető főirányában vett befoglalója (ereszkiállással,
 * ~ 0,8 m) a legjobban egyezik – az egy tető több csoportra eshet (L, T alak, két gerinc), és a helyszínrajzon a ház
 * elforgatva is állhat. A csoportok indexei, a befoglaló közepe (pt) és mérete (m, a főirányban), az eltérés aránya.
 */
export function tetoCsoportValaszt(t: TetoFelulnezet, mPt: number, meret: [number, number], tures = 0.2, feliratok?: { s: string; x: number; y: number; szel?: number; szog?: number }[]): { csoportok: number[]; kozep: [number, number]; W: number; H: number; hiba: number; szog: number } | null {
  const th = (-t.tengely * Math.PI) / 180, c = Math.cos(th), s = Math.sin(th);
  const bb = t.pontok.map((P) => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const [x, y] of P) { const u = x * c - y * s, v = x * s + y * c; x0 = Math.min(x0, u); x1 = Math.max(x1, u); y0 = Math.min(y0, v); y1 = Math.max(y1, v); } return [x0, y0, x1, y1] as [number, number, number, number]; });
  const n = bb.length; if (!n) return null;
  const apa = bb.map((_, i) => i); const gy = (i: number): number => (apa[i] === i ? i : (apa[i] = gy(apa[i]!)));
  const tav = 1.5 / mPt;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const a = bb[i]!, b = bb[j]!; if (a[0] - tav < b[2] && b[0] - tav < a[2] && a[1] - tav < b[3] && b[1] - tav < a[3]) apa[gy(i)] = gy(j); }
  const jeloltek: number[][] = bb.map((_, i) => [i]);
  const kl = new Map<number, number[]>(); bb.forEach((_, i) => { const r = gy(i); (kl.get(r) ?? kl.set(r, []).get(r)!).push(i); });
  for (const l of kl.values()) if (l.length > 1) jeloltek.push(l);
  // A tervezett épület jele a helyszínrajzon: felirat a tetőn („tervezett”, „lakóépület”, „lakóház”, „családi ház”); a
  // „meglévő”, „szomszéd” feliratú tető nem a tervezett. A felirattal jelölt – ill. a lapon egyetlen – tető az alaprajzi
  // befoglalótól jobban is eltérhet (a földszinti lapostetős szárny, a garázs nincs a magastető alatt; a raszteres kontúr
  // kifolyhat): tűrés 0,35.
  const klaszterDb = kl.size;
  let leg: (ReturnType<typeof tetoCsoportValaszt> & { pont: number }) | null = null;
  for (const cs of jeloltek) {
    const b = cs.reduce((q, i) => [Math.min(q[0], bb[i]![0]), Math.min(q[1], bb[i]![1]), Math.max(q[2], bb[i]![2]), Math.max(q[3], bb[i]![3])] as [number, number, number, number], [Infinity, Infinity, -Infinity, -Infinity] as [number, number, number, number]);
    const W = (b[2] - b[0]) * mPt, H = (b[3] - b[1]) * mPt; const m = [W, H].sort((p, q) => q - p);
    const hiba = Math.max(Math.abs(m[0]! - meret[0] - 0.8) / meret[0], Math.abs(m[1]! - meret[1] - 0.8) / meret[1]);
    const mg = 0.5 / mPt;
    // (a felirat közepe: a kezdőpontból a szöveg irányában a szélesség felével)
    const fel = (feliratok ?? []).filter((q) => { const a = ((q.szog ?? 0) * Math.PI) / 180, qx = q.x + Math.cos(a) * (q.szel ?? 0) / 2, qy = q.y - Math.sin(a) * (q.szel ?? 0) / 2; const u = qx * c - qy * s, v = qx * s + qy * c; return u >= b[0] - mg && u <= b[2] + mg && v >= b[1] - mg && v <= b[3] + mg; }).map((q) => q.s).join(' ');
    const meglevo = /megl[ée]v[őo]|szomsz[ée]d|bontand/i.test(fel), tervezett = !meglevo && /tervezett|lak[óo][ée]p[üu]let|lak[óo]h[áa]z|csal[áa]di\s*h[áa]z|[úu]j\s+[ée]p[üu]let/i.test(fel);
    if (meglevo && !/tervezett/i.test(fel)) continue;
    const egyetlen = klaszterDb === 1 && cs.length === n;
    const tur = tervezett || egyetlen ? Math.max(tures, 0.35) : tures;
    const pont = hiba - (tervezett ? 0.15 : 0);
    if (hiba > tur || (leg && pont >= leg.pont)) continue;
    const u = (b[0] + b[2]) / 2, v = (b[1] + b[3]) / 2;
    // (vissza a lap koordinátáiba: az elforgatás inverze)
    leg = { csoportok: cs, kozep: [u * c + v * s, -u * s + v * c], W, H, hiba, szog: t.tengely, pont };
  }
  if (!leg) return null;
  const { pont: _p, ...ki } = leg; void _p;
  return ki;
}
