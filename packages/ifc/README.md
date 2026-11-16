# @ekm/ifc – modell ↔ IFC összevetés

A 2D tervből épített épületmodell (`packages/terv`, `EpuletModell`) összevetése ugyanazon projekt IFC-jével:
falak vastagság (és, ha az IFC jelöli, külső / belső) szerint – hossz, bruttó oldalfelület, térfogat –,
ablakok, ajtók (db, felület), helyiségek (összesen és szintenként). Ez a tervfelismerés mércéje a mennyiségi
kiíráshoz (ELBA), ahogy az energetikánál a WinWatt.

- Az IFC-olvasó az ELBA-é: `vendor/elba-bim-olvaso.cjs` (forrás: phnavitas/elba `app/elba-bim-olvaso.js`).
  Egy olvasó van – ha javítani kell, az ELBA-ban javítjuk, és ide átmásoljuk.
- Parancssor: `npx tsx tools/ifc/osszevet.mts modell_epulet.json projekt.ifc`
- Az IFC- és PDF-mintafájlok nem kerülnek a repóba.

A közös PDF-tervfelismerő mag itt fejlődik; ha kész, átkerül az ELBA-ba.

## Költözéskor az ELBA-ba (az ELBA besorolójának javítása)

Az ELBA `javasol` (elba-bim-epito.js) a proxy- és pillérelemeket csak név, fólia, anyag és IFC-típus szerint sorolja be –
a két mintán ez hibás (2026-11-16):
- Nyárfa (iTWO): a „VASBETON pillér 250/300” típusnevű koszorúk / áthidalók (29 db) → MON_FAL; a „VASBETON pillér 150”
  födémlemez → PILLER;
- Naszály (ArchiCAD): a pillérek körüli XPS-burkolat (13 db IFCCOLUMN) → PILLER; az eresz-dobozolás → MON_GERENDA.

Javítás: az `osszevetes.ts` alak- és anyagszabálya (pillér: függőleges, ≥ 1,5 m, ≤ 0,8 m, közel négyzetes, beton /
acél; gerenda / koszorú: vízszintes, 0,1–0,9 m magas – rétegrésznél a hossz térfogat / keresztmetszet; lemez; a
hőszigetelés-burkolat a pillér hőszigetelése; eresz, csatorna, járda, korlát nem tartószerkezet) a javaslat előtt.

A falmennyiségben (iTWO-proxy, Nyárfa) ugyanígy:
- a „szekcionált garázsajtó” (a fal fóliáján) nem fal – a nyílászáró-szűrő a név bármely részére nézzen (ajtó, ablak,
  kapu), ne csak az elejére; a fal fóliáján ülő pillér („VB FAL” fólia, „VASBETON pillér …” típus) nem fal;
- a vastagság a típusnév végi mm-értéke („FAL - POROTHERM 30 300” → 30 cm), ha a mért eltér: az összetevő-szélesség a
  nyílás melletti rövid daraboknál (4–23 cm-t ad a 30-as falra), a befoglaló doboz a nem tengelyirányú falnál téves.
