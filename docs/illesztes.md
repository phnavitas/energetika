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
