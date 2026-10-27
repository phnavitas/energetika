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
  "id": "hdpe_vizszig_lemez",
  "nev": "HDPE vízszigetelő lemez, visszatapadó (pl. Grace Preprufe 300R)",
  "kategoria": "Fólia",
  "sraffozas": "folia",
  "lambda": 0.5,
  "mu": 50000,
  "forras": "Horvát épületenergetikai műszaki előírás (valószínűleg 'Tehnički propis o racionalnoj uporabi energije i toplinskoj zaštiti u zgradama') B melléklet (Prilog B), 5. táblázat 'Projektne vrijednosti toplinske provodljivosti λ i ... µ' – a dokumentumon cím/dátum nem látszik; értékei az EN ISO 10456 / EN 1745 táblázatokkal egyeznek – https://www.vguk.hr/multimedia/a3ba58b2856039a133df6cbf8dbda1ae76ab404911eb4aa0e61a87d14a343a3cced6f71d1648636332.pdf – sor 5.11 'polietilen visoke gustoće (PEHD)' (ρ=1600; λ=0,50; μ=50000)",
  "ellenorzott": true,
  "megjegyzes": "A gyártó (Preprufe 300R adatlap) λ-t nem deklarál – az anyagra vonatkozó táblázatos tervezési érték. Vastagsága ~1,2 mm, hőtechnikailag elhanyagolható. ρ = 1600 kg/m³"
 },
 {
  "id": "pvc_vizszig_lemez",
  "nev": "PVC-P vízszigetelő lemez (lapostető, gyökérálló)",
  "kategoria": "Fólia",
  "sraffozas": "folia",
  "lambda": 0.14,
  "mu": 100000,
  "forras": "Horvát épületenergetikai műszaki előírás (valószínűleg 'Tehnički propis o racionalnoj uporabi energije i toplinskoj zaštiti u zgradama') B melléklet (Prilog B), 5. táblázat 'Projektne vrijednosti toplinske provodljivosti λ i ... µ' – a dokumentumon cím/dátum nem látszik; értékei az EN ISO 10456 / EN 1745 táblázatokkal egyeznek – https://www.vguk.hr/multimedia/a3ba58b2856039a133df6cbf8dbda1ae76ab404911eb4aa0e61a87d14a343a3cced6f71d1648636332.pdf – sor 5.05 'PVC-P' (ρ=1200; λ=0,14; μ=100000)",
  "ellenorzott": true,
  "megjegyzes": "Táblázatos érték; konkrét termék μ-je ettől eltérhet (gyártói adatlap). ρ = 1200 kg/m³"
 },
 {
  "id": "fpo_vizszig_lemez",
  "nev": "FPO / TPO vízszigetelő lemez, visszatapadó (pl. SikaProof A)",
  "kategoria": "Fólia",
  "sraffozas": "folia",
  "lambda": 0.26,
  "mu": 90000,
  "forras": "Horvát épületenergetikai műszaki előírás (valószínűleg 'Tehnički propis o racionalnoj uporabi energije i toplinskoj zaštiti u zgradama') B melléklet (Prilog B), 5. táblázat 'Projektne vrijednosti toplinske provodljivosti λ i ... µ' – a dokumentumon cím/dátum nem látszik; értékei az EN ISO 10456 / EN 1745 táblázatokkal egyeznek – https://www.vguk.hr/multimedia/a3ba58b2856039a133df6cbf8dbda1ae76ab404911eb4aa0e61a87d14a343a3cced6f71d1648636332.pdf – sor 5.10 'FPO/TPO' (ρ=1600; λ=0,26; μ=90000)",
  "ellenorzott": true,
  "megjegyzes": "A gyártó (SikaProof A teljesítménynyilatkozat, EN 13967) λ-t nem deklarál – a flexibilis poliolefin lemez táblázatos tervezési értéke. Hőtechnikailag elhanyagolható. ρ = 1600 kg/m³"
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

/** Gyártói adatlapokból / teljesítménynyilatkozatokból gyűjtött falazatok és hőszigetelések (2026. október). Az „ellenorzott: false”
 * tételeknél a termék–érték párosítás a forrásban nem volt egyértelmű – ellenőrizendő. */
export const GYARTOI_ANYAGOK: Anyag[] = [
 {
  "id": "pth30_xtherm_rapid",
  "nev": "Porotherm 30 X-therm Rapid falazat (Dryx ragasztóhab / PTH Rapid vékonyágyazó habarcs)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.09,
  "mu": 5,
  "forras": "Wienerberger: Porotherm Alkalmazási és tervezési útmutató 2025/01 (36. kiadás, érv. 2025.03.17-től), összefoglaló táblázatok 16–20. o., λ = egyenértékű hővezetési tényező vakolatlan falra (λ terv), U vakolt falra – https://www.lambda.hu/laravel-filemanager/files/1/M%C3%A1rk%C3%A1k/Porotherm/katalogus/Porotherm_Alkalmaz%C3%A1stechnika_20250317%20(1)%20(1).pdf – Comfort tábla 17. o.: Dryx 0,089; Rapid vékonyrétegű habarcs 0,090 W/mK; U 0,27",
  "ellenorzott": true,
  "megjegyzes": "Dryx ragasztóhabbal λ=0,089, PTH Rapid vékonyágyazó habarccsal λ=0,090 (a nagyobbat adtam meg). U (vakolt) = 0,27 W/m²K. λ10,dry tégla 0,090. μ=5/10. ρ=740 kg/m³. 25 cm-es X-therm nem szerepel a kínálatban."
 },
 {
  "id": "pth30_xtherm_m5l",
  "nev": "Porotherm 30 X-therm falazat (M5L hőszigetelő habarccsal)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.091,
  "mu": 5,
  "forras": "Wienerberger: Porotherm Alkalmazási és tervezési útmutató 2025/01 (36. kiadás, érv. 2025.03.17-től), összefoglaló táblázatok 16–20. o., λ = egyenértékű hővezetési tényező vakolatlan falra (λ terv), U vakolt falra – https://www.lambda.hu/laravel-filemanager/files/1/M%C3%A1rk%C3%A1k/Porotherm/katalogus/Porotherm_Alkalmaz%C3%A1stechnika_20250317%20(1)%20(1).pdf – Comfort tábla 17. o.: M5L hőszigetelő falazóhabarccsal λ 0,091; U 0,27",
  "ellenorzott": true,
  "megjegyzes": "Hagyományos (nem csiszolt) változat, M5L habarccsal. Normál (M2,5G/M10G) habarcsra a táblázat nem ad értéket – ne falazzuk normál habarccsal. μ=5/10. ρ=740 kg/m³."
 },
 {
  "id": "pth38_xtherm_rapid",
  "nev": "Porotherm 38 X-therm Rapid falazat (Dryx / PTH Rapid vékonyágyazó habarcs)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.1,
  "mu": 5,
  "forras": "Wienerberger: Porotherm Alkalmazási és tervezési útmutató 2025/01 (36. kiadás, érv. 2025.03.17-től), összefoglaló táblázatok 16–20. o., λ = egyenértékű hővezetési tényező vakolatlan falra (λ terv), U vakolt falra – https://www.lambda.hu/laravel-filemanager/files/1/M%C3%A1rk%C3%A1k/Porotherm/katalogus/Porotherm_Alkalmaz%C3%A1stechnika_20250317%20(1)%20(1).pdf – Comfort tábla 17. o.: Dryx 0,099; Rapid habarcs 0,100 W/mK; U 0,24",
  "ellenorzott": true,
  "megjegyzes": "Dryx λ=0,099, vékonyágyazó habarcs λ=0,100. U (vakolt) = 0,24. λ10,dry tégla 0,100. μ=5/10. ρ=740 kg/m³. (38 X-therm M5L 0,101 már a könyvtárban.)"
 },
 {
  "id": "pth44_xtherm_m5l",
  "nev": "Porotherm 44 X-therm falazat (M5L hőszigetelő habarccsal)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.1,
  "mu": 5,
  "forras": "Wienerberger: Porotherm Alkalmazási és tervezési útmutató 2025/01 (36. kiadás, érv. 2025.03.17-től), összefoglaló táblázatok 16–20. o., λ = egyenértékű hővezetési tényező vakolatlan falra (λ terv), U vakolt falra – https://www.lambda.hu/laravel-filemanager/files/1/M%C3%A1rk%C3%A1k/Porotherm/katalogus/Porotherm_Alkalmaz%C3%A1stechnika_20250317%20(1)%20(1).pdf – Comfort tábla 17. o.: M5L hőszigetelő habarccsal λ 0,1; U 0,21",
  "ellenorzott": true,
  "megjegyzes": "U (vakolt) = 0,21. λ10,dry tégla 0,099. μ=5/10. ρ=740 kg/m³."
 },
 {
  "id": "pth50_xtherm_rapid",
  "nev": "Porotherm 50 X-therm Rapid falazat (Dryx / PTH Rapid vékonyágyazó habarcs)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.087,
  "mu": 5,
  "forras": "Wienerberger: Porotherm Alkalmazási és tervezési útmutató 2025/01 (36. kiadás, érv. 2025.03.17-től), összefoglaló táblázatok 16–20. o., λ = egyenértékű hővezetési tényező vakolatlan falra (λ terv), U vakolt falra – https://www.lambda.hu/laravel-filemanager/files/1/M%C3%A1rk%C3%A1k/Porotherm/katalogus/Porotherm_Alkalmaz%C3%A1stechnika_20250317%20(1)%20(1).pdf – Comfort tábla 17. o.: Dryx 0,087; Rapid habarcs 0,087; U 0,17",
  "ellenorzott": true,
  "megjegyzes": "U (vakolt) = 0,17. λ10,dry tégla 0,082. μ=5/10. ρ=680 kg/m³. M5L-es változat nincs."
 },
 {
  "id": "pth_thermo_rapid_dryx",
  "nev": "Porotherm 38 / 44 / 50 Thermo Rapid falazat (Dryx ragasztóhabbal)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.064,
  "mu": 5,
  "forras": "Wienerberger: Porotherm Alkalmazási és tervezési útmutató 2025/01 (36. kiadás, érv. 2025.03.17-től), összefoglaló táblázatok 16–20. o., λ = egyenértékű hővezetési tényező vakolatlan falra (λ terv), U vakolt falra – https://www.lambda.hu/laravel-filemanager/files/1/M%C3%A1rk%C3%A1k/Porotherm/katalogus/Porotherm_Alkalmaz%C3%A1stechnika_20250317%20(1)%20(1).pdf – Energy+ tábla 16. o.: Dryx extra ragasztóhabbal λ 0,064 (mindhárom vastagságra); U 0,16 / 0,14 / 0,12",
  "ellenorzott": true,
  "megjegyzes": "Ásványgyapottal töltött tégla. U (vakolt): 38 cm 0,16; 44 cm 0,14; 50 cm 0,12 W/m²K. μ=5/10. ρ: a 16. o. 670, a 21–22. o. 620 kg/m³ (ellentmondás a dokumentumban)."
 },
 {
  "id": "pth_thermo_rapid_dbm",
  "nev": "Porotherm 38 / 44 / 50 Thermo Rapid falazat (PTH Rapid vékonyágyazó habarccsal)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.066,
  "mu": 5,
  "forras": "Wienerberger: Porotherm Alkalmazási és tervezési útmutató 2025/01 (36. kiadás, érv. 2025.03.17-től), összefoglaló táblázatok 16–20. o., λ = egyenértékű hővezetési tényező vakolatlan falra (λ terv), U vakolt falra – https://www.lambda.hu/laravel-filemanager/files/1/M%C3%A1rk%C3%A1k/Porotherm/katalogus/Porotherm_Alkalmaz%C3%A1stechnika_20250317%20(1)%20(1).pdf – Energy+ tábla 16. o.: Rapid vékonyrétegű falazóhabarccsal λ 0,066; U 0,16 / 0,14 / 0,12",
  "ellenorzott": true,
  "megjegyzes": "U (vakolt): 38 cm 0,16; 44 cm 0,14; 50 cm 0,12 W/m²K. μ=5/10."
 },
 {
  "id": "pth30_nf_neo_m25",
  "nev": "Porotherm 30 N+F neo falazat (M2,5G normál falazóhabarccsal)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.184,
  "mu": 5,
  "forras": "Wienerberger: Porotherm Alkalmazási és tervezési útmutató 2025/01 (36. kiadás, érv. 2025.03.17-től), összefoglaló táblázatok 16–20. o., λ = egyenértékű hővezetési tényező vakolatlan falra (λ terv), U vakolt falra – https://www.lambda.hu/laravel-filemanager/files/1/M%C3%A1rk%C3%A1k/Porotherm/katalogus/Porotherm_Alkalmaz%C3%A1stechnika_20250317%20(1)%20(1).pdf – Classic tábla 18. o.: M2,5G 0,184 / M5L 0,149; U 0,54 / 0,45",
  "ellenorzott": false,
  "megjegyzes": "A meglévő „Porotherm 30 N+F neo” tétel (0,148) a Dryx/M5L-értéknek felel meg; normál habarccsal 0,184! Rapid: Dryx 0,148, DBM 0,149. μ=5/10. ρ=670 kg/m³."
 },
 {
  "id": "pth25_nf_neo_rapid",
  "nev": "Porotherm 25 N+F neo Rapid falazat (Dryx / vékonyágyazó habarcs)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.27,
  "mu": 5,
  "forras": "Wienerberger: Porotherm Alkalmazási és tervezési útmutató 2025/01 (36. kiadás, érv. 2025.03.17-től), összefoglaló táblázatok 16–20. o., λ = egyenértékű hővezetési tényező vakolatlan falra (λ terv), U vakolt falra – https://www.lambda.hu/laravel-filemanager/files/1/M%C3%A1rk%C3%A1k/Porotherm/katalogus/Porotherm_Alkalmaz%C3%A1stechnika_20250317%20(1)%20(1).pdf – Classic tábla 18. o.: Dryx 0,27, DBM 0,27; U 0,88/0,89",
  "ellenorzott": false,
  "megjegyzes": "A 21. o. a Dryx U-értékét 0,97-nek adja (dokumentumon belüli ellentmondás). λ10,dry tégla 0,26. μ=5/10. ρ=670 kg/m³."
 },
 {
  "id": "pth25_nf_neo_m25",
  "nev": "Porotherm 25 N+F neo falazat (M2,5G normál falazóhabarccsal)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.3,
  "mu": 5,
  "forras": "Wienerberger: Porotherm Alkalmazási és tervezési útmutató 2025/01 (36. kiadás, érv. 2025.03.17-től), összefoglaló táblázatok 16–20. o., λ = egyenértékű hővezetési tényező vakolatlan falra (λ terv), U vakolt falra – https://www.lambda.hu/laravel-filemanager/files/1/M%C3%A1rk%C3%A1k/Porotherm/katalogus/Porotherm_Alkalmaz%C3%A1stechnika_20250317%20(1)%20(1).pdf – Classic tábla 18. o.: M2,5G 0,30 / M5L 0,27; U 0,96 / 0,87",
  "ellenorzott": false,
  "megjegyzes": "M5L hőszigetelő habarccsal λ=0,27. μ=5/10. ρ=670 kg/m³."
 },
 {
  "id": "pth38_pince_m25",
  "nev": "Porotherm 38 pincetégla falazat (M2,5G normál falazóhabarccsal)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.28,
  "mu": 5,
  "forras": "Wienerberger: Porotherm Alkalmazási és tervezési útmutató 2025/01 (36. kiadás, érv. 2025.03.17-től), összefoglaló táblázatok 16–20. o., λ = egyenértékű hővezetési tényező vakolatlan falra (λ terv), U vakolt falra – https://www.lambda.hu/laravel-filemanager/files/1/M%C3%A1rk%C3%A1k/Porotherm/katalogus/Porotherm_Alkalmaz%C3%A1stechnika_20250317%20(1)%20(1).pdf – Classic tábla 18. o.: M2,5G 0,28 / M5L 0,26; U 0,64 / 0,60",
  "ellenorzott": false,
  "megjegyzes": "M5L habarccsal λ=0,26. λ10,dry tégla 0,252. μ=5/10. ρ=740 kg/m³."
 },
 {
  "id": "pth20_nf_m25",
  "nev": "Porotherm 20 N+F falazat (M2,5G normál falazóhabarccsal)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.33,
  "mu": 5,
  "forras": "Wienerberger: Porotherm Alkalmazási és tervezési útmutató 2025/01 (36. kiadás, érv. 2025.03.17-től), összefoglaló táblázatok 16–20. o., λ = egyenértékű hővezetési tényező vakolatlan falra (λ terv), U vakolt falra – https://www.lambda.hu/laravel-filemanager/files/1/M%C3%A1rk%C3%A1k/Porotherm/katalogus/Porotherm_Alkalmaz%C3%A1stechnika_20250317%20(1)%20(1).pdf – Belső falak tábla 19. o.: M2,5G 0,33; U 1,24; Rapid (Dryx/DBM) 0,31",
  "ellenorzott": false,
  "megjegyzes": "Rapid (Dryx/DBM) változat λ=0,31. μ=5/10. ρ=750 kg/m³."
 },
 {
  "id": "pth10_nf_neo_m25",
  "nev": "Porotherm 10 N+F neo válaszfal (M2,5G normál falazóhabarccsal)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.33,
  "mu": 5,
  "forras": "Wienerberger: Porotherm Alkalmazási és tervezési útmutató 2025/01 (36. kiadás, érv. 2025.03.17-től), összefoglaló táblázatok 16–20. o., λ = egyenértékű hővezetési tényező vakolatlan falra (λ terv), U vakolt falra – https://www.lambda.hu/laravel-filemanager/files/1/M%C3%A1rk%C3%A1k/Porotherm/katalogus/Porotherm_Alkalmaz%C3%A1stechnika_20250317%20(1)%20(1).pdf – Belső falak tábla 19. o.: hagyományos M2,5G 0,33; Rapid Dryx/DBM 0,30",
  "ellenorzott": false,
  "megjegyzes": "Rapid (Dryx/DBM) λ=0,30. 12 cm-es Porotherm válaszfal a 2025-ös útmutatóban nem szerepel. μ=5/10. ρ=700 kg/m³."
 },
 {
  "id": "pth30_akuz",
  "nev": "Porotherm 30 AKU Z hanggátló falazat (M2,5G habarccsal)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.32,
  "forras": "Wienerberger: Porotherm Alkalmazási és tervezési útmutató 2025/01 (36. kiadás, érv. 2025.03.17-től), összefoglaló táblázatok 16–20. o., λ = egyenértékű hővezetési tényező vakolatlan falra (λ terv), U vakolt falra – https://www.lambda.hu/laravel-filemanager/files/1/M%C3%A1rk%C3%A1k/Porotherm/katalogus/Porotherm_Alkalmaz%C3%A1stechnika_20250317%20(1)%20(1).pdf – Hanggátló tábla 20. o.: λ 0,32; Rw 56 dB",
  "ellenorzott": false,
  "megjegyzes": "Hanggátló (lakáselválasztó) tégla. 25 AKU Z: λ=0,263. 20 SONO (ρ=2210): λ=1,46. ρ=1000 kg/m³. μ a táblázatban nem egyértelműen hozzárendelhető."
 },
 {
  "id": "pth32_alfa_thermo",
  "nev": "Porotherm 32 Alfa Thermo Rapid falazat (Dryx / DBM)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.08,
  "forras": "Wienerberger: Porotherm Alkalmazási és tervezési útmutató 2025/01 (36. kiadás, érv. 2025.03.17-től), összefoglaló táblázatok 16–20. o., λ = egyenértékű hővezetési tényező vakolatlan falra (λ terv), U vakolt falra – https://www.lambda.hu/laravel-filemanager/files/1/M%C3%A1rk%C3%A1k/Porotherm/katalogus/Porotherm_Alkalmaz%C3%A1stechnika_20250317%20(1)%20(1).pdf – Kiegészítő tábla 20. o.: λ 0,08; U 0,23",
  "ellenorzott": false,
  "megjegyzes": "ρ=725 kg/m³. Ugyanitt PTH 30 Alfa Rapid: λ=0,067, U=0,21, ρ=650 (érdemes adatlappal ellenőrizni)."
 },
 {
  "id": "leierplan44_iso",
  "nev": "LeierPLAN 44 iSO falazat (ásványgyapot töltésű, LeierFIX hab / LeierPLAN vékonyágyazó habarcs)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.073,
  "forras": "Leier Hungária: Leier tégla kiadvány 2026 (web) – https://www.leier.hu/uploads/files/Leier_tegla_kiadvany_2026-web-6a69f3a649734.pdf – 9. o.: λ terv,fal 0,073; U 0,16; ρ 645. Megerősítve: Leier termékadatlap – https://u-ertek-kalkulator.leier.hu/downloadmanager/download/nohtml/1/id/1941",
  "ellenorzott": true,
  "megjegyzes": "U terv,fal = 0,16 W/m²K. ρ bruttó = 645 kg/m³. μ nincs megadva."
 },
 {
  "id": "leierplan50_pro",
  "nev": "LeierPLAN 50 Pro falazat (LeierPLAN vékonyágyazó habarcs / LeierFIX)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.109,
  "mu": 5,
  "forras": "Leier: LeierPLAN 50 Pro adatlap – λ terv,fal 0,109; λ10,dry 0,105; U 0,20; μ 5/10 – https://leier.hu/uploads/files/LeierPLAN_50_Pro_adatlap.pdf",
  "ellenorzott": true,
  "megjegyzes": "U=0,20 W/m²K (belül 1,5 cm gipszes-mész, kívül 2 cm hőszigetelő vakolat λ=0,09). ρ=650 kg/m³. LeierPLAN 30/38 Pro és Leiertherm 30/38/50 Pro: a kiadványban csak a tégla λ10,dry (0,0898 / 0,0885 / 0,105) és U van – falazat-λ nem, ezért nem vettem fel."
 },
 {
  "id": "leierplan45_nf",
  "nev": "LeierPLAN 45 N+F falazat (vékonyágyazó habarcs / LeierFIX)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.138,
  "forras": "Leier Hungária: Leier tégla kiadvány 2026 (web) – https://www.leier.hu/uploads/files/Leier_tegla_kiadvany_2026-web-6a69f3a649734.pdf – 12. o., LeierPLAN N+F tábla: λU 0,138; R 3,24; U 0,29",
  "ellenorzott": false,
  "megjegyzes": "Csiszolt tégla. Táblázati R = 3,24 m²K/W (d=45 cm), U = 0,29 W/m²K. ρ = 730 kg/m³. μ nincs megadva."
 },
 {
  "id": "leierplan38_nf",
  "nev": "LeierPLAN 38 N+F falazat (vékonyágyazó habarcs / LeierFIX)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.151,
  "forras": "Leier Hungária: Leier tégla kiadvány 2026 (web) – https://www.leier.hu/uploads/files/Leier_tegla_kiadvany_2026-web-6a69f3a649734.pdf – 12. o., LeierPLAN N+F tábla: λU 0,151; R 2,52; U 0,37",
  "ellenorzott": false,
  "megjegyzes": "Csiszolt tégla. Táblázati R = 2,52 m²K/W (d=38 cm), U = 0,37 W/m²K. ρ = 635 kg/m³. μ nincs megadva."
 },
 {
  "id": "leierplan30_nf",
  "nev": "LeierPLAN 30 N+F falazat (vékonyágyazó habarcs / LeierFIX)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.16,
  "forras": "Leier Hungária: Leier tégla kiadvány 2026 (web) – https://www.leier.hu/uploads/files/Leier_tegla_kiadvany_2026-web-6a69f3a649734.pdf – 12. o., LeierPLAN N+F tábla: λU 0,16; R 1,86; U 0,49",
  "ellenorzott": false,
  "megjegyzes": "Csiszolt tégla. Táblázati R = 1,86 m²K/W (d=30 cm), U = 0,49 W/m²K. ρ = 680 kg/m³. μ nincs megadva."
 },
 {
  "id": "leierplan25_nf",
  "nev": "LeierPLAN 25 N+F falazat (vékonyágyazó habarcs / LeierFIX)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.208,
  "forras": "Leier Hungária: Leier tégla kiadvány 2026 (web) – https://www.leier.hu/uploads/files/Leier_tegla_kiadvany_2026-web-6a69f3a649734.pdf – 12. o., LeierPLAN N+F tábla: λU 0,208; R 1,19; U 0,73",
  "ellenorzott": false,
  "megjegyzes": "Csiszolt tégla. Táblázati R = 1,19 m²K/W (d=25 cm), U = 0,73 W/m²K. ρ = 615 kg/m³. μ nincs megadva."
 },
 {
  "id": "leierplan12_nf",
  "nev": "LeierPLAN 12 N+F falazat (vékonyágyazó habarcs / LeierFIX)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.216,
  "forras": "Leier Hungária: Leier tégla kiadvány 2026 (web) – https://www.leier.hu/uploads/files/Leier_tegla_kiadvany_2026-web-6a69f3a649734.pdf – 12. o., LeierPLAN N+F tábla: λU 0,216; R 0,56; U 1,23",
  "ellenorzott": false,
  "megjegyzes": "Csiszolt tégla. Táblázati R = 0,56 m²K/W (d=12 cm), U = 1,23 W/m²K. ρ = 720 kg/m³. μ nincs megadva."
 },
 {
  "id": "leierplan10_nf",
  "nev": "LeierPLAN 10 N+F falazat (vékonyágyazó habarcs / LeierFIX)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.18,
  "forras": "Leier Hungária: Leier tégla kiadvány 2026 (web) – https://www.leier.hu/uploads/files/Leier_tegla_kiadvany_2026-web-6a69f3a649734.pdf – 12. o., LeierPLAN N+F tábla: λU 0,18; R 0,55; U 1,23",
  "ellenorzott": false,
  "megjegyzes": "Csiszolt tégla. Táblázati R = 0,55 m²K/W (d=10 cm), U = 1,23 W/m²K. ρ = 720 kg/m³. μ nincs megadva. A 10 cm-es λ (0,180) kisebb, mint a 12 cm-esé – kiadványbeli érték, ellenőrizendő."
 },
 {
  "id": "leiertherm25_nf",
  "nev": "Leiertherm 25 N+F falazat (normál falazóhabarccsal, devecseri gyártás)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.206,
  "forras": "Leier Hungária: Leier tégla kiadvány 2026 (web) – https://www.leier.hu/uploads/files/Leier_tegla_kiadvany_2026-web-6a69f3a649734.pdf – 16. o., Leiertherm N+F tábla (DE / MD gyártóhely)",
  "ellenorzott": false,
  "megjegyzes": "DE (Devecser): λU 0,206, R 1,21, U 0,73, ρ 595. MD (Mátraderecske): λU 0,252, R 1,0, U 0,85, ρ 715. μ nincs megadva."
 },
 {
  "id": "leiertherm20_nf",
  "nev": "Leiertherm 20 N+F falazat (normál falazóhabarccsal, devecseri gyártás)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.266,
  "forras": "Leier Hungária: Leier tégla kiadvány 2026 (web) – https://www.leier.hu/uploads/files/Leier_tegla_kiadvany_2026-web-6a69f3a649734.pdf – 16. o., Leiertherm N+F tábla (DE / MD gyártóhely)",
  "ellenorzott": false,
  "megjegyzes": "DE (Devecser): λU 0,266, R 0,68, U 0,99, ρ 620. MD (Mátraderecske): λU 0,294, R 0,68, U 1,06, ρ 670. μ nincs megadva."
 },
 {
  "id": "leiertherm12_nf",
  "nev": "Leiertherm 12 N+F falazat (normál falazóhabarccsal, devecseri gyártás)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.247,
  "forras": "Leier Hungária: Leier tégla kiadvány 2026 (web) – https://www.leier.hu/uploads/files/Leier_tegla_kiadvany_2026-web-6a69f3a649734.pdf – 16. o., Leiertherm N+F tábla (DE / MD gyártóhely)",
  "ellenorzott": false,
  "megjegyzes": "DE (Devecser): λU 0,247, R 0,49, U 1,34, ρ 720. MD (Mátraderecske): λU 0,24, R 0,49, U 1,34, ρ 720. μ nincs megadva."
 },
 {
  "id": "leiertherm10_nf",
  "nev": "Leiertherm 10 N+F falazat (normál falazóhabarccsal, devecseri gyártás)",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.28,
  "forras": "Leier Hungária: Leier tégla kiadvány 2026 (web) – https://www.leier.hu/uploads/files/Leier_tegla_kiadvany_2026-web-6a69f3a649734.pdf – 16. o., Leiertherm N+F tábla (DE / MD gyártóhely)",
  "ellenorzott": false,
  "megjegyzes": "DE (Devecser): λU 0,28, R 0,35, U 1,63, ρ 685. MD (Mátraderecske): λU 0,321, R 0,31, U 1,75, ρ 710. μ nincs megadva."
 },
 {
  "id": "leiertherm25_objekt",
  "nev": "Leiertherm 25 Objekt falazat",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.343,
  "forras": "Leier Hungária: Leier tégla kiadvány 2026 (web) – https://www.leier.hu/uploads/files/Leier_tegla_kiadvany_2026-web-6a69f3a649734.pdf – 18. o.: λ 0,343; R 0,73; U 1,11; ρ 950",
  "ellenorzott": false,
  "megjegyzes": "Habarcstípus nincs megadva. ρ=950 kg/m³."
 },
 {
  "id": "leiertherm_keveslyuku",
  "nev": "Leiertherm kisméretű kevéslyukú tégla falazat",
  "kategoria": "Falazat",
  "sraffozas": "falazat",
  "lambda": 0.47,
  "forras": "Leier termékadatlap (létr. 2016.06.27., mód. 2021.06.18.): egyenértékű hővezetési tényező 0,470; U terv,fal 1,29 (25 cm) – https://u-ertek-kalkulator.leier.hu/content/pdf/id/541/nohtml/1 ; egyezik: Leier Hungária: Leier tégla kiadvány 2026 (web) – https://www.leier.hu/uploads/files/Leier_tegla_kiadvany_2026-web-6a69f3a649734.pdf 19. o.",
  "ellenorzott": true,
  "megjegyzes": "ρ=1420 kg/m³. μ nincs megadva."
 },
 {
  "id": "at_grafit_reflex",
  "nev": "EPS 80 grafitos homlokzati lemez – Austrotherm Grafit Reflex",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_hab",
  "lambda": 0.031,
  "mu": 20,
  "forras": "Austrotherm GRAFIT REFLEX terméklap, Alkalmazástechnika 2023 – közölt és tervezési λ 0,031; μ 20–40 – https://www.austrotherm.hu/fileadmin/user_upload/HU/Termekek/Adatlapok_2023/AUSTROTHERM_GRAFIT_REFLEX_adatlap2023.pdf",
  "ellenorzott": true,
  "megjegyzes": "EPS 80 osztály (EPS-EN 13163-T(1)-L(2)-W(2)-S(2)-P(5)-DS(70,-)1-BS125-CS(10)80-DS(N)2-TR150). μ=20–40 (alsó érték). Nem 0,030!"
 },
 {
  "id": "at_grafit150",
  "nev": "EPS 150 grafitos lemez – Austrotherm Grafit 150",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_hab",
  "lambda": 0.03,
  "mu": 30,
  "forras": "Austrotherm GRAFIT 150 terméklap 2023 – közölt és tervezési λ 0,030; μ 30–70 – https://www.austrotherm.hu/fileadmin/user_upload/HU/Termekek/Adatlapok_2023/AUSTROTHERM_GRAFIT_150_adatlap2023.pdf",
  "ellenorzott": true,
  "megjegyzes": "Padló, födém, lapostető. μ=30–70."
 },
 {
  "id": "at_n150",
  "nev": "EPS 150 nagy terhelésű lemez (fehér) – Austrotherm AT-N150",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_hab",
  "lambda": 0.034,
  "mu": 30,
  "forras": "Austrotherm AT-N150 terméklap, Alkalmazástechnika 2017 – λ (közölt és tervezési) 0,034; μ 30–70 – https://www.austrotherm.hu/fileadmin/user_upload/AUSTROTHERM_AT-N150_adatlap.pdf",
  "ellenorzott": true,
  "megjegyzes": "2017-es terméklap. Talajjal érintkező fal, járható lapostető. μ=30–70."
 },
 {
  "id": "at_n200",
  "nev": "EPS 200 nagy terhelésű lemez (fehér) – Austrotherm AT-N200",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_hab",
  "lambda": 0.033,
  "mu": 40,
  "forras": "Austrotherm AT-N200 terméklap, Alkalmazástechnika 2017 – tervezési λ 0,033; μ 40–100 – https://www.austrotherm.hu/fileadmin/user_upload/AUSTROTHERM_AT-N200_adatlap.pdf",
  "ellenorzott": true,
  "megjegyzes": "2017-es terméklap. Padló vasbeton aljzat alatt, parkolótető. μ=40–100."
 },
 {
  "id": "at_xps30_30_60",
  "nev": "XPS lemez 30–60 mm – Austrotherm XPS TOP 30 SF",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_hab",
  "lambda": 0.033,
  "mu": 100,
  "forras": "Austrotherm XPS TOP 30 SF terméklap 2023 – λ (közölt=tervezési): 30, 60 mm 0,033; 40, 50 mm 0,032; 70–120 mm 0,035; 140–160 mm 0,036; μ 100; CS(10)300 – https://www.austrotherm.hu/fileadmin/user_upload/HU/Termekek/Adatlapok_2023/AUSTROTHERM_XPS_TOP_30_SF_adatlap2023.pdf",
  "ellenorzott": true,
  "megjegyzes": "Vastagságfüggő! 40 és 50 mm: 0,032; 30 és 60 mm: 0,033."
 },
 {
  "id": "at_xps30_70_120",
  "nev": "XPS lemez 70–120 mm – Austrotherm XPS TOP 30 SF",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_hab",
  "lambda": 0.035,
  "mu": 100,
  "forras": "Austrotherm XPS TOP 30 SF terméklap 2023 – λ (közölt=tervezési): 30, 60 mm 0,033; 40, 50 mm 0,032; 70–120 mm 0,035; 140–160 mm 0,036; μ 100; CS(10)300 – https://www.austrotherm.hu/fileadmin/user_upload/HU/Termekek/Adatlapok_2023/AUSTROTHERM_XPS_TOP_30_SF_adatlap2023.pdf",
  "ellenorzott": true,
  "megjegyzes": "Vastagságfüggő λ (lásd forrás)."
 },
 {
  "id": "at_xps30_140_160",
  "nev": "XPS lemez 140–160 mm – Austrotherm XPS TOP 30 SF",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_hab",
  "lambda": 0.036,
  "mu": 100,
  "forras": "Austrotherm XPS TOP 30 SF terméklap 2023 – λ (közölt=tervezési): 30, 60 mm 0,033; 40, 50 mm 0,032; 70–120 mm 0,035; 140–160 mm 0,036; μ 100; CS(10)300 – https://www.austrotherm.hu/fileadmin/user_upload/HU/Termekek/Adatlapok_2023/AUSTROTHERM_XPS_TOP_30_SF_adatlap2023.pdf",
  "ellenorzott": true,
  "megjegyzes": "Vastagságfüggő λ (lásd forrás)."
 },
 {
  "id": "at_xps70_50_60",
  "nev": "XPS lemez nagy terhelésű, 50–60 mm – Austrotherm XPS TOP 70 SF",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_hab",
  "lambda": 0.033,
  "mu": 100,
  "forras": "Austrotherm XPS TOP 70 SF terméklap 2023 – λ (közölt=tervezési): 50, 60 mm 0,033; 80–140 mm 0,035; 160 mm 0,036; μ 100; CS(10\\Y)700 – https://www.austrotherm.hu/fileadmin/user_upload/HU/Termekek/Adatlapok_2023/AUSTROTHERM_XPS_TOP_70_SF_adatlap2023.pdf",
  "ellenorzott": true,
  "megjegyzes": "Vastagságfüggő λ; 700 kPa nyomószilárdság."
 },
 {
  "id": "at_xps70_80_140",
  "nev": "XPS lemez nagy terhelésű, 80–140 mm – Austrotherm XPS TOP 70 SF",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_hab",
  "lambda": 0.035,
  "mu": 100,
  "forras": "Austrotherm XPS TOP 70 SF terméklap 2023 – λ (közölt=tervezési): 50, 60 mm 0,033; 80–140 mm 0,035; 160 mm 0,036; μ 100; CS(10\\Y)700 – https://www.austrotherm.hu/fileadmin/user_upload/HU/Termekek/Adatlapok_2023/AUSTROTHERM_XPS_TOP_70_SF_adatlap2023.pdf",
  "ellenorzott": true,
  "megjegyzes": "Vastagságfüggő λ; 160 mm: 0,036."
 },
 {
  "id": "at_xps50tb",
  "nev": "XPS lemez vastag, 180–400 mm – Austrotherm XPS TOP 50 TB SF",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_hab",
  "lambda": 0.035,
  "mu": 100,
  "forras": "Austrotherm XPS TOP 50 TB SF terméklap 2024 – λ (közölt=tervezési) 0,035, vastagság 180–400 mm; μ 100; CS(10\\Y)500 – https://austrotherm.hu/fileadmin/user_upload/HU/Termekek/Adatlapok/adatlap_2024_XPS_TOP_50_TB_SF.pdf",
  "ellenorzott": true,
  "megjegyzes": "Hegesztett (TB) vastag lemez."
 },
 {
  "id": "bachl_extrapor80",
  "nev": "EPS 80 grafitos homlokzati lemez – Bachl Extrapor EPS 80",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_hab",
  "lambda": 0.031,
  "mu": 20,
  "forras": "BACHL EXTRAPOR EPS 80 termékadatlap (dátum nélkül, kereskedői tárhelyen) – λD 0,031; μ 20–40 – https://stshop.hu/_upload/catalog/1783579949_BACHL_Extrapor_EPS_80_3.pdf",
  "ellenorzott": true,
  "megjegyzes": "Grafitadalékos, 1 piros sáv jelölés. EPS-MSZ EN 13163-T(1)-L(2)-W(2)-S(2)-P(5)-BS125-CS(10)80-DS(70,-)1-DS(N)2-TR150-WL(P)0.5. Nem gyártói honlapról, hanem kereskedőtől."
 },
 {
  "id": "sika_grafit_eps80",
  "nev": "EPS 80 grafitos homlokzati lemez – Sikatherm Grafit EPS 80",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_hab",
  "lambda": 0.031,
  "mu": 20,
  "forras": "Sika Hungária: Sikatherm Grafit EPS 80 termékadatlap, verzió 01, 2025.02.04. – hővezető képesség 0,031; μ 20–40 – https://hun.sika.com/dam/dms/hucon/t/PDS%20Sikatherm%20Grafit%20EPS%2080_hu_2025.pdf",
  "ellenorzott": true,
  "megjegyzes": "EPS80GRAFIT EN 13163-T1-L2-W1-Sb1-P3-BS150-CS(10)80-DS(N)2-DLT(1)5-TR150-WL(T)3-DS(70,90)1."
 },
 {
  "id": "mp_isomaster_h80",
  "nev": "EPS 80 homlokzati lemez (fehér) – Masterplast Isomaster EPS H-80",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_hab",
  "lambda": 0.04,
  "forras": "Masterplast teljesítménynyilatkozat DOP_ISOMASTER.EPS.H-80_03, Sárszentmihály, 2016.02.01. – λD 0,040 – https://www.masterplast.hu/wp-content/uploads/2019/02/dop_isomaster-eps-h-80_03.pdf",
  "ellenorzott": true,
  "megjegyzes": "2016-os DoP (ennél frissebbet nem találtam). μ nincs a DoP-ban. Grafitos H-80-G: λD 0,031 (már a könyvtár Grafit 80 megjegyzésében)."
 },
 {
  "id": "mp_isomaster_150",
  "nev": "EPS 150 lemez (fehér) – Masterplast Isomaster EPS 150",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_hab",
  "lambda": 0.034,
  "forras": "Masterplast teljesítménynyilatkozat DOP_ISOMASTER.EPS.150_05, 2024.03.22. – λD 0,034 – https://www.masterplast.hu/wp-content/uploads/2024/05/dop_isomaster-eps-150_05.pdf",
  "ellenorzott": true,
  "megjegyzes": "μ nincs a DoP-ban. CS(10) 150."
 },
 {
  "id": "mp_hungarocell",
  "nev": "EPS lemez – Masterplast Hungarocell EPS",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_hab",
  "lambda": 0.038,
  "forras": "Masterplast teljesítménynyilatkozat DOP_HUNGAROCELL.EPS_06, Sárszentmihály, 2024.01.30. – λD 0,038 – https://www.masterplast.hu/wp-content/uploads/2024/05/dop_hungarocell-eps_06.pdf",
  "ellenorzott": true,
  "megjegyzes": "A DoP egyetlen „HUNGAROCELL EPS” terméket ír le, szilárdsági osztályt a kivonat nem adott. μ nincs."
 },
 {
  "id": "mp_isomaster_xps300",
  "nev": "XPS lemez – Masterplast Isomaster XPS 300 (SW/SG/LW/LG)",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_hab",
  "lambda": 0.034,
  "forras": "Masterplast Isomaster XPS 300 SW/SG/LW/LG műszaki adatlap, kiadás 2024.04.15. – λD 0,034 (minden vastagságra); RD 20 mm 0,55 … 120 mm 3,50 – https://www.masterplast.hu/wp-content/uploads/2024/04/ma_isomaster-xps-300-sw-sg-lw-lg-20240415_hu.pdf",
  "ellenorzott": true,
  "megjegyzes": "20–30 mm: CS(10/Y)200, ≥40 mm: 300 kPa. μ értéket az adatlap nem ad."
 },
 {
  "id": "bauder_pir_fa",
  "nev": "PIR hőszigetelő lap – BauderPIR FA",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_hab",
  "lambda": 0.022,
  "forras": "Bauder teljesítménynyilatkozat DoP-No. FA, Stuttgart, 2022.04.14. (EN) – λD 0,022 (dN 20–240 mm); RD: 40 mm 1,80; 60 mm 2,70; 80 mm 3,60; 100 mm 4,50; 120 mm 5,45; 140 mm 6,35; 160 mm 7,25; 200 mm 9,05; 240 mm 10,90 – https://www.bauder.co.uk/getmedia/95801577-d61a-4510-89c4-f2032e914876/BauderPIR_-_DoP-No_FA_-_1122_-_EN_EU.pdf",
  "ellenorzott": true,
  "megjegyzes": "Kasírozás a DoP-ban nincs megnevezve (FA = flachdach, alu-kompozit fedőréteg a terméklap szerint – ellenőrizendő). μ: NPD. Nem magyar nyelvű forrás, de EU-DoP."
 },
 {
  "id": "kingspan_tr26",
  "nev": "PIR hőszigetelő lap, alu kasírozás – Kingspan Therma TR26",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_hab",
  "lambda": 0.022,
  "forras": "Kingspan Therma TR26 termékismertető (DE), Version 17, 04/2025 – λD 0,022; RD 20 mm 0,90 … 100 mm 4,50 … 160 mm 7,25; ρ ~30 – https://www.bobbie.de/media/uattachments/764/KING100000044033/KINGkingspan-therma-tr26-product-leaflet-de-de.pdf",
  "ellenorzott": true,
  "megjegyzes": "Kétoldali többrétegű alu fedőréteg, „diffúziózáró” (μ számszerűen nincs). ρ≈30 kg/m³. Német piaci adatlap."
 },
 {
  "id": "rw_fixrock_fb1",
  "nev": "Kőzetgyapot szerelt homlokzati lemez – Rockwool Fixrock FB1",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_szalas",
  "lambda": 0.039,
  "mu": 1,
  "forras": "Rockwool Fixrock FB1 termékadatlap, 2019. február – λD 0,039; μ 1 (MU1); ρ 32; A1 – https://www.rockwool.com/syssiteassets/rw-hu/termekadatlapok/homlokzati-hszigeteles/fixrock-fb1-termekadatlap.pdf",
  "ellenorzott": true,
  "megjegyzes": "Hátszellőztetett homlokzat, egyik oldalon fekete üvegfátyol. ρ=32 kg/m³."
 },
 {
  "id": "rw_multirock",
  "nev": "Kőzetgyapot lemez (válaszfal, födém, padlás) – Rockwool Multirock",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_szalas",
  "lambda": 0.039,
  "mu": 1,
  "forras": "Rockwool Multirock termékadatlap, 2019. február – λD 0,039; μ 1; ρ 28 – https://www.rockwool.com/syssiteassets/rw-hu/termekadatlapok/magastet-es-tetter/multirock-termekadatlap.pdf",
  "ellenorzott": true,
  "megjegyzes": "Mechanikai igénybevétel nélküli helyekre. ρ=28 kg/m³."
 },
 {
  "id": "rw_deltarock",
  "nev": "Kőzetgyapot éklemez szarufák közé – Rockwool Deltarock",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_szalas",
  "lambda": 0.037,
  "mu": 1,
  "forras": "Rockwool Deltarock termékadatlap, 2019. február – λD 0,037; μ 1,1 (MU1); ρ 35 – https://www.rockwool.com/syssiteassets/rw-hu/termekadatlapok/magastet-es-tetter/deltarock-termekadatlap.pdf",
  "ellenorzott": true,
  "megjegyzes": "ρ=35 kg/m³."
 },
 {
  "id": "rw_hardrock_max",
  "nev": "Kőzetgyapot lapostető-lemez – Rockwool Hardrock Max",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_szalas",
  "lambda": 0.04,
  "mu": 1,
  "forras": "Rockwool Hardrock Max termékadatlap, 2019. február – λD 0,040; μ 1 – https://editserver.rockwool.com/siteassets/rw-hu/termekadatlapok/lapostet-es-ipari-csarnok/hardrock-max-termekadatlap.pdf",
  "ellenorzott": true,
  "megjegyzes": "Egyenes rétegrendű, nem járható lapostető. Kettős sűrűségű."
 },
 {
  "id": "rw_monrock_max_e",
  "nev": "Kőzetgyapot lapostető-lemez – Rockwool Monrock Max E",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_szalas",
  "lambda": 0.038,
  "mu": 1,
  "forras": "Rockwool Monrock Max E termékadatlap, 2019. február – λD ≤ 0,038; μ 1 – https://www.rockwool.com/siteassets/rw-hu/termekadatlapok/lapostet-es-ipari-csarnok/monrock-max-e-termekadatlap.pdf",
  "ellenorzott": true,
  "megjegyzes": "Egyenes rétegrendű, nem járható lapostető. ρ nincs számszerűen."
 },
 {
  "id": "rw_steprock_nd",
  "nev": "Kőzetgyapot lépéshang-szigetelő lemez – Rockwool Steprock ND",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_szalas",
  "lambda": 0.037,
  "mu": 1,
  "forras": "Rockwool Steprock ND termékadatlap, 2020. február – λD 0,037; μ 1; ρ 120 – https://www.rockwool.com/syssiteassets/rw-hu/termekadatlapok/padlok-es-foedemek/steprock-nd-termekadatlap.pdf",
  "ellenorzott": true,
  "megjegyzes": "Úsztatott esztrich alá. ρ=120 kg/m³."
 },
 {
  "id": "rw_stroprock_g",
  "nev": "Kőzetgyapot mennyezeti hőszigetelő lemez – Rockwool Stroprock G",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_szalas",
  "lambda": 0.037,
  "mu": 1,
  "forras": "Rockwool Stroprock G termékoldal – λD 0,037 W/mK (EN 12667), páraáteresztés MU1 – https://www.rockwool.com/hu/termekek/stroprock-g/",
  "ellenorzott": true,
  "megjegyzes": "Födém alsó síkjára (mélygarázs, pince, árkád mennyezete). ρ nincs számszerűen."
 },
 {
  "id": "rw_airrock_nd",
  "nev": "Kőzetgyapot válaszfal-lemez – Rockwool Airrock ND",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_szalas",
  "lambda": 0.035,
  "mu": 1,
  "forras": "Rockwool Airrock ND termékadatlap, 2019. február – λD 0,035; μ 1; ρ 50 – https://www.rockwool.com/syssiteassets/rw-hu/termekadatlapok/valaszfalak/airrock-nd-termekadatlap.pdf",
  "ellenorzott": true,
  "megjegyzes": "Gipszkarton válaszfal, álmennyezet fölé. ρ=50 kg/m³."
 },
 {
  "id": "ki_fkd_s",
  "nev": "Kőzetgyapot homlokzati lemez (ETICS) – Knauf Insulation FKD S Thermal",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_szalas",
  "lambda": 0.034,
  "mu": 1,
  "forras": "Knauf Insulation termékkatalógus (érv. 2024.04.01-től) – https://pim.knaufinsulation.com/files/download/download_6618df9903883.pdf – λD 0,034",
  "ellenorzott": false,
  "megjegyzes": "Kontakt homlokzat. MU1 a CE-kódban. A katalógus szövegkinyerésében a terméknév–adat párosítás nem volt egyértelmű – ellenőrizendő."
 },
 {
  "id": "ki_fkd_n",
  "nev": "Kőzetgyapot homlokzati lemez (ETICS) – Knauf Insulation FKD N Thermal",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_szalas",
  "lambda": 0.035,
  "mu": 1,
  "forras": "Knauf Insulation termékkatalógus (érv. 2024.04.01-től) – https://pim.knaufinsulation.com/files/download/download_6618df9903883.pdf – λD 0,035",
  "ellenorzott": false,
  "megjegyzes": "Kontakt homlokzat. Párosítás ellenőrizendő."
 },
 {
  "id": "ki_smartwall_sc1",
  "nev": "Kőzetgyapot homlokzati lemez, egyoldali bevonattal – Knauf Insulation SMARTwall S C1",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_szalas",
  "lambda": 0.035,
  "mu": 1,
  "forras": "Knauf Insulation termékkatalógus (érv. 2024.04.01-től) – https://pim.knaufinsulation.com/files/download/download_6618df9903883.pdf – λD 0,035",
  "ellenorzott": true,
  "megjegyzes": "Kontakt homlokzat."
 },
 {
  "id": "ki_tp435b",
  "nev": "Ásványgyapot szerelt homlokzati lemez – Knauf Insulation TP 435 B",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_szalas",
  "lambda": 0.034,
  "mu": 1,
  "forras": "Knauf Insulation termékkatalógus (érv. 2024.04.01-től) – https://pim.knaufinsulation.com/files/download/download_6618df9903883.pdf – λD 0,034",
  "ellenorzott": false,
  "megjegyzes": "Hátszellőztetett homlokzat, fekete vagy natúr üvegfátyol. Párosítás ellenőrizendő; FPL-034-GVB/GVN szintén 0,034."
 },
 {
  "id": "ki_unifit032",
  "nev": "Ásványgyapot tekercs szarufák közé – Knauf Insulation Unifit 032",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_szalas",
  "lambda": 0.032,
  "forras": "Knauf Insulation termékkatalógus (érv. 2024.04.01-től) – https://pim.knaufinsulation.com/files/download/download_6618df9903883.pdf – λD 0,032",
  "ellenorzott": true,
  "megjegyzes": "μ nincs megadva (ásványgyapot, kb. 1)."
 },
 {
  "id": "ki_unifit033",
  "nev": "Ásványgyapot tekercs szarufák közé – Knauf Insulation Unifit 033",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_szalas",
  "lambda": 0.033,
  "forras": "Knauf Insulation termékkatalógus (érv. 2024.04.01-től) – https://pim.knaufinsulation.com/files/download/download_6618df9903883.pdf – λD 0,033",
  "ellenorzott": true,
  "megjegyzes": "μ nincs megadva."
 },
 {
  "id": "ki_unifit037",
  "nev": "Ásványgyapot tekercs szarufák közé – Knauf Insulation Unifit 037",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_szalas",
  "lambda": 0.037,
  "forras": "Knauf Insulation termékkatalógus (érv. 2024.04.01-től) – https://pim.knaufinsulation.com/files/download/download_6618df9903883.pdf – λD 0,037",
  "ellenorzott": true,
  "megjegyzes": "μ nincs megadva."
 },
 {
  "id": "ki_mps035",
  "nev": "Ásványgyapot lemez (magastető, válaszfal) – Knauf Insulation MPS 035",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_szalas",
  "lambda": 0.035,
  "forras": "Knauf Insulation termékkatalógus (érv. 2024.04.01-től) – https://pim.knaufinsulation.com/files/download/download_6618df9903883.pdf – λD 0,035",
  "ellenorzott": true
 },
 {
  "id": "ki_mpn_plus037",
  "nev": "Ásványgyapot lemez – Knauf Insulation MPN Plus 037",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_szalas",
  "lambda": 0.037,
  "mu": 1,
  "forras": "Knauf Insulation termékkatalógus (érv. 2024.04.01-től) – https://pim.knaufinsulation.com/files/download/download_6618df9903883.pdf – λD 0,037",
  "ellenorzott": true,
  "megjegyzes": "MU1 a CE-kódban."
 },
 {
  "id": "ki_ddp_x",
  "nev": "Kőzetgyapot járható lapostető-lemez – Knauf Insulation DDP-X",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_szalas",
  "lambda": 0.038,
  "forras": "Knauf Insulation termékkatalógus (érv. 2024.04.01-től) – https://pim.knaufinsulation.com/files/download/download_6618df9903883.pdf – λD 0,038",
  "ellenorzott": false,
  "megjegyzes": "70 kPa. Párosítás ellenőrizendő."
 },
 {
  "id": "ki_ddp2",
  "nev": "Kőzetgyapot járható lapostető-lemez – Knauf Insulation DDP 2",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_szalas",
  "lambda": 0.04,
  "forras": "Knauf Insulation termékkatalógus (érv. 2024.04.01-től) – https://pim.knaufinsulation.com/files/download/download_6618df9903883.pdf – λD 0,04",
  "ellenorzott": false,
  "megjegyzes": "60 kPa. Párosítás ellenőrizendő."
 },
 {
  "id": "ki_smartroof_base",
  "nev": "Kőzetgyapot lapostető alsó réteg – Knauf Insulation SMARTroof Base",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_szalas",
  "lambda": 0.035,
  "forras": "Knauf Insulation termékkatalógus (érv. 2024.04.01-től) – https://pim.knaufinsulation.com/files/download/download_6618df9903883.pdf – λD 0,035",
  "ellenorzott": true,
  "megjegyzes": "30 kPa; RD 80 mm 2,30, 200 mm 5,70."
 },
 {
  "id": "ki_smartroof_norm",
  "nev": "Kőzetgyapot lapostető felső réteg – Knauf Insulation SMARTroof Norm",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_szalas",
  "lambda": 0.037,
  "forras": "Knauf Insulation termékkatalógus (érv. 2024.04.01-től) – https://pim.knaufinsulation.com/files/download/download_6618df9903883.pdf – λD 0,037",
  "ellenorzott": true,
  "megjegyzes": "60 kPa."
 },
 {
  "id": "ki_clt_c1",
  "nev": "Kőzetgyapot lamella alulról hűlő födémre – Knauf Insulation CLT C1 Thermal",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_szalas",
  "lambda": 0.037,
  "forras": "Knauf Insulation termékkatalógus (érv. 2024.04.01-től) – https://pim.knaufinsulation.com/files/download/download_6618df9903883.pdf – λD 0,037",
  "ellenorzott": true,
  "megjegyzes": "RD: 50 mm 1,35; 100 mm 2,55; 200 mm 5,40."
 },
 {
  "id": "tektalan_a2_st_50",
  "nev": "Tektalan A2-SmartTec 50 mm (fagyapot + kőzetgyapot, alulról hűlő födém) – Knauf Insulation",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_szalas",
  "R": {
   "R": 1.25,
   "d": 0.05
  },
  "forras": "Knauf Insulation Tektalan A2-SmartTec [1.0] műszaki lap (olasz), Stato 01/2023 – fagyapot 10 mm λD 0,095 μ 5; kőzetgyapot mag λD 0,034 μ 1; RD táblázat – https://pim.knaufinsulation.com/files/download/tektalan_a2-smarttec_1-0_i.pdf ; λ-k megerősítve: magyar DoP W4312GPCPR, 2023.10.26. – https://pim.knaufinsulation.com/files/download/download_654b382801e00.pdf",
  "ellenorzott": true,
  "megjegyzes": "Rétegrend 10 mm fagyapot (0,095) + 40 mm kőzetgyapot (0,034). RD=1,25 m²K/W. Egyéb vastagságok: 60 mm 1,55; 175 mm 4,95. A2-s1,d0."
 },
 {
  "id": "tektalan_a2_st_75",
  "nev": "Tektalan A2-SmartTec 75 mm (fagyapot + kőzetgyapot, alulról hűlő födém) – Knauf Insulation",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_szalas",
  "R": {
   "R": 2.0,
   "d": 0.075
  },
  "forras": "Knauf Insulation Tektalan A2-SmartTec [1.0] műszaki lap (olasz), Stato 01/2023 – fagyapot 10 mm λD 0,095 μ 5; kőzetgyapot mag λD 0,034 μ 1; RD táblázat – https://pim.knaufinsulation.com/files/download/tektalan_a2-smarttec_1-0_i.pdf ; λ-k megerősítve: magyar DoP W4312GPCPR, 2023.10.26. – https://pim.knaufinsulation.com/files/download/download_654b382801e00.pdf",
  "ellenorzott": true,
  "megjegyzes": "Rétegrend 10 mm fagyapot (0,095) + 65 mm kőzetgyapot (0,034). RD=2,0 m²K/W. Egyéb vastagságok: 60 mm 1,55; 175 mm 4,95. A2-s1,d0."
 },
 {
  "id": "tektalan_a2_st_100",
  "nev": "Tektalan A2-SmartTec 100 mm (fagyapot + kőzetgyapot, alulról hűlő födém) – Knauf Insulation",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_szalas",
  "R": {
   "R": 2.75,
   "d": 0.1
  },
  "forras": "Knauf Insulation Tektalan A2-SmartTec [1.0] műszaki lap (olasz), Stato 01/2023 – fagyapot 10 mm λD 0,095 μ 5; kőzetgyapot mag λD 0,034 μ 1; RD táblázat – https://pim.knaufinsulation.com/files/download/tektalan_a2-smarttec_1-0_i.pdf ; λ-k megerősítve: magyar DoP W4312GPCPR, 2023.10.26. – https://pim.knaufinsulation.com/files/download/download_654b382801e00.pdf",
  "ellenorzott": true,
  "megjegyzes": "Rétegrend 10 mm fagyapot (0,095) + 90 mm kőzetgyapot (0,034). RD=2,75 m²K/W. Egyéb vastagságok: 60 mm 1,55; 175 mm 4,95. A2-s1,d0."
 },
 {
  "id": "tektalan_a2_st_125",
  "nev": "Tektalan A2-SmartTec 125 mm (fagyapot + kőzetgyapot, alulról hűlő födém) – Knauf Insulation",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_szalas",
  "R": {
   "R": 3.45,
   "d": 0.125
  },
  "forras": "Knauf Insulation Tektalan A2-SmartTec [1.0] műszaki lap (olasz), Stato 01/2023 – fagyapot 10 mm λD 0,095 μ 5; kőzetgyapot mag λD 0,034 μ 1; RD táblázat – https://pim.knaufinsulation.com/files/download/tektalan_a2-smarttec_1-0_i.pdf ; λ-k megerősítve: magyar DoP W4312GPCPR, 2023.10.26. – https://pim.knaufinsulation.com/files/download/download_654b382801e00.pdf",
  "ellenorzott": true,
  "megjegyzes": "Rétegrend 10 mm fagyapot (0,095) + 115 mm kőzetgyapot (0,034). RD=3,45 m²K/W. Egyéb vastagságok: 60 mm 1,55; 175 mm 4,95. A2-s1,d0."
 },
 {
  "id": "tektalan_a2_st_150",
  "nev": "Tektalan A2-SmartTec 150 mm (fagyapot + kőzetgyapot, alulról hűlő födém) – Knauf Insulation",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_szalas",
  "R": {
   "R": 4.2,
   "d": 0.15
  },
  "forras": "Knauf Insulation Tektalan A2-SmartTec [1.0] műszaki lap (olasz), Stato 01/2023 – fagyapot 10 mm λD 0,095 μ 5; kőzetgyapot mag λD 0,034 μ 1; RD táblázat – https://pim.knaufinsulation.com/files/download/tektalan_a2-smarttec_1-0_i.pdf ; λ-k megerősítve: magyar DoP W4312GPCPR, 2023.10.26. – https://pim.knaufinsulation.com/files/download/download_654b382801e00.pdf",
  "ellenorzott": true,
  "megjegyzes": "Rétegrend 10 mm fagyapot (0,095) + 140 mm kőzetgyapot (0,034). RD=4,2 m²K/W. Egyéb vastagságok: 60 mm 1,55; 175 mm 4,95. A2-s1,d0."
 },
 {
  "id": "tektalan_a2_st_200",
  "nev": "Tektalan A2-SmartTec 200 mm (fagyapot + kőzetgyapot, alulról hűlő födém) – Knauf Insulation",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_szalas",
  "R": {
   "R": 5.65,
   "d": 0.2
  },
  "forras": "Knauf Insulation Tektalan A2-SmartTec [1.0] műszaki lap (olasz), Stato 01/2023 – fagyapot 10 mm λD 0,095 μ 5; kőzetgyapot mag λD 0,034 μ 1; RD táblázat – https://pim.knaufinsulation.com/files/download/tektalan_a2-smarttec_1-0_i.pdf ; λ-k megerősítve: magyar DoP W4312GPCPR, 2023.10.26. – https://pim.knaufinsulation.com/files/download/download_654b382801e00.pdf",
  "ellenorzott": true,
  "megjegyzes": "Rétegrend 10 mm fagyapot (0,095) + 190 mm kőzetgyapot (0,034). RD=5,65 m²K/W. Egyéb vastagságok: 60 mm 1,55; 175 mm 4,95. A2-s1,d0."
 },
 {
  "id": "heratekta_c3_031_50",
  "nev": "Heratekta C3 031 50 mm háromrétegű lap (fagyapot + grafitos EPS mag) – Knauf Insulation",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_hab",
  "R": {
   "R": 1.4,
   "d": 0.05
  },
  "forras": "Knauf Insulation HERATEKTA-C3 031 műszaki lap (görög), 2020. május – grafitos EPS mag λ 0,031, fagyapot 0,090; R: 35 mm 0,90; 50 mm 1,40; 75 mm 2,20; 100 mm 3,00; 125 mm 3,80; 150 mm 4,60 – https://pim.knaufinsulation.com/files/download/heratekta_c3-031_gr_202005.pdf ; egyező RD: Heratekta C-3 032 (DE) adatlap 2024.07.01. – https://res.cloudinary.com/baywa-ag-p/raw/upload/A32103815.pdf ; magyar DoP W4312BPCPR v4.1 (2019): λD EPS 0,031, WW 0,09 – https://pim.knaufinsulation.com/files/download/w4312bpcpr_hu.pdf",
  "ellenorzott": true,
  "megjegyzes": "R=1,4 m²K/W (közölt RD). DE adatlap rétegrend: 5 mm fagyapot / mag / 5 mm fagyapot; DE tervezési R (DIN 4108-4) kissé kisebb: 50 mm 1,34; 75 mm 2,12; 100 mm 2,90. Fedőréteg μ 2/5, mag μ 20/40 (DE). A magyar DoP R-t nem ad („lásd termékcímke”)."
 },
 {
  "id": "heratekta_c3_031_75",
  "nev": "Heratekta C3 031 75 mm háromrétegű lap (fagyapot + grafitos EPS mag) – Knauf Insulation",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_hab",
  "R": {
   "R": 2.2,
   "d": 0.075
  },
  "forras": "Knauf Insulation HERATEKTA-C3 031 műszaki lap (görög), 2020. május – grafitos EPS mag λ 0,031, fagyapot 0,090; R: 35 mm 0,90; 50 mm 1,40; 75 mm 2,20; 100 mm 3,00; 125 mm 3,80; 150 mm 4,60 – https://pim.knaufinsulation.com/files/download/heratekta_c3-031_gr_202005.pdf ; egyező RD: Heratekta C-3 032 (DE) adatlap 2024.07.01. – https://res.cloudinary.com/baywa-ag-p/raw/upload/A32103815.pdf ; magyar DoP W4312BPCPR v4.1 (2019): λD EPS 0,031, WW 0,09 – https://pim.knaufinsulation.com/files/download/w4312bpcpr_hu.pdf",
  "ellenorzott": true,
  "megjegyzes": "R=2,2 m²K/W (közölt RD). DE adatlap rétegrend: 5 mm fagyapot / mag / 5 mm fagyapot; DE tervezési R (DIN 4108-4) kissé kisebb: 50 mm 1,34; 75 mm 2,12; 100 mm 2,90. Fedőréteg μ 2/5, mag μ 20/40 (DE). A magyar DoP R-t nem ad („lásd termékcímke”)."
 },
 {
  "id": "heratekta_c3_031_100",
  "nev": "Heratekta C3 031 100 mm háromrétegű lap (fagyapot + grafitos EPS mag) – Knauf Insulation",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_hab",
  "R": {
   "R": 3.0,
   "d": 0.1
  },
  "forras": "Knauf Insulation HERATEKTA-C3 031 műszaki lap (görög), 2020. május – grafitos EPS mag λ 0,031, fagyapot 0,090; R: 35 mm 0,90; 50 mm 1,40; 75 mm 2,20; 100 mm 3,00; 125 mm 3,80; 150 mm 4,60 – https://pim.knaufinsulation.com/files/download/heratekta_c3-031_gr_202005.pdf ; egyező RD: Heratekta C-3 032 (DE) adatlap 2024.07.01. – https://res.cloudinary.com/baywa-ag-p/raw/upload/A32103815.pdf ; magyar DoP W4312BPCPR v4.1 (2019): λD EPS 0,031, WW 0,09 – https://pim.knaufinsulation.com/files/download/w4312bpcpr_hu.pdf",
  "ellenorzott": true,
  "megjegyzes": "R=3,0 m²K/W (közölt RD). DE adatlap rétegrend: 5 mm fagyapot / mag / 5 mm fagyapot; DE tervezési R (DIN 4108-4) kissé kisebb: 50 mm 1,34; 75 mm 2,12; 100 mm 2,90. Fedőréteg μ 2/5, mag μ 20/40 (DE). A magyar DoP R-t nem ad („lásd termékcímke”)."
 },
 {
  "id": "heratekta_c3_031_125",
  "nev": "Heratekta C3 031 125 mm háromrétegű lap (fagyapot + grafitos EPS mag) – Knauf Insulation",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_hab",
  "R": {
   "R": 3.8,
   "d": 0.125
  },
  "forras": "Knauf Insulation HERATEKTA-C3 031 műszaki lap (görög), 2020. május – grafitos EPS mag λ 0,031, fagyapot 0,090; R: 35 mm 0,90; 50 mm 1,40; 75 mm 2,20; 100 mm 3,00; 125 mm 3,80; 150 mm 4,60 – https://pim.knaufinsulation.com/files/download/heratekta_c3-031_gr_202005.pdf ; egyező RD: Heratekta C-3 032 (DE) adatlap 2024.07.01. – https://res.cloudinary.com/baywa-ag-p/raw/upload/A32103815.pdf ; magyar DoP W4312BPCPR v4.1 (2019): λD EPS 0,031, WW 0,09 – https://pim.knaufinsulation.com/files/download/w4312bpcpr_hu.pdf",
  "ellenorzott": true,
  "megjegyzes": "R=3,8 m²K/W (közölt RD). DE adatlap rétegrend: 5 mm fagyapot / mag / 5 mm fagyapot; DE tervezési R (DIN 4108-4) kissé kisebb: 50 mm 1,34; 75 mm 2,12; 100 mm 2,90. Fedőréteg μ 2/5, mag μ 20/40 (DE). A magyar DoP R-t nem ad („lásd termékcímke”)."
 },
 {
  "id": "heratekta_c3_031_150",
  "nev": "Heratekta C3 031 150 mm háromrétegű lap (fagyapot + grafitos EPS mag) – Knauf Insulation",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_hab",
  "R": {
   "R": 4.6,
   "d": 0.15
  },
  "forras": "Knauf Insulation HERATEKTA-C3 031 műszaki lap (görög), 2020. május – grafitos EPS mag λ 0,031, fagyapot 0,090; R: 35 mm 0,90; 50 mm 1,40; 75 mm 2,20; 100 mm 3,00; 125 mm 3,80; 150 mm 4,60 – https://pim.knaufinsulation.com/files/download/heratekta_c3-031_gr_202005.pdf ; egyező RD: Heratekta C-3 032 (DE) adatlap 2024.07.01. – https://res.cloudinary.com/baywa-ag-p/raw/upload/A32103815.pdf ; magyar DoP W4312BPCPR v4.1 (2019): λD EPS 0,031, WW 0,09 – https://pim.knaufinsulation.com/files/download/w4312bpcpr_hu.pdf",
  "ellenorzott": true,
  "megjegyzes": "R=4,6 m²K/W (közölt RD). DE adatlap rétegrend: 5 mm fagyapot / mag / 5 mm fagyapot; DE tervezési R (DIN 4108-4) kissé kisebb: 50 mm 1,34; 75 mm 2,12; 100 mm 2,90. Fedőréteg μ 2/5, mag μ 20/40 (DE). A magyar DoP R-t nem ad („lásd termékcímke”)."
 },
 {
  "id": "isover_domo_plus",
  "nev": "Üveggyapot tekercs – Isover Domo Plus",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_szalas",
  "lambda": 0.038,
  "mu": 1,
  "forras": "Saint-Gobain Isover teljesítménynyilatkozat 030-WS1-DoP-14-w4 (magyar nyelvű), Gliwice, 2020.02.19. – λD 0,038; MU1; A1 – https://www.isover.pl/documents/declaration-performance/dop-dmo-plus-hu.pdf",
  "ellenorzott": true,
  "megjegyzes": "50–220 mm."
 },
 {
  "id": "isover_tf_profi",
  "nev": "Kőzetgyapot homlokzati lemez (ETICS) – Isover TF Profi",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_szalas",
  "lambda": 0.035,
  "mu": 1,
  "forras": "Isover TF Profi műszaki lap (Isover CZ, angol), 2026.04.15. – λD 0,035; μ 1; ρ 90–140; CS(10)30; TR10 – https://www.isover.cz/en/documents/technicke-listy/tl-isover-tf-profi-en.pdf",
  "ellenorzott": true,
  "megjegyzes": "Cseh Isover-adatlap; a magyar piacon forgalmazott termékkel azonosnak feltételezve – ellenőrizendő."
 },
 {
  "id": "ursa_df39",
  "nev": "Üveggyapot tekercs – Ursa DF 39",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_szalas",
  "lambda": 0.039,
  "mu": 1,
  "forras": "URSA teljesítménynyilatkozat 48UGW39NRN19011 (többnyelvű, magyarral), Dąbrowa Górnicza, 2019.01.09. – λD 0,039; MW-EN 13162-T2-MU1; RD 50 mm 1,25 … 200 mm 5,10 – https://dop.ursa.com/pdf/verPdf/48UGW39NRN19011",
  "ellenorzott": true,
  "megjegyzes": "40–240 mm."
 },
 {
  "id": "steico_flex036",
  "nev": "Farost hőszigetelő lap (flexibilis) – STEICOflex 036",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_szalas",
  "lambda": 0.036,
  "mu": 2,
  "forras": "STEICOflex 036 technical data sheet (EN), 07/2023 – λD 0,036; ρ ~60; μ 2 – https://www.steico.com/fileadmin/user_upload/importer/downloads/4028b6097ea4b73a017f3070aba80c80/STEICOflex_036_en_i.pdf",
  "ellenorzott": true,
  "megjegyzes": "Vázkitöltés. ρ≈60 kg/m³."
 },
 {
  "id": "steico_protect_h_dry",
  "nev": "Farost homlokzati vakolattartó lap – STEICOprotect H dry",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_szalas",
  "lambda": 0.043,
  "mu": 3,
  "forras": "STEICOprotect dry technical data sheet (EN), 07/2020 – H dry: λD 0,043; ρ ~180; μ 3 – https://www.backtoearth.co.uk/wp-content/uploads/2023/10/STEICOprotect_dry_en_i.pdf",
  "ellenorzott": true,
  "megjegyzes": "ρ≈180 kg/m³. Kereskedői tárhelyen lévő gyártói adatlap."
 },
 {
  "id": "steico_protect_m_dry",
  "nev": "Farost homlokzati vakolattartó lap – STEICOprotect M dry",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_szalas",
  "lambda": 0.04,
  "mu": 3,
  "forras": "STEICOprotect dry technical data sheet (EN), 07/2020 – M dry: λD 0,04; ρ ~140; μ 3 – https://www.backtoearth.co.uk/wp-content/uploads/2023/10/STEICOprotect_dry_en_i.pdf",
  "ellenorzott": true,
  "megjegyzes": "ρ≈140 kg/m³. Kereskedői tárhelyen lévő gyártói adatlap."
 },
 {
  "id": "steico_protect_l_dry",
  "nev": "Farost homlokzati vakolattartó lap – STEICOprotect L dry",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_szalas",
  "lambda": 0.037,
  "mu": 3,
  "forras": "STEICOprotect dry technical data sheet (EN), 07/2020 – L dry: λD 0,037; ρ ~110; μ 3 – https://www.backtoearth.co.uk/wp-content/uploads/2023/10/STEICOprotect_dry_en_i.pdf",
  "ellenorzott": true,
  "megjegyzes": "ρ≈110 kg/m³. Kereskedői tárhelyen lévő gyártói adatlap."
 },
 {
  "id": "gutex_thermoflex",
  "nev": "Farost hőszigetelő lap (flexibilis) – GUTEX Thermoflex",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_szalas",
  "lambda": 0.036,
  "mu": 2,
  "forras": "GUTEX Thermoflex Technisches Datenblatt, Stand 2024-06-04 – λD 0,036; Bemessungswert 0,038; ρ ~50; μ 2 – https://www.gutex.de/Downloads/PDF/Technisches%20Datenblatt/GUTEX_Thermoflex-TDB_de.pdf",
  "ellenorzott": true,
  "megjegyzes": "Német tervezési érték (λB) 0,038."
 },
 {
  "id": "gutex_multitherm",
  "nev": "Farost tetőhéjazat alatti lap – GUTEX Multitherm",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_szalas",
  "lambda": 0.04,
  "mu": 4,
  "forras": "GUTEX Multitherm Technisches Datenblatt, Stand 2026-01 – λD 0,040; λB 0,042; ρ ~140; μ 4 – https://www.gutex.de/Downloads/PDF/Technisches%20Datenblatt/Gutex_Multitherm_TDB_de.pdf",
  "ellenorzott": true,
  "megjegyzes": "Német tervezési érték (λB) 0,042."
 },
 {
  "id": "gutex_thermowall",
  "nev": "Farost homlokzati vakolattartó lap – GUTEX Thermowall",
  "kategoria": "Hőszigetelés",
  "sraffozas": "hoszigeteles_szalas",
  "lambda": 0.04,
  "mu": 4,
  "forras": "GUTEX Thermowall Technisches Datenblatt, Stand 2025-11 – λD 0,040; λB 0,042; ρ ~160; μ 4 – https://media.holzland.de/docs/86276_Gutex_Thermowall_TDB_de.pdf",
  "ellenorzott": true,
  "megjegyzes": "Német tervezési érték (λB) 0,042. RD 80 mm (N+F) 2,00."
 }
];

ALAP_ANYAGOK.push(...BOVITETT_ANYAGOK, ...TAJEKOZTATO_ANYAGOK, ...GYARTOI_ANYAGOK);
