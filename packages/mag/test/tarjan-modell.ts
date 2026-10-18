/** Tarjáni WinWatt-tesztépület modellje (lásd validacio-tarjan.test.ts fejléc). */
import {
  retegrendU, talajonFekvoPadlo, teglalapAblak, nyilaszaroArnyekoloval, szabalyozasiTenyezo,
  type ZonaBemenet, type EpuletBemenet, type NyilaszaroElem,
} from '../src/index.js';

export const WW_QS = [312.0, 414.1, 429.5, 773.8, 977.1, 894.4, 844.9, 919.9, 700.4, 627.9, 403.2, 217.2];
export const WW_QFNET = [840.0, 788.9, 640.0, 77.2, 0, 0, 0, 0, 0, 225.3, 363.6, 1092.2];
export const WW_QVESZT = [1507.2, 1513.9, 1399.7, 804.6, 378.4, 68.9, -13.3, 63.5, 299.3, 1031.1, 1049.8, 1676.1];

export const fal = retegrendU({
  hoaramIrany: 'vizszintes', kulsoOldal: 'kulso',
  retegek: [
    { tipus: 'homogen', nev: 'vakolat', d: 0.015, lambda: 0.81 },
    { tipus: 'ellenallas', nev: 'vázkerámia 30', d: 0.3, R: 1.5228 },
    { tipus: 'homogen', nev: 'EPS hőszigetelés', d: 0.15, lambda: 0.038 },
    { tipus: 'homogen', nev: 'ragasztótapasz', d: 0.003, lambda: 0.84 },
    { tipus: 'homogen', nev: 'külső vakolat', d: 0.005, lambda: 0.76 },
  ],
});

// A WinWatt a padlásfödémnél Rse = 0,08-at és egy „eltérő rétegrend” korrekciót (ΔU = 0,0134987) használt.
export const padlas = retegrendU({
  hoaramIrany: 'felfele', kulsoOldal: 'futetlen', Rse: 0.08,
  retegek: [
    { tipus: 'homogen', nev: 'gipszkarton', d: 0.015, lambda: 0.24 },
    { tipus: 'homogen', nev: 'párazáró fólia', d: 0.001, lambda: 0.17 },
    { tipus: 'homogen', nev: 'szálas hőszigetelés', d: 0.15, lambda: 0.038 },
    { tipus: 'homogen', nev: 'szálas hőszigetelés', d: 0.15, lambda: 0.038 },
  ],
  korrekcio: { kezi: 0.0134987 },
});

const padloRp = 0.01 / 1.05 + 0.075 / 1.4 + 0.15 / 0.037 + 0.025 + 0.12 / 1.55;
export const padlo = talajonFekvoPadlo({
  A: 100.5, P: 37.7, df: 0.473, Rp: padloRp, z: 0,
  peremSzigetelesek: [{ irany: 'fuggoleges', D: 0.5, dpsz: 0.2, Rpsz: 5.56 }],
});

export const ablakTipus = teglalapAblak({ szelesseg: 1.5, magassag: 1.5, keretSzelesseg: 0.075, Uü: 0.5, Uk: 1.1, psiKü: 0.08 });

function ablak(nev: string, A: number, U: number, Au: number, tajolas: NyilaszaroElem['tajolas']): NyilaszaroElem {
  return { tipus: 'nyilaszaro', nev, A, U, UFutes: nyilaszaroArnyekoloval(U, 0.12), hatar: { tipus: 'kulso' }, tajolas, hajlasszog: 90, Au, gn: 0.52, garnyH: 0.1, kovetelmenyKod: 'ablak_fa_pvc' };
}

export const zona: ZonaBemenet = {
  nev: 'F1', AN: 100.5, V: 267.33, thetaF: 20, thetaH: 26, nSzuks: 0.5, nfilt: 0.03, qb: 5, CmEff: 18790,
  elemek: [
    { tipus: 'opak', nev: 'F01 Homlokzati fal', A: 72.0, U: fal.U, chi: 0.3, hatar: { tipus: 'kulso' }, kovetelmenyKod: 'homlokzati_fal' },
    ablak('Ablak 1', 2.364 / 0.75046, 0.77, 2.6, 'DK'),
    ablak('Ablak 2', 2.3589 / 0.87368, 0.9, 2.0, 'DK'),
    ablak('Ablak 3', 2.364 / 0.75046, 0.77, 2.6, 'D'),
    ablak('Ablak 4', 3.5481 / 0.78847, 0.81, 3.6, 'D'),
    ablak('Ablak 5', 1.1795 / 0.87368, 0.9, 1.0, 'D'),
    ablak('Ablak 6', 0.87952 / 0.97725, 1.01, 0.6, 'D'),
    ablak('Ablak 7', 3.9383 / 0.68373, 0.7, 5.1, 'ÉNy'),
    ablak('Ablak 8', 3.57 / 0.8264, 0.85, 3.4, 'ÉNy'),
    { tipus: 'nyilaszaro', nev: 'Bejárati ajtó', A: 2.4, U: 1.4, hatar: { tipus: 'kulso' }, tajolas: 'É', hajlasszog: 90, Au: 0, gn: 0, kovetelmenyKod: 'ajto' },
    { tipus: 'opak', nev: 'P03 Padlásfödém', A: 100.5, U: padlas.U, chi: 0.1, hatar: { tipus: 'futetlen', b: 'padlas' }, kovetelmenyKod: 'padlasfodem' },
    { tipus: 'talaj', nev: 'P01 Padló', A: 100.5, UT: padlo.UTp, P: 37.7, psiPF: 0.1, kovetelmenyKod: 'talajon_fekvo_padlo' },
  ],
};


export const szab = szabalyozasiTenyezo({
  alap: 'ref_helyiseg_pi',
  holeado: { tipus: 'beagyazott', rendszer: 'padlo_nedves', hatarolo: 'min_szig' },
  helyiseg: 'halozatba_integralt',
  beszabalyozas: { csovek: 'ketcsoves', mod: 'statikus_csoportos_dinamikus', holeadokTobbMint10: false },
});
export const epulet: EpuletBemenet = {
  nev: 'Tarján 1. lakás', rendeltetes: 'lakoepulet', AN: 100.5, V: 267.33, Alehulo: 1.127 * 267.33, kovetelmenySzint: 'kozel_nulla',
  zonak: [zona],
  futes: [{
    nev: 'Levegő-víz hőszivattyú, padlófűtés', zona: 'F1', Arszr: 100.5,
    hotermelo: { tipus: 'hoszivattyu_erp', etaS: 1.6 },
    epszilonSzab: szab.epszilon,
    elosztas: { hely: 'belul', elore: 35, vissza: 28 },
    tarolo: null,
    szivattyu: 'fordulatszam_beagyazott_7K',
  }],
  hmv: [{
    nev: 'Levegő-víz hőszivattyú, indirekt tároló', Arszr: 100.5, qHMV: 25, AN: 100.5,
    hotermelo: { tipus: 'erp_elektromos', etaWH: 1.6, hoszivattyu: true },
    tarolo: { tipus: 'indirekt', hely: 'belul' },
    elosztas: { cirkulacio: false, hely: 'belul' },
    cirkSzivattyu: null,
  }],
  // A WinWatt referencia-beállításai (jegyzőkönyv 10. oldal).
  referencia: { hotermeloHely: 'kivul', futesElosztasHely: 'kivul', hmvElosztasHely: 'kivul', holeadokTobbMint10: false },
};

