/**
 * Seed SQL generálása a számítómag forrásolt táblázataiból: npm run seed
 * Kimenet: supabase/migrations/20261018000002_seed.sql
 */
import { writeFileSync } from 'node:fs';
import { PANEL_TIPUSOK, PANEL_UZEM_LAKOTELEPEK, KIEGESZITO_HOSZIGETELES_CM } from '../packages/mag/src/tablak/panel.js';
import { GEPESZETI_SZETTEK } from '../packages/mag/src/szettek.js';
import { ALAP_ANYAGOK } from '../packages/mag/src/alapkatalogus.js';

const q = (s: string | null | undefined) => (s === null || s === undefined ? 'null' : `'${s.replace(/'/g, "''")}'`);
const n = (x: number | null | undefined) => (x === null || x === undefined ? 'null' : String(x));
const sorok: string[] = [];
sorok.push('-- GENERÁLT FÁJL – tools/seed-generalas.ts. Kézzel ne szerkeszd.');
sorok.push('begin;');

// 1) Panelos tipológia – 2. függ. 4.6. táblázat (tömör, többsoros insertekkel)
const forrasPanel = '9/2023 ÉKM számítási módszer, 2. függelék 4.6. táblázat (kormany.hu, 2023.07.27.)';
const tipusSorok: string[] = [];
const uSorok: string[] = [];
for (const p of PANEL_TIPUSOK) {
  const kod = `panel_${p.id}`;
  const nev = `Panelház – ${p.uzem} házgyár, ${p.gyartasKezdete}–${p.gyartasVege ?? ''} (${p.hoszigeteles})`;
  const leiras = `Vasbeton szendvicspanel; rétegek (mm): teljes ${p.vastagsag.teljes}, külső kéreg ${p.vastagsag.kulsoKereg}, hőszigetelés ${p.vastagsag.hoszigeteles}, belső ${p.vastagsag.belso}. Példák (üzem): ${PANEL_UZEM_LAKOTELEPEK[p.uzem] ?? ''}`;
  tipusSorok.push(`(${q(kod)}, ${q(nev)}, ${p.gyartasKezdete}, ${n(p.gyartasVege)}, ${q(leiras)})`);
  KIEGESZITO_HOSZIGETELES_CM.forEach((cm, i) => uSorok.push(`(${q(kod)}, ${cm}, ${p.U[i]})`));
}
sorok.push(`insert into epulettipus (kod, csoport, nev, epitesi_ev_tol, epitesi_ev_ig, leiras, forras, forras_hivatkozas)\nselect kod, 'panel', nev, tol, ig, leiras, 'rendelet', ${q(forrasPanel)} from (values\n${tipusSorok.join(',\n')}\n) v(kod, nev, tol, ig, leiras);`);
sorok.push(`insert into epulettipus_szerkezet (epulettipus_id, szerep, u_ertek, u_tartalmaz_csatlakozasi_hohidat, kiegeszito_hoszigeteles_cm, forras, forras_hivatkozas)\nselect t.id, 'homlokzati_fal', v.u, false, v.cm, 'rendelet', ${q(forrasPanel)} from (values\n${uSorok.join(',')}\n) v(kod, cm, u) join epulettipus t on t.kod = v.kod;`);

// 2) Anyagok – a számítómag alapkatalógusából (ugyanezt használja a felület offline).
for (const a of ALAP_ANYAGOK) {
  sorok.push(`insert into anyag (kod, nev, kategoria, sraffozas, lambda, mu, R_termek, d_termek, forras, forras_hivatkozas, ellenorzott, megjegyzes) values (${q(a.id)}, ${q(a.nev)}, ${q(a.kategoria)}, ${q(a.sraffozas)}, ${n(a.lambda)}, ${n(a.mu)}, ${n(a.R?.R)}, ${n(a.R?.d)}, 'tanusitoi_ertek', ${q(a.forras)}, ${a.ellenorzott}, ${q(a.megjegyzes)});`);
}

// 3) Gépészeti szettek – a számítómag szettek.ts moduljából (1. függ. 8–9. fejezet táblázatai)
for (const s of GEPESZETI_SZETTEK) {
  sorok.push(`insert into gepeszeti_szett (kod, nev, leiras, futes, hmv, jellemzo_epuletek, forras, forras_hivatkozas) values (${q(s.kod)}, ${q(s.nev)}, ${q(s.leiras)}, ${q(JSON.stringify(s.futes))}::jsonb, ${q(JSON.stringify(s.hmv))}::jsonb, ${s.jellemzoEpuletek.length ? `array[${s.jellemzoEpuletek.map(q).join(',')}]` : 'null'}, 'rendelet', ${q(s.forras)});`);
}

sorok.push('commit;');
writeFileSync(new URL('../supabase/migrations/20261018000002_seed.sql', import.meta.url), sorok.join('\n') + '\n');
console.log(`${sorok.length - 3} sor generálva.`);
