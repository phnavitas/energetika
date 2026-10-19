/**
 * Magyar lakóépület-tipológia (TABULA/EPISCOPE, BME 2014) – kortipikus határoló szerkezetek épületcsoportonként és
 * korszakonként, eredeti állapotban és a brosúra felújítási (2006 utáni típusoknál új építési) változataival.
 * A brosúra rétegrendet és U értéket közöl, hővezetési tényezőt nem: a programba ezért a forrás szerinti U-val
 * egyenértékű ellenállású szerkezetként kerülnek be. A panelházak a 9/2023 ÉKM 2. függelék 4.6. táblázatában
 * vannak (panel.ts). Gépi kivonat a forrásokból; az eltéréseket a `megjegyzes` mező jelzi.
 */
export type TipologiaSzerep = 'fal' | 'padlasfodem' | 'magastető' | 'lapostető' | 'padlo_talajon' | 'pince_feletti_fodem' | 'ablak' | 'ajto';
export type TipologiaCsoport = 'csaladi_haz' | 'tarsashaz' | 'nagy_tarsashaz' | 'polgari' | 'paraszthaz' | 'sorhaz';
export interface TipologiaSzerkezet { szerep: TipologiaSzerep; leiras: string; retegek: { nev: string; dCm: number | null }[]; U: number; g?: number; forras: string; megjegyzes?: string; becsles?: boolean }
export interface TipologiaTipus {
  kod: string; csoport: TipologiaCsoport; tovabbiCsoport?: TipologiaCsoport; korszak: [number | null, number | null]; nev: string; leiras: string;
  szerkezetek: TipologiaSzerkezet[];
  valtozatok: { szint: 'szokasos' | 'halado' | 'alacsony_energia' | 'kozel_nulla'; szerkezetek: TipologiaSzerkezet[] }[];
}

export const TIPOLOGIA_FORRASOK = [
  {
    "id": "tabula_hu_2014",
    "cim": "Lakóépület tipológia Magyarországon / National Typology of Residential Buildings in Hungary (TABULA/EPISCOPE brosúra)",
    "szerzo": "Csoknyai T., Hrabovszky-Horváth S., Szalay Zs. és tsai, BME (2014)",
    "url": "https://episcope.eu/fileadmin/tabula/public/docs/brochure/HU_TABULA_TypologyBrochure_BME.pdf",
    "megjegyzes": "90 oldalas kétnyelvű PDF; az oldalszámok a 'BME nn' lábléc szerintiek. Szerkezeti táblák: 'Külső határoló szerkezetek' oldalak (25, 29, 33, 37, 41, 45, 53, 57, 65, 69, 73, 77–78, 82). λ-értéket a brosúra NEM közöl. Felújítási szintek: Általános felújítás (=szokasos), Mélyfelújítás (=halado). A szerzőlista nem a PDF-ből lett ellenőrizve."
  },
  {
    "id": "tabula_calc_db",
    "cim": "TABULA/EPISCOPE számítóadatbázis (tabula-calculator.xlsx) – HU 'ReEx' (eredeti állapot) épületváltozatok",
    "szerzo": "IWU / TABULA-EPISCOPE konzorcium; CSV-kivonat a FZJ-IEK3-VSA/tsib GitHub-tárolóból (tsib/data/episcope/episcope.csv)",
    "url": "https://github.com/FZJ-IEK3-VSA/tsib/blob/master/tsib/data/episcope/episcope.csv",
    "megjegyzes": "Csak eredeti állapot U-értékei (U_Wall/Roof/Floor/Window/Door), g_gl_n, hőhíd-pótlék (ΔU 0,15 / 0,10 / 0,05 W/m²K korszaktól függően) és geometria; szerkezetleírás és felújítási változat nincs benne. U_tabula_db mezőben szerepel, ahol eltér vagy megerősít."
  }
] as const;

export const VALTOZAT_NEV = { eredeti: 'Eredeti állapot', szokasos: 'Általános felújítás', halado: 'Mélyfelújítás', alacsony_energia: 'Alacsony energiaigényű változat', kozel_nulla: 'Közel nulla energiaigényű változat' } as const;
export const CSOPORT_NEV: Record<TipologiaCsoport, string> = { csaladi_haz: 'Családi ház', tarsashaz: 'Társasház (hagyományos technológia)', nagy_tarsashaz: 'Nagy társasház (nem panel)', polgari: 'Polgári bérház (1945 előtt)', paraszthaz: 'Hagyományos parasztház (vályog)', sorhaz: 'Sorház, ikerház' };

export const TIPOLOGIA: readonly TipologiaTipus[] = [
 {
  "kod": "HU.N.SFH.01.Gen",
  "csoport": "csaladi_haz",
  "korszak": [
   null,
   1944
  ],
  "nev": "1944 előtt épült családi ház (>80 m²)",
  "leiras": "Hagyományos technológia: vályog külső fal, agyagtapasztású fafödém, üres padlástér; földszintes, 1 lakás, nettó fűtött alapterület 101,8 m² (brosúra 24. o.; DB).",
  "szerkezetek": [
   {
    "szerep": "fal",
    "leiras": "Vályogfal 60 cm, kétoldalt vakolt",
    "retegek": [
     {
      "nev": "vakolat",
      "dCm": 1.5
     },
     {
      "nev": "vályogfal",
      "dCm": 60
     },
     {
      "nev": "vakolat",
      "dCm": 1.5
     }
    ],
    "U": 0.94,
    "forras": "tabula_hu_2014, 25. o.; tabula_calc_db"
   },
   {
    "szerep": "padlasfodem",
    "leiras": "Agyagtapasztású borított fafödém (fagerendák 60–80 cm-enként)",
    "retegek": [
     {
      "nev": "fagerenda (60–80 cm-enként)",
      "dCm": null
     },
     {
      "nev": "deszkázat",
      "dCm": 2.5
     },
     {
      "nev": "agyagtapasztás",
      "dCm": 15
     }
    ],
    "U": 2.01,
    "forras": "tabula_hu_2014, 25. o.; tabula_calc_db",
    "megjegyzes": "Az agyagréteg a magyar szövegben 15 cm, az angolban 5 cm – a forrás ellentmondásos."
   },
   {
    "szerep": "padlo_talajon",
    "leiras": "Hajópadló párnafán, döngölt agyag, kavicsfeltöltés",
    "retegek": [
     {
      "nev": "hajópadló",
      "dCm": 3
     },
     {
      "nev": "párnafák között döngölt agyag",
      "dCm": 10
     },
     {
      "nev": "kavicsfeltöltés",
      "dCm": 15
     }
    ],
    "U": 1.06,
    "forras": "tabula_hu_2014, 25. o.; tabula_calc_db"
   },
   {
    "szerep": "ablak",
    "leiras": "Kapcsolt gerébtokos vagy pallótokos fa ablak, egyszeres üvegezés",
    "retegek": [],
    "U": 3.0,
    "g": 0.75,
    "forras": "tabula_hu_2014, 25. o.; tabula_calc_db; g: tabula_calc_db (g_gl_n, normál beesésű üvegezés)",
    "megjegyzes": "A brosúra 3,00-t, a TABULA számítóadatbázis 3,5-öt ad."
   },
   {
    "szerep": "ajto",
    "leiras": "Régi fa bejárati ajtó",
    "retegek": [],
    "U": 3.5,
    "forras": "tabula_hu_2014, 25. o.; tabula_calc_db"
   }
  ],
  "valtozatok": [
   {
    "szint": "szokasos",
    "szerkezetek": [
     {
      "szerep": "fal",
      "leiras": "Meglévő falra kívül 5 cm hőszigetelés",
      "retegek": [
       {
        "nev": "meglévő fal",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 5
       }
      ],
      "U": 0.41,
      "forras": "tabula_hu_2014, 25. o."
     },
     {
      "szerep": "padlasfodem",
      "leiras": "Meglévő födémre felül 12 cm hőszigetelés",
      "retegek": [
       {
        "nev": "meglévő födém",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 12
       }
      ],
      "U": 0.26,
      "forras": "tabula_hu_2014, 25. o."
     },
     {
      "szerep": "padlo_talajon",
      "leiras": "Nincs változás",
      "retegek": [],
      "U": 1.06,
      "forras": "tabula_hu_2014, 25. o."
     },
     {
      "szerep": "ablak",
      "leiras": "Hőszigetelt, kétrétegű üvegezésű ablak, low-e bevonattal, argon gáztöltéssel",
      "retegek": [],
      "U": 1.6,
      "forras": "tabula_hu_2014, 25. o."
     },
     {
      "szerep": "ajto",
      "leiras": "Új hőszigetelt bejárati ajtó",
      "retegek": [],
      "U": 1.8,
      "forras": "tabula_hu_2014, 25. o."
     }
    ]
   },
   {
    "szint": "halado",
    "szerkezetek": [
     {
      "szerep": "fal",
      "leiras": "Meglévő falra kívül 16 cm hőszigetelés",
      "retegek": [
       {
        "nev": "meglévő fal",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 16
       }
      ],
      "U": 0.19,
      "forras": "tabula_hu_2014, 25. o."
     },
     {
      "szerep": "padlasfodem",
      "leiras": "Meglévő födémre felül 28 cm hőszigetelés",
      "retegek": [
       {
        "nev": "meglévő födém",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 28
       }
      ],
      "U": 0.13,
      "forras": "tabula_hu_2014, 25. o."
     },
     {
      "szerep": "padlo_talajon",
      "leiras": "Nincs változás",
      "retegek": [],
      "U": 1.06,
      "forras": "tabula_hu_2014, 25. o."
     },
     {
      "szerep": "ablak",
      "leiras": "Háromrétegű üvegezésű ablak, low-e bevonattal, argon gáztöltéssel",
      "retegek": [],
      "U": 1.0,
      "forras": "tabula_hu_2014, 25. o."
     },
     {
      "szerep": "ajto",
      "leiras": "Új hőszigetelt bejárati ajtó",
      "retegek": [],
      "U": 1.3,
      "forras": "tabula_hu_2014, 25. o."
     }
    ]
   }
  ],
  "tovabbiCsoport": "paraszthaz"
 },
 {
  "kod": "HU.N.SFH.01.Bel80",
  "csoport": "csaladi_haz",
  "korszak": [
   null,
   1944
  ],
  "nev": "1944 előtt épült kis családi ház (<80 m²)",
  "leiras": "Gyakran vályog szerkezetű, átlagos alapterület 56 m², földszintes (brosúra 32. o.). A számítóadatbázis-kivonatban nem szerepel.",
  "szerkezetek": [
   {
    "szerep": "fal",
    "leiras": "Vályogfal 60 cm, kétoldalt vakolt",
    "retegek": [
     {
      "nev": "vakolat",
      "dCm": 1.5
     },
     {
      "nev": "vályogfal",
      "dCm": 60
     },
     {
      "nev": "vakolat",
      "dCm": 1.5
     }
    ],
    "U": 0.94,
    "forras": "tabula_hu_2014, 33. o."
   },
   {
    "szerep": "padlasfodem",
    "leiras": "Agyagtapasztású borított fafödém (fagerendák 60–80 cm-enként)",
    "retegek": [
     {
      "nev": "fagerenda (60–80 cm-enként)",
      "dCm": null
     },
     {
      "nev": "deszkázat",
      "dCm": 2.5
     },
     {
      "nev": "agyagtapasztás",
      "dCm": 10
     }
    ],
    "U": 2.01,
    "forras": "tabula_hu_2014, 33. o."
   },
   {
    "szerep": "padlo_talajon",
    "leiras": "Hajópadló párnafán, döngölt agyag, kavicsfeltöltés",
    "retegek": [
     {
      "nev": "hajópadló",
      "dCm": 3
     },
     {
      "nev": "párnafák között döngölt agyag",
      "dCm": 10
     },
     {
      "nev": "kavicsfeltöltés",
      "dCm": 15
     }
    ],
    "U": 1.06,
    "forras": "tabula_hu_2014, 33. o."
   },
   {
    "szerep": "ablak",
    "leiras": "Kapcsolt gerébtokos vagy pallótokos fa ablak, egyszeres üvegezés",
    "retegek": [],
    "U": 3.0,
    "forras": "tabula_hu_2014, 33. o."
   },
   {
    "szerep": "ajto",
    "leiras": "Régi fa bejárati ajtó",
    "retegek": [],
    "U": 3.5,
    "forras": "tabula_hu_2014, 33. o."
   }
  ],
  "valtozatok": [
   {
    "szint": "szokasos",
    "szerkezetek": [
     {
      "szerep": "fal",
      "leiras": "Meglévő falra kívül 5 cm hőszigetelés",
      "retegek": [
       {
        "nev": "meglévő fal",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 5
       }
      ],
      "U": 0.43,
      "forras": "tabula_hu_2014, 33. o."
     },
     {
      "szerep": "padlasfodem",
      "leiras": "Meglévő födémre felül 12 cm hőszigetelés",
      "retegek": [
       {
        "nev": "meglévő födém",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 12
       }
      ],
      "U": 0.26,
      "forras": "tabula_hu_2014, 33. o."
     },
     {
      "szerep": "padlo_talajon",
      "leiras": "A szöveg szerint 'nincs változás', mégis 0,63 U szerepel",
      "retegek": [],
      "U": 0.63,
      "forras": "tabula_hu_2014, 33. o.",
      "megjegyzes": "Forráshiba valószínű (leírás: nincs változás, U 1,06→0,63)."
     },
     {
      "szerep": "ablak",
      "leiras": "Fa vagy műanyag ablak, hőszigetelt, kétrétegű üvegezésű ablak, low-e bevonattal, argon gáztöltéssel",
      "retegek": [],
      "U": 1.6,
      "forras": "tabula_hu_2014, 33. o."
     },
     {
      "szerep": "ajto",
      "leiras": "Új hőszigetelt bejárati ajtó",
      "retegek": [],
      "U": 1.8,
      "forras": "tabula_hu_2014, 33. o."
     }
    ]
   },
   {
    "szint": "halado",
    "szerkezetek": [
     {
      "szerep": "fal",
      "leiras": "Meglévő falra kívül 16 cm hőszigetelés",
      "retegek": [
       {
        "nev": "meglévő fal",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 16
       }
      ],
      "U": 0.2,
      "forras": "tabula_hu_2014, 33. o."
     },
     {
      "szerep": "padlasfodem",
      "leiras": "Meglévő födémre felül 28 cm hőszigetelés",
      "retegek": [
       {
        "nev": "meglévő födém",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 28
       }
      ],
      "U": 0.13,
      "forras": "tabula_hu_2014, 33. o."
     },
     {
      "szerep": "padlo_talajon",
      "leiras": "A szöveg szerint 'nincs változás', mégis 0,63 U szerepel",
      "retegek": [],
      "U": 0.63,
      "forras": "tabula_hu_2014, 33. o.",
      "megjegyzes": "Forráshiba valószínű."
     },
     {
      "szerep": "ablak",
      "leiras": "Fa-alumínium ablak, háromrétegű üvegezésű ablak, low-e bevonattal, argon gáztöltéssel",
      "retegek": [],
      "U": 1.0,
      "forras": "tabula_hu_2014, 33. o."
     },
     {
      "szerep": "ajto",
      "leiras": "Új hőszigetelt bejárati ajtó",
      "retegek": [],
      "U": 1.3,
      "forras": "tabula_hu_2014, 33. o."
     }
    ]
   }
  ],
  "tovabbiCsoport": "paraszthaz"
 },
 {
  "kod": "HU.N.MFH.01.Gen",
  "csoport": "polgari",
  "korszak": [
   null,
   1944
  ],
  "nev": "1945 előtt épült belvárosi bérház jellegű társasház",
  "leiras": "Hagyományos technológia: tömör tégla külső fal, fafödém ill. poroszsüveg födém, üres padlástér, pince (brosúra 28. o.). DB: 3 szint, 23 lakás, A_ref 1328 m².",
  "szerkezetek": [
   {
    "szerep": "fal",
    "leiras": "51 cm tömör téglafal, kétoldalt vakolt",
    "retegek": [
     {
      "nev": "vakolat",
      "dCm": 1.5
     },
     {
      "nev": "tömör tégla",
      "dCm": 51
     },
     {
      "nev": "vakolat",
      "dCm": 1.5
     }
    ],
    "U": 1.1,
    "forras": "tabula_hu_2014, 29. o.; tabula_calc_db"
   },
   {
    "szerep": "padlasfodem",
    "leiras": "Csapos gerendafödém agyagfeltöltéssel, nádszövet + vakolat",
    "retegek": [
     {
      "nev": "vakolat",
      "dCm": 2
     },
     {
      "nev": "nádszövet",
      "dCm": 1.5
     },
     {
      "nev": "fagerenda",
      "dCm": 20
     },
     {
      "nev": "agyagfeltöltés",
      "dCm": 6
     }
    ],
    "U": 0.64,
    "forras": "tabula_hu_2014, 29. o.; tabula_calc_db"
   },
   {
    "szerep": "pince_feletti_fodem",
    "leiras": "Poroszsüveg födém (téglaboltozat acélgerendák között)",
    "retegek": [
     {
      "nev": "kerámia burkolat",
      "dCm": 2
     },
     {
      "nev": "aljzatbeton",
      "dCm": 5
     },
     {
      "nev": "salakfeltöltés",
      "dCm": 15
     },
     {
      "nev": "téglaboltozat (acélgerendák között)",
      "dCm": 12
     }
    ],
    "U": 0.97,
    "forras": "tabula_hu_2014, 29. o.; tabula_calc_db"
   },
   {
    "szerep": "ablak",
    "leiras": "Kapcsolt gerébtokos vagy pallótokos fa ablak, egyszeres üvegezés",
    "retegek": [],
    "U": 3.0,
    "g": 0.75,
    "forras": "tabula_hu_2014, 29. o.; tabula_calc_db; g: tabula_calc_db (g_gl_n, normál beesésű üvegezés)",
    "megjegyzes": "Brosúra 3,00 vs. DB 3,5."
   },
   {
    "szerep": "ajto",
    "leiras": "Régi fa bejárati ajtó",
    "retegek": [],
    "U": 3.5,
    "forras": "tabula_hu_2014, 29. o.; tabula_calc_db"
   }
  ],
  "valtozatok": [
   {
    "szint": "szokasos",
    "szerkezetek": [
     {
      "szerep": "fal",
      "leiras": "Meglévő falra kívül 5 cm hőszigetelés",
      "retegek": [
       {
        "nev": "meglévő fal",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 5
       }
      ],
      "U": 0.46,
      "forras": "tabula_hu_2014, 29. o."
     },
     {
      "szerep": "padlasfodem",
      "leiras": "Meglévő födémre felül 12 cm hőszigetelés",
      "retegek": [
       {
        "nev": "meglévő födém",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 12
       }
      ],
      "U": 0.23,
      "forras": "tabula_hu_2014, 29. o."
     },
     {
      "szerep": "pince_feletti_fodem",
      "leiras": "Meglévő födémre alulról 10 cm hőszigetelés",
      "retegek": [
       {
        "nev": "meglévő födém",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 10
       }
      ],
      "U": 0.35,
      "forras": "tabula_hu_2014, 29. o."
     },
     {
      "szerep": "ablak",
      "leiras": "Hőszigetelt, kétrétegű üvegezésű ablak, low-e bevonattal, argon gáztöltéssel",
      "retegek": [],
      "U": 1.6,
      "forras": "tabula_hu_2014, 29. o."
     },
     {
      "szerep": "ajto",
      "leiras": "Új hőszigetelt bejárati ajtó",
      "retegek": [],
      "U": 1.8,
      "forras": "tabula_hu_2014, 29. o."
     }
    ]
   },
   {
    "szint": "halado",
    "szerkezetek": [
     {
      "szerep": "fal",
      "leiras": "Meglévő falra kívül 16 cm hőszigetelés",
      "retegek": [
       {
        "nev": "meglévő fal",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 16
       }
      ],
      "U": 0.2,
      "forras": "tabula_hu_2014, 29. o."
     },
     {
      "szerep": "padlasfodem",
      "leiras": "Meglévő födémre felül 28 cm hőszigetelés",
      "retegek": [
       {
        "nev": "meglévő födém",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 28
       }
      ],
      "U": 0.12,
      "forras": "tabula_hu_2014, 29. o."
     },
     {
      "szerep": "pince_feletti_fodem",
      "leiras": "Meglévő födémre alulról 20 cm hőszigetelés",
      "retegek": [
       {
        "nev": "meglévő födém",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 20
       }
      ],
      "U": 0.21,
      "forras": "tabula_hu_2014, 29. o."
     },
     {
      "szerep": "ablak",
      "leiras": "Háromrétegű üvegezésű ablak, low-e bevonattal, argon gáztöltéssel",
      "retegek": [],
      "U": 1.0,
      "forras": "tabula_hu_2014, 29. o."
     },
     {
      "szerep": "ajto",
      "leiras": "Új hőszigetelt bejárati ajtó",
      "retegek": [],
      "U": 1.3,
      "forras": "tabula_hu_2014, 29. o."
     }
    ]
   }
  ]
 },
 {
  "kod": "HU.N.SFH.02.Gen",
  "csoport": "csaladi_haz",
  "korszak": [
   1945,
   1979
  ],
  "nev": "1945–1979 között épült családi ház (>80 m²)",
  "leiras": "Hagyományos technológia: tömör tégla fal, borított gerendás fafödém, talajon fekvő padló; földszintes, 115,6 m² (brosúra 36. o.; DB).",
  "szerkezetek": [
   {
    "szerep": "fal",
    "leiras": "38 cm tömör téglafal, kétoldalt vakolt",
    "retegek": [
     {
      "nev": "vakolat",
      "dCm": 3
     },
     {
      "nev": "tömör tégla",
      "dCm": 38
     },
     {
      "nev": "vakolat",
      "dCm": 1.5
     }
    ],
    "U": 1.36,
    "forras": "tabula_hu_2014, 37. o.; tabula_calc_db"
   },
   {
    "szerep": "fal",
    "leiras": "25 cm tömör téglafal, kétoldalt vakolt (változat)",
    "retegek": [
     {
      "nev": "vakolat",
      "dCm": 3
     },
     {
      "nev": "tömör tégla",
      "dCm": 25
     },
     {
      "nev": "vakolat",
      "dCm": 1.5
     }
    ],
    "U": 1.77,
    "forras": "tabula_hu_2014, 37. o.; tabula_calc_db",
    "megjegyzes": "A brosúra zárójelben adja (1,77); a 25 cm-es változathoz rendelés értelmezés, a DB Wall_2 = 1,778 megerősíti."
   },
   {
    "szerep": "padlasfodem",
    "leiras": "Borított gerendás fafödém (fagerendák 80–90 cm-enként), agyagterítés",
    "retegek": [
     {
      "nev": "vakolat",
      "dCm": 2
     },
     {
      "nev": "nádszövet",
      "dCm": 1.5
     },
     {
      "nev": "deszkázat",
      "dCm": 2
     },
     {
      "nev": "fagerenda (80–90 cm-enként)",
      "dCm": null
     },
     {
      "nev": "deszkaborítás",
      "dCm": 2.5
     },
     {
      "nev": "agyagterítés",
      "dCm": 6
     }
    ],
    "U": 1.3,
    "forras": "tabula_hu_2014, 37. o.; tabula_calc_db"
   },
   {
    "szerep": "padlo_talajon",
    "leiras": "Hajópadló, aljzatbeton, vízszigetelés, aljzatbeton, kavicsfeltöltés",
    "retegek": [
     {
      "nev": "hajópadló",
      "dCm": 3
     },
     {
      "nev": "aljzatbeton",
      "dCm": 8
     },
     {
      "nev": "vízszigetelés",
      "dCm": null
     },
     {
      "nev": "aljzatbeton",
      "dCm": 10
     },
     {
      "nev": "kavicsfeltöltés",
      "dCm": 15
     }
    ],
    "U": 0.98,
    "forras": "tabula_hu_2014, 37. o.; tabula_calc_db"
   },
   {
    "szerep": "ablak",
    "leiras": "Kapcsolt gerébtokos vagy pallótokos fa ablak, egyszeres üvegezés",
    "retegek": [],
    "U": 3.0,
    "g": 0.75,
    "forras": "tabula_hu_2014, 37. o.; tabula_calc_db; g: tabula_calc_db (g_gl_n, normál beesésű üvegezés)",
    "megjegyzes": "Brosúra 3,00 vs. DB 3,5."
   },
   {
    "szerep": "ajto",
    "leiras": "Régi fa bejárati ajtó",
    "retegek": [],
    "U": 3.5,
    "forras": "tabula_hu_2014, 37. o.; tabula_calc_db"
   }
  ],
  "valtozatok": [
   {
    "szint": "szokasos",
    "szerkezetek": [
     {
      "szerep": "fal",
      "leiras": "Meglévő falra kívül 5 cm hőszigetelés",
      "retegek": [
       {
        "nev": "meglévő fal",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 5
       }
      ],
      "U": 0.5,
      "forras": "tabula_hu_2014, 37. o."
     },
     {
      "szerep": "padlasfodem",
      "leiras": "Meglévő födémre felül 12 cm hőszigetelés",
      "retegek": [
       {
        "nev": "meglévő födém",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 12
       }
      ],
      "U": 0.27,
      "forras": "tabula_hu_2014, 37. o."
     },
     {
      "szerep": "padlo_talajon",
      "leiras": "Nincs változás",
      "retegek": [],
      "U": 0.98,
      "forras": "tabula_hu_2014, 37. o."
     },
     {
      "szerep": "ablak",
      "leiras": "Fa vagy műanyag ablak, hőszigetelt, kétrétegű üvegezésű ablak, low-e bevonattal, argon gáztöltéssel",
      "retegek": [],
      "U": 1.6,
      "forras": "tabula_hu_2014, 37. o."
     },
     {
      "szerep": "ajto",
      "leiras": "Új hőszigetelt bejárati ajtó",
      "retegek": [],
      "U": 1.8,
      "forras": "tabula_hu_2014, 37. o."
     }
    ]
   },
   {
    "szint": "halado",
    "szerkezetek": [
     {
      "szerep": "fal",
      "leiras": "Meglévő falra kívül 20 cm hőszigetelés",
      "retegek": [
       {
        "nev": "meglévő fal",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 20
       }
      ],
      "U": 0.17,
      "forras": "tabula_hu_2014, 37. o."
     },
     {
      "szerep": "padlasfodem",
      "leiras": "Meglévő födémre felül 24 cm hőszigetelés",
      "retegek": [
       {
        "nev": "meglévő födém",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 24
       }
      ],
      "U": 0.14,
      "forras": "tabula_hu_2014, 37. o."
     },
     {
      "szerep": "padlo_talajon",
      "leiras": "Nincs változás",
      "retegek": [],
      "U": 0.98,
      "forras": "tabula_hu_2014, 37. o."
     },
     {
      "szerep": "ablak",
      "leiras": "Fa-alumínium ablak, háromrétegű üvegezésű ablak, low-e bevonattal, argon gáztöltéssel",
      "retegek": [],
      "U": 1.0,
      "forras": "tabula_hu_2014, 37. o."
     },
     {
      "szerep": "ajto",
      "leiras": "Új hőszigetelt bejárati ajtó",
      "retegek": [],
      "U": 1.3,
      "forras": "tabula_hu_2014, 37. o."
     }
    ]
   }
  ]
 },
 {
  "kod": "HU.N.SFH.02.Bel80",
  "csoport": "csaladi_haz",
  "korszak": [
   1945,
   1979
  ],
  "nev": "1945–1979 között épült kis családi ház (<80 m²)",
  "leiras": "80 m² alatti alapterületű családi ház (brosúra 44. o.); szerkezetei a brosúrában azonosak az SFH.02-vel.",
  "szerkezetek": [
   {
    "szerep": "fal",
    "leiras": "38 cm tömör téglafal, kétoldalt vakolt",
    "retegek": [
     {
      "nev": "vakolat",
      "dCm": 3
     },
     {
      "nev": "tömör tégla",
      "dCm": 38
     },
     {
      "nev": "vakolat",
      "dCm": 1.5
     }
    ],
    "U": 1.36,
    "forras": "tabula_hu_2014, 45. o."
   },
   {
    "szerep": "fal",
    "leiras": "25 cm tömör téglafal, kétoldalt vakolt (változat)",
    "retegek": [
     {
      "nev": "vakolat",
      "dCm": 3
     },
     {
      "nev": "tömör tégla",
      "dCm": 25
     },
     {
      "nev": "vakolat",
      "dCm": 1.5
     }
    ],
    "U": 1.77,
    "forras": "tabula_hu_2014, 45. o.",
    "megjegyzes": "A brosúra zárójelben adja (1,77); a 25 cm-es változathoz rendelés értelmezés, a DB Wall_2 = 1,778 megerősíti."
   },
   {
    "szerep": "padlasfodem",
    "leiras": "Borított gerendás fafödém (fagerendák 80–90 cm-enként), agyagterítés",
    "retegek": [
     {
      "nev": "vakolat",
      "dCm": 2
     },
     {
      "nev": "nádszövet",
      "dCm": 1.5
     },
     {
      "nev": "deszkázat",
      "dCm": 2
     },
     {
      "nev": "fagerenda (80–90 cm-enként)",
      "dCm": null
     },
     {
      "nev": "deszkaborítás",
      "dCm": 2.5
     },
     {
      "nev": "agyagterítés",
      "dCm": 6
     }
    ],
    "U": 1.3,
    "forras": "tabula_hu_2014, 45. o."
   },
   {
    "szerep": "padlo_talajon",
    "leiras": "Hajópadló, aljzatbeton, vízszigetelés, aljzatbeton, kavicsfeltöltés",
    "retegek": [
     {
      "nev": "hajópadló",
      "dCm": 3
     },
     {
      "nev": "aljzatbeton",
      "dCm": 8
     },
     {
      "nev": "vízszigetelés",
      "dCm": null
     },
     {
      "nev": "aljzatbeton",
      "dCm": 10
     },
     {
      "nev": "kavicsfeltöltés",
      "dCm": 15
     }
    ],
    "U": 0.98,
    "forras": "tabula_hu_2014, 45. o."
   },
   {
    "szerep": "ablak",
    "leiras": "Kapcsolt gerébtokos vagy pallótokos fa ablak, egyszeres üvegezés",
    "retegek": [],
    "U": 3.0,
    "forras": "tabula_hu_2014, 45. o."
   },
   {
    "szerep": "ajto",
    "leiras": "Régi fa bejárati ajtó",
    "retegek": [],
    "U": 3.5,
    "forras": "tabula_hu_2014, 45. o."
   }
  ],
  "valtozatok": [
   {
    "szint": "szokasos",
    "szerkezetek": [
     {
      "szerep": "fal",
      "leiras": "Meglévő falra kívül 5 cm hőszigetelés",
      "retegek": [
       {
        "nev": "meglévő fal",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 5
       }
      ],
      "U": 0.5,
      "forras": "tabula_hu_2014, 45. o."
     },
     {
      "szerep": "padlo_talajon",
      "leiras": "Nincs változás",
      "retegek": [],
      "U": 0.98,
      "forras": "tabula_hu_2014, 45. o."
     },
     {
      "szerep": "ablak",
      "leiras": "Hőszigetelt, kétrétegű üvegezésű ablak, low-e bevonattal, argon gáztöltéssel",
      "retegek": [],
      "U": 1.6,
      "forras": "tabula_hu_2014, 45. o."
     }
    ]
   },
   {
    "szint": "halado",
    "szerkezetek": [
     {
      "szerep": "fal",
      "leiras": "Meglévő falra kívül 20 cm hőszigetelés",
      "retegek": [
       {
        "nev": "meglévő fal",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 20
       }
      ],
      "U": 0.17,
      "forras": "tabula_hu_2014, 45. o."
     },
     {
      "szerep": "padlo_talajon",
      "leiras": "Nincs változás",
      "retegek": [],
      "U": 0.98,
      "forras": "tabula_hu_2014, 45. o."
     },
     {
      "szerep": "ablak",
      "leiras": "Háromrétegű üvegezésű ablak, low-e bevonattal, argon gáztöltéssel",
      "retegek": [],
      "U": 1.0,
      "forras": "tabula_hu_2014, 45. o."
     }
    ]
   }
  ]
 },
 {
  "kod": "HU.N.MFH.02.Gen",
  "csoport": "tarsashaz",
  "korszak": [
   1945,
   1979
  ],
  "nev": "1945–1979 között épült társasház (hagyományos technológia)",
  "leiras": "Brosúra 40. o.: hagyományos technológia, tömör tégla külső fal, fafödém ill. poroszsüveg, üres padlás, fűtetlen pince; a szerkezeti táblázat viszont B30 falat és vb. födémet ad. DB: 3 szint, 16 lakás, 838 m².",
  "szerkezetek": [
   {
    "szerep": "fal",
    "leiras": "30 cm B30 falazóblokk, vakolt",
    "retegek": [
     {
      "nev": "vakolat",
      "dCm": 1.5
     },
     {
      "nev": "B30 tégla (falazóblokk)",
      "dCm": 30
     },
     {
      "nev": "vakolat",
      "dCm": 2
     }
    ],
    "U": 1.36,
    "forras": "tabula_hu_2014, 41. o.; tabula_calc_db",
    "megjegyzes": "Belső/külső vakolat oldala a brosúrában nem egyértelmű (2 cm és 1,5 cm)."
   },
   {
    "szerep": "padlasfodem",
    "leiras": "Vasbeton födém kazánsalak feltöltéssel",
    "retegek": [
     {
      "nev": "vakolat",
      "dCm": 1.5
     },
     {
      "nev": "vasbeton födém",
      "dCm": 20
     },
     {
      "nev": "kazánsalak feltöltés",
      "dCm": 15
     }
    ],
    "U": 1.13,
    "forras": "tabula_hu_2014, 41. o.; tabula_calc_db"
   },
   {
    "szerep": "pince_feletti_fodem",
    "leiras": "Vasbeton födém, 2 cm polisztirol, aljzatbeton, linóleum",
    "retegek": [
     {
      "nev": "linóleum",
      "dCm": 0.5
     },
     {
      "nev": "aljzatbeton",
      "dCm": 5
     },
     {
      "nev": "polisztirol",
      "dCm": 2
     },
     {
      "nev": "vasbeton",
      "dCm": 16.5
     }
    ],
    "U": 0.93,
    "forras": "tabula_hu_2014, 41. o.; tabula_calc_db",
    "megjegyzes": "DB eltérő (0,879 – ugyanaz a padlókód, mint MFH.03-nál)."
   },
   {
    "szerep": "ablak",
    "leiras": "Egyesített szárnyú fa ablak (kétrétegű üvegezés)",
    "retegek": [],
    "U": 2.5,
    "g": 0.75,
    "forras": "tabula_hu_2014, 41. o.; tabula_calc_db; g: tabula_calc_db (g_gl_n, normál beesésű üvegezés)"
   },
   {
    "szerep": "ajto",
    "leiras": "Fa bejárati ajtó",
    "retegek": [],
    "U": 3.0,
    "forras": "tabula_hu_2014, 41. o.; tabula_calc_db"
   }
  ],
  "valtozatok": [
   {
    "szint": "szokasos",
    "szerkezetek": [
     {
      "szerep": "fal",
      "leiras": "Meglévő falra kívül 5 cm hőszigetelés",
      "retegek": [
       {
        "nev": "meglévő fal",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 5
       }
      ],
      "U": 0.49,
      "forras": "tabula_hu_2014, 41. o."
     },
     {
      "szerep": "padlasfodem",
      "leiras": "Meglévő födémre felül 12 cm hőszigetelés",
      "retegek": [
       {
        "nev": "meglévő födém",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 12
       }
      ],
      "U": 0.26,
      "forras": "tabula_hu_2014, 41. o."
     },
     {
      "szerep": "pince_feletti_fodem",
      "leiras": "Meglévő födémre alulról 10 cm hőszigetelés",
      "retegek": [
       {
        "nev": "meglévő födém",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 10
       }
      ],
      "U": 0.34,
      "forras": "tabula_hu_2014, 41. o."
     },
     {
      "szerep": "ablak",
      "leiras": "Hőszigetelt, kétrétegű üvegezésű ablak, low-e bevonattal, argon gáztöltéssel",
      "retegek": [],
      "U": 1.6,
      "forras": "tabula_hu_2014, 41. o."
     },
     {
      "szerep": "ajto",
      "leiras": "Új hőszigetelt bejárati ajtó",
      "retegek": [],
      "U": 1.8,
      "forras": "tabula_hu_2014, 41. o."
     }
    ]
   },
   {
    "szint": "halado",
    "szerkezetek": [
     {
      "szerep": "fal",
      "leiras": "Meglévő falra kívül 16 cm hőszigetelés",
      "retegek": [
       {
        "nev": "meglévő fal",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 16
       }
      ],
      "U": 0.21,
      "forras": "tabula_hu_2014, 41. o."
     },
     {
      "szerep": "padlasfodem",
      "leiras": "Meglévő födémre felül 28 cm hőszigetelés",
      "retegek": [
       {
        "nev": "meglévő födém",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 28
       }
      ],
      "U": 0.12,
      "forras": "tabula_hu_2014, 41. o."
     },
     {
      "szerep": "pince_feletti_fodem",
      "leiras": "Meglévő födémre alulról 20 cm hőszigetelés",
      "retegek": [
       {
        "nev": "meglévő födém",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 20
       }
      ],
      "U": 0.2,
      "forras": "tabula_hu_2014, 41. o."
     },
     {
      "szerep": "ablak",
      "leiras": "Háromrétegű üvegezésű ablak, low-e bevonattal, argon gáztöltéssel",
      "retegek": [],
      "U": 1.0,
      "forras": "tabula_hu_2014, 41. o."
     },
     {
      "szerep": "ajto",
      "leiras": "Új hőszigetelt bejárati ajtó",
      "retegek": [],
      "U": 1.3,
      "forras": "tabula_hu_2014, 41. o."
     }
    ]
   }
  ]
 },
 {
  "kod": "HU.N.SFH.03.Gen",
  "csoport": "csaladi_haz",
  "korszak": [
   1980,
   1989
  ],
  "nev": "1980–1989 között épült családi ház",
  "leiras": "Hagyományos technológiával épült kétszintes (földszint + emelet / tetőtér) családi ház, 103,2 m², részben alápincézett (brosúra 52. o.; DB).",
  "szerkezetek": [
   {
    "szerep": "fal",
    "leiras": "30 cm B30 tégla, kétoldalt 2 cm vakolat",
    "retegek": [
     {
      "nev": "vakolat",
      "dCm": 2
     },
     {
      "nev": "B30 tégla",
      "dCm": 30
     },
     {
      "nev": "vakolat",
      "dCm": 2
     }
    ],
    "U": 1.36,
    "forras": "tabula_hu_2014, 53. o.; tabula_calc_db"
   },
   {
    "szerep": "magastető",
    "leiras": "Beépített tetőtér: cserépfedés, 10 cm ásványgyapot a szarufák között, gipszkarton",
    "retegek": [
     {
      "nev": "gipszkarton",
      "dCm": 2
     },
     {
      "nev": "párazáró lemez",
      "dCm": null
     },
     {
      "nev": "ásványgyapot (szarufák között)",
      "dCm": 10
     },
     {
      "nev": "alátéthéjazat",
      "dCm": null
     },
     {
      "nev": "lécezés",
      "dCm": null
     },
     {
      "nev": "cserépfedés",
      "dCm": 2
     }
    ],
    "U": 0.36,
    "forras": "tabula_hu_2014, 53. o.; tabula_calc_db"
   },
   {
    "szerep": "padlasfodem",
    "leiras": "Fagerendás födém, 12 cm hőszigetelés a gerendák között",
    "retegek": [
     {
      "nev": "vakolat",
      "dCm": 2
     },
     {
      "nev": "nádszövet",
      "dCm": 1.5
     },
     {
      "nev": "deszkázat",
      "dCm": 2
     },
     {
      "nev": "hőszigetelés (fagerendák között)",
      "dCm": 12
     },
     {
      "nev": "deszkázat",
      "dCm": 2.5
     }
    ],
    "U": 0.31,
    "forras": "tabula_hu_2014, 53. o.; tabula_calc_db",
    "megjegyzes": "A brosúra zárójelben adja (0,31)."
   },
   {
    "szerep": "pince_feletti_fodem",
    "leiras": "Előregyártott vasbeton födém, 2 cm polisztirol, aljzatbeton, parketta",
    "retegek": [
     {
      "nev": "parketta",
      "dCm": 2
     },
     {
      "nev": "aljzatbeton",
      "dCm": 5
     },
     {
      "nev": "polisztirol",
      "dCm": 2
     },
     {
      "nev": "előregyártott vasbeton födém",
      "dCm": 24
     },
     {
      "nev": "vakolat",
      "dCm": 2
     }
    ],
    "U": 0.87,
    "forras": "tabula_hu_2014, 53. o.; tabula_calc_db",
    "megjegyzes": "Rétegek felülről lefelé (fűtött tér → pince); a vakolat a födém alsó síkján."
   },
   {
    "szerep": "ablak",
    "leiras": "Egyesített szárnyú fa ablak (kétrétegű üvegezés)",
    "retegek": [],
    "U": 2.5,
    "g": 0.75,
    "forras": "tabula_hu_2014, 53. o.; tabula_calc_db; g: tabula_calc_db (g_gl_n, normál beesésű üvegezés)"
   },
   {
    "szerep": "ajto",
    "leiras": "Fa bejárati ajtó",
    "retegek": [],
    "U": 3.0,
    "forras": "tabula_hu_2014, 53. o.; tabula_calc_db"
   }
  ],
  "valtozatok": [
   {
    "szint": "szokasos",
    "szerkezetek": [
     {
      "szerep": "fal",
      "leiras": "Meglévő falra kívül 5 cm hőszigetelés",
      "retegek": [
       {
        "nev": "meglévő fal",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 5
       }
      ],
      "U": 0.49,
      "forras": "tabula_hu_2014, 53. o."
     },
     {
      "szerep": "magastető",
      "leiras": "Meglévő szerkezetre 10 cm hőszigetelés (magastető és padlásfödém)",
      "retegek": [
       {
        "nev": "meglévő szerkezet",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 10
       }
      ],
      "U": 0.17,
      "forras": "tabula_hu_2014, 53. o.",
      "megjegyzes": "A brosúra egy sort ad: 0,17 (zárójelben is 0,17)."
     },
     {
      "szerep": "pince_feletti_fodem",
      "leiras": "Meglévő födémre alulról 10 cm hőszigetelés",
      "retegek": [
       {
        "nev": "meglévő födém",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 10
       }
      ],
      "U": 0.33,
      "forras": "tabula_hu_2014, 53. o."
     },
     {
      "szerep": "ablak",
      "leiras": "Hőszigetelt, kétrétegű üvegezésű ablak, low-e bevonattal, argon gáztöltéssel",
      "retegek": [],
      "U": 1.6,
      "forras": "tabula_hu_2014, 53. o."
     },
     {
      "szerep": "ajto",
      "leiras": "Új hőszigetelt bejárati ajtó",
      "retegek": [],
      "U": 1.8,
      "forras": "tabula_hu_2014, 53. o."
     }
    ]
   },
   {
    "szint": "halado",
    "szerkezetek": [
     {
      "szerep": "fal",
      "leiras": "Meglévő falra kívül 16 cm hőszigetelés",
      "retegek": [
       {
        "nev": "meglévő fal",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 16
       }
      ],
      "U": 0.17,
      "forras": "tabula_hu_2014, 53. o."
     },
     {
      "szerep": "magastető",
      "leiras": "Meglévő szerkezetre 24 cm hőszigetelés (magastető és padlásfödém)",
      "retegek": [
       {
        "nev": "meglévő szerkezet",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 24
       }
      ],
      "U": 0.11,
      "forras": "tabula_hu_2014, 53. o."
     },
     {
      "szerep": "pince_feletti_fodem",
      "leiras": "Meglévő födémre alulról 20 cm hőszigetelés",
      "retegek": [
       {
        "nev": "meglévő födém",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 20
       }
      ],
      "U": 0.2,
      "forras": "tabula_hu_2014, 53. o."
     },
     {
      "szerep": "ablak",
      "leiras": "Háromrétegű üvegezésű ablak, low-e bevonattal, argon gáztöltéssel",
      "retegek": [],
      "U": 1.0,
      "forras": "tabula_hu_2014, 53. o."
     },
     {
      "szerep": "ajto",
      "leiras": "Új hőszigetelt bejárati ajtó",
      "retegek": [],
      "U": 1.3,
      "forras": "tabula_hu_2014, 53. o."
     }
    ]
   }
  ]
 },
 {
  "kod": "HU.N.MFH.03.Gen",
  "csoport": "tarsashaz",
  "korszak": [
   1980,
   1989
  ],
  "nev": "1980–1989 között épült társasház (hagyományos technológia)",
  "leiras": "Hagyományos technológia, magastető, legalább részben alápincézett (brosúra 56. o.). DB: 2 szint, 6 lakás, 341 m².",
  "szerkezetek": [
   {
    "szerep": "fal",
    "leiras": "30 cm B30 tégla, kétoldalt 2 cm vakolat",
    "retegek": [
     {
      "nev": "vakolat",
      "dCm": 2
     },
     {
      "nev": "B30 tégla",
      "dCm": 30
     },
     {
      "nev": "vakolat",
      "dCm": 2
     }
    ],
    "U": 1.36,
    "forras": "tabula_hu_2014, 57. o.; tabula_calc_db"
   },
   {
    "szerep": "magastető",
    "leiras": "Cserép, 10 cm kőzetgyapot, párazáró, gipszkarton",
    "retegek": [
     {
      "nev": "gipszkarton",
      "dCm": 1.25
     },
     {
      "nev": "párazáró lemez",
      "dCm": null
     },
     {
      "nev": "kőzetgyapot",
      "dCm": 10
     },
     {
      "nev": "alátéthéjazat",
      "dCm": null
     },
     {
      "nev": "lécezés",
      "dCm": null
     },
     {
      "nev": "cserép",
      "dCm": 2
     }
    ],
    "U": 0.36,
    "forras": "tabula_hu_2014, 57. o.; tabula_calc_db"
   },
   {
    "szerep": "padlasfodem",
    "leiras": "Vasbeton födém (20 cm) 10 cm ásványgyapottal",
    "retegek": [
     {
      "nev": "vakolat",
      "dCm": 1
     },
     {
      "nev": "vasbeton födém",
      "dCm": 20
     },
     {
      "nev": "ásványgyapot",
      "dCm": 10
     }
    ],
    "U": 0.31,
    "forras": "tabula_hu_2014, 57. o.; tabula_calc_db",
    "megjegyzes": "Brosúra (0,31) vs. DB 0,351."
   },
   {
    "szerep": "pince_feletti_fodem",
    "leiras": "Előregyártott vasbeton födém, 2 cm polisztirol, aljzatbeton, parketta",
    "retegek": [
     {
      "nev": "parketta",
      "dCm": 2
     },
     {
      "nev": "aljzatbeton",
      "dCm": 5
     },
     {
      "nev": "polisztirol",
      "dCm": 2
     },
     {
      "nev": "előregyártott vasbeton födém",
      "dCm": 24
     },
     {
      "nev": "vakolat",
      "dCm": 2
     }
    ],
    "U": 0.87,
    "forras": "tabula_hu_2014, 57. o.; tabula_calc_db",
    "megjegyzes": "Rétegek felülről lefelé (fűtött tér → pince); a vakolat a födém alsó síkján."
   },
   {
    "szerep": "ablak",
    "leiras": "Egyesített szárnyú fa ablak (kétrétegű üvegezés)",
    "retegek": [],
    "U": 2.5,
    "g": 0.75,
    "forras": "tabula_hu_2014, 57. o.; tabula_calc_db; g: tabula_calc_db (g_gl_n, normál beesésű üvegezés)"
   },
   {
    "szerep": "ajto",
    "leiras": "Fa bejárati ajtó",
    "retegek": [],
    "U": 3.0,
    "forras": "tabula_hu_2014, 57. o.; tabula_calc_db"
   }
  ],
  "valtozatok": [
   {
    "szint": "szokasos",
    "szerkezetek": [
     {
      "szerep": "fal",
      "leiras": "Meglévő falra kívül 5 cm hőszigetelés",
      "retegek": [
       {
        "nev": "meglévő fal",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 5
       }
      ],
      "U": 0.49,
      "forras": "tabula_hu_2014, 57. o."
     },
     {
      "szerep": "magastető",
      "leiras": "Meglévő szerkezetre 12 cm hőszigetelés",
      "retegek": [
       {
        "nev": "meglévő szerkezet",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 12
       }
      ],
      "U": 0.18,
      "forras": "tabula_hu_2014, 57. o."
     },
     {
      "szerep": "padlasfodem",
      "leiras": "Meglévő födémre 12 cm hőszigetelés",
      "retegek": [
       {
        "nev": "meglévő födém",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 12
       }
      ],
      "U": 0.17,
      "forras": "tabula_hu_2014, 57. o."
     },
     {
      "szerep": "pince_feletti_fodem",
      "leiras": "Meglévő födémre alulról 10 cm hőszigetelés",
      "retegek": [
       {
        "nev": "meglévő födém",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 10
       }
      ],
      "U": 0.33,
      "forras": "tabula_hu_2014, 57. o."
     },
     {
      "szerep": "ablak",
      "leiras": "Hőszigetelt, kétrétegű üvegezésű ablak, low-e bevonattal, argon gáztöltéssel",
      "retegek": [],
      "U": 1.6,
      "forras": "tabula_hu_2014, 57. o."
     },
     {
      "szerep": "ajto",
      "leiras": "Új hőszigetelt bejárati ajtó",
      "retegek": [],
      "U": 1.8,
      "forras": "tabula_hu_2014, 57. o."
     }
    ]
   },
   {
    "szint": "halado",
    "szerkezetek": [
     {
      "szerep": "fal",
      "leiras": "Meglévő falra kívül 16 cm hőszigetelés",
      "retegek": [
       {
        "nev": "meglévő fal",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 16
       }
      ],
      "U": 0.17,
      "forras": "tabula_hu_2014, 57. o."
     },
     {
      "szerep": "magastető",
      "leiras": "Meglévő szerkezetre 28 cm hőszigetelés",
      "retegek": [
       {
        "nev": "meglévő szerkezet",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 28
       }
      ],
      "U": 0.11,
      "forras": "tabula_hu_2014, 57. o."
     },
     {
      "szerep": "padlasfodem",
      "leiras": "Meglévő födémre 28 cm hőszigetelés",
      "retegek": [
       {
        "nev": "meglévő födém",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 28
       }
      ],
      "U": 0.1,
      "forras": "tabula_hu_2014, 57. o."
     },
     {
      "szerep": "pince_feletti_fodem",
      "leiras": "Meglévő födémre alulról 20 cm hőszigetelés",
      "retegek": [
       {
        "nev": "meglévő födém",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 20
       }
      ],
      "U": 0.2,
      "forras": "tabula_hu_2014, 57. o."
     },
     {
      "szerep": "ablak",
      "leiras": "Háromrétegű üvegezésű ablak, low-e bevonattal, argon gáztöltéssel",
      "retegek": [],
      "U": 1.0,
      "forras": "tabula_hu_2014, 57. o."
     },
     {
      "szerep": "ajto",
      "leiras": "Új hőszigetelt bejárati ajtó",
      "retegek": [],
      "U": 1.3,
      "forras": "tabula_hu_2014, 57. o."
     }
    ]
   }
  ]
 },
 {
  "kod": "HU.N.SFH.04.Gen",
  "csoport": "csaladi_haz",
  "korszak": [
   1990,
   2005
  ],
  "nev": "1990–2005 között épült családi ház",
  "leiras": "Sok esetben tetőtér-beépítéses családi ház (brosúra 64. o.). DB: 2 szint, 110,2 m², pince.",
  "szerkezetek": [
   {
    "szerep": "fal",
    "leiras": "30 cm hőszigetelő kerámia falazóblokk, kétoldalt vakolt",
    "retegek": [
     {
      "nev": "vakolat",
      "dCm": 2
     },
     {
      "nev": "hőszigetelő kerámia falazóblokk",
      "dCm": 30
     },
     {
      "nev": "vakolat",
      "dCm": 2
     }
    ],
    "U": 0.49,
    "forras": "tabula_hu_2014, 65. o.; tabula_calc_db"
   },
   {
    "szerep": "magastető",
    "leiras": "Cserép, 15 cm kőzetgyapot a szarufák között, gipszkarton",
    "retegek": [
     {
      "nev": "gipszkarton",
      "dCm": 1.25
     },
     {
      "nev": "párazáró lemez",
      "dCm": null
     },
     {
      "nev": "kőzetgyapot (szarufák között)",
      "dCm": 15
     },
     {
      "nev": "alátéthéjazat",
      "dCm": null
     },
     {
      "nev": "lécezés",
      "dCm": null
     },
     {
      "nev": "cserép",
      "dCm": 2
     }
    ],
    "U": 0.25,
    "forras": "tabula_hu_2014, 65. o.; tabula_calc_db"
   },
   {
    "szerep": "padlasfodem",
    "leiras": "Vasbeton födém (20 cm) 10 cm ásványgyapottal",
    "retegek": [
     {
      "nev": "vasbeton födém",
      "dCm": 20
     },
     {
      "nev": "ásványgyapot",
      "dCm": 10
     }
    ],
    "U": 0.35,
    "forras": "tabula_hu_2014, 65. o.; tabula_calc_db",
    "megjegyzes": "Brosúrában zárójelben (0,35)."
   },
   {
    "szerep": "pince_feletti_fodem",
    "leiras": "Vasbeton födém alul 5 cm hőszigeteléssel, 2 cm polisztirol, aljzatbeton, parketta",
    "retegek": [
     {
      "nev": "parketta",
      "dCm": 2
     },
     {
      "nev": "aljzatbeton",
      "dCm": 6
     },
     {
      "nev": "polisztirol",
      "dCm": 2
     },
     {
      "nev": "vasbeton födém",
      "dCm": 20
     },
     {
      "nev": "hőszigetelés",
      "dCm": 5
     }
    ],
    "U": 0.42,
    "forras": "tabula_hu_2014, 65. o.; tabula_calc_db"
   },
   {
    "szerep": "ablak",
    "leiras": "Hőszigetelt, kétszeres üvegezésű fa ablak",
    "retegek": [],
    "U": 2.0,
    "g": 0.65,
    "forras": "tabula_hu_2014, 65. o.; tabula_calc_db; g: tabula_calc_db (g_gl_n, normál beesésű üvegezés)"
   },
   {
    "szerep": "ajto",
    "leiras": "Fa bejárati ajtó",
    "retegek": [],
    "U": 2.5,
    "forras": "tabula_hu_2014, 65. o.; tabula_calc_db"
   }
  ],
  "valtozatok": [
   {
    "szint": "szokasos",
    "szerkezetek": [
     {
      "szerep": "fal",
      "leiras": "Meglévő falra kívül 5 cm hőszigetelés",
      "retegek": [
       {
        "nev": "meglévő fal",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 5
       }
      ],
      "U": 0.3,
      "forras": "tabula_hu_2014, 65. o."
     },
     {
      "szerep": "magastető",
      "leiras": "Meglévő szerkezetre felül 10 cm hőszigetelés",
      "retegek": [
       {
        "nev": "meglévő szerkezet",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 10
       }
      ],
      "U": 0.15,
      "forras": "tabula_hu_2014, 65. o."
     },
     {
      "szerep": "padlasfodem",
      "leiras": "Meglévő födémre felül 10 cm hőszigetelés",
      "retegek": [
       {
        "nev": "meglévő födém",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 10
       }
      ],
      "U": 0.18,
      "forras": "tabula_hu_2014, 65. o."
     },
     {
      "szerep": "pince_feletti_fodem",
      "leiras": "Meglévő födémre alulról 10 cm hőszigetelés",
      "retegek": [
       {
        "nev": "meglévő födém",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 10
       }
      ],
      "U": 0.21,
      "forras": "tabula_hu_2014, 65. o."
     },
     {
      "szerep": "ablak",
      "leiras": "Hőszigetelt, kétrétegű üvegezésű ablak, low-e bevonattal, argon gáztöltéssel",
      "retegek": [],
      "U": 1.3,
      "forras": "tabula_hu_2014, 65. o."
     },
     {
      "szerep": "ajto",
      "leiras": "Új hőszigetelt bejárati ajtó",
      "retegek": [],
      "U": 1.8,
      "forras": "tabula_hu_2014, 65. o."
     }
    ]
   },
   {
    "szint": "halado",
    "szerkezetek": [
     {
      "szerep": "fal",
      "leiras": "Meglévő falra kívül 16 cm hőszigetelés",
      "retegek": [
       {
        "nev": "meglévő fal",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 16
       }
      ],
      "U": 0.17,
      "forras": "tabula_hu_2014, 65. o."
     },
     {
      "szerep": "magastető",
      "leiras": "Meglévő szerkezetre felül 24 cm hőszigetelés",
      "retegek": [
       {
        "nev": "meglévő szerkezet",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 24
       }
      ],
      "U": 0.1,
      "forras": "tabula_hu_2014, 65. o."
     },
     {
      "szerep": "padlasfodem",
      "leiras": "Meglévő födémre felül 24 cm hőszigetelés",
      "retegek": [
       {
        "nev": "meglévő födém",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 24
       }
      ],
      "U": 0.11,
      "forras": "tabula_hu_2014, 65. o."
     },
     {
      "szerep": "pince_feletti_fodem",
      "leiras": "Meglévő födémre alulról 20 cm hőszigetelés",
      "retegek": [
       {
        "nev": "meglévő födém",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 20
       }
      ],
      "U": 0.15,
      "forras": "tabula_hu_2014, 65. o."
     },
     {
      "szerep": "ablak",
      "leiras": "Háromrétegű üvegezésű ablak, low-e bevonattal, argon gáztöltéssel",
      "retegek": [],
      "U": 1.0,
      "forras": "tabula_hu_2014, 65. o."
     },
     {
      "szerep": "ajto",
      "leiras": "Új hőszigetelt bejárati ajtó",
      "retegek": [],
      "U": 1.3,
      "forras": "tabula_hu_2014, 65. o."
     }
    ]
   }
  ]
 },
 {
  "kod": "HU.N.MFH.04.Gen",
  "csoport": "tarsashaz",
  "korszak": [
   1990,
   2005
  ],
  "nev": "1990–2005 között épült társasház",
  "leiras": "Brosúra 68. o.: '1990 és 2000 között épült' hagyományos technológiájú társasház, magastető esetenként beépített (a leírás tömör téglát említ, a szerkezeti táblázat kerámia falazóblokkot). DB: 2 szint, 6 lakás, 340 m².",
  "szerkezetek": [
   {
    "szerep": "fal",
    "leiras": "30 cm hőszigetelő kerámia falazóblokk, kétoldalt vakolt",
    "retegek": [
     {
      "nev": "vakolat",
      "dCm": 2
     },
     {
      "nev": "hőszigetelő kerámia falazóblokk",
      "dCm": 30
     },
     {
      "nev": "vakolat",
      "dCm": 2
     }
    ],
    "U": 0.49,
    "forras": "tabula_hu_2014, 69. o.; tabula_calc_db"
   },
   {
    "szerep": "magastető",
    "leiras": "Cserép, kőzetgyapot (HU szöveg: 12 cm, EN: 10 cm), párazáró, gipszkarton",
    "retegek": [
     {
      "nev": "gipszkarton",
      "dCm": 1.25
     },
     {
      "nev": "párazáró lemez",
      "dCm": null
     },
     {
      "nev": "kőzetgyapot",
      "dCm": 12
     },
     {
      "nev": "alátéthéjazat",
      "dCm": null
     },
     {
      "nev": "lécezés",
      "dCm": null
     },
     {
      "nev": "cserép",
      "dCm": 2
     }
    ],
    "U": 0.25,
    "forras": "tabula_hu_2014, 69. o.; tabula_calc_db",
    "megjegyzes": "DB Roof_1 = 0,364 (a brosúra 0,25)."
   },
   {
    "szerep": "padlasfodem",
    "leiras": "Vasbeton födém (20 cm) 10 cm ásványgyapottal",
    "retegek": [
     {
      "nev": "vakolat",
      "dCm": 1
     },
     {
      "nev": "vasbeton födém",
      "dCm": 20
     },
     {
      "nev": "ásványgyapot",
      "dCm": 10
     }
    ],
    "U": 0.31,
    "forras": "tabula_hu_2014, 69. o.; tabula_calc_db",
    "megjegyzes": "Brosúra (0,31) vs. DB 0,351."
   },
   {
    "szerep": "pince_feletti_fodem",
    "leiras": "Vasbeton födém alul 5 cm hőszigeteléssel, 2 cm polisztirol, aljzatbeton, parketta",
    "retegek": [
     {
      "nev": "parketta",
      "dCm": 2
     },
     {
      "nev": "aljzatbeton",
      "dCm": 6
     },
     {
      "nev": "polisztirol",
      "dCm": 2
     },
     {
      "nev": "vasbeton födém",
      "dCm": 20
     },
     {
      "nev": "hőszigetelés",
      "dCm": 5
     }
    ],
    "U": 0.42,
    "forras": "tabula_hu_2014, 69. o.; tabula_calc_db"
   },
   {
    "szerep": "ablak",
    "leiras": "Hőszigetelt, kétszeres üvegezésű fa ablak",
    "retegek": [],
    "U": 2.0,
    "g": 0.65,
    "forras": "tabula_hu_2014, 69. o.; tabula_calc_db; g: tabula_calc_db (g_gl_n, normál beesésű üvegezés)"
   },
   {
    "szerep": "ajto",
    "leiras": "Fa bejárati ajtó",
    "retegek": [],
    "U": 2.5,
    "forras": "tabula_hu_2014, 69. o.; tabula_calc_db"
   }
  ],
  "valtozatok": [
   {
    "szint": "szokasos",
    "szerkezetek": [
     {
      "szerep": "fal",
      "leiras": "Meglévő falra kívül 5 cm hőszigetelés",
      "retegek": [
       {
        "nev": "meglévő fal",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 5
       }
      ],
      "U": 0.3,
      "forras": "tabula_hu_2014, 69. o."
     },
     {
      "szerep": "magastető",
      "leiras": "Meglévő szerkezetre felül 12 cm hőszigetelés",
      "retegek": [
       {
        "nev": "meglévő szerkezet",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 12
       }
      ],
      "U": 0.15,
      "forras": "tabula_hu_2014, 69. o."
     },
     {
      "szerep": "padlasfodem",
      "leiras": "Meglévő födémre felül 12 cm hőszigetelés",
      "retegek": [
       {
        "nev": "meglévő födém",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 12
       }
      ],
      "U": 0.17,
      "forras": "tabula_hu_2014, 69. o."
     },
     {
      "szerep": "pince_feletti_fodem",
      "leiras": "Meglévő födémre alulról 10 cm hőszigetelés",
      "retegek": [
       {
        "nev": "meglévő födém",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 10
       }
      ],
      "U": 0.23,
      "forras": "tabula_hu_2014, 69. o."
     },
     {
      "szerep": "ablak",
      "leiras": "Hőszigetelt, kétrétegű üvegezésű ablak, low-e bevonattal, argon gáztöltéssel",
      "retegek": [],
      "U": 1.3,
      "forras": "tabula_hu_2014, 69. o."
     },
     {
      "szerep": "ajto",
      "leiras": "Új hőszigetelt bejárati ajtó",
      "retegek": [],
      "U": 1.8,
      "forras": "tabula_hu_2014, 69. o."
     }
    ]
   },
   {
    "szint": "halado",
    "szerkezetek": [
     {
      "szerep": "fal",
      "leiras": "Meglévő falra kívül 16 cm hőszigetelés",
      "retegek": [
       {
        "nev": "meglévő fal",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 16
       }
      ],
      "U": 0.17,
      "forras": "tabula_hu_2014, 69. o."
     },
     {
      "szerep": "magastető",
      "leiras": "Meglévő szerkezetre felül 28 cm hőszigetelés",
      "retegek": [
       {
        "nev": "meglévő szerkezet",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 28
       }
      ],
      "U": 0.09,
      "forras": "tabula_hu_2014, 69. o."
     },
     {
      "szerep": "padlasfodem",
      "leiras": "Meglévő födémre felül 28 cm hőszigetelés",
      "retegek": [
       {
        "nev": "meglévő födém",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 28
       }
      ],
      "U": 0.1,
      "forras": "tabula_hu_2014, 69. o."
     },
     {
      "szerep": "pince_feletti_fodem",
      "leiras": "Meglévő födémre alulról 20 cm hőszigetelés",
      "retegek": [
       {
        "nev": "meglévő födém",
        "dCm": null
       },
       {
        "nev": "hőszigetelés",
        "dCm": 20
       }
      ],
      "U": 0.16,
      "forras": "tabula_hu_2014, 69. o."
     },
     {
      "szerep": "ablak",
      "leiras": "Háromrétegű üvegezésű ablak, low-e bevonattal, argon gáztöltéssel",
      "retegek": [],
      "U": 1.0,
      "forras": "tabula_hu_2014, 69. o."
     },
     {
      "szerep": "ajto",
      "leiras": "Új hőszigetelt bejárati ajtó",
      "retegek": [],
      "U": 1.3,
      "forras": "tabula_hu_2014, 69. o."
     }
    ]
   }
  ]
 },
 {
  "kod": "HU.N.SFH.05.Gen",
  "csoport": "csaladi_haz",
  "korszak": [
   2006,
   null
  ],
  "nev": "2006 után épült családi ház (jelenlegi követelmény)",
  "leiras": "Szabadon álló, földszintes, üres padlásterű új családi ház a brosúra idején hatályos (7/2006 TNM) követelmények szerint (brosúra 72. o.). DB: 131,6 m². A TABULA HU 2006 utáni korszakot nem bontja tovább (nincs külön 2012– típus).",
  "szerkezetek": [
   {
    "szerep": "fal",
    "leiras": "30 cm falazóblokk + 10 cm polisztirol hőszigetelés, vékonyvakolat",
    "retegek": [
     {
      "nev": "vakolat",
      "dCm": 1.5
     },
     {
      "nev": "falazóblokk",
      "dCm": 30
     },
     {
      "nev": "polisztirol hőszigetelés",
      "dCm": 10
     },
     {
      "nev": "vakolat",
      "dCm": 0.5
     }
    ],
    "U": 0.22,
    "forras": "tabula_hu_2014, 73. o.; tabula_calc_db"
   },
   {
    "szerep": "padlasfodem",
    "leiras": "15 cm vasbeton födém ásványgyapot hőszigeteléssel",
    "retegek": [
     {
      "nev": "vakolat",
      "dCm": 1.5
     },
     {
      "nev": "vasbeton",
      "dCm": 15
     },
     {
      "nev": "ásványgyapot",
      "dCm": 15
     }
    ],
    "U": 0.22,
    "forras": "tabula_hu_2014, 73. o.; tabula_calc_db",
    "megjegyzes": "Ásványgyapot vastagsága: HU 15 cm, EN 10 cm."
   },
   {
    "szerep": "padlo_talajon",
    "leiras": "Talajon fekvő padló 5 cm polisztirollal",
    "retegek": [
     {
      "nev": "parketta",
      "dCm": 2
     },
     {
      "nev": "aljzatbeton",
      "dCm": 6
     },
     {
      "nev": "polisztirol",
      "dCm": 5
     },
     {
      "nev": "vízszigetelés",
      "dCm": null
     },
     {
      "nev": "aljzatbeton",
      "dCm": 10
     },
     {
      "nev": "kavics",
      "dCm": 15
     }
    ],
    "U": 0.44,
    "forras": "tabula_hu_2014, 73. o.; tabula_calc_db",
    "megjegyzes": "Felső aljzatbeton: HU 6 cm, EN 15 cm."
   },
   {
    "szerep": "ablak",
    "leiras": "Kétrétegű üvegezésű ablak, low-e bevonattal, argon gáztöltéssel",
    "retegek": [],
    "U": 1.5,
    "g": 0.65,
    "forras": "tabula_hu_2014, 73. o.; tabula_calc_db; g: tabula_calc_db (g_gl_n, normál beesésű üvegezés)"
   },
   {
    "szerep": "ajto",
    "leiras": "Fa bejárati ajtó",
    "retegek": [],
    "U": 2.0,
    "forras": "tabula_hu_2014, 73. o.; tabula_calc_db"
   }
  ],
  "valtozatok": [
   {
    "szint": "alacsony_energia",
    "szerkezetek": [
     {
      "szerep": "fal",
      "leiras": "30 cm falazóblokk + 15 cm polisztirol hőszigetelés, vékonyvakolat",
      "retegek": [
       {
        "nev": "vakolat",
        "dCm": 2
       },
       {
        "nev": "falazóblokk",
        "dCm": 30
       },
       {
        "nev": "polisztirol hőszigetelés",
        "dCm": 15
       },
       {
        "nev": "vakolat",
        "dCm": 0.5
       }
      ],
      "U": 0.17,
      "forras": "tabula_hu_2014, 73. o."
     },
     {
      "szerep": "padlasfodem",
      "leiras": "18 cm vasbeton + 25 cm ásványgyapot",
      "retegek": [
       {
        "nev": "vakolat",
        "dCm": 1.5
       },
       {
        "nev": "vasbeton",
        "dCm": 18
       },
       {
        "nev": "ásványgyapot",
        "dCm": 25
       }
      ],
      "U": 0.09,
      "forras": "tabula_hu_2014, 73. o."
     },
     {
      "szerep": "padlo_talajon",
      "leiras": "10 cm polisztirol",
      "retegek": [
       {
        "nev": "parketta",
        "dCm": 2
       },
       {
        "nev": "aljzatbeton",
        "dCm": 6
       },
       {
        "nev": "polisztirol",
        "dCm": 10
       },
       {
        "nev": "vízszigetelés",
        "dCm": null
       },
       {
        "nev": "aljzatbeton",
        "dCm": 10
       },
       {
        "nev": "kavics",
        "dCm": 15
       }
      ],
      "U": 0.28,
      "forras": "tabula_hu_2014, 73. o."
     },
     {
      "szerep": "ablak",
      "leiras": "Kétrétegű üvegezésű ablak, low-e bevonattal, argon gáztöltéssel",
      "retegek": [],
      "U": 1.3,
      "forras": "tabula_hu_2014, 73. o."
     },
     {
      "szerep": "ajto",
      "leiras": "Hőszigetelt ajtó",
      "retegek": [],
      "U": 1.8,
      "forras": "tabula_hu_2014, 73. o."
     }
    ]
   },
   {
    "szint": "kozel_nulla",
    "szerkezetek": [
     {
      "szerep": "fal",
      "leiras": "30 cm hőszigetelő falazóblokk + 16 cm polisztirol hőszigetelés, vékonyvakolat",
      "retegek": [
       {
        "nev": "vakolat",
        "dCm": 2
       },
       {
        "nev": "hőszigetelő falazóblokk",
        "dCm": 30
       },
       {
        "nev": "polisztirol hőszigetelés",
        "dCm": 16
       },
       {
        "nev": "vakolat",
        "dCm": 0.5
       }
      ],
      "U": 0.15,
      "forras": "tabula_hu_2014, 73. o."
     },
     {
      "szerep": "padlasfodem",
      "leiras": "18 cm vasbeton + 25 cm ásványgyapot",
      "retegek": [
       {
        "nev": "vakolat",
        "dCm": 1.5
       },
       {
        "nev": "vasbeton",
        "dCm": 18
       },
       {
        "nev": "ásványgyapot",
        "dCm": 25
       }
      ],
      "U": 0.09,
      "forras": "tabula_hu_2014, 73. o."
     },
     {
      "szerep": "padlo_talajon",
      "leiras": "5 cm polisztirol + 24 cm habüveg az aljzat alatt",
      "retegek": [
       {
        "nev": "parketta",
        "dCm": 2
       },
       {
        "nev": "aljzatbeton",
        "dCm": 6
       },
       {
        "nev": "polisztirol",
        "dCm": 5
       },
       {
        "nev": "vízszigetelés",
        "dCm": null
       },
       {
        "nev": "aljzatbeton",
        "dCm": 10
       },
       {
        "nev": "habüveg hőszigetelés",
        "dCm": 24
       },
       {
        "nev": "kavics",
        "dCm": 15
       }
      ],
      "U": 0.22,
      "forras": "tabula_hu_2014, 73. o."
     },
     {
      "szerep": "ablak",
      "leiras": "Háromrétegű üvegezésű ablak, low-e bevonattal, argon gáztöltéssel",
      "retegek": [],
      "U": 1.0,
      "forras": "tabula_hu_2014, 73. o."
     },
     {
      "szerep": "ajto",
      "leiras": "Hőszigetelt ajtó",
      "retegek": [],
      "U": 1.3,
      "forras": "tabula_hu_2014, 73. o."
     }
    ]
   }
  ]
 },
 {
  "kod": "HU.N.MFH.05.Gen",
  "csoport": "tarsashaz",
  "korszak": [
   2006,
   null
  ],
  "nev": "2006 után épült társasház (jelenlegi követelmény)",
  "leiras": "Szabadon álló, kétszintes + tetőtér-beépítéses társasház, a brosúra idején hatályos követelmények szerint (brosúra 76. o.). DB: 3 szint, 5 lakás, 373 m². Ablak/ajtó a 78. oldalon.",
  "szerkezetek": [
   {
    "szerep": "fal",
    "leiras": "30 cm falazóblokk + 10 cm polisztirol hőszigetelés, vékonyvakolat",
    "retegek": [
     {
      "nev": "vakolat",
      "dCm": 1.5
     },
     {
      "nev": "falazóblokk",
      "dCm": 30
     },
     {
      "nev": "polisztirol hőszigetelés",
      "dCm": 10
     },
     {
      "nev": "vakolat",
      "dCm": 0.5
     }
    ],
    "U": 0.22,
    "forras": "tabula_hu_2014, 77. o.; tabula_calc_db"
   },
   {
    "szerep": "magastető",
    "leiras": "Cserép, 15 cm kőzetgyapot, párazáró, gipszkarton",
    "retegek": [
     {
      "nev": "gipszkarton",
      "dCm": 1.25
     },
     {
      "nev": "párazáró lemez",
      "dCm": null
     },
     {
      "nev": "kőzetgyapot",
      "dCm": 15
     },
     {
      "nev": "alátéthéjazat",
      "dCm": null
     },
     {
      "nev": "lécezés",
      "dCm": null
     },
     {
      "nev": "cserép",
      "dCm": 2
     }
    ],
    "U": 0.25,
    "forras": "tabula_hu_2014, 77. o.; tabula_calc_db"
   },
   {
    "szerep": "padlasfodem",
    "leiras": "15 cm vasbeton + 15 cm ásványgyapot",
    "retegek": [
     {
      "nev": "vakolat",
      "dCm": 1.5
     },
     {
      "nev": "vasbeton",
      "dCm": 15
     },
     {
      "nev": "ásványgyapot",
      "dCm": 15
     }
    ],
    "U": 0.22,
    "forras": "tabula_hu_2014, 77. o.; tabula_calc_db",
    "megjegyzes": "A brosúra zárójelben adja."
   },
   {
    "szerep": "pince_feletti_fodem",
    "leiras": "Vasbeton födém alul 10 cm hőszigeteléssel, 4 cm polisztirol, aljzatbeton, parketta",
    "retegek": [
     {
      "nev": "parketta",
      "dCm": 2
     },
     {
      "nev": "aljzatbeton",
      "dCm": 6
     },
     {
      "nev": "polisztirol",
      "dCm": 4
     },
     {
      "nev": "vasbeton födém",
      "dCm": 20
     },
     {
      "nev": "hőszigetelés",
      "dCm": 10
     }
    ],
    "U": 0.24,
    "forras": "tabula_hu_2014, 77. o.; tabula_calc_db"
   },
   {
    "szerep": "ablak",
    "leiras": "Hőszigetelt, kétrétegű üvegezésű ablak, low-e bevonattal, argon gáztöltéssel",
    "retegek": [],
    "U": 1.5,
    "g": 0.65,
    "forras": "tabula_hu_2014, 78. o.; tabula_calc_db; g: tabula_calc_db (g_gl_n, normál beesésű üvegezés)"
   },
   {
    "szerep": "ajto",
    "leiras": "Fa bejárati ajtó",
    "retegek": [],
    "U": 2.0,
    "forras": "tabula_hu_2014, 78. o.; tabula_calc_db"
   }
  ],
  "valtozatok": [
   {
    "szint": "alacsony_energia",
    "szerkezetek": [
     {
      "szerep": "fal",
      "leiras": "30 cm falazóblokk + 15 cm polisztirol hőszigetelés, vékonyvakolat",
      "retegek": [
       {
        "nev": "vakolat",
        "dCm": 2
       },
       {
        "nev": "falazóblokk",
        "dCm": 30
       },
       {
        "nev": "polisztirol hőszigetelés",
        "dCm": 15
       },
       {
        "nev": "vakolat",
        "dCm": 0.5
       }
      ],
      "U": 0.17,
      "forras": "tabula_hu_2014, 77. o."
     },
     {
      "szerep": "magastető",
      "leiras": "Cserép, 25 cm kőzetgyapot, párazáró, gipszkarton",
      "retegek": [
       {
        "nev": "gipszkarton",
        "dCm": 1.25
       },
       {
        "nev": "párazáró lemez",
        "dCm": null
       },
       {
        "nev": "kőzetgyapot",
        "dCm": 25
       },
       {
        "nev": "alátéthéjazat",
        "dCm": null
       },
       {
        "nev": "lécezés",
        "dCm": null
       },
       {
        "nev": "cserép",
        "dCm": 2
       }
      ],
      "U": 0.15,
      "forras": "tabula_hu_2014, 77. o."
     },
     {
      "szerep": "padlasfodem",
      "leiras": "15 cm vasbeton + 20 cm ásványgyapot",
      "retegek": [
       {
        "nev": "vakolat",
        "dCm": 1.5
       },
       {
        "nev": "vasbeton",
        "dCm": 15
       },
       {
        "nev": "ásványgyapot",
        "dCm": 20
       }
      ],
      "U": 0.17,
      "forras": "tabula_hu_2014, 77. o.",
      "megjegyzes": "A brosúra zárójelben adja."
     },
     {
      "szerep": "pince_feletti_fodem",
      "leiras": "Vasbeton födém alul 15 cm hőszigeteléssel, 4 cm polisztirol, aljzatbeton, parketta",
      "retegek": [
       {
        "nev": "parketta",
        "dCm": 2
       },
       {
        "nev": "aljzatbeton",
        "dCm": 6
       },
       {
        "nev": "polisztirol",
        "dCm": 4
       },
       {
        "nev": "vasbeton födém",
        "dCm": 20
       },
       {
        "nev": "hőszigetelés",
        "dCm": 15
       }
      ],
      "U": 0.19,
      "forras": "tabula_hu_2014, 77. o."
     },
     {
      "szerep": "ablak",
      "leiras": "Hőszigetelt, kétrétegű üvegezésű ablak, low-e bevonattal, argon gáztöltéssel",
      "retegek": [],
      "U": 1.3,
      "forras": "tabula_hu_2014, 78. o."
     },
     {
      "szerep": "ajto",
      "leiras": "Hőszigetelt ajtó",
      "retegek": [],
      "U": 1.8,
      "forras": "tabula_hu_2014, 78. o."
     }
    ]
   },
   {
    "szint": "kozel_nulla",
    "szerkezetek": [
     {
      "szerep": "fal",
      "leiras": "30 cm falazóblokk + 20 cm polisztirol hőszigetelés, vékonyvakolat",
      "retegek": [
       {
        "nev": "vakolat",
        "dCm": 2
       },
       {
        "nev": "falazóblokk",
        "dCm": 30
       },
       {
        "nev": "polisztirol hőszigetelés",
        "dCm": 20
       },
       {
        "nev": "vakolat",
        "dCm": 0.5
       }
      ],
      "U": 0.14,
      "forras": "tabula_hu_2014, 77. o."
     },
     {
      "szerep": "magastető",
      "leiras": "Cserép, 20 cm PIR hab hőszigetelés, párazáró, gipszkarton",
      "retegek": [
       {
        "nev": "gipszkarton",
        "dCm": 1.25
       },
       {
        "nev": "párazáró lemez",
        "dCm": null
       },
       {
        "nev": "PIR hab hőszigetelés",
        "dCm": 20
       },
       {
        "nev": "alátéthéjazat",
        "dCm": null
       },
       {
        "nev": "lécezés",
        "dCm": null
       },
       {
        "nev": "cserép",
        "dCm": 2
       }
      ],
      "U": 0.13,
      "forras": "tabula_hu_2014, 77. o."
     },
     {
      "szerep": "padlasfodem",
      "leiras": "15 cm vasbeton + 30 cm ásványgyapot",
      "retegek": [
       {
        "nev": "vakolat",
        "dCm": 1.5
       },
       {
        "nev": "vasbeton",
        "dCm": 15
       },
       {
        "nev": "ásványgyapot",
        "dCm": 30
       }
      ],
      "U": 0.12,
      "forras": "tabula_hu_2014, 77. o.",
      "megjegyzes": "A brosúra zárójelben adja."
     },
     {
      "szerep": "pince_feletti_fodem",
      "leiras": "Vasbeton födém alul 20 cm hőszigeteléssel, 4 cm polisztirol, aljzatbeton, parketta",
      "retegek": [
       {
        "nev": "parketta",
        "dCm": 2
       },
       {
        "nev": "aljzatbeton",
        "dCm": 6
       },
       {
        "nev": "polisztirol",
        "dCm": 4
       },
       {
        "nev": "vasbeton födém",
        "dCm": 20
       },
       {
        "nev": "hőszigetelés",
        "dCm": 20
       }
      ],
      "U": 0.15,
      "forras": "tabula_hu_2014, 77. o."
     },
     {
      "szerep": "ablak",
      "leiras": "Háromrétegű üvegezésű ablak, low-e bevonattal, argon gáztöltéssel",
      "retegek": [],
      "U": 1.0,
      "forras": "tabula_hu_2014, 78. o."
     },
     {
      "szerep": "ajto",
      "leiras": "Hőszigetelt ajtó",
      "retegek": [],
      "U": 1.3,
      "forras": "tabula_hu_2014, 78. o."
     }
    ]
   }
  ]
 },
 {
  "kod": "HU.N.AB.05.Gen",
  "csoport": "nagy_tarsashaz",
  "korszak": [
   2006,
   null
  ],
  "nev": "2006 után épült nagy társasház (nem panel)",
  "leiras": "Ötszintes, lapostetős, teljesen alápincézett új társasház, 100 lakás, átlag 50 m² lakásonként (brosúra 81. o.; a DB 30 lakást, 1702 m²-t ad). A TABULA HU-ban az AB.02.Ind és AB.03.Ind panelos (itt kihagyva); 2006 előtti nem-panel nagy társasház típus nincs.",
  "szerkezetek": [
   {
    "szerep": "fal",
    "leiras": "30 cm falazóblokk + 10 cm polisztirol hőszigetelés, vékonyvakolat",
    "retegek": [
     {
      "nev": "vakolat",
      "dCm": 1.5
     },
     {
      "nev": "falazóblokk",
      "dCm": 30
     },
     {
      "nev": "polisztirol hőszigetelés",
      "dCm": 10
     },
     {
      "nev": "vakolat",
      "dCm": 0.5
     }
    ],
    "U": 0.22,
    "forras": "tabula_hu_2014, 82. o.; tabula_calc_db"
   },
   {
    "szerep": "lapostető",
    "leiras": "Vasbeton födém, 7 cm beton lejtésképzés, 15 cm hőszigetelés, vízszigetelés",
    "retegek": [
     {
      "nev": "vasbeton födém",
      "dCm": 20
     },
     {
      "nev": "beton lejtésképzés",
      "dCm": 7
     },
     {
      "nev": "hőszigetelés",
      "dCm": 15
     },
     {
      "nev": "vízszigetelés",
      "dCm": null
     }
    ],
    "U": 0.24,
    "forras": "tabula_hu_2014, 82. o.; tabula_calc_db"
   },
   {
    "szerep": "pince_feletti_fodem",
    "leiras": "Vasbeton födém alul 10 cm hőszigeteléssel, 4 cm polisztirol, aljzatbeton, parketta",
    "retegek": [
     {
      "nev": "parketta",
      "dCm": 2
     },
     {
      "nev": "aljzatbeton",
      "dCm": 6
     },
     {
      "nev": "polisztirol",
      "dCm": 4
     },
     {
      "nev": "vasbeton födém",
      "dCm": 20
     },
     {
      "nev": "hőszigetelés",
      "dCm": 10
     }
    ],
    "U": 0.24,
    "forras": "tabula_hu_2014, 82. o.; tabula_calc_db"
   },
   {
    "szerep": "ablak",
    "leiras": "Hőszigetelt, kétrétegű üvegezésű ablak, low-e bevonattal, argon gáztöltéssel",
    "retegek": [],
    "U": 1.5,
    "g": 0.65,
    "forras": "tabula_hu_2014, 82. o.; tabula_calc_db; g: tabula_calc_db (g_gl_n, normál beesésű üvegezés)"
   },
   {
    "szerep": "ajto",
    "leiras": "Fa bejárati ajtó",
    "retegek": [],
    "U": 2.0,
    "forras": "tabula_hu_2014, 82. o.; tabula_calc_db"
   }
  ],
  "valtozatok": [
   {
    "szint": "alacsony_energia",
    "szerkezetek": [
     {
      "szerep": "fal",
      "leiras": "30 cm falazóblokk + 15 cm polisztirol hőszigetelés, vékonyvakolat",
      "retegek": [
       {
        "nev": "vakolat",
        "dCm": 2
       },
       {
        "nev": "falazóblokk",
        "dCm": 30
       },
       {
        "nev": "polisztirol hőszigetelés",
        "dCm": 15
       },
       {
        "nev": "vakolat",
        "dCm": 0.5
       }
      ],
      "U": 0.17,
      "forras": "tabula_hu_2014, 82. o."
     },
     {
      "szerep": "lapostető",
      "leiras": "Vasbeton födém, 7 cm beton lejtésképzés, 25 cm hőszigetelés, vízszigetelés",
      "retegek": [
       {
        "nev": "vasbeton födém",
        "dCm": 20
       },
       {
        "nev": "beton lejtésképzés",
        "dCm": 7
       },
       {
        "nev": "hőszigetelés",
        "dCm": 25
       },
       {
        "nev": "vízszigetelés",
        "dCm": null
       }
      ],
      "U": 0.15,
      "forras": "tabula_hu_2014, 82. o."
     },
     {
      "szerep": "pince_feletti_fodem",
      "leiras": "Vasbeton födém alul 15 cm hőszigeteléssel, 4 cm polisztirol, aljzatbeton, parketta",
      "retegek": [
       {
        "nev": "parketta",
        "dCm": 2
       },
       {
        "nev": "aljzatbeton",
        "dCm": 6
       },
       {
        "nev": "polisztirol",
        "dCm": 4
       },
       {
        "nev": "vasbeton födém",
        "dCm": 20
       },
       {
        "nev": "hőszigetelés",
        "dCm": 15
       }
      ],
      "U": 0.19,
      "forras": "tabula_hu_2014, 82. o."
     },
     {
      "szerep": "ablak",
      "leiras": "Hőszigetelt, kétrétegű üvegezésű ablak, low-e bevonattal, argon gáztöltéssel",
      "retegek": [],
      "U": 1.3,
      "forras": "tabula_hu_2014, 82. o."
     },
     {
      "szerep": "ajto",
      "leiras": "Hőszigetelt ajtó",
      "retegek": [],
      "U": 1.8,
      "forras": "tabula_hu_2014, 82. o."
     }
    ]
   },
   {
    "szint": "kozel_nulla",
    "szerkezetek": [
     {
      "szerep": "fal",
      "leiras": "30 cm falazóblokk + 20 cm polisztirol hőszigetelés, vékonyvakolat",
      "retegek": [
       {
        "nev": "vakolat",
        "dCm": 2
       },
       {
        "nev": "falazóblokk",
        "dCm": 30
       },
       {
        "nev": "polisztirol hőszigetelés",
        "dCm": 20
       },
       {
        "nev": "vakolat",
        "dCm": 0.5
       }
      ],
      "U": 0.14,
      "forras": "tabula_hu_2014, 82. o."
     },
     {
      "szerep": "lapostető",
      "leiras": "Vasbeton födém, 7 cm beton lejtésképzés, 20 cm PIR hab hőszigetelés, vízszigetelés",
      "retegek": [
       {
        "nev": "vasbeton födém",
        "dCm": 20
       },
       {
        "nev": "beton lejtésképzés",
        "dCm": 7
       },
       {
        "nev": "PIR hab hőszigetelés",
        "dCm": 20
       },
       {
        "nev": "vízszigetelés",
        "dCm": null
       }
      ],
      "U": 0.12,
      "forras": "tabula_hu_2014, 82. o."
     },
     {
      "szerep": "pince_feletti_fodem",
      "leiras": "Vasbeton födém alul 20 cm hőszigeteléssel, 4 cm polisztirol, aljzatbeton, parketta",
      "retegek": [
       {
        "nev": "parketta",
        "dCm": 2
       },
       {
        "nev": "aljzatbeton",
        "dCm": 6
       },
       {
        "nev": "polisztirol",
        "dCm": 4
       },
       {
        "nev": "vasbeton födém",
        "dCm": 20
       },
       {
        "nev": "hőszigetelés",
        "dCm": 20
       }
      ],
      "U": 0.15,
      "forras": "tabula_hu_2014, 82. o."
     },
     {
      "szerep": "ablak",
      "leiras": "Háromrétegű üvegezésű ablak, low-e bevonattal, argon gáztöltéssel",
      "retegek": [],
      "U": 1.0,
      "forras": "tabula_hu_2014, 82. o."
     },
     {
      "szerep": "ajto",
      "leiras": "Hőszigetelt ajtó",
      "retegek": [],
      "U": 1.3,
      "forras": "tabula_hu_2014, 82. o."
     }
    ]
   }
  ]
 }
] as unknown as TipologiaTipus[];

/** Típusok egy csoportban; az építés évéhez illők elöl. */
export function tipusokCsoportban(csoport: TipologiaCsoport, ev: number): { tipus: TipologiaTipus; illik: boolean }[] {
  return TIPOLOGIA.filter((t) => t.csoport === csoport || t.tovabbiCsoport === csoport)
    .map((t) => ({ tipus: t, illik: (t.korszak[0] ?? 0) <= ev && ev <= (t.korszak[1] ?? 9999) }))
    .sort((a, b) => Number(b.illik) - Number(a.illik));
}
