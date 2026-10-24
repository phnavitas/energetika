/**
 * Szkennelt (szöveg nélküli) távhő-adatszolgáltatások kézzel kiolvasott értékei – e-építés (Lechner) nyilvántartás,
 * a 2026. 10. 24-én elérhető legutóbbi dokumentumok. Kulcs: a PDF azonosítója (download?id=…); ha a szolgáltató új
 * dokumentumot tölt fel, annak más az azonosítója, és a program OCR-rel olvassa ki / ellenőrzésre jelzi.
 * `elavult`: a dokumentum még a 7/2006 TNM szerinti (primerenergia-tényező + megújuló részarány) – 9/2023 ÉKM szerinti
 * tényező nincs, a 7. melléklet alapértéke érvényes (1,38 / 0 / 374), amíg a szolgáltató nem ad újat.
 */
export interface KiolvasottSor { telepules: string; rendszer: string; fnren: number; fren: number; ftot: number | null; fCO2: number | null; megjegyzes?: string }
export interface KiolvasottDok { szolgaltatoId: number; szolgaltato: string; kelt: string; adatEv: number; sorok: KiolvasottSor[]; elavult?: string }

const s = (telepules: string, rendszer: string, fnren: number, fren: number, ftot: number | null, fCO2: number | null, megjegyzes?: string): KiolvasottSor =>
  ({ telepules, rendszer, fnren, fren, ftot, fCO2, ...(megjegyzes ? { megjegyzes } : {}) });
const TNM = (x: string) => `7/2006 TNM szerinti adatszolgáltatás (${x}) – 9/2023 ÉKM szerinti tényező nincs, a 7. melléklet alapértéke érvényes.`;

export const TAVHO_KIOLVASOTT: Readonly<Record<number, KiolvasottDok>> = {
  928: { szolgaltatoId: 36, szolgaltato: 'T-SZOL Zrt.', kelt: '2025.03.31', adatEv: 2024, sorok: [s('Tatabánya', 'Tatabányai távhőrendszer', 0.251, 0.831, 1.082, 55.789), s('Baj', 'Baji távhőrendszer', 1.374, 0.004, 1.377, 368.938)] },
  988: { szolgaltatoId: 53, szolgaltato: 'Tata Energia Kft.', kelt: '2026.01.30', adatEv: 2025, sorok: [s('Tata', 'Tata Gesztenye fasor', 1.38, 0, 1.38, 374), s('Tata', 'Tata Városi rendszer', 0.85, 1.056, 1.906, 211.428)] },
  1009: { szolgaltatoId: 30, szolgaltato: 'MIHŐ Kft.', kelt: '2026.02.12', adatEv: 2025, sorok: [
    s('Miskolc', 'Belvárosi Terület', 0.257, 0.905, 1.162, 92.627), s('Miskolc', 'Avasi Terület', 0.379, 0.849, 1.228, 124.057),
    s('Miskolc', 'Diósgyőri Fűtőmű', 1.001, 0.003, 1.004, 268.670), s('Miskolc', 'Bulgárföldi Fűtőmű', 1.472, 0.004, 1.476, 395.420),
    s('Miskolc', 'Kilián-Dél (Kenderföldi) Kazánház', 0.604, 0.976, 1.580, 147.372), s('Miskolc', '10. sz. Általános Iskola Kazánház', 1.479, 0.004, 1.483, 397.229),
    s('Miskolc', 'Csabai kapui Kazánház', 1.479, 0.004, 1.483, 397.229), s('Miskolc', 'HCM Kazánház', 1.471, 0.004, 1.475, 394.916),
    s('Miskolc', 'Kőrösi Csoma Sándor Kazánház', 1.479, 0.004, 1.483, 397.229), s('Miskolc', 'Komlóstetői Kazánház', 1.479, 0.004, 1.483, 397.229)] },
  965: { szolgaltatoId: 74, szolgaltato: 'NÁNÁSHŐ Kft.', kelt: '2026.01.26', adatEv: 2025, sorok: [s('Hajdúnánás', 'Hajdúnánás városi távhőrendszer', 1.143, 0.006, 1.149, 305.955)] },
  930: { szolgaltatoId: 48, szolgaltato: 'Ózdi Távhő Kft.', kelt: '2025.04.15', adatEv: 2020, sorok: [], elavult: TNM('Ózd városi távhőrendszer: primerenergia-tényező 1,0914, megújuló részarány 0,0008') },
  314: { szolgaltatoId: 18, szolgaltato: 'ALFA-NOVA Kft. Szolnoki Területi Igazgatóság', kelt: '2021.02.01', adatEv: 2020, sorok: [], elavult: TNM('Szolnok, 2020') },
  920: { szolgaltatoId: 4, szolgaltato: 'ALFEN Kft.', kelt: '2025.03.13', adatEv: 2024, sorok: [s('Almásfüzitő', 'ALFEN', 0.53, 0.43, 0.89, null, 'A dokumentumban nren + ren ≠ tot (0,53 + 0,43 ≠ 0,89), CO₂-tényező nincs megadva – a szolgáltatónál pontosítandó.')] },
  1012: { szolgaltatoId: 76, szolgaltato: '"ARIES" Nonprofit Kft.', kelt: '2026.02.02', adatEv: 2025, sorok: [s('Szigetszentmiklós', 'ARIES Távhő, Határ út 12-14.', 1.633, 0.006, 1.639, 439.653)] },
  976: { szolgaltatoId: 83, szolgaltato: 'Bakonyi Erőmű Zrt.', kelt: '2026.02.05', adatEv: 2025, sorok: [s('Ajka', 'Ajka – Kandó Kálmán ltp.', 0.126, 0.451, 0.577, 25.769)] },
  1026: { szolgaltatoId: 44, szolgaltato: 'Barcika Szolg Kft.', kelt: '2026.05.07', adatEv: 2025, sorok: [s('Kazincbarcika', 'Kazincbarcika', 1.132, 0.001, 1.133, 305.225)] },
  430: { szolgaltatoId: 61, szolgaltato: 'BTG Nonprofit Kft.', kelt: '2021.02.15', adatEv: 2020, sorok: [], elavult: TNM('Budaörsi távhőellátás, 2020') },
  834: { szolgaltatoId: 79, szolgaltato: 'D.C.THERM Kft.', kelt: '2024.04.22', adatEv: 2023, sorok: [s('Paks', 'A teljes lakótelep városi forróvíz hálózat rendszere (MVM Paksi Atomerőmű hője)', 0, 0, 0, 74.55, 'A dokumentum nren = ren = tot = 0 mellett 74,55 g/kWh CO₂-t ad meg – ellenőrizendő.')] },
  918: { szolgaltatoId: 43, szolgaltato: 'Dunakeszi Közüzemi Nonprofit Kft.', kelt: '2025.03.10', adatEv: 2024, sorok: [s('Dunakeszi', 'Termidor távhőrendszer', 1.1, 0, 1.1, 297)] },
  963: { szolgaltatoId: 11, szolgaltato: 'Kaposvári Vagyonkezelő Zrt.', kelt: '2026.02.04', adatEv: 2025, sorok: [s('Kaposvár', 'Kaposvári 1. távhőrendszer', 0.66, 0.78, 1.44, 153.623)] },
  1006: { szolgaltatoId: 17, szolgaltato: 'KECSKEMÉTI TERMOSTAR Hőszolgáltató Kft.', kelt: '2026.02.13', adatEv: 2024, sorok: [s('Kecskemét', 'Egységesített kecskeméti távhőrendszer', 0.658, 1.118, 1.776, 158.680)] },
  407: { szolgaltatoId: 69, szolgaltato: 'Kisvárdai Közmű Kft.', kelt: '2020.02.15', adatEv: 2020, sorok: [], elavult: TNM('Kisvárda, 2020') },
  582: { szolgaltatoId: 5, szolgaltato: 'Komáromi Távhő Kft.', kelt: '2022.02.14', adatEv: 2021, sorok: [], elavult: TNM('Komárom, 2021') },
  1028: { szolgaltatoId: 41, szolgaltato: 'Komlói Fűtőerőmű Zrt.', kelt: '2026.05.20', adatEv: 2025, sorok: [s('Komló', 'Komlói távhőrendszer', 0.57, 1.25, 1.82, 134)] },
  967: { szolgaltatoId: 71, szolgaltato: 'Makói Városgazdálkodási Nonprofit Kft.', kelt: '2026.02.05', adatEv: 2025, sorok: [s('Makó', 'Makói hidraulikailag egységes hurkolt és sugaras távhőhálózat', 0.1149, 0.9442, 1.0547, 49.7298)] },
  255: { szolgaltatoId: 59, szolgaltato: 'Patakhő Energiaszolgáltató Nonprofit Kft.', kelt: '2020.02.21', adatEv: 2019, sorok: [], elavult: TNM('Sárospatak, 2019') },
  926: { szolgaltatoId: 47, szolgaltato: 'PÉTKOMM Kft.', kelt: '2025.03.31', adatEv: 2024, sorok: [s('Pétfürdő', 'Pétfürdő belső- és külső köri rendszer', 1.352, 0.005, 1.357, 362.104)] },
  1013: { szolgaltatoId: 22, szolgaltato: 'Régióhő Kft.', kelt: '2026.01.30', adatEv: 2025, sorok: [
    s('Körmend', 'Városi fűtőmű, IV. Béla k. u. 4.', 0.667, 0.609, 1.276, 169.029), s('Körmend', 'Szabadság tér 5. kazánház', 1.235, 0.01, 1.245, 327.955),
    s('Körmend', 'Kossuth L. u. kazánház', 1.158, 0, 1.158, 312.632), s('Szentgotthárd', 'Mártírok u. 1. kazánház', 1.182, 0.003, 1.185, 317.544),
    s('Szentgotthárd', 'Széll K. tér 11. kazánház', 1.199, 0.005, 1.205, 320.8), s('Vasvár', 'Béke u. kazánház', 0.414, 0.672, 1.086, 129.173),
    s('Vasvár', 'Járdányi u. kazánház', 0.456, 0.644, 1.1, 139.184)] },
  1000: { szolgaltatoId: 19, szolgaltato: 'Sárvári Városgondnokság Nonprofit Kft.', kelt: '2026.02.12', adatEv: 2025, sorok: [
    s('Sárvár', 'Deák Ferenc utcai kazánház', 1.767, 0, 1.77, 475.2), s('Sárvár', 'Széchenyi utcai hőközpont', 1.478, 0, 1.48, 397.9),
    s('Sárvár', 'Rákóczi utcai kórház kazánház', 1.355, 0, 1.359, 364.1, 'A dokumentumban nren + ren ≠ tot (1,355 ≠ 1,359).')] },
  1014: { szolgaltatoId: 13, szolgaltato: 'Sopron Holding Zrt.', kelt: '2026.02.05', adatEv: 2025, sorok: [
    s('Sopron', 'Sopron Holding Hőközpont utca', 0.89, 0, 0.89, 240.297), s('Sopron', 'Alteo-Therm Kft.', 1.111, 0, 1.111, 300.018), s('Sopron', 'Kórház gőz', 1.21, 0, 1.21, 326.7)] },
  98: { szolgaltatoId: 23, szolgaltato: 'Szekszárdi Távhőszolgáltató NKft.', kelt: '2020.02.11', adatEv: 2019, sorok: [], elavult: TNM('Szekszárd, 2019') },
  242: { szolgaltatoId: 56, szolgaltato: 'Szentlőrinci Közüzemi Nonprofit Kft.', kelt: '2020.02.14', adatEv: 2019, sorok: [], elavult: TNM('Szentlőrinc, 2019: primerenergia-tényező 0,0384, megújuló részarány 0,9902') },
  812: { szolgaltatoId: 77, szolgaltato: 'Szigetvári Távhő NKft.', kelt: '2024.03.05', adatEv: 2023, sorok: [
    s('Szigetvár', 'Szent István ltp.-i távhőrendszer', 1.1108, 0.1806, 1.2914, 346.365), s('Szigetvár', 'Radován tér 3. távhőrendszer', 1.35, 0.0011, 1.3511, 360.45),
    s('Szigetvár', 'Zrínyi tér 3. távhőrendszer', 1.35, 0.0011, 1.3511, 360.45)] },
  439: { szolgaltatoId: 62, szolgaltato: 'Termofok-Sió Kft.', kelt: '2021.02.15', adatEv: 2020, sorok: [], elavult: TNM('Siófok, 2020') },
  598: { szolgaltatoId: 42, szolgaltato: 'TiszaSzolg 2004 Kft.', kelt: '2022.02.15', adatEv: 2021, sorok: [], elavult: TNM('Tiszaújváros, 2021') },
  608: { szolgaltatoId: 55, szolgaltato: 'Városgondozási Zrt.', kelt: '2022.02.15', adatEv: 2021, sorok: [], elavult: TNM('Gyöngyös, 2021') },
  954: { szolgaltatoId: 7, szolgaltato: 'Várpalotai Közszolgáltató Nonprofit Kft.', kelt: '2026.02.03', adatEv: 2025, sorok: [
    s('Várpalota', 'Várpalota távhő', 1.506, 0.006, 1.512, 403.497), s('Inota', 'Inota Készenléti lakótelep', 1.557, 0.014, 1.571, 412.875)] },
  554: { szolgaltatoId: 39, szolgaltato: 'VÜZ Nonprofit Kft.', kelt: '2022.02.09', adatEv: 2021, sorok: [], elavult: TNM('Keszthely, 2021') },
};
