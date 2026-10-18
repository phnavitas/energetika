# ÉKM energetikai számító és tanúsító

Épületenergetikai számítás, követelményellenőrzés és tanúsítás a **9/2023. (V. 25.) ÉKM rendelet** és a
**176/2008. (VI. 30.) Korm. rendelet** szerint. Cél: WinWatt-alternatíva, varázslós webes felülettel.

## Felépítés

| Mappa | Tartalom |
|---|---|
| `packages/mag` | Számítómag (TypeScript, tiszta függvények). Hivatalos táblázatok a `src/tablak` alatt, forráshivatkozással. |
| `packages/export` | e-tanúsítás feltöltési XML (UploadRequest) generátor. |
| `supabase/migrations` | Séma (katalógusok + helyiség alapú projektmodell, RLS) és generált seed. |
| `tools` | Seed-generálás, WinWatt-összevetés, adatbázis-teszt. |

```
npm test               # validációs és egységtesztek
npm run osszevetes     # összevetés a tarjáni WinWatt-jegyzőkönyvvel
npm run seed           # seed SQL újragenerálása a mag táblázataiból
npm run typecheck
```

## Forrásanyagok (a repón kívül, `forras/`)

- 9/2023 ÉKM rendelet 1. függelék (számítási módszer), 2. függelék (táblázatok), Meteo – kormany.hu, 2023.07.27.
- Rendelet 2., 3., 8. melléklet (njt.hu PDF)
- Tarjáni WinWatt 9.54 e-tanúsítás export (XML) a beágyazott számítási jegyzőkönyvvel – **validációs alap, személyes adatot tartalmaz, nem kerül a repóba.**

## Validáció – Tarján, kétlakásos lakóépület (WinWatt 9.54)

| | Számítómag | WinWatt |
|---|---|---|
| qF,net | 40,07 kWh/m²a | 40,07 |
| q (fajlagos hőveszteség-tényező) | 0,136 W/m³K | 0,136 |
| Enren,fajl | 51,04 kWh/m²a | 51,04 |
| ECO2,fajl | 11,61 kg/m²a | 11,61 |
| Referencia fűtés / HMV Enren | 5562,8 / 4732,5 kWh/a | 5563,2 / 4731,2 |
| Besorolás | A+ (67,2%) | A+ (67,2%) |

A jegyzőkönyv négy ablaknál nem közli a tájolást, ezért a havi direkt szoláris nyereséget a jegyzőkönyvből vesszük át.
A saját szoláris számítás feltételezett tájolásokkal 37,6 kWh/m²a-t ad. **Teljes, szoláris résszel együtti validációhoz
olyan tesztépület kell, amelynek minden nyílászárójáról ismert a tájolás** (vagy a .wwp projektfájl).

## Forráshiányok és értelmezések (kódban jelölve, figyelmeztetést adnak)

1. **Üres cellák a hivatalos táblázatokban** – 8.2. (fűtött téren belüli kondenzációs/alacsony hőm. kazán csak 100 m²-nél),
   8.15., 9.4. (kombikazán 500 m² felett), 9.11. (cirkuláció nélküli elosztás csak 100 m²-nél). Szabály: a meglévő pontok
   között interpolálunk, az utolsó meglévő ponton túl az értéket tartjuk. A WinWatt a 9.11-nél ugyanígy járt el.
2. **2. melléklet 1.2.** – a 2. sorban „0,3 ≤ A/V ≤ 1,0” áll; a 3. sor 1,3-tól folytatódik és 0,071 + 0,23·1,3 = 0,37,
   így a helyes tartomány 1,3-ig (szerkesztési hiba a forrásban).
3. **Referencia rendszer** – az 5. melléklet 2.1.5 szerint a vezetékek nyomvonala a tárgyi épületé. A WinWatt a tarjáni
   épületnél mégis „fűtött téren kívül”-t vett fel. A mag a rendelet szerint számol, felülbírálható.
4. **Ajtó minősítése** – a 176/2008 4. melléklete nem ad sort ajtóra; a WinWatt az 1,4 W/m²K-es ajtót „Good”-nak írta.
   Ideiglenesen a követelményhez mérünk.
5. **Passzív megújuló** – a módszer nem ad számszerű definíciót. Mi: Σ ηF·Qsd a fűtési hónapokban (26,73);
   WinWatt: 32,35. Csak tájékoztató sor az XML-ben.
6. **Nyári hővédelem** – a rendelet képlete csak képként érhető el; a 0,3-as határértéket a WinWatt-jegyzőkönyvből vettük.
   Mutató: 0,047 (WinWatt: 0,044). Ellenőrizendő a rendelet eredeti szövegéből.

## e-tanúsítás XML

A Lechner XSD-je nincs meg. A generátor szerkezete egy elfogadott WinWatt-export elemsorrendjét követi (tesztelve).
A mintában nem látott kódoknál (pl. földgáz, közepes minősítés, nem lakó kategóriák) **hibát dob**. Teendő:
fejlesztői kapcsolatfelvétel a Lechner Tudásközponttal az XSD-ért és a tesztrendszer-hozzáférésért.

## Adatbázis (Supabase)

Projekt: **Energetikai méretező** (`ahzhcmpkxtsbsakgjuhc`, eu-central-1). Élő felület: https://energetika.balazs-ambrus.workers.dev

- **Iroda**: `szervezet`, `szervezet_tag` (tulajdonos / admin / tag), `szervezet_meghivo` (e-mail alapján;
  a meghívó csak megerősített e-mail címmel fogadható el). RPC: `szervezet_letrehoz`, `meghivok_elfogadasa`, `tag_eltavolit`.
- **Projekt**: a felület dokumentuma `jsonb`-ben (`projekt.dokumentum`), listázó oszlopokkal és `osszesito`-vel.
  Egyidejű szerkesztés ellen `verzio` (triggerrel nő), a kliens feltételesen ment (`where verzio = várt`);
  ütközéskor a felület megkérdezi, melyik változat maradjon.
- **Számítás**: `szamitas` – bemenet + eredmény pillanatkép módszer- és magverzióval, XML-készítéskor rögzül;
  nem módosítható, nem törölhető.
- **Irodai könyvtár**: `anyag` (forrás kötelező), `retegrend`, `nyilaszaro_tipus` (a felület modellje `jsonb`-ben).
  A projekt a benne használt irodai anyagok másolatát is tárolja (`Projekt.anyagok`), így egy későbbi módosítás
  nem írja át utólag a régi számítást.
- **Tipológia**: `epulettipus` + `epulettipus_szerkezet` – 33 panelos típus a 2. függ. 4.6. táblázatból.
- Minden táblán RLS; tesztje: `su postgres -c "bash tools/db-teszt.sh"` (25 eset: irodák elszigetelése, szerepkörök,
  meghívó, verzióütközés, könyvtár, bejelentkezés nélküli hozzáférés).
- Telepítés új projektre: a `supabase/migrations` fájljai sorban (SQL Editor vagy `supabase db push`).

## Webes felület (`apps/web`)

- `npm run dev` – fejlesztői szerver (`.env.development` a Supabase projekthez köt).
- Supabase nélkül (`VITE_SUPABASE_URL` üres) helyi módban fut: a projekt a böngészőben és fájlban tárolódik.
- `EGYFAJL=1 npx vite build --outDir dist-egy` – egyfájlos, helyi módú előnézet.
- `HAMIS=1 npx vite build --outDir dist-hamis` – memóriabeli adatréteggel (`src/tarolo-hamis.ts`); erre fut a
  `tools/feluletteszt.mjs` végponttól végpontig próba (belépés, iroda, automatikus mentés, ütközés, könyvtár, meghívó).

### Cloudflare Worker (statikus eszközök)

- `wrangler.jsonc` a repó gyökerében; a `name` egyezzen a Cloudflare-ben létrehozott Worker nevével.
- Workers Builds: **Deploy command** `npx wrangler deploy` (a build a `wrangler.jsonc` `build.command` mezőjéből fut).
- A `.env.production` tartalmazza a publishable kulcsot (nyilvános, a hozzáférést az RLS védi).

### Supabase Auth beállítás (egyszer)

- Authentication → URL Configuration → **Site URL**: a Worker címe (`https://energetika.balazs-ambrus.workers.dev`);
  **Redirect URLs**: ugyanez, és fejlesztéshez `http://localhost:5173`.
- Authentication → Providers → Email: „Confirm email” maradjon bekapcsolva (a meghívók elfogadásának feltétele).
