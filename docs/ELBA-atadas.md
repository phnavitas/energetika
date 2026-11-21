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
- `zartsag`: `ZartsagHiba[]` – a modell zártságának ellenőrzése (`packages/terv/src/zartsag.ts`). Ha nem üres, a
  beolvasás hiányos: a felhasználónak meg kell mutatni, hol. Elemei: `fajta` (`fal` = a födém/padló körvonalán
  ≥ 0,3 m-es falhiány, `a→b` a rés két vége; `orom` = külső fal teteje és a tető alsó síkja között rés; `teto` = a
  tetőfelület nyitott éle nem az ereszen; `fedes` = a legfelső szint ≥ 1 m²-es része tető nélkül), `szint`, `hely`
  (m), `meret` (m vagy m²), `leiras` (magyar szöveg, közvetlenül kiírható). Javaslat: piros jelölés a 3D-ben a
  `hely` / `a→b` pontokon + lista; a `figyelmeztetes` is tartalmaz egy összefoglaló sort.
- `modell`: `EpuletModell` (típus: `packages/terv/src/epulet.ts`), ld. lent. Egy 3 lapos családi ház ≈ 15–20 s.

Felhasználói döntések nélkül fut, a Tervből lépés alapértelmezéseivel: a helyiségek besorolása a nevükből, a szintek a
lapcímből (a két sorba tördelt lapcím – „Harmadik emeleti” / „alaprajz” – egyben; szint nélküli címnél – „UTCASZINTI
ALAPRAJZ” – a fűtött helyiségpecsétekhez legközelebbi relatív szintjelekből: ±0,6 m földszint, 2,2 m felett emelet,
−1,5 m alatt pince), az északi irány a rajzról / a homlokzatokból (északjel nélküli alaprajznál a helyszínrajz északjele, ha a
homlokzatok égtáj-elnevezésétől legfeljebb 45°-kal tér el), a belmagasság és a metszet az első metszetlapról (metszet
nélkül a belmagasság a helyiségpecsétek egységes „bm” értékéből, pl. „bm: 2,90 m”). Felülírható
(`allapot`): `lapSzerep` (lapindex → `'alaprajz' | 'metszet' | 'homlokzat' | 'leiras' | 'egyeb'`; a lapindex a visszaadott
`lapok` sorrendje – az alaprajznak jelölt lap képét a csomag újra előállítja), `szintKi` (lapindex → szintkódok, pl. `{0: ['F'], 1: ['T']}`), `bm` (belmagasság), `terdfalKezi`,
`kijelolesek`, `eszakKozos` stb. (`FolyamatAllapot`, `apps/web/src/terv/folyamat.ts`).

Kézi javítás (a Navitherm 3D nézetében is így működik): `allapot.modellKezi` – `hajlas` (fok, 0 = lapostető),
`kiallas` (ereszkiállás, m), `orom` (tetővég lapirány szerint – 0 fent, 90 jobbra, 180 lent, 270 balra → `true` oromfal,
`false` konty), `belmag` (szintkód → belmagasság, m; a szintek magassága ebből halmozódik). A körvonal kézi
javítása: `allapot.kijelolesek[lapindex].burok` – a hőburok körvonala (pt, a fal külső síkján); megadásakor a külső
falak és a födémek / a tető alaprajza ebből (a fűtetlen terek tömegével együtt) készül.

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
| `magasteto` | `haromszogek` (a tetőfelület), `eresz`, `hajlas`, `kiallas` (+ `kiallasBecsult`), `zEresz`, `mod`, `fedett` (a tető alá vont fedett teraszok sávjai – szabad pillérsorig), `lapos` (a legfelső szint lapostetős részei – a magastető ezeken kívül; itt a legfelső födém a tető), `felteto` (féltetős részek: alaprajz, hajlás, a lejtés lapiránya; a háromszögeik a `haromszogek` közt, az alsó él az eresz magasságában), `tovabbiEresz` (több magastetős darabnál a további darabok ereszvonala) | **közvetlenül** `ElbaBimGeometria.tetoBontas(magasteto.haromszogek, {})` – ugyanaz, mint IFC-nél |

A tető körvonala a legfelső szint körvonala, kiegészítve a fedett teraszokkal (a körvonal egy élén kívül, vele párhuzamos
sorban álló, legalább két szabad pillérig). Oromfal csak ott, ahol a homlokzaton a tető hajlásával futó háromszög alatt
falfelület van – a kontylap (alatta héjazat-sraffozás / tetőréteg) nem oromfal. A helyszínrajz nem alaprajz (`egyeb`).

A tető formáját (konty / oromfal végenként) a helyszínrajz vagy tetőfelülnézet tetővonalai pontosítják
(`packages/terv/src/tetoFelulnezet.ts`: a 45°-os élpárok + gerinc → konty, élek nélküli gerincvég → orom); a lapon
a méretek szerint egyező épülettömb számít, a szomszéd épületek nem.

A legfelső szint körvonalának sekély (≤ 0,6 m, ill. ≤ ereszkiállás; ≤ 6 m széles) befelé nyíló fülkéi (bejárati
fülke) fölött az eresz egyenesen fut át – a tető nem vápázik be.

A külső falak, amelyeknél a tető alsó síkja a fal teteje fölött van (oromfal, magastetős szint), `profil`-t kapnak
(a tető vonalát követő felső él, `jelleg: 'oromfal'`), így a fal és a tető között nincs rés.

Külső fal rétegei: ha az alaprajzi falvastagság a metszet / leírás falrétegrendjéből hiányzik (pl. a rajzon csak a
falazat + 20 cm, a rétegrend 30 cm hőszigetelést ír), a fal a rétegrend teljes vastagságát kapja, a tengely kifelé
tolódik (a belső síkja marad), a sarkok összeérnek; a rétegek a rétegrendből jönnek (`retegForras` = a rétegrend
kódja). Így az épület külső mérete is a rétegrend szerinti.

A tető `mod`-ja: `derekszogu` (pontos), `konvex`, `vaz` (egyenes váz, ferde alaprajz), `kozelito` (csak elfajuló
esetben – ezt jelezni kell). Oromfalat csak a derékszögű ág kezel.

## Kijelölés a rajzon és a 3D-ben (2D ⇄ 3D)  (2026-11-21)

A régi ELBA PDF-rendszer a saját primitívjeire visszamutatva jelölt ki; az új csomag ugyanezt a modellelemekre adja:

- `elemAlakok[]` (a `pdfbolEpulet` eredményében): minden fal, nyílás, tér (helyiség), födém, pillér, gerenda alakja a
  forrás-tervlapon – `{ id, tipus, lap, szint, poligonok }`; `lap` a visszaadott `lapok` sorrendje, a sokszögek
  lapkoordinátában (pt, bal felső origó, y lefelé – ugyanaz, mint a régi `elba-pdf-olvaso.js` koordinátái).
  Az `id` a modell elemének azonosítója (`falak[].id`, `nyilasok[].id`, `terek[].id` …) – a 3D kijelölés ezzel párosít.
- `lapKepek[]`: a lapok előnézeti képe (JPEG dataURL) – `kepSzel × kepMag` képpont, `szel × mag` pont; a sokszög a
  képre: `px = pt × kepSzel / szel`. Saját PDF-megjelenítés nélkül is rárajzolható a kijelölés.
- `elemekPontban(elemAlakok, lap, x, y)` (a csomag exportja): a lapon kattintott ponthoz tartozó elemek, a legkisebb
  (legbelső) elöl – a rajzi kattintás → 3D kijelölés.
- `modell.lapok[]` (`LapKapcsolat`): `{ lap, szintek, mPerPt, o }` – a modell → lap leképezés:
  `pt = (x / mPerPt + o[0], y / mPerPt + o[1])` (bármely modellpontra, pl. a 3D-ben kattintott helyre).
- **Kész lapnézet:** `lapNezo(hely, eredmeny, { onKijeloles(id, alak) {…} })` (a csomag exportja,
  `apps/web/src/terv/elbaNezo.ts`): a lap képe az elemek alakjával (fal piros, nyílás kék, helyiség zöld), lapválasztó,
  görgős nagyítás, húzás, dupla kattintás = teljes lap; kattintásra kijelöl (`onKijeloles` → a 3D / lista felé), és
  `nezo.kijelol(id)`-vel kívülről kiemel (a lapjára ugrik). Függőség nélküli DOM + SVG.
- Javaslat az ELBA-oldalon: a BIM-nézet (3D) mellett a lapkép, rajta az `elemAlakok`; kattintás bármelyiken →
  ugyanaz az `id` mindkettőn kiemelve, és a párosítófában / listában is (mint az IFC-nél az elem GUID-ja).

## Anyagok, rétegrendek (BIM)  (2026-11-21)

- `modell.retegrendek[]` (`ModellRetegrend`): a metszet(ek) összes rétegrendje – `kod`, `cim`, `szerep` (fal / padló /
  födém / tető …), `hoburok` (`true`, vagy az ok, amiért nem – válaszfal, terasz), `hoaramIrany`, `kulsoOldal`,
  `retegek[]` (`leiras` a terv szövege, `vastag` m, `anyag` a katalógusból: `id`, `nev`, `kategoria`, `sraffozas`,
  `lambda` W/mK, `mu`, `R` – termék-ellenállás adott vastagságnál; `legreteg`, `borda` – szarufa / váz a rétegben,
  `kimarad` – a hőtechnikai számításból kimaradó réteg és oka), `U` (W/m²K, ha minden réteg hővezetése ismert),
  `forras` (metszetlap, a rétegrend-felirat helye – kijelöléshez). A falak `retegForras`-a erre a kódra hivatkozik.
- Falak anyaga a **jelmagyarázatból** (`packages/terv/src/jelmagyarazat.ts`, a régi ELBA-értelmező jelmagyarázat-olvasója
  alapján): a lap „Jelmagyarázat / Jelkulcs / Anyagjelölések” tételeinek mintája (kitöltőszín, mintázat, PDF-réteg) és
  a fal kitöltése egyezik → `falak[].anyag.nev` (pl. „zsalukő faltest”), `anyag.anyagId` (katalógus); többrétegű falnál
  rétegenként (`falak[].retegek[].nev / anyagId`). `modell.anyagok`: a használt katalógusanyagok (anyagId → λ, μ, R …).
  Csak egyértelmű egyezésnél (egy névhez egy szín / réteg); a vonalakkal sraffozott (kitöltés nélküli) minta még nem.
- `jelmagyarazat[]` (az eredményben): a lapok jelmagyarázat-tételei (`nev`, `szin`, `minta`, `reteg`, `lap`, hely).
- `homlokzatiAnyagok[]` (az eredményben): a homlokzati lapok számozott anyaglistája (`szam`, `anyag` – anyag, szín,
  termék egyben, ahogy a terven áll –, `lap`, hely), a régi `elba-pdf-ertelmezo.js` `homlokzatiAnyagok`-ja szerint.

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
- Hőburok-körvonal és épülettömeg: a fűtött terekhez fal nélkül csatlakozó belső zseb (a zónából kihagyott, 1,9 m
  alatti tetőtéri sáv a térdfalig, a zónán kívüli vagy a helyiségből kifolyt lépcső) a burok része, ha ≥ 0,5 m², nem
  keskeny falmag / hajszálrés (≤ 0,4 m-es sávok nélkül), nem nyílik nyitott oldallal (a kerülete ≥ ¼-én nyílással /
  áthidalt réssel) a külső térre, és ha a raszter külső térnek vette, legfeljebb 15 m², döntően fal határolja és nincs
  benne megnevező felirat (erkély, terasz).
- Rajzpecsét és lapkeret: a feliratmező (≥ 3 jellegzetes mezőnév – tervező, építtető, rajzszám, méretarány, dátum,
  helyrajzi szám, engedélyezési… – egy csoportban, a táblázat vonalaival a lapszélig bővítve) és a lapkeret vonalai
  nem falak, nem helyiségek (`packages/terv/src/rajzpecset.ts`); a feliratok maradnak (méretarány, lapcím).
- Lapostetős szárny magastetős épületen: a homlokzatok tetősziluettjén (a nézet fő vonalhálózatának felső éle) a
  ≥ 2 m-es vízszintes plató, amely a csúcs alatt van és egyik végén sem lejt le a tető hajlásával; a homlokzatot a
  nyílások szerint illesztjük az alaprajzhoz, két szemközti homlokzaton egybe kell vágnia. Csak ha a metszet
  rétegrendjei közt lapostető is van (`packages/terv/src/tetoReszek.ts`). A sáv féltetős, ha a rá merőleges
  homlokzatokon a nyílászárók teteje fölött a fő hajlástól eltérő (3–16°-os) ferde vonalak a mélysége ≥ 30 %-án,
  ≥ 2 m-en futnak (a legszélesebb tartományt fedő hajlás); a magasabb végük felől lejt. Kézzel oldalanként állítható
  (szélesség, lapos / féltető, hajlás, lejtés).
- Mellvédmagasság: a feliratos ablaké az alaprajzi „pm”, de ha az illesztett homlokzaton a keret alja (a szintjelekből,
  a feliratos ablakok mediánjával kiigazítva) 25 cm – 1 m-rel eltér (egyszintes épületen), a homlokzaté (`nyilasok[].pmAlaprajz` az eredeti).
- Homlokzati eltérés (ellenőrzésre, a modell méretét nem módosítja): `nyilasok[].homlokzat` – a feliratos ablak /
  erkélyajtó helyén (egyszintes épületen, az illesztett homlokzaton – ≥ 3 és az irány nyílásainak ≥ 60 %-a egyező nyílással –) nincs keret
  (`null`), vagy az ott álló keretek egyike sem egyezik a felirattal (szélesség, nem takart keretnél magasság ± 20 cm):
  a legközelebbi keret mérete.
- Sarokzárás (teljes modell): ha mindkét fal a másik fal félvastagságánál jóval (> 0,75 × vastagság) túlnyúlik a
  metszésponton, keresztező falak – nem zárjuk sarokként.
- Ferde élek: a csatlakozások túlnyomó többsége derékszögű. A helyiség- és burok-körvonal tengelytől ≥ 3°-kal eltérő,
  ≥ 1 m-es éle csak akkor marad, ha a hossza ≥ 85 %-án 0,25 m-en belül fal kíséri (a ferde fal rajzolata);
  különben a maszkhoz jobban illő derékszögű sarokkal helyettesítjük (elforgatott – főirány ≥ 3° – épületen nem).
  A külső / ismeretlen túloldalú falszakasz illesztett egyenese csak akkor ferde, ha a pontjai valóban egy egyenesen vannak (szórás ≤ 12 cm);
  a szétszórt pontú, külső / ismeretlen túloldalú szakasz, amelynek pontjai a hossza 40 %-át sem kísérik
  folytonosan, nem fal (pillérek, szigetek határa).
- Beharapás a hőburkon: a burok derékszögű bemélyedése (oldalt vagy sarkon), amelynek a határoló élei mentén nincs
  fal / nyílás (≥ 50 %), kitöltve; 30 m² fölött csak zárt torkolattal; más (burokon kívüli) helyiséget tartalmazó
  bemélyedés valódi.
- ArchiCAD-zónák: az azonos nevű darabok összevonása láncolva sem köthet össze két, külön pecsétet tartalmazó zónát.
- Pecsét két előtag nélküli területsorral („12,82 m²” fölött „15,85 m²”): a nagyobb a teljes (A), a kisebb a hasznos;
  a jegyzék „Terület | Teljes terület” oszlopai ugyanígy. Csak burkolatnevű pecsét („greslap” + „parketta”) helyiség,
  nem külső burkolt felület.
- A alakú ház (2026-11-21, Balázs): ha a metszeten a tető a földszinti padlóig fut (mindkét oldalon a ±0,00 közelében
  végződik, és a tető alatt nincs ≥ 1,9 m-es, padlóra álló fal), a szint tetőtér (`metszetFeldolgoz().padloigTeto`);
  ha a tetőn belül szintmagas fal áll, szint marad. A térdfal az alaprajz körvonalán mért tetőmagasság (a rajz az
  1,9 m-es vonalig zár), a tér a belső gerincig nyitott; az alapterületbe az 1,9 m feletti rész számít.
- Garázs a berajzolt gépkocsiból (2026-11-21): az autó-réteg (`KÖRNYEZET - auto`, gépkocsi, car…) kocsi méretű
  csoportja pecsét nélküli, háromoldalt falazott térben helyiség (`helyisegek[].gepkocsi`); a nyitott oldal kapu
  (`garazskapu`). Ha van homlokzati rajz, de a kapu ott nem látszik: kültéri beálló. Garázsban a felirat nélküli,
  ≥ 1,8 m-es külső nyílás és a „pm 0”-s, ≥ 2,2 m-es nyílás is kapu.
- Faldarabok összefűzése (teljes modell, 2026-11-21): az egy vonalba eső, egymáshoz csatlakozó falszakaszok, amelyek
  anyaga, rétegei, vastagsága, magassága, szerkezete, hőburok-szerepe és oldalainak fajtája azonos, egy fal
  (`falak[].osszefuzott`: az eredeti azonosítók); a nyílások helye és a pillérek hivatkozása átszámítva.
- Fal és tető: a legfelső szint külső falai a tető alsó síkjáig érnek (magasabb tetőnél profillal felfelé, alacsonyabb
  tetőszélnél lefelé – legfeljebb a belmagasságig, `jelleg: 'parkany'`). Az eresz magassága és a kiállás a metszet /
  homlokzat szintjeleiből: az eresz (a homlokzaton is kiírt jel) és a gerinc az a pár, amely a hajlással és a tetőtest
  szélességével összefér (gerinc − eresz = (W/2 + kiállás) · tg α, 0,2–1,2 m-es kiállással).

## Fejlesztés, frissítés

- A mag (`packages/terv`) és a folyamat (`apps/web/src/terv/folyamat.ts`) ebben a repóban fejlődik; az ELBA a
  csomagot veszi át – frissítéskor újragenerálás és csere. A `dist/` nincs a repóban; előállítás:
  `git clone https://github.com/phnavitas/energetika && cd energetika && npm ci && (cd apps/web && npm ci) && npm run elba:csomag`,
  majd `dist/elba/elba-terv.mjs` → az ELBA `app/` mappájába (pl. `app/elba-terv.mjs`), a commit üzenetében az
  energetika commit-azonosítójával.
- Próba: `tools/ifc/osszevet.mts <modell.json> <minta.ifc>` – a PDF-modell és az IFC tételes összevetése.
- A minták (PDF, IFC) nem kerülnek repóba (személyes adat a tervpecséten).
