/**
 * Beépített anyagkatalógus – a felület offline is ezt használja, és ebből készül az adatbázis seedje
 * (tools/seed-generalas.ts), így a két hely nem csúszhat szét.
 * Csak ellenőrizhető forrású érték kerül ide.
 */

export type Sraffozas = 'falazat' | 'beton' | 'hoszigeteles_hab' | 'hoszigeteles_szalas' | 'vakolat' | 'fa' | 'folia' | 'burkolat' | 'legreteg';

export const SRAFFOZASOK: { kod: Sraffozas; nev: string }[] = [
  { kod: 'falazat', nev: 'Falazat' },
  { kod: 'beton', nev: 'Beton, vasbeton' },
  { kod: 'hoszigeteles_hab', nev: 'Hőszigetelés, hab' },
  { kod: 'hoszigeteles_szalas', nev: 'Hőszigetelés, szálas' },
  { kod: 'vakolat', nev: 'Vakolat, habarcs' },
  { kod: 'fa', nev: 'Fa, faalapú' },
  { kod: 'folia', nev: 'Fólia, lemez' },
  { kod: 'burkolat', nev: 'Burkolat, lap' },
  { kod: 'legreteg', nev: 'Légréteg' },
];

export interface Anyag {
  /** Beépítettnél beszédes kód, irodai anyagnál az adatbázis-sor kódja. */
  id: string;
  nev: string;
  kategoria: string;
  sraffozas: Sraffozas;
  lambda?: number;
  mu?: number;
  /** Ismert hővezetési ellenállású termék (pl. üreges blokk) adott vastagságnál [m²K/W, m]. */
  R?: { R: number; d: number };
  forras: string;
  ellenorzott: boolean;
  megjegyzes?: string;
  /** Irodai könyvtárból származik (nem beépített). */
  irodai?: boolean;
}

const WW = 'WinWatt 9.54 jegyzőkönyv (Tarján, 2026.05.22.) – a tanúsító által alkalmazott érték, termékadattal ellenőrizendő';

export const ALAP_ANYAGOK: Anyag[] = [
  { id: 'vakolat_mc', nev: 'Mészcement vakolat', kategoria: 'Vakolat', sraffozas: 'vakolat', lambda: 0.81, forras: WW, ellenorzott: false },
  { id: 'vazkeramia_30', nev: 'Vázkerámia falazóblokk 30 cm', kategoria: 'Falazat', sraffozas: 'falazat', R: { R: 1.5228, d: 0.3 }, forras: WW, ellenorzott: false, megjegyzes: 'Ekvivalens λ = 0,197 W/mK (WinWatt)' },
  { id: 'eps_homlokzat', nev: 'EPS homlokzati hőszigetelés', kategoria: 'Hőszigetelés', sraffozas: 'hoszigeteles_hab', lambda: 0.038, mu: 40, forras: WW, ellenorzott: false },
  { id: 'ragaszto', nev: 'Ragasztótapasz', kategoria: 'Vakolat', sraffozas: 'vakolat', lambda: 0.84, mu: 15, forras: WW, ellenorzott: false },
  { id: 'vekonyvakolat', nev: 'Külső vékonyvakolat', kategoria: 'Vakolat', sraffozas: 'vakolat', lambda: 0.76, mu: 121, forras: WW, ellenorzott: false },
  { id: 'padloburkolat', nev: 'Padlóburkolat', kategoria: 'Burkolat', sraffozas: 'burkolat', lambda: 1.05, forras: WW, ellenorzott: false },
  { id: 'aljzatbeton', nev: 'Aljzatbeton', kategoria: 'Beton', sraffozas: 'beton', lambda: 1.4, mu: 40, forras: WW, ellenorzott: false },
  { id: 'eps100', nev: 'Austrotherm AT-N100 (EPS 100)', kategoria: 'Hőszigetelés', sraffozas: 'hoszigeteles_hab', lambda: 0.037, mu: 70, forras: WW, ellenorzott: false },
  { id: 'bitumen', nev: 'Bitumenes talajnedvesség elleni szigetelés', kategoria: 'Szigetelés', sraffozas: 'folia', lambda: 0.12, forras: WW, ellenorzott: false },
  { id: 'vasbeton', nev: 'Vasbeton', kategoria: 'Beton', sraffozas: 'beton', lambda: 1.55, forras: WW, ellenorzott: false },
  { id: 'gipszkarton', nev: 'Gipszkarton', kategoria: 'Burkolat', sraffozas: 'burkolat', lambda: 0.24, forras: WW, ellenorzott: false },
  { id: 'parazaro', nev: 'Párazáró fólia', kategoria: 'Fólia', sraffozas: 'folia', lambda: 0.17, forras: WW, ellenorzott: false },
  { id: 'asvanygyapot', nev: 'Szálas hőszigetelés (ásványgyapot)', kategoria: 'Hőszigetelés', sraffozas: 'hoszigeteles_szalas', lambda: 0.038, mu: 1.47, forras: WW, ellenorzott: false },
];


/** Bővített katalógus: szabványos tervezési értékek másodlagos közlésből (BRE BR 443, horvát előírás B melléklet) és gyártói
 * teljesítménynyilatkozatok, adatlapok. A becsült vagy bizonytalanul kiolvasott értékek „ellenőrizendő” jelölést kapnak. */
export const BOVITETT_ANYAGOK: Anyag[] = [
 {
  "id": "tomor_tegla_falazat",
  "nev": "Kisméretű tömör tégla falazat (égetett agyag, ρ=1800)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.81,
  "mu": 5,
  "forras": "Horvát épületenergetikai műszaki előírás (valószínűleg 'Tehnički propis o racionalnoj uporabi energije i toplinskoj zaštiti u zgradama') B melléklet (Prilog B), 5. táblázat 'Projektne vrijednosti toplinske provodljivosti λ i ... µ' – a dokumentumon cím/dátum nem látszik; értékei az EN ISO 10456 / EN 1745 táblázatokkal egyeznek – https://www.vguk.hr/multimedia/a3ba58b2856039a133df6cbf8dbda1ae76ab404911eb4aa0e61a87d14a343a3cced6f71d1648636332.pdf – sor 1.01 'puna opeka od gline' (ρ=1800, λ=0,81, μ=5/10)",
  "ellenorzott": true,
  "megjegyzes": "MSZ-04-140-2:1991 eredeti értékét (gyakran idézett 0,78) NEM sikerült ellenőrizhető forrásból igazolni. Itt a horvát (EN 1745-alapú) tervezési érték; μ száraz/nedves = 5/10. ρ = 1800 kg/m³"
 },
 {
  "id": "tomor_tegla_leier",
  "nev": "Leiertherm kisméretű tömör tégla falazat (mai gyártmány)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.552,
  "mu": 5,
  "forras": "Leier Hungária: Leier tégla kiadvány 2026 (web), 19. o. (λ terv,fal=0,552 W/mK; ρ bruttó=1540; U=1,40 W/m²K) – https://www.leier.hu/uploads/files/Leier_tegla_kiadvany_2026-web.pdf ; μ=5/25: Leier U-érték kalkulátor termékadatlap – https://u-ertek-kalkulator.leier.hu/downloadmanager/download/nohtml/1/id/3522",
  "ellenorzott": true,
  "megjegyzes": "Mai, kisebb testsűrűségű tömör tégla – régi (1800 kg/m³ körüli) téglafalra nem feltétlenül jellemző. μ száraz/nedves = 5/25. ρ = 1540 kg/m³"
 },
 {
  "id": "porotherm_38_nf_m25",
  "nev": "Porotherm 38 N+F falazat (M2,5 falazóhabarccsal)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.19,
  "mu": 5,
  "R": {
   "R": 2.0,
   "d": 0.38
  },
  "forras": "Wienerberger Porotherm 38 N+F termékadatlap (érv. 2023.03.06-tól), λ terv, vakolatlan falazat M2,5 habarccsal – https://www.wienerberger.hu/content/dam/wienerberger/hungary/marketing/documents-magazines/technical/technical-product-info-sheet/wall/2025-adatlapok/PTH%2038%20N+F%2020230306%20term%C3%A9kadatlap.pdf",
  "ellenorzott": true,
  "megjegyzes": "R=d/λ számított (0,38/0,19). U (két oldalon mészcement vakolattal) = 0,47 W/m²K. λ10,dry tégla = 0,16. μ = 5/10 (EN 1745). ρ = 750 kg/m³"
 },
 {
  "id": "porotherm_38_nf_m5l",
  "nev": "Porotherm 38 N+F falazat (M5-L hőszigetelő habarccsal)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.17,
  "mu": 5,
  "R": {
   "R": 2.24,
   "d": 0.38
  },
  "forras": "Wienerberger Porotherm 38 N+F termékadatlap (érv. 2023.03.06-tól), λ terv M5-L habarccsal – https://www.wienerberger.hu/content/dam/wienerberger/hungary/marketing/documents-magazines/technical/technical-product-info-sheet/wall/2025-adatlapok/PTH%2038%20N+F%2020230306%20term%C3%A9kadatlap.pdf",
  "ellenorzott": true,
  "megjegyzes": "R=d/λ számított. U (két oldalon mészcement vakolattal) = 0,41 W/m²K. μ = 5/10. ρ = 750 kg/m³"
 },
 {
  "id": "porotherm_30_nf_neo",
  "nev": "Porotherm 30 N+F neo falazat",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.148,
  "mu": 5,
  "forras": "Wienerberger: Porotherm Alkalmazási és tervezési útmutató 2025/01 (érv. 2025.03.17-től), összefoglaló táblázatok 17–23. o. – https://www.lambda.hu/laravel-filemanager/files/1/M%C3%A1rk%C3%A1k/Porotherm/katalogus/Porotherm_Alkalmaz%C3%A1stechnika_20250317%20(1)%20(1).pdf",
  "ellenorzott": false,
  "megjegyzes": "ELLENŐRIZENDŐ: a PDF-táblázat szövegkinyerése bizonytalan volt. λ10,dry tégla ≈0,148; U vakolt fal ≈0,45 (M5L/Dryx/DBM), ≈0,54 (M2,5G). A falazat egyenértékű λ-ja habarcstípusonként nem volt egyértelműen kiolvasható. Régi '30 N+F' (neo előtti) adatlapot nem találtam. ρ = 670 kg/m³"
 },
 {
  "id": "porotherm_38_xtherm_m5l",
  "nev": "Porotherm 38 X-therm falazat (M5L habarccsal) – a megszűnt 38 HS/Profi utódja",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.101,
  "mu": 5,
  "R": {
   "R": 3.76,
   "d": 0.38
  },
  "forras": "Wienerberger: Porotherm Alkalmazási és tervezési útmutató 2025/01 (érv. 2025.03.17-től), összefoglaló táblázatok 17–23. o. – https://www.lambda.hu/laravel-filemanager/files/1/M%C3%A1rk%C3%A1k/Porotherm/katalogus/Porotherm_Alkalmaz%C3%A1stechnika_20250317%20(1)%20(1).pdf",
  "ellenorzott": false,
  "megjegyzes": "ELLENŐRIZENDŐ (táblázat-kinyerés bizonytalan). U vakolt ≈0,24 W/m²K. R=d/λ számított. A kért 38 HS / 44 HS Profi termékek adatlapját nem találtam (a 2025-ös kínálatban nem szerepelnek). ρ = 740 kg/m³"
 },
 {
  "id": "porotherm_44_xtherm_rapid",
  "nev": "Porotherm 44 X-therm Rapid falazat (Dryx ragasztóhab / DBM vékonyhabarcs)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.1,
  "mu": 5,
  "R": {
   "R": 4.4,
   "d": 0.44
  },
  "forras": "Wienerberger: Porotherm Alkalmazási és tervezési útmutató 2025/01 (érv. 2025.03.17-től), összefoglaló táblázatok 17–23. o. – https://www.lambda.hu/laravel-filemanager/files/1/M%C3%A1rk%C3%A1k/Porotherm/katalogus/Porotherm_Alkalmaz%C3%A1stechnika_20250317%20(1)%20(1).pdf",
  "ellenorzott": false,
  "megjegyzes": "ELLENŐRIZENDŐ (táblázat-kinyerés bizonytalan). U vakolt ≈0,21 W/m²K. 44 HS / 44 N+F helyett, ezekre nem találtam adatot. ρ = 740 kg/m³"
 },
 {
  "id": "leiertherm_30_nf",
  "nev": "Leiertherm 30 N+F falazat (normál falazóhabarccsal)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.145,
  "R": {
   "R": 2.06,
   "d": 0.3
  },
  "forras": "Leier Hungária: Leier tégla kiadvány 2026 (web), 16. o., Leiertherm N+F táblázat (DE gyártóhely; λU, Ru, U) – https://www.leier.hu/uploads/files/Leier_tegla_kiadvany_2026-web.pdf",
  "ellenorzott": true,
  "megjegyzes": "U=0.45 W/m²K (vakolat leírása nincs). MD gyártóhely értékei eltérnek (38 N+F: λ=0,160). μ nincs megadva. Porotherm N+F-fel azonos kategória. ρ = 650 kg/m³"
 },
 {
  "id": "leiertherm_38_nf",
  "nev": "Leiertherm 38 N+F falazat (normál falazóhabarccsal)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.149,
  "R": {
   "R": 2.55,
   "d": 0.38
  },
  "forras": "Leier Hungária: Leier tégla kiadvány 2026 (web), 16. o., Leiertherm N+F táblázat (DE gyártóhely; λU, Ru, U) – https://www.leier.hu/uploads/files/Leier_tegla_kiadvany_2026-web.pdf",
  "ellenorzott": true,
  "megjegyzes": "U=0.37 W/m²K (vakolat leírása nincs). MD gyártóhely értékei eltérnek (38 N+F: λ=0,160). μ nincs megadva. Porotherm N+F-fel azonos kategória. ρ = 635 kg/m³"
 },
 {
  "id": "leiertherm_45_nf",
  "nev": "Leiertherm 45 N+F falazat (normál falazóhabarccsal)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.142,
  "R": {
   "R": 3.16,
   "d": 0.45
  },
  "forras": "Leier Hungária: Leier tégla kiadvány 2026 (web), 16. o., Leiertherm N+F táblázat (DE gyártóhely; λU, Ru, U) – https://www.leier.hu/uploads/files/Leier_tegla_kiadvany_2026-web.pdf",
  "ellenorzott": true,
  "megjegyzes": "U=0.3 W/m²K (vakolat leírása nincs). MD gyártóhely értékei eltérnek (38 N+F: λ=0,160). μ nincs megadva. Porotherm N+F-fel azonos kategória. ρ = 630 kg/m³"
 },
 {
  "id": "ytong_classic_375",
  "nev": "Ytong Classic pórusbeton falazat 37,5 cm",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.117,
  "R": {
   "R": 3.21,
   "d": 0.375
  },
  "forras": "Xella Magyarország: 'Xella termékek' kiadvány (dátum nélkül), kb. 24–25. dia – https://storefrontapi.commerce.xella.com/medias/sys_master/root/h5a/haf/8859597963294/Xella%20termekek/Xella-termekek.pdf",
  "ellenorzott": true,
  "megjegyzes": "R=d/λ számított. Összehasonlító ábrán U≈0,30 W/m²K. Testsűrűség/μ nincs megadva."
 },
 {
  "id": "ytong_lambda",
  "nev": "Ytong Lambda pórusbeton falazat (37,5–50 cm)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.099,
  "forras": "Xella Magyarország: 'Xella termékek' kiadvány, kb. 22–24. dia – https://storefrontapi.commerce.xella.com/medias/sys_master/root/h5a/haf/8859597963294/Xella%20termekek/Xella-termekek.pdf",
  "ellenorzott": true,
  "megjegyzes": "U: 37,5 cm 0,23; 45 cm 0,19; 50 cm 0,17 W/m²K (vakolás nincs jelölve)."
 },
 {
  "id": "ytong_p2_05_30",
  "nev": "Ytong P2-0,5 pórusbeton falazat 30 cm (régi, 2006-os termék)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.11,
  "forras": "Xella Magyarország: Ytong építési rendszer prospektus, 2006. szeptember, 8–9. o. – https://www.pillertuzep.hu/_data/_vfs/falazoanyagok-ytong.pdf",
  "ellenorzott": true,
  "megjegyzes": "λ10=0,11 W/mK (elemre, nem tervezési falazat-érték!). U két oldalon vakolva: 30 cm 0,40; 37,5 cm 0,32 W/m²K. ρ a 0,5 testsűrűség-osztályból (500 kg/m³). P4-0,6: U 30 cm 0,46; 37,5 cm 0,37. ρ = 500 kg/m³"
 },
 {
  "id": "multipor",
  "nev": "Multipor ásványi hőszigetelő lap (Xella)",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_hab",
  "lambda": 0.045,
  "mu": 3,
  "forras": "Xella Magyarország: 'Xella termékek' kiadvány, kb. 69. dia – https://storefrontapi.commerce.xella.com/medias/sys_master/root/h5a/haf/8859597963294/Xella%20termekek/Xella-termekek.pdf",
  "ellenorzott": true,
  "megjegyzes": "ρ = 115 kg/m³"
 },
 {
  "id": "meszhomok_silka_1800",
  "nev": "Mészhomok (Silka) tömör falazóelem, ρ=1800",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.91,
  "mu": 5,
  "forras": "Xella BE: Silka tömör ragasztott blokk műszaki lap (FT BLOC SILKA LB), λUi=0,91, μ=5/25 – https://gobert.groupegobert.com/ressources/images/articles/Fiches_techniques/XELLA%20FT%20BLOC%20SILKA%20LB.pdf",
  "ellenorzott": true,
  "megjegyzes": "Belga Xella adatlap (magyar Silka adatlapon λ nincs). Horvát táblázat (1.12): ρ=1800, λ=0,99, μ=15/25. μ száraz/nedves=5/25. ρ = 1800 kg/m³"
 },
 {
  "id": "vasbeton_2300",
  "nev": "Vasbeton (1% acél), ρ=2300",
  "kategoria": "Beton",
  "sraffozas": "beton",
  "lambda": 2.3,
  "forras": "BRE BR 443 'Conventions for U-value calculations' (2019, 3. kiadás), 3. fejezet 'Thermal properties of materials and products', kb. 9–11. o. (BS EN ISO 10456 táblázatos tervezési értékeire épül; másodlagos közlés) – https://www.cibse.org/media/wzrjrf3l/conventions-for-u-value-calculations.pdf – 'Reinforced concrete beam (1% steel)'",
  "ellenorzott": true,
  "megjegyzes": "EN ISO 10456 szerint 1% vasalás 2300 kg/m³. μ BR 443-ban nincs. ρ = 2300 kg/m³"
 },
 {
  "id": "vasbeton_2500",
  "nev": "Vasbeton, ρ=2500",
  "kategoria": "Beton",
  "sraffozas": "beton",
  "lambda": 2.6,
  "mu": 80,
  "forras": "Horvát épületenergetikai műszaki előírás (valószínűleg 'Tehnički propis o racionalnoj uporabi energije i toplinskoj zaštiti u zgradama') B melléklet (Prilog B), 5. táblázat 'Projektne vrijednosti toplinske provodljivosti λ i ... µ' – a dokumentumon cím/dátum nem látszik; értékei az EN ISO 10456 / EN 1745 táblázatokkal egyeznek – https://www.vguk.hr/multimedia/a3ba58b2856039a133df6cbf8dbda1ae76ab404911eb4aa0e61a87d14a343a3cced6f71d1648636332.pdf – sor 2.01 'armirani beton' (ρ=2500, λ=2,60, μ=80/130)",
  "ellenorzott": true,
  "megjegyzes": "EN ISO 10456 2% vasalás (2400 kg/m³) értéke 2,5 – az eredeti szabványt nem értem el. μ száraz/nedves=80/130. Beton/vasbeton födémhez is ezt használd. ρ = 2500 kg/m³"
 },
 {
  "id": "beton_2400",
  "nev": "Beton (normál, ρ=2400)",
  "kategoria": "Beton",
  "sraffozas": "beton",
  "lambda": 2.0,
  "mu": 80,
  "forras": "Horvát épületenergetikai műszaki előírás (valószínűleg 'Tehnički propis o racionalnoj uporabi energije i toplinskoj zaštiti u zgradama') B melléklet (Prilog B), 5. táblázat 'Projektne vrijednosti toplinske provodljivosti λ i ... µ' – a dokumentumon cím/dátum nem látszik; értékei az EN ISO 10456 / EN 1745 táblázatokkal egyeznek – https://www.vguk.hr/multimedia/a3ba58b2856039a133df6cbf8dbda1ae76ab404911eb4aa0e61a87d14a343a3cced6f71d1648636332.pdf – sor 2.03 (ρ=2400, λ=2,00, μ=80/130)",
  "ellenorzott": true,
  "megjegyzes": "ρ = 2400 kg/m³"
 },
 {
  "id": "beton_2200",
  "nev": "Beton (ρ=2200)",
  "kategoria": "Beton",
  "sraffozas": "beton",
  "lambda": 1.65,
  "mu": 70,
  "forras": "Horvát épületenergetikai műszaki előírás (valószínűleg 'Tehnički propis o racionalnoj uporabi energije i toplinskoj zaštiti u zgradama') B melléklet (Prilog B), 5. táblázat 'Projektne vrijednosti toplinske provodljivosti λ i ... µ' – a dokumentumon cím/dátum nem látszik; értékei az EN ISO 10456 / EN 1745 táblázatokkal egyeznek – https://www.vguk.hr/multimedia/a3ba58b2856039a133df6cbf8dbda1ae76ab404911eb4aa0e61a87d14a343a3cced6f71d1648636332.pdf – sor 2.04 (ρ=2200, λ=1,65, μ=70/120)",
  "ellenorzott": true,
  "megjegyzes": "ρ = 2200 kg/m³"
 },
 {
  "id": "beton_2000",
  "nev": "Beton (ρ=2000)",
  "kategoria": "Beton",
  "sraffozas": "beton",
  "lambda": 1.35,
  "mu": 60,
  "forras": "Horvát épületenergetikai műszaki előírás (valószínűleg 'Tehnički propis o racionalnoj uporabi energije i toplinskoj zaštiti u zgradama') B melléklet (Prilog B), 5. táblázat 'Projektne vrijednosti toplinske provodljivosti λ i ... µ' – a dokumentumon cím/dátum nem látszik; értékei az EN ISO 10456 / EN 1745 táblázatokkal egyeznek – https://www.vguk.hr/multimedia/a3ba58b2856039a133df6cbf8dbda1ae76ab404911eb4aa0e61a87d14a343a3cced6f71d1648636332.pdf – sor 2.05 (ρ=2000, λ=1,35, μ=60/100)",
  "ellenorzott": true,
  "megjegyzes": "ρ = 2000 kg/m³"
 },
 {
  "id": "esztrich_cement",
  "nev": "Aljzatbeton / cementesztrich (ρ=2000)",
  "kategoria": "Beton",
  "sraffozas": "beton",
  "lambda": 1.6,
  "mu": 50,
  "forras": "Horvát épületenergetikai műszaki előírás (valószínűleg 'Tehnički propis o racionalnoj uporabi energije i toplinskoj zaštiti u zgradama') B melléklet (Prilog B), 5. táblázat 'Projektne vrijednosti toplinske provodljivosti λ i ... µ' – a dokumentumon cím/dátum nem látszik; értékei az EN ISO 10456 / EN 1745 táblázatokkal egyeznek – https://www.vguk.hr/multimedia/a3ba58b2856039a133df6cbf8dbda1ae76ab404911eb4aa0e61a87d14a343a3cced6f71d1648636332.pdf – sor 3.19 'cementni estrih' (ρ=2000, λ=1,60, μ=50)",
  "ellenorzott": true,
  "megjegyzes": "BR 443: concrete screed ρ=1800 → λ=1,15 (BS EN ISO 10456). ρ = 2000 kg/m³"
 },
 {
  "id": "zsalufal_leier_beton",
  "nev": "Leier beton zsaluelemes fal betonkitöltéssel",
  "kategoria": "Falazat",
  "sraffozas": "beton",
  "lambda": 1.65,
  "mu": 5,
  "forras": "Leier zsaluzóelemek teljesítménynyilatkozat LE HA15435-02 (2024.03.12., Hajdúszoboszló): hővezetési ellenállás = NPD, μ=5/15 – https://www.leier.hu/uploads/files/Beton-zsaluzoelem-Hajduszoboszlo-65f148d5981e9.pdf",
  "ellenorzott": false,
  "megjegyzes": "A gyártó nem ad hőtechnikai értéket (NPD). λ becslés: beton ρ=2200 → 1,65 (horvát Prilog B 2.04), mivel a fal közel homogén beton. ρ = 2200 kg/m³"
 },
 {
  "id": "salakbeton",
  "nev": "Salakbeton (ρ≈1200–1600)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.79,
  "mu": 8,
  "forras": "tzb-info.cz 'Hodnoty fyzikálních veličin vybraných stavebních materiálů' (forrás: Laboutka–Suchánek: Výpočtové tabulky pro vytápění, 2001; hivatkozott irodalom ČSN 73 0540-3:1995), λp érték – https://www.tzb-info.cz/tabulky-a-vypocty/58-hodnoty-fyzikalnich-velicin-vybranych-stavebnich-materialu – sorok 27–37 'beton ze škváry': 1000→0,52; 1200→0,67; 1600→0,79; 2000→1,01; μ 6–8",
  "ellenorzott": false,
  "megjegyzes": "MSZ-04-140-2 értéket nem találtam; cseh táblázat anyagértéke (nem falazat). Sűrűség szerint választandó: 1200 kg/m³ → 0,67. ρ = 1600 kg/m³"
 },
 {
  "id": "valyog_1600",
  "nev": "Vályogtégla fal (ρ≈1600)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.73,
  "mu": 5,
  "forras": "Claytec: Strangepresste Lehmsteine AK II (DIN 18945) adatlap, 02-2018 – 2DF/3DF, ρ-osztály 1,6: λ=0,73, μ=5/10 – https://baustoffshop.de/media/pdf/claytec/Lehmsteine_Klasse_II_Gruenlinge.pdf",
  "ellenorzott": false,
  "megjegyzes": "Német gyári vályogtégla értéke, történeti magyar vályogfalra analógiaként. Tömör (ρ 1,8): λ=0,91. Vert falra (Stampflehm) nem találtam ellenőrizhető adatot. ρ = 1600 kg/m³"
 },
 {
  "id": "valyog_1800",
  "nev": "Vályogtégla fal (tömör, ρ≈1800)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.91,
  "mu": 5,
  "forras": "Claytec Lehmsteine AK II adatlap 02-2018 – DF/NF, ρ-osztály 1,8: λ=0,91, μ=5/10 – https://baustoffshop.de/media/pdf/claytec/Lehmsteine_Klasse_II_Gruenlinge.pdf",
  "ellenorzott": false,
  "megjegyzes": "Vert fal (döngölt föld, ρ≈1900–2000) közelítésére is ez a legközelebbi talált adat. ρ = 1800 kg/m³"
 },
 {
  "id": "termeszko_meszko",
  "nev": "Terméskő fal – mészkő (ρ=2000)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 1.4,
  "mu": 50,
  "forras": "BRE BR 443 'Conventions for U-value calculations' (2019, 3. kiadás), 3. fejezet 'Thermal properties of materials and products', kb. 9–11. o. (BS EN ISO 10456 táblázatos tervezési értékeire épül; másodlagos közlés) – https://www.cibse.org/media/wzrjrf3l/conventions-for-u-value-calculations.pdf – 'Limestone (2000 kg/m³) λ=1,40'; μ: Horvát épületenergetikai műszaki előírás (valószínűleg 'Tehnički propis o racionalnoj uporabi energije i toplinskoj zaštiti u zgradama') B melléklet (Prilog B), 5. táblázat 'Projektne vrijednosti toplinske provodljivosti λ i ... µ' – a dokumentumon cím/dátum nem látszik; értékei az EN ISO 10456 / EN 1745 táblázatokkal egyeznek – https://www.vguk.hr/multimedia/a3ba58b2856039a133df6cbf8dbda1ae76ab404911eb4aa0e61a87d14a343a3cced6f71d1648636332.pdf sor 1.15 'prirodni kamen' (2000; 1,40; μ=50)",
  "ellenorzott": true,
  "megjegyzes": "Kőanyag-érték; habarcshézagok és üregek nincsenek figyelembe véve. ρ = 2000 kg/m³"
 },
 {
  "id": "termeszko_homokko_granit",
  "nev": "Terméskő fal – homokkő / gránit (ρ=2600)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 2.3,
  "forras": "BRE BR 443 'Conventions for U-value calculations' (2019, 3. kiadás), 3. fejezet 'Thermal properties of materials and products', kb. 9–11. o. (BS EN ISO 10456 táblázatos tervezési értékeire épül; másodlagos közlés) – https://www.cibse.org/media/wzrjrf3l/conventions-for-u-value-calculations.pdf – 'Sandstone or granite (2600 kg/m³) λ=2,30'",
  "ellenorzott": true,
  "megjegyzes": "Kőanyag-érték. Cseh táblázat: gránit 2500 → 3,1; homokkő 1800–2600 → 0,9–1,7 (eltérő források!). ρ = 2600 kg/m³"
 },
 {
  "id": "puhafa",
  "nev": "Puhafa (fenyő), hőáram rostra merőleges",
  "kategoria": "Fa",
  "sraffozas": "fa",
  "lambda": 0.13,
  "mu": 50,
  "forras": "BRE BR 443 'Conventions for U-value calculations' (2019, 3. kiadás), 3. fejezet 'Thermal properties of materials and products', kb. 9–11. o. (BS EN ISO 10456 táblázatos tervezési értékeire épül; másodlagos közlés) – https://www.cibse.org/media/wzrjrf3l/conventions-for-u-value-calculations.pdf – 'Timber/softwood λ=0,13 (typ. 500 kg/m³)'; μ: Horvát épületenergetikai műszaki előírás (valószínűleg 'Tehnički propis o racionalnoj uporabi energije i toplinskoj zaštiti u zgradama') B melléklet (Prilog B), 5. táblázat 'Projektne vrijednosti toplinske provodljivosti λ i ... µ' – a dokumentumon cím/dátum nem látszik; értékei az EN ISO 10456 / EN 1745 táblázatokkal egyeznek – https://www.vguk.hr/multimedia/a3ba58b2856039a133df6cbf8dbda1ae76ab404911eb4aa0e61a87d14a343a3cced6f71d1648636332.pdf sor 4.05 (500; 0,13; μ=50/70)",
  "ellenorzott": true,
  "megjegyzes": "μ száraz/nedves 50/70 (HR). Hasslacher CLT adatlap EN ISO 10456-ra hivatkozva fára μ=50/20-at ír. ρ = 500 kg/m³"
 },
 {
  "id": "kemenyfa",
  "nev": "Keményfa (tölgy, bükk)",
  "kategoria": "Fa",
  "sraffozas": "fa",
  "lambda": 0.18,
  "mu": 200,
  "forras": "BRE BR 443 'Conventions for U-value calculations' (2019, 3. kiadás), 3. fejezet 'Thermal properties of materials and products', kb. 9–11. o. (BS EN ISO 10456 táblázatos tervezési értékeire épül; másodlagos közlés) – https://www.cibse.org/media/wzrjrf3l/conventions-for-u-value-calculations.pdf – 'Timber/hardwood (700 kg/m³) λ=0,18'; μ: Horvát épületenergetikai műszaki előírás (valószínűleg 'Tehnički propis o racionalnoj uporabi energije i toplinskoj zaštiti u zgradama') B melléklet (Prilog B), 5. táblázat 'Projektne vrijednosti toplinske provodljivosti λ i ... µ' – a dokumentumon cím/dátum nem látszik; értékei az EN ISO 10456 / EN 1745 táblázatokkal egyeznek – https://www.vguk.hr/multimedia/a3ba58b2856039a133df6cbf8dbda1ae76ab404911eb4aa0e61a87d14a343a3cced6f71d1648636332.pdf sor 4.06 (700; 0,18; μ=200)",
  "ellenorzott": true,
  "megjegyzes": "ρ = 700 kg/m³"
 },
 {
  "id": "clt",
  "nev": "CLT rétegelt-ragasztott tömörfa panel",
  "kategoria": "Fa",
  "sraffozas": "fa",
  "lambda": 0.12,
  "mu": 50,
  "forras": "HASSLACHER CLT termékismertető (HNT PF HASSLACHER CLT EN 20260518) – λ=0,12; μ=50 (száraz)/20 (nedves) EN ISO 10456 szerint; átlagsűrűség 420–480 – https://www.hasslacher.com/data/_dateimanager/broschuere/HNT-Brettsperrholz-EN.pdf",
  "ellenorzott": false,
  "megjegyzes": "ρ: lucfenyő 450–500, ETA szerinti átlag 420 (CL26) / 480 (CL36); itt 470 kerekítve – ellenőrizendő. ρ = 470 kg/m³"
 },
 {
  "id": "osb",
  "nev": "OSB/3 lap",
  "kategoria": "Fa",
  "sraffozas": "fa",
  "lambda": 0.13,
  "forras": "SWISS KRONO Kft. (Vásárosnamény): OSB/3 műszaki adatok, 2024.03.01. – λ=0,13; ρ 600–640 vastagság szerint; sd≥2,0 m (12–25 mm) – https://www.frischeis.at/pim/07%20Platte/Datenblaetter/swiss%20krono/Technische%20Datenblaetter/Technische_Daten_SK_HU%2019.3.2024.pdf",
  "ellenorzott": true,
  "megjegyzes": "μ nincs közvetlenül megadva (sd≥2 m). Horvát táblázat 4.09: OSB 650 kg/m³, λ=0,13, μ=50. BR 443: OSB 650 → 0,13. ρ = 610 kg/m³"
 },
 {
  "id": "gipszrost",
  "nev": "Gipszrost lap (Fermacell)",
  "kategoria": "Burkolat",
  "sraffozas": "burkolat",
  "lambda": 0.32,
  "mu": 13,
  "forras": "James Hardie (fermacell) gipszrost lap termékadatlap, 2023. aug. (NL) – λ=0,32; ρ=1150±50; μ=13 – https://eurabo.be/files/attachments/.8736/01NL_Fermacell_gipsvezelplaat_productblad_2023.pdf",
  "ellenorzott": true,
  "megjegyzes": "ρ = 1150 kg/m³"
 },
 {
  "id": "cementforgacs",
  "nev": "Cementkötésű forgácslap (CETRIS)",
  "kategoria": "Burkolat",
  "sraffozas": "burkolat",
  "lambda": 0.287,
  "mu": 52.8,
  "forras": "CETRIS PDB műszaki adatlap – λ=0,200–0,287 (8–40 mm, EN 12664); ρ 1150–1450; μ=52,8–69,2 – https://sentinel-holding.eu/Kunden/Bausal%20GmbH%20%20-%20Cetris%20Deutschland/Produktunterlagen/Zementgebundene%20Spanplatte%20Cetris/technical-data-sheet-pdb.pdf",
  "ellenorzott": true,
  "megjegyzes": "λ vastagságfüggő; itt a felső (biztonságos) érték. μ tartomány alsó értéke. ρ = 1350 kg/m³"
 },
 {
  "id": "eps80_feher",
  "nev": "EPS 80 homlokzati hőszigetelő lemez (fehér) – Austrotherm AT-H80",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_hab",
  "lambda": 0.039,
  "mu": 20,
  "forras": "Austrotherm AT-H80 terméklap 2023 – λD terv=0,039 (közölt 0,038); μ=20–40 – https://www.austrotherm.hu/fileadmin/user_upload/HU/Termekek/Adatlapok_2023/AUSTROTHERM_AT-H80_adatlap2023.pdf",
  "ellenorzott": true,
  "megjegyzes": "μ tartomány 20–40 (alsó érték megadva). Testsűrűség nincs az adatlapon."
 },
 {
  "id": "eps80_grafit",
  "nev": "EPS 80 grafitos homlokzati lemez – Austrotherm Grafit 80",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_hab",
  "lambda": 0.031,
  "mu": 20,
  "forras": "Austrotherm GRAFIT 80 műszaki adatlap 2022 – λD=0,031; μ=20–40 – https://austrotherm.hu/fileadmin/user_upload/HU/Termekek/Adatlapok/Grafit_80_muszaki_adatlap_2022.pdf",
  "ellenorzott": true,
  "megjegyzes": "Masterplast Isomaster EPS H-80-G (2024.04.23.): λD=0,031, MU 20–40 – https://masterplast.hu/wp-content/uploads/2024/06/ma_isomaster-eps-h-80-g_20240423_hu.pdf"
 },
 {
  "id": "eps100_feher",
  "nev": "EPS 100 lépésálló/terhelhető lemez (fehér) – Austrotherm AT-N100",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_hab",
  "lambda": 0.038,
  "mu": 30,
  "forras": "Austrotherm AT-N100 terméklap 2023 – λD terv=0,038 (közölt 0,037); μ=30–70 – https://www.austrotherm.hu/fileadmin/user_upload/HU/Termekek/Adatlapok_2023/AUSTROTHERM_AT-N100_adatlap2023.pdf",
  "ellenorzott": true,
  "megjegyzes": "Padló/födém/lapostető termék (nem homlokzati). Homlokzati EPS 100 adatlapot nem értem el."
 },
 {
  "id": "eps100_grafit",
  "nev": "EPS 100 grafitos lemez – Austrotherm Grafit 100",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_hab",
  "lambda": 0.03,
  "mu": 30,
  "forras": "Austrotherm GRAFIT 100 terméklap 2018 – λD=0,030; μ=30–70 – https://www.austrotherm.hu/fileadmin/user_upload/HU/Termekek/Adatlapok/AUSTROTHERM_GRAFIT_100_adatlap.pdf",
  "ellenorzott": true,
  "megjegyzes": "2018-as adatlap; padló/lapostető/talajjal érintkező fal alkalmazás."
 },
 {
  "id": "xps_labazati",
  "nev": "XPS lábazati lemez (érdesített) – Austrotherm XPS TOP P GK",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_hab",
  "lambda": 0.035,
  "mu": 100,
  "forras": "Austrotherm XPS TOP P GK terméklap 2023 – λD: 30–60 mm 0,033; 70–80 mm 0,035; 100–160 mm 0,036; μ=100 – https://www.austrotherm.hu/fileadmin/user_upload/HU/Termekek/Adatlapok_2023/AUSTROTHERM_XPS_TOP_P_GK_adatlap2023.pdf",
  "ellenorzott": true,
  "megjegyzes": "λ vastagságfüggő! Itt a 70–80 mm-es érték."
 },
 {
  "id": "kozetgyapot_homlokzati",
  "nev": "Kőzetgyapot homlokzati lemez – Rockwool Frontrock Super (ex Frontrock Max E)",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_szalas",
  "lambda": 0.036,
  "mu": 1,
  "forras": "Rockwool Frontrock Super termékadatlap, 2020. márc. – λD=0,036; μ=1; A1 – https://www.rockwool.com/syssiteassets/rw-hu/termekadatlapok/homlokzati-hszigeteles/frontrock-super-termekadatlap.pdf",
  "ellenorzott": true,
  "megjegyzes": "Knauf Insulation FKD S Thermal λD=0,034, FKD N Thermal 0,035 (katalógus 2024.04.01.)."
 },
 {
  "id": "uveggyapot_tekercs",
  "nev": "Üveggyapot tekercs (padlás, vázkitöltés) – Knauf NatuRoll Pro",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_szalas",
  "lambda": 0.039,
  "mu": 1,
  "forras": "Knauf Insulation termékkatalógus (érv. 2024.04.01-től) – NatuRoll Pro λD=0,039 – https://pim.knaufinsulation.com/files/download/download_6618df9903883.pdf",
  "ellenorzott": true,
  "megjegyzes": "μ=1 nem a katalógusból: ásványgyapotra általános (Rockwool MU1 jelölés); ρ nincs megadva."
 },
 {
  "id": "asvanyiyapot_szarufa",
  "nev": "Ásványgyapot szarufák közé – Knauf Unifit 035",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_szalas",
  "lambda": 0.035,
  "mu": 1,
  "forras": "Knauf Insulation termékkatalógus 2024.04.01. – Unifit 035 λD=0,035 (Unifit 032/033/037 is) – https://pim.knaufinsulation.com/files/download/download_6618df9903883.pdf",
  "ellenorzott": true,
  "megjegyzes": "μ=1 általános ásványgyapot-érték, nem a katalógusból."
 },
 {
  "id": "asvanyiyapot_lemez_padlas",
  "nev": "Ásványgyapot lemez (padlásfödém, magastető) – Knauf MPN 038",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_szalas",
  "lambda": 0.038,
  "mu": 1,
  "forras": "Knauf Insulation termékkatalógus 2024.04.01. – MPN λD=0,038; MPN Plus 037: 0,037 (MU1) – https://pim.knaufinsulation.com/files/download/download_6618df9903883.pdf",
  "ellenorzott": true
 },
 {
  "id": "pir_alu",
  "nev": "PIR hab hőszigetelő lap, alufólia kasírozással",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_hab",
  "lambda": 0.022,
  "forras": "TECHNONICOL PIR műszaki lap TN 5.01/2020 – F/F burkolat λD=0,022; GTM/GTB 0,026; RD táblázat vastagság szerint – https://www.dach-bud.poznan.pl/pdf/pir/KT_PL_PIR.pdf",
  "ellenorzott": true,
  "megjegyzes": "Lengyel adatlap. μ: NPD. Kasírozott lapnál a fólia gyakorlatilag párazáró."
 },
 {
  "id": "pir_uvegfatyol",
  "nev": "PIR hab hőszigetelő lap, üvegfátyol kasírozással",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_hab",
  "lambda": 0.026,
  "forras": "TECHNONICOL PIR TN 5.01/2020 – GTM/GTB λD=0,026 – https://www.dach-bud.poznan.pl/pdf/pir/KT_PL_PIR.pdf",
  "ellenorzott": true
 },
 {
  "id": "fagyapot_heraklith",
  "nev": "Fagyapot lap – Heraklith C",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_szalas",
  "lambda": 0.095,
  "mu": 5,
  "forras": "Knauf Insulation Heraklith C műszaki lap (olasz), 01/2023 – λD=0,095; μ=5; R: 25 mm 0,25, 50 mm 0,50 m²K/W – https://pim.knaufinsulation.com/files/download/heraklith_c_i.pdf",
  "ellenorzott": true,
  "megjegyzes": "ρ nincs megadva; felületi tömegből számolva ~420 (50 mm) – 500 (25 mm) kg/m³."
 },
 {
  "id": "celluloz_befujt",
  "nev": "Cellulóz befújt hőszigetelés – ISOCELL",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_szalas",
  "lambda": 0.038,
  "mu": 3,
  "forras": "ISOCELL cellulóz termékadatlap (SK, 09_2026) – λD 0,037 névl.; 0,038 (AT/EU); 0,039 (DE); ρ 28–65; μ=3?; ETA-06/0076 – https://www.isocell.com/fileadmin/pim_export/documents/PDBL/PDBL_MA_ZELLULOSE_SK.pdf",
  "ellenorzott": true,
  "megjegyzes": "Beépítési sűrűség 28–65 kg/m³ az alkalmazástól függ."
 },
 {
  "id": "kender",
  "nev": "Kenderszigetelés – Thermo Hanf Premium",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_szalas",
  "lambda": 0.041,
  "mu": 1,
  "forras": "DIBt ETA-05/0037 (2023.07.11., HempFlax) – THERMO HANF PREMIUM λD=0,041; ρ 35–48; μ=1–2 – https://www.dibt.de/pdf_storage/2023/ETA-05!0037(8.12.01-13!23)e.pdf",
  "ellenorzott": true,
  "megjegyzes": "Tervezési érték nemzeti szabályozás szerint (ETA csak λD-t ad)."
 },
 {
  "id": "hoszigetelo_vakolat",
  "nev": "Hőszigetelő vakolat – Baumit ThermoPutz",
  "kategoria": "Vakolat",
  "sraffozas": "vakolat",
  "lambda": 0.13,
  "mu": 15,
  "forras": "Baumit ThermoPutz műszaki lap 05/2022 – λ=0,130; száraz ρ≈440; μ≈15; CS II W1 T2 – https://baumit.hu/files/hu/pdf_fajlok/pds_thermoputz_bhu_hu_12844.pdf",
  "ellenorzott": true,
  "megjegyzes": "ρ = 440 kg/m³"
 },
 {
  "id": "nad",
  "nev": "Nádlap / nádpalló",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_szalas",
  "lambda": 0.061,
  "mu": 6,
  "forras": "DIBt Z-23.11-2092 (2024.09.12.; Hiss Reet GmbH) – λ terv=0,061; ρ 115–160; μ=6 – https://dibt.de/pdf_storage/2024/Z-23.11-2092(1.23.11-29!23).pdf",
  "ellenorzott": true,
  "megjegyzes": "Mai préselt nádlap; régi nádszövet/nádpalló vakolattartóként (vékony) hatása elhanyagolható. ρ 140 = tartomány közepe (kerekített). ρ = 140 kg/m³"
 },
 {
  "id": "meszcement_vakolat",
  "nev": "Mészcement vakolat",
  "kategoria": "Vakolat",
  "sraffozas": "vakolat",
  "lambda": 1.0,
  "mu": 15,
  "forras": "Horvát épületenergetikai műszaki előírás (valószínűleg 'Tehnički propis o racionalnoj uporabi energije i toplinskoj zaštiti u zgradama') B melléklet (Prilog B), 5. táblázat 'Projektne vrijednosti toplinske provodljivosti λ i ... µ' – a dokumentumon cím/dátum nem látszik; értékei az EN ISO 10456 / EN 1745 táblázatokkal egyeznek – https://www.vguk.hr/multimedia/a3ba58b2856039a133df6cbf8dbda1ae76ab404911eb4aa0e61a87d14a343a3cced6f71d1648636332.pdf – sor 3.03 'vapnenocementna žbuka' (1800; 1,00; μ=15/35)",
  "ellenorzott": true,
  "megjegyzes": "Baumit MPA 35 (05/2022): λ>0,450, ρ≈1300, μ≈25 – https://baumit.hu/files/hu/pdf_fajlok/pds_mpa_35_bhu_hu_12838.pdf ρ = 1800 kg/m³"
 },
 {
  "id": "mesz_vakolat",
  "nev": "Mészvakolat",
  "kategoria": "Vakolat",
  "sraffozas": "vakolat",
  "lambda": 0.8,
  "mu": 6,
  "forras": "Horvát épületenergetikai műszaki előírás (valószínűleg 'Tehnički propis o racionalnoj uporabi energije i toplinskoj zaštiti u zgradama') B melléklet (Prilog B), 5. táblázat 'Projektne vrijednosti toplinske provodljivosti λ i ... µ' – a dokumentumon cím/dátum nem látszik; értékei az EN ISO 10456 / EN 1745 táblázatokkal egyeznek – https://www.vguk.hr/multimedia/a3ba58b2856039a133df6cbf8dbda1ae76ab404911eb4aa0e61a87d14a343a3cced6f71d1648636332.pdf – sor 3.02 'vapnena žbuka' (1600; 0,80; μ=6/10)",
  "ellenorzott": true,
  "megjegyzes": "Baumit KlimaMPI (05/2022) könnyű mészvakolat: λ≈0,50, ρ≈1300, μ≈15 – https://baumit.hu/files/hu/pdf_fajlok/pds_klimampi_bhu_hu_49472.pdf ρ = 1600 kg/m³"
 },
 {
  "id": "cement_vakolat",
  "nev": "Cementvakolat / cementhabarcs",
  "kategoria": "Vakolat",
  "sraffozas": "vakolat",
  "lambda": 1.6,
  "mu": 15,
  "forras": "Horvát épületenergetikai műszaki előírás (valószínűleg 'Tehnički propis o racionalnoj uporabi energije i toplinskoj zaštiti u zgradama') B melléklet (Prilog B), 5. táblázat 'Projektne vrijednosti toplinske provodljivosti λ i ... µ' – a dokumentumon cím/dátum nem látszik; értékei az EN ISO 10456 / EN 1745 táblázatokkal egyeznek – https://www.vguk.hr/multimedia/a3ba58b2856039a133df6cbf8dbda1ae76ab404911eb4aa0e61a87d14a343a3cced6f71d1648636332.pdf – sor 3.01 'cementna žbuka' (2000; 1,60; μ=15/35)",
  "ellenorzott": true,
  "megjegyzes": "Baumit SockelPutz lábazati (05/2022): λ=0,800, ρ≈1650, μ≈15. ρ = 2000 kg/m³"
 },
 {
  "id": "gipsz_vakolat",
  "nev": "Gipszes glettvakolat – Baumit GlättPutz",
  "kategoria": "Vakolat",
  "sraffozas": "vakolat",
  "lambda": 0.6,
  "mu": 10,
  "forras": "Baumit GlättPutz műszaki lap 05/2022 – λ=0,600; ρ≈1150; μ≈10 – https://baumit.hu/files/hu/pdf_fajlok/pds_ratioglatt___gl_ttputz___ratio_1000_bhu_hu_12833.pdf",
  "ellenorzott": true,
  "megjegyzes": "Horvát táblázat 3.05 'gipsana žbuka': 1500; 0,54; μ=6/10. ρ = 1150 kg/m³"
 },
 {
  "id": "nemesvakolat",
  "nev": "Vékonyvakolat / nemesvakolat (szilikon) – Baumit SilikonTop",
  "kategoria": "Vakolat",
  "sraffozas": "vakolat",
  "lambda": 0.7,
  "mu": 40,
  "forras": "Baumit SilikonTop műszaki lap 2016.02.18. – λ≈0,70; ρ≈1,8 kg/dm³; μ=40–60; sd 0,08–0,12 m (2 mm) – https://baumit.hu/files/hu/pdf_fajlok/pdbl_silikontop.pdf",
  "ellenorzott": true,
  "megjegyzes": "ρ = 1800 kg/m³"
 },
 {
  "id": "ragasztotapasz",
  "nev": "Ragasztó- és ágyazótapasz – Baumit DuoContact",
  "kategoria": "Vakolat",
  "sraffozas": "vakolat",
  "lambda": 0.8,
  "mu": 50,
  "forras": "Baumit DuoContact műszaki lap 05/2022 – λ=0,800; μ≈50 – https://baumit.hu/files/hu/pdf_fajlok/pds_duocontact_bhu_hu_12791.pdf",
  "ellenorzott": true
 },
 {
  "id": "gipszkarton_rb",
  "nev": "Gipszkarton lap (Rigips RB 12,5)",
  "kategoria": "Burkolat",
  "sraffozas": "burkolat",
  "lambda": 0.25,
  "mu": 10,
  "forras": "Saint-Gobain Rigips GmbH: Bauplatte RB 12,5 Produktdatenblatt, 2015.07.08. – λ=0,25; ρ≥680; μ=10/4 – https://downloads.carlgoetz.de/o1898454v19_BD49F2B8FABF4A6CBA419F6FCB949767_PDB_Rigips_Bauplatte_RB_12_5.pdf",
  "ellenorzott": true,
  "megjegyzes": "BR 443: ≤700 kg/m³ → 0,21; ≤900 kg/m³ → 0,25. μ száraz/nedves 10/4. ρ = 680 kg/m³"
 },
 {
  "id": "keramia",
  "nev": "Kerámia burkolólap",
  "kategoria": "Burkolat",
  "sraffozas": "burkolat",
  "lambda": 1.3,
  "mu": 200,
  "forras": "Horvát épületenergetikai műszaki előírás (valószínűleg 'Tehnički propis o racionalnoj uporabi energije i toplinskoj zaštiti u zgradama') B melléklet (Prilog B), 5. táblázat 'Projektne vrijednosti toplinske provodljivosti λ i ... µ' – a dokumentumon cím/dátum nem látszik; értékei az EN ISO 10456 / EN 1745 táblázatokkal egyeznek – https://www.vguk.hr/multimedia/a3ba58b2856039a133df6cbf8dbda1ae76ab404911eb4aa0e61a87d14a343a3cced6f71d1648636332.pdf – sor 4.03 'keramičke pločice' (2300; 1,30; μ=200)",
  "ellenorzott": true,
  "megjegyzes": "ρ = 2300 kg/m³"
 },
 {
  "id": "parketta",
  "nev": "Parketta (keményfa)",
  "kategoria": "Burkolat",
  "sraffozas": "fa",
  "lambda": 0.18,
  "mu": 200,
  "forras": "BRE BR 443 'Conventions for U-value calculations' (2019, 3. kiadás), 3. fejezet 'Thermal properties of materials and products', kb. 9–11. o. (BS EN ISO 10456 táblázatos tervezési értékeire épül; másodlagos közlés) – https://www.cibse.org/media/wzrjrf3l/conventions-for-u-value-calculations.pdf – hardwood 700 kg/m³ λ=0,18; μ: Horvát épületenergetikai műszaki előírás (valószínűleg 'Tehnički propis o racionalnoj uporabi energije i toplinskoj zaštiti u zgradama') B melléklet (Prilog B), 5. táblázat 'Projektne vrijednosti toplinske provodljivosti λ i ... µ' – a dokumentumon cím/dátum nem látszik; értékei az EN ISO 10456 / EN 1745 táblázatokkal egyeznek – https://www.vguk.hr/multimedia/a3ba58b2856039a133df6cbf8dbda1ae76ab404911eb4aa0e61a87d14a343a3cced6f71d1648636332.pdf sor 4.06",
  "ellenorzott": true,
  "megjegyzes": "Tömörfa értéke; laminált padlóra (HDF) nem találtam forrást. ρ = 700 kg/m³"
 },
 {
  "id": "kavics_homok",
  "nev": "Kavics / homok feltöltés (száraz, laza)",
  "kategoria": "Feltöltés",
  "sraffozas": "burkolat",
  "lambda": 0.81,
  "mu": 3,
  "forras": "Horvát épületenergetikai műszaki előírás (valószínűleg 'Tehnički propis o racionalnoj uporabi energije i toplinskoj zaštiti u zgradama') B melléklet (Prilog B), 5. táblázat 'Projektne vrijednosti toplinske provodljivosti λ i ... µ' – a dokumentumon cím/dátum nem látszik; értékei az EN ISO 10456 / EN 1745 táblázatokkal egyeznek – https://www.vguk.hr/multimedia/a3ba58b2856039a133df6cbf8dbda1ae76ab404911eb4aa0e61a87d14a343a3cced6f71d1648636332.pdf – sor 6.04 'pijesak, šljunak, tucanik' (≤1700; 0,81; μ=3)",
  "ellenorzott": true,
  "megjegyzes": "Cseh táblázat: homok 1750 → 0,95 (μ 4); kavics 1650 → 0,93. Talajként (ISO 13370) homok/kavics 2,0 – nedves talajra az a mértékadó. ρ = 1700 kg/m³"
 },
 {
  "id": "salak_feltoltes",
  "nev": "Salakfeltöltés",
  "kategoria": "Feltöltés",
  "sraffozas": "burkolat",
  "lambda": 0.27,
  "mu": 3,
  "forras": "tzb-info.cz 'Hodnoty fyzikálních veličin vybraných stavebních materiálů' (forrás: Laboutka–Suchánek: Výpočtové tabulky pro vytápění, 2001; hivatkozott irodalom ČSN 73 0540-3:1995), λp érték – https://www.tzb-info.cz/tabulky-a-vypocty/58-hodnoty-fyzikalnich-velicin-vybranych-stavebnich-materialu – sor 142 'škvára, násyp' (750; 0,27; μ=3)",
  "ellenorzott": false,
  "megjegyzes": "Cseh, régebbi λp érték; MSZ-04-140 értéket nem találtam. ρ = 750 kg/m³"
 },
 {
  "id": "foldfeltoltes",
  "nev": "Agyag / föld feltöltés (padlás, száraz)",
  "kategoria": "Feltöltés",
  "sraffozas": "burkolat",
  "lambda": 0.7,
  "mu": 1.5,
  "forras": "tzb-info.cz 'Hodnoty fyzikálních veličin vybraných stavebních materiálů' (forrás: Laboutka–Suchánek: Výpočtové tabulky pro vytápění, 2001; hivatkozott irodalom ČSN 73 0540-3:1995), λp érték – https://www.tzb-info.cz/tabulky-a-vypocty/58-hodnoty-fyzikalnich-velicin-vybranych-stavebnich-materialu – sor 201 'hlína suchá' (1600; 0,7; μ=1,5)",
  "ellenorzott": false,
  "megjegyzes": "Száraz földre vonatkozó cseh érték, padlásfeltöltés közelítése. ρ = 1600 kg/m³"
 },
 {
  "id": "bitumenes_lemez",
  "nev": "Bitumenes lemez (betétes)",
  "kategoria": "Fólia",
  "sraffozas": "folia",
  "lambda": 0.23,
  "mu": 50000,
  "forras": "Horvát épületenergetikai műszaki előírás (valószínűleg 'Tehnički propis o racionalnoj uporabi energije i toplinskoj zaštiti u zgradama') B melléklet (Prilog B), 5. táblázat 'Projektne vrijednosti toplinske provodljivosti λ i ... µ' – a dokumentumon cím/dátum nem látszik; értékei az EN ISO 10456 / EN 1745 táblázatokkal egyeznek – https://www.vguk.hr/multimedia/a3ba58b2856039a133df6cbf8dbda1ae76ab404911eb4aa0e61a87d14a343a3cced6f71d1648636332.pdf – sor 5.01 'bitumenska traka s uloškom' (1100; 0,23; μ=50000)",
  "ellenorzott": true,
  "megjegyzes": "ρ = 1100 kg/m³"
 },
 {
  "id": "pe_folia",
  "nev": "PE fólia / párazáró fólia",
  "kategoria": "Fólia",
  "sraffozas": "folia",
  "lambda": 0.19,
  "mu": 50000,
  "forras": "Horvát épületenergetikai műszaki előírás (valószínűleg 'Tehnički propis o racionalnoj uporabi energije i toplinskoj zaštiti u zgradama') B melléklet (Prilog B), 5. táblázat 'Projektne vrijednosti toplinske provodljivosti λ i ... µ' – a dokumentumon cím/dátum nem látszik; értékei az EN ISO 10456 / EN 1745 táblázatokkal egyeznek – https://www.vguk.hr/multimedia/a3ba58b2856039a133df6cbf8dbda1ae76ab404911eb4aa0e61a87d14a343a3cced6f71d1648636332.pdf – sor 5.12 'PE folija' (1000; 0,19; μ=50000)",
  "ellenorzott": true,
  "megjegyzes": "Párazáróként a gyártói sd-érték a mértékadó; R elhanyagolható. Tetőfólia (páraáteresztő): R elhanyagolható, külön adatot nem gyűjtöttem. ρ = 1000 kg/m³"
 }
];

/** A tanúsító által megadott tájékoztató λ-táblázat (régi és hazai falazó-, födém- és burkolóanyagok). */
export const TAJEKOZTATO_ANYAGOK: Anyag[] = [
 {
  "id": "tt_valyogfalazat",
  "nev": "Vályogfalazat",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.7,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_falburkolo_tegla",
  "nev": "Falburkoló tégla",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.93,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_poroton_falazat",
  "nev": "Poroton falazat",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.31,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_gazszilikat_falazat_630_kg_m3",
  "nev": "Gázszilikát falazat (ρ = 630 kg/m3)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.27,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_gazszilikat_falazat_615_kg_m3",
  "nev": "Gázszilikát falazat (ρ = 615 kg/m3)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.34,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_alfa_falazat",
  "nev": "Alfa falazat",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.42,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_raba_falazat_v_25_cm",
  "nev": "Rába falazat (v = 25 cm)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.4,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_raba_falazat_v_38_cm",
  "nev": "Rába falazat (v = 38 cm)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.35,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_kismeretu_tomor_tegla",
  "nev": "Kisméretű tömör tégla",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.78,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_soklyuku_tegla_falazat_c1",
  "nev": "Soklyukú tégla falazat (C1)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.5,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_keveslyuku_tegla_falazat_a_a1_a2",
  "nev": "Kevéslyukú tégla falazat (A, A1, A2)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.7,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_b_25_falazat",
  "nev": "B 25 falazat",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.49,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_b_29_falazat",
  "nev": "B 29 falazat",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.6,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_b_30_falazat",
  "nev": "B 30 falazat",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.64,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_b_30_0_falazat",
  "nev": "B 30/0 falazat",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.45,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_tufabeton_falazat_tb_50",
  "nev": "Tufabeton falazat (TB 50)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.64,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_tufabeton_falazat_tb_55",
  "nev": "Tufabeton falazat (TB 55)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.5,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_gazszilikat_hoszigetelo_lap_falazat",
  "nev": "Gázszilikát hőszigetelő lap falazat",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.24,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_termoton_falazat",
  "nev": "Termoton falazat",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.3,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_uniform_30_falazat",
  "nev": "Uniform 30 falazat",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.55,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_uniform_45_falazat",
  "nev": "Uniform 45 falazat",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.42,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_koszivacslap_falazat",
  "nev": "Kőszivacslap falazat",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.23,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_gipszperlit_falazat_700_kg_m3",
  "nev": "Gipszperlit falazat (ρ = 700 kg/m3)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.2,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_gipszperlit_falazat_900_kg_m3",
  "nev": "Gipszperlit falazat (ρ = 900 kg/m3)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.23,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_egetett_agyag_falazat",
  "nev": "Égetett agyag falazat",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.65,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_porotherm_38_s",
  "nev": "Porotherm 38 S",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.207,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_porotherm_38",
  "nev": "Porotherm 38",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.226,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_porotherm_25",
  "nev": "Porotherm 25",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.39,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_porotherm_38_n_f",
  "nev": "Porotherm 38 N+F",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.167,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_porotherm_30_n_f",
  "nev": "Porotherm 30 N+F",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.155,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_porotherm_38_pincetegla",
  "nev": "Porotherm 38 pincetégla",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.264,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_porotherm_44_hs_tm_hoszigetelo_habarccsa",
  "nev": "Porotherm 44 HS (TM hőszigetelő habarccsal)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.141,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_porotherm_44_hs_m30_vagy_m100_habarccsal",
  "nev": "Porotherm 44 HS (M30 vagy M100 habarccsal)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.166,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_porotherm_38_hs_tm_hoszigetelo_habarccsa",
  "nev": "Porotherm 38 HS (TM hőszigetelő habarccsal)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.143,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_porotherm_38_hs_m30_vagy_m100_habarccsal",
  "nev": "Porotherm 38 HS (M30 vagy M100 habarccsal)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.179,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_porotherm_30_hs_tm_hoszigetelo_habarccsa",
  "nev": "Porotherm 30 HS (TM hőszigetelő habarccsal)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.141,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_porotherm_30_hs_m30_vagy_m100_habarccsal",
  "nev": "Porotherm 30 HS (M30 vagy M100 habarccsal)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.171,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_ytong_p2_0_5",
  "nev": "Ytong P2-0,5",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.127,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_ytong_p4_0_6",
  "nev": "Ytong P4-0,6",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.148,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_ytong_vasalt_falpallo_wl_p3_3_500_kg_m3",
  "nev": "Ytong vasalt falpalló WL-P3,3 (ρ = 500 kg/m3)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.14,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_ytong_vasalt_falpallo_wl_p3_3_600_kg_m3",
  "nev": "Ytong vasalt falpalló WL-P3,3 (ρ = 600 kg/m3)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.16,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_ytong_vasalt_falpallo_wl_p4_4_500_kg_m3",
  "nev": "Ytong vasalt falpalló WL-P4,4 (ρ = 500 kg/m3)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.16,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_ytong_vasalt_falpallo_wl_p4_4_600_kg_m3",
  "nev": "Ytong vasalt falpalló WL-P4,4 (ρ = 600 kg/m3)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.21,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_zalatherm_falazat",
  "nev": "Zalatherm falazat",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.247,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_vasbeton_pallofodem_1_cm_vakolat",
  "nev": "Vasbeton pallófödém + 1 cm vakolat",
  "kategoria": "Födém",
  "sraffozas": "beton",
  "lambda": 1.2,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_vasbeton_gerendas_fodem_1_cm_vakolat",
  "nev": "Vasbeton gerendás födém + 1 cm vakolat",
  "kategoria": "Födém",
  "sraffozas": "beton",
  "lambda": 1.2,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_keramiaelemes_fodem_felbetonnal_vakolat_",
  "nev": "Kerámiaelemes födém felbetonnal, vakolat nélkül",
  "kategoria": "Födém",
  "sraffozas": "beton",
  "lambda": 0.66,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_bohn_fodem_1_cm_vakolat",
  "nev": "Bohn-födém + 1 cm vakolat",
  "kategoria": "Födém",
  "sraffozas": "beton",
  "lambda": 0.76,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_monolit_vasbeton_lemezfodem",
  "nev": "Monolit vasbeton lemezfödém",
  "kategoria": "Födém",
  "sraffozas": "beton",
  "lambda": 1.55,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_ytong_tetopallo_da_p3_3_500_kg_m3",
  "nev": "Ytong tetőpalló DA-P3,3 (ρ = 500 kg/m3)",
  "kategoria": "Födém",
  "sraffozas": "falazat",
  "lambda": 0.14,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_ytong_tetopallo_da_p3_3_600_kg_m3",
  "nev": "Ytong tetőpalló DA-P3,3 (ρ = 600 kg/m3)",
  "kategoria": "Födém",
  "sraffozas": "falazat",
  "lambda": 0.16,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_ytong_tetopallo_da_p4_4_500_kg_m3",
  "nev": "Ytong tetőpalló DA-P4,4 (ρ = 500 kg/m3)",
  "kategoria": "Födém",
  "sraffozas": "falazat",
  "lambda": 0.16,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_ytong_tetopallo_da_p4_4_600_kg_m3",
  "nev": "Ytong tetőpalló DA-P4,4 (ρ = 600 kg/m3)",
  "kategoria": "Födém",
  "sraffozas": "falazat",
  "lambda": 0.21,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_szalagparketta",
  "nev": "Szalagparketta",
  "kategoria": "Burkolat",
  "sraffozas": "burkolat",
  "lambda": 0.21,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_parketta_panel",
  "nev": "Parketta panel",
  "kategoria": "Burkolat",
  "sraffozas": "burkolat",
  "lambda": 0.2,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_tolgyfaparketta",
  "nev": "Tölgyfaparketta",
  "kategoria": "Burkolat",
  "sraffozas": "burkolat",
  "lambda": 0.22,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_hajopadlo",
  "nev": "Hajópadló",
  "kategoria": "Burkolat",
  "sraffozas": "burkolat",
  "lambda": 0.19,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_habalatetes_szonyeg",
  "nev": "Habalátétes szőnyeg",
  "kategoria": "Burkolat",
  "sraffozas": "burkolat",
  "lambda": 0.044,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_gipsz_esztrich",
  "nev": "Gipsz esztrich",
  "kategoria": "Burkolat",
  "sraffozas": "burkolat",
  "lambda": 0.23,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_kolap",
  "nev": "Kőlap",
  "kategoria": "Burkolat",
  "sraffozas": "burkolat",
  "lambda": 3.5,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_csempe",
  "nev": "Csempe",
  "kategoria": "Burkolat",
  "sraffozas": "burkolat",
  "lambda": 1.05,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_padlasburkolo_tegla",
  "nev": "Padlásburkoló tégla",
  "kategoria": "Burkolat",
  "sraffozas": "burkolat",
  "lambda": 0.5,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_meszvakolat",
  "nev": "Mészvakolat",
  "kategoria": "Vakolat",
  "sraffozas": "vakolat",
  "lambda": 0.81,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_javitott_meszvakolat",
  "nev": "Javított mészvakolat",
  "kategoria": "Vakolat",
  "sraffozas": "vakolat",
  "lambda": 0.87,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_cementvakolat",
  "nev": "Cementvakolat",
  "kategoria": "Vakolat",
  "sraffozas": "vakolat",
  "lambda": 0.93,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_nemesvakolat",
  "nev": "Nemesvakolat",
  "kategoria": "Vakolat",
  "sraffozas": "vakolat",
  "lambda": 0.99,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_perlitvakolat_800_kg_m3",
  "nev": "Perlitvakolat (ρ = 800 kg/m3)",
  "kategoria": "Vakolat",
  "sraffozas": "vakolat",
  "lambda": 0.187,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_perlitvakolat_500_kg_m3",
  "nev": "Perlitvakolat (ρ = 500 kg/m3)",
  "kategoria": "Vakolat",
  "sraffozas": "vakolat",
  "lambda": 0.174,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_perlitvakolat_350_kg_m3",
  "nev": "Perlitvakolat (ρ = 350 kg/m3)",
  "kategoria": "Vakolat",
  "sraffozas": "vakolat",
  "lambda": 0.127,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_perlithabarcs_300_kg_m3",
  "nev": "Perlithabarcs (ρ = 300 kg/m3)",
  "kategoria": "Vakolat",
  "sraffozas": "vakolat",
  "lambda": 0.12,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_perlithabarcs_400_kg_m3",
  "nev": "Perlithabarcs (ρ = 400 kg/m3)",
  "kategoria": "Vakolat",
  "sraffozas": "vakolat",
  "lambda": 0.14,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_dryvit_kvarc_putz",
  "nev": "Dryvit kvarc putz",
  "kategoria": "Vakolat",
  "sraffozas": "vakolat",
  "lambda": 1.0,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_dryvit_primus",
  "nev": "Dryvit primus",
  "kategoria": "Vakolat",
  "sraffozas": "vakolat",
  "lambda": 1.0,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_polisztirol_habarcs",
  "nev": "Polisztirol habarcs",
  "kategoria": "Vakolat",
  "sraffozas": "vakolat",
  "lambda": 0.09,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_gipszvakolat",
  "nev": "Gipszvakolat",
  "kategoria": "Vakolat",
  "sraffozas": "vakolat",
  "lambda": 0.29,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_gipszes_simitohabarcs",
  "nev": "Gipszes simítóhabarcs",
  "kategoria": "Vakolat",
  "sraffozas": "vakolat",
  "lambda": 0.52,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_terranova_vakolat",
  "nev": "Terranova vakolat",
  "kategoria": "Vakolat",
  "sraffozas": "vakolat",
  "lambda": 0.87,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_terranova_hoszigetelo_vakolat",
  "nev": "Terranova hőszigetelő vakolat",
  "kategoria": "Vakolat",
  "sraffozas": "vakolat",
  "lambda": 0.11,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_hostop_hoszigetelo_vakolat",
  "nev": "Hőstop hőszigetelő vakolat",
  "kategoria": "Vakolat",
  "sraffozas": "vakolat",
  "lambda": 0.08,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_ytong_hoszigetelo_falazohabarcs",
  "nev": "Ytong hőszigetelő falazóhabarcs",
  "kategoria": "Vakolat",
  "sraffozas": "vakolat",
  "lambda": 0.15,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_polisztirol_hab_15_kg_m3",
  "nev": "Polisztirol hab (ρ = 15 kg/m3)",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_hab",
  "lambda": 0.04,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_polisztirol_hab_20_kg_m3",
  "nev": "Polisztirol hab (ρ = 20 kg/m3)",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_hab",
  "lambda": 0.042,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_nikecell_s",
  "nev": "Nikecell S",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_hab",
  "lambda": 0.047,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_poliuretan_kemenyhab",
  "nev": "Poliuretán keményhab",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_hab",
  "lambda": 0.034,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_poliuretan_lagyhab",
  "nev": "Poliuretán lágyhab",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_hab",
  "lambda": 0.045,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_asvanygyapot_100_kg_m3",
  "nev": "Ásványgyapot (ρ = 100 kg/m3)",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_szalas",
  "lambda": 0.042,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_asvanygyapot_150_kg_m3",
  "nev": "Ásványgyapot (ρ = 150 kg/m3)",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_szalas",
  "lambda": 0.044,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_isolyth_l_panel",
  "nev": "Isolyth L panel",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_hab",
  "lambda": 0.1,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_uveggyapot_200_kg_m3",
  "nev": "Üveggyapot (ρ = 200 kg/m3)",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_szalas",
  "lambda": 0.058,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_habuveg_350_kg_m3",
  "nev": "Habüveg (ρ = 350 kg/m3)",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_hab",
  "lambda": 0.093,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": false,
  "megjegyzes": "Az eredeti táblázatban 0,93 szerepel – nyilvánvaló elírás (a 400 kg/m³-es habüveg 0,105), 0,093-mal vettük fel."
 },
 {
  "id": "tt_habuveg_400_kg_m3",
  "nev": "Habüveg (ρ = 400 kg/m3)",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_hab",
  "lambda": 0.105,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_koszivacslap_750_kg_m3",
  "nev": "Kőszivacslap (ρ = 750 kg/m3)",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_hab",
  "lambda": 0.174,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_koszivacslap_1100_kg_m3",
  "nev": "Kőszivacslap (ρ = 1100 kg/m3)",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_hab",
  "lambda": 0.35,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_perlitbeton",
  "nev": "Perlitbeton",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_hab",
  "lambda": 0.068,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_termonit_hab",
  "nev": "Termonit hab",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_hab",
  "lambda": 0.034,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_expanzit_parafalemez",
  "nev": "Expanzit parafalemez",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_szalas",
  "lambda": 0.046,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_ytong_koszoruelem_pke",
  "nev": "Ytong koszorúelem PKE",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_hab",
  "lambda": 0.13,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_ytong_koszoruelem_pke_uveggyapot",
  "nev": "Ytong koszorúelem PKE üveggyapot",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_szalas",
  "lambda": 0.038,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_vasbeton",
  "nev": "Vasbeton",
  "kategoria": "Beton",
  "sraffozas": "beton",
  "lambda": 1.55,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_kavicsbeton",
  "nev": "Kavicsbeton",
  "kategoria": "Beton",
  "sraffozas": "beton",
  "lambda": 1.28,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_kohosalakbeton_1400_kg_m3",
  "nev": "Kohósalakbeton (ρ = 1400 kg/m3)",
  "kategoria": "Beton",
  "sraffozas": "beton",
  "lambda": 0.47,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_kohosalakbeton_1600_kg_m3",
  "nev": "Kohósalakbeton (ρ = 1600 kg/m3)",
  "kategoria": "Beton",
  "sraffozas": "beton",
  "lambda": 0.58,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_kazansalakbeton_1400_kg_m3",
  "nev": "Kazánsalakbeton (ρ = 1400 kg/m3)",
  "kategoria": "Beton",
  "sraffozas": "beton",
  "lambda": 0.56,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_kazansalakbeton_1600_kg_m3",
  "nev": "Kazánsalakbeton (ρ = 1600 kg/m3)",
  "kategoria": "Beton",
  "sraffozas": "beton",
  "lambda": 0.7,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_bitumenperlit_300_kg_m3",
  "nev": "Bitumenperlit (ρ = 300 kg/m3)",
  "kategoria": "Beton",
  "sraffozas": "beton",
  "lambda": 0.09,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_bitumenperlit_400_kg_m3",
  "nev": "Bitumenperlit (ρ = 400 kg/m3)",
  "kategoria": "Beton",
  "sraffozas": "beton",
  "lambda": 0.12,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_perlitbeton_300_kg_m3",
  "nev": "Perlitbeton (ρ = 300 kg/m3)",
  "kategoria": "Beton",
  "sraffozas": "beton",
  "lambda": 0.12,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_perlitbeton_400_kg_m3",
  "nev": "Perlitbeton (ρ = 400 kg/m3)",
  "kategoria": "Beton",
  "sraffozas": "beton",
  "lambda": 0.14,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_perlitbeton_500_kg_m3",
  "nev": "Perlitbeton (ρ = 500 kg/m3)",
  "kategoria": "Beton",
  "sraffozas": "beton",
  "lambda": 0.16,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_perlitbeton_600_kg_m3",
  "nev": "Perlitbeton (ρ = 600 kg/m3)",
  "kategoria": "Beton",
  "sraffozas": "beton",
  "lambda": 0.2,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_polisztirolbeton_250_kg_m3",
  "nev": "Polisztirolbeton (ρ = 250 kg/m3)",
  "kategoria": "Beton",
  "sraffozas": "beton",
  "lambda": 0.08,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_polisztirolbeton_300_kg_m3",
  "nev": "Polisztirolbeton (ρ = 300 kg/m3)",
  "kategoria": "Beton",
  "sraffozas": "beton",
  "lambda": 0.1,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_polisztirolbeton_350_kg_m3",
  "nev": "Polisztirolbeton (ρ = 350 kg/m3)",
  "kategoria": "Beton",
  "sraffozas": "beton",
  "lambda": 0.12,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_egyszemcses_kozuzalekbeton",
  "nev": "Egyszemcsés kőzúzalékbeton",
  "kategoria": "Beton",
  "sraffozas": "beton",
  "lambda": 0.76,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_homokfeltoltes",
  "nev": "Homokfeltöltés",
  "kategoria": "Feltöltés",
  "sraffozas": "burkolat",
  "lambda": 0.58,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_kavicsfeltoltes",
  "nev": "Kavicsfeltöltés",
  "kategoria": "Feltöltés",
  "sraffozas": "burkolat",
  "lambda": 0.35,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_kazansalak_feltoltes",
  "nev": "Kazánsalak feltöltés",
  "kategoria": "Feltöltés",
  "sraffozas": "burkolat",
  "lambda": 0.29,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_kohosalak_feltoltes",
  "nev": "Kohósalak feltöltés",
  "kategoria": "Feltöltés",
  "sraffozas": "burkolat",
  "lambda": 0.45,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_duzzasztott_perlit_110_kg_m3",
  "nev": "Duzzasztott perlit (ρ = 110 kg/m3)",
  "kategoria": "Feltöltés",
  "sraffozas": "burkolat",
  "lambda": 0.052,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_duzzasztott_perlit_130_kg_m3",
  "nev": "Duzzasztott perlit (ρ = 130 kg/m3)",
  "kategoria": "Feltöltés",
  "sraffozas": "burkolat",
  "lambda": 0.058,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_vizzel_toltott_perlit",
  "nev": "Vízzel töltött perlit",
  "kategoria": "Feltöltés",
  "sraffozas": "burkolat",
  "lambda": 0.08,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_fenyofa_400_kg_m3",
  "nev": "Fenyőfa (ρ = 400 kg/m3)",
  "kategoria": "Fa",
  "sraffozas": "fa",
  "lambda": 0.13,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_fenyofa_550_kg_m3",
  "nev": "Fenyőfa (ρ = 550 kg/m3)",
  "kategoria": "Fa",
  "sraffozas": "fa",
  "lambda": 0.19,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_tolgyfa",
  "nev": "Tölgyfa",
  "kategoria": "Fa",
  "sraffozas": "fa",
  "lambda": 0.22,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_farostlemez",
  "nev": "Farostlemez",
  "kategoria": "Fa",
  "sraffozas": "fa",
  "lambda": 0.1,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_gipszkarton_lemez",
  "nev": "Gipszkarton lemez",
  "kategoria": "Fa",
  "sraffozas": "fa",
  "lambda": 0.23,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_faforgacslap_650_kg_m3",
  "nev": "Faforgácslap (ρ = 650 kg/m3)",
  "kategoria": "Fa",
  "sraffozas": "fa",
  "lambda": 0.16,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_faforgacslap_650_kg_m3_2",
  "nev": "Faforgácslap (ρ = 650 kg/m3)",
  "kategoria": "Fa",
  "sraffozas": "fa",
  "lambda": 0.19,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true,
  "megjegyzes": "A táblázatban azonos sűrűséggel két érték szerepel (0,16 és 0,19)."
 },
 {
  "id": "tt_karton_papir_lemez",
  "nev": "Karton (papír) lemez",
  "kategoria": "Fa",
  "sraffozas": "fa",
  "lambda": 0.17,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_azbesztcement_lemez_1800_kg_m3",
  "nev": "Azbesztcement lemez (ρ = 1800 kg/m3)",
  "kategoria": "Fa",
  "sraffozas": "fa",
  "lambda": 0.42,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_azbesztcement_lemez_2000_kg_m3",
  "nev": "Azbesztcement lemez (ρ = 2000 kg/m3)",
  "kategoria": "Fa",
  "sraffozas": "fa",
  "lambda": 0.45,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_betonyp_faforgacslap",
  "nev": "Betonyp faforgácslap",
  "kategoria": "Fa",
  "sraffozas": "fa",
  "lambda": 0.26,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_aluminium_lemez",
  "nev": "Alumínium lemez",
  "kategoria": "Egyéb",
  "sraffozas": "burkolat",
  "lambda": 170.0,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_gumi",
  "nev": "Gumi",
  "kategoria": "Egyéb",
  "sraffozas": "burkolat",
  "lambda": 0.15,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_linoleum",
  "nev": "Linóleum",
  "kategoria": "Egyéb",
  "sraffozas": "burkolat",
  "lambda": 0.38,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_nadlemez",
  "nev": "Nádlemez",
  "kategoria": "Egyéb",
  "sraffozas": "burkolat",
  "lambda": 0.06,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 },
 {
  "id": "tt_tablauveg",
  "nev": "Táblaüveg",
  "kategoria": "Egyéb",
  "sraffozas": "burkolat",
  "lambda": 0.76,
  "forras": "Tájékoztató λ-táblázat (a tanúsító saját „lambda-értékek” táblázata; hazai szakirodalmi, MSZ-04-140 korabeli értékek)",
  "ellenorzott": true
 }
];

ALAP_ANYAGOK.push(...BOVITETT_ANYAGOK, ...TAJEKOZTATO_ANYAGOK);
