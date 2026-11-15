# @ekm/ifc – IFC-olvasó

IFC → épületelemek (szintek, falak, födémek, tetők, pillérek, gerendák, lépcsők, korlátok, nyílászárók, terek,
burkolatok, alapok) a mennyiségeikkel, a mennyiségi kiíráshoz (Elba) és a 2D tervből épített modell ellenőrzéséhez.

- `ifcBeolvas(api, adat)` – a web-ifc `IfcAPI` (inicializálva) és a fájl bájtjai → `IfcModell`
  (elemenként: IFC mennyiség-készletek, tulajdonságok, rétegrend, szint, gazdaelem, geometriából térfogat / felület / befoglaló doboz).
- `elemMennyiseg(md, e)` – egységes mennyiségek (hossz, vastagság, magasság, felület, térfogat) és a forrásuk
  (`ifc`: a fájl mennyiség-készlete, `geom`: a geometriából számolt).
- `kiiras(md)` – összesítés kategória × típus × rétegrend szerint.

A web-ifc az `apps/web` függősége (node-ban: `web-ifc-api-node.js`, böngészőben: `web-ifc-api.js` + a `.wasm`).
Mintafájlok (nem a repóban): ArchiCAD (FZK-Haus), Revit (Duplex), buildingSMART Simple-Scene.
