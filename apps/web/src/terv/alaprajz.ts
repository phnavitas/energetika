/**
 * Alaprajz elemzése (1. kör): lépték, helyiségpecsétek és helyiségjegyzék, lakás/egység szerinti csoportosítás,
 * északjel felismerése. Csak a kinyert szövegekre és útvonalakra támaszkodik (rajzolóprogramtól független):
 * a helyiségpecsét általában kód / név / burkolat / „xx,xx m²” sorokból álló, egymás alatti szövegtömb.
 */
import type { Lap, Szoveg, Utvonal } from './kinyeres';

export interface TervHelyiseg {
  kod?: string; nev: string; burkolat?: string; A: number;
  /** A pecsét középpontja (pt, lapkoordináta). */
  x: number; y: number;
  /** A pecsét befoglaló téglalapja (pt). */
  bbox?: [number, number, number, number];
  /** Ha a pecsét mutatóvonallal (pont / nyíl végű vonal) jelöli a helyiséget: a mutatott pont. */
  mutato?: { x: number; y: number };
  egyseg?: string;
  forras: 'pecset' | 'jegyzek';
  /** A helyiségjegyzékben szereplő terület (ha van és eltér, figyelmeztetünk). */
  jegyzekA?: number;
  /** Külső tér (terasz, erkély, kocsibeálló…) – alapból nem kerül a fűtött helyiségek közé. */
  kulter: boolean;
}

export interface Eszakjel {
  /** Az észak iránya a lap „felfelé” irányától, óramutató járásával egyezően, fokban (0…360). */
  szog: number;
  x: number; y: number; meret: number;
  forras: 'betu' | 'alak';
  /** Az alakból becsült irány előjele bizonytalan (180°-kal fordítható). */
  bizonytalan: boolean;
  /** Az alak ujjlenyomata – a felhasználói javítás megjegyzéséhez. */
  alairas?: string;
  bbox: [number, number, number, number];
}

export interface AlaprajzEredmeny {
  meretarany: number | null;
  /** 1 pt a lapon hány méter a valóságban. */
  mPerPt: number | null;
  helyisegek: TervHelyiseg[];
  egysegek: string[];
  /** Egységenként: épület (több épület egy lapon), megjelenő név (pl. „1. Lakás”), helyiségszám, alapterület. */
  egysegInfo: Record<string, { epulet?: string; nev?: string; db: number; A: number }>;
  eszak: Eszakjel | null;
  figyelmeztetesek: string[];
}

/** Ligatúrák és tipikus PDF-kódolási hibák javítása (pl. Archicad „tt” → „Ʃ”). */
export function szovegJavit(s: string): string {
  return s.replace(/Ʃ/g, 'tt').replace(/Ɵ/g, 'ti').replace(/Ơ/g, 'tf').replace(/ﬀ/g, 'ff').replace(/ﬁ/g, 'fi').replace(/ﬂ/g, 'fl').replace(/ﬃ/g, 'ffi').replace(/ﬄ/g, 'ffl').replace(/ﬅ|ﬆ/g, 'st').replace(/\s+/g, ' ').trim();
}

export const szamErtek = (s: string): number => Number(s.replace(/\s/g, '').replace(',', '.'));

const TERULET = /^(\d{1,4}[,.]\d{1,2})\s*m\s*(²|2)?$/;
const KOD = /^[A-ZÁÉ]{0,3}\.?\s?\d{0,3}[.\-/]?\s?\d{1,3}[a-z]?$/;
/** Többtagú, pontokkal tagolt helyiség-/lakáskód: „A.F.L.4.”, „A.1.K.”, „B.F.L.1.3”, „L01.02”. */
export const KOD_TAGOLT = /^[A-ZÁÉ0-9]{1,4}(?:\.[A-ZÁÉ0-9]{1,4}){1,5}\.?$/;
/** Helyiségkód-e a szöveg (egyszerű „1.02”, „L01” vagy tagolt „A.F.L.4.”). */
export const kodE = (t: string) => (KOD.test(t) && /\d/.test(t)) || tagoltKod(t);
/** Tagolt kód: legalább három tag, vagy van benne számjegy (az „AKM. WC” rövidítés + név nem kód). */
export const tagoltKod = (t: string) => { const k = t.replace(/\s/g, ''); const tg = k.split('.').filter(Boolean); return KOD_TAGOLT.test(k) && (/\d/.test(k) || tg.length >= 3 || tg.every((x) => x.length === 1)); };
const BURKOLAT = /kerámia|keramia|parketta|parketa|laminált|lam\.|térkő|terko|beton|csempe|járólap|greslap|gres|pvc|linóleum|szőnyeg|padlószőnyeg|műgyanta|kő\b|kőlap|fa\s?burkolat|deszka|vinyl|vinil|esztrich|kavics|aszfalt|gumi|burkolat|kulé/i;
const KULTER = /terasz|erkély|erkely|loggia|kocsibeálló|kocsibeallo|járda|tornác|tornac|előkert|udvar|árkád|lépcsőfeljáró|kerti|bejáró|bejaro|kukatároló|kukataroló|hulladéktároló|szemetes/i;

const kozep = (t: Szoveg) => t.x + t.szel / 2;
const vizszintes = (t: Szoveg) => Math.abs(t.szog) < 2;

/** Méretarány: „M=1:100”, „M 1:50”, vagy önálló „1:100” felirat. */
export function meretaranyKeres(sz: Szoveg[]): number | null {
  for (const t of sz) { const m = /M\s*=?\s*1\s*:\s*(\d{1,4})/i.exec(t.s); if (m) return Number(m[1]); }
  for (const t of sz) { const m = /^1\s*:\s*(\d{1,4})$/.exec(t.s.trim()); if (m) return Number(m[1]); }
  return null;
}

/** Helyiségpecsétek: a területfelirat fölötti, azonos betűméretű, közel középre igazított sorok. */
export function pecsetek(sz: Szoveg[]): TervHelyiseg[] {
  const vsz = sz.filter(vizszintes);
  const ki: TervHelyiseg[] = [];
  for (const a of vsz) {
    const s = szovegJavit(a.s);
    const m = TERULET.exec(s);
    // a „m” nélküli szám csak akkor terület, ha közvetlenül utána felső indexű „2” vagy „m²” áll
    let ter: number | null = m ? szamErtek(m[1]!) : null;
    if (ter === null) {
      if (!/^\d{1,4}[,.]\d{1,2}$/.test(s)) continue;
      const kov = vsz.find((t) => t !== a && /^m\s*(²|2)?$/.test(szovegJavit(t.s)) && Math.abs(t.y - a.y) < a.meret * 0.5 && t.x > a.x && t.x - (a.x + a.szel) < a.meret);
      if (!kov) continue;
      ter = szamErtek(s);
    }
    const sorok: Szoveg[] = [];
    let akt = a; const cx = kozep(a);
    let koz = 0; // sortávolság: az első lépés rögzíti, a többi ehhez igazodik
    for (let k = 0; k < 6; k++) {
      const jelolt = vsz.filter((t) => t !== akt && !sorok.includes(t) && Math.abs(t.meret - a.meret) < a.meret * 0.2
        && t.y < akt.y - a.meret * 0.6 && t.y > akt.y - a.meret * 1.9 && Math.abs(kozep(t) - cx) < Math.max(a.szel, t.szel) * 0.75 + a.meret
        && (!koz || Math.abs(akt.y - t.y - koz) < koz * 0.25))
        .sort((p, q) => (Math.abs(kozep(p) - cx) + (akt.y - p.y)) - (Math.abs(kozep(q) - cx) + (akt.y - q.y)));
      const t = jelolt[0];
      if (t && !koz) koz = akt.y - t.y;
      if (!t) break;
      const ts = szovegJavit(t.s);
      // másik pecsét / méretszám (a magyar méretszám tizedesvesszős; a pontos „1.01” helyiségkód lehet)
      if (TERULET.test(ts) || /^\d+,\d+$/.test(ts) || /^\d{4,}$/.test(ts)) break;
      sorok.unshift(t); akt = t;
      if (kodE(ts)) break;
    }
    if (!sorok.length) continue;
    const szovegek = sorok.map((t) => szovegJavit(t.s));
    let kod: string | undefined; let burkolat: string | undefined; const nevResz: string[] = [];
    for (const t of szovegek) {
      if (!kod && kodE(t)) kod = t.replace(/\s/g, '');
      else if (!burkolat && BURKOLAT.test(t) && nevResz.length) burkolat = t;
      else nevResz.push(t);
    }
    if (!nevResz.length) continue;
    const nev = nevResz.join(' ').replace(/\s*\/\s*/g, ' / ');
    const ys = [...sorok, a].map((t) => t.y);
    const bal = Math.min(...[...sorok, a].map((t) => t.x)), jobb = Math.max(...[...sorok, a].map((t) => t.x + t.szel));
    const bbox: [number, number, number, number] = [bal, Math.min(...ys) - a.meret, jobb, Math.max(...ys) + a.meret * 0.25];
    ki.push({ kod, nev: nagybetuJavit(nev), burkolat, A: ter, x: cx, y: (Math.min(...ys) + Math.max(...ys)) / 2 - a.meret / 2, bbox, forras: 'pecset', kulter: KULTER.test(nev) || (!kod && BURKOLAT.test(nev) && nev.split(' ').length <= 2), egyseg: kod ? egysegKod(kod) : undefined });
  }
  // azonos pecsét kétszeri felismerése ellen
  return ki.filter((h, i) => ki.findIndex((g) => Math.hypot(g.x - h.x, g.y - h.y) < 3 && g.A === h.A) === i);
}

/** „NAPPALI / ÉTKEZŐ” → „Nappali / étkező”. A vegyes írásmódot meghagyja. */
export function nagybetuJavit(s: string): string {
  if (s !== s.toUpperCase() || s.replace(/[^\p{L}]/gu, '').length <= 3) return s;
  const k = s.toLowerCase();
  return k.charAt(0).toUpperCase() + k.slice(1);
}

/** Az egység (lakás) kódja a helyiségkódból: „L01.02” → „L01”, „1.02” → „1”. */
export function egysegKod(kod: string): string | undefined {
  const k = kod.replace(/\s/g, '');
  // ponttal záruló tagolt kód: maga a lakás / egység kódja („A.F.L.4.” → „A.F.L.4”, „A.F.K.” → „A.F.K”)
  if (tagoltKod(k) && k.endsWith('.')) return k.slice(0, -1);
  const m = /^(.*?\d+)[.\-/]\s?\d{1,3}[a-z]?$/.exec(k);
  return m ? m[1]!.replace(/[.\-/]$/, '') : undefined;
}

/** Tagolt egységkód olvasható neve: „A.F.L.4” → „A épület · földszint · 4. lakás”, „A.1.K” → „A épület · 1. emelet · közös terek”. */
export function egysegNev(eg: string): string | undefined {
  const t = eg.split('.').filter(Boolean);
  if (t.length < 3) return undefined;
  const li = t.findIndex((x, i) => i > 0 && /^(L|LAK|LK)$/i.test(x));
  const ki = t.findIndex((x, i) => i > 0 && /^(K|KÖZ|KOZ)$/i.test(x));
  if (li < 0 && ki < 0) return undefined;
  const szintTag = t[(li >= 0 ? li : ki) - 1];
  const szint = !szintTag || szintTag === t[0] ? '' : /^F(SZ)?$/i.test(szintTag) ? 'földszint' : /^(P|PI)$/i.test(szintTag) ? 'pince' : /^(T|TT)$/i.test(szintTag) ? 'tetőtér' : /^\d+$/.test(szintTag) ? `${Number(szintTag)}. emelet` : szintTag;
  const resz = [`${t[0]} épület`, szint, li >= 0 ? `${t[li + 1] ?? ''}. lakás` : 'közös terek'].filter(Boolean);
  return resz.join(' · ');
}

/** Helyiségjegyzék (táblázat) sorai: azonos magasságú szövegek, a sor végén terület. */
export function jegyzekSorok(sz: Szoveg[]): TervHelyiseg[] {
  const vsz = sz.filter(vizszintes).map((t) => ({ ...t, s: szovegJavit(t.s) }));
  const sorok: (typeof vsz)[] = [];
  for (const t of [...vsz].sort((p, q) => p.y - q.y || p.x - q.x)) {
    const s = sorok.find((r) => Math.abs(r[0]!.y - t.y) < t.meret * 0.35 && Math.abs(r[0]!.meret - t.meret) < 0.5 && Math.abs(r.at(-1)!.x + r.at(-1)!.szel - t.x) < 120);
    if (s) s.push(t); else sorok.push([t]);
  }
  const ki: TervHelyiseg[] = [];
  for (const r of sorok) {
    r.sort((p, q) => p.x - q.x);
    if (r.length < 3) continue;
    const utolso = r.at(-1)!.s;
    if (!/^\d{1,4}[,.]\d{1,2}$/.test(utolso)) continue;
    // a kód az első egy-két elemből áll össze („L01.” + „01”)
    let kod = ''; let i = 0;
    while (i < r.length - 1 && ((/^[A-ZÁÉ]{0,3}\.?\d{0,3}[.\-/]?\s?\d{0,3}\.?$/.test(r[i]!.s) && /\d/.test(r[i]!.s)) || tagoltKod(r[i]!.s)) && kod.length < 16) { kod += r[i]!.s.replace(/\s/g, ''); i++; }
    const kozepso = r.slice(i, -1).map((t) => t.s);
    if (!kozepso.length || !kod) continue;
    let burkolat: string | undefined; const nevResz: string[] = [];
    for (const t of kozepso) { if (!burkolat && nevResz.length && BURKOLAT.test(t)) burkolat = t; else nevResz.push(t); }
    if (!nevResz.length || /összesen|össz\.|sum/i.test(nevResz.join(' ')) || !/\p{L}{2}/u.test(nevResz.join(' '))) continue;
    const nev = nevResz.join(' ');
    ki.push({ kod, nev: nagybetuJavit(nev), burkolat, A: szamErtek(utolso), x: kozep(r[0]!), y: r[0]!.y, forras: 'jegyzek', kulter: KULTER.test(nev), egyseg: egysegKod(kod) });
  }
  return ki;
}

/**
 * Mutatóvonalak: a pecsét mellől induló vékony vonal, amelynek túlsó végén kis kitöltött pont vagy nyílhegy van –
 * ilyenkor a helyiség a mutatott ponton van, nem a pecsét helyén.
 */
export function mutatokKeres(lap: Lap, hs: TervHelyiseg[]): void {
  // kis kitöltött kör (≥ 8 csúcs, közel négyzetes befoglalóval) vagy nyílhegy (3 csúcs)
  const pontok = lap.utvonalak.filter((u) => {
    if (u.muvelet === 'stroke') return false;
    const w = u.bbox[2] - u.bbox[0], h = u.bbox[3] - u.bbox[1], n = u.pontok[0]!.length / 2;
    return Math.max(w, h) <= 6 && Math.min(w, h) >= 1 && (n >= 8 ? Math.abs(w - h) < 0.25 * Math.max(w, h) : n <= 4);
  });
  const vonalak = lap.utvonalak.filter((u) => u.muvelet === 'stroke' && u.pontok.length === 1 && u.pontok[0]!.length <= 6 && u.vastagsag < 0.6);
  for (const h of hs) {
    if (!h.bbox) continue;
    const [bx0, by0, bx1, by1] = h.bbox; const t = 4;
    const benne = (x: number, y: number) => x > bx0 - t && x < bx1 + t && y > by0 - t && y < by1 + t;
    let legjobb: { x: number; y: number; d: number } | null = null;
    for (const v of vonalak) {
      const p = v.pontok[0]!; const n = p.length / 2;
      const vegek: [number, number][] = [[p[0]!, p[1]!], [p[2 * n - 2]!, p[2 * n - 1]!]];
      for (const [e, m] of [[0, 1], [1, 0]] as const) {
        const [ex, ey] = vegek[e]!, [mx, my] = vegek[m]!;
        if (!benne(ex, ey) || benne(mx, my)) continue;
        const hossz = Math.hypot(mx - ex, my - ey); if (hossz < 10) continue;
        // a méretvonalak, falvonalak tengelyirányúak – a mutatóvonal jellemzően ferde
        const sz = Math.abs(Math.atan2(my - ey, mx - ex) * 180 / Math.PI) % 90;
        if (sz < 8 || sz > 82) continue;
        const pont = pontok.find((u) => { const cx = (u.bbox[0] + u.bbox[2]) / 2, cy = (u.bbox[1] + u.bbox[3]) / 2; return Math.hypot(cx - mx, cy - my) < 3.5; });
        if (!pont) continue;
        if (!legjobb || hossz > legjobb.d) legjobb = { x: (pont.bbox[0] + pont.bbox[2]) / 2, y: (pont.bbox[1] + pont.bbox[3]) / 2, d: hossz };
      }
    }
    if (legjobb) h.mutato = { x: legjobb.x, y: legjobb.y };
  }
}

// ——— Északjel ———

const terulet = (p: number[]) => { let a = 0; for (let i = 0; i + 3 < p.length; i += 2) a += p[i]! * p[i + 3]! - p[i + 2]! * p[i + 1]!; return a / 2; };

/** Kitöltött sokszögek tömegközéppontja és másodrendű nyomatékai. */
function nyomatekok(polik: number[][]) {
  let A = 0, Sx = 0, Sy = 0;
  const haromszogek: [number, number, number][] = []; // [cx, cy, terület] – legyezős felbontás
  for (const p of polik) {
    const n = p.length / 2; if (n < 3) continue;
    for (let i = 1; i + 1 < n; i++) {
      const ax = p[0]!, ay = p[1]!, bx = p[2 * i]!, by = p[2 * i + 1]!, cx = p[2 * i + 2]!, cy = p[2 * i + 3]!;
      const t = ((bx - ax) * (cy - ay) - (cx - ax) * (by - ay)) / 2;
      haromszogek.push([(ax + bx + cx) / 3, (ay + by + cy) / 3, t]);
      A += t; Sx += t * (ax + bx + cx) / 3; Sy += t * (ay + by + cy) / 3;
    }
  }
  if (Math.abs(A) < 1e-9) return null;
  const gx = Sx / A, gy = Sy / A;
  let Ixx = 0, Iyy = 0, Ixy = 0;
  for (const [x, y, t] of haromszogek) { Ixx += t * (x - gx) ** 2; Iyy += t * (y - gy) ** 2; Ixy += t * (x - gx) * (y - gy); }
  return { A, gx, gy, Ixx: Ixx / A, Iyy: Iyy / A, Ixy: Ixy / A };
}

const szogNorm = (d: number) => ((d % 360) + 360) % 360;
/** Lapirány (dx, dy; y lefelé) → szög a „felfelé” iránytól óramutató szerint. */
export const lapSzog = (dx: number, dy: number) => szogNorm(Math.atan2(dx, -dy) * 180 / Math.PI);

export function eszakjelKeres(lap: Lap, kizar: [number, number, number, number][] = []): Eszakjel | null {
  const { szovegek, utvonalak } = lap;
  // 1) „É” / „N” / „ÉSZAK” betű egy kis zárt alakzat mellett
  const betuk = szovegek.filter((t) => /^(É|N|ÉSZAK|NORTH)$/i.test(t.s.trim()));
  const kicsik = utvonalak.filter((u) => { const w = u.bbox[2] - u.bbox[0], h = u.bbox[3] - u.bbox[1]; return Math.max(w, h) > 10 && Math.max(w, h) < 200; });
  for (const b of betuk) {
    const bx = b.x + b.szel / 2, by = b.y - b.meret / 2;
    const kozel = kicsik.filter((u) => { const cx = (u.bbox[0] + u.bbox[2]) / 2, cy = (u.bbox[1] + u.bbox[3]) / 2; const r = Math.max(u.bbox[2] - u.bbox[0], u.bbox[3] - u.bbox[1]); return Math.hypot(cx - bx, cy - by) < r * 1.6 + b.meret && !(bx > u.bbox[0] && bx < u.bbox[2] && by > u.bbox[1] && by < u.bbox[3] && r > 120); });
    if (!kozel.length) continue;
    const bb: [number, number, number, number] = [Math.min(...kozel.map((u) => u.bbox[0])), Math.min(...kozel.map((u) => u.bbox[1])), Math.max(...kozel.map((u) => u.bbox[2])), Math.max(...kozel.map((u) => u.bbox[3]))];
    const cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2;
    if (Math.hypot(bx - cx, by - cy) < 1) continue;
    return { szog: lapSzog(bx - cx, by - cy), x: cx, y: cy, meret: Math.max(bb[2] - bb[0], bb[3] - bb[1]), forras: 'betu', bizonytalan: false, bbox: bb };
  }
  // 2) önálló, kompakt kitöltött alakzat (nyíl / egyedi jel)
  const betuJel = szovegek.filter((t) => /^[A-Z]$/.test(t.s.trim()) && t.meret > 8);
  const nemFeher = (u: Utvonal) => u.muvelet !== 'stroke' && !/^#(f[0-9a-f]){3}$/i.test(u.toltoSzin);
  type Jelolt = { u: Utvonal; pont: number };
  const jeloltek: Jelolt[] = [];
  for (const u of utvonalak) {
    if (!nemFeher(u)) continue;
    const w = u.bbox[2] - u.bbox[0], h = u.bbox[3] - u.bbox[1], r = Math.max(w, h);
    if (r < 20 || r > 200 || Math.min(w, h) < r * 0.3) continue;
    const cx = (u.bbox[0] + u.bbox[2]) / 2, cy = (u.bbox[1] + u.bbox[3]) / 2;
    if (kizar.some((k) => cx > k[0] && cx < k[2] && cy > k[1] && cy < k[3])) continue;
    // metszetjel / tengelyjel: mellette egy nagy betű (A, B, 1…) – nem északjel
    if (betuJel.some((t) => Math.hypot(t.x + t.szel / 2 - cx, t.y - t.meret / 2 - cy) < r * 1.2 + 10)) continue;
    // elszigeteltség: a befoglaló téglalapba lógó egyéb (nem óriás) útvonalak száma
    let zavar = 0;
    for (const v of utvonalak) {
      if (v === u) continue;
      const vr = Math.max(v.bbox[2] - v.bbox[0], v.bbox[3] - v.bbox[1]);
      if (vr > r * 4) continue;
      if (v.bbox[2] > u.bbox[0] && v.bbox[0] < u.bbox[2] && v.bbox[3] > u.bbox[1] && v.bbox[1] < u.bbox[3]) zavar++;
    }
    const kitoltes = Math.abs(u.pontok.reduce((s, p) => s + terulet(p), 0)) / (w * h);
    if (zavar > 12 || kitoltes > 0.85) continue; // a tömör téglalap pl. tömör fal / jelmagyarázat
    const sotet = /^#([0-4][0-9a-f]){3}$/i.test(u.toltoSzin) ? 2 : 0;
    jeloltek.push({ u, pont: sotet + (12 - zavar) / 4 + (u.pontok[0]!.length / 2 > 6 ? 1 : 0) });
  }
  jeloltek.sort((a, b) => b.pont - a.pont);
  const j = jeloltek[0];
  if (!j) return null;
  const m = nyomatekok(j.u.pontok);
  if (!m) return null;
  // főtengely (tengelyszimmetrikus nyílnál a szimmetriatengely)
  const fi = 0.5 * Math.atan2(2 * m.Ixy, m.Ixx - m.Iyy);
  const ex = Math.cos(fi), ey = Math.sin(fi);
  // irány: a „csúcs” felé – a csúcs a súlyponttól legtávolabbi pont a tengely mentén (ferdeség előjele)
  let maxP = -Infinity, minP = Infinity;
  for (const p of j.u.pontok) for (let i = 0; i < p.length; i += 2) { const t = (p[i]! - m.gx) * ex + (p[i + 1]! - m.gy) * ey; maxP = Math.max(maxP, t); minP = Math.min(minP, t); }
  const elojel = maxP >= -minP ? 1 : -1;
  const bb = j.u.bbox;
  const alairas = `${j.u.pontok.length}:${j.u.pontok.map((p) => p.length / 2).join(',')}:${Math.round(Math.abs(maxP + minP) / (maxP - minP) * 20)}`;
  return { szog: lapSzog(ex * elojel, ey * elojel), x: m.gx, y: m.gy, meret: Math.max(bb[2] - bb[0], bb[3] - bb[1]), forras: 'alak', bizonytalan: true, alairas, bbox: [...bb] as [number, number, number, number] };
}

/** Lapirány (a „felfelé” iránytól óramutató szerint, fok) → égtáj, adott északjel-szög mellett. */
export function egtaj(lapIrany: number, eszakSzog: number): 'É' | 'ÉK' | 'K' | 'DK' | 'D' | 'DNy' | 'Ny' | 'ÉNy' {
  const az = szogNorm(lapIrany - eszakSzog);
  return (['É', 'ÉK', 'K', 'DK', 'D', 'DNy', 'Ny', 'ÉNy'] as const)[Math.round(az / 45) % 8]!;
}
export const azimut = (lapIrany: number, eszakSzog: number) => szogNorm(lapIrany - eszakSzog);

/** A teljes 1. kör: lépték, helyiségek (pecsét + jegyzék egyeztetése), egységek, északjel. */
export function alaprajzElemez(lap: Lap): AlaprajzEredmeny {
  const figy: string[] = [];
  const M = meretaranyKeres(lap.szovegek);
  if (!M) figy.push('A méretarányt nem találtam a lapon (pl. „M=1:100”) – add meg kézzel.');
  const pec = pecsetek(lap.szovegek);
  mutatokKeres(lap, pec);
  const jegy = jegyzekSorok(lap.szovegek);
  const helyisegek: TervHelyiseg[] = [...pec];
  // a jegyzék sorát a pecséthez kötjük: azonos kód (írásmódtól függetlenül), vagy azonos terület és hasonló név
  const kodN = (k?: string) => (k ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').replace(/(\D)0+(\d)/g, '$1$2');
  const nevN = (n: string) => n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');
  const kodSzam = new Map<string, number>();
  for (const h of pec) if (h.kod) kodSzam.set(kodN(h.kod), (kodSzam.get(kodN(h.kod)) ?? 0) + 1);
  const parja = (j: TervHelyiseg) => pec.find((h) => j.kod && h.kod && kodN(h.kod) === kodN(j.kod) && (kodSzam.get(kodN(h.kod)) === 1 || (!h.jegyzekA && Math.abs(h.A - j.A) < 0.011)))
    ?? pec.find((h) => !h.jegyzekA && Math.abs(h.A - j.A) < 0.011 && (nevN(h.nev).includes(nevN(j.nev)) || nevN(j.nev).includes(nevN(h.nev))) && (!h.egyseg || !j.egyseg || kodN(h.egyseg) === kodN(j.egyseg)));
  let csakJegyzek = 0;
  for (const j of jegy) {
    const p = parja(j);
    if (p) { p.jegyzekA = j.A; if (Math.abs(p.A - j.A) > 0.011) figy.push(`${p.kod ?? p.nev}: a pecsét ${p.A.toFixed(2)} m², a jegyzék ${j.A.toFixed(2)} m² – ellenőrizd.`); if (!p.burkolat && j.burkolat) p.burkolat = j.burkolat; continue; }
    if (helyisegek.some((h) => h.forras === 'jegyzek' && kodN(h.kod) === kodN(j.kod) && Math.abs(h.A - j.A) < 0.011)) continue;
    helyisegek.push(j); if (pec.length) csakJegyzek++;
  }
  if (csakJegyzek) figy.push(`${csakJegyzek} helyiség csak a jegyzékben szerepel (pecsétje nem található) – alapból nem kerül át, ellenőrizd.`);
  if (!pec.length && jegy.length) figy.push('Helyiségpecsétet nem találtam, a helyiségjegyzékből olvastam be (a helyiségek helye a rajzon nem ismert).');
  if (!helyisegek.length) figy.push('Helyiséget nem találtam: a pecsétekben „xx,xx m²” formájú területnek kell szerepelnie.');
  helyisegek.sort((a, b) => (a.kod ?? '').localeCompare(b.kod ?? '', 'hu', { numeric: true }));
  // kód nélküli pecsét: a legközelebbi „N. lakás” / „Lakás N” felirat szerinti egység
  const lakasCimkek = lap.szovegek.map((t) => ({ t, m: /^(?:(\d+)\.?\s*(?:lakás|lakóegység|egység|ház|épület)|(?:lakás|lakóegység|egység|ház|épület)\s*(\d+|[A-Z]))$/i.exec(szovegJavit(t.s)) }))
    .filter((x) => x.m).map((x) => ({ nev: szovegJavit(x.t.s), x: x.t.x + x.t.szel / 2, y: x.t.y - x.t.meret / 2, szam: (x.m![1] ?? x.m![2])! }));
  if (lakasCimkek.length > 1) for (const h of helyisegek) {
    if (h.egyseg || h.forras !== 'pecset') continue;
    const k = [...lakasCimkek].sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0]!;
    h.egyseg = k.nev;
  }
  const egysegek = [...new Set(helyisegek.map((h) => h.egyseg).filter((e): e is string => !!e))].sort((a, b) => a.localeCompare(b, 'hu', { numeric: true }));
  const egysegInfo: AlaprajzEredmeny['egysegInfo'] = {};
  for (const eg of egysegek) {
    const hs = helyisegek.filter((h) => h.egyseg === eg && !h.kulter && h.forras === 'pecset');
    const hsAll = hs.length ? hs : helyisegek.filter((h) => h.egyseg === eg && !h.kulter);
    // épület: többszintű kód első tagja (pl. „A.1.02” → A, „B-L01.03” → B)
    const tagok = eg.split(/[.\-/]/).filter(Boolean);
    const epulet = tagok.length >= 2 ? tagok[0] : undefined;
    // név: a kód számával egyező „N. lakás” felirat, vagy a helyiségek súlypontjához legközelebbi
    const szam = /(\d+)\D*$/.exec(eg)?.[1];
    const cx = hsAll.reduce((s2, h) => s2 + h.x, 0) / Math.max(1, hsAll.length), cy = hsAll.reduce((s2, h) => s2 + h.y, 0) / Math.max(1, hsAll.length);
    const nev = lakasCimkek.find((c) => szam && Number(c.szam) === Number(szam))?.nev
      ?? [...lakasCimkek].sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))[0]?.nev;
    const tagoltNev = egysegNev(eg);
    egysegInfo[eg] = { epulet, nev: tagoltNev ?? (nev && nev !== eg ? nev : undefined), db: hsAll.length, A: Math.round(hsAll.reduce((s2, h) => s2 + h.A, 0) * 100) / 100 };
  }
  // az északjelet a feliratmezőn és a jelmagyarázaton kívül keressük: a helyiségjegyzék sorai és a nagy szövegtömbök körül nem
  const eszak = eszakjelKeres(lap);
  if (!eszak) figy.push('Északjelet nem találtam – add meg kézzel az észak irányát.');
  else if (eszak.bizonytalan) figy.push('Az északjel irányát az alakjából becsültem: ellenőrizd az előnézeten, szükség esetén fordítsd meg.');
  return { meretarany: M, mPerPt: M ? (25.4 / 72) / 1000 * M : null, helyisegek, egysegek, egysegInfo, eszak, figyelmeztetesek: figy };
}

/** A lap címéből a szintek: „Pince alaprajz” → [P], „1. és 2. emeleti alaprajz” → [1, 2], „Földszint” → [F]. */
export const SZINT_NEV: Record<string, string> = { P: 'Pince', F: 'Földszint', T: 'Tetőtér' };
export const szintNev = (k: string) => SZINT_NEV[k] ?? `${k}. emelet`;
export function szintekCimbol(cim: string): string[] {
  const c = cim.toLowerCase();
  if (/pince|alagsor|mélygarázs/.test(c)) return ['P'];
  if (/földszint|fszt|földsz/.test(c)) return ['F'];
  if (/tetőtér|tetoter/.test(c)) return ['T'];
  const tart = /(\d+)\s*\.?\s*[-–]\s*(\d+)\s*\.?\s*emelet/.exec(c);
  if (tart) { const a = Number(tart[1]), b = Number(tart[2]); return Array.from({ length: Math.max(0, b - a) + 1 }, (_, i) => String(a + i)); }
  const tobb = [...c.matchAll(/(\d+)\s*\.(?=[^\d]*(?:és|,|emelet))/g)].map((m) => m[1]!);
  if (tobb.length && /emelet/.test(c)) return [...new Set(tobb)];
  return [];
}
