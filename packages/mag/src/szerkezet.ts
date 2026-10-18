/**
 * Határoló szerkezetek – 9/2023 ÉKM számítási módszer, 1. függelék 4. fejezet (egyszerűsített módszer).
 */
import { RSI, RSE, ZART_LEGRETEG, LEGUREG_KORREKCIO, TALAJ, type HoaramIrany } from './tablak/epuletfizika.js';
import { linearis, type Figyelmeztetes } from './interpolacio.js';

// ---------------------------------------------------------------------------------------------
// 4.1 Rétegrend

export type Reteg =
  | { tipus: 'homogen'; nev: string; d: number; lambda: number; anyagId?: string }
  /** Ismert hővezetési ellenállású réteg (pl. üreges blokk gyártói R-rel). */
  | { tipus: 'ellenallas'; nev: string; d: number; R: number; anyagId?: string }
  /** 4.1.3 – légréteg; zárt: 4.2. táblázat, kismértékben szellőztetett: 4.4 képlet, intenzíven: a réteg és a kívüli rétegek elhanyagolva. */
  | { tipus: 'legreteg'; nev: string; d: number; szellozes: 'zart' | 'kismertekben' | 'intenziv'; Aszell?: number }
  /** 4.1.4 – inhomogén réteg: szeletek területaránnyal (pl. szarufa + hőszigetelés). */
  | { tipus: 'inhomogen'; nev: string; d: number; szeletek: { nev: string; lambda: number; arany: number }[] };

export interface RetegrendBemenet {
  /** Rétegek belülről kifelé. */
  retegek: Reteg[];
  hoaramIrany: HoaramIrany;
  /** Külső oldal: 'kulso' → Rse; 'futetlen' vagy 'belso' → mindkét oldalon Rsi (4.1. pont). */
  kulsoOldal: 'kulso' | 'futetlen' | 'belso';
  /** Felületi ellenállások felülbírálása (pl. MSZ EN ISO 6946 speciális peremfeltétel). */
  Rsi?: number;
  Rse?: number;
  korrekcio?: {
    /** 4.12 képlet: légüreg szint (0: nincs, 1: általános, 2: szabad légáramlás) és a légüreget tartalmazó réteg indexe. */
    legureg?: { szint: 0 | 1 | 2; retegIndex: number };
    /** 4.13 képlet: mechanikus rögzítőelemek. */
    rogzites?: { retegIndex: number; lambda: number; Akereszt: number; db_m2: number; d1: number; sullyesztett?: boolean };
    /** Kézi ΔU (pl. fordított tető F melléklet szerint, vagy más program által megadott „rétegtervi módosító érték”). */
    kezi?: number;
  };
}

export interface RetegrendEredmeny {
  Rsi: number;
  Rse: number;
  Rtot: number;
  U0: number;
  dU: number;
  /** Rétegtervi (korrigált) hőátbocsátási tényező, csatlakozási hőhidak nélkül – az elemi követelmény alapja. */
  U: number;
  retegR: number[];
  figyelmeztetesek: Figyelmeztetes[];
}

function legretegR(d: number, irany: HoaramIrany): number {
  return linearis(ZART_LEGRETEG.vastagsagMm, ZART_LEGRETEG[irany], d * 1000);
}

export function retegrendU(b: RetegrendBemenet): RetegrendEredmeny {
  // 4.4 képlet: kismértékben szellőztetett légréteg – a zárt és az intenzíven szellőztetett változat eredő
  // ellenállásának súlyozása: Rtot = (1500−A)/1000·Rtot,zárt + (A−500)/1000·Rtot,szell.
  const kisIdx = b.retegek.findIndex((r) => r.tipus === 'legreteg' && r.szellozes === 'kismertekben');
  if (kisIdx >= 0) {
    const r = b.retegek[kisIdx] as Extract<Reteg, { tipus: 'legreteg' }>;
    const A = Math.min(Math.max(r.Aszell ?? 1000, 500), 1500);
    const csere = (sz: 'zart' | 'intenziv') => b.retegek.map((x, i) => (i === kisIdx ? { ...r, szellozes: sz } : x));
    const zart = retegrendU({ ...b, retegek: csere('zart'), korrekcio: undefined });
    const szell = retegrendU({ ...b, retegek: csere('intenziv'), korrekcio: undefined });
    const Rtot = ((1500 - A) / 1000) * zart.Rtot + ((A - 500) / 1000) * szell.Rtot;
    const U0 = 1 / Rtot;
    const dU = b.korrekcio?.kezi ?? 0;
    return { ...zart, Rtot, U0, dU, U: U0 + dU, figyelmeztetesek: [...zart.figyelmeztetesek, { kod: 'KISMERTEKBEN_SZELLOZTETETT', uzenet: `Kismértékben szellőztetett légréteg (Aszell = ${A} mm²): 4.4 képlet szerinti súlyozás.`, forras: '1. függ. 4.1.3' }] };
  }
  const fw: Figyelmeztetes[] = [];
  const Rsi = b.Rsi ?? RSI[b.hoaramIrany];
  const Rse = b.Rse ?? (b.kulsoOldal === 'kulso' ? RSE : RSI[b.hoaramIrany]);

  // Intenzíven szellőztetett légrétegtől kifelé minden réteg elhanyagolandó (4.1.3), a külső hőátadás Rsi-vel vehető.
  const intenzivIdx = b.retegek.findIndex((r) => r.tipus === 'legreteg' && r.szellozes === 'intenziv');
  const szamitott = intenzivIdx >= 0 ? b.retegek.slice(0, intenzivIdx) : b.retegek;
  const RseHasznalt = intenzivIdx >= 0 ? (b.Rse ?? RSI[b.hoaramIrany]) : Rse;

  const retegR: number[] = [];
  let vanInhomogen = false;
  for (const r of szamitott) {
    switch (r.tipus) {
      case 'homogen':
        if (r.lambda <= 0) throw new Error(`Érvénytelen λ a „${r.nev}” rétegben`);
        retegR.push(r.d / r.lambda);
        break;
      case 'ellenallas':
        retegR.push(r.R);
        break;
      case 'legreteg': {
        if (r.d > 0.3) fw.push({ kod: 'VASTAG_LEGRETEG', uzenet: `A „${r.nev}” légréteg 0,3 m-nél vastagabb; az U-értékben nem vehető figyelembe, hőmérleggel kell számolni.`, forras: '1. függ. 4.1.3' });
        const zart = legretegR(Math.min(r.d, 0.3), b.hoaramIrany);
        if (r.szellozes === 'zart') retegR.push(zart);
        else throw new Error('belső: kismértékben szellőztetett réteg előfeldolgozás nélkül');
        break;
      }
      case 'inhomogen':
        vanInhomogen = true;
        retegR.push(NaN); // lent kezeljük
        break;
    }
  }

  let Rtot: number;
  if (!vanInhomogen) {
    Rtot = Rsi + retegR.reduce((a, x) => a + x, 0) + RseHasznalt;
  } else {
    // 4.1.4 – felső és alsó határ számtani közepe (4.5–4.9).
    const inh = szamitott.map((r, i) => ({ r, i })).filter((x) => x.r.tipus === 'inhomogen') as { r: Extract<Reteg, { tipus: 'inhomogen' }>; i: number }[];
    if (inh.length > 1) {
      // Több inhomogén réteg esetén a szeletek kombinációját egyetlen szeletosztásra vezetjük vissza: feltétel az azonos arányok.
      const arany0 = inh[0]!.r.szeletek.map((s) => s.arany).join(',');
      if (!inh.every((x) => x.r.szeletek.map((s) => s.arany).join(',') === arany0)) {
        throw new Error('Több eltérő szeletosztású inhomogén réteg: részletes (numerikus) módszer szükséges.');
      }
    }
    const homogenOsszeg = retegR.filter((x) => !Number.isNaN(x)).reduce((a, x) => a + x, 0);
    const szeletSzam = inh[0]!.r.szeletek.length;
    // Felső határ (4.6): szeletenként soros ellenállás, majd párhuzamos kapcsolás.
    let invFelso = 0;
    for (let s = 0; s < szeletSzam; s++) {
      const arany = inh[0]!.r.szeletek[s]!.arany;
      const Rszelet = Rsi + homogenOsszeg + RseHasznalt + inh.reduce((a, x) => a + x.r.d / x.r.szeletek[s]!.lambda, 0);
      invFelso += arany / Rszelet;
    }
    const Rfelso = 1 / invFelso;
    // Alsó határ (4.7–4.9): rétegenként egyenértékű λ.
    const Ralso = Rsi + homogenOsszeg + RseHasznalt + inh.reduce((a, x) => a + x.r.d / x.r.szeletek.reduce((l, sz) => l + sz.lambda * sz.arany, 0), 0);
    if (Rfelso / Ralso > 1.5) fw.push({ kod: 'INHOMOGEN_ARANY', uzenet: `Rfelső/Ralsó = ${(Rfelso / Ralso).toFixed(2)} > 1,5: az egyszerűsített módszer nem alkalmazható, részletes számítás szükséges.`, forras: '1. függ. 4.1.4' });
    Rtot = (Rfelso + Ralso) / 2;
    for (const x of inh) retegR[x.i] = x.r.d / x.r.szeletek.reduce((l, sz) => l + sz.lambda * sz.arany, 0);
  }

  const U0 = 1 / Rtot;

  // 4.1.6 korrekciók
  let dU = 0;
  const k = b.korrekcio;
  if (k?.legureg && k.legureg.szint > 0) {
    const R1 = retegR[k.legureg.retegIndex] ?? 0;
    dU += (k.legureg.szint === 2 ? LEGUREG_KORREKCIO.szint2 : LEGUREG_KORREKCIO.szint1) * (R1 / Rtot) ** 2;
  }
  if (k?.rogzites && k.rogzites.lambda >= 1) {
    const r = k.rogzites;
    const reteg = szamitott[r.retegIndex];
    const d0 = reteg?.d ?? r.d1;
    const alfa = r.sullyesztett ? 0.8 * (r.d1 / d0) : 0.8;
    const R1 = r.sullyesztett && reteg?.tipus === 'homogen' ? r.d1 / reteg.lambda : retegR[r.retegIndex] ?? 0;
    dU += alfa * ((r.lambda * r.Akereszt * r.db_m2) / r.d1) * (R1 / Rtot) ** 2;
  }
  if (k?.kezi) dU += k.kezi;
  const dUlegureg = dU - (k?.kezi ?? 0);
  if (dUlegureg > 0 && dUlegureg < 0.03 * U0) {
    fw.push({ kod: 'KORREKCIO_ELHANYAGOLHATO', uzenet: `ΔU = ${dUlegureg.toFixed(4)} < 3% · U0; elhanyagolható lenne (4.1.6), de figyelembe vettük.`, forras: '1. függ. 4.1.6' });
  }

  return { Rsi, Rse: RseHasznalt, Rtot, U0, dU, U: U0 + dU, retegR, figyelmeztetesek: fw };
}

// ---------------------------------------------------------------------------------------------
// 4.3 Nyílászárók

export interface NyilaszaroBemenet {
  Aü: number; Uü: number;
  Ak: number; Uk: number;
  Ap?: number; Up?: number;
  lkü: number; psiKü: number;
  lkp?: number; psiKp?: number;
  lmü?: number; psiMü?: number;
}

/** 4.16 képlet – egyhéjú nyílászáró átlagos U-értéke. */
export function nyilaszaroU(n: NyilaszaroBemenet): number {
  const Ap = n.Ap ?? 0;
  const szamlalo = n.Aü * n.Uü + Ap * (n.Up ?? 0) + n.Ak * n.Uk + n.lkü * n.psiKü + (n.lkp ?? 0) * (n.psiKp ?? 0) + (n.lmü ?? 0) * (n.psiMü ?? 0);
  return szamlalo / (n.Aü + Ap + n.Ak);
}

/** Téglalap alakú, körbefutó keretű ablak geometriája a 4.16 képlethez. */
export function teglalapAblak(p: { szelesseg: number; magassag: number; keretSzelesseg: number; Uü: number; Uk: number; psiKü: number }): NyilaszaroBemenet & { A: number } {
  const A = p.szelesseg * p.magassag;
  const bu = p.szelesseg - 2 * p.keretSzelesseg;
  const hu = p.magassag - 2 * p.keretSzelesseg;
  const Aü = Math.max(bu, 0) * Math.max(hu, 0);
  return { A, Aü, Uü: p.Uü, Ak: A - Aü, Uk: p.Uk, lkü: 2 * (bu + hu), psiKü: p.psiKü };
}

/** 4.17 képlet – kéthéjú (kapcsolt) nyílászáró. */
export function kethejuNyilaszaroU(U1: number, U2: number, Rl: number, Rsi = 0.13, Rse = 0.04): number {
  return 1 / (1 / U1 - Rsi + Rl - Rse + 1 / U2);
}

/** 4.18 képlet – nyílászáró társított árnyékolóval (csak fűtési energiaigényhez, elemi követelményhez nem!). */
export function nyilaszaroArnyekoloval(U: number, dR: number): number {
  return 0.7 * U + 0.3 * (1 / (1 / U + dR));
}

// ---------------------------------------------------------------------------------------------
// 4.4 Talajjal érintkező szerkezetek

export interface TalajonFekvoPadloBemenet {
  A: number;
  /** Kitett kerület (külső környezet és fűtetlen tér felé). */
  P: number;
  /** Csatlakozó külső falak teljes vastagsága [m]. */
  df: number;
  /** A padlószerkezet hővezetési ellenállása (teljes felületű hőszigeteléssel; szemcsés ágyazat nélkül). */
  Rp: number;
  /** Padló mélysége a terepszint alatt [m]; ±0,5 m-en belül 0. */
  z?: number;
  talajTipus?: 1 | 2 | 3;
  Rsi?: number;
  Rse?: number;
  /** 4.4.5 – perem hőszigetelés(ek); a legnagyobb csökkenést adó vehető figyelembe. */
  peremSzigetelesek?: { irany: 'vizszintes' | 'fuggoleges'; D: number; dpsz: number; Rpsz: number; Ppsz?: number }[];
}

export interface TalajEredmeny { B: number; dp: number; UTp0: number; psiPsz: number; UTp: number; }

/** 4.20–4.23, 4.29–4.33 képlet – talajon fekvő padló egyenértékű hőátbocsátási tényezője. */
export function talajonFekvoPadlo(b: TalajonFekvoPadloBemenet): TalajEredmeny {
  const lambda = TALAJ[b.talajTipus ?? 2].lambda;
  const z = Math.abs(b.z ?? 0) <= 0.5 ? 0 : (b.z ?? 0);
  const B = b.A / (0.5 * b.P);
  const dp = b.df + lambda * ((b.Rsi ?? RSI.lefele) + b.Rp + (b.Rse ?? RSE));
  const UTp0 = dp + 0.5 * z < B
    ? ((2 * lambda) / (Math.PI * B + dp + 0.5 * z)) * Math.log((Math.PI * B) / (dp + 0.5 * z) + 1)
    : lambda / (0.457 * B + dp + 0.5 * z);

  let legjobb = { psi: 0, P: 0 };
  if (z === 0) {
    for (const p of b.peremSzigetelesek ?? []) {
      const Rv = p.Rpsz - p.dpsz / lambda; // 4.30
      const dv = Rv * lambda; // 4.29
      const D = p.irany === 'vizszintes' ? p.D : 2 * p.D;
      const psi = -(lambda / Math.PI) * (Math.log(D / dp + 1) - Math.log(D / (dp + dv) + 1)); // 4.31 / 4.32
      const Pp = p.Ppsz ?? b.P;
      if (psi * Pp < legjobb.psi * legjobb.P) legjobb = { psi, P: Pp };
    }
  }
  const UTp = UTp0 + (legjobb.P * legjobb.psi) / b.A; // 4.33
  return { B, dp, UTp0, psiPsz: legjobb.psi, UTp };
}

/** 4.24–4.26 képlet – terepszint feletti padló (A ≤ 250 m², m > 0,5 m). */
export function terepszintFelettiPadlo(p: { A: number; P: number; Up: number; Ulf: number; dlf: number; m: number; talajTipus?: 1 | 2 | 3 }): number {
  const lambda = TALAJ[p.talajTipus ?? 2].lambda;
  const B = p.A / (0.5 * p.P);
  const Utalaj = ((2 * lambda) / (Math.PI * B + p.dlf + p.m)) * Math.log((Math.PI * B) / (p.dlf + p.m) + 1);
  const UTlf = (2 * p.m * p.Ulf) / B;
  return 1 / (1 / p.Up + 1 / (Utalaj + UTlf));
}

/** 4.27–4.28 képlet – fűtött pince talajjal érintkező falának egyenértékű U-értéke. */
export function futottPinceFal(p: { z: number; Rpf: number; dp: number; talajTipus?: 1 | 2 | 3; Rsi?: number; Rse?: number }): number {
  const lambda = TALAJ[p.talajTipus ?? 2].lambda;
  const dpf = lambda * ((p.Rsi ?? RSI.vizszintes) + p.Rpf + (p.Rse ?? RSE));
  const d = dpf < p.dp ? dpf : p.dp;
  return ((2 * lambda) / (Math.PI * p.z)) * (1 + (0.5 * d) / (d + p.z)) * Math.log(p.z / dpf + 1);
}
