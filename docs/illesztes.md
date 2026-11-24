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
