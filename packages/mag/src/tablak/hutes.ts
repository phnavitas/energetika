/**
 * Hűtési rendszer – 9/2023 ÉKM számítási módszer, 1. függelék 11.1 (egyszerűsített módszer).
 *   QH,vég = QH,net · cH · εH,szab · εH,száll · εH      (11.1)
 *   εH = 1 / SEER                                       (11.3)
 * Az elosztási veszteség egyszerűsített módszernél elhanyagolható (εH,száll = 1, 11.1.3).
 */
export const HUTES_FORRAS = '9/2023 ÉKM számítási módszer, 1. függelék 11.1–11.3. táblázat';

/** 11.1. táblázat – teljes és érezhető hűtőteljesítmény aránya. */
export const HUTES_CH = {
  klimagerenda_16_18: { cH: 1.0, nev: 'Hűtőközeg 16/18 °C (pl. klímagerenda, hűtőmennyezet)' },
  fancoil_6_12: { cH: 1.25, nev: 'Hűtőközeg 6/12 °C (pl. fan-coil)' },
  direkt_elparologtato: { cH: 1.45, nev: 'Közvetlen elpárologtatós rendszer (5 °C), pl. split klíma' },
} as const;
export type HutesChKod = keyof typeof HUTES_CH;

/** 11.2. táblázat – SEER és εH. */
export const HUTOGEPEK = {
  split: { SEER: 2.5, eps: 0.4, nev: 'Kompresszoros léghűtés (split)', energiahordozo: 'villamos' },
  leghutes_folyadekhuto: { SEER: 3.0, eps: 0.33, nev: 'Léghűtéses kompakt és osztott kivitelű (távkondenzátoros) folyadékhűtő', energiahordozo: 'villamos' },
  vizhutes_scroll: { SEER: 4.3, eps: 0.23, nev: 'Vízhűtéses folyadékhűtő (scroll kompresszor)', energiahordozo: 'villamos' },
  vizhutes_csavar: { SEER: 5.0, eps: 0.2, nev: 'Vízhűtéses folyadékhűtő (csavarkompresszor)', energiahordozo: 'villamos' },
  vizhutes_turbo: { SEER: 7.0, eps: 0.14, nev: 'Vízhűtéses folyadékhűtő (turbókompresszor)', energiahordozo: 'villamos' },
  talajho_viz_hsz: { SEER: 5.0, eps: 0.2, nev: 'Talajhő/víz elektromos hőszivattyú', energiahordozo: 'villamos' },
  gaz_hsz_hasznositott: { SEER: 1.7, eps: 0.58, nev: 'Földgáz üzemű hőszivattyú, a gázmotor hulladékhője hasznosítva', energiahordozo: 'fosszilis_gaz' },
  gaz_hsz: { SEER: 1.4, eps: 0.71, nev: 'Földgáz üzemű hőszivattyú, a gázmotor hulladékhője nincs hasznosítva', energiahordozo: 'fosszilis_gaz' },
} as const;
export type HutogepKod = keyof typeof HUTOGEPEK;

/** 11.3. táblázat – szabályozási veszteségtényező εH,szab. */
export const HUTES_SZAB = {
  viz_6_12: { eps: 1.13, nev: 'Hűtött víz 6/12 °C (pl. fan-coil)' },
  viz_8_14: { eps: 1.1, nev: 'Hűtött víz 8/14 °C (pl. fan-coil)' },
  viz_14_18: { eps: 1.0, nev: 'Hűtött víz 14/18 °C (pl. indukciós berendezés)' },
  viz_16_18: { eps: 1.0, nev: 'Hűtött víz 16/18 °C (pl. hűtőmennyezet)' },
  viz_18_20: { eps: 1.1, nev: 'Hűtött víz 18/20 °C (pl. padlóhűtés)' },
  lev_passziv: { eps: 1.0, nev: 'Befúvó-elszívó berendezés passzív hűtéssel (pl. talajhőcserélő)' },
  lev_aktiv: { eps: 1.1, nev: 'Befúvó-elszívó berendezés aktív hűtéssel (pl. hőszivattyús hővisszanyerés)' },
  direkt: { eps: 1.13, nev: 'Direkt elpárologtatás' },
} as const;
export type HutesSzabKod = keyof typeof HUTES_SZAB;

/** 11.1.2: passzív talajhőcserélős hűtésnél 1 kWh segédenergia 10 kWh nettó hűtési igényt fedez. */
export const PASSZIV_TALAJ_ARANY = 10;
