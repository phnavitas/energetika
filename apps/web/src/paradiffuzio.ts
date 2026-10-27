/**
 * Páradiffúziós vizsgálat (Glaser-módszer, MSZ EN ISO 13788 egyszerűsített, állandósult állapot) és felületi
 * páralecsapódás / penészedés ellenőrzése egy rétegrendre.
 *
 * Telítési gőznyomás (MSZ EN ISO 13788 E.1):  θ ≥ 0: 610,5·e^(17,269·θ/(237,3+θ));  θ < 0: 610,5·e^(21,875·θ/(265,5+θ)) [Pa].
 * Egyenértékű légrétegvastagság: sd = μ·d. A gőznyomás a rétegrendben sd szerint lineáris; ha a lineáris lefutás eléri a
 * telítési görbét, a tényleges lefutás a telítési görbe alsó konvex burka („kifeszített fonal”), az érintési síkokban kondenzáció.
 */
import { retegrendSzamitas, type Retegrend, type RetegUI } from './modell';
import { anyag } from './katalogus';

export const psat = (t: number) => (t >= 0 ? 610.5 * Math.exp((17.269 * t) / (237.3 + t)) : 610.5 * Math.exp((21.875 * t) / (265.5 + t)));
/** Harmatpont a parciális gőznyomásból (°C). */
export function harmatpont(p: number): number {
  let lo = -40, hi = 60;
  for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; if (psat(m) < p) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
/** Levegő páradiffúziós tényezője, δ0 ≈ 2·10⁻¹⁰ kg/(m·s·Pa). */
export const DELTA0 = 2e-10;

/**
 * Páradiffúziós ellenállási szám (μ) alapértéke: a katalógus értéke, ha van; különben anyagcsoport szerinti jellemző
 * érték (MSZ EN ISO 10456, száraz kehely – tájékoztató, a gyártói adattal pontosítandó).
 */
export function muAlap(r: RetegUI): { mu: number; forras: string } {
  if (r.mu !== undefined) return { mu: r.mu, forras: 'kézi' };
  if (r.legreteg) return { mu: 1, forras: 'légréteg' };
  const a = anyag(r.anyagId);
  if (a?.mu !== undefined) return { mu: a.mu, forras: a.forras };
  const n = `${a?.nev ?? ''} ${r.nev ?? ''} ${a?.id ?? ''}`.toLowerCase();
  const J = 'MSZ EN ISO 10456 jellemző érték (tájékoztató)';
  const t: [RegExp, number][] = [
    [/pe fólia|pe_folia|párazáró|polietilén/, 100000],
    [/bitumen/, 50000],
    [/xps|extrudált/, 150],
    [/eps|polisztirol/, 60],
    [/pir|poliuretán/, 60],
    [/kőzetgyapot|ásványgyapot|asvany|uveggyapot|üveggyapot|cellulóz|kender|fagyapot/, 1],
    [/vasbeton|beton|esztrich|zsalukő|zsalufal|aljzat/, 130],
    [/pórusbeton|ytong|multipor/, 10],
    [/mészhomok|silka/, 15],
    [/tégla|porotherm|leiertherm|vázkerámia|vazkeramia|falazat|kerámia blokk/, 10],
    [/kerámia|greslap|járólap|csempe|keramia/, 200],
    [/gipszkarton|gipszrost|gipsz/, 10],
    [/nemesvakolat|szilikon|vékonyvakolat/, 60],
    [/ragasztó/, 20],
    [/vakolat|habarcs/, 10],
    [/osb/, 50],
    [/clt|puhafa|keményfa|fa\b|fenyő|deszka|parketta/, 50],
    [/kavics|homok|föld|salak|nád|vályog/, 3],
  ];
  for (const [re, mu] of t) if (re.test(n)) return { mu, forras: J };
  return { mu: 10, forras: 'ismeretlen anyag – becsült érték, add meg' };
}

export interface GlaserFeltetel { thetaI: number; phiI: number; thetaE: number; phiE: number }
/** MSZ-04-140-2 szerinti hazai gyakorlat: belső 20 °C / 60 %, külső −2 °C / 90 % (állítható). */
export const GLASER_ALAP: GlaserFeltetel = { thetaI: 20, phiI: 0.6, thetaE: -2, phiE: 0.9 };

export interface GlaserPont { x: number; sd: number; theta: number; psat: number; p: number }
export interface GlaserEredmeny {
  pontok: GlaserPont[];
  /** Rétegenkénti adatok. */
  retegek: { nev: string; dCm: number; mu: number; sd: number; muForras: string }[];
  sdOssz: number;
  pi: number; pe: number;
  /** Kondenzációs síkok (x cm-ben a belső felülettől) és a lecsapódó víz mennyisége g/(m²·nap). */
  kondenzacio: { x: number; sd: number; g: number }[];
  /** Összes lecsapódás g/(m²·nap), és 60 napos téli időszakra kg/m². */
  gNap: number; g60: number;
  thetaSi: number; harmatpontI: number;
  /** Felületi hőmérsékleti tényező és a penészmentességhez szükséges legkisebb érték (φsi ≤ 80 %). */
  fRsi: number; fRsiMin: number;
  feluletiKondenzacio: boolean; penesz: boolean;
  /** Nyári kiszáradás (90 nap, DIN 4108-3 párolgási időszak: kint és bent 1200 Pa; a kondenzációs síkban falnál 12 °C, tetőnél 20 °C telítési nyomás), kg/m². */
  kiszaradas: number;
  /** Megengedett lecsapódó mennyiség: 1,0 kg/m², kapillárisan nem nedvszívó réteg határán 0,5 kg/m² (DIN 4108-3). */
  hatar: number;
  /** 'nincs': nincs lecsapódás; 'megengedett': a határ alatt és nyáron kiszárad; 'nem_megfelelo'. */
  ertekeles: 'nincs' | 'megengedett' | 'nem_megfelelo';
}

/** Kapillárisan nem nedvszívó anyag (fólia, lemez, beton, szálas és hab hőszigetelés) – DIN 4108-3 szerinti 0,5 kg/m²-es határ. */
const NEM_NEDVSZIVO = /fólia|folia|lemez|bitumen|pvc|hdpe|fpo|beton|gyapot|eps|xps|pir|pur|polisztirol|poliuretán|üveg|fém|alumínium/i;
/** A Glaser-vizsgálat külső levegős peremfeltétellel nem értelmezhető: talajjal érintkező szerkezet. */
export const glaserNemErtelmezheto = (r: Retegrend) => r.szerep === 'padlo' || r.kovetelmenyKod === 'talajjal_erintkezo_fal' || r.kovetelmenyKod === 'talajon_fekvo_padlo';

export function glaser(r: Retegrend, f: GlaserFeltetel = GLASER_ALAP): GlaserEredmeny | null {
  let e: ReturnType<typeof retegrendSzamitas>;
  try { e = retegrendSzamitas(r); } catch { return null; }
  if (!r.retegek.length) return null;
  const q = (f.thetaI - f.thetaE) / e.Rtot;
  const pi = f.phiI * psat(f.thetaI), pe = f.phiE * psat(f.thetaE);
  // finom felbontás: rétegenként 12 részre (a telítési görbe rétegen belül is elérheti a lineáris lefutást)
  const pontok: GlaserPont[] = [];
  const retegek: GlaserEredmeny['retegek'] = [];
  let x = 0, sd = 0, theta = f.thetaI - q * e.Rsi;
  pontok.push({ x, sd, theta, psat: psat(theta), p: 0 });
  r.retegek.forEach((rg, i) => {
    const { mu, forras } = muAlap(rg);
    const d = rg.dCm / 100; const sdR = mu * d; const R = e.retegR[i] ?? 0;
    retegek.push({ nev: anyag(rg.anyagId)?.nev ?? rg.nev ?? 'réteg', dCm: rg.dCm, mu, sd: sdR, muForras: forras });
    const n = 12;
    for (let k = 1; k <= n; k++) {
      const th = theta - q * R * k / n;
      pontok.push({ x: x + rg.dCm * k / n, sd: sd + sdR * k / n, theta: th, psat: psat(th), p: 0 });
    }
    x += rg.dCm; sd += sdR; theta -= q * R;
  });
  const sdOssz = sd;
  // a gőznyomás „kifeszített fonala”: (0, pi) és (sdOssz, pe) között a telítési pontok alsó konvex burka
  const P = [{ sd: 0, p: pi }, ...pontok.map((t) => ({ sd: t.sd, p: Math.min(t.psat, Infinity) })), { sd: sdOssz, p: pe }];
  // a görbe végpontjai a belső / külső levegő értékei; a közbenső pontok csak felső korlátok (psat)
  const burok: { sd: number; p: number }[] = [];
  for (const pt of [P[0]!, ...P.slice(1, -1).filter((t) => t.sd > 0 && t.sd < sdOssz), P.at(-1)!].sort((a, b) => a.sd - b.sd)) {
    while (burok.length >= 2) {
      const a = burok.at(-2)!, b = burok.at(-1)!;
      // alsó burok: törlés, ha b a-pt egyenes fölött van
      if ((b.p - a.p) * (pt.sd - a.sd) >= (pt.p - a.p) * (b.sd - a.sd)) burok.pop(); else break;
    }
    burok.push(pt);
  }
  const pAt = (s: number) => {
    for (let k = 0; k + 1 < burok.length; k++) { const a = burok[k]!, b = burok[k + 1]!; if (s >= a.sd - 1e-12 && s <= b.sd + 1e-12) return b.sd - a.sd < 1e-12 ? a.p : a.p + (b.p - a.p) * (s - a.sd) / (b.sd - a.sd); }
    return pe;
  };
  for (const t of pontok) t.p = Math.min(pAt(t.sd), t.psat);
  // kondenzációs síkok: a burok belső csúcsai (ahol a fonal a telítési görbére fekszik)
  const kondenzacio: GlaserEredmeny['kondenzacio'] = [];
  for (let k = 1; k + 1 < burok.length; k++) {
    const a = burok[k - 1]!, b = burok[k]!, c = burok[k + 1]!;
    const be = b.sd > a.sd ? (a.p - b.p) / (b.sd - a.sd) : 0, ki = c.sd > b.sd ? (b.p - c.p) / (c.sd - b.sd) : 0;
    const g = DELTA0 * (be - ki) * 3600 * 24 * 1000; // g/(m²·nap)
    if (g <= 1e-6) continue;
    const t = pontok.reduce((m, u) => (Math.abs(u.sd - b.sd) < Math.abs(m.sd - b.sd) ? u : m));
    kondenzacio.push({ x: t.x, sd: b.sd, g });
  }
  const gNap = kondenzacio.reduce((s, k) => s + k.g, 0);
  const thetaSi = f.thetaI - q * e.Rsi;
  const fRsi = (thetaSi - f.thetaE) / (f.thetaI - f.thetaE);
  // penészmentesség: a belső felületen φsi ≤ 0,8 → psat(θsi,min) = pi / 0,8
  const thetaMin = harmatpont(pi / 0.8);
  const fRsiMin = (thetaMin - f.thetaE) / (f.thetaI - f.thetaE);
  const harmatpontI = harmatpont(pi);
  // nyári kiszáradás (DIN 4108-3): 90 nap, kint-bent 1200 Pa, a síkban a telítési nyomás 12 °C-on (fal), 20 °C-on (tető, felső zárófödém)
  const tetoE = r.szerep === 'teto' || r.szerep === 'padlas';
  const pSik = psat(tetoE ? 20 : 12);
  const kiszaradas = kondenzacio.reduce((s, k) => {
    const sdBe = Math.max(k.sd, 1e-3), sdKi = Math.max(sdOssz - k.sd, 1e-3);
    return s + DELTA0 * Math.max(0, pSik - 1200) * (1 / sdBe + 1 / sdKi) * 90 * 24 * 3600;
  }, 0);
  const retegX = (x: number) => { let a = 0; return r.retegek.filter((rg) => { const b = a + rg.dCm; const t = x >= a - 0.5 && x <= b + 0.5; a = b; return t; }); };
  const nemNedvszivo = kondenzacio.some((k) => retegX(k.x).some((rg) => NEM_NEDVSZIVO.test(`${anyag(rg.anyagId)?.nev ?? ''} ${rg.nev ?? ''}`)));
  const hatar = nemNedvszivo ? 0.5 : 1.0;
  const g60 = gNap * 60 / 1000;
  const ertekeles = !kondenzacio.length ? 'nincs' as const : g60 <= hatar && kiszaradas >= g60 ? 'megengedett' as const : 'nem_megfelelo' as const;
  return { kiszaradas, hatar, ertekeles, pontok, retegek, sdOssz, pi, pe, kondenzacio, gNap, g60, thetaSi, harmatpontI, fRsi, fRsiMin, feluletiKondenzacio: thetaSi <= harmatpontI, penesz: fRsi < fRsiMin };
}
