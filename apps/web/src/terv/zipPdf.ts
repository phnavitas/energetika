/**
 * PDF-tervlapok ZIP-ből (2026-11-21, Balázs: „zipből is meg tudjuk nyitni a pdfeket? egyszerűbb lenne a tesztelés").
 *
 * Külső könyvtár nélkül: a ZIP központi könyvtárából a .pdf bejegyzések (bármely mappában; a __MACOSX kihagyva),
 * tárolt (0) vagy deflate (8) tömörítéssel – a böngésző DecompressionStream('deflate-raw') bontja ki. A fájlnév
 * UTF-8 (11. jelzőbit, ill. az Info-ZIP Unicode-név mező), különben a magyar Windows DOS-kódlapja (CP852).
 * A beágyazott ZIP-eket is kibontja (egy szint).
 */

const CP852_FELSO =
  'ÇüéâäůćçłëŐőîŹÄĆÉĹĺôöĽľŚśÖÜŤťŁ×čáíóúĄąŽžĘę¬źČş«»░▒▓│┤ÁÂĚŞ╣║╗╝Żż┐└┴┬├─┼Ăă╚╔╩╦╠═╬¤đĐĎËďŇÍÎě┘┌█▄ŢŮ▀ÓßÔŃńňŠšŔÚŕŰýÝţ´­˝˛ˇ˘§÷¸°¨˙űŘř■ ';

function cp852(b: Uint8Array): string {
  let s = '';
  for (const c of b) s += c < 128 ? String.fromCharCode(c) : CP852_FELSO[c - 128] ?? '?';
  return s;
}

async function inflal(adat: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const buf = await new Response(new Blob([adat.slice()]).stream().pipeThrough(ds)).arrayBuffer();
  return new Uint8Array(buf);
}

/** A ZIP .pdf (és beágyazott .zip) bejegyzései File-ként. */
export async function zipPdfek(zip: Blob, melyseg = 0): Promise<File[]> {
  const b = new Uint8Array(await zip.arrayBuffer());
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  // a központi könyvtár vége (EOCD) hátulról keresve
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 65535); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('nem ZIP fájl');
  const db = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const ki: File[] = [];
  for (let k = 0; k < db; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const jelzo = dv.getUint16(p + 8, true), mod = dv.getUint16(p + 10, true);
    const tomor = dv.getUint32(p + 20, true);
    const nevH = dv.getUint16(p + 28, true), extraH = dv.getUint16(p + 30, true), megjH = dv.getUint16(p + 32, true);
    const helyi = dv.getUint32(p + 42, true);
    const nevB = b.subarray(p + 46, p + 46 + nevH);
    let nev = jelzo & 0x800 ? new TextDecoder('utf-8').decode(nevB) : cp852(nevB);
    // Info-ZIP Unicode Path (0x7075) mező: UTF-8 név
    for (let e = p + 46 + nevH; e + 4 <= p + 46 + nevH + extraH;) {
      const id = dv.getUint16(e, true), h = dv.getUint16(e + 2, true);
      if (id === 0x7075 && h > 5) nev = new TextDecoder('utf-8').decode(b.subarray(e + 9, e + 4 + h));
      e += 4 + h;
    }
    p += 46 + nevH + extraH + megjH;
    const alap = nev.split('/').pop() ?? nev;
    if (!alap || /(^|\/)__MACOSX\//.test(nev) || alap.startsWith('._')) continue;
    const pdf = /\.pdf$/i.test(alap), bzip = /\.zip$/i.test(alap) && melyseg < 1;
    if (!pdf && !bzip) continue;
    // a helyi fejléc után az adat (a helyi fejléc név- és extra-hossza eltérhet a központitól)
    const lNev = dv.getUint16(helyi + 26, true), lExtra = dv.getUint16(helyi + 28, true);
    const kezd = helyi + 30 + lNev + lExtra;
    const nyers = b.subarray(kezd, kezd + tomor);
    let adat: Uint8Array;
    if (mod === 0) adat = nyers;
    else if (mod === 8) adat = await inflal(nyers);
    else continue; // (más tömörítés – pl. LZMA – nem támogatott)
    if (pdf) ki.push(new File([adat.slice()], alap, { type: 'application/pdf' }));
    else ki.push(...(await zipPdfek(new Blob([adat.slice()]), melyseg + 1)));
  }
  // (a lapok név szerint – „E-2” a „E-10” előtt)
  return ki.sort((p, q) => p.name.localeCompare(q.name, 'hu', { numeric: true }));
}
