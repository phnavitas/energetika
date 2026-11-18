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
  if (!csucsok.length) return null;
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
      if (!kapcs.some((s) => diag(s)) && !kapcs.some((s) => gerincek.has(s))) { orom++; const q = Math.hypot(g.x0 - p[0], g.y0 - p[1]) < 1 ? [g.x1, g.y1] : [g.x0, g.y0]; vegek.push({ hely: p, irany: (((Math.atan2(p[1] - q[1]!, p[0] - q[0]!) * 180) / Math.PI) + 360) % 360, fajta: 'orom', csoport: -1 }); }
    }

    // (a főirányban fut a rajz zöme – ereszvonal, cserépsraff –; a 45°-kal elforgatott „értelmezés” az ereszsarkokat
    // venné kontynak: a főirányú vonalhossz dönt)
    const hossz = sz.filter(tengelyMenti).reduce((t, x) => t + x.L, 0);
    if (konty && (!leg || hossz > leg.hossz)) leg = { tengely, konty, orom, gerincek, elgerincek, hossz, vegek };
  }
  if (!leg) return null;
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
  return { tengely, konty, orom, vegek, csoportok, gerincek: [...gerincek].map(ki), elgerincek: [...elgerincek].map(ki) };
}
