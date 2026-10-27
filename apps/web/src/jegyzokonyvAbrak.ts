/**
 * A számítási jegyzőkönyv ábrái SVG-ként (pdfmake `svg` elem): havi energiamérleg, hőveszteség megoszlása,
 * primerenergia felhasználási célonként, szoláris nyereség tájolásonként, szerkezetek U-értéke a követelményhez képest.
 */
const SZ = { tus: '#1D2B33', halk: '#4B5A61', halkabb: '#75848A', vonal: '#C9D1CF', vonal2: '#E1E6E4', jo: '#2F8F5B', rossz: '#C2362F' };
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const szam = (v: number, t = 0) => v.toLocaleString('hu-HU', { minimumFractionDigits: t, maximumFractionDigits: t });
const txt = (x: number, y: number, s: string, o: { m?: number; szin?: string; b?: boolean; a?: 'start' | 'middle' | 'end' } = {}) =>
  `<text x="${x}" y="${y}" font-size="${o.m ?? 7}" fill="${o.szin ?? SZ.halk}"${o.b ? ' font-weight="bold"' : ''}${o.a ? ` text-anchor="${o.a}"` : ''}>${esc(s)}</text>`;

/** „Szép” tengelylépés. */
function lepes(max: number, db = 4): number {
  const n = max / db, e = 10 ** Math.floor(Math.log10(n || 1)), r = n / e;
  return (r <= 1 ? 1 : r <= 2 ? 2 : r <= 2.5 ? 2.5 : r <= 5 ? 5 : 10) * e;
}
function jelmagyarazat(x: number, y: number, t: [string, string][]): string {
  let s = '', xx = x;
  for (const [szin, nev] of t) { s += `<rect x="${xx}" y="${y - 6}" width="8" height="8" fill="${szin}"/>` + txt(xx + 11, y + 1, nev); xx += 16 + nev.length * 3.6; }
  return s;
}

export interface HaviAdat { Qtr: number; Qszell: number; Qsd: number; Qb: number; eta: number; QFnet: number }
/** Havi mérleg: veszteség (transzmisszió + szellőzés) és hasznosított nyereség (szoláris + belső) oszlopai, QF,net jelölővel. */
export function haviMerlegSvg(havi: HaviAdat[], W = 515, H = 190): string {
  const HO = ['jan', 'feb', 'márc', 'ápr', 'máj', 'jún', 'júl', 'aug', 'szept', 'okt', 'nov', 'dec'];
  const bal = 40, lent = 34, fent = 10, jobb = 6;
  const max = Math.max(1, ...havi.map((h) => Math.max(h.Qtr + h.Qszell, h.eta * (h.Qsd + h.Qb))));
  const lp = lepes(max), ymax = Math.ceil(max / lp) * lp;
  const ph = H - lent - fent, pw = W - bal - jobb, y = (v: number) => fent + ph - (v / ymax) * ph;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
  for (let v = 0; v <= ymax + 1e-9; v += lp) s += `<line x1="${bal}" x2="${W - jobb}" y1="${y(v)}" y2="${y(v)}" stroke="${SZ.vonal2}" stroke-width="0.5"/>` + txt(bal - 4, y(v) + 2.5, szam(v / 1000, lp < 1000 ? 1 : 0), { a: 'end', m: 6.5 });
  s += txt(4, fent + 4, 'MWh', { m: 6.5 });
  const cw = pw / 12, bw = cw * 0.32;
  havi.forEach((h, i) => {
    const x0 = bal + i * cw + cw * 0.15;
    s += `<rect x="${x0}" y="${y(h.Qtr)}" width="${bw}" height="${y(0) - y(h.Qtr)}" fill="#3E6E8E"/>`;
    s += `<rect x="${x0}" y="${y(h.Qtr + h.Qszell)}" width="${bw}" height="${y(h.Qtr) - y(h.Qtr + h.Qszell)}" fill="#8FB3C9"/>`;
    const sd = h.eta * h.Qsd, b = h.eta * h.Qb, x1 = x0 + bw + 1.5;
    s += `<rect x="${x1}" y="${y(sd)}" width="${bw}" height="${y(0) - y(sd)}" fill="#E3A72F"/>`;
    s += `<rect x="${x1}" y="${y(sd + b)}" width="${bw}" height="${y(sd) - y(sd + b)}" fill="#F2D27E"/>`;
    if (h.QFnet > 0) { const cx = x0 + bw + 0.75, cy = y(h.QFnet); s += `<polygon points="${cx},${cy - 3.5} ${cx + 3.5},${cy} ${cx},${cy + 3.5} ${cx - 3.5},${cy}" fill="${SZ.rossz}"/>`; }
    s += txt(bal + i * cw + cw / 2, y(0) + 9, HO[i]!, { a: 'middle', m: 6.5 });
  });
  s += jelmagyarazat(bal, H - 6, [['#3E6E8E', 'transzmisszió'], ['#8FB3C9', 'szellőzés'], ['#E3A72F', 'hasznosított szoláris'], ['#F2D27E', 'hasznosított belső'], [SZ.rossz, 'QF,net (nettó fűtési igény)']]);
  return s + '</svg>';
}

/** Vízszintes sávdiagram (megoszlás): címke, sáv, érték és százalék. */
export function savokSvg(sorok: { nev: string; ertek: number; szin?: string; resz?: [number, string][] }[], egyseg: string, W = 515, tized = 0): string {
  const sorM = 15, felso = 4, cimkeW = 150, ertekW = 110;
  const H = felso + sorok.length * sorM + 4;
  const max = Math.max(1e-9, ...sorok.map((r) => r.ertek));
  const ossz = sorok.reduce((t, r) => t + Math.max(0, r.ertek), 0);
  const sw = W - cimkeW - ertekW;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
  sorok.forEach((r, i) => {
    const y = felso + i * sorM;
    s += txt(0, y + 9, r.nev, { m: 7.5, szin: SZ.tus });
    if (r.resz) { let x = cimkeW; for (const [v, szin] of r.resz) { const w = (Math.max(0, v) / max) * sw; s += `<rect x="${x}" y="${y + 1.5}" width="${w}" height="${sorM - 5}" fill="${szin}"/>`; x += w; } }
    else s += `<rect x="${cimkeW}" y="${y + 1.5}" width="${(Math.max(0, r.ertek) / max) * sw}" height="${sorM - 5}" fill="${r.szin ?? '#3E6E8E'}"/>`;
    s += txt(W, y + 9, `${szam(r.ertek, tized)} ${egyseg}${ossz > 0 && r.ertek > 0 ? `  (${szam((r.ertek / ossz) * 100, 0)}%)` : ''}`, { a: 'end', m: 7.5 });
  });
  return s + '</svg>';
}

/** Szerkezetek U-értéke a megengedett értékhez képest (vízszintes sávok, függőleges jel a követelménynél). */
export function uErtekSvg(sorok: { nev: string; U: number; Umax: number | null }[], W = 515): string {
  const sorM = 14, felso = 14, cimkeW = 210, ertekW = 70;
  const H = felso + sorok.length * sorM + 4;
  // a tengely a követelményértékekhez igazodik (egy-egy nagyon rossz szerkezet ne nyomja össze a többit); a túllógó sáv levágva
  const umaxok = sorok.map((r) => r.Umax ?? 0).filter((v) => v > 0);
  const max = (umaxok.length ? Math.max(...umaxok) * 1.6 : Math.max(0.1, ...sorok.map((r) => r.U)) * 1.08);
  const sw = W - cimkeW - ertekW, x = (v: number) => cimkeW + (v / max) * sw;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
  s += jelmagyarazat(cimkeW, 8, [[SZ.jo, 'U ≤ Umax'], [SZ.rossz, 'U > Umax'], [SZ.tus, 'követelmény (Umax)']]);
  sorok.forEach((r, i) => {
    const y = felso + i * sorM, ok = r.Umax === null || r.U <= r.Umax + 1e-9;
    s += txt(0, y + 8.5, r.nev.length > 52 ? r.nev.slice(0, 50) + '…' : r.nev, { m: 7, szin: SZ.tus });
    const xv = Math.min(x(r.U), cimkeW + sw);
    s += `<rect x="${cimkeW}" y="${y + 1.5}" width="${xv - cimkeW}" height="${sorM - 5}" fill="${ok ? SZ.jo : SZ.rossz}" fill-opacity="0.85"/>`;
    if (x(r.U) > cimkeW + sw) s += `<polyline points="${xv - 6},${y + 1} ${xv - 3},${y + sorM - 3} ${xv - 3},${y + 1} ${xv},${y + sorM - 3}" fill="none" stroke="#FFFFFF" stroke-width="1.2"/>`;
    if (r.Umax !== null) s += `<rect x="${x(r.Umax) - 0.8}" y="${y}" width="1.6" height="${sorM - 2}" fill="${SZ.tus}"/>`;
    s += txt(W, y + 8.5, `${szam(r.U, 3)}${r.Umax !== null ? ` / ${szam(r.Umax, 2)}` : ''}`, { a: 'end', m: 7 });
  });
  return s + '</svg>';
}
