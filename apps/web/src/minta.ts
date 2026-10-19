/**
 * Minta projekt a tarjáni WinWatt-tesztépület szerkezeteivel (validacio-tarjan.test.ts).
 * A helyiséglista szemléltető (a jegyzőkönyv csak az összesített 100,5 m²-t és 267,3 m³-t közli);
 * négy ablak tájolása a jegyzőkönyvből nem ismert, ezért itt feltételezett (D). A helyiségenkénti külső falhosszak
 * szintén szemléltetők: összegük a padló kerületével (37,7 m), nettó felületük a 72 m²-es homlokzattal egyezik.
 */
import { futesSzettbol, hmvSzettbol, type Projekt } from './modell';

export function mintaProjekt(): Projekt {
  const h = 2.66;
  return {
    verzio: 2,
    meta: {
      nev: 'Kétlakásos lakóépület – 1. lakás (minta)', megrendelo: 'Minta Kft.', irsz: '', telepules: 'Tarján', kozterulet: '', kozteruletJelleg: 'utca', hazszam: '',
      hrsz: '', epitesiEv: 2026, kategoria: 'csaladi_haz', kovetelmenySzint: 'kozel_nulla', szintek: 1,
    },
    zona: { legzaras: 'jo', elhelyezes: 'egy_homlokzat', szelnekKitett: false, hotarolo: 'kozepes', cmEffFajl: 187, futesProgramozhato: false },
    helyisegek: [
      { id: 'h1', nev: 'Nappali – konyha – étkező', kategoria: 'kondicionalt', A: 38.2, h, hsz: { kulsoFalak: [{ id: 'kfh1', retegrendId: 'r_fal', hossz: 13.5 }], padlas: true, padlo: true, szomszedok: [] } },
      { id: 'h2', nev: 'Hálószoba', kategoria: 'kondicionalt', A: 14.6, h, hsz: { kulsoFalak: [{ id: 'kfh2', retegrendId: 'r_fal', hossz: 5.8 }], padlas: true, padlo: true, szomszedok: [] } },
      { id: 'h3', nev: 'Szoba', kategoria: 'kondicionalt', A: 11.8, h, hsz: { kulsoFalak: [{ id: 'kfh3', retegrendId: 'r_fal', hossz: 5.0 }], padlas: true, padlo: true, szomszedok: [] } },
      { id: 'h4', nev: 'Gyerekszoba', kategoria: 'kondicionalt', A: 11.2, h, hsz: { kulsoFalak: [{ id: 'kfh4', retegrendId: 'r_fal', hossz: 4.9 }], padlas: true, padlo: true, szomszedok: [] } },
      { id: 'h5', nev: 'Fürdőszoba', kategoria: 'kondicionalt', A: 6.4, h, hsz: { kulsoFalak: [{ id: 'kfh5', retegrendId: 'r_fal', hossz: 2.6 }], padlas: true, padlo: true, szomszedok: [] } },
      { id: 'h6', nev: 'WC', kategoria: 'erosen_kapcsolt', A: 1.9, h, hsz: { kulsoFalak: [{ id: 'kfh6', retegrendId: 'r_fal', hossz: 1.3 }], padlas: true, padlo: true, szomszedok: [] } },
      { id: 'h7', nev: 'Közlekedő', kategoria: 'erosen_kapcsolt', A: 9.8, h, hsz: { kulsoFalak: [], padlas: true, padlo: true, szomszedok: [] } },
      { id: 'h8', nev: 'Kamra', kategoria: 'erosen_kapcsolt', A: 2.1, h, hsz: { kulsoFalak: [{ id: 'kfh8', retegrendId: 'r_fal', hossz: 1.8 }], padlas: true, padlo: true, szomszedok: [] } },
      { id: 'h9', nev: 'Előtér', kategoria: 'erosen_kapcsolt', A: 4.5, h, hsz: { kulsoFalak: [{ id: 'kfh9', retegrendId: 'r_fal', hossz: 2.8 }], padlas: true, padlo: true, szomszedok: [] } },
    ],
    retegrendek: [
      {
        id: 'r_fal', nev: 'F01 Homlokzati fal – vázkerámia 30 + EPS 15', szerep: 'fal', kovetelmenyKod: 'homlokzati_fal', hoaramIrany: 'vizszintes', kulsoOldal: 'kulso',
        retegek: [
          { id: 'a', anyagId: 'vakolat_mc', dCm: 1.5 },
          { id: 'b', anyagId: 'vazkeramia_30', dCm: 30 },
          { id: 'c', anyagId: 'eps_homlokzat', dCm: 15 },
          { id: 'd', anyagId: 'ragaszto', dCm: 0.3 },
          { id: 'e', anyagId: 'vekonyvakolat', dCm: 0.5 },
        ],
      },
      {
        id: 'r_padlas', nev: 'P03 Padlásfödém – könnyűszerkezetes, 2 × 15 cm ásványgyapot', szerep: 'padlas', kovetelmenyKod: 'padlasfodem', hoaramIrany: 'felfele', kulsoOldal: 'futetlen',
        rseFelulbiralas: 0.08, kezidU: 0.0134987,
        retegek: [
          { id: 'a', anyagId: 'gipszkarton', dCm: 1.5 },
          { id: 'b', anyagId: 'parazaro', dCm: 0.1 },
          { id: 'c', anyagId: 'asvanygyapot', dCm: 15 },
          { id: 'd', anyagId: 'asvanygyapot', dCm: 15 },
        ],
      },
      {
        id: 'r_padlo', nev: 'P01 Talajon fekvő padló – EPS 15', szerep: 'padlo', kovetelmenyKod: 'talajon_fekvo_padlo', hoaramIrany: 'lefele', kulsoOldal: 'kulso',
        retegek: [
          { id: 'a', anyagId: 'padloburkolat', dCm: 1 },
          { id: 'b', anyagId: 'aljzatbeton', dCm: 7.5 },
          { id: 'c', anyagId: 'eps100', dCm: 15 },
          { id: 'd', anyagId: 'bitumen', dCm: 0.3 },
          { id: 'e', anyagId: 'vasbeton', dCm: 12 },
        ],
      },
    ],
    nyilaszarok: [
      { id: 'n150', nev: 'PVC 5–6 kamrás, 3 rtg. argon, 150×150', kovetelmenyKod: 'ablak_fa_pvc', szelesseg: 1.5, magassag: 1.5, komponens: { keretMm: 75, Ug: 0.5, Uk: 1.1, psi: 0.08 }, gn: 0.52, arnyekolo: { kod: 'redony', dR: 0.12, garnyH: 0.1 } },
      { id: 'n077', nev: 'PVC ablak – U 0,77 (nagyméretű)', kovetelmenyKod: 'ablak_fa_pvc', szelesseg: 1.5, magassag: 2.1, uwKezi: 0.77, keretarany: 0.175, gn: 0.52, arnyekolo: { kod: 'redony', dR: 0.12, garnyH: 0.1 } },
      { id: 'n090', nev: 'PVC ablak – U 0,90', kovetelmenyKod: 'ablak_fa_pvc', szelesseg: 1.5, magassag: 1.8, uwKezi: 0.9, keretarany: 0.26, gn: 0.52, arnyekolo: { kod: 'redony', dR: 0.12, garnyH: 0.1 } },
      { id: 'n090k', nev: 'PVC ablak – U 0,90 (kisebb)', kovetelmenyKod: 'ablak_fa_pvc', szelesseg: 1.5, magassag: 0.9, uwKezi: 0.9, keretarany: 0.26, gn: 0.52, arnyekolo: { kod: 'redony', dR: 0.12, garnyH: 0.1 } },
      { id: 'n101', nev: 'PVC ablak – U 1,01 (kisméretű)', kovetelmenyKod: 'ablak_fa_pvc', szelesseg: 0.9, magassag: 1.0, uwKezi: 1.01, keretarany: 0.33, gn: 0.52, arnyekolo: { kod: 'redony', dR: 0.12, garnyH: 0.1 } },
      { id: 'n070', nev: 'PVC erkélyajtó – U 0,70', kovetelmenyKod: 'ablak_fa_pvc', szelesseg: 2.4, magassag: 2.4, uwKezi: 0.7, keretarany: 0.115, gn: 0.52, arnyekolo: { kod: 'redony', dR: 0.12, garnyH: 0.1 } },
      { id: 'n085', nev: 'PVC ablak – U 0,85', kovetelmenyKod: 'ablak_fa_pvc', szelesseg: 1.8, magassag: 2.4, uwKezi: 0.85, keretarany: 0.21, gn: 0.52, arnyekolo: { kod: 'redony', dR: 0.12, garnyH: 0.1 } },
      { id: 'najto', nev: 'Bejárati ajtó, tömör', kovetelmenyKod: 'ajto', szelesseg: 1.0, magassag: 2.4, uwKezi: 1.4, gn: 0 },
    ],
    feluletek: [
      { id: 'f_fal', nev: 'Homlokzati falak', fajta: 'opak', retegrendId: 'r_fal', hatar: 'kulso', A: 72.0, chi: 0.3, chiKod: 2 },
      { id: 'f_a1', nev: 'Nappali ablak', helyisegId: 'h1', fajta: 'nyilaszaro', nyilaszaroId: 'n077', hatar: 'kulso', darab: 1, tajolas: 'DK', hajlasszog: 90 },
      { id: 'f_a2', nev: 'Konyha ablak', helyisegId: 'h1', fajta: 'nyilaszaro', nyilaszaroId: 'n090', hatar: 'kulso', darab: 1, tajolas: 'DK', hajlasszog: 90 },
      { id: 'f_a3', nev: 'Háló ablak', helyisegId: 'h2', fajta: 'nyilaszaro', nyilaszaroId: 'n077', hatar: 'kulso', darab: 1, tajolas: 'D', hajlasszog: 90 },
      { id: 'f_a4', nev: 'Szobaablakok', helyisegId: 'h3', fajta: 'nyilaszaro', nyilaszaroId: 'n150', hatar: 'kulso', darab: 2, tajolas: 'D', hajlasszog: 90 },
      { id: 'f_a5', nev: 'Kamraablak', helyisegId: 'h8', fajta: 'nyilaszaro', nyilaszaroId: 'n090k', hatar: 'kulso', darab: 1, tajolas: 'D', hajlasszog: 90 },
      { id: 'f_a6', nev: 'Fürdő ablak', helyisegId: 'h5', fajta: 'nyilaszaro', nyilaszaroId: 'n101', hatar: 'kulso', darab: 1, tajolas: 'D', hajlasszog: 90 },
      { id: 'f_a7', nev: 'Teraszajtó', helyisegId: 'h1', fajta: 'nyilaszaro', nyilaszaroId: 'n070', hatar: 'kulso', darab: 1, tajolas: 'ÉNy', hajlasszog: 90 },
      { id: 'f_a8', nev: 'Gyerekszoba ablak', helyisegId: 'h4', fajta: 'nyilaszaro', nyilaszaroId: 'n085', hatar: 'kulso', darab: 1, tajolas: 'ÉNy', hajlasszog: 90 },
      { id: 'f_ajto', nev: 'Bejárati ajtó', helyisegId: 'h9', fajta: 'nyilaszaro', nyilaszaroId: 'najto', hatar: 'kulso', darab: 1, tajolas: 'É', hajlasszog: 90 },
      { id: 'f_padlas', nev: 'Padlásfödém', fajta: 'opak', retegrendId: 'r_padlas', hatar: 'padlas', A: 100.5, chi: 0.1, chiKod: 6 },
      { id: 'f_padlo', nev: 'Talajon fekvő padló', fajta: 'padlo', retegrendId: 'r_padlo', hatar: 'kulso', A: 100.5, padlo: { P: 37.7, dfCm: 47.3, z: 0, perem: { irany: 'fuggoleges', D: 0.5, dCm: 20, R: 5.56 }, psiPF: 0.1 } },
    ],
    gepeszet: {
      // A tarjáni WinWatt-tanúsítvány beállításai: ErP hőszivattyú ηs = 160%, padlófűtés, épületfelügyeleti rendszerbe integrált helyiségszabályozás.
      futes: [{
        id: 'f1', nev: 'Levegő-víz hőszivattyú, padlófűtés', szettKod: 'hsz_levego_viz_padlo',
        hotermelo: { tipus: 'hoszivattyu_erp', etaS: 1.6 },
        szabalyozas: { valasztas: { alap: 'ref_helyiseg_pi', holeado: { tipus: 'beagyazott', rendszer: 'padlo_nedves', hatarolo: 'min_szig' }, helyiseg: 'halozatba_integralt', beszabalyozas: { csovek: 'ketcsoves', mod: 'statikus_csoportos_dinamikus', holeadokTobbMint10: false } } },
        elosztas: { hely: 'belul', elore: 35, vissza: 28 }, tarolo: null, szivattyu: 'fordulatszam_beagyazott_7K',
      }],
      hmv: {
        szettKod: 'hsz_levego_viz_padlo',
        hotermelo: { tipus: 'erp_elektromos', etaWH: 1.6, hoszivattyu: true },
        tarolo: { tipus: 'indirekt', hely: 'belul' }, elosztas: { cirkulacio: false, hely: 'belul' }, cirkSzivattyu: null,
      },
      szellozes: null,
      napelem: [],
    },
    tanusito: { nev: '', jogosultsag: '', email: '', telefon: '' },
  };
}

export function uresProjekt(): Projekt {
  return {
    ...mintaProjekt(),
    meta: { nev: 'Új projekt', megrendelo: '', irsz: '', telepules: '', kozterulet: '', kozteruletJelleg: 'utca', hazszam: '', hrsz: '', epitesiEv: new Date().getFullYear(), kategoria: 'csaladi_haz', kovetelmenySzint: 'kozel_nulla', szintek: 1 },
    zona: { legzaras: 'jo', elhelyezes: 'tobb_homlokzat', szelnekKitett: false, hotarolo: 'kozepes', futesProgramozhato: false },
    helyisegek: [], retegrendek: [], feluletek: [], nyilaszarok: [],
    gepeszet: { futes: [futesSzettbol('gaz_kondenz_radiator')], hmv: hmvSzettbol('gaz_kondenz_radiator'), szellozes: null, napelem: [] },
  };
}
