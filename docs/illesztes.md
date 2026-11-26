# Rajzok illesztése közös koordinátarendszerbe (2026-11-24)

Balázs: „az alaprajzot és a helyszínrajzot kell kiindulásnak összevetni. értelmezésben a homlokzatok, majd metszetek
segítenek összerakni. A rajzokon szereplő egyedi hibákat nem javítjuk, mert ilyen mindig lesz, az általános
módszereken kell” – „a többi rajzot is illeszteni kell, utána értelmezhető”.

Sorrend: minden lap transzformációja a modellbe (biztonsági számmal), az értelmezés (tömeg, tető, burok) csak utána,
az illesztett rajzokon. Az el nem fogadott illesztés kérdés lesz, nem találgatás.

| Lap | Illesztés | Mivel |
|---|---|---|
| alaprajzok egymáshoz | eltolás | külső kontúr, tengelyek, lépcső |
| helyszínrajz ↔ alaprajz | forgatás + eltolás | `illesztes.ts` `helyszinIllesztes` ✔ |
| homlokzat ↔ alaprajz | égtáj, vízszintes eltolás, magasság | a nézet sziluettjének élei ↔ a kontúr vetülete; ±0,00 szintjel |
| metszet ↔ alaprajz | metszésvonal helye, iránya, magasság | az alaprajzi metszésvonal-jel, tengelyek; szintjelek |

## Helyszínrajz ↔ alaprajz (`helyszinIllesztes`)

Az alaprajz külső kontúrja (m) mintaként a helyszínrajz vonalai között: irány szerinti távolságtérképek (az él csak a
vele párhuzamos vonalon ül – a sűrű, más irányú rajzolat nem illeszkedés) és a derékszögű sarkok távolságtérképe
(a sraffozás, a fák nem adnak sarkot); a pontszám az élpontok és a sarkok levágott távolságának súlyozott átlaga.
Forgatás: a helyszínrajz főirányai − a kontúr főiránya, + k·90°; eltolás: a teljes lapon 1 m-es lépéssel, a legjobb
12 (≥ 5 m-re egymástól) finomítva (0,25 → 0,05 m, ± 2°); a kontúr kifelé tolva 0 / 0,5 / 1 m (eresz).

Mérés (a 12 helyszínrajzos mintán, 2026-11-24): 10 helyes elhelyezés (Balatonlelle, Biogáz, Hatvan, Kecsked, Komló –
45°-ban elforgatva –, Malom és Kacsa, PeterLacke, Szárliget, 40 lakásos, Tata-Fazekas), Dad a kifolyt kontúrral
részben, Tb-barlang bizonytalan (találat 63 %).

## Homlokzat ↔ alaprajz – próbák (2026-11-24)

- `homlokzatNezetek`: terepvonal (≥ 6 m, darabokban is) fölött a földig érő ≥ 2 m-es függőlegesek → a falak
  vízszintes kiterjedése. Egyszerű háznál jó (Szárliget: mind a 4 nézet 0,3–1 % szélességeltéréssel, Hatvan, 40 lakásos),
  összetett / burkolatmintás homlokzatnál sok hamis jelölt.
- `homlokzatLapIllesztes`: a várt rajzolat (látható sarkok, a néző felé néző nyílások szélei) irány szerinti
  távolságtérképen, a teljes lapon; a sűrű mintázat (kőburkolat, cserépsor) miatt a pontos és az elcsúsztatott helyzet
  találati arányának különbsége (kontraszt) a pontszám. Így sem elég megkülönböztető (Komló: a burkolat mindenhol talál).
- Következtetés: a nézet irányát a homlokzati felirat (É, D, K, Ny, ÉK …) adja – szabványos, minden terven ott van –,
  a nézési irány szerinti szélesség és a földi sarkok a vízszintes helyet, a ±0,00 jel a magasságot; a nyílásminta csak
  ellenőrzés. A felirat nélküli nézet: a szélesség szerinti két irány közül a sarokminta dönt, különben kérdés.

## Metszet ↔ alaprajz – első lépés (2026-11-24)

- `metszesVonalak`: a metszetlapok címeinek betűjelei (A-A, B-B …) az alaprajzon; a betű két legtávolabbi előfordulása
  a metszésvonal két vége. 6 mintán a vonalak megvannak (Biogáz, Dad, Kecsked, Komló, PeterLacke, Tb-barlang).
- `metszesKontur`: a vonal és a kontúr metszéspontjai → a metszetben látszó épületszélesség és a falsíkok helye.
- A metszeti nézet: a terepvonalat keresztező ≥ 2 m-es függőlegesek (falmetszet az alapozásig) – `homlokzatNezetek(…, true)`;
  a betű címéhez legközelebbi, a húrral (± 8 %) egyező szélességű nézet. Ismeretlen léptékű metszetlapnál az 1:50 /
  1:100 / 1:200 közül az, amelyiknél van egyező nézet (Komló A-A: 1:50).
- Állás: 15 metszésvonalból 8-hoz van illeszkedő nézet.

## Rajzra írt horgonyok (2026-11-24, Balázs: „nézzük tovább így”)

A rajzokat a tervező saját jelei kötik össze; a felismert kontúr csak ellenőrzés. Sorrend:

1. **Tengelyjelek** (körben betű / szám, a tengelyvonallal): a nagyobb terveken minden lapon ott vannak, ugyanazzal a
   jelöléssel – PeterLacke (alaprajz, metszet, homlokzat), 40 lakásos (alaprajzok, AA / BB metszet, mind a 4 homlokzat),
   Biogáz (alaprajz, tetőfelülnézet, metszet, homlokzat, helyszínrajz). Két azonos jelű tengely helye a két lapon egyértelműen
   adja az eltolást és a tükrözést, a jelek sorrendje az irányt – északjel és homlokzati felirat nélkül is.
2. **Méretláncok**: azonos teljes hossz (± 3 cm) és a belső jelek egyezése (egyenes / fordított irányban, összevont
   tagokkal is) – `lancEgyezes`. Ahol a lap láncot hordoz, az egyezés éles (Biogáz metszet–alaprajz 7/7, Dad metszet
   7/7, Kecsked homlokzatok – az alaprajz oldallánca megmondja, melyik homlokzat). A kisebb házak homlokzatán gyakran
   nincs vízszintes lánc.
3. **Geometria** (kontúr / szélesség / sarkok) – ahol se tengely, se lánc nincs (Komló, Malom és Kacsa homlokzatai).

### Tengelyjeles illesztés – eredmény (2026-11-24)

`tengelyjelek` (kör + felirat; az irány a jel párjából, ill. a család – számok / betűk – elrendezéséből, mert a
tengelyvonal pontvonal) és `tengelyIllesztes` (közös jelekből s = ±1 tükrözés és o eltolás, ± 0,1 m):
- 40 lakásos: mind a 3 további alaprajz (13/14, 7/8), AA metszet 7/7, BB metszet 16/16, mind a 4 homlokzat (7/7, 7/7,
  16/16, 16/16) – a tükrözés előjele megadja, melyik oldalról nézünk (ÉK ↔ DNy, DK ↔ ÉNy ellentétes előjelű).
- Biogáz: tetőfelülnézet 9/9 + 9/9, metszet 9/9, helyszínrajz 9/9 + 5/5 (90°-kal elforgatva), homlokzat részben
  (egy lapon 4 nézet – nézetenként kell bontani).
- PeterLacke: az alaprajz el van forgatva a lapon (≈ 71°) – a ferde tengelyekhez a jelek irányát kell kezelni.

### Összesítés a 12 helyszínrajzos mintán (2026-11-24, `tools/illesztes/lapok.mts`)

Lapok (a mintánként legtöbb tengelyjelű alaprajzhoz): tengely 17, méretlánc 11, geometria 22, nincs 26.
Tengelyes terv (Biogáz, PeterLacke, 40 lakásos): minden lap illeszkedik. A hiányzók: Malom és Kacsa 12 lapja (se
tengely, se homlokzati lánc, a szintek egymáshoz sincsenek illesztve), metszetek léptékfelirat / betűjel nélkül
(Balatonlelle, Tata-Fazekas), Tb-barlang (lejtős telek: a mintakontúr a garázsszint).

### Maradék illesztése (2026-11-24 este)

- Metszetjelek a címből általánosan („c - c metszet”, „A/1-A/1 Keresztmetszet”) – `metszetJelek`.
- Falsík-minta (`falsikIllesztes`): ahol a metszeten nincs vízszintes lánc, a metszésvonal menti alaprajzi falsíkok a
  metszet függőlegesein (≥ 70 %, egyenes / tükrözött irányban; ismeretlen léptéknél 1:50 / 1:100).
- Összesen (12 minta, 78 lap): tengely 17, lánc 11, geometria 37, nincs 13 (előtte 50 / 76 illesztve, most 65 / 78).
  Illesztetlen: Malom és Kacsa 5 lapja, Tb-barlang 3, Dad 2, Kecsked A-A, Komló C-C, Szárliget betűjel nélküli
  metszetlapja.

### Negatív kontroll (2026-11-24 késő este) – mi bizonyít és mi nem

Minden módszert lefuttattam a lap SAJÁT mintájának és a többi 11 minta (IDEGEN) alaprajzi adataival
(`/tmp`-s próba, a módszer: ugyanaz a lap, más épület kontúrja / láncai / tengelyei). Ami idegennel is illeszkedik,
az nem bizonyíték.

| módszer | saját | idegen |
|---|---|---|
| tengelyjelek | 16 / 76 | 10 / 836 (≈ 1 %) |
| méretlánc | 14 / 76 | 9 / 836 (≈ 1 %) |
| helyszín-kontúr, találat ≥ 0,8 | 10 / 12 | 23 / 132 (17 %) |
| helyszín-kontúr, ≥ 0,95 | 8 / 12 | 0 / 132 |
| homlokzat: felirat + szélesség | 16 / 24 | 79 / 264 (30 %) |
| homlokzat: + látható sarkok ≥ 95 % | 7 / 24 | 1 / 264 |
| metszet: szélesség a metszésvonal mentén (± 8 %) | 17 / 29 | 151 / 319 (47 %) |
| metszet: falsík-minta | – | idegen is 1,0 – nem különböztet |

Következmény: a geometriai küszöbök szigorítva, a metszetek geometriai illesztése kikapcsolva. Az ellenőrzött
eredmény a 12 mintán (78 lap): tengely 17, lánc 11, geometria 11 → **39 / 78** (a korábbi 65 / 78-ból 26 nem volt
bizonyított). Tengelyjeles terveken (Biogáz, PeterLacke, 40 lakásos) továbbra is minden lap illeszkedik.

### Szintjelek – a metszetek és homlokzatok függőleges illesztése (2026-11-25)

Az előjeles szintfeliratok (±0,00, +2,70, −0,45) egy nézeten belül egy egyenesre esnek: z + y · mPt = állandó. Ahol
≥ 3 különböző szint ugyanarra az állandóra esik (3 cm), az egy függőlegesen illesztett nézet (z = a − y · mPt) –
`szintjelek`, `szintNezetek`, `szintKozos` (illesztes.ts). Az épülethez kötés a közös szintekkel (a ±0,00 körüli,
10 cm alatti értékek nem számítanak). Negatív kontroll (53 metszet / homlokzat, saját / idegen):

| feltétel | saját | idegen |
|---|---|---|
| ≥ 2 közös szint az alaprajzok szintfeliratival | 13 / 53 | 4 / 583 (0,7 %) |
| ≥ 8 közös szint a projekt többi lapjával | 32 / 53 | 0 / 583 (idegen legfeljebb 7) |

Az alkalmazásban: ≥ 2 közös az alaprajzzal, vagy ≥ 8 a már illesztett lapokkal (láncolva, legfeljebb 3 kör).
Eredmény a 12 mintán (78 lap): tengely 17, lánc 11, geometria 11, **szint 18** → **57 / 78**. A szint csak a
MAGASSÁGOT illeszti (a vízszintes helyet nem) – a jelvény „szintjelek (magasság)”.
Nem illeszkedik még: Komló metszetei (nincs szövegként szintfelirat), Tb-barlang (2 metszet, 2 homlokzat, helyszín),
tata metszetek (3), Balatonlelle (2 metszet, 1 homlokzat), Szárliget metszet + K–Ny homlokzat, Hatvan homlokzat,
3 helyszínrajz, Malom É-i homlokzat.

(2026-11-26) A „≥ 8 közös szint” a projekt ÖSSZES többi metszetével / homlokzatával számít (a negatív kontroll is ezt
mérte), nem csak a már illesztettekkel: így a tengelyjel és méretlánc nélküli lapcsoport is illeszkedik
(Tata-Fazekas 3 metszete, Tb-barlang 1 lap). Eredmény a 12 mintán: tengely 17, lánc 11, geometria 11, szint 22 →
**61 / 78**.
