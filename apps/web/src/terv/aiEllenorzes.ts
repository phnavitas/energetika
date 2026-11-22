/**
 * AI-ELLENŐRZÉS (2026-11-22, Balázs: „Mehet így, ahogy írtad, minden"): az önellenőrzés által megjelölt alaprajzi lap
 * képe a felismert eredménnyel (hőburok, helyiségek) a worker /api/ai-ellenorzes végpontján át egy képfelismerő
 * modellnek. Csak a hőburok környéke megy ki (a lap szövegmezője – név, cím – nem); a felhasználó gombnyomására.
 */

export interface AiHiba { tipus: string; leiras: string; hely?: [number, number, number, number]; javaslat?: string;
  /** A hibás besorolású helyiség neve (a kontextus helyiséglistájából) és a helyes besorolás. */
  helyiseg?: string; besorolas?: 'futott' | 'futetlen' | 'kulter' }
export interface AiValasz { rendben: boolean; hibak: AiHiba[]; epulet?: { szintek_szama?: number | null; teto?: string } }

const TOKEN_KULCS = 'ekm-ai-token';
export const aiToken = (): string | null => { try { return localStorage.getItem(TOKEN_KULCS); } catch { return null; } };
export const aiTokenMent = (t: string) => { try { if (t) localStorage.setItem(TOKEN_KULCS, t); else localStorage.removeItem(TOKEN_KULCS); } catch { /* */ } };

async function dataUrl(href: string): Promise<string> {
  if (href.startsWith('data:')) return href;
  const b = await (await fetch(href)).blob();
  return await new Promise((ok, hiba) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = hiba; r.readAsDataURL(b); });
}

/**
 * Az SVG rajz (a lap képe és a rárajzolt felismerés) egy kivágata PNG-ként (base64, fejléc nélkül).
 * nezet: [x, y, w, h] lapkoordinátában; a kép hosszabbik oldala `px` képpont.
 */
export async function svgKivagatPng(svg: SVGSVGElement, nezet: [number, number, number, number], px = 1600): Promise<string> {
  const m = svg.cloneNode(true) as SVGSVGElement;
  m.setAttribute('viewBox', nezet.join(' '));
  const ar = nezet[2] / nezet[3]; const W = ar >= 1 ? px : Math.round(px * ar), H = ar >= 1 ? Math.round(px / ar) : px;
  m.setAttribute('width', String(W)); m.setAttribute('height', String(H)); m.removeAttribute('style');
  m.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); m.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  // a beágyazott képek (lap, raszter-rétegek) adat-URL-ként – a kép-SVG külső hivatkozást nem tölt be
  for (const im of [...m.querySelectorAll('image')]) {
    const h = im.getAttribute('href') ?? im.getAttribute('xlink:href'); if (!h) continue;
    try { im.setAttribute('href', await dataUrl(h)); } catch { im.remove(); }
  }
  const s = new XMLSerializer().serializeToString(m);
  const kep = new Image();
  await new Promise((ok, hiba) => { kep.onload = ok; kep.onerror = hiba; kep.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s); });
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d')!; g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.drawImage(kep, 0, 0, W, H);
  return c.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
}

export async function aiEllenoriz(kep: string, kontextus: unknown): Promise<{ valasz: AiValasz | null; nyers?: string; hiba?: string }> {
  const t = aiToken(); if (!t) return { valasz: null, hiba: 'Nincs megadva AI-token.' };
  let v: Response;
  try { v = await fetch('/api/ai-ellenorzes', { method: 'POST', headers: { 'content-type': 'application/json', 'x-ai-token': t }, body: JSON.stringify({ kep, kontextus }) }); }
  catch { return { valasz: null, hiba: 'Az AI-ellenőrzés nem érhető el (hálózati hiba).' }; }
  const a = await v.json().catch(() => null) as { valasz?: AiValasz; nyers?: string; hiba?: string } | null;
  if (!v.ok || !a) return { valasz: null, hiba: a?.hiba ?? `Hiba (${v.status}).` };
  return { valasz: a.valasz ?? null, ...(a.nyers ? { nyers: a.nyers } : {}) };
}
