/**
 * Terepszint alatti szint (pince, alagsor): a fűtött helyiségek „külső” (nem pecsételt tér felé néző) falszakaszainak
 * szétválasztása talaj, ill. fűtetlen belső tér (pl. nyitott, a raszterben kifelé „szivárgó” mélygarázs) szerint.
 * Szabály (rajzolási konvenciótól független, csak a falkitöltésekből): a lap falai 0,2 m-es rácson; a 7 m-nél
 * keskenyebb rések (kapu, rámpa, ajtó) lezárásával a tér összefüggő tartományokra bomlik (a pillérek nem
 * választanak). Talaj: a lapszélig nyúló tartomány, ill. a helyiségpecsét nélküli, nagy zárt zseb (terep). Belső tér:
 * a pecsétes tartomány (pl. mélygarázs) és a kis zárt zseb (akna, liftakna). A falszakasz külső síkja mögött 0,3 m-re
 * nézzük, melyikbe esik.
 */
import type { Lap } from './kinyeres';
import { falKitoltes, poliRajzol, type Raszter, type FalSzakasz } from './raszter';

const IRANY: Record<number, [number, number]> = { 0: [0, -1], 90: [1, 0], 180: [0, 1], 270: [-1, 0] };

/** A „külső” falszakaszok talaj-jelölése (helyben, a `talaj` mezőben). */
export function talajOldal(lap: Lap, r: Raszter, pecsetPontok: { x: number; y: number }[] = []): void {
  const ptPx = r.mPerPt / r.px;
  const falPx = (x: number, y: number) => { const px = Math.round((x - r.x0) * ptPx), py = Math.round((y - r.y0) * ptPx); return px >= 0 && py >= 0 && px < r.w && py < r.h && !!r.fal[py * r.w + px]; };
  const lepes = 0.05 / r.mPerPt;
  // a teljes lap falkitöltései 0,2 m-es rácson; a 7 m-nél keskenyebb rések (kapuk, rámpák, nyílások) lezárva, a
  // lapszélről elárasztott tér a „kint” (az épület körvonalán kívüli terep); a lezárás után visszanövesztve
  const G = 0.2 / r.mPerPt, gw = Math.ceil(lap.szel / G), gh = Math.ceil(lap.mag / G), N = gw * gh;
  const racs = new Uint8Array(N);
  // (a pillérek – 1,2 m-nél kisebb önálló kitöltések – nem választják szét a teret, pl. mélygarázsban)
  for (const u of lap.utvonalak) if (u.muvelet !== 'stroke' && !/^#(f[0-9a-f]){3}$/i.test(u.toltoSzin) && Math.max(u.bbox[2] - u.bbox[0], u.bbox[3] - u.bbox[1]) * r.mPerPt >= 1.2 && falKitoltes(u, r.mPerPt)) poliRajzol(racs, gw, gh, u.pontok, (x, y) => [x / G, y / G]);
  const tavolsag = (forras: Uint8Array) => {
    // kétmenetes (3-4 chamfer) távolságtranszformáció cellában
    const d = new Float32Array(N); for (let k = 0; k < N; k++) d[k] = forras[k] ? 0 : 1e9;
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) { const k = y * gw + x; let v = d[k]!; if (x > 0) v = Math.min(v, d[k - 1]! + 1); if (y > 0) { v = Math.min(v, d[k - gw]! + 1); if (x > 0) v = Math.min(v, d[k - gw - 1]! + 1.414); if (x < gw - 1) v = Math.min(v, d[k - gw + 1]! + 1.414); } d[k] = v; }
    for (let y = gh - 1; y >= 0; y--) for (let x = gw - 1; x >= 0; x--) { const k = y * gw + x; let v = d[k]!; if (x < gw - 1) v = Math.min(v, d[k + 1]! + 1); if (y < gh - 1) { v = Math.min(v, d[k + gw]! + 1); if (x < gw - 1) v = Math.min(v, d[k + gw + 1]! + 1.414); if (x > 0) v = Math.min(v, d[k + gw - 1]! + 1.414); } d[k] = v; }
    return d;
  };
  const R = 3.5 / 0.2;
  const dFal = tavolsag(racs);
  // 1) a 7 m-nél keskenyebb rések lezárása: a falaktól 3,5 m-nél távolabbi cellák összefüggő tartományai (magok)
  const komp = new Int32Array(N).fill(-1); let kDb = 0;
  const szel = new Uint8Array(512); const pecset = new Uint8Array(512); const meret = new Int32Array(1 << 16);
  for (let k0 = 0; k0 < N; k0++) {
    if (komp[k0]! >= 0 || racs[k0] || dFal[k0]! <= R || kDb >= 511) continue;
    const id = kDb++; const q = [k0]; komp[k0] = id;
    for (let t = 0; t < q.length; t++) { const k = q[t]!, x = k % gw, y = (k / gw) | 0; if (x === 0 || y === 0 || x === gw - 1 || y === gh - 1) szel[id] = 1;
      for (const n of [x > 0 ? k - 1 : -1, x < gw - 1 ? k + 1 : -1, k - gw, k + gw]) if (n >= 0 && n < N && komp[n]! < 0 && !racs[n] && dFal[n]! > R) { komp[n] = id; q.push(n); } }
  }
  // 2) visszanövesztés a falakon át nem hatolva (geodetikus, szélességi bejárás), legfeljebb R + 2 cellányit
  {
    let front: number[] = []; for (let k = 0; k < N; k++) if (komp[k]! >= 0) front.push(k);
    for (let lep = 0; lep < R + 2 && front.length; lep++) {
      const uj: number[] = [];
      for (const k of front) { const x = k % gw; for (const n of [x > 0 ? k - 1 : -1, x < gw - 1 ? k + 1 : -1, k - gw, k + gw]) if (n >= 0 && n < N && komp[n]! < 0 && !racs[n]) { komp[n] = komp[k]!; uj.push(n); } }
      front = uj;
    }
  }
  // 3) a magokhoz el nem ért zárt zsebek (aknák, terep-zsebek) saját tartományt kapnak
  for (let k0 = 0; k0 < N; k0++) {
    if (komp[k0]! >= 0 || racs[k0] || kDb >= 511) continue;
    const id = kDb++; const q = [k0]; komp[k0] = id;
    for (let t = 0; t < q.length; t++) { const k = q[t]!, x = k % gw; for (const n of [x > 0 ? k - 1 : -1, x < gw - 1 ? k + 1 : -1, k - gw, k + gw]) if (n >= 0 && n < N && komp[n]! < 0 && !racs[n]) { komp[n] = id; q.push(n); } }
  }
  for (let k = 0; k < N; k++) if (komp[k]! >= 0 && komp[k]! < meret.length) meret[komp[k]!]++;
  // a helyiségpecsétek (fűtött és fűtetlen, pl. garázs) tartományai belső terek
  for (const p of pecsetPontok) { const gx = Math.floor(p.x / G), gy = Math.floor(p.y / G); if (gx >= 0 && gy >= 0 && gx < gw && gy < gh) { const c = komp[gy * gw + gx]!; if (c >= 0) pecset[c] = 1; } }
  const minAkna = 15 / (0.2 * 0.2); // 15 m² alatti zárt zseb: akna, lépcsőszem – belső tér
  const kint = (x: number, y: number) => {
    const gx = Math.floor(x / G), gy = Math.floor(y / G); if (gx < 0 || gy < 0 || gx >= gw || gy >= gh) return true;
    const c = komp[gy * gw + gx]!; if (c < 0) return false;
    return szel[c] === 1 || (!pecset[c] && meret[c]! >= minAkna);
  };
  for (const H of r.helyisegek) for (const s of H.szakaszok as (FalSzakasz & { talaj?: boolean })[]) {
    if (s.tul !== 'kulso' || !s.pontok.length) continue;
    const [dx, dy] = IRANY[s.irany] ?? [0, 0];
    // a fal külső síkja: a szakasz pontjaiból kifelé a falpixeleken át (legfeljebb 1,5 m)
    let minta = 0, tav = 0;
    const lep = Math.max(1, Math.floor(s.pontok.length / 12));
    for (let k = 0; k < s.pontok.length; k += lep) {
      const [x, y] = s.pontok[k]!; let d = 0;
      while (d < 1.5 / r.mPerPt && !falPx(x + dx * d, y + dy * d)) d += lepes;
      while (d < 1.5 / r.mPerPt && falPx(x + dx * d, y + dy * d)) d += lepes;
      tav += d; minta++;
    }
    if (!minta) continue;
    const kulsoSik = tav / minta;
    // a fal külső síkja mögött (0,3 m-re) az épület körvonalán kívüli tér van-e
    let kintDb = 0, sugar = 0;
    for (let k = 0; k < s.pontok.length; k += lep) { const [x, y] = s.pontok[k]!; sugar++; const d = kulsoSik + 0.3 / r.mPerPt; if (kint(x + dx * d, y + dy * d)) kintDb++; }
    s.talaj = kintDb >= sugar / 2;
  }
}
