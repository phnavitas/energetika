/**
 * A tervlapok teljes feldolgozása: PDF megnyitása pdf.js-szel (böngészőben, munkaszál nélkül), lapok szerepének
 * felismerése, alaprajz (helyiségek, északjel, raszter, külső falak, nyílászárók) és metszet (rétegrendek, szintek).
 */
import { lapKinyer, type Lap } from './kinyeres';
import { alaprajzElemez, type AlaprajzEredmeny, type TervHelyiseg } from './alaprajz';
import { raszterEpit, type Raszter } from './raszter';
import { kotaEllenoriz } from './kota';
import { meretaranyKotabol, automatikusHelyisegek, lakasCsoportok, arnyalatHatarok, type SzurkeKep } from './autohelyiseg';
import { fuggonyfalak, nyilasFeliratok, nyilasokHozzarendel, falfulkeE, type TervNyilas } from './nyilaszarok';
import { talajOldal } from './talaj';
import { retegrendBlokkok, szerepBecsles, retegekEpit, szintekKeres, type TervRetegrend, type SzerepBecsles, type TervRetegUI, type SzintEredmeny } from './metszet';
import { ujId } from '../modell';

export interface TervLap {
  fajl: string; oldal: number;
  szerep: 'alaprajz' | 'metszet' | 'homlokzat' | 'egyeb';
  cim: string;
  lap: Lap;
  /** Előnézeti kép (JPEG dataURL) és mérete pixelben. */
  kep: string; kepSzel: number; kepMag: number;
  /** A renderelt lap szürkeárnyalatos, kicsinyített képe (a színezett lakásfoltok felismeréséhez). */
  szurke?: SzurkeKep;
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

export function lapSzerep(lap: Lap): { szerep: TervLap['szerep']; cim: string } {
  const sz = lap.szovegek.map((t) => t.s).join(' \n ');
  const cim = lap.szovegek.filter((t) => t.meret >= 12 && /alaprajz|metszet|homlokzat|helyszínrajz|tetőfelülnézet/i.test(t.s)).map((t) => t.s.trim())[0] ?? '';
  if (/metszet/i.test(cim)) return { szerep: 'metszet', cim };
  if (/alaprajz/i.test(cim)) return { szerep: 'alaprajz', cim };
  if (/homlokzat/i.test(cim)) return { szerep: 'homlokzat', cim };
  if (/rétegrend/i.test(sz) && /[±+]\d,\d{2}/.test(sz)) return { szerep: 'metszet', cim: cim || 'Metszet' };
  if (/\d+[,.]\d{2}\s*m(²|2)/.test(sz)) return { szerep: 'alaprajz', cim: cim || 'Alaprajz' };
  // típusalaprajz-lap pecsét nélkül: sok nyílásfelirat („pm 90”, „P 90”) és „…típusok” felirat
  if (/típusok\s*:|típusalaprajz/i.test(sz) || lap.szovegek.filter((t) => /^(pm|p)\s*\d{2,3}\b/i.test(t.s.trim())).length >= 5) return { szerep: 'alaprajz', cim: cim || (/(\S+típusok)/i.exec(sz)?.[1] ?? 'Típusalaprajz') };
  return { szerep: 'egyeb', cim: cim || 'Egyéb lap' };
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
    const { szerep, cim } = lapSzerep(lap);
    ki.push({ fajl: f.name, oldal: n, szerep, cim, lap, kep: c.toDataURL('image/jpeg', 0.82), kepSzel: c.width, kepMag: c.height, szurke: szurkeKep(c, scale) });
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
  /** Pecsét nélküli lap: a helyiségek automatikusan felismert zárt terek. */
  auto?: boolean;
}

export function alaprajzFeldolgoz(lap: Lap, meretarany?: number, szurke?: SzurkeKep): AlaprajzFeldolgozas {
  const e = alaprajzElemez(lap);
  if (meretarany && meretarany > 0) { e.meretarany = meretarany; e.mPerPt = (25.4 / 72) / 1000 * meretarany; }
  // lépték nélküli lap (pl. kicsinyített típusalaprajz): a méretláncokból becsülve
  if (!e.mPerPt) { const M = meretaranyKotabol(lap.szovegek, lap.utvonalak); if (M) { e.meretarany = M; e.mPerPt = (25.4 / 72) / 1000 * M; e.figyelmeztetesek = e.figyelmeztetesek.filter((x) => !/méretarányt nem találtam/.test(x)); e.figyelmeztetesek.push(`A lépték a méretláncokból becsülve: M = 1:${M}. Ellenőrizd, szükség esetén add meg kézzel.`); } }
  let magHelyisegek = e.helyisegek.filter((h) => h.forras === 'pecset' && !h.kulter);
  // pecsét nélküli (egyszerűsített) alaprajz: a falakkal körbezárt terek a helyiségek
  const auto = !magHelyisegek.length && !!e.mPerPt;
  if (auto && szurke && !szurke.hatar) szurke = { ...szurke, hatar: arnyalatHatarok(szurke) };
  if (auto) {
    magHelyisegek = automatikusHelyisegek(lap, e.mPerPt!, szurke);
    e.helyisegek = magHelyisegek;
    if (magHelyisegek.length) e.figyelmeztetesek = e.figyelmeztetesek.filter((x) => !/Helyiséget nem találtam/.test(x));
    if (magHelyisegek.length) e.figyelmeztetesek.push(`Helyiségpecsét nincs a lapon: ${magHelyisegek.length} zárt teret ismertem fel helyiségként (Helyiség 1, 2, …). Jelöld ki a lakás helyiségeit, és nevezd át őket a Helyiségek lépésben.`);
  }
  if (!e.mPerPt || !magHelyisegek.length) return { e, magHelyisegek, r: null, nyilasok: [] };
  const kulsoPontok = e.helyisegek.filter((h) => h.kulter && h.forras === 'pecset').map((h) => h.mutato ?? h);
  const r = raszterEpit(lap, e.mPerPt, magHelyisegek.map((h) => h.mutato ?? h), auto ? { px: 0.04, resZaras: 3.0, vastagVonalFal: 0.05, ...(szurke ? { szinKep: szurke } : {}) } : { ...(kulsoPontok.length ? { kulsoPontok } : {}) });
  kotaEllenoriz(r, lap.szovegek);
  talajOldal(lap, r, e.helyisegek.filter((h) => h.forras === 'pecset' && !h.kulter).map((h) => h.mutato ?? h));
  // pecsét nélküli típusalaprajz: lakás = egy szürkével színezett, összefüggő terület helyiségei (az x-szel áthúzott aknák nélkül)
  if (auto && szurke) {
    const l = lakasCsoportok(r, magHelyisegek, lap, szurke);
    if (l.egysegek.length) {
      e.egysegek = l.egysegek; e.egysegInfo = l.info;
      // a helyiségként külön fel nem ismert lakásrészek (előtér, fürdő) – raszterindex nélkül, csak területtel
      e.helyisegek = [...e.helyisegek, ...l.kiegeszito];
      e.figyelmeztetesek.push(`${l.egysegek.length} lakást ismertem fel a szürke színezésből (egy lakás = egy összefüggő színezett terület, az x-szel áthúzott aknák nélkül). Válaszd ki a lakást a táblázatban.`);
    }
  }
  // falfülke (padlótól induló, sraffozott falszakasz előtti felirat): nem nyílászáró – kimarad az átvételből
  const nyilasok = nyilasokHozzarendel(nyilasFeliratok(lap.szovegek), r, magHelyisegek.map((h) => h.nev), auto)
    .map((n) => (n.fajta !== 'belso_ajto' && falfulkeE(n, r, lap) ? { ...n, fajta: 'falfulke' as const, kulso: false } : n));
  // felirat nélküli függönyfalak, üvegfalak (széles, üvegezett falszakasz a fűtött helyiség és a külső tér határán)
  nyilasok.push(...fuggonyfalak(r, nyilasok, magHelyisegek.map((h) => h.mutato ?? h)));
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
  return { e, magHelyisegek, r, nyilasok, auto };
}

export interface MetszetFeldolgozas {
  blokkok: { rr: TervRetegrend; becsles: SzerepBecsles; retegek: TervRetegUI[] }[];
  szintek: SzintEredmeny;
}

export function metszetFeldolgoz(lap: Lap): MetszetFeldolgozas {
  const b = retegrendBlokkok(lap.szovegek);
  return {
    blokkok: b.map((rr) => { const becsles = szerepBecsles(rr, b); return { rr, becsles, retegek: retegekEpit(rr, becsles, ujId) }; }),
    szintek: szintekKeres(lap.szovegek),
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
