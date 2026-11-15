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
