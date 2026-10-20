/**
 * Hőhíd-katalógus: paraméterezhető kétdimenziós csomópontok (MSZ EN ISO 10211). Minden csomópont a paraméterekből
 * téglalapos geometriát, a csatlakozó (karima-) szerkezetek egydimenziós U-értékét és – külső és belső méretrendszerben –
 * a karimák hosszát adja; Ψ = L2D − Σ Uj·lj.
 */
import type { Geometria, Teglalap, AnyagDef } from './szamito';

export interface Parameter { kulcs: string; nev: string; egyseg: 'm' | 'W/mK' | 'W/m²K'; alap: number; min: number; max: number; lepes?: number; csoport?: string }
export interface Karima { nev: string; U: number; lKulso: number; lBelso: number }
export interface Csomopont {
  geometria: Geometria;
  karimak: Karima[];
  /** Méretvonalak a rajzhoz: [x0,y0,x1,y1, felirat]. */
  meretek: [number, number, number, number, string][];
}
export interface HohidSablon {
  kod: string; nev: string; leiras: string;
  /** A csomópont típusa a hossz-javaslathoz és az ajánláshoz. */
  csoport: 'sarok' | 'csatlakozas' | 'fodem' | 'nyilas' | 'konzol' | 'labazat' | 'teto';
  parameterek: Parameter[];
  epit: (p: Record<string, number>) => Csomopont;
}

const RSI = 0.13, RSE = 0.04;
export const U1D = (retegek: [number, number][], Rsi = RSI, Rse = RSE) => 1 / (Rsi + Rse + retegek.reduce((s, [d, l]) => s + (d > 0 ? d / l : 0), 0));

const A = (nev: string, lambda: number, szin: string): AnyagDef => ({ nev, lambda, szin });
const SZ = { talaj: '#B9A27E', feltoltes: '#CDBB97', esztrich: '#D9D4CC', xps: '#7FB7D9', szig: '#F4D35E', fal: '#C8553D', vb: '#8D99AE', vakolat: '#E8E3D9', keret: '#6B4F3A', uveg: '#9AD1F5', fodem: '#8D99AE', szak: '#E07A5F', gipsz: '#EDEDED' };

const falParam = (csoport = 'Külső fal'): Parameter[] => [
  { kulcs: 'di', nev: 'Hőszigetelés vastagsága', egyseg: 'm', alap: 0.15, min: 0, max: 0.4, lepes: 0.01, csoport },
  { kulcs: 'lamI', nev: 'Hőszigetelés λ', egyseg: 'W/mK', alap: 0.039, min: 0.015, max: 0.2, lepes: 0.001, csoport },
  { kulcs: 'dw', nev: 'Falazat vastagsága', egyseg: 'm', alap: 0.30, min: 0.05, max: 0.8, lepes: 0.01, csoport },
  { kulcs: 'lamW', nev: 'Falazat λ', egyseg: 'W/mK', alap: 0.15, min: 0.05, max: 2.5, lepes: 0.005, csoport },
  { kulcs: 'dv', nev: 'Belső vakolat vastagsága', egyseg: 'm', alap: 0.015, min: 0, max: 0.05, lepes: 0.005, csoport },
];
const karimaParam = (alap = 1.2): Parameter => ({ kulcs: 'L', nev: 'Karimahossz (vágósík távolsága)', egyseg: 'm', alap, min: 0.6, max: 3, lepes: 0.1, csoport: 'Modell' });
const VAKOLAT_L = 0.8;
const falU = (p: Record<string, number>) => U1D([[p.di!, p.lamI!], [p.dw!, p.lamW!], [p.dv!, VAKOLAT_L]]);
const anyagokFal = (p: Record<string, number>) => ({ szig: A('Hőszigetelés', p.lamI!, SZ.szig), fal: A('Falazat', p.lamW!, SZ.fal), vak: A('Belső vakolat', VAKOLAT_L, SZ.vakolat) });

export const HOHID_SABLONOK: HohidSablon[] = [
  {
    kod: 'kulso_sarok', nev: 'Külső falsarok', csoport: 'sarok',
    leiras: 'Két külső fal kiugró sarka, kívül hőszigetelt falazat (vízszintes metszet).',
    parameterek: [...falParam(), karimaParam()],
    epit: (p) => {
      const t = p.di! + p.dw! + p.dv!, L = Math.max(p.L!, t + 0.3), m = 0.05;
      const el: Teglalap[] = [
        { x0: -m, y0: -m, x1: L, y1: L, anyag: 'kulso' },
        { x0: 0, y0: 0, x1: L, y1: L, anyag: 'szig' },
        { x0: p.di!, y0: p.di!, x1: L, y1: L, anyag: 'fal' },
        { x0: p.di! + p.dw!, y0: p.di! + p.dw!, x1: L, y1: L, anyag: 'vak' },
        { x0: t, y0: t, x1: L, y1: L, anyag: 'belso' },
      ];
      const U = falU(p);
      return { geometria: { x0: -m, y0: -m, x1: L, y1: L, elemek: el, anyagok: anyagokFal(p) },
        karimak: [{ nev: 'Külső fal (1)', U, lKulso: L, lBelso: L - t }, { nev: 'Külső fal (2)', U, lKulso: L, lBelso: L - t }],
        meretek: [[0, -m - 0.03, L, -m - 0.03, `${(L * 100).toFixed(0)}`], [L + 0.03, 0, L + 0.03, t, `${(t * 100).toFixed(1)}`]] };
    },
  },
  {
    kod: 'belso_sarok', nev: 'Belső (beforduló) falsarok', csoport: 'sarok',
    leiras: 'Két külső fal befelé forduló sarka (az épület L alakú része, vízszintes metszet).',
    parameterek: [...falParam(), karimaParam()],
    epit: (p) => {
      const t = p.di! + p.dw! + p.dv!, L = Math.max(p.L!, t + 0.3), B = L;
      const el: Teglalap[] = [
        { x0: -B, y0: -B, x1: L, y1: L, anyag: 'belso' },
        { x0: -t, y0: -t, x1: L, y1: 0, anyag: 'vak' }, { x0: -t, y0: -t, x1: 0, y1: L, anyag: 'vak' },
        { x0: -p.di! - p.dw!, y0: -p.di! - p.dw!, x1: L, y1: 0, anyag: 'fal' }, { x0: -p.di! - p.dw!, y0: -p.di! - p.dw!, x1: 0, y1: L, anyag: 'fal' },
        { x0: -p.di!, y0: -p.di!, x1: L, y1: 0, anyag: 'szig' }, { x0: -p.di!, y0: -p.di!, x1: 0, y1: L, anyag: 'szig' },
        { x0: 0, y0: 0, x1: L, y1: L, anyag: 'kulso' },
      ];
      const U = falU(p);
      return { geometria: { x0: -B, y0: -B, x1: L, y1: L, elemek: el, anyagok: anyagokFal(p) },
        karimak: [{ nev: 'Külső fal (1)', U, lKulso: L, lBelso: L + t }, { nev: 'Külső fal (2)', U, lKulso: L, lBelso: L + t }],
        meretek: [] };
    },
  },
  {
    kod: 't_csatlakozas', nev: 'Belső fal csatlakozása külső falhoz', csoport: 'csatlakozas',
    leiras: 'Teherhordó vagy válaszfal T-csatlakozása a külső falhoz (vízszintes metszet), a belső fal két oldalán fűtött tér.',
    parameterek: [...falParam(),
      { kulcs: 'dI', nev: 'Belső fal vastagsága', egyseg: 'm', alap: 0.30, min: 0.06, max: 0.5, lepes: 0.01, csoport: 'Belső fal' },
      { kulcs: 'lamB', nev: 'Belső fal λ', egyseg: 'W/mK', alap: 0.25, min: 0.05, max: 2.5, lepes: 0.005, csoport: 'Belső fal' },
      karimaParam()],
    epit: (p) => {
      const t = p.di! + p.dw! + p.dv!, L = Math.max(p.L!, 0.6), Li = 1.0, m = 0.05, h = p.dI! / 2;
      const el: Teglalap[] = [
        { x0: -m, y0: -L, x1: t + Li, y1: L, anyag: 'belso' },
        { x0: -m, y0: -L, x1: 0, y1: L, anyag: 'kulso' },
        { x0: 0, y0: -L, x1: p.di!, y1: L, anyag: 'szig' },
        { x0: p.di!, y0: -L, x1: p.di! + p.dw!, y1: L, anyag: 'fal' },
        { x0: p.di! + p.dw!, y0: -L, x1: t, y1: L, anyag: 'vak' },
        { x0: p.di! + p.dw!, y0: -h, x1: t + Li, y1: h, anyag: 'bfal' },
      ];
      const U = falU(p);
      return { geometria: { x0: -m, y0: -L, x1: t + Li, y1: L, elemek: el, anyagok: { ...anyagokFal(p), bfal: A('Belső fal', p.lamB!, SZ.fal) } },
        karimak: [{ nev: 'Külső fal', U, lKulso: 2 * L, lBelso: 2 * L - p.dI! }], meretek: [] };
    },
  },
  {
    kod: 'padlasfodem_fal', nev: 'Padlásfödém – külső fal (koszorú)', csoport: 'fodem',
    leiras: 'A legfelső födém felfekvése a külső falon, vasbeton koszorúval, a koszorú előtt hőszigeteléssel; fölötte hideg padlás (függőleges metszet).',
    parameterek: [...falParam(),
      { kulcs: 'hk', nev: 'Koszorú magassága', egyseg: 'm', alap: 0.25, min: 0, max: 0.5, lepes: 0.01, csoport: 'Koszorú' },
      { kulcs: 'dk', nev: 'Koszorú előtti hőszigetelés', egyseg: 'm', alap: 0.05, min: 0, max: 0.15, lepes: 0.01, csoport: 'Koszorú' },
      { kulcs: 'lamK', nev: 'Koszorú λ (vasbeton)', egyseg: 'W/mK', alap: 2.3, min: 0.1, max: 2.6, lepes: 0.05, csoport: 'Koszorú' },
      { kulcs: 'dF', nev: 'Födém teherhordó vastagsága', egyseg: 'm', alap: 0.20, min: 0.01, max: 0.4, lepes: 0.01, csoport: 'Födém' },
      { kulcs: 'lamF', nev: 'Födém λ', egyseg: 'W/mK', alap: 2.3, min: 0.1, max: 2.6, lepes: 0.05, csoport: 'Födém' },
      { kulcs: 'dA', nev: 'Padlásfödém hőszigetelés', egyseg: 'm', alap: 0.30, min: 0, max: 0.6, lepes: 0.01, csoport: 'Födém' },
      { kulcs: 'lamA', nev: 'Padlásfödém hőszigetelés λ', egyseg: 'W/mK', alap: 0.038, min: 0.015, max: 0.2, lepes: 0.001, csoport: 'Födém' },
      { kulcs: 'fel', nev: 'Falszigetelés felnyúlása a födém fölé', egyseg: 'm', alap: 0.30, min: 0, max: 0.8, lepes: 0.01, csoport: 'Födém' },
      karimaParam(1.2)],
    epit: (p) => {
      const t = p.di! + p.dw! + p.dv!, H = Math.max(p.L!, 0.8), Lx = Math.max(p.L!, t + 0.6), m = 0.05;
      const hk = Math.max(p.hk!, p.dF!), fent = p.dF! + p.dA! + 0.05;
      // y lefelé pozitív a rajzhoz igazítva: a födém alsó síkja y = 0, a födém teteje y = −dF
      const el: Teglalap[] = [
        { x0: -m, y0: -fent - Math.max(p.fel!, 0), x1: Lx, y1: H, anyag: 'kulso' },
        { x0: t, y0: 0, x1: Lx, y1: H, anyag: 'belso' },
        { x0: 0, y0: -p.dF! - p.fel!, x1: p.di!, y1: H, anyag: 'szig' },
        { x0: p.di!, y0: hk - p.dF!, x1: p.di! + p.dw!, y1: H, anyag: 'fal' },
        { x0: p.di!, y0: -p.dF!, x1: p.di! + p.dk!, y1: hk - p.dF!, anyag: 'szig' },
        { x0: p.di! + p.dk!, y0: -p.dF!, x1: p.di! + p.dw!, y1: hk - p.dF!, anyag: 'kosz' },
        { x0: p.di! + p.dw!, y0: -p.dF!, x1: Lx, y1: 0, anyag: 'fodem' },
        { x0: p.di! + p.dw!, y0: 0, x1: t, y1: H, anyag: 'vak' },
        { x0: p.di!, y0: -p.dF! - p.dA!, x1: Lx, y1: -p.dF!, anyag: 'aszig' },
      ];
      const Uw = falU(p), Uc = U1D([[p.dF!, p.lamF!], [p.dA!, p.lamA!]]);
      return { geometria: { x0: -m, y0: -fent - Math.max(p.fel!, 0), x1: Lx, y1: H, elemek: el, anyagok: { ...anyagokFal(p), kosz: A('Koszorú', p.lamK!, SZ.vb), fodem: A('Födém', p.lamF!, SZ.fodem), aszig: A('Padlásfödém hőszigetelés', p.lamA!, SZ.szig) } },
        karimak: [{ nev: 'Külső fal', U: Uw, lKulso: H + p.dF! + p.dA!, lBelso: H }, { nev: 'Padlásfödém', U: Uc, lKulso: Lx, lBelso: Lx - t }], meretek: [] };
    },
  },
  {
    kod: 'erkelylemez', nev: 'Erkélylemez / konzolos födém átvezetése', csoport: 'konzol',
    leiras: 'A közbenső vasbeton födém kinyúlik a homlokzaton (erkély, előtető); hőhídmegszakító elemmel vagy anélkül (függőleges metszet).',
    parameterek: [...falParam(),
      { kulcs: 'dS', nev: 'Födémlemez vastagsága', egyseg: 'm', alap: 0.20, min: 0.1, max: 0.4, lepes: 0.01, csoport: 'Lemez' },
      { kulcs: 'lamS', nev: 'Lemez λ (vasbeton)', egyseg: 'W/mK', alap: 2.3, min: 0.5, max: 2.6, lepes: 0.05, csoport: 'Lemez' },
      { kulcs: 'Lb', nev: 'Kinyúlás', egyseg: 'm', alap: 1.2, min: 0.2, max: 2.5, lepes: 0.05, csoport: 'Lemez' },
      { kulcs: 'lamTB', nev: 'Hőhídmegszakító egyenértékű λ (0: nincs)', egyseg: 'W/mK', alap: 0, min: 0, max: 2.3, lepes: 0.01, csoport: 'Lemez' },
      karimaParam(1.2)],
    epit: (p) => {
      const t = p.di! + p.dw! + p.dv!, H = Math.max(p.L!, 0.8), Lx = 1.2, m = 0.05, Lb = p.Lb!;
      const el: Teglalap[] = [
        { x0: -Lb - m, y0: -H, x1: t + Lx, y1: H + p.dS!, anyag: 'kulso' },
        { x0: t, y0: -H, x1: t + Lx, y1: H + p.dS!, anyag: 'belso' },
        { x0: 0, y0: -H, x1: p.di!, y1: H + p.dS!, anyag: 'szig' },
        { x0: p.di!, y0: -H, x1: p.di! + p.dw!, y1: H + p.dS!, anyag: 'fal' },
        { x0: p.di! + p.dw!, y0: -H, x1: t, y1: H + p.dS!, anyag: 'vak' },
        { x0: -Lb, y0: 0, x1: t + Lx, y1: p.dS!, anyag: 'lemez' },
        ...(p.lamTB! > 0 ? [{ x0: 0, y0: 0, x1: p.di!, y1: p.dS!, anyag: 'tb' }] : []),
      ];
      const Uw = falU(p);
      return { geometria: { x0: -Lb - m, y0: -H, x1: t + Lx, y1: H + p.dS!, elemek: el, anyagok: { ...anyagokFal(p), lemez: A('Vasbeton lemez', p.lamS!, SZ.vb), tb: A('Hőhídmegszakító', Math.max(p.lamTB!, 0.01), SZ.szak) } },
        karimak: [{ nev: 'Külső fal', U: Uw, lKulso: 2 * H + p.dS!, lBelso: 2 * H }], meretek: [] };
    },
  },
  {
    kod: 'ablak_kava', nev: 'Ablak beépítése (káva)', csoport: 'nyilas',
    leiras: 'Nyílászáró oldalsó kávája vízszintes metszetben: a tok helye a falban, kávahőszigetelés a tok külső síkjáig (Ψ beépítés).',
    parameterek: [...falParam(),
      { kulcs: 'xf', nev: 'Tok külső síkja a fal külső síkjától', egyseg: 'm', alap: 0.15, min: 0, max: 0.5, lepes: 0.01, csoport: 'Nyílászáró' },
      { kulcs: 'df', nev: 'Tok mélysége', egyseg: 'm', alap: 0.08, min: 0.05, max: 0.15, lepes: 0.005, csoport: 'Nyílászáró' },
      { kulcs: 'bf', nev: 'Tok + szárny nézetszélessége', egyseg: 'm', alap: 0.12, min: 0.05, max: 0.25, lepes: 0.005, csoport: 'Nyílászáró' },
      { kulcs: 'Uf', nev: 'Keret Uf', egyseg: 'W/m²K', alap: 1.1, min: 0.5, max: 3, lepes: 0.05, csoport: 'Nyílászáró' },
      { kulcs: 'Ug', nev: 'Üvegezés Ug', egyseg: 'W/m²K', alap: 0.6, min: 0.4, max: 3, lepes: 0.05, csoport: 'Nyílászáró' },
      { kulcs: 'dk', nev: 'Kávahőszigetelés vastagsága', egyseg: 'm', alap: 0.03, min: 0, max: 0.1, lepes: 0.005, csoport: 'Nyílászáró' },
      karimaParam(1.0)],
    epit: (p) => {
      const t = p.di! + p.dw! + p.dv!, Lw = Math.max(p.L!, 0.6), Lg = 0.6, m = 0.05;
      const xf = Math.min(p.xf!, t - p.df!), df = p.df!, bf = p.bf!;
      const lamF = df / Math.max(0.05, 1 / p.Uf! - 0.17), dg = 0.044, lamG = dg / Math.max(0.05, 1 / p.Ug! - 0.17);
      const xg = xf + df / 2 - dg / 2;
      const el: Teglalap[] = [
        { x0: -m, y0: -Lw, x1: xg, y1: bf + Lg, anyag: 'kulso' },
        { x0: xg, y0: 0, x1: t + 0.3, y1: bf + Lg, anyag: 'belso' },
        { x0: t, y0: -Lw, x1: t + 0.3, y1: 0, anyag: 'belso' },
        { x0: 0, y0: -Lw, x1: p.di!, y1: 0, anyag: 'szig' },
        { x0: p.di!, y0: -Lw, x1: p.di! + p.dw!, y1: 0, anyag: 'fal' },
        { x0: p.di! + p.dw!, y0: -Lw, x1: t, y1: 0, anyag: 'vak' },
        ...(p.dk! > 0 ? [{ x0: 0, y0: 0, x1: xf, y1: p.dk!, anyag: 'kszig' }] : []),
        { x0: xf, y0: 0, x1: xf + df, y1: bf, anyag: 'tok' },
        { x0: xg, y0: bf, x1: xg + dg, y1: bf + Lg, anyag: 'uveg' },
      ];
      const Uw = falU(p);
      return { geometria: { x0: -m, y0: -Lw, x1: t + 0.3, y1: bf + Lg, elemek: el, anyagok: { ...anyagokFal(p), kszig: A('Kávahőszigetelés', p.lamI!, SZ.szig), tok: A('Tok (egyenértékű)', lamF, SZ.keret), uveg: A('Üvegezés (egyenértékű)', lamG, SZ.uveg) } },
        karimak: [{ nev: 'Külső fal', U: Uw, lKulso: Lw, lBelso: Lw }, { nev: 'Keret', U: p.Uf!, lKulso: bf, lBelso: bf }, { nev: 'Üvegezés', U: p.Ug!, lKulso: Lg, lBelso: Lg }], meretek: [] };
    },
  },
];

// ---------------------------------------------------------------------------------------------
// Lábazati csomópontok (talajjal, MSZ EN ISO 10211 + 13370) és lapostető-attika

/** A talaj hővezetési tényezője (MSZ EN ISO 13370, ismeretlen talaj: 2,0 W/mK). */
export const TALAJ_LAMBDA = 2.0;
/** Talajon fekvő padló egydimenziós (talajjal együtt értelmezett) U0 értéke, MSZ EN ISO 13370 (8.1.2): B' jellemző méret, w falvastagság, Rf a padló rétegeinek ellenállása. */
export function U0padlo(B: number, w: number, Rf: number, Rsi = RSI, Rse = RSE, lg = TALAJ_LAMBDA): number {
  const dt = w + lg * (Rsi + Rf + Rse);
  return dt < B ? (2 * lg / (Math.PI * B + dt)) * Math.log(Math.PI * B / dt + 1) : lg / (0.457 * B + dt);
}

const labazatParam = (): Parameter[] => [
  { kulcs: 'dl', nev: 'Lábazati hőszigetelés vastagsága', egyseg: 'm', alap: 0.12, min: 0, max: 0.3, lepes: 0.01, csoport: 'Lábazat' },
  { kulcs: 'lamL', nev: 'Lábazati hőszigetelés λ (XPS)', egyseg: 'W/mK', alap: 0.035, min: 0.02, max: 0.1, lepes: 0.001, csoport: 'Lábazat' },
  { kulcs: 'D', nev: 'Lábazati szigetelés lenyúlása a terep alá', egyseg: 'm', alap: 0.6, min: 0, max: 1.5, lepes: 0.05, csoport: 'Lábazat' },
  { kulcs: 'h0', nev: 'Padlószint a terep fölött', egyseg: 'm', alap: 0.30, min: -0.2, max: 1.0, lepes: 0.01, csoport: 'Lábazat' },
];
const padloParam = (): Parameter[] => [
  { kulcs: 'dE', nev: 'Esztrich (+ burkolat) vastagsága', egyseg: 'm', alap: 0.07, min: 0.02, max: 0.15, lepes: 0.005, csoport: 'Padló' },
  { kulcs: 'lamE', nev: 'Esztrich λ', egyseg: 'W/mK', alap: 1.4, min: 0.2, max: 2.3, lepes: 0.05, csoport: 'Padló' },
  { kulcs: 'dP', nev: 'Padló hőszigetelése (esztrich alatt)', egyseg: 'm', alap: 0.10, min: 0, max: 0.4, lepes: 0.01, csoport: 'Padló' },
  { kulcs: 'lamP', nev: 'Padló hőszigetelés λ', egyseg: 'W/mK', alap: 0.036, min: 0.015, max: 0.2, lepes: 0.001, csoport: 'Padló' },
];
const BParam = (): Parameter => ({ kulcs: 'B', nev: "Jellemző alaprajzi méret B' (= A / 0,5P)", egyseg: 'm', alap: 8, min: 2, max: 40, lepes: 0.5, csoport: 'Modell' });

/** Közös talajmodell-keret: x = 0 a lábazati/homlokzati szigetelés külső síkja, y = 0 a terepszint, y lefelé nő. */
function talajKeret(p: Record<string, number>, t: number, alja: number, belsoVeg: number, falTeteje: number) {
  const b = p.B! / 2, kint = 2.5 * p.B!, mely = 2.5 * p.B!;
  return {
    x0: -kint, x1: t + b, y0: falTeteje, y1: Math.max(mely, alja + 1),
    finom: [-0.6, falTeteje, t + Math.min(b, 1.2), Math.max(alja, p.D! ?? 0) + 0.6] as [number, number, number, number],
    nezet: [-0.7, falTeteje, t + Math.min(b, 1.4), Math.max(alja, p.D ?? 0) + 0.9] as [number, number, number, number],
    b, belsoVeg,
  };
}

HOHID_SABLONOK.push(
  {
    kod: 'labazat_lemez', nev: 'Lábazat – lemezalap (talajon fekvő padló)', csoport: 'labazat',
    leiras: 'Vasbeton lemezalapon álló külső fal, lemez alatti és lábazati hőszigeteléssel; a padló a terepen (függőleges metszet, talajjal, ISO 10211 / 13370). A Ψ a padló–fal csatlakozás Ψ-jébe vihető át.',
    parameterek: [...falParam(), ...labazatParam(), ...padloParam(),
      { kulcs: 'dS', nev: 'Lemezalap vastagsága', egyseg: 'm', alap: 0.25, min: 0.1, max: 0.6, lepes: 0.01, csoport: 'Lemezalap' },
      { kulcs: 'lamS', nev: 'Lemezalap λ (vasbeton)', egyseg: 'W/mK', alap: 2.3, min: 0.5, max: 2.6, lepes: 0.05, csoport: 'Lemezalap' },
      { kulcs: 'dU', nev: 'Lemez alatti hőszigetelés (XPS)', egyseg: 'm', alap: 0.10, min: 0, max: 0.4, lepes: 0.01, csoport: 'Lemezalap' },
      { kulcs: 'lamU', nev: 'Lemez alatti hőszigetelés λ', egyseg: 'W/mK', alap: 0.035, min: 0.02, max: 0.1, lepes: 0.001, csoport: 'Lemezalap' },
      BParam(), karimaParam(1.2)],
    epit: (p) => {
      const t = p.di! + p.dw! + p.dv!, H = Math.max(p.L!, 0.8);
      const yF = -p.h0!, yS = yF + p.dE! + p.dP!, yU = yS + p.dS!, yA = yU + p.dU!;
      const k = talajKeret(p, t, yA, 0, yF - H);
      const xL = p.di! - Math.min(p.dl!, p.di!);
      const el: Teglalap[] = [
        { x0: k.x0, y0: k.y0, x1: k.x1, y1: k.y1, anyag: 'kulso' },
        { x0: k.x0, y0: 0, x1: k.x1, y1: k.y1, anyag: 'talaj' },
        ...(yA < 0 ? [{ x0: p.di!, y0: yA, x1: k.x1, y1: 0, anyag: 'talaj' }] : []),
        { x0: t, y0: yF - H, x1: k.x1, y1: yF, anyag: 'belso' },
        { x0: 0, y0: yF - H, x1: p.di!, y1: Math.min(-0.3, yS), anyag: 'szig' },
        { x0: xL, y0: Math.min(-0.3, yS), x1: p.di!, y1: Math.max(p.D!, yA), anyag: 'xps' },
        { x0: p.di!, y0: yF - H, x1: p.di! + p.dw!, y1: yS, anyag: 'fal' },
        { x0: p.di! + p.dw!, y0: yF - H, x1: t, y1: yF, anyag: 'vak' },
        { x0: p.di! + p.dw!, y0: yF, x1: k.x1, y1: yF + p.dE!, anyag: 'esztrich' },
        { x0: p.di! + p.dw!, y0: yF + p.dE!, x1: k.x1, y1: yS, anyag: 'pszig' },
        { x0: p.di!, y0: yS, x1: k.x1, y1: yU, anyag: 'lemez' },
        ...(p.dU! > 0 ? [{ x0: xL, y0: yU, x1: k.x1, y1: yA, anyag: 'xpsU' }] : []),
      ];
      const Uw = falU(p);
      const Rf = p.dE! / p.lamE! + p.dP! / p.lamP! + p.dS! / p.lamS! + p.dU! / p.lamU!;
      const U0 = U0padlo(p.B!, t, Rf);
      return { geometria: { x0: k.x0, y0: k.y0, x1: k.x1, y1: k.y1, finom: k.finom, nezet: k.nezet, elemek: el, anyagok: { ...anyagokFal(p), xps: A('Lábazati hőszigetelés', p.lamL!, SZ.xps), talaj: A('Talaj', TALAJ_LAMBDA, SZ.talaj), esztrich: A('Esztrich', p.lamE!, SZ.esztrich), pszig: A('Padló hőszigetelés', p.lamP!, SZ.szig), lemez: A('Lemezalap', p.lamS!, SZ.vb), xpsU: A('Lemez alatti hőszigetelés', p.lamU!, SZ.xps) } },
        karimak: [{ nev: 'Külső fal', U: Uw, lKulso: H + (yA - yF), lBelso: H }, { nev: `Padló (ISO 13370, B' = ${p.B!.toLocaleString('hu-HU')} m, U0)`, U: U0, lKulso: k.b + t, lBelso: k.b }], meretek: [] };
    },
  },
  {
    kod: 'labazat_savalap', nev: 'Lábazat – sávalap, talajon fekvő padló', csoport: 'labazat',
    leiras: 'Sávalapon (lábazati falon) álló külső fal, a padló aljzatbetonon a feltöltésen; lábazati hőszigetelés lenyúlással (függőleges metszet, talajjal, ISO 10211 / 13370). A Ψ a padló–fal csatlakozás Ψ-jébe vihető át.',
    parameterek: [...falParam(), ...labazatParam(), ...padloParam(),
      { kulcs: 'dA', nev: 'Aljzatbeton vastagsága', egyseg: 'm', alap: 0.12, min: 0.05, max: 0.3, lepes: 0.01, csoport: 'Alap' },
      { kulcs: 'lamA', nev: 'Aljzatbeton λ', egyseg: 'W/mK', alap: 1.55, min: 0.5, max: 2.3, lepes: 0.05, csoport: 'Alap' },
      { kulcs: 'bS', nev: 'Sávalap / lábazati fal szélessége', egyseg: 'm', alap: 0.40, min: 0.2, max: 1.0, lepes: 0.01, csoport: 'Alap' },
      { kulcs: 'lamS', nev: 'Sávalap λ (beton)', egyseg: 'W/mK', alap: 1.65, min: 0.3, max: 2.6, lepes: 0.05, csoport: 'Alap' },
      { kulcs: 'Da', nev: 'Alapozási sík a terep alatt', egyseg: 'm', alap: 0.9, min: 0.4, max: 2.5, lepes: 0.05, csoport: 'Alap' },
      BParam(), karimaParam(1.2)],
    epit: (p) => {
      const t = p.di! + p.dw! + p.dv!, H = Math.max(p.L!, 0.8);
      const yF = -p.h0!, yS = yF + p.dE! + p.dP!, yA = yS + p.dA!;
      const k = talajKeret(p, t, p.Da!, 0, yF - H);
      const xL = p.di! - Math.min(p.dl!, p.di!), bS = Math.max(p.bS!, p.dw!);
      const el: Teglalap[] = [
        { x0: k.x0, y0: k.y0, x1: k.x1, y1: k.y1, anyag: 'kulso' },
        { x0: k.x0, y0: 0, x1: k.x1, y1: k.y1, anyag: 'talaj' },
        ...(yA < 0 ? [{ x0: p.di!, y0: yA, x1: k.x1, y1: 0, anyag: 'feltoltes' }] : []),
        { x0: t, y0: yF - H, x1: k.x1, y1: yF, anyag: 'belso' },
        { x0: 0, y0: yF - H, x1: p.di!, y1: Math.min(-0.3, yS), anyag: 'szig' },
        { x0: xL, y0: Math.min(-0.3, yS), x1: p.di!, y1: Math.max(p.D!, -0.3), anyag: 'xps' },
        { x0: p.di!, y0: yF - H, x1: p.di! + p.dw!, y1: yS, anyag: 'fal' },
        { x0: p.di!, y0: yS, x1: p.di! + bS, y1: p.Da!, anyag: 'alap' },
        { x0: p.di! + p.dw!, y0: yF - H, x1: t, y1: yF, anyag: 'vak' },
        { x0: p.di! + p.dw!, y0: yF, x1: k.x1, y1: yF + p.dE!, anyag: 'esztrich' },
        { x0: p.di! + p.dw!, y0: yF + p.dE!, x1: k.x1, y1: yS, anyag: 'pszig' },
        { x0: p.di! + bS, y0: yS, x1: k.x1, y1: yA, anyag: 'aljzat' },
      ];
      const Uw = falU(p);
      const Rf = p.dE! / p.lamE! + p.dP! / p.lamP! + p.dA! / p.lamA!;
      const U0 = U0padlo(p.B!, t, Rf);
      return { geometria: { x0: k.x0, y0: k.y0, x1: k.x1, y1: k.y1, finom: k.finom, nezet: k.nezet, elemek: el, anyagok: { ...anyagokFal(p), xps: A('Lábazati hőszigetelés', p.lamL!, SZ.xps), talaj: A('Talaj', TALAJ_LAMBDA, SZ.talaj), feltoltes: A('Feltöltés', TALAJ_LAMBDA, SZ.feltoltes), esztrich: A('Esztrich', p.lamE!, SZ.esztrich), pszig: A('Padló hőszigetelés', p.lamP!, SZ.szig), alap: A('Sávalap', p.lamS!, SZ.vb), aljzat: A('Aljzatbeton', p.lamA!, SZ.vb) } },
        karimak: [{ nev: 'Külső fal', U: Uw, lKulso: H + (yA - yF), lBelso: H }, { nev: `Padló (ISO 13370, B' = ${p.B!.toLocaleString('hu-HU')} m, U0)`, U: U0, lKulso: k.b + t, lBelso: k.b }], meretek: [] };
    },
  },
  {
    kod: 'lapos_teto_attika', nev: 'Lapostető – külső fal (attika)', csoport: 'teto',
    leiras: 'Vasbeton födémes, felül hőszigetelt lapostető csatlakozása a külső falhoz, a fal fölé nyúló attikával; az attika körbeszigetelve (függőleges metszet).',
    parameterek: [...falParam(),
      { kulcs: 'dF', nev: 'Tetőfödém vastagsága', egyseg: 'm', alap: 0.20, min: 0.1, max: 0.4, lepes: 0.01, csoport: 'Tető' },
      { kulcs: 'lamF', nev: 'Tetőfödém λ (vasbeton)', egyseg: 'W/mK', alap: 2.3, min: 0.1, max: 2.6, lepes: 0.05, csoport: 'Tető' },
      { kulcs: 'dR', nev: 'Tető hőszigetelése', egyseg: 'm', alap: 0.25, min: 0, max: 0.6, lepes: 0.01, csoport: 'Tető' },
      { kulcs: 'lamR', nev: 'Tető hőszigetelés λ', egyseg: 'W/mK', alap: 0.036, min: 0.015, max: 0.2, lepes: 0.001, csoport: 'Tető' },
      { kulcs: 'hAt', nev: 'Attika magassága a födém fölött', egyseg: 'm', alap: 0.6, min: 0, max: 1.5, lepes: 0.01, csoport: 'Attika' },
      { kulcs: 'lamAt', nev: 'Attikafal λ', egyseg: 'W/mK', alap: 2.3, min: 0.05, max: 2.6, lepes: 0.05, csoport: 'Attika' },
      { kulcs: 'dAt', nev: 'Attika belső oldali hőszigetelése', egyseg: 'm', alap: 0.08, min: 0, max: 0.3, lepes: 0.01, csoport: 'Attika' },
      { kulcs: 'dTop', nev: 'Attika tetején a hőszigetelés', egyseg: 'm', alap: 0.05, min: 0, max: 0.2, lepes: 0.01, csoport: 'Attika' },
      karimaParam(1.2)],
    epit: (p) => {
      const t = p.di! + p.dw! + p.dv!, H = Math.max(p.L!, 0.8), Lx = Math.max(p.L!, t + p.dAt! + 0.6), m = 0.05;
      const yT = -p.dF!, yAt = yT - Math.max(p.hAt!, p.dR!), yTop = yAt - p.dTop!;
      const xa = p.di! + p.dw!;
      const el: Teglalap[] = [
        { x0: -m, y0: yTop - m, x1: Lx, y1: H, anyag: 'kulso' },
        { x0: t, y0: 0, x1: Lx, y1: H, anyag: 'belso' },
        { x0: 0, y0: yTop, x1: xa + (p.hAt! > p.dR! ? p.dAt! : 0), y1: yAt, anyag: 'szig' },
        { x0: 0, y0: yAt, x1: p.di!, y1: H, anyag: 'szig' },
        { x0: p.di!, y0: 0, x1: xa, y1: H, anyag: 'fal' },
        { x0: p.di!, y0: yAt, x1: xa, y1: 0, anyag: 'attika' },
        { x0: xa, y0: 0, x1: t, y1: H, anyag: 'vak' },
        { x0: xa, y0: yT, x1: Lx, y1: 0, anyag: 'fodem' },
        ...(p.dR! > 0 ? [{ x0: xa, y0: yT - p.dR!, x1: Lx, y1: yT, anyag: 'tszig' }] : []),
        ...(p.dAt! > 0 && p.hAt! > p.dR! ? [{ x0: xa, y0: yAt, x1: xa + p.dAt!, y1: yT - p.dR!, anyag: 'tszig' }] : []),
      ];
      const Uw = falU(p), Ur = U1D([[p.dF!, p.lamF!], [p.dR!, p.lamR!]]);
      return { geometria: { x0: -m, y0: yTop - m, x1: Lx, y1: H, elemek: el, anyagok: { ...anyagokFal(p), attika: A('Attika / koszorú', p.lamAt!, SZ.vb), fodem: A('Tetőfödém', p.lamF!, SZ.fodem), tszig: A('Tető hőszigetelés', p.lamR!, SZ.szig) } },
        karimak: [{ nev: 'Külső fal', U: Uw, lKulso: H + p.dF! + p.dR!, lBelso: H }, { nev: 'Lapostető', U: Ur, lKulso: Lx, lBelso: Lx - t }], meretek: [] };
    },
  },
);

export const sablon = (kod: string) => HOHID_SABLONOK.find((s) => s.kod === kod);
export const alapParameterek = (s: HohidSablon) => Object.fromEntries(s.parameterek.map((p) => [p.kulcs, p.alap]));
