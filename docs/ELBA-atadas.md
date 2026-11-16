# Átadás az ELBA-nak: épületmodell PDF-tervlapokból

Az ELBA BIM modulja ma IFC-ből dolgozik (`app/elba-bim-olvaso.js` → `elba-bim-epito.js`). Ez a csomag a **PDF-tervlapokból**
(alaprajz, metszet, homlokzat) épít ugyanolyan célú, IFC-szerű épületmodellt, hogy IFC nélkül is legyen pontos
mennyiségkiírás. A felismerő mag közös a Navitherm (energetika) Tervből lépésével – egy forrásból fejlődik, ebben
a repóban (`phnavitas/energetika`).

## Mit kap az ELBA

`dist/elba/elba-terv.mjs` – böngészős ES-modul (≈ 2,5 MB, a pdf.js „legacy” változatával, munkaszál nélkül).
Előállítása: `npm run elba:csomag` (a forrás: `apps/web/src/terv/elba.ts`).

```js
const { pdfbolEpulet } = await import('./elba-terv.mjs');           // lusta betöltés
const { modell, lapok, figyelmeztetes } = await pdfbolEpulet(fajlok, {  // File[] (input type=file)
  halad: (arany, szoveg) => {},                                        // 0…1
  allapot: { /* felülírható döntések, ld. lent */ },
});
```

- `lapok`: a beolvasott oldalak szerepe (`alaprajz | metszet | homlokzat | leiras | egyeb`), címe, hibája – ezt érdemes
  megmutatni a felhasználónak (rossz szerep = hiányos modell).
- `figyelmeztetes`: nem végzetes gondok (nincs metszet → nincs födém-rétegrend, tetőhajlás, koszorú).
- `modell`: `EpuletModell` (típus: `packages/terv/src/epulet.ts`), ld. lent. Egy 3 lapos családi ház ≈ 15–20 s.

Felhasználói döntések nélkül fut, a Tervből lépés alapértelmezéseivel: a helyiségek besorolása a nevükből, a szintek a
lapcímből, az északi irány a rajzról / a homlokzatokból, a belmagasság és a metszet az első metszetlapról. Felülírható
(`allapot`): `lapSzerep` (lapindex → `'alaprajz' | 'metszet' | 'homlokzat' | 'leiras' | 'egyeb'`; a lapindex a visszaadott
`lapok` sorrendje – az alaprajznak jelölt lap képét a csomag újra előállítja), `szintKi` (lapindex → szintkódok, pl. `{0: ['F'], 1: ['T']}`), `bm` (belmagasság), `terdfalKezi`,
`kijelolesek`, `eszakKozos` stb. (`FolyamatAllapot`, `apps/web/src/terv/folyamat.ts`).

**Ellenőrizve:** a csomag kimenete a két IFC-párral rendelkező mintán (Naszály, Nyárfa) bitre azonos a Navitherm
alkalmazás teljes modelljével.

## A modell (méter, a lapról: x jobbra, y lefelé; z a földszinti padlótól)

| mező | tartalom | ELBA-megfelelő |
|---|---|---|
| `szintek[]` | `id` (P, F, 1…, T), `z0`, `h` (padlótól padlóig), `belmag` | szint |
| `terek[]` | helyiség: `kod`, `nev`, `A` (pecsét szerint), `poligonok`, `belmag`, `kategoria` (futott / futetlen / kulter), `burkolat` | zóna (padló-, falburkolat, festés) |
| `falak[]` | tengely `a→b`, `vastag` (teljes), **`mag`** (szerkezeti réteg), `retegek` (bal→jobb, PDF-réteg + vastagság), `szerkezet` (teherhordo / valaszfal / egyeb / **hatar** = nem fal), `kulso`, `z0`, `h`, `hossz`, `sikHossz`, `belsoMag`, `profil` (tetőtér) | `MON_FAL` / falazás; a `hatar` falat **ki kell hagyni** |
| `nyilasok[]` | `fal`, `t` (közép a tengelyen), `szel`, `mag`, `pm` (parapet), `fajta` (ablak, erkelyajto, bejarati_ajto, garazskapu, belso_ajto, …) | ablak / ajtó / kapu; falfelület-levonás |
| `fodemek[]` | `FP*` padló / közbenső födém, `FT*` legfelső, **`FL*` lapostető** (`lapos`: terület, szabad szél, falcsatlakozás, attika); `z` = felső sík, `vastag`, `retegek` (metszetből, felülről lefelé) | födém, lapostető rétegei |
| `pillerek[]` | `kozep`, `a × b`, `z0`, `h`, `reteg`, **`hely`** (fal / veg / sarok / szabad), `falId` | `PILLER`; a falban álló a fal hosszában benne van (az ELBA `pillerFalhoz` szabálya) – a falfelületből levonandó |
| `koszoruk[]` | szintenként: `szel × magas`, `zFelso`, `hossz`, `falak`; `fajta: 'attika'` a lapostetős részen | koszorú, attika |
| `gerendak[]` | kiváltó / alulbordás: `a→b`, `szel`, `alsoSik`, `felsoSik`, `magas` | `MON_GERENDA` |
| `alapozas[]` | `savalap` / `labazat` (zsalukő) / `pontalap` (szabad pillér alatt, `becsult`) / `lemezalap` (`terulet`): `szel × magas`, `hossz` | alapozás (sávalap, lemezalap) |
| `magasteto` | `haromszogek` (a tetőfelület), `eresz`, `hajlas`, `kiallas` (+ `kiallasBecsult`), `zEresz`, `mod` | **közvetlenül** `ElbaBimGeometria.tetoBontas(magasteto.haromszogek, {})` – ugyanaz, mint IFC-nél |

A tető `mod`-ja: `derekszogu` (pontos), `konvex`, `vaz` (egyenes váz, ferde alaprajz), `kozelito` (csak elfajuló
esetben – ezt jelezni kell). Oromfalat csak a derékszögű ág kezel.

## Javasolt ELBA-oldali lépések

1. **Betöltés:** a BIM varázslóban „PDF-tervlapokból” lehetőség az IFC mellett; a csomag lusta betöltése; a lapok
   szerepének megmutatása (javítható szerep → `allapot.lapSzerep`, majd újrahívás).
2. **Átalakítás az építő bemenetére:** a modellből olyan elemlista, amilyet az `elba-bim-olvaso.js` ad (`ifc`, `oszt`,
   `tipusNev`, `anyag`, `folia`, `szint`, `q{…}` mennyiségek), hogy az `elba-bim-epito.js` szabályai változatlanul
   fussanak. Javaslat: fal → `IFCWALL` / `oszt: 'Fal'`, `tipusNev` a rétegből és a mag vastagságából, `q`: hossz,
   magasság, vastagság, nettó felület (nyílások levonva, falban álló pillér levonva); nyílás → `IFCWINDOW` /
   `IFCDOOR`; födém → `IFCSLAB` (`Födém` / `Lapostető` / `Alap födém`), rétegenként; pillér, koszorú, gerenda,
   alapozás a megfelelő `oszt`-tal; tér → zóna. A tető a `tetoBontas`-ba megy (nincs IFC-elem).
3. **Ellenőrzés a meglévő próbákkal:** a Naszály-mintán az IFC-ből és a PDF-ből kapott tételek egymás mellett
   (a terv-oldali eltérések: `packages/ifc` összevetés, ld. lent).

## Az IFC-olvasó ismert osztályozási hibái (a költözéskor javítandók)

Részletesen: `packages/ifc/README.md`. Röviden:

- **Nyárfa (iTWO):** 29 „VASBETON pillér” típusú koszorú → `MON_FAL` (helyesen koszorú); a 15 cm-es tetőlemez →
  `PILLER`; a „szekcionált garázsajtó” és a fal fóliáján ülő pillér falként számít; a falvastagság a típusnév végi
  mm-értéke („FAL - POROTHERM 30 300” → 30 cm), ha az összetevő-szélesség / befoglaló doboz eltér.
- **Naszály (ArchiCAD):** 13 XPS pillérburkolat → `PILLER` (hőszigetelés, nem tartószerkezet); az ereszdeszkázat →
  `MON_GERENDA`; 14 tetőelem `IFCFOOTING`-ként exportálva.

Szabály a tartószerkezeti osztályokhoz: pillér / gerenda csak tartószerkezeti anyaggal (vasbeton, acél, fa
tartó) – a hőszigetelés-burkolat, eresz, csatorna, járda, korlát nem.

## Pontosság (PDF-modell az IFC-hez képest)

| | Naszály | Nyárfa |
|---|---|---|
| falak, vastagságban egyező hossz | 98,1 / 99,8 m | F 105,9 / 107,0 m · T 64,9 / 64,9 m |
| nyílászárók | 25 / 25 | a rajz minden felirata megvan (az IFC 1–2 helyen más tervváltozat) |
| pillérek | 9 / 9 | 8 a rajzon, 5 az IFC-ben (3 falban álló vb) |
| koszorú + attika + gerenda | 67,5 / 65,8 m | 126,3 / 129,1 m |
| magastető | felület 205,9 / 205,8 m², eresz, gerinc, él, vápa egyezik | (az IFC-ben nincs tető) |
| alapozás | keresztmetszet pontos, hossz +10 % (belső 33-as falak alatt is – szabály szerint) | sávalap + lábazat + 2 becsült pontalap |

## Szabályok, amelyeket a modell követ (a felhasználó döntései)

- Fal: a vastagság a méretek / feliratok / rétegrend szerint; a 33 cm-es rajzi fal 30 cm-es mag + vakolat (32 cm is
  létezik, ritka). A pillér a falhoz kötve (ELBA `pillerFalhoz`), a falhossz tartalmazza.
- Alapozás: belső főfal alatt (≥ 20 cm) mindig sávalap, kivéve lemezalapnál; lemezalapnál a széleken
  fagyhatárig sávalap / gerenda lehet; lemezalap ≥ 18 cm.
- Tető: mindig a geometriából, az ELBA megadási szabályai szerint (`tetoBontas`); ha van tetőszerkezet a modellben,
  az elemek onnan is vehetők, ha nincs, az ELBA számolja.

## Fejlesztés, frissítés

- A mag (`packages/terv`) és a folyamat (`apps/web/src/terv/folyamat.ts`) ebben a repóban fejlődik; az ELBA a
  csomagot veszi át – frissítéskor újragenerálás és csere. A `dist/` nincs a repóban; előállítás:
  `git clone https://github.com/phnavitas/energetika && cd energetika && npm ci && (cd apps/web && npm ci) && npm run elba:csomag`,
  majd `dist/elba/elba-terv.mjs` → az ELBA `app/` mappájába (pl. `app/elba-terv.mjs`), a commit üzenetében az
  energetika commit-azonosítójával.
- Próba: `tools/ifc/osszevet.mts <modell.json> <minta.ifc>` – a PDF-modell és az IFC tételes összevetése.
- A minták (PDF, IFC) nem kerülnek repóba (személyes adat a tervpecséten).
