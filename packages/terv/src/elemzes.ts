/**
 * A tervlapok teljes feldolgozása: PDF megnyitása pdf.js-szel (böngészőben, munkaszál nélkül), lapok szerepének
 * felismerése, alaprajz (helyiségek, északjel, raszter, külső falak, nyílászárók) és metszet (rétegrendek, szintek).
 */
import { lapKinyer, type Lap } from './kinyeres';
import { alaprajzElemez, meretaranyKeres, kulterNev, szintekCimbol, eszakjelKeres, jegyzekSorok, jegyzekCsoportok, type AlaprajzEredmeny, type TervHelyiseg } from './alaprajz';
import { retegSzures } from './retegek';
import { rajzpecsetTeglalap, pecsetKeretNelkul } from './rajzpecset';
import { lapOsztalyozas, tisztaLap } from './lapTisztitas';
import { pdfZonakNyers, zonakSzur, poliTer, poliBenne, belsoPont } from './zonak';
import { raszterEpit, type Raszter, type RaszterBeallitas } from './raszter';
import { gepkocsik } from './gepkocsi';
import { kotaEllenoriz } from './kota';
import type { TintaKep } from './tinta';
import { meretaranyKotabol, automatikusHelyisegek, lakasCsoportok, arnyalatHatarok, type SzurkeKep } from './autohelyiseg';
import { terdfalGeometria, tetoHajlasRajzbol, padloigEroTeto, type PadloigTeto } from './metszetGeom';
import { fuggonyfalak, szarnyFeliratE, jeloletlenNyilasok, lancNyilasok, tetoablakJelek, type TetoablakJel, nyilasFeliratok, nyilasokHozzarendel, falfulkeE, type TervNyilas, type NyilasFelirat } from './nyilaszarok';
import { talajOldal } from './talaj';
import { retegrendBlokkok, szerepBecsles, retegekEpit, szintekKeres, tetoterKeres, type TetoterAdat, type TervRetegrend, type SzerepBecsles, type TervRetegUI, type SzintEredmeny } from './metszet';
import { ujId } from './tipusok';

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

/** Vászon: a fő szálon <canvas>, munkaszálon (Web Worker) OffscreenCanvas. */
type Vaszon = HTMLCanvasElement | OffscreenCanvas;
const vaszon = (w: number, h: number): Vaszon => {
  if (typeof document !== 'undefined') { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  return new OffscreenCanvas(w, h);
};
const ctx2d = (c: Vaszon, o?: CanvasRenderingContext2DSettings) => c.getContext('2d', o) as CanvasRenderingContext2D;
async function jpegUrl(c: Vaszon, q: number): Promise<string> {
  if ('toDataURL' in c) return c.toDataURL('image/jpeg', q);
  const b = await c.convertToBlob({ type: 'image/jpeg', quality: q });
  return await new Promise<string>((ok, hiba) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => hiba(r.error); r.readAsDataURL(b); });
}
/** Munkaszálon a pdf.js „dokumentuma”: betűkészletek a munkaszál FontFaceSet-jébe, vásznak OffscreenCanvas-ként. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const munkaszalDok = (): any => ({ fonts: (globalThis as unknown as { fonts?: unknown }).fonts, createElement: (t: string) => { if (t === 'canvas') return new OffscreenCanvas(1, 1); throw new Error(`createElement(${t}) munkaszálon`); } });
/**
 * A pdf.js WebAssembly-dekódolói (JBIG2 / CCITT-fax, JPEG 2000, ICC) helye – nélkülük a pdf.js a lap tartalmát az első
 * ilyen kép után elhagyja („ignoring errors during GetOperatorList”): a Ghostscripttel nyomtatott tervlapon a mintás
 * (sraffozott) falkitöltés CCITT-maszkokból áll, és a lap kétharmada – a falak – hiányzott (Budai NA tetőtér,
 * 2026-11-23). A fájlok a modul mellett, a pdfjs-wasm/ mappában (a build másolja); felülírható: globalThis.PDFJS_WASM_URL.
 */
export function pdfjsWasmUrl(): string | undefined {
  const g = globalThis as { PDFJS_WASM_URL?: string }; if (g.PDFJS_WASM_URL) return g.PDFJS_WASM_URL;
  // (a mappanév összefűzve: a Vite a szó szerinti new URL(…, import.meta.url) mintát fájlhivatkozásként kezelné)
  try { return new URL('pdfjs-' + 'wasm/', import.meta.url).href; } catch { return undefined; }
}
const docBeall = () => { const wasmUrl = pdfjsWasmUrl(); return { ...(wasmUrl ? { wasmUrl } : {}), ...(typeof document === 'undefined' ? { ownerDocument: munkaszalDok() } : {}) }; };

/**
 * A vászon szürkeárnyalatos, kicsinyített (≈ 600 px széles) másolata blokkátlagolással és 3×3-as simítással – a
 * mintázattal (pontraszterrel) kitöltött színezés így egyenletes szürke lesz. ptPx: 1 pt hány képpont.
 */
function szurkeKep(c: Vaszon, scale: number): SzurkeKep | undefined {
  try {
    const W = c.width, H = c.height; const px = ctx2d(c).getImageData(0, 0, W, H).data;
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
// (birtokos alakban is: „Földszint alaprajza”, „Keleti homlokzata”)
const CIM_SZO = /(alaprajz(?:ok|a|ai)?|(?:kereszt|hossz)?metszet(?:ek|e|ei)?|homlokzat(?:ok|a|ai)?|helyszínrajz(?:a)?|tetőfelülnézet(?:e)?)(?![\p{L}])/iu;

export function lapSzerep(lap: Lap, fajlnev = '', tobbLapos = false): { szerep: TervLap['szerep']; cim: string } {
  const sz = lap.szovegek.map((t) => t.s).join(' \n ');
  // a legnagyobb betűméretű cím-jelölt (a rajzpecsét lapcíme vagy a rajz alatti felirat)
  const jeloltek = lap.szovegek.filter((t) => t.s.trim().length <= 70 && CIM_SZO.test(t.s) && !/szerint|lásd|ld\./i.test(t.s));
  // elsőként a rajzpecsét nagy (≥ 12 pt) lapcíme; ha nincs, a legnagyobb cím-jelölt(ek) – több rajz egy lapon: mind
  const nagy = jeloltek.find((t) => t.meret >= 12);
  const legnagyobb = Math.max(0, ...jeloltek.map((t) => t.meret));
  // (két sorba tördelt cím – „Harmadik emeleti” / „alaprajz_I-II ütem” –: a közvetlenül fölötte / alatta álló, azonos
  // betűméretű, azonos kezdetű sorral együtt)
  const sorral = (t: Lap['szovegek'][number]) => {
    const tars = (u: Lap['szovegek'][number], fel: boolean) => lap.szovegek.find((v) => v !== u && v !== t && Math.abs(v.meret - u.meret) < 0.3 && Math.abs(v.x - u.x) < u.meret
      && (fel ? u.y - v.y : v.y - u.y) > u.meret * 0.6 && (fel ? u.y - v.y : v.y - u.y) < u.meret * 1.6 && /\p{L}{3}/u.test(v.s) && v.s.trim().length <= 40);
    const fel = tars(t, true), le = tars(t, false);
    return [fel, t, le].filter(Boolean).map((v) => v!.s.trim()).join(' ');
  };
  const cim = nagy ? sorral(nagy) : [...new Set(jeloltek.filter((t) => t.meret >= legnagyobb - 0.5).map((t) => sorral(t)))].join(' · ');
  // szöveges dokumentum (műszaki leírás): fájlnév szerint, vagy rajzcím nélküli, kevés vonalú, hosszú mondatos lap
  const fn = fajlnev.normalize('NFC');
  const mondat = lap.szovegek.filter((t) => t.s.trim().length >= 50).length;
  if (/m[űuü]\s*le[íi]r[áa]s|műszaki[_\s-]*leírás|leiras|tervezői\s*nyilatkozat/i.test(fn) || (!cim && lap.utvonalak.length < 40 && mondat >= 8 && /műszaki\s+leírás/i.test(sz))) return { szerep: 'leiras', cim: 'Műszaki leírás' };
  const fajta = (x: string) => (/metszet/i.test(x) ? 'metszet' : /alaprajz/i.test(x) ? 'alaprajz' : /homlokzat/i.test(x) ? 'homlokzat' : null);
  // többlapos PDF: a fájlnév az egész dokumentumé (pl. „Tervdokumentáció”, „Alaprajzok”) – a lap saját címe és
  // tartalma dönt, a fájlnév csak utolsó tartalék
  const fNev = fajta(fajlnev.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').normalize('NFC'));
  // tetőfelülnézet / tetőalaprajz (akár „Tetőfelülnézet alaprajz” címmel): a tető alaprajza, nem szint – a tetőformához.
  // A cím vagy a fájlnév („MV-02_TE_Teto_felulnezet”) szerint; a „tetőtéri” / „tetőszinti alaprajz” szint, nem tető. A
  // cím „Tetőfelülnézet”-tel kezdődik (a tetőformát kereső lépések erre szűrnek).
  const tetoRx = /tet[őoö]\s*fel[üu]ln[ée]zet|tet[őoö]\s*alaprajz/i;
  const fnT = fn.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ');
  if (tetoRx.test(cim) || (!fajta(cim) || /metszet/i.test(cim)) && tetoRx.test(fnT) && !/metszet|homlokzat/i.test(fnT))
    return { szerep: 'egyeb', cim: /fel[üu]ln[ée]zet/i.test(cim) ? cim : `Tetőfelülnézet${cim && !/metszet/i.test(cim) ? ` · ${cim}` : ''}` };
  const f = fajta(cim) ?? (tobbLapos ? null : fNev);
  if (f) return { szerep: f, cim: cim || fajlnev.replace(/\.pdf$/i, '') };
  // helyszínrajz: nem alaprajz (a telek terület-feliratai miatt sem)
  if (/helysz[íi]nrajz/i.test(cim) || (!cim && /helysz[íi]nrajz/i.test(fn))) return { szerep: 'egyeb', cim: cim || 'Helyszínrajz' };
  if (/rétegrend/i.test(sz) && /[±+]\d,\d{2}/.test(sz)) return { szerep: 'metszet', cim: cim || 'Metszet' };
  if (/\d+[,.]\d{2}\s*m(²|2)/.test(sz)) return { szerep: 'alaprajz', cim: cim || 'Alaprajz' };
  if (tobbLapos && fNev) return { szerep: fNev, cim: cim || fajlnev.replace(/\.pdf$/i, '') };
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
      utvonalak: lap.utvonalak.filter((u) => { const x = (u.bbox[0] + u.bbox[2]) / 2, y = (u.bbox[1] + u.bbox[3]) / 2; return resz(x, y) === i || (jel(x, y) && Math.max(u.bbox[2] - u.bbox[0], u.bbox[3] - u.bbox[1]) < 200); }),
      ...(lap.retegek ? { retegek: lap.retegek } : {}), ...(zonakSzur(lap.zonak, (x, y) => resz(x, y) === i) ? { zonak: zonakSzur(lap.zonak, (x, y) => resz(x, y) === i) } : {}) },
  }));
}

/** A lap szürkeképe ≈ 1,5 képpont / pt felbontásban (a „tinta” falfelismeréshez; 1:100-nál ≈ 2,4 cm / képpont, ≤ 16 M képpont). */
async function tintaRender(page: any): Promise<TintaKep | undefined> {
  try {
    const vp0 = page.getViewport({ scale: 1 });
    const ts = Math.min(1.5, Math.sqrt(16e6 / (vp0.width * vp0.height)));
    const tv = page.getViewport({ scale: ts });
    const tc = vaszon(Math.round(tv.width), Math.round(tv.height));
    const tx = ctx2d(tc, { willReadFrequently: true }); tx.fillStyle = '#fff'; tx.fillRect(0, 0, tc.width, tc.height);
    await page.render({ canvasContext: tx, viewport: tv, canvas: tc }).promise;
    const px = tx.getImageData(0, 0, tc.width, tc.height).data; const adat = new Uint8Array(tc.width * tc.height);
    for (let i = 0; i < adat.length; i++) adat[i] = Math.round(0.299 * px[i * 4]! + 0.587 * px[i * 4 + 1]! + 0.114 * px[i * 4 + 2]!);
    return { w: tc.width, h: tc.height, ptPx: ts, adat };
  } catch { return undefined; }
}

/** Utólag alaprajznak jelölt lap (a felismerés nem annak vette) tinta-képe – a fájl adott oldaláról. */
export async function lapTinta(f: File, oldal: number): Promise<TintaKep | undefined> {
  const pdfjs = await pdfjsBetolt();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await f.arrayBuffer()), verbosity: 0, isEvalSupported: false, ...docBeall() }).promise;
  return tintaRender(await doc.getPage(oldal));
}

export async function pdfLapok(f: File, kepSzel = 2000, halad?: (kesz: number, ossz: number) => void): Promise<TervLap[]> {
  const pdfjs = await pdfjsBetolt();
  const bajtok = new Uint8Array(await f.arrayBuffer());
  // ArchiCAD-zónák (helyiségkörvonalak) a lapszótárból – a pdf.js a bájtokat átviszi a workerbe, ezért előtte olvassuk
  const zonakNyers = await pdfZonakNyers(bajtok);
  const doc = await pdfjs.getDocument({ data: bajtok, verbosity: 0, isEvalSupported: false, ...docBeall() }).promise;
  const ki: TervLap[] = [];
  const ossz = Math.min(doc.numPages, 30);
  // PDF-rétegek (ArchiCAD-rétegek): a réteg neve a fal / hőszigetelés / helyiség felismeréséhez
  const oc = await doc.getOptionalContentConfig().catch(() => null);
  halad?.(0, ossz);
  for (let n = 1; n <= ossz; n++) {
    const page = await doc.getPage(n);
    const lap = await lapKinyer(pdfjs, page, oc);
    { const zn = zonakNyers.get(n - 1); const vpz = page.getViewport({ scale: 1 }); if (zn) lap.zonak = zn.map((z) => ({ nev: z.nev, pontok: z.pdf.map(([x, y]) => vpz.convertToViewportPoint(x, y) as [number, number]) })); }
    const vp0 = page.getViewport({ scale: 1 });
    const scale = Math.min(3, kepSzel / vp0.width);
    const vp = page.getViewport({ scale });
    const c = vaszon(Math.round(vp.width), Math.round(vp.height));
    const ctx = ctx2d(c); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport: vp, canvas: c }).promise;
    const { szerep: szerep0, cim } = lapSzerep(lap, f.name, doc.numPages > 1);
    // közös lap („ALAPRAJZ-METSZET”): helyiségpecsétekkel alaprajzként is, a metszet pedig ugyanerről a lapról
    const kozos = szerep0 === 'metszet' && /alaprajz/i.test(cim) && /\d+[,.]\d{2}\s*m(²|2)/.test(lap.szovegek.map((t) => t.s).join(' \n '));
    const szerep = kozos ? 'alaprajz' : szerep0;
    const tinta = szerep === 'alaprajz' ? await tintaRender(page) : undefined;
    const kep = await jpegUrl(c, 0.82), szurke = szurkeKep(c, scale);
    const reszek = szerep === 'alaprajz' ? lapFeloszt(lap) : [];
    if (reszek.length) for (const r of reszek) ki.push({ fajl: f.name, oldal: n, szerep, cim: r.cim, lap: r.lap, kep, kepSzel: c.width, kepMag: c.height, szurke, ...(tinta ? { tinta } : {}) });
    else ki.push({ fajl: f.name, oldal: n, szerep, cim, lap, kep, kepSzel: c.width, kepMag: c.height, szurke, ...(tinta ? { tinta } : {}) });
    if (kozos) ki.push({ fajl: f.name, oldal: n, szerep: 'metszet', cim, lap, kep, kepSzel: c.width, kepMag: c.height, szurke });
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
  /** Belső ajtók (vegyes írású „90 / 2,10” vagy belső falnyíláshoz kötött méteres ajtófeliratból); csak az
   * épületmodellnek (a hőburok-átvétel a `nyilasok`-at használja). */
  modellAjtok?: TervNyilas[];
  /** A 3D modellhez és a burokhoz: a vektoros falfelismerés raszterje (azonos helyiség-indexekkel), ha jobban illik. */
  r3d?: Raszter;
  nyilasok: TervNyilas[];
  /** Falhoz nem rendelt nyílásfeliratok (méret, mellvéd, hely). */
  arvaFeliratok?: NyilasFelirat[];
  /** Az alaprajzon jelölt (X-szel áthúzott keretű) tetősík ablakok. */
  tetoablakok?: TetoablakJel[];
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
 * A helyiségek határának falfedettsége (0…1): a helyiséghatár-cellák hányadánál van 10 cm-en belül fal vagy áthidalt
 * nyílás a helyiségen kívül. Zónás (ArchiCAD-zóna) lapon a helyiségek kiterjedése a zónából jön, így a pecsétterület
 * minden változatban egyezik – ott ez dönt: csak sraffozással (kitöltés nélkül) rajzolt falat a vektoros változat nem
 * lát, a lapkép-„tinta” igen.
 */
/** Zárt beltéri helyiség neve – ilyen nevű tér a hiányos falak ellenére sem nyitott (a fal felismerése hibázott). */
const BELTER_NEV = /szoba|nappali|konyha|étkező|etkezo|fürdő|furdo|\bwc\b|háló|halo|előtér|eloter|előszoba|közlekedő|kozlekedo|folyosó|folyoso|iroda|gardrób|gardrob|kamra|tároló|tarolo|garázs|garazs|műhely|muhely|raktár|raktar|lépcső|lepcso|gépész|gepesz|kazán|kazan|mosó|moso|dolgozó|dolgozo|öltöző|oltozo|zuhany|szauna|terem|csarnok|üzem|uzem|labor|rendelő|rendelo|váró|varo|iroda|tanuló|tanulo|játszó|jatszo|spájz|spajz|pince|padlás|padlas/i;
export function falFedettseg(r: Raszter): number {
  const t = fedettsegSzamlalo(r); let h = 0, f = 0; for (let i = 0; i < t.hatar.length; i++) { h += t.hatar[i]!; f += t.fedett[i]!; }
  return h ? f / h : 0;
}
/** Helyiségenként (raszterindex szerint) a határcellák és a fallal / nyílással fedettek száma. */
export function fedettsegSzamlalo(r: Raszter): { hatar: number[]; fedett: number[] } {
  const { w, h } = r; const d = Math.max(1, Math.round(0.1 / r.px));
  const hatar = r.helyisegek.map(() => 0), fedett = r.helyisegek.map(() => 0);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const k = y * w + x, c = r.cimke[k]!; if (c < 2 || c - 2 >= hatar.length) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      if (r.cimke[k + dy * w + dx] === c) continue;
      // (a fal nélkül közvetlenül szomszédos helyiség – egybenyitott tér zónahatára – nem számít: csak a külső tér felé)
      let fed = false, hely = false;
      for (let t = 1; t <= d; t++) { const xx = x + dx * t, yy = y + dy * t; if (xx < 0 || yy < 0 || xx >= w || yy >= h) break; const q = yy * w + xx; if (r.fal[q] || r.nyilas[q]) { fed = true; break; } if (r.cimke[q]! >= 2 && r.cimke[q] !== c) { hely = true; break; } }
      if (!hely) { hatar[c - 2]!++; if (fed) fedett[c - 2]!++; }
      break;
    }
  }
  return { hatar, fedett };
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
  // a berajzolt gépkocsi szerint felvett tér (garázs) a lista egyetlen, még szabad garázs-sorához (név szerint)
  mag.forEach((h, i) => {
    if (hFoglalt.has(i) || !h.gepkocsi) return;
    const jj = sorok.map((j, k) => ({ j, k })).filter(({ j, k }) => !jFoglalt.has(k) && /gar[aá]zs|gépkocsi|gepkocsi|beálló/i.test(j.nev));
    if (jj.length !== 1) return;
    const { j, k } = jj[0]!; hFoglalt.add(i); jFoglalt.add(k);
    h.kod = j.kod; h.nev = j.nev; if (j.burkolat) h.burkolat = j.burkolat; h.A = j.A;
  });
  mag.forEach((h, i) => { if (!hFoglalt.has(i)) { h.nev = `${h.nev} (listában nem azonosított)`; h.hasznosA = 0; } });
  const csak = sorok.filter((_, jj) => !jFoglalt.has(jj)).map((j) => ({ ...j, forras: 'jegyzek' as const }));
  e.helyisegek = [...e.helyisegek, ...csak];
  e.figyelmeztetesek = e.figyelmeztetesek.filter((x) => !/^Helyiségpecsét nincs a lapon/.test(x));
  e.figyelmeztetesek.push(`Helyiségpecsét nincs a lapon: a helyiségeket a műszaki leírás helyiséglistájából vettem át (${sorok.length} sor). ${hFoglalt.size} zárt teret a területe alapján azonosítottam; ${csak.filter((j) => !j.kulter).length} sornak a helye a rajzon nem ismert (csak területtel kerül át)${mag.length - hFoglalt.size ? `, ${mag.length - hFoglalt.size} zárt tér a listában nem azonosítható (falai a burokban maradnak, területe nem számít)` : ''}. Ellenőrizd a Helyiségek lépésben.`);
  return { parositott: hFoglalt.size, csakListaban: csak.filter((j) => !j.kulter).length };
}

/**
 * ArchiCAD-zónákból helyiségek: az azonos nevű, egymás mellett (≤ 0,6 m) fekvő darabok (a helyiség és ajtóbélletei)
 * egy helyiség. A név első, számot tartalmazó szava a kód. A zónán belüli pecsét adja a kódot, nevet, burkolatot és a
 * pecsétben írt területet; pecsét nélkül a zóna területe számít.
 */
function zonaHelyisegek(zonak: NonNullable<Lap['zonak']>, pecsetek: TervHelyiseg[], mPerPt: number): { h: TervHelyiseg; poli: [number, number][][]; pecset?: TervHelyiseg }[] {
  const n = zonak.length; const szulo = zonak.map((_, i) => i);
  const gyoker = (i: number): number => (szulo[i] === i ? i : (szulo[i] = gyoker(szulo[i]!)));
  const bb = zonak.map((z) => [Math.min(...z.pontok.map((q) => q[0])), Math.min(...z.pontok.map((q) => q[1])), Math.max(...z.pontok.map((q) => q[0])), Math.max(...z.pontok.map((q) => q[1]))]);
  const tav = 0.6 / mPerPt;
  const elotagNevek = new Map<string, Set<string>>();
  for (const z of zonak) { const m = /^(\S*\d\S*)\s+(.+)$/.exec(z.nev.replace(/\s+/g, ' ').trim()); if (m) elotagNevek.set(m[1]!, (elotagNevek.get(m[1]!) ?? new Set()).add(m[2]!.toLowerCase())); }
  const katE = [...elotagNevek].filter(([, v]) => v.size >= 3).map(([k]) => k);
  // (ha az előtagok legalább fele ilyen kategória, a rajz előtagjai mind kategóriák – a két „1.3 Előtér” is)
  const kategoriaElotag = new Set(katE.length && katE.length * 2 >= elotagNevek.size ? [...elotagNevek.keys()] : katE);
  const pecsetBenne = (i: number) => pecsetek.find((h) => poliBenne(zonak[i]!.pontok, (h.mutato ?? h).x, (h.mutato ?? h).y));
  // (csoportonként a benne lévő pecsét – a láncolt összevonás sem köthet össze két pecsétes zónát egy közös ajtóbéllet-darabon át)
  const csPecset = zonak.map((_, i) => pecsetBenne(i));
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    if (zonak[i]!.nev !== zonak[j]!.nev) continue;
    // azonos nevű, de két külön pecsétet tartalmazó zóna két helyiség (a két lakás „10 fürdő”-je), nem egy darabolt zóna
    const gi = gyoker(i), gj = gyoker(j); if (gi === gj) continue;
    const pi = csPecset[gi], pj = csPecset[gj];
    if (pi && pj && pi !== pj) continue;
    const a = bb[i]!, b = bb[j]!;
    if (a[0]! - tav <= b[2]! && b[0]! - tav <= a[2]! && a[1]! - tav <= b[3]! && b[1]! - tav <= a[3]!) { szulo[gi] = gj; csPecset[gj] = pj ?? pi; }
  }
  const csop = new Map<number, number[]>(); for (let i = 0; i < n; i++) { const g = gyoker(i); csop.set(g, [...(csop.get(g) ?? []), i]); }
  const foglalt = new Set<TervHelyiseg>();
  const ki: { h: TervHelyiseg; poli: [number, number][][]; pecset?: TervHelyiseg }[] = [];
  for (const tagok of csop.values()) {
    const poli = tagok.map((i) => zonak[i]!.pontok);
    const A = poli.reduce((s2, p) => s2 + Math.abs(poliTer(p)), 0) * mPerPt * mPerPt;
    if (A < 0.3) continue;
    const fo = poli.reduce((a, b) => (Math.abs(poliTer(b)) > Math.abs(poliTer(a)) ? b : a));
    const [x, y] = belsoPont(fo);
    const nev0 = zonak[tagok[0]!]!.nev.replace(/\s+/g, ' ').trim();
    const m = /^(\S*\d\S*)\s+(.+)$/.exec(nev0);
    // a több (≥ 3) különböző nevű zóna elején ismétlődő előtag („1.4 Szoba”, „1.4 Nappali”) zónakategória, nem helyiségkód
    const kod = m && !kategoriaElotag.has(m[1]!) ? m[1] : undefined, nev = m ? m[2]! : nev0 || 'Helyiség';
    // a zóna pecsétje: az azonos kódú (a lapon egyetlen) pecsét; ennek híján a zónán belüli, ha a kódja vagy a területe
    // egyezik (a zónába eső, más kódú és területű pecsét – pl. a szomszéd kis helyiség mutatóvonal nélküli pecsétje – nem)
    const kn = (q?: string) => (q ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const azonos = kod ? pecsetek.filter((h) => !foglalt.has(h) && kn(h.kod) === kn(kod)) : [];
    // ennek híján (a kis helyiség pecsétje a zónán kívülre lóg): a legközelebbi, azonos nevű, a zóna kódjára végződő kódú
    // és a zónával egyező (± 5 %) területű szabad pecsét – a két lakás „01 Előtér”-e a „L01-01” / „L02-01” pecsét
    const nevKn = (q: string) => q.toLowerCase().replace(/\s+/g, ' ').trim();
    const kozeli = () => pecsetek.filter((h) => !foglalt.has(h) && h.A > 0 && Math.abs(h.A - A) <= 0.05 * A && nevKn(h.nev) === nevKn(nev)
      && (!kod || !h.kod || kn(h.kod).endsWith(kn(kod)))).sort((p, q) => Math.hypot(p.x - x, p.y - y) - Math.hypot(q.x - x, q.y - y))[0];
    const pecset = azonos.length === 1 ? azonos[0] : pecsetek.find((h) => !foglalt.has(h) && poli.some((p) => poliBenne(p, (h.mutato ?? h).x, (h.mutato ?? h).y))
      && (!kod || !h.kod || kn(h.kod) === kn(kod) || kn(h.kod).endsWith(kn(kod)) || !(h.A > 0) || Math.abs(h.A - A) <= 0.25 * A)) ?? kozeli();
    if (pecset) foglalt.add(pecset);
    const h: TervHelyiseg = pecset
      ? { ...pecset, kod: pecset.kod ?? kod, nev: pecset.nev || nev, A: pecset.A > 0 ? pecset.A : Math.round(A * 100) / 100, x, y, mutato: undefined, mutatoTartalek: undefined }
      : { kod, nev, A: Math.round(A * 100) / 100, x, y, forras: 'pecset', kulter: kulterNev(nev) };
    ki.push({ h, poli, ...(pecset ? { pecset } : {}) });
  }
  return ki;
}

/** A lapkép (szürke / tinta) másolata a téglalapon (pt) fehérre takarva. */
function kepMaszk<K extends { w: number; h: number; ptPx: number; adat: Uint8Array }>(k: K | undefined, t: [number, number, number, number] | null): K | undefined {
  if (!k || !t) return k;
  const adat = k.adat.slice();
  const x0 = Math.max(0, Math.floor(t[0] * k.ptPx)), x1 = Math.min(k.w - 1, Math.ceil(t[2] * k.ptPx)), y0 = Math.max(0, Math.floor(t[1] * k.ptPx)), y1 = Math.min(k.h - 1, Math.ceil(t[3] * k.ptPx));
  for (let y = y0; y <= y1; y++) adat.fill(255, y * k.w + x0, y * k.w + x1 + 1);
  return { ...k, adat };
}
/** A lapkép kitakarása a dobozon (pt) kívül. */
function kepKivulMaszk<K extends { w: number; h: number; ptPx: number; adat: Uint8Array }>(k: K | undefined, t: [number, number, number, number]): K | undefined {
  if (!k) return k;
  const adat = k.adat.slice();
  const x0 = Math.max(0, Math.floor(t[0] * k.ptPx)), x1 = Math.min(k.w - 1, Math.ceil(t[2] * k.ptPx)), y0 = Math.max(0, Math.floor(t[1] * k.ptPx)), y1 = Math.min(k.h - 1, Math.ceil(t[3] * k.ptPx));
  for (let y = 0; y < k.h; y++) { if (y < y0 || y > y1) adat.fill(255, y * k.w, (y + 1) * k.w); else { adat.fill(255, y * k.w, y * k.w + x0); adat.fill(255, y * k.w + x1 + 1, (y + 1) * k.w); } }
  return { ...k, adat };
}
/** Kézzel felvett helyiség (a rajzon pecsét nélküli, zárt terület – pl. lépcső): a kattintás helye (lapkoordináta) és neve. */
export interface PluszHelyiseg { x: number; y: number; nev: string }
export function alaprajzFeldolgoz(lap0: Lap, meretarany?: number, szurke?: SzurkeKep, tinta0?: TintaKep, leirasJegyzek?: TervHelyiseg[], plusz?: PluszHelyiseg[],
  /** haladás (a háttérszálon futó feldolgozás felirata) */
  halad?: (szoveg: string) => void): AlaprajzFeldolgozas {
  halad?.('rétegek, rajzpecsét, lépték, helyiségpecsétek');
  // rétegzett PDF: a bútor, környezet, burkolat, födém/tető, raszter rétegek vonalai nélkül; ilyenkor a lapkép
  // „tintája” (amely minden réteget – bútort, burkolatot – tartalmaz) nem kell: a falat a réteg adja
  const lap1 = retegSzures(lap0);
  const reteges = lap1 !== lap0;
  // a rajzpecsét (feliratmező) táblázata és a lapkeret nem fal, nem helyiség: vonalaik nélkül, a lapképen kitakarva
  const pr = rajzpecsetTeglalap(lap1);
  const lapPK = pecsetKeretNelkul(lap1, pr);
  let tinta = reteges ? undefined : kepMaszk(tinta0, pr);
  szurke = kepMaszk(szurke, pr);
  // laptisztítás (Balázs, 2026-11-24: „ezeket ki kell venni a felismerésből, mert zavart okoznak”): az épületdobozon
  // (a külső méretláncok szélső jelei, a helyiségpecsétek) kívüli vonalak, feliratok – burkolat, növényzet, telekhatár,
  // jelmagyarázat –, az északjel és a méretvonalak nélkül; a lapképen a dobozon kívüli rész kitakarva
  let lap = lapPK; let e0: AlaprajzEredmeny | null = null;
  const mPt0 = (() => { const M = meretarany && meretarany > 0 ? meretarany : meretaranyKeres(lapPK.szovegek, lapPK.utvonalak); return M ? (25.4 / 72) / 1000 * M : null; })();
  if (mPt0 && !(globalThis as { NOTISZTIT?: boolean }).NOTISZTIT) {
    e0 = alaprajzElemez(lapPK);
    const pp = e0.helyisegek.filter((h) => h.forras === 'pecset').map((h) => [h.x, h.y] as [number, number]);
    const t = lapOsztalyozas(lapPK, mPt0, pp);
    if (t.doboz) { lap = tisztaLap(lapPK, t); tinta = kepKivulMaszk(tinta, t.doboz); szurke = kepKivulMaszk(szurke, t.doboz); }
  }
  const e = alaprajzElemez(lap);
  // (az északjel a tisztított lapról kimaradt: a tisztítás előtti elemzésből)
  if (e0 && lap !== lapPK) { e.eszak = e0.eszak; e.figyelmeztetesek = [...e.figyelmeztetesek.filter((x) => !/északjel/i.test(x)), ...e0.figyelmeztetesek.filter((x) => /északjel/i.test(x))]; }
  if (meretarany && meretarany > 0) { e.meretarany = meretarany; e.mPerPt = (25.4 / 72) / 1000 * meretarany; }
  // lépték nélküli lap (pl. kicsinyített típusalaprajz): a méretláncokból becsülve
  if (!e.mPerPt) { const M = meretaranyKotabol(lap.szovegek, lap.utvonalak); if (M) { e.meretarany = M; e.mPerPt = (25.4 / 72) / 1000 * M; e.figyelmeztetesek = e.figyelmeztetesek.filter((x) => !/méretarányt nem találtam/.test(x)); e.figyelmeztetesek.push(`A lépték a méretláncokból becsülve: M = 1:${M}. Ellenőrizd, szükség esetén add meg kézzel.`); } }
  // a lapon írt méretarány ellenőrzése a méretláncokkal: eltérésnél (> 4 %) figyelmeztetünk (a lépték marad – a
  // méretlánc-becslés a ritka, szétszórt méretszámoknál tévedhet; a kézi megadás felülírja)
  if (e.mPerPt && e.meretarany && !meretarany) {
    const Mk = meretaranyKotabol(lap.szovegek, lap.utvonalak);
    if (Mk && Math.abs(Mk - e.meretarany) / e.meretarany > 0.04) e.figyelmeztetesek.push(`A lapon írt méretarány (1:${e.meretarany}) eltér a méretláncok szerint becsülttől (≈ 1:${Mk}). Ellenőrizd egy ismert méreten; ha a rajz kicsinyítve került a lapra, add meg a méretarányt kézzel.`);
  }
  // ArchiCAD-zónák: a helyiségek körvonala és területe a modellből (a pecsét adatával)
  const zonaPoliMap = new Map<TervHelyiseg, [number, number][][]>();
  if (lap.zonak?.length && e.mPerPt) {
    const zr = zonaHelyisegek(lap.zonak, e.helyisegek.filter((h) => h.forras === 'pecset'), e.mPerPt);
    if (zr.length) {
      const hasznalt = new Set(zr.map((z) => z.pecset).filter(Boolean));
      e.helyisegek = [...zr.map((z) => z.h), ...e.helyisegek.filter((h) => !hasznalt.has(h))];
      for (const z of zr) zonaPoliMap.set(z.h, z.poli);
    }
  }
  // kézzel felvett helyiségek (a lista végén – a meglévők sorszáma nem változik): a területük a raszterből
  const pluszH: TervHelyiseg[] = (plusz ?? []).map((q) => ({ nev: q.nev, A: 0, x: q.x, y: q.y, forras: 'pecset', kulter: false, kezi: true }));
  if (pluszH.length) e.helyisegek = [...e.helyisegek, ...pluszH];
  let magHelyisegek = e.helyisegek.filter((h) => h.forras === 'pecset' && !h.kulter);
  let leiras: AlaprajzFeldolgozas['leiras'];
  // pecsét nélküli (egyszerűsített) alaprajz: a falakkal körbezárt terek a helyiségek
  const auto = !magHelyisegek.filter((h) => !h.kezi).length && !!e.mPerPt;
  if (auto && szurke && !szurke.hatar) szurke = { ...szurke, hatar: arnyalatHatarok(szurke) };
  if (auto) {
    magHelyisegek = automatikusHelyisegek(lap, e.mPerPt!, reteges ? undefined : szurke, tinta);
    // a szürke árnyalat (lakásszínezés) a falhatárt is adja; ha viszont a lapon a szürke sraffozás, minta (burkolat,
    // anyagjelölés), akkor a helyiségeket szétszabdalja: ilyenkor a színkép nélküli felismerés ad több valódi helyiséget
    if (szurke && !reteges) {
      const pont = (l: TervHelyiseg[]) => l.reduce((s2, h) => s2 + (h.A >= 4 ? h.A : 0), 0);
      const nelkul = automatikusHelyisegek(lap, e.mPerPt!, undefined, tinta);
      if (pont(nelkul) > 1.2 * pont(magHelyisegek)) { magHelyisegek = nelkul; szurke = undefined; }
    }
    e.helyisegek = magHelyisegek;
    if (magHelyisegek.length) e.figyelmeztetesek = e.figyelmeztetesek.filter((x) => !/Helyiséget nem találtam/.test(x));
    if (magHelyisegek.length) e.figyelmeztetesek.push(`Helyiségpecsét nincs a lapon: ${magHelyisegek.length} zárt teret ismertem fel helyiségként (Helyiség 1, 2, …). Jelöld ki a lakás helyiségeit, és nevezd át őket a Helyiségek lépésben.`);
  }
  if (!e.mPerPt || !magHelyisegek.length) return { e, magHelyisegek, r: null, nyilasok: [] };
  // berajzolt gépkocsi pecsét nélküli térben (garázs vagy fedett beálló): ha a kocsit három oldalról fal veszi körül, a
  // nyitott oldal kapunyílással zárul, és a tér helyiségmagot kap (a garázs és a beálló közti döntés a homlokzat szerint
  // – a kapu látszik-e – az átvételkor). A kocsi rétegét a rétegszűrés elhagyja: az eredeti lapon keresünk.
  const garazsok: { x: number; y: number }[] = [];
  {
    const kocsik = gepkocsik(lap0, e.mPerPt);
    // (egymás melletti kocsik – ≤ 7 m – egy tér; a csoport közepe a mag)
    const csop: { x: number; y: number; db: number }[] = [];
    for (const k of kocsik) { const c = csop.find((q) => Math.hypot(q.x / q.db - k.x, q.y / q.db - k.y) * e.mPerPt! <= 7); if (c) { c.x += k.x; c.y += k.y; c.db++; } else csop.push({ x: k.x, y: k.y, db: 1 }); }
    const jelolt = csop.map((c) => ({ x: c.x / c.db, y: c.y / c.db }));
    // a garázs felirata (pecsét) is jelölt – a kocsi nélkül rajzolt, ill. nem felismert kocsis garázs (a kapuja nyitott rés)
    for (const h of magHelyisegek) { if (!/gar[áa]zs|g[ée]pkocsi|gk\.?\s*t[áa]rol|g[ée]pj[áa]rm[űu]/i.test(h.nev)) continue;
      const p = h.mutato ?? h; if (!jelolt.some((q) => Math.hypot(q.x - p.x, q.y - p.y) * e.mPerPt! <= 7)) jelolt.push({ x: p.x, y: p.y }); }
    if (jelolt.length) {
      halad?.('berajzolt gépkocsi: garázs / beálló');
      const mg = magHelyisegek.map((h) => ({ ...(h.mutato ?? h), A: h.A }));
      const rP = raszterEpit(lap, e.mPerPt, mg, { garazsok: jelolt, kulsoPontok: e.helyisegek.filter((h) => h.kulter && h.forras === 'pecset').map((h) => h.mutato ?? h), ...(auto ? { px: 0.04, resZaras: 3.0, vastagVonalFal: 0.05 } : {}) });
      jelolt.forEach((g, k) => {
        if (!rP.garazsKapuk?.[k]) return;
        const gx = Math.round((g.x - rP.x0) * rP.mPerPt / rP.px), gy = Math.round((g.y - rP.y0) * rP.mPerPt / rP.px);
        if (gx < 0 || gy < 0 || gx >= rP.w || gy >= rP.h) return;
        // (a kocsi helye a kapu lezárása után zárt, pecsét nélküli tér – 0 címke –; helyiségben vagy kint: nem új tér)
        let i0 = gy * rP.w + gx;
        if (rP.fal[i0] || rP.nyilas[i0]) { const sz = [i0 - 1, i0 + 1, i0 - rP.w, i0 + rP.w].find((q) => q >= 0 && q < rP.w * rP.h && !rP.fal[q] && !rP.nyilas[q]); if (sz === undefined) return; i0 = sz; }
        // (zárt, pecsét nélküli tér – 0 címke –, vagy egy helyiségbe – ajtón át – átfolyt terület: a helyiség a pecsétben írt
        // területének sokszorosára nőtt; helyiségben, ill. kint álló kocsi nem új tér)
        const c0 = rP.cimke[i0]!, sajat = c0 >= 2 ? mg[c0 - 2] : undefined;
        // (FELIRATOS garázs – „Gépkocsi tároló”, „Garázs” – a kocsival: a kapu lezárásával a pecsétes helyiség zárt; új tér
        // nem kell, de a kapu a végső rácson is záruljon – Balázs, 2026-11-21: „ha nem is zárt a vonal, de a felirat
        // garázs, akkor ott kapu van és a helyiség zárt”; Tarján, Nefelejcs: eddig a kapun át kifolyt)
        if (c0 >= 2 && /gar[áa]zs|g[ée]pkocsi|gk\.?\s*t[áa]rol|g[ée]pj[áa]rm[űu]/i.test(magHelyisegek[c0 - 2]?.nev ?? '')
          && (rP.helyisegek[c0 - 2]?.A ?? 0) <= Math.max(1.6 * (sajat?.A ?? 0), (sajat?.A ?? 0) + 10)) { garazsok.push(g); return; }
        if (c0 !== 0 && !(sajat?.A && (rP.helyisegek[c0 - 2]?.A ?? 0) > Math.max(1.6 * sajat.A, sajat.A + 10))) return;
        const latott = new Uint8Array(rP.w * rP.h), sor = [i0]; latott[i0] = 1; let db = 0, szel = false;
        for (let q = 0; q < sor.length; q++) { const i = sor[q]!; db++; const x = i % rP.w, y = (i / rP.w) | 0; if (x === 0 || y === 0 || x === rP.w - 1 || y === rP.h - 1) szel = true;
          for (const n of [x > 0 ? i - 1 : -1, x < rP.w - 1 ? i + 1 : -1, i - rP.w, i + rP.w]) if (n >= 0 && n < rP.w * rP.h && !latott[n] && !rP.fal[n] && !rP.nyilas[n] && rP.cimke[n] === c0) { latott[n] = 1; sor.push(n); } }
        // (átfolyásnál a tér területe a helyiség többlete)
        const A = c0 === 0 ? db * rP.px * rP.px : db * rP.px * rP.px - (sajat?.A ?? 0);
        if (szel || A < 10 || A > 120) return;
        garazsok.push(g);
        const h: TervHelyiseg = { nev: 'Garázs', A: Math.round(A * 100) / 100, x: g.x, y: g.y, forras: 'pecset', kulter: false, kezi: true, gepkocsi: true };
        e.helyisegek = [...e.helyisegek, h]; magHelyisegek = [...magHelyisegek, h];
      });
      if (e.helyisegek.some((h) => h.gepkocsi)) e.figyelmeztetesek.push(`Berajzolt gépkocsi pecsét nélküli, háromoldalt falazott térben: ${garazsok.length === 1 ? 'a teret' : `${garazsok.length} teret`} garázsnak vettem, a nyitott oldalát kapunak. Ha a homlokzaton ott nincs kapu, kültéri beálló lesz belőle.`);
    }
  }
  const kulsoPontok = e.helyisegek.filter((h) => h.kulter && h.forras === 'pecset').map((h) => h.mutato ?? h);
  const magok = magHelyisegek.map((h) => ({ ...(h.mutato ?? h), A: h.A }));
  let r: Raszter; let r3d: Raszter | undefined; let r3dP = 0;
  if (auto) {
    // pecsét nélküli lap: a zárt terekből indított elárasztás. Az a „helyiség”, amely a végső raszterben a lap széléig
    // kifolyik, vagy a zárt térként mért területének többszörösére nő (a rajz körüli méretlánc-zseb, keretmező),
    // nem helyiség – kihagyjuk, és újraépítjük a raszter nélküle (különben az egész lapot elárasztja).
    const opc = { px: 0.04, resZaras: 3.0, vastagVonalFal: 0.05, ...(szurke && !reteges ? { szinKep: szurke } : {}), ...(garazsok.length ? { garazsok } : {}) };
    halad?.('zárt terek felismerése (pecsét nélküli lap)');
    r = raszterEpit(lap, e.mPerPt, magok, opc);
    for (let kor = 0; kor < 12; kor++) {
      const db = new Map<number, number>(); for (let k = 0; k < r.w * r.h; k++) { const c = r.cimke[k]!; if (c >= 2) db.set(c - 2, (db.get(c - 2) ?? 0) + 1); }
      const rossz = new Set(magHelyisegek.map((h, i) => ((r.helyisegek[i]?.szivarog || (db.get(i) ?? 0) * r.px * r.px > Math.max(2 * h.A, h.A + 15)) ? i : -1)).filter((i) => i >= 0));
      if (!rossz.size || rossz.size === magHelyisegek.length) break;
      magHelyisegek = magHelyisegek.filter((_, i) => !rossz.has(i));
      { let n = 0; magHelyisegek.forEach((h) => { if (!h.gepkocsi) h.nev = `Helyiség ${++n}`; }); }
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
    const kapuk = nyilasFeliratok(lap.szovegek, lap.utvonalak).filter((f) => f.kapuJelolt && f.szel >= 2.5).map((f) => ({ x: f.x, y: f.y, szel: f.szel, fal: f.fal }));
    const zonaPoli = zonaPoliMap.size ? magHelyisegek.map((h) => zonaPoliMap.get(h)?.map((p) => p.flat())) : undefined;
    const alap = { ...(kulsoPontok.length ? { kulsoPontok } : {}), ...(kapuk.length ? { kapuk } : {}), ...(zonaPoli?.some(Boolean) ? { zonaPoli } : {}), ...(garazsok.length ? { garazsok } : {}) };
    const valtozatok: RaszterBeallitas[] = [alap, { ...alap, ablaksor: false }, ...(tinta ? [{ ...alap, tinta }, { ...alap, tinta, ablaksor: false }] : [])];
    const vektoros: RaszterBeallitas[] = [{ ...alap, vektorFal: true }, ...(tinta ? [{ ...alap, tinta, vektorFal: true }] : [])];
    let leg: { r: Raszter; p: number; f?: number } | null = null; let legBeall: RaszterBeallitas | null = null;
    const vDb = valtozatok.length + vektoros.length; let vK = 0;
    const zonas = !!zonaPoli?.some(Boolean);
    for (const v of valtozatok) {
      halad?.(`falak és helyiségek felismerése – ${++vK}. / ${vDb} változat`);
      const rv = raszterEpit(lap, e.mPerPt, magok, v);
      const p = pecsetEgyezes(rv, magHelyisegek);
      // az alapváltozattól csak egyértelmű javulásnál (≥ 3 százalékpont) térünk el – a hajszálnyi különbség zaj
      if (!leg || p > leg.p + 0.03) { leg = { r: rv, p }; legBeall = v; }
      // zónás lap: a területegyezés telített – ha a választott változatban a helyiségek határának nagy része (60 %-a)
      // fal nélküli, a lényegesen (≥ 15 százalékpont) jobb falfedettségű változat nyer
      else if (zonas && p >= leg.p - 0.01) {
        leg.f ??= falFedettseg(leg.r); const f = falFedettseg(rv);
        if (leg.f < 0.4 && f > leg.f + 0.15) { leg = { r: rv, p, f }; legBeall = v; }
      }
    }
    r = leg!.r;
    // vektoros falfelismerés (párhuzamos falsíkpár + metszeti jel) csak a 3D modellhez és a burokhoz: akkor, ha a
    // helyiségek kiterjedése vele egyértelműen (≥ 3 százalékpont) jobban illik a pecsétterülethez. A helyiségek és a
    // nyílászárók a fenti raszterből jönnek (ott a korábbi felismerés pontosabb).
    for (const v of vektoros) {
      halad?.(`falak és helyiségek felismerése – ${++vK}. / ${vDb} változat (vektoros falak)`);
      const rv = raszterEpit(lap, e.mPerPt, magok, v);
      const p = pecsetEgyezes(rv, magHelyisegek);
      if (p > leg!.p + 0.03 && (!r3d || p > r3dP)) { r3d = rv; r3dP = p; }
    }
    // a pecsét helyén nincs helyiség (kívül írt, szaggatott mutatóvonallal kötött pecsét): a mutatóvonal végével újra
    const tartalek = magHelyisegek.map((h, i) => (h.mutatoTartalek && !h.mutato && (r.helyisegek[i]?.A ?? 0) < 0.3 * h.A ? i : -1)).filter((i) => i >= 0);
    if (tartalek.length) {
      for (const i of tartalek) { const h = magHelyisegek[i]!; h.mutato = h.mutatoTartalek; magok[i] = { ...h.mutato!, A: h.A }; }
      const v = valtozatok.find((x) => x === legBeall) ?? alap;
      r = raszterEpit(lap, e.mPerPt, magok, v);
    }
  }
  halad?.('nyílászárók, határoló szerkezetek');
  // nyitott tér: a helyiség körvonalának kevesebb mint felén van fal vagy nyílás, miközben a lap többi helyiségét
  // (rajta kívül, területtel súlyozva) legalább 60 %-ban fal határolja – a pecsételt terület udvar, rakodótér, fedetlen tér
  // (a körvonala telekhatár, burkolatszél): külső tér, nem fűtött helyiség
  if (!auto) {
    const t = fedettsegSzamlalo(r);
    const arany = t.hatar.map((n, i) => (n ? t.fedett[i]! / n : 1));
    let sA = 0, sF = 0; magHelyisegek.forEach((h, i) => { const A = r.helyisegek[i]?.A ?? 0; if (A > 0 && !h.kezi) { sA += A; sF += A * arany[i]!; } });
    magHelyisegek.forEach((h, i) => {
      const A = r.helyisegek[i]?.A ?? 0;
      if (h.kulter || h.kezi || BELTER_NEV.test(h.nev) || A < 4 || arany[i]! >= 0.5 || sA - A <= 0 || (sF - A * arany[i]!) / (sA - A) < 0.6) return;
      h.nyitott = true;
      e.figyelmeztetesek.push(`${h.kod ? h.kod + ' ' : ''}${h.nev}: a körvonala nagy részén (${Math.round((1 - arany[i]!) * 100)} %) nincs fal – nyitott (külső) térnek vettem. Ha zárt helyiség, állítsd át a besorolását.`);
    });
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
  // kód nélküli helyiségjegyzék csoportfejlécei („1.1 lakás”, „Közös használatú”): a pecsét a név és a terület szerint
  // a csoport sorához kötődik – így választható ki a lakás (a közös terek nélkül)
  if (!e.egysegek.length) {
    const cs = jegyzekCsoportok(lap0.szovegek);
    if (cs.length >= 2) {
      const kn = (x: string) => x.toLowerCase().replace(/\s+/g, ' ').trim();
      const foglalt = new Set<object>(); const info: typeof e.egysegInfo = {}; const egysegek: string[] = [];
      cs.forEach((c, ci) => {
        const kulcs = `J${ci + 1}`; let db = 0, A = 0;
        for (const sor of c.sorok) {
          const h = e.helyisegek.find((x) => !foglalt.has(x) && !x.egyseg && x.forras !== 'jegyzek' && kn(x.nev) === kn(sor.nev) && Math.abs(x.A - sor.A) <= 0.02);
          if (!h) continue;
          foglalt.add(h); h.egyseg = kulcs; db++; A += h.A;
        }
        if (db) { egysegek.push(kulcs); info[kulcs] = { nev: c.nev, db, A: Math.round(A * 100) / 100 }; }
      });
      if (egysegek.length >= 2) {
        e.egysegek = egysegek; e.egysegInfo = info;
        e.figyelmeztetesek.push(`A helyiségjegyzék csoportjai szerint ${egysegek.map((k) => `„${info[k]!.nev}” (${info[k]!.db} helyiség, ${String(info[k]!.A).replace(".", ",")} m²)`).join(', ')} – válaszd ki, mi kerüljön a tanúsításba.`);
      } else for (const h of e.helyisegek) if (h.egyseg?.startsWith('J')) h.egyseg = undefined;
    }
  }
  // falfülke (padlótól induló, sraffozott falszakasz előtti felirat): nem nyílászáró – kimarad az átvételből
  const mindFelirat = nyilasFeliratok(lap.szovegek, lap.utvonalak);
  // (a vegyes írású ajtófeliratok – „90 / 2,10” – csak a belső ajtók külön menetének; a többi lépés nem látja őket)
  const feliratok = mindFelirat.filter((f) => !f.vegyesAjto);
  const nyilasok = nyilasokHozzarendel(feliratok, r, magHelyisegek.map((h) => h.nev), auto)
    .map((n) => (n.fajta !== 'belso_ajto' && falfulkeE(n, r, lap) ? { ...n, fajta: 'falfulke' as const, kulso: false } : n));
  // (a csak az épületmodellnek szóló belső ajtók külön menetben)
  const modellAjtok = nyilasokHozzarendel(mindFelirat, r, magHelyisegek.map((h) => h.nev), auto, true);
  // ugyanannak a kapunak két felirata (pl. falnyílás- és tokmagasság külön: „3,75 / 2,25” és „3,75 / 2,40”): azonos
  // helyiség, irány és szélesség, a kapu szélességén belül egymás mellett → egy kapu (az alacsonyabb marad)
  // (általánosan: két azonos szélességű külső nyílásfelirat egymástól a szélesség 90 %-ánál közelebb – a két nyílás
  // átfedne, tehát ugyanaz a nyílás két feliratsorral; a különböző helyiséghez rendelt felirat is)
  for (let i = nyilasok.length - 1; i >= 0; i--) {
    const a = nyilasok[i]!; if (!a.kulso || a.szel < 0.6) continue;
    const j = nyilasok.findIndex((b, k) => k !== i && b.kulso && Math.abs(b.szel - a.szel) < 0.01 && (a.fajta === 'garazskapu' && b.fajta === 'garazskapu' && b.helyiseg === a.helyiseg && b.irany === a.irany
      ? Math.hypot(b.x - a.x, b.y - a.y) * r.mPerPt < a.szel : Math.hypot(b.x - a.x, b.y - a.y) * r.mPerPt < 0.9 * a.szel && a.mag > 0 && b.mag > 0)
      // méretláncba (is) beírt nyílás: ugyanaz a nyílás két felirattal – azonos helyiség, irány és méret, ≤ 2,5 m-en belül
      || (k !== i && b.kulso && (a.lanc || b.lanc) && b.helyiseg === a.helyiseg && b.irany === a.irany && Math.abs(b.szel - a.szel) < 0.01 && Math.abs(b.mag - a.mag) < 0.01 && Math.hypot(b.x - a.x, b.y - a.y) * r.mPerPt < 2.5));
    if (j >= 0) { const b = nyilasok[j]!; if (a.mag < b.mag) nyilasok[j] = a; nyilasok.splice(i, 1); }
  }
  // felirat nélküli függönyfalak, üvegfalak (széles, üvegezett falszakasz a fűtött helyiség és a külső tér határán)
  // a függönyfal / üvegezés nyíló szárnyának vett (elnyelt) feliratok helye: a későbbi lépések sem veszik fel külön nyílásnak
  const szarnyKi: { x: number; y: number }[] = [];
  const szarnyE2 = (f: { x: number; y: number }) => szarnyKi.some((q) => Math.hypot(q.x - f.x, q.y - f.y) < 2);
  { const elnyelt = new Set<TervNyilas>();
    const ff = fuggonyfalak(r, nyilasok, magHelyisegek.map((h) => h.mutato ?? h), elnyelt);
    if (elnyelt.size) for (let i = nyilasok.length - 1; i >= 0; i--) if (elnyelt.has(nyilasok[i]!)) { szarnyKi.push(nyilasok[i]!); nyilasok.splice(i, 1); }
    nyilasok.push(...ff); }
  // méretfelirat nélküli (pl. csak típusjeles) homlokzati nyílások: a falnyílás mért szélességével
  {
    // méretfeliratos lapon (≥ 5 feliratos külső nyílás, típusjel-feliratok nélkül) a felirat nélküli keskeny (< 0,6 m)
    // „nyílás” rajzi rés (beépített szekrény, pillér, csatorna) – nem nyílászáró
    const kodok = new Set(e.helyisegek.map((h) => (h.kod ?? '').trim()));
    const tipusjel = lap.szovegek.filter((t) => /^[A-ZÁÉ]{1,4}[-_.]?\d{1,3}[A-Z]?$/.test(t.s.trim()) && !kodok.has(t.s.trim())).length;
    const feliratos = nyilasok.filter((n) => n.kulso && n.fajta !== 'fuggonyfal' && !n.mert).length;
    const keskenyKi = feliratos >= 5 && tipusjel < 3;
    // a felirat nélküli (mért) üvegezés mellett / benne (a széle és a felirat közepe közt ≤ fél szárny + 20 cm) álló kis mellvédes felirat, ha az üvegezés legalább 40 cm-rel
    // szélesebb: a nyíló szárnya (pl. „50 / 1,45, pm 1,00” a 1,93-as üvegfal végén) – az üvegezés része, nem külön nyílás
    { const sz = nyilasok.filter((n) => n.kulso && szarnyFeliratE(n));
      if (sz.length) {
        // (a felirat a mért folt végén: legfeljebb fél szárny + 10 cm-re a folt szélétől, kívül vagy belül)
        const mA = jeloletlenNyilasok(r, nyilasok.filter((n) => !sz.includes(n))), e0 = 0.1 / r.mPerPt;
        const ki = new Set(sz.filter((s) => { const t = (s.szel / 2 + 0.2) / r.mPerPt;
          return mA.some((q) => { const h = q.hely; if (!h || q.szel < s.szel + 0.4) return false;
            if (!(s.x > h[0] - t && s.x < h[2] + t && s.y > h[1] - t && s.y < h[3] + t)) return false;
            const fugg = h[3] - h[1] > h[2] - h[0], v = t - e0;
            return fugg ? s.y <= h[1] + v || s.y >= h[3] - v : s.x <= h[0] + v || s.x >= h[2] - v; }); }));
        if (ki.size) for (let i = nyilasok.length - 1; i >= 0; i--) if (ki.has(nyilasok[i]!)) { szarnyKi.push(nyilasok[i]!); nyilasok.splice(i, 1); }
      } }
    nyilasok.push(...jeloletlenNyilasok(r, nyilasok).filter((n) => !(keskenyKi && n.szel < 0.6)));
    // garázs (pecsétes vagy a berajzolt kocsi szerinti) felirat nélküli, legalább 1,8 m széles külső falnyílása: kapu
    for (const n of nyilasok) if (n.mert && n.kulso && n.szel >= 1.8 && /gar[aá]zs|gépkocsi|gepkocsi|beálló/i.test(magHelyisegek[n.helyiseg ?? -1]?.nev ?? '')) { n.fajta = 'garazskapu'; n.pm = 0; }
  }
  // méretláncba írt nyílásméretek (szélesség / magasság) a mért falnyílásokra
  lancNyilasok(feliratok, nyilasok, r, lap.szovegek, magHelyisegek.map((h) => h.nev));
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
    // (a folyosóról / közlekedőből nyíló ajtószélességű – ≤ 1,25 m – nyílás erkélyajtó marad: loggiára, teraszra nyílik)
    if (!bejaratos.length) { for (const n of l) if (/lépcső|lepcso/i.test(magHelyisegek[n.helyiseg!]?.nev ?? '') || n.szel > 1.25) n.fajta = 'ablak'; continue; }
    const ajto = bejaratos.reduce((a, b) => (b.szel > a.szel ? b : a));
    for (const n of l) n.fajta = n === ajto ? 'bejarati_uvegajto' : 'ablak';
  }
  // zónás helyiség (a falszakaszok a zóna éleiből, ferde falnál a valódi irányukkal): a homlokzati nyílás iránya a hozzá
  // legközelebbi (≤ 2 m) külső zónaél iránya – a nyílásfolt átnézése csak a négy fő irányt ismeri
  for (const n of nyilasok) {
    if (!n.kulso || n.helyiseg === null) continue;
    const H = r.helyisegek[n.helyiseg]; if (!H?.szakaszok.some((sg) => sg.zona)) continue;
    let leg = 2 / r.mPerPt, ir: number | null = null;
    for (const sg of H.szakaszok) if (sg.zona && sg.tul === 'kulso') for (const q of sg.pontok) { const d = Math.hypot(q[0] - n.x, q[1] - n.y); if (d < leg) { leg = d; ir = sg.irany; } }
    if (ir !== null) n.irany = ir;
  }
  // zónás lap: a falhoz nem rendelt, zónán kívül (a falban vagy előtte) írt felirat, amelyhez 1,2 m-en belül külső zónaél
  // tartozik – a rajzon nyílásként nem jelölt üvegfal, portál (pl. ferde függönyfalas előcsarnok): annak a helyiségnek a
  // homlokzati nyílása
  if (r.helyisegek.some((H) => H.szakaszok.some((sg) => sg.zona))) {
    const ptPx = r.mPerPt / r.px;
    // (a helyiség nélkül maradt – falnyíláshoz nem köthető – nyílás is)
    const jeloltF = [...feliratok.filter((f) => !(f.lanc && !f.kapuJelolt) && !szarnyE2(f) && !nyilasok.some((n) => Math.hypot(n.x - f.x, n.y - f.y) < 2 || (Math.abs(n.szel - f.szel) < 0.01 && Math.hypot(n.x - f.x, n.y - f.y) * r.mPerPt < 0.9 * f.szel))),
      ...nyilasok.filter((n) => n.helyiseg === null && !n.mert)];
    for (const f of jeloltF) {
      const cx = Math.floor((f.x - r.x0) * ptPx), cy = Math.floor((f.y - r.y0) * ptPx);
      if (cx >= 0 && cy >= 0 && cx < r.w && cy < r.h && r.cimke[cy * r.w + cx]! >= 2) continue;
      // a felirat 1 m-es környezetében valódi külső tér (nem zóna nélküli belső tér, pl. lépcsőház, közös folyosó)
      { const R = Math.round(1.0 / r.px); let kint = false;
        for (let y = Math.max(0, cy - R); y <= Math.min(r.h - 1, cy + R) && !kint; y++) for (let x = Math.max(0, cx - R); x <= Math.min(r.w - 1, cx + R); x++) if (r.cimke[y * r.w + x] === 1) { kint = true; break; }
        if (!kint) continue; }
      let leg = 1.2 / r.mPerPt, hi = -1, ir = 0;
      r.helyisegek.forEach((H, k) => { for (const sg of H.szakaszok) if (sg.zona && sg.tul === 'kulso') for (const q of sg.pontok) { const d = Math.hypot(q[0] - f.x, q[1] - f.y); if (d < leg) { leg = d; hi = k; ir = sg.irany; } } });
      if (hi < 0) continue;
      const fajta: TervNyilas['fajta'] = f.pm !== null && f.pm > 0.05 ? 'ablak' : f.mag >= 1.9 ? 'erkelyajto' : 'ablak';
      const i0 = nyilasok.indexOf(f as TervNyilas);
      const n: TervNyilas = { ...f, helyiseg: hi, irany: ir, kulso: true, fajta, iranyTipp: true };
      // falfülke (ill. a lapon falfülkének talált azonos méretű felirat): nem nyílás
      if (falfulkeE(n, r, lap) || nyilasok.some((m) => m.fajta === 'falfulke' && Math.abs(m.szel - f.szel) < 0.01 && Math.abs(m.mag - f.mag) < 0.01 && m.pm === f.pm)) continue;
      // a felirat mellett (≤ 1,5 m) felirat nélküli, becsült magasságú, hasonló szélességű (± 40 cm) mért külső nyílás: az
      // ugyanaz a nyílás (pl. a kapunak vélt, de garázshoz nem köthető „1,80 / 2,40” a belső udvarra) – a felirat szerinti
      // méretekkel, nem második nyílásként
      { let leg: TervNyilas | null = null, ld = 1.5;
        for (const m of nyilasok) { if (!m.mert || m.mert.magForras !== 'becsult' || m.mag > 0 || !m.kulso || Math.abs(m.szel - f.szel) > 0.4) continue;
          const d = Math.hypot(m.x - f.x, m.y - f.y) * r.mPerPt; if (d < ld) { ld = d; leg = m; } }
        if (leg) { leg.szel = f.szel; leg.mag = f.mag; leg.pm = f.pm; delete leg.mert; leg.fajta = fajta; if (i0 >= 0) nyilasok.splice(i0, 1); continue; } }
      if (i0 >= 0) nyilasok[i0] = n; else nyilasok.push(n);
    }
  }
  // falhoz nem rendelt nyílásfeliratok (pl. a raszterben nem lezárt, üvegfalas helyiség homlokzatán): a szerkesztett hőburok használja
  // (az azonos szélességű, a nyílással átfedő felirat – ugyanannak a nyílásnak másik feliratsora – sem árva)
  const arva = feliratok.filter((f) => !(f.lanc && !f.kapuJelolt) && !szarnyE2(f) && !nyilasok.some((n) => Math.hypot(n.x - f.x, n.y - f.y) < 2 || (Math.abs(n.szel - f.szel) < 0.01 && f.szel >= 0.6 && Math.hypot(n.x - f.x, n.y - f.y) * r.mPerPt < 0.9 * f.szel)));
  // tetősík ablakok a jelükről (a rétegszűrés előtti lapon: a tetőréteg a szűrésben kiesik)
  let tetoablakok: TetoablakJel[] = [];
  if (r) { try { tetoablakok = tetoablakJelek(lap0, r); } catch { tetoablakok = []; } }
  // bizonytalan helyzetek: ellenőrizendő
  const meretL = (l: { szel: number; mag: number }[]) => [...new Set(l.map((n) => `${Math.round(n.szel * 100)}×${Math.round(n.mag * 100)}`))].join(', ');
  const bizOldal = nyilasok.filter((n) => n.oldalBizonytalan);
  if (bizOldal.length) e.figyelmeztetesek.push(`${bizOldal.length} nyílás (${meretL(bizOldal)}) túloldala nem azonosítható (sem helyiség, sem külső tér – pl. rajzi vonalakkal zárt sáv a fal előtt, pecsét nélküli tér): belső nyílásnak vettem. Ha homlokzati nyílás, jelöld külsőnek a Határolás lépésben.`);
  const becsTA = tetoablakok.filter((t) => t.becsult);
  if (becsTA.length) e.figyelmeztetesek.push(`${becsTA.length} tetősík ablak méretfelirat nélkül (a jelből / típusjeles keretből): a mérete a rajzolt keretből becsült – ellenőrizd a konszignáció szerint.`);
  // falnyílás + nyílászáró feliratpár: a nyílás a nyílászáró (tok) méretével
  const tokra = <T extends { szel: number; mag: number; pm: number | null; tok?: { szel: number; mag: number; pm: number | null } }>(n: T): T => { if (!n.tok) return n; const { tok, ...u } = n; return { ...u, szel: tok.szel, mag: tok.mag, pm: tok.pm } as T; };
  for (let k = 0; k < nyilasok.length; k++) nyilasok[k] = tokra(nyilasok[k]!);
  for (let k = 0; k < modellAjtok.length; k++) modellAjtok[k] = tokra(modellAjtok[k]!);
  for (let k = 0; k < arva.length; k++) arva[k] = tokra(arva[k]!);
  for (const h of pluszH) { const ri = magHelyisegek.indexOf(h); const A = ri >= 0 ? r.helyisegek[ri]?.A : undefined; if (A) h.A = Math.round(A * 100) / 100; }
  return { e, magHelyisegek, r, ...(r3d ? { r3d } : {}), nyilasok, ...(modellAjtok.length ? { modellAjtok } : {}), auto, arvaFeliratok: arva, ...(leiras ? { leiras } : {}), ...(tetoablakok.length ? { tetoablakok } : {}) };
}

export interface MetszetFeldolgozas {
  blokkok: { rr: TervRetegrend; becsles: SzerepBecsles; retegek: TervRetegUI[] }[];
  szintek: SzintEredmeny;
  /** Tetőtér-beépítés adatai (hajlásszög, térdfal), ha a metszeten van tetőhajlás-felirat. */
  tetoter: TetoterAdat | null;
  /** A magastető hajlásszöge felirat nélkül, a metszet ferde tetővonalaiból (csak az épületmodellhez). */
  tetoHajlas?: number;
  /** A tető a földszinti padlóig fut le (A alakú ház, a tető alatt nincs szintmagas külső fal): a szint tetőtér. */
  padloigTeto?: PadloigTeto;
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
  const tt = tetoterKeres(lap.szovegek, szintekKeres(lap.szovegek));
  // térdfal a metszet rajzolatából (a födémre ráálló, a tetőbe futó falkitöltés); felirat csak ennek híján
  const M = meretaranyKeres(lap.szovegek, lap.utvonalak), mpp = M ? (25.4 / 72) / 1000 * M : undefined;
  if (tt) { const g = mpp ? terdfalGeometria(lap, mpp, tt.terdfalTipp == null && (tt.padlo ?? 0) >= 2 ? tt.padlo! : undefined) : null; if (g !== null) { tt.terdfal = g; tt.terdfalForras = 'rajz'; } else if (tt.terdfal !== null) tt.terdfalForras = 'felirat'; }
  const tetoHajlas = !tt ? tetoHajlasRajzbol(lap, mpp) : null;
  // a földszinti padlóig lefutó tető (A alakú ház): a szint tetőtér – a térdfal a tetősík belső alsó éle, a
  // „padlásfödém” a belső gerinc (a tér a gerincig nyitott); a térdfal-felirat elsőbbséget kap
  const hj = tt?.hajlas ?? tetoHajlas;
  const pt = hj ? padloigEroTeto(lap, hj, mpp) : null;
  const tt2: TetoterAdat | null = pt
    ? { ...(tt ?? { terdfalTipp: null }), hajlas: hj!, terdfal: tt?.terdfalForras === 'felirat' ? tt.terdfal : pt.terdfal, terdfalForras: tt?.terdfalForras === 'felirat' ? 'felirat' : 'rajz', belmagassag: pt.gerinc, padlo: 0 }
    : tt;
  return {
    blokkok: b.map((rr) => { const becsles = szerepBecsles(rr, b); return { rr, becsles, retegek: retegekEpit(rr, becsles, ujId) }; }),
    szintek: szintekKeres(lap.szovegek),
    tetoter: tt2,
    ...(tetoHajlas ? { tetoHajlas } : {}),
    ...(pt ? { padloigTeto: pt } : {}),
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
