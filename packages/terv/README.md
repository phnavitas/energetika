# @terv – tervfelismerés

PDF-tervlapok (alaprajz, metszet, homlokzat) gépi felismerése, alkalmazásfüggetlenül: lapok kinyerése (pdf.js), raszter,
falak, helyiségek (pecsét, jegyzék), nyílászárók, északjel, szintek, metszeti rétegrendek, homlokzati magasságok,
hőburok-körvonal. Felületet és energetikai számítást nem tartalmaz; az alkalmazás (`apps/web`, Navitherm) a
`@terv/...` útvonalon használja (vite alias + tsconfig paths).

- `src/` – a modulok (belépési pont: `elemzes.ts` – `pdfLapok`, `alaprajzFeldolgoz`, `metszetFeldolgoz`)
- `test/` – egységtesztek (`npx vitest run packages/terv`)
- ellenőrzés: `npx tsc -p packages/terv`
