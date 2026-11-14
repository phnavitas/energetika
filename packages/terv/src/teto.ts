/** Tetőtér-geometria (a 3D nézet és az épületmodell közös alapja). */
/**
 * Tetőtér-geometria egy körvonalra (a metszet hajlásával, térdfalával és padlásfödém-magasságával):
 * - oromfal: az az él, amelynek homlokzatán a homlokzati rajz oromzatot mutat (`orom`: lapirány → oromszélesség), ennek
 *   hiányában a rövidebb összhosszú (merőleges) élcsalád élei;
 * - teljes szintmagasságú kiugrás: az ereszoldali, 6 m-nél rövidebb él, amely a saját oldala fő ereszvonalánál 0,5 m-nél
 *   kijjebb áll (a fal a padlásfödémig ér);
 * - a többi él ereszél (térdfal). A pont fölötti magasság: térdfal + a legközelebbi ereszél egyenesétől befelé mért
 *   távolság · tg(hajlás), legfeljebb a padlásfödémig; az ereszvonalon kívüli (kiugró) rész teljes magasságú.
 */
export function tetoGeo(p: [number, number][], t: { hajlas: number; terdfal: number; belmag: number }, orom?: Record<number, number>) {
  const n = p.length;
  const A0 = p.reduce((s0, [x, y], i) => { const [x2, y2] = p[(i + 1) % n]!; return s0 + x * y2 - x2 * y; }, 0) / 2;
  const el = Math.sign(A0) || 1;
  type El = { a: [number, number]; b: [number, number]; l: number; ux: number; uy: number; nx: number; ny: number; ir: number; fajta: 'eresz' | 'orom' | 'kiugro' };
  const elek: El[] = [];
  for (let i = 0; i < n; i++) {
    const a = p[i]!, b = p[(i + 1) % n]!; const l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l < 0.05) continue;
    const ux = (b[0] - a[0]) / l, uy = (b[1] - a[1]) / l; const nx = el * uy, ny = -el * ux; // kifelé
    const ir = ((Math.round(((Math.atan2(nx, -ny) * 180) / Math.PI + 360) / 90) * 90) % 360);
    elek.push({ a, b, l, ux, uy, nx, ny, ir, fajta: 'eresz' });
  }
  // oromfalak
  const vanOrom = orom && Object.values(orom).some((v) => v >= 2);
  if (vanOrom) for (const e of elek) { const o = orom![e.ir] ?? 0; if (o >= 2 && e.l >= Math.min(1.5, 0.3 * o)) e.fajta = 'orom'; }
  else {
    const csal = [0, 0]; for (const e of elek) csal[e.ir % 180 === 0 ? 0 : 1]! += e.l;
    const oromCsal = csal[0]! < csal[1]! ? 0 : 1; // a rövidebb összhosszú család az oromfalaké
    for (const e of elek) if ((e.ir % 180 === 0 ? 0 : 1) === oromCsal && e.l >= 1.5) e.fajta = 'orom';
  }
  // kiugrások: oldalanként (lapirány) a fő ereszvonal a leghosszabb összhosszú eltolás
  const elt = (e: El) => (e.a[0] * e.nx + e.a[1] * e.ny);
  for (const ir of [0, 90, 180, 270]) {
    const ok = elek.filter((e) => e.fajta === 'eresz' && e.ir === ir); if (!ok.length) continue;
    let fo = elt(ok[0]!), foL = -1;
    for (const e of ok) { const L = ok.filter((f) => Math.abs(elt(f) - elt(e)) < 0.3).reduce((s0, f) => s0 + f.l, 0); if (L > foL) { foL = L; fo = elt(e); } }
    for (const e of ok) if (elt(e) > fo + 0.5 && e.l < 6) e.fajta = 'kiugro';
  }
  const tg = Math.tan((t.hajlas * Math.PI) / 180), ucap = Math.max(0, (t.belmag - t.terdfal) / tg);
  // (a rövid, < 1,5 m-es ereszél – sarokugrás – nem alakít tetősíkot)
  const ereszek = elek.filter((e) => e.fajta === 'eresz' && e.l >= 1.5);
  /** A pont fölötti belmagasság és a tetősík (a legközelebbi ereszél kifelé mutató lapiránya; null: padlásfödém alatt). */
  const HI = (q: [number, number]): { h: number; ir: number | null } => {
    let u = Infinity, ir: number | null = null;
    for (const e of ereszek) {
      const tt = (q[0] - e.a[0]) * e.ux + (q[1] - e.a[1]) * e.uy;
      if (tt < -0.05 || tt > e.l + 0.05) continue;
      const d = -((q[0] - e.a[0]) * e.nx + (q[1] - e.a[1]) * e.ny); // befelé pozitív
      if (d < -0.3) continue; // a kiugrás az ereszvonalon kívül: ettől az éltől nem lejt
      if (d < u) { u = d; ir = e.ir; }
    }
    if (!Number.isFinite(u)) return { h: t.belmag, ir: null };
    const h = t.terdfal + Math.max(0, u) * tg;
    return h >= t.belmag ? { h: t.belmag, ir: null } : { h, ir };
  };
  const H = (q: [number, number]) => HI(q).h;
  return { H, HI, ucap, elek };
}
