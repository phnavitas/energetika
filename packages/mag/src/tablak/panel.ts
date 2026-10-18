/**
 * 2. függelék 4.6. táblázat – Lakásépítésben használt vasbeton-szendvicspanelek korszakonkénti, mérés alapján
 * kifejezett átlagos hőátbocsátási tényezői [W/m²K] a kiegészítő hőszigetelés vastagsága (0, 4, 8, 12, 16, 20 cm) szerint.
 * Az értékek az elemen belüli hőhidakat tartalmazzák, a csatlakozási hőhidakat nem (1. függ. 4.1.7).
 * Rétegvastagságok mm-ben: teljes / külső kéreg / hőszigetelés / belső szerkezet; zárójeles alternatív érték a forrásban.
 */

export interface PanelTipus {
  id: string;
  uzem: string;
  gyartasKezdete: number;
  gyartasVege: number | null;
  hoszigeteles: 'EPS' | 'salakgyapot';
  vastagsag: { teljes: string; kulsoKereg: string; hoszigeteles: string; belso: string };
  /** U [W/m²K] kiegészítő hőszigetelés: 0, 4, 8, 12, 16, 20 cm. */
  U: readonly [number, number, number, number, number, number];
}


/** „Készült lakótelepek példák” – a forrásban üzemenként összefüggő cella, nem soronkénti hozzárendelés. */
export const PANEL_UZEM_LAKOTELEPEK: Readonly<Record<string, string>> = {
  'Dunaújváros': 'Dunaújváros: Dózsa városrész, Belváros, Technikum városrész, felső Duna part, Kertváros, Római városrész; Szeged Tarján; Szekszárd Kölcsey lakótelep; Százhalombatta',
  'Pécs': 'Pécs, Siklós',
  'Budapest I.': 'Kelenföld; Óbuda; Csorba úti; Zugló; Békásmegyer; Andor utca; Újpalota; Rákoskeresztúr; Kőbánya Városközpont; Kaszásdűlő; Dunyov úti; Budakeszi',
  'Budapest II.': 'Árpádhídfői; Csepel Városközpont; Újpest Városközpont; Zugló; Szentkorona utcai; Újpalota; Kőbánya-Újhegyi; Újlipótváros; Gogol utca; Csepel-Királymajor; Józsefváros; Kőbánya-Városközpont; Valéria; Mihálkovics utca; Váci-Gyöngyösi utca; Csengettyű utca; Szegedi-Országbíró utca; Rákoskeresztúr; Csepel lakótelep; Gyakorló utca; Viraforgó; Pesterzsébet',
  'Győr': 'Győr: Ady város, József Attila, Marcal, Győr 2, Győr 5; Sopron; Szombathely: KISZ, Joskar-Ola, Derkovits; Sárvár; Körmend; Celldömölk; Tapolca; Balatonfüred; Székesfehérvár; Várpalota; Oroszlány; Tatabánya: Sárberek, Bánhida, Dózsakert, Gál István, Újváros; Budapest: Őrmező, Gazdagrét, Rózsakert; Tata; Komárom',
  'Miskolc': 'Miskolc: Belváros, Győrikapu, Gyula utca, Avas, Bereka, Bodótető, Bolgárföld, Diósgyőr, Jókai utca, Majláth utca, Martin telep, Mátyás király út, Összekötő városrész, Szinvanépkert, Szentpéteri kapu; Kazincbarcika; Salgótarján; Ózd; Eger',
  'Szolnok': 'Szolnok; Karcag; Törökszentmiklós',
  'Budapest III.': 'Újpalota; Kelenföld; Csepel Városközpont; Csángó utca; Zugló; Óbuda; Drégelyvár utca; Kerepesi út; Tüzér utca; Kőbánya-Újhegy; Eperfasor utca; Havanna lakótelep; Vát utca; Kispest; Békásmegyer; Gyakorló utca; Szobor-Faludi utca',
  'Debrecen': 'Debrecen: Újkert, Vénkert, Mester utca, Hüvelyes út, Csapó utca, Doboz út, Burgundia utca, Kandia-Szt Anna utcai, Tócóvölgy, Tócóskert; Budapest: Columbus; Nyíregyháza: Érkert, Örökösföld, Jósaváros',
  'Szeged': 'Szeged: Tarján, Felsőváros, Északváros, Makkosháza, Újrókus, Odessza, Marostő; Kecskemét: Széchenyi város; Budapest: Kaszálórét; Csongrád; Szentes; Hódmezővásárhely; Orosháza; Békéscsaba; Tótkomlós',
  'Budapest IV.': 'Fehérvári út; Gogol utca; Pesterzsébet; Kispest; Csepel; Rákoskeresztúr; Ada utca; Rátz László–Bigszádi út; Adony utca',
  'Veszprém': 'Veszprém: Jutasi út, Cholnoky, Sólyi–Vilonyai utca, Egri út; Ajka: Alkotmány utca, Béke út, Fő utca mellett, Ifjúsági utca, Petőfi S. utca; Siófok; Várpalota; Székesfehérvár; Érd; Budapest: Békásmegyer',
  'Kecskemét': 'Kecskemét: Széchenyi város, Árpád város; Budapest: Pesterzsébet, Csepel, Mézesfehér utca, Rakéta utca; Dunaújváros: Béke városrész; Baja; Nagykőrös; Cegléd; Gödöllő; Kiskunfélegyháza; Kistarcsa; Nagytarcsa; Pécs; Kiskunhalas',
};

export const KIEGESZITO_HOSZIGETELES_CM = [0, 4, 8, 12, 16, 20] as const;

export const PANEL_TIPUSOK: readonly PanelTipus[] = [
  { id: 'dunaujvaros_1967', uzem: 'Dunaújváros', gyartasKezdete: 1967, gyartasVege: 1979, hoszigeteles: 'salakgyapot', vastagsag: { teljes: '300', kulsoKereg: '70', hoszigeteles: '100', belso: '130' }, U: [1.786, 0.68, 0.424, 0.31, 0.244, 0.201] },
  { id: 'dunaujvaros_1977', uzem: 'Dunaújváros', gyartasKezdete: 1977, gyartasVege: 1982, hoszigeteles: 'EPS', vastagsag: { teljes: '300', kulsoKereg: '70', hoszigeteles: '60', belso: '170' }, U: [1.796, 0.672, 0.405, 0.294, 0.234, 0.199] },
  { id: 'dunaujvaros_1982', uzem: 'Dunaújváros', gyartasKezdete: 1982, gyartasVege: null, hoszigeteles: 'EPS', vastagsag: { teljes: '300', kulsoKereg: '70', hoszigeteles: '80', belso: '150' }, U: [1.393, 0.591, 0.392, 0.295, 0.235, 0.191] },
  { id: 'pecs_1971', uzem: 'Pécs', gyartasKezdete: 1971, gyartasVege: 1983, hoszigeteles: 'EPS', vastagsag: { teljes: '250', kulsoKereg: '50', hoszigeteles: '50', belso: '150' }, U: [1.591, 0.662, 0.419, 0.306, 0.241, 0.199] },
  { id: 'pecs_1983', uzem: 'Pécs', gyartasKezdete: 1983, gyartasVege: 1987, hoszigeteles: 'EPS', vastagsag: { teljes: '270', kulsoKereg: '50', hoszigeteles: '70', belso: '150' }, U: [1.323, 0.602, 0.393, 0.292, 0.232, 0.193] },
  { id: 'budapest1_1965', uzem: 'Budapest I.', gyartasKezdete: 1965, gyartasVege: 1967, hoszigeteles: 'salakgyapot', vastagsag: { teljes: '250', kulsoKereg: '50', hoszigeteles: '110', belso: '90' }, U: [1.725, 0.663, 0.417, 0.306, 0.241, 0.199] },
  { id: 'budapest1_1967', uzem: 'Budapest I.', gyartasKezdete: 1967, gyartasVege: 1974, hoszigeteles: 'EPS', vastagsag: { teljes: '250', kulsoKereg: '55', hoszigeteles: '80', belso: '115' }, U: [1.551, 0.639, 0.408, 0.3, 0.237, 0.194] },
  { id: 'budapest1_1975', uzem: 'Budapest I.', gyartasKezdete: 1975, gyartasVege: 1983, hoszigeteles: 'EPS', vastagsag: { teljes: '300', kulsoKereg: '70', hoszigeteles: '80', belso: '150' }, U: [1.612, 0.659, 0.418, 0.305, 0.24, 0.199] },
  { id: 'budapest1_1982', uzem: 'Budapest I.', gyartasKezdete: 1982, gyartasVege: 1990, hoszigeteles: 'EPS', vastagsag: { teljes: '300', kulsoKereg: '70', hoszigeteles: '80', belso: '150' }, U: [1.041, 0.542, 0.367, 0.277, 0.222, 0.186] },
  { id: 'budapest2_1968', uzem: 'Budapest II.', gyartasKezdete: 1968, gyartasVege: 1974, hoszigeteles: 'EPS', vastagsag: { teljes: '265 (210)', kulsoKereg: '65', hoszigeteles: '50', belso: '150 (95)' }, U: [1.495, 0.643, 0.41, 0.301, 0.237, 0.196] },
  { id: 'budapest2_1974', uzem: 'Budapest II.', gyartasKezdete: 1974, gyartasVege: 1987, hoszigeteles: 'EPS', vastagsag: { teljes: '265', kulsoKereg: '65', hoszigeteles: '50', belso: '150' }, U: [1.387, 0.622, 0.402, 0.297, 0.235, 0.194] },
  { id: 'budapest2_1982', uzem: 'Budapest II.', gyartasKezdete: 1982, gyartasVege: null, hoszigeteles: 'EPS', vastagsag: { teljes: '300', kulsoKereg: '70', hoszigeteles: '80', belso: '150' }, U: [1.041, 0.542, 0.367, 0.277, 0.222, 0.186] },
  { id: 'gyor_1968', uzem: 'Győr', gyartasKezdete: 1968, gyartasVege: 1971, hoszigeteles: 'salakgyapot', vastagsag: { teljes: '250', kulsoKereg: '50', hoszigeteles: '100 (75)', belso: '100 (125)' }, U: [1.796, 0.696, 0.431, 0.314, 0.246, 0.202] },
  { id: 'gyor_1971', uzem: 'Győr', gyartasKezdete: 1971, gyartasVege: 1974, hoszigeteles: 'EPS', vastagsag: { teljes: '250', kulsoKereg: '50', hoszigeteles: '50', belso: '150' }, U: [1.981, 0.713, 0.432, 0.312, 0.243, 0.203] },
  { id: 'gyor_1974', uzem: 'Győr', gyartasKezdete: 1974, gyartasVege: 1985, hoszigeteles: 'EPS', vastagsag: { teljes: '265', kulsoKereg: '65', hoszigeteles: '50', belso: '150' }, U: [1.591, 0.662, 0.419, 0.306, 0.241, 0.199] },
  { id: 'gyor_1984', uzem: 'Győr', gyartasKezdete: 1984, gyartasVege: 1990, hoszigeteles: 'EPS', vastagsag: { teljes: '300', kulsoKereg: '70', hoszigeteles: '80', belso: '150' }, U: [1.323, 0.602, 0.393, 0.292, 0.232, 0.193] },
  { id: 'miskolc_1969', uzem: 'Miskolc', gyartasKezdete: 1969, gyartasVege: 1971, hoszigeteles: 'salakgyapot', vastagsag: { teljes: '250', kulsoKereg: '50', hoszigeteles: '100 (75)', belso: '100 (125)' }, U: [1.796, 0.696, 0.431, 0.314, 0.246, 0.202] },
  { id: 'miskolc_1971', uzem: 'Miskolc', gyartasKezdete: 1971, gyartasVege: 1975, hoszigeteles: 'EPS', vastagsag: { teljes: '250', kulsoKereg: '50', hoszigeteles: '50', belso: '150' }, U: [1.981, 0.713, 0.432, 0.312, 0.243, 0.203] },
  { id: 'miskolc_1975', uzem: 'Miskolc', gyartasKezdete: 1975, gyartasVege: 1987, hoszigeteles: 'EPS', vastagsag: { teljes: '265', kulsoKereg: '65', hoszigeteles: '50', belso: '150' }, U: [1.591, 0.662, 0.419, 0.306, 0.241, 0.199] },
  { id: 'miskolc_1985', uzem: 'Miskolc', gyartasKezdete: 1985, gyartasVege: 1989, hoszigeteles: 'EPS', vastagsag: { teljes: '300', kulsoKereg: '70', hoszigeteles: '80', belso: '150' }, U: [1.323, 0.602, 0.393, 0.292, 0.232, 0.193] },
  { id: 'szolnok_1989', uzem: 'Szolnok', gyartasKezdete: 1989, gyartasVege: 1991, hoszigeteles: 'EPS', vastagsag: { teljes: '260 (220)', kulsoKereg: '60', hoszigeteles: '60', belso: '160 (100)' }, U: [1.553, 0.655, 0.416, 0.304, 0.24, 0.198] },
  { id: 'budapest3_1971', uzem: 'Budapest III.', gyartasKezdete: 1971, gyartasVege: 1987, hoszigeteles: 'EPS', vastagsag: { teljes: '250', kulsoKereg: '60', hoszigeteles: '55-75', belso: '120-140' }, U: [1.457, 0.611, 0.406, 0.299, 0.237, 0.196] },
  { id: 'budapest3_1984', uzem: 'Budapest III.', gyartasKezdete: 1984, gyartasVege: 1994, hoszigeteles: 'EPS', vastagsag: { teljes: '300', kulsoKereg: '70', hoszigeteles: '80', belso: '150' }, U: [1.067, 0.546, 0.369, 0.276, 0.223, 0.186] },
  { id: 'debrecen_1970', uzem: 'Debrecen', gyartasKezdete: 1970, gyartasVege: 1989, hoszigeteles: 'EPS', vastagsag: { teljes: '250', kulsoKereg: '60', hoszigeteles: '55-75', belso: '120-140' }, U: [1.457, 0.611, 0.406, 0.299, 0.237, 0.196] },
  { id: 'debrecen_1987', uzem: 'Debrecen', gyartasKezdete: 1987, gyartasVege: 1994, hoszigeteles: 'EPS', vastagsag: { teljes: '300', kulsoKereg: '70', hoszigeteles: '80', belso: '150' }, U: [1.067, 0.546, 0.369, 0.278, 0.223, 0.186] },
  { id: 'szeged_1971', uzem: 'Szeged', gyartasKezdete: 1971, gyartasVege: 1987, hoszigeteles: 'EPS', vastagsag: { teljes: '250', kulsoKereg: '60', hoszigeteles: '55-75', belso: '120-140' }, U: [1.457, 0.611, 0.406, 0.299, 0.237, 0.196] },
  { id: 'szeged_1982', uzem: 'Szeged', gyartasKezdete: 1982, gyartasVege: 1987, hoszigeteles: 'EPS', vastagsag: { teljes: '300', kulsoKereg: '70', hoszigeteles: '80', belso: '150' }, U: [1.067, 0.546, 0.369, 0.278, 0.223, 0.186] },
  { id: 'budapest4_1974', uzem: 'Budapest IV.', gyartasKezdete: 1974, gyartasVege: 1983, hoszigeteles: 'EPS', vastagsag: { teljes: '300', kulsoKereg: '70', hoszigeteles: '80', belso: '150' }, U: [1.612, 0.659, 0.418, 0.305, 0.24, 0.199] },
  { id: 'budapest4_1981', uzem: 'Budapest IV.', gyartasKezdete: 1981, gyartasVege: 1990, hoszigeteles: 'EPS', vastagsag: { teljes: '300', kulsoKereg: '70', hoszigeteles: '80', belso: '150' }, U: [1.041, 0.542, 0.367, 0.277, 0.222, 0.186] },
  { id: 'veszprem_1975', uzem: 'Veszprém', gyartasKezdete: 1975, gyartasVege: 1981, hoszigeteles: 'EPS', vastagsag: { teljes: '300', kulsoKereg: '70', hoszigeteles: '80', belso: '150' }, U: [1.612, 0.659, 0.418, 0.305, 0.24, 0.199] },
  { id: 'veszprem_1981', uzem: 'Veszprém', gyartasKezdete: 1981, gyartasVege: 1986, hoszigeteles: 'EPS', vastagsag: { teljes: '300', kulsoKereg: '70', hoszigeteles: '80', belso: '150' }, U: [1.041, 0.542, 0.367, 0.277, 0.222, 0.186] },
  { id: 'kecskemet_1976', uzem: 'Kecskemét', gyartasKezdete: 1976, gyartasVege: 1987, hoszigeteles: 'EPS', vastagsag: { teljes: '300', kulsoKereg: '70', hoszigeteles: '80', belso: '150' }, U: [1.612, 0.659, 0.418, 0.305, 0.24, 0.199] },
  { id: 'kecskemet_1985', uzem: 'Kecskemét', gyartasKezdete: 1985, gyartasVege: 1987, hoszigeteles: 'EPS', vastagsag: { teljes: '300', kulsoKereg: '70', hoszigeteles: '80', belso: '150' }, U: [1.041, 0.542, 0.367, 0.277, 0.222, 0.186] },
];

/** Panel U-érték adott kiegészítő hőszigeteléssel. A forrás csak 4 cm-es lépcsőket ad; köztes vastagságnál
 * lineáris interpolációval közelítünk (a módszer erről nem rendelkezik), ezért ilyenkor figyelmeztetés jár. */
export function panelU(tipus: PanelTipus, kiegeszitoCm: number): number {
  const x = Math.min(Math.max(kiegeszitoCm, 0), 20);
  const i = Math.min(Math.floor(x / 4), 4);
  const x0 = i * 4;
  const u0 = tipus.U[i]!;
  const u1 = tipus.U[i + 1]!;
  return u0 + ((u1 - u0) * (x - x0)) / 4;
}
