/**
 * A tervlapok teljes feldolgozása: PDF megnyitása pdf.js-szel (böngészőben, munkaszál nélkül), lapok szerepének
 * felismerése, alaprajz (helyiségek, északjel, raszter, külső falak, nyílászárók) és metszet (rétegrendek, szintek).
 */
import { lapKinyer, type Lap } from './kinyeres';
import { alaprajzElemez, szintekCimbol, eszakjelKeres, jegyzekSorok, type AlaprajzEredmeny, type TervHelyiseg } from './alaprajz';
import { raszterEpit, type Raszter, type RaszterBeallitas } from './raszter';
import { kotaEllenoriz } from './kota';
import type { TintaKep } from './tinta';
import { meretaranyKotabol, automatikusHelyisegek, lakasCsoportok, arnyalatHatarok, type SzurkeKep } from './autohelyiseg';
import { fuggonyfalak, jeloletlenNyilasok, nyilasFeliratok, nyilasokHozzarendel, falfulkeE, type TervNyilas, type NyilasFelirat } from './nyilaszarok';
import { talajOldal } from './talaj';
import { retegrendBlokkok, szerepBecsles, retegekEpit, szintekKeres, tetoterKeres, type TetoterAdat, type TervRetegrend, type SzerepBecsles, type TervRetegUI, type SzintEredmeny } from './metszet';
import { ujId } from '../modell';

export interface TervLap {
  fajl: string; oldal: number;
  /** `leiras`: műszaki leírás (szöveges dokumentum) – a helyiséglistája a pecsét nélküli alaprajzhoz. */
  szerep: 'alaprajz' | 'metszet' | 'homlokzat' | 'leiras' | 'egyeb';
  cim: string;
  lap: Lap;
  /** Előnézeti kép (JPEG dataURL) és mérete pixelben. */
  kep: string; kepSzel: number; kepMag: number;
  /** A renderelt lap szürkeárnyalatos, kicsinyített képe (a színezett lakásfoltok felismeréséhez). */
  szurke?: SzurkeKep;
  /** Alaprajznál: a lap szürkeképe ≈ 1,5 képpont / pt felbontásban – a rajzstílustól független („tinta”) falfelismeréshez. */
  tinta?: TintaKep;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PdfJs = any;
let pdfjsBetoltve: Promise<PdfJs> | null = null;
export async function pdfjsBetolt(): Promise<PdfJs> {
  pdfjsBetoltve ??= (async () => {
    const pdfjs = await import('pdfjs-dist');
    // a munkaszálat a fő szálon futtatjuk (egyfájlos előnézetben és szigorú CSP mellett is működik)
    const g = globalThis as unknown as { pdfjsWorker?: unknown };
    g.pdfjsWorker ??= await import('pdfjs-dist/build/pdf.worker.min.mjs');
    return pdfjs;
  })();
  return pdfjsBetoltve;
}

/**
 * A vászon szürkeárnyalatos, kicsinyített (≈ 600 px széles) másolata blokkátlagolással és 3×3-as simítással – a
 * mintázattal (pontraszterrel) kitöltött színezés így egyenletes szürke lesz. ptPx: 1 pt hány képpont.
 */
function szurkeKep(c: HTMLCanvasElement, scale: number): SzurkeKep | undefined {
  try {
    const W = c.width, H = c.height; const px = c.getContext('2d')!.getImageData(0, 0, W, H).data;
    const B = Math.max(1, Math.ceil(W / 600));
    const w = Math.ceil(W / B), h = Math.ceil(H / B);
    const osszeg = new Float64Array(w * h), db = new Uint32Array(w * h);
    for (let y = 0; y < H; y++) { const by = (y / B) | 0; for (let x = 0; x < W; x++) { const k = (y * W + x) * 4; const i = by * w + ((x / B) | 0); osszeg[i] += 0.299 * px[k]! + 0.587 * px[k + 1]! + 0.114 * px[k + 2]!; db[i]++; } }
    const atl = new Float64Array(w * h); for (let i = 0; i < w * h; i++) atl[i] = db[i] ? osszeg[i]! / db[i]! : 255;
    const adat = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let s = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; s += atl[yy * w + xx]!; n++; }
      adat[y * w + x] = Math.round(s / n);
    }
    return { w, h, ptPx: scale / B, adat };
  } catch { return undefined; }
}

/** Lapcím-jelölt: rövid felirat, amelyben önálló szóként szerepel a lap fajtája („Földszinti alaprajz”, „A-A metszet”,
 * „Keresztmetszetek”, „Homlokzatok”) – nem szóösszetétel része („keresztmetszetű”, „homlokzati”, „homlokzaton”). */
const CIM_SZO = /(alaprajz(?:ok)?|(?:kereszt|hossz)?metszet(?:ek)?|homlokzat(?:ok)?|helyszínrajz|tetőfelülnézet)(?![\p{L}])/iu;

export function lapSzerep(lap: Lap, fajlnev = ''): { szerep: TervLap['szerep']; cim: string } {
  const sz = lap.szovegek.map((t) => t.s).join(' \n ');
  // a legnagyobb betűméretű cím-jelölt (a rajzpecsét lapcíme vagy a rajz alatti felirat)
  const jeloltek = lap.szovegek.filter((t) => t.s.trim().length <= 70 && CIM_SZO.test(t.s) && !/szerint|lásd|ld\./i.test(t.s));
  // elsőként a rajzpecsét nagy (≥ 12 pt) lapcíme; ha nincs, a legnagyobb cím-jelölt(ek) – több rajz egy lapon: mind
  const nagy = jeloltek.find((t) => t.meret >= 12);
  const legnagyobb = Math.max(0, ...jeloltek.map((t) => t.meret));
  const cim = nagy ? nagy.s.trim() : [...new Set(jeloltek.filter((t) => t.meret >= legnagyobb - 0.5).map((t) => t.s.trim()))].join(' · ');
  // szöveges dokumentum (műszaki leírás): fájlnév szerint, vagy rajzcím nélküli, kevés vonalú, hosszú mondatos lap
  const fn = fajlnev.normalize('NFC');
  const mondat = lap.szovegek.filter((t) => t.s.trim().length >= 50).length;
  if (/m[űuü]\s*le[íi]r[áa]s|műszaki[_\s-]*leírás|leiras|tervezői\s*nyilatkozat/i.test(fn) || (!cim && lap.utvonalak.length < 40 && mondat >= 8 && /műszaki\s+leírás/i.test(sz))) return { szerep: 'leiras', cim: 'Műszaki leírás' };
  const fajta = (x: string) => (/metszet/i.test(x) ? 'metszet' : /alaprajz/i.test(x) ? 'alaprajz' : /homlokzat/i.test(x) ? 'homlokzat' : null);
  const f = fajta(cim) ?? fajta(fajlnev.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').normalize('NFC'));
  if (f) return { szerep: f, cim: cim || fajlnev.replace(/\.pdf$/i, '') };
  if (/rétegrend/i.test(sz) && /[±+]\d,\d{2}/.test(sz)) return { szerep: 'metszet', cim: cim || 'Metszet' };
  if (/\d+[,.]\d{2}\s*m(²|2)/.test(sz)) return { szerep: 'alaprajz', cim: cim || 'Alaprajz' };
  // típusalaprajz-lap pecsét nélkül: sok nyílásfelirat („pm 90”, „P 90”) és „…típusok” felirat
  if (/típusok\s*:|típusalaprajz/i.test(sz) || lap.szovegek.filter((t) => /^(pm|p)\s*\d{2,3}\b/i.test(t.s.trim())).length >= 5) return { szerep: 'alaprajz', cim: cim || (/(\S+típusok)/i.exec(sz)?.[1] ?? 'Típusalaprajz') };
  return { szerep: 'egyeb', cim: cim || 'Egyéb lap' };
}

/**
 * Több alaprajz egy lapon (pl. „FÖLDSZINT ALAPRAJZ” és „EMELET ALAPRAJZ” egymás alatt, vagy „MÁSODIK…” és
 * „HARMADIK EMELETI ALAPRAJZ” egymás mellett): a különböző szintet megnevező rajzcímek mentén a lapot részekre
 * bontjuk. A rajzcím a rajz bal felső vagy bal alsó sarkánál áll, ezért a határ a második (harmadik…) cím
 * koordinátája abban az irányban, amelyben a címek egymástól jobban eltérnek. A rajzpecsét (szintet több szinttel
 * vagy egyáltalán nem megnevező) lapcíme nem rajzcím.
 */
export function lapFeloszt(lap: Lap): { lap: Lap; cim: string }[] {
  const cimek: { t: Lap['szovegek'][number]; sz: string }[] = [];
  for (const t of lap.szovegek) {
    if (t.s.trim().length > 60 || !/alaprajz/i.test(t.s)) continue;
    const sz = szintekCimbol(t.s); if (sz.length !== 1) continue;
    if (cimek.some((c) => c.sz === sz[0])) continue;
    cimek.push({ t, sz: sz[0]! });
  }
  if (cimek.length < 2) return [];
  // azonos betűméretű címek (a rajzcímek egyformák; a pecsétben más méretű a felirat)
  const m = cimek.map((c) => c.t.meret).sort((a, b) => a - b)[cimek.length >> 1]!;
  const cs = cimek.filter((c) => Math.abs(c.t.meret - m) <= 0.5);
  if (cs.length < 2) return [];
  const dx = Math.max(...cs.map((c) => c.t.x)) - Math.min(...cs.map((c) => c.t.x)), dy = Math.max(...cs.map((c) => c.t.y)) - Math.min(...cs.map((c) => c.t.y));
  const fuggo = dy > dx; // egymás alatt
  const k = (x: number, y: number) => (fuggo ? y : x);
  cs.sort((a, b) => k(a.t.x, a.t.y) - k(b.t.x, b.t.y));
  // a cím feletti / előtti sor is a rajzhoz tartozik (egymás alatti rajzoknál a cím a rajz tetején)
  const hatar = cs.slice(1).map((c) => k(c.t.x, c.t.y) - (fuggo ? 2 * c.t.meret : 0));
  const resz = (x: number, y: number) => { let i = 0; while (i < hatar.length && k(x, y) >= hatar[i]!) i++; return i; };
  // az északjel (lapon egy van) minden részhez
  const ej = eszakjelKeres(lap); const eb = ej?.bbox; const g = ej ? 0.3 * ej.meret + 20 : 0;
  const jel = (x: number, y: number) => !!eb && x >= eb[0] - g && x <= eb[2] + g && y >= eb[1] - g && y <= eb[3] + g;
  // a helyiségjegyzék (táblázat) sorai minden részhez – a pecsét gyakran csak kódot ír, a nevet, területet a jegyzék adja
  const js = jegyzekSorok(lap.szovegek);
  const tb = js.length ? [Math.min(...js.map((j) => j.x)) - 150, Math.min(...js.map((j) => j.y)) - 15, Math.max(...js.map((j) => j.x)) + 250, Math.max(...js.map((j) => j.y)) + 5] : null;
  const tabla = (x: number, y: number) => !!tb && x >= tb[0]! && x <= tb[2]! && y >= tb[1]! && y <= tb[3]!;
  return cs.map((c, i) => ({
    cim: c.t.s.trim(),
    lap: { szel: lap.szel, mag: lap.mag,
      szovegek: lap.szovegek.filter((t) => resz(t.x, t.y) === i || jel(t.x, t.y) || tabla(t.x, t.y)),
      utvonalak: lap.utvonalak.filter((u) => { const x = (u.bbox[0] + u.bbox[2]) / 2, y = (u.bbox[1] + u.bbox[3]) / 2; return resz(x, y) === i || (jel(x, y) && Math.max(u.bbox[2] - u.bbox[0], u.bbox[3] - u.bbox[1]) < 200); }) },
  }));
}

export async function pdfLapok(f: File, kepSzel = 2000, halad?: (kesz: number, ossz: number) => void): Promise<TervLap[]> {
  const pdfjs = await pdfjsBetolt();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await f.arrayBuffer()), verbosity: 0, isEvalSupported: false }).promise;
  const ki: TervLap[] = [];
  const ossz = Math.min(doc.numPages, 30);
  halad?.(0, ossz);
  for (let n = 1; n <= ossz; n++) {
    const page = await doc.getPage(n);
    const lap = await lapKinyer(pdfjs, page);
    const vp0 = page.getViewport({ scale: 1 });
    const scale = Math.min(3, kepSzel / vp0.width);
    const vp = page.getViewport({ scale });
    const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    const ctx = c.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport: vp, canvas: c }).promise;
    const { szerep, cim } = lapSzerep(lap, f.name);
    let tinta: TintaKep | undefined;
    if (szerep === 'alaprajz') {
      try {
        // a falfelismeréshez ≈ 1,5 képpont / pt (1:100-nál ≈ 2,4 cm / képpont), legfeljebb 16 M képpont
        const ts = Math.min(1.5, Math.sqrt(16e6 / (vp0.width * vp0.height)));
        const tv = page.getViewport({ scale: ts });
        const tc = document.createElement('canvas'); tc.width = Math.round(tv.width); tc.height = Math.round(tv.height);
        const tx = tc.getContext('2d', { willReadFrequently: true })!; tx.fillStyle = '#fff'; tx.fillRect(0, 0, tc.width, tc.height);
        await page.render({ canvasContext: tx, viewport: tv, canvas: tc }).promise;
        const px = tx.getImageData(0, 0, tc.width, tc.height).data; const adat = new Uint8Array(tc.width * tc.height);
        for (let i = 0; i < adat.length; i++) adat[i] = Math.round(0.299 * px[i * 4]! + 0.587 * px[i * 4 + 1]! + 0.114 * px[i * 4 + 2]!);
        tinta = { w: tc.width, h: tc.height, ptPx: ts, adat };
      } catch { tinta = undefined; }
    }
    const kep = c.toDataURL('image/jpeg', 0.82), szurke = szurkeKep(c, scale);
    const reszek = szerep === 'alaprajz' ? lapFeloszt(lap) : [];
    if (reszek.length) for (const r of reszek) ki.push({ fajl: f.name, oldal: n, szerep, cim: r.cim, lap: r.lap, kep, kepSzel: c.width, kepMag: c.height, szurke, ...(tinta ? { tinta } : {}) });
    else ki.push({ fajl: f.name, oldal: n, szerep, cim, lap, kep, kepSzel: c.width, kepMag: c.height, szurke, ...(tinta ? { tinta } : {}) });
    page.cleanup();
    halad?.(n, ossz);
  }
  await doc.destroy();
  return ki;
}

export interface AlaprajzFeldolgozas {
  e: AlaprajzEredmeny;
  /** A raszter magjai: a pecséttel rendelkező, nem külső terű helyiségek (a raszter-indexek ehhez igazodnak). */
  magHelyisegek: TervHelyiseg[];
  r: Raszter | null;
  nyilasok: TervNyilas[];
  /** Falhoz nem rendelt nyílásfeliratok (méret, mellvéd, hely). */
  arvaFeliratok?: NyilasFelirat[];
  /** Pecsét nélküli lap: a helyiségek automatikusan felismert zárt terek. */
  auto?: boolean;
  /** Pecsét nélküli lapnál a műszaki leírás helyiséglistájából átvett sorok száma (párosított / csak listában). */
  leiras?: { parositott: number; csakListaban: number };
}

/** A raszter helyiségterületeinek egyezése a pecsétterületekkel (0…1, a pecsétterülettel súlyozva). */
export function pecsetEgyezes(r: Raszter, hs: { A: number }[]): number {
  let s = 0, n = 0;
  r.helyisegek.forEach((h, i) => { const A0 = hs[i]?.A ?? 0; if (!(A0 > 0)) return; s += A0 * Math.min(h.A, A0) / Math.max(h.A, A0); n += A0; });
  return n ? s / n : 0;
}

/**
 * Pecsét nélküli alaprajz + műszaki leírás helyiséglistája: a zárt terek a területük szerint (±12 %, egy-egy
 * párosítás, a legkisebb eltérés előre) kapják a lista kódját, nevét, burkolatát és területét. A párosítatlan zárt
 * terek (a rajz hiányos falai miatt több helyiség egy térben, vagy egy helyiség több részben) a falaik miatt a
 * burokban maradnak, de a területük nem számít (a lista sorai adják); a párosítatlan listasorok csak-jegyzék
 * helyiségként kerülnek be.
 */
function leirasParosit(e: AlaprajzEredmeny, mag: TervHelyiseg[], lista: TervHelyiseg[]): NonNullable<AlaprajzFeldolgozas['leiras']> {
  const sorok = lista.filter((j) => j.A > 0);
  // csak egyértelmű pár: a zárt tér egyetlen listaterülethez (azonos területű sorok egynek számítanak), a listaterület
  // egyetlen zárt térhez illik (a rajz széttöredezett tereinél a kis darabok több sorhoz is illenének – azok kimaradnak)
  const TUR = 0.08;
  const illik = (a: number, b: number) => Math.abs(a - b) / b <= TUR;
  const parok: { i: number; j: number; d: number }[] = [];
  mag.forEach((h, i) => {
    if (h.A < 2.5) return;
    const jo = sorok.map((j, jj) => ({ j, jj })).filter(({ j }) => !j.kulter && illik(h.A, j.A));
    if (new Set(jo.map(({ j }) => j.A.toFixed(2))).size !== 1) return;
    const A = jo[0]!.j.A;
    if (mag.filter((g) => g.A >= 2.5 && illik(g.A, A)).length > jo.length) return;
    for (const { j, jj } of jo) parok.push({ i, j: jj, d: Math.abs(h.A - j.A) / j.A });
  });
  parok.sort((a, b) => a.d - b.d);
  const hFoglalt = new Set<number>(), jFoglalt = new Set<number>();
  for (const p of parok) {
    if (hFoglalt.has(p.i) || jFoglalt.has(p.j)) continue;
    hFoglalt.add(p.i); jFoglalt.add(p.j);
    const h = mag[p.i]!, j = sorok[p.j]!;
    h.kod = j.kod; h.nev = j.nev; if (j.burkolat) h.burkolat = j.burkolat; h.A = j.A;
  }
  mag.forEach((h, i) => { if (!hFoglalt.has(i)) { h.nev = `${h.nev} (listában nem azonosított)`; h.hasznosA = 0; } });
  const csak = sorok.filter((_, jj) => !jFoglalt.has(jj)).map((j) => ({ ...j, forras: 'jegyzek' as const }));
  e.helyisegek = [...e.helyisegek, ...csak];
  e.figyelmeztetesek = e.figyelmeztetesek.filter((x) => !/^Helyiségpecsét nincs a lapon/.test(x));
  e.figyelmeztetesek.push(`Helyiségpecsét nincs a lapon: a helyiségeket a műszaki leírás helyiséglistájából vettem át (${sorok.length} sor). ${hFoglalt.size} zárt teret a területe alapján azonosítottam; ${csak.filter((j) => !j.kulter).length} sornak a helye a rajzon nem ismert (csak területtel kerül át)${mag.length - hFoglalt.size ? `, ${mag.length - hFoglalt.size} zárt tér a listában nem azonosítható (falai a burokban maradnak, területe nem számít)` : ''}. Ellenőrizd a Helyiségek lépésben.`);
  return { parositott: hFoglalt.size, csakListaban: csak.filter((j) => !j.kulter).length };
}

export function alaprajzFeldolgoz(lap: Lap, meretarany?: number, szurke?: SzurkeKep, tinta?: TintaKep, leirasJegyzek?: TervHelyiseg[]): AlaprajzFeldolgozas {
  const e = alaprajzElemez(lap);
  if (meretarany && meretarany > 0) { e.meretarany = meretarany; e.mPerPt = (25.4 / 72) / 1000 * meretarany; }
  // lépték nélküli lap (pl. kicsinyített típusalaprajz): a méretláncokból becsülve
  if (!e.mPerPt) { const M = meretaranyKotabol(lap.szovegek, lap.utvonalak); if (M) { e.meretarany = M; e.mPerPt = (25.4 / 72) / 1000 * M; e.figyelmeztetesek = e.figyelmeztetesek.filter((x) => !/méretarányt nem találtam/.test(x)); e.figyelmeztetesek.push(`A lépték a méretláncokból becsülve: M = 1:${M}. Ellenőrizd, szükség esetén add meg kézzel.`); } }
  let magHelyisegek = e.helyisegek.filter((h) => h.forras === 'pecset' && !h.kulter);
  let leiras: AlaprajzFeldolgozas['leiras'];
  // pecsét nélküli (egyszerűsített) alaprajz: a falakkal körbezárt terek a helyiségek
  const auto = !magHelyisegek.length && !!e.mPerPt;
  if (auto && szurke && !szurke.hatar) szurke = { ...szurke, hatar: arnyalatHatarok(szurke) };
  if (auto) {
    magHelyisegek = automatikusHelyisegek(lap, e.mPerPt!, szurke, tinta);
    // a szürke árnyalat (lakásszínezés) a falhatárt is adja; ha viszont a lapon a szürke sraffozás, minta (burkolat,
    // anyagjelölés), akkor a helyiségeket szétszabdalja: ilyenkor a színkép nélküli felismerés ad több valódi helyiséget
    if (szurke) {
      const pont = (l: TervHelyiseg[]) => l.reduce((s2, h) => s2 + (h.A >= 4 ? h.A : 0), 0);
      const nelkul = automatikusHelyisegek(lap, e.mPerPt!, undefined, tinta);
      if (pont(nelkul) > 1.2 * pont(magHelyisegek)) { magHelyisegek = nelkul; szurke = undefined; }
    }
    e.helyisegek = magHelyisegek;
    if (magHelyisegek.length) e.figyelmeztetesek = e.figyelmeztetesek.filter((x) => !/Helyiséget nem találtam/.test(x));
    if (magHelyisegek.length) e.figyelmeztetesek.push(`Helyiségpecsét nincs a lapon: ${magHelyisegek.length} zárt teret ismertem fel helyiségként (Helyiség 1, 2, …). Jelöld ki a lakás helyiségeit, és nevezd át őket a Helyiségek lépésben.`);
  }
  if (!e.mPerPt || !magHelyisegek.length) return { e, magHelyisegek, r: null, nyilasok: [] };
  const kulsoPontok = e.helyisegek.filter((h) => h.kulter && h.forras === 'pecset').map((h) => h.mutato ?? h);
  const magok = magHelyisegek.map((h) => ({ ...(h.mutato ?? h), A: h.A }));
  let r: Raszter;
  if (auto) {
    // pecsét nélküli lap: a zárt terekből indított elárasztás. Az a „helyiség”, amely a végső raszterben a lap széléig
    // kifolyik, vagy a zárt térként mért területének többszörösére nő (a rajz körüli méretlánc-zseb, keretmező),
    // nem helyiség – kihagyjuk, és újraépítjük a raszter nélküle (különben az egész lapot elárasztja).
    const opc = { px: 0.04, resZaras: 3.0, vastagVonalFal: 0.05, ...(szurke ? { szinKep: szurke } : {})};
    r = raszterEpit(lap, e.mPerPt, magok, opc);
    for (let kor = 0; kor < 12; kor++) {
      const db = new Map<number, number>(); for (let k = 0; k < r.w * r.h; k++) { const c = r.cimke[k]!; if (c >= 2) db.set(c - 2, (db.get(c - 2) ?? 0) + 1); }
      const rossz = new Set(magHelyisegek.map((h, i) => ((r.helyisegek[i]?.szivarog || (db.get(i) ?? 0) * r.px * r.px > Math.max(2 * h.A, h.A + 15)) ? i : -1)).filter((i) => i >= 0));
      if (!rossz.size || rossz.size === magHelyisegek.length) break;
      magHelyisegek = magHelyisegek.filter((_, i) => !rossz.has(i));
      magHelyisegek.forEach((h, i) => { h.nev = `Helyiség ${i + 1}`; });
      e.helyisegek = magHelyisegek;
      magok.splice(0, magok.length, ...magHelyisegek.map((h) => ({ ...(h.mutato ?? h), A: h.A })));
      r = raszterEpit(lap, e.mPerPt, magok, opc);
    }
    e.figyelmeztetesek = e.figyelmeztetesek.map((x) => x.replace(/^Helyiségpecsét nincs a lapon: \d+ zárt teret/, `Helyiségpecsét nincs a lapon: ${magHelyisegek.length} zárt teret`));
    if (leirasJegyzek?.length) leiras = leirasParosit(e, magHelyisegek, leirasJegyzek);
  }
  else {
    // önellenőrzés: több felismerési változat (vektoros fal / + lapkép-„tinta”, ablaksor-szabállyal / nélküle) közül az,
    // amelyben a helyiségek kiterjedése a pecsétben írt területhez a legjobban illik (területtel súlyozott egyezés)
    const kapuk = nyilasFeliratok(lap.szovegek).filter((f) => f.kapuJelolt && f.szel >= 2.5).map((f) => ({ x: f.x, y: f.y, szel: f.szel, fal: f.fal }));
    const alap = { ...(kulsoPontok.length ? { kulsoPontok } : {}), ...(kapuk.length ? { kapuk } : {}) };
    const valtozatok: RaszterBeallitas[] = [alap, { ...alap, ablaksor: false }, ...(tinta ? [{ ...alap, tinta }, { ...alap, tinta, ablaksor: false }] : [])];
    let leg: { r: Raszter; p: number } | null = null;
    for (const v of valtozatok) {
      const rv = raszterEpit(lap, e.mPerPt, magok, v);
      const p = pecsetEgyezes(rv, magHelyisegek);
      // az alapváltozattól csak egyértelmű javulásnál (≥ 3 százalékpont) térünk el – a hajszálnyi különbség zaj
      if (!leg || p > leg.p + 0.03) leg = { r: rv, p };
    }
    r = leg!.r;
  }
  kotaEllenoriz(r, lap.szovegek);
  talajOldal(lap, r, e.helyisegek.filter((h) => h.forras === 'pecset' && !h.kulter).map((h) => h.mutato ?? h));
  szomszedOldal(lap, r);
  // pecsét nélküli típusalaprajz: lakás = egy szürkével színezett, összefüggő terület helyiségei (az x-szel áthúzott aknák nélkül)
  if (auto && szurke && !leiras) {
    const l = lakasCsoportok(r, magHelyisegek, lap, szurke);
    if (l.egysegek.length) {
      e.egysegek = l.egysegek; e.egysegInfo = l.info;
      // a helyiségként külön fel nem ismert lakásrészek (előtér, fürdő) – raszterindex nélkül, csak területtel
      e.helyisegek = [...e.helyisegek, ...l.kiegeszito];
      e.figyelmeztetesek.push(`${l.egysegek.length} lakást ismertem fel a szürke színezésből (egy lakás = egy összefüggő színezett terület, az x-szel áthúzott aknák nélkül). Válaszd ki a lakást a táblázatban.`);
    }
  }
  // falfülke (padlótól induló, sraffozott falszakasz előtti felirat): nem nyílászáró – kimarad az átvételből
  const feliratok = nyilasFeliratok(lap.szovegek);
  const nyilasok = nyilasokHozzarendel(feliratok, r, magHelyisegek.map((h) => h.nev), auto)
    .map((n) => (n.fajta !== 'belso_ajto' && falfulkeE(n, r, lap) ? { ...n, fajta: 'falfulke' as const, kulso: false } : n));
  // ugyanannak a kapunak két felirata (pl. falnyílás- és tokmagasság külön: „3,75 / 2,25” és „3,75 / 2,40”): azonos
  // helyiség, irány és szélesség, a kapu szélességén belül egymás mellett → egy kapu (az alacsonyabb marad)
  for (let i = nyilasok.length - 1; i >= 0; i--) {
    const a = nyilasok[i]!; if (a.fajta !== 'garazskapu') continue;
    const j = nyilasok.findIndex((b, k) => k !== i && b.fajta === 'garazskapu' && b.helyiseg === a.helyiseg && b.irany === a.irany && Math.abs(b.szel - a.szel) < 0.01 && Math.hypot(b.x - a.x, b.y - a.y) * r.mPerPt < a.szel);
    if (j >= 0) { const b = nyilasok[j]!; if (a.mag < b.mag) nyilasok[j] = a; nyilasok.splice(i, 1); }
  }
  // felirat nélküli függönyfalak, üvegfalak (széles, üvegezett falszakasz a fűtött helyiség és a külső tér határán)
  nyilasok.push(...fuggonyfalak(r, nyilasok, magHelyisegek.map((h) => h.mutato ?? h)));
  // méretfelirat nélküli (pl. csak típusjeles) homlokzati nyílások: a falnyílás mért szélességével
  {
    // méretfeliratos lapon (≥ 5 feliratos külső nyílás, típusjel-feliratok nélkül) a felirat nélküli keskeny (< 0,6 m)
    // „nyílás” rajzi rés (beépített szekrény, pillér, csatorna) – nem nyílászáró
    const kodok = new Set(e.helyisegek.map((h) => (h.kod ?? '').trim()));
    const tipusjel = lap.szovegek.filter((t) => /^[A-ZÁÉ]{1,4}[-_.]?\d{1,3}[A-Z]?$/.test(t.s.trim()) && !kodok.has(t.s.trim())).length;
    const feliratos = nyilasok.filter((n) => n.kulso && n.fajta !== 'fuggonyfal' && !n.mert).length;
    const keskenyKi = feliratos >= 5 && tipusjel < 3;
    nyilasok.push(...jeloletlenNyilasok(r, nyilasok).filter((n) => !(keskenyKi && n.szel < 0.6)));
  }
  // lakáson belüli helyiség (előszoba, tároló, kamra, vizes helyiség) mellvéd nélküli ajtaja: a lakás bejárati ajtaja a közös
  // térbe (lépcsőház, folyosó) – akkor is, ha a túloldali tér nincs pecsételve (a rajz szerint „kültér”)
  for (const n of nyilasok) if (n.kulso && n.pm === null && n.fajta === 'bejarati_ajto' && /előszoba|eloszoba|tároló|tarolo|kamra|wc|fürdő|furdo|gardrób|gardrob/i.test(magHelyisegek[n.helyiseg ?? -1]?.nev ?? '')) { n.kulso = false; n.fajta = 'belso_ajto'; }
  // bejárat: az előtér / szélfogó / lépcsőház padlószintű külső nyílásai közül a legszélesebb az (üvegezett) bejárati ajtó,
  // a többi mellette lévő üvegezés (ablak)
  const BEJARAT = /előtér|eloter|szélfogó|szelfogo|bejárat|bejarat|lépcső|lepcso|közlekedő|kozlekedo|lobby|hall/i;
  // csoport: azonos homlokzati irányú, egymástól legfeljebb 5 m-re lévő bejárati nyílások (előtér + mellette a lépcsőház üvegezése)
  const jelolt = nyilasok.filter((n) => n.kulso && n.helyiseg !== null && n.pm !== null && n.pm <= 0.05 && n.mag >= 2 && (n.fajta === 'erkelyajto' || n.fajta === 'bejarati_ajto') && BEJARAT.test(magHelyisegek[n.helyiseg]?.nev ?? ''));
  const csoportok: TervNyilas[][] = [];
  for (const n of jelolt) {
    const c = csoportok.find((l) => l.some((m) => m.irany === n.irany && Math.hypot(m.x - n.x, m.y - n.y) * r.mPerPt <= 5));
    if (c) c.push(n); else csoportok.push([n]);
  }
  const BEJ = /előtér|eloter|szélfogó|szelfogo|bejárat|bejarat|lobby|hall/i;
  for (const l of csoportok) {
    // ajtó csak ott, ahol előtér / szélfogó is van a csoportban; a magában álló lépcsőházi üvegezés (emeleteken) ablak
    const bejaratos = l.filter((n) => BEJ.test(magHelyisegek[n.helyiseg!]?.nev ?? ''));
    if (!bejaratos.length) { for (const n of l) n.fajta = 'ablak'; continue; }
    const ajto = bejaratos.reduce((a, b) => (b.szel > a.szel ? b : a));
    for (const n of l) n.fajta = n === ajto ? 'bejarati_uvegajto' : 'ablak';
  }
  // falhoz nem rendelt nyílásfeliratok (pl. a raszterben nem lezárt, üvegfalas helyiség homlokzatán): a szerkesztett hőburok használja
  const arva = feliratok.filter((f) => !nyilasok.some((n) => Math.hypot(n.x - f.x, n.y - f.y) < 2));
  return { e, magHelyisegek, r, nyilasok, auto, arvaFeliratok: arva, ...(leiras ? { leiras } : {}) };
}

export interface MetszetFeldolgozas {
  blokkok: { rr: TervRetegrend; becsles: SzerepBecsles; retegek: TervRetegUI[] }[];
  szintek: SzintEredmeny;
  /** Tetőtér-beépítés adatai (hajlásszög, térdfal), ha a metszeten van tetőhajlás-felirat. */
  tetoter: TetoterAdat | null;
}

/**
 * Egy rétegrendbe írt „tetőfedés + fűtetlen padlástér + padlásfödém” (pl. „magastető belső tér felett”): a hőburok
 * a padlástér alatti rész, ezért a padlástér-sor utáni rétegek padlásfödémként kerülnek át.
 */
function padlasBontas(rr: TervRetegrend): TervRetegrend {
  const i = rr.retegek.findIndex((r) => r.dCm === null && !r.rtg && /^(fűtetlen |hideg |átszellőz\S* )?(padlás)?tér$|padlástér|^légtér$/i.test(r.leiras.trim()));
  if (i < 0 || i >= rr.retegek.length - 1 || !/tető|teto/i.test(rr.cim)) return rr;
  return { ...rr, cim: `${rr.cim} – padlásfödém (a padlástér alatt)`, retegek: rr.retegek.slice(i + 1) };
}

export function metszetFeldolgoz(lap: Lap): MetszetFeldolgozas {
  const b = retegrendBlokkok(lap.szovegek).map(padlasBontas);
  return {
    blokkok: b.map((rr) => { const becsles = szerepBecsles(rr, b); return { rr, becsles, retegek: retegekEpit(rr, becsles, ujId) }; }),
    szintek: szintekKeres(lap.szovegek),
    tetoter: tetoterKeres(lap.szovegek, szintekKeres(lap.szovegek)),
  };
}

// ——— északjel-javítások megjegyzése (alakonként) ———

const JAVITAS_KULCS = 'ekm-eszakjel-javitas-v2';
/** Ismert irodai északjelek: az alak ujjlenyomata → a becsült iránytól való elteres (fok). */
const ISMERT: Record<string, number> = {
  // (a PH Navitas jelénél az alakbecslés helyes iránya ellenőrzött – nincs szükség javításra)
};
export function eszakJavitas(alairas: string | undefined): number {
  if (!alairas) return 0;
  try { const t = JSON.parse(localStorage.getItem(JAVITAS_KULCS) ?? '{}') as Record<string, number>; if (alairas in t) return t[alairas]!; } catch { /* nincs tároló */ }
  return ISMERT[alairas] ?? 0;
}
export function eszakJavitasMent(alairas: string | undefined, elteres: number) {
  if (!alairas) return;
  try { const t = JSON.parse(localStorage.getItem(JAVITAS_KULCS) ?? '{}') as Record<string, number>; t[alairas] = ((elteres % 360) + 360) % 360; localStorage.setItem(JAVITAS_KULCS, JSON.stringify(t)); } catch { /* nincs tároló */ }
}

/**
 * Szomszédos épülethez csatlakozó falak: a külső falszakasz mögött (kifelé, ≤ 4 m-en belül, a szakasz mentén legfeljebb
 * 1,5 m-rel túlnyúlva) „szomszédos épület”, „szomszéd ingatlan”, „zártsorú”, „tűzfal” felirat áll. A felirat elforgatva
 * (a fal mentén) is állhat: a kezdőpontja és a közepe is számít.
 */
export function szomszedOldal(lap: Lap, r: Raszter) {
  const SZ = /szomsz[ée]d(?:os)?\s+(?:épület|ingatlan|telek|ház)|zártsor|tűzfal|ikres\s+csatlakoz/i;
  // a felirat szakasza (kezdő- és végpont; elforgatva a fal mentén is állhat)
  const szakasz = lap.szovegek.filter((t) => SZ.test(t.s)).map((t) => {
    const a = (t.szog ?? 0) * Math.PI / 180;
    return { x0: t.x, y0: t.y, x1: t.x + Math.cos(a) * t.szel, y1: t.y - Math.sin(a) * t.szel };
  });
  const pontok = szakasz;
  if (!pontok.length) return;
  const m = r.mPerPt;
  for (const H of r.helyisegek) for (const sg of H.szakaszok) {
    if (sg.tul !== 'kulso' || !sg.pontok.length) continue;
    const fugg = sg.irany === 90 || sg.irany === 270; // a fal függőleges a lapon
    const kifele = sg.irany === 0 || sg.irany === 270 ? -1 : 1;
    const c = sg.pontok.reduce((s0, q) => s0 + (fugg ? q[0] : q[1]), 0) / sg.pontok.length;
    const menten = sg.pontok.map((q) => (fugg ? q[1] : q[0]));
    const a0 = Math.min(...menten), a1 = Math.max(...menten);
    sg.szomszed = pontok.some((f) => {
      // a felirat (középpontja) a fal mögött 4 m-en belül, és a fal mentén átfed a szakasszal (1,5 m tűréssel)
      const kx = (f.x0 + f.x1) / 2, ky = (f.y0 + f.y1) / 2;
      const kereszt = ((fugg ? kx : ky) - c) * kifele * m;
      const f0 = Math.min(fugg ? f.y0 : f.x0, fugg ? f.y1 : f.x1), f1 = Math.max(fugg ? f.y0 : f.x0, fugg ? f.y1 : f.x1);
      return kereszt > 0 && kereszt <= 4 && f1 >= a0 - 1.5 / m && f0 <= a1 + 1.5 / m;
    });
  }
}
