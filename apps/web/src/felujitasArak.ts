/**
 * Felújítás-elemző alapértékei. Energiaárak: 2026. októberi állapot (MEKH/MVM közlések sajtóforrásokon át, FŐTÁV
 * díjtábla); egységárak: 2025–2026-os portál- és kivitelezői árak (Daibau, JóSzaki, qjob, Tudjukki stb.), nettóra
 * átszámítva. A TERC/ÉKSZ költségbecslők nem nyilvánosak. A „becslés” jelölésű tételeket ajánlat alapján pontosítani kell.
 */
import type { EnergiaArak, Penzugy } from './felujitas';

export const ARAK_DATUM = '2026. október (energiaárak); egységárak 2025–2026, részben becslés';

export const ALAP_ARAK: EnergiaArak = {
  // Földgáz: 2,865 Ft/MJ bruttó a 63 645 MJ/év keretig, felette 22,002 Ft/MJ; égéshőre (MJ) számlázva.
  gazSav: 2.865 * 3.6, gazSavHatar: Math.round(63645 / 3.6), gazFelett: 22.002 * 3.6,
  gazAlapdij: Math.round(9192 * 1.27),
  // Villamos energia A1: ~36 Ft/kWh 2523 kWh/év-ig, felette 70,104 Ft/kWh; H tarifa ~23,1 Ft/kWh (okt. 15.–ápr. 15.).
  villSav: 36, villSavHatar: 2523, villFelett: 70.104, villH: 23.1, hTarifa: true,
  // Távhő (FŐTÁV 2026): hődíj 1817 Ft/GJ = 6,54 Ft/kWh; alapdíj 378,38 Ft/légm³/év.
  tavho: 1817 / 277.78, tavhoAlapdij: 378.38,
  // Tűzifa 8000 Ft/q, 14,5 MJ/kg → 19,9 Ft/kWh; pellet 165 Ft/kg, 17 MJ/kg → 34,9 Ft/kWh.
  tuzifa: 8000 / (100 * 14.5 / 3.6), pellet: 165 / (17 / 3.6),
  // Fűtőolaj és szén: friss forrás nélkül, becslés.
  olaj: 60, szen: 16,
  // Napelem, új belépő: bruttó elszámolás, betáplálás ~5 Ft/kWh; önfogyasztási arány (tároló nélkül) becslés.
  pvExport: 5, pvOnfogyasztas: 0.35,
  forras: [
    'Földgáz: rezsicsökkentett ár 2,865 Ft/MJ (≈102 Ft/m³), keret 63 645 MJ/év, felette 22,002 Ft/MJ (≈747 Ft/m³), bruttó; MEKH/MVM díjak sajtóközlései 2026. Alapdíj: 2014-es MVM díjtáblából, bizonytalan.',
    'Villamos energia: A1 ~36 Ft/kWh 2523 kWh/év-ig, felette 70,104 Ft/kWh; H tarifa ~23,1 Ft/kWh; bruttó, 2026.',
    'Távhő: FŐTÁV 2026-os lakossági díjtábla (hődíj 1817 Ft/GJ, alapdíj 378,38 Ft/légm³/év).',
    'Tűzifa: KSH-átlag ~8000 Ft/q (5% ÁFA 2026. szept. 15-től); pellet ~165 Ft/kg. Fűtőolaj, szén: becslés.',
    'Napelem: új HMKE bruttó elszámolás, betáplálás 4,39–5,25 Ft/kWh; szaldó csak 2023. szept. 7. előtti bejelentkezésnél, 10 évig.',
  ].join('\n'),
};

export const ALAP_PENZUGY: Penzugy = { kamat: 4, energiaArNovekedes: 3, idoszak: 30, afa: 27 };

const n = (brutto: number) => Math.round(brutto / 1.27);
/** Nettó egységárak; a hőszigetelésnél alapköltség [Ft/m²] + vastagságarányos rész [Ft/m²/cm]. */
export const EGYSEGAR: Record<string, { ertek: number; nev: string }> = {
  fal_alap: { ertek: 18000, nev: 'Homlokzati hőszigetelő rendszer alapköltsége (ragasztó, háló, vakolat, munka, állvány) – grafitos EPS 15/20 cm árából' },
  fal_cm: { ertek: 500, nev: 'Homlokzati hőszigetelés vastagságarányos ára' },
  padlas_alap: { ertek: 0, nev: 'Padlásfödém befújt cellulóz – alapköltség' },
  padlas_cm: { ertek: 210, nev: 'Padlásfödém befújt cellulóz (20 cm 4000, 25 cm 5250 Ft/m²)' },
  teto_alap: { ertek: 400, nev: 'Tetőtér ásványgyapot – alapköltség (becslés)' },
  teto_cm: { ertek: 236, nev: 'Tetőtér ásványgyapot vastagságarányos ára (padlásterítés árából, becslés)' },
  pincefodem_alap: { ertek: 4000, nev: 'Pincefödém alsó hőszigetelés alapköltsége (10–12 cm ≈ 10 000 Ft/m² bruttó)' },
  pincefodem_cm: { ertek: 350, nev: 'Pincefödém hőszigetelés vastagságarányos ára' },
  padlo_alap: { ertek: 27500, nev: 'Padló utólagos hőszigetelése bontással, új aljzattal – alapköltség (becslés)' },
  padlo_cm: { ertek: 500, nev: 'Padló hőszigetelés vastagságarányos ára (becslés)' },
  ablak_2r: { ertek: n(110000), nev: 'Műanyag ablak 2 rétegű üvegezéssel, beépítve (becslés)' },
  ablak_3r: { ertek: n(130000), nev: 'Műanyag ablak 3 rétegű üvegezéssel, beépítve (becslés)' },
  ablak_passziv: { ertek: n(180000), nev: 'Passzívház-minőségű ablak, beépítve (becslés)' },
  kondenz_kazan: { ertek: n(1250000), nev: 'Kondenzációs gázkazán 24 kW, cserecsomag (kéménybélelés nélkül)' },
  hoszivattyu: { ertek: n(3500000), nev: 'Levegő-víz hőszivattyú 8–10 kW, beépítve (becslés)' },
  pellet_kazan: { ertek: n(2500000), nev: 'Automata pelletkazán 20–25 kW, beépítve (becslés)' },
  hrv: { ertek: n(2600000), nev: 'Központi hővisszanyerős szellőztető légcsatornákkal (becslés)' },
  napkollektor: { ertek: 1550000, nev: 'Napkollektoros HMV-rendszer (2–3 kollektor, 200–300 l tároló)' },
  hmv_tarolo: { ertek: 450000, nev: 'Indirekt HMV-tároló cseréje (becslés, forrás nélkül)' },
  napelem_kwp: { ertek: 330000, nev: 'Napelemes rendszer 5–10 kWp, kulcsrakész' },
  legzaras: { ertek: 400000, nev: 'Légtömörség javítása (becslés, forrás nélkül)' },
};

export const EGYSEGAR_FORRAS = 'Egységárak: 2025–2026-os hazai portálok (Daibau, JóSzaki, qjob, Tudjukki) és kivitelezői árlisták; homlokzati munkadíj nettó 13 900 Ft/m² (EPS), állvány ~2200 Ft/m². A bruttó forrásárakat 27% ÁFA-val nettósítottuk. Támogatás: az Otthonfelújítási Program (KEHOP, 50% vissza nem térítendő + 50% kamatmentes hitel, max. 10 M Ft; 2007 előtt épült ház, ≥30% primerenergia-megtakarítás) 2026 áprilisa óta szünetel; a Vidéki Otthonfelújítási Program 2026. június 30-án megszűnt.';
