# Tömeg először – a ház a méretláncokból, a metszetből, a homlokzatból (2026-11-23)

Balázs: „Kellene valamilyen egész más megközelítésű algoritmus is emellé, mert nagyon sok hibával rakja össze mind a 3d
modellt (ami az elsődleges feladat), mind a hőburkot … A metszet és homlokzati rajzokra jobban kellene támaszkodni, és
utána visszavezetni az alaprajzra. Magában az alaprajz bizonytalan felismerésű." – „a javító eszközökre utána kell
koncentrálni, miután megvan a ház." Helyszínrajz és homlokzat szinte mindig van (be lehet kérni).

## Irány

1. **Lapszerep** – a tetőalaprajz / tetőfelülnézet és a helyszínrajz külön (nem alaprajz). ✔ (fájlnévből is)
2. **A ház tömege az alaprajz nélkül** – helyszínrajz (kontúr), tetőfelülnézet (gerinc, élgerinc, vápa, eresz), homlokzat
   (szintvonalak, eresz- és gerincmagasság, homlokzathossz, ablakok), metszet (szintmagasság, födém, hajlás, rétegrend).
3. **Ráillesztés az alaprajzra** – a külső kontúr a külső méretláncokon (pontosan méretezett síkok), nem a raszteres
   elárasztás alakja. ✔ első lépés: `racsKontur` (lent).
4. Az alaprajz csak a belső részletekért felel, a tömeg keretén belül.
5. Források közötti ellenőrzés (kontúr területe ↔ helyiségek; homlokzathossz ↔ alaprajzi él; ablakszám) → irányított kérdés.

## Elkészült

- `packages/terv/src/meretlanc.ts` – méretláncok: méterben (és cm-ben: „41”) írt feliratok, a méretvonal határjelei
  (ferde vonalka, merőleges segédvonal, vonalvég), a felirat jelpárja a lépték szerint igazolva.
- `packages/terv/src/racsKontur.ts` – a hőburok külső síkja a külső láncok jeleiből vetett rácson: cellánként a
  helyiségek (fűtött / ismeretlen belső ↔ fűtetlen / külső tér), a falsávba eső cellákon a raszteres kontúr; a láncok
  szélső jelein kívüli falcella kint (szomszéd tűzfala); a pecsétes helyiség cellája és a zárt belső lyuk bent.
- `folyamat.ts` `burokFelismertSik` / `racsBurok` – a felismert burok (2D, 3D, homlokzati falak) a rácskontúr, ha a
  területe a raszteresétől −20 / +15 %-on belül van; belső méret: a falsávok belső síkja (`burokMeres`).

## Következő

- tömegmodell a helyszínrajzból (épületfolt kiválasztása: a tervezett épület, méretben az alaprajzhoz illő) és a
  tetőfelülnézetből (tetősíkok gráfja → lapok, hajlás a metszetből) – mérés: tetőfelület a WinWatt-referenciákon;
- a homlokzatok szélessége és szintvonalai → a kontúr élhosszainak és a szintmagasságnak ellenőrzése.
