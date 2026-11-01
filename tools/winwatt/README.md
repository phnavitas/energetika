# WinWatt-összevetés

Valós WinWatt-számítások („Energetikai számítás” PDF) számadatai és a mi számítómagunk lépcsőzetes összevetése.

## Új minta felvétele

```
python3 tools/winwatt/ww_parse.py <WinWatt-szamitas.pdf> tools/winwatt/minta/mNN_tipus.json
```

A JSON csak számadatokat, szerkezet- és rendszerleírásokat tartalmaz (név, cím, hrsz., fájlnév nélkül) –
mentés előtt ellenőrizd: `grep -i "kft\|utca\|hrsz\|@\|\.wwp" tools/winwatt/minta/*.json`.

## Szintek

| Szint | Mit vet össze | Futtatás |
|---|---|---|
| A | a zóna havi mérlege (σ, τ, η, QF,net, QH,net) a WinWatt saját H-, Qs-, Qb-értékeivel | `npx tsx tools/winwatt/szintA.ts` (WW_TE=1: WinWatt-hőmérséklettel) |
| B | szerkezettáblából számolt Htr, Qs, Hszell | `npx tsx tools/winwatt/szintB.ts` |
| C | gépészeti táblázati értékek (8.–9. fejezet) a rendszer-alapterület szerint | `npx tsx tools/winwatt/szintC.ts` |
| D | primerenergia/CO₂ a rendszerenkénti végenergiákból | `npx tsx tools/winwatt/szintD.ts` |

Regressziós teszt: `packages/mag/test/winwatt-osszevetes.test.ts` (A és D szint).

## Ismert eltérések (a WinWatt tér el a rendelettől vagy módszert választ)

- **Havi külső hőmérséklet:** a WinWatt augusztusban 20,9, szeptemberben 17,7 °C-kal számol; a 2. függ. 1.1. táblázat
  21,0 / 17,8 °C. Nálunk a rendeleti érték marad (éves hatás < 0,3 %).
- **Éjszakai szellőztetés hűtésnél (6.11):** a WinWatt egész évben és havonta változó béjjel-lel (6.9) számol; a rendelet
  egyszerűsített módszere május–szeptember, béjjel = 1,5. Nálunk az egyszerűsített módszer.
- **Társított árnyékoló hűtési módban:** a WinWatt hűtésnél is a 4.18 szerinti (redőnnyel javított) U-t használja;
  a rendelet (6.1.1, 4.3.3) a többlet-hőszigetelést a fűtési energiaigényhez engedi.
- **„> 500 m²” táblázatsor (pl. 9.9. HMV-tárolás):** a WinWatt 500 és 750 m² között interpolál, nálunk 500 m² felett
  a „> 500” sor állandó értéke.

## Talált és javított hibák

- Fan-coil ventilátor segédenergiája (8.17. táblázat) nem számított bele a fűtés segédenergiájába – javítva.
