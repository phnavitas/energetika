#!/usr/bin/env bash
# Migrációk tesztje helyi PostgreSQL-en, Supabase-szerű auth csonkkal és RLS ellenőrzéssel.
# Futtatás postgres felhasználóként: su postgres -c "bash tools/db-teszt.sh"
set -euo pipefail
DB=ekm_teszt
cd "$(dirname "$0")/.."
P="psql -v ON_ERROR_STOP=1 -q -U postgres"
$P -c "drop database if exists $DB" -c "create database $DB"
$P -c "do \$\$ begin create role authenticated nologin; exception when duplicate_object then null; end \$\$" \
   -c "do \$\$ begin create role anon nologin; exception when duplicate_object then null; end \$\$"
$P -d $DB <<'SQL'
create schema auth;
create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable security definer as $$
  select jsonb_build_object('sub', auth.uid(), 'email', (select email from auth.users where id = auth.uid())) $$;
grant usage on schema auth to authenticated, anon;
insert into auth.users values
  ('11111111-1111-1111-1111-111111111111', 'anna@iroda-a.hu', now()),
  ('22222222-2222-2222-2222-222222222222', 'bela@iroda-b.hu', now()),
  ('33333333-3333-3333-3333-333333333333', 'cecil@iroda-a.hu', now()),
  ('44444444-4444-4444-4444-444444444444', 'dora@iroda-a.hu', null);
SQL
for f in supabase/migrations/*.sql; do
  echo "→ $f"; $P -d $DB -f "$f"
done
$P -d $DB -c "grant usage on schema public to authenticated, anon; grant select, insert, update, delete on all tables in schema public to authenticated;"

ok=0; hiba=0
ellenoriz() { # név, elvárt, felhasználó, SQL
  local nev="$1" vart="$2" uid="$3" sql="$4" kapott
  local ki
  ki=$(psql -q -U postgres -d $DB -At -v ON_ERROR_STOP=1 2>&1 <<SQL
set role authenticated;
set request.jwt.claim.sub = '$uid';
$sql
SQL
) || true
  if grep -q '^ERROR' <<<"$ki"; then kapott=ERROR; else kapott=$(tail -1 <<<"$ki"); fi
  if [[ "$kapott" == "$vart" ]]; then ok=$((ok+1)); echo "  ✓ $nev"; else hiba=$((hiba+1)); echo "  ✗ $nev – várt: $vart, kapott: $kapott"; fi
}
A=11111111-1111-1111-1111-111111111111; B=22222222-2222-2222-2222-222222222222; C=33333333-3333-3333-3333-333333333333; D=44444444-4444-4444-4444-444444444444

echo "--- Seed"
psql -q -U postgres -d $DB -At <<'SQL'
select 'tipológia sorok: ' || count(*) from epulettipus;
select 'panel U-értékek: ' || count(*) from epulettipus_szerkezet;
select 'anyagok: ' || count(*) from anyag;
select 'gépészeti szettek: ' || count(*) from gepeszeti_szett;
SQL

echo "--- Iroda, meghívó"
ellenoriz "Anna irodát hoz létre" "1" $A "select szervezet_letrehoz('Iroda A'); select count(*) from szervezet_tag;"
ellenoriz "Béla irodát hoz létre, csak a sajátját látja" "1" $B "select szervezet_letrehoz('Iroda B'); select count(*) from szervezet;"
ellenoriz "Anna meghívja Cecilt és Dórát" "2" $A "insert into szervezet_meghivo (szervezet_id, email) select id, e from szervezet, unnest(array['cecil@iroda-a.hu','dora@iroda-a.hu']) e; select count(*) from szervezet_meghivo;"
IA=$(psql -q -U postgres -d $DB -At -c "select id from szervezet where nev = 'Iroda A'")
ellenoriz "Béla nem hívhat meg Anna irodájába" "ERROR" $B "insert into szervezet_meghivo (szervezet_id, email) values ('$IA', 'x@y.hu');"
ellenoriz "Cecil elfogadja (megerősített cím)" "1" $C "select meghivok_elfogadasa();"
ellenoriz "Dóra nem fogadhat el megerősítetlen címmel" "0" $D "select meghivok_elfogadasa();"
ellenoriz "Cecil (tag) nem hívhat meg" "ERROR" $C "insert into szervezet_meghivo (szervezet_id, email) select id, 'z@z.hu' from szervezet;"
ellenoriz "Cecil nem léptetheti elő magát" "0" $C "with u as (update szervezet_tag set szerep = 'admin' where felhasznalo_id = '$C' returning 1) select count(*) from u;"
ellenoriz "Anna utolsó tulajdonosként nem léphet ki" "ERROR" $A "select tag_eltavolit((select id from szervezet), '$A');"

echo "--- Projektek"
ellenoriz "Anna projektet ment" "1" $A "insert into projekt (szervezet_id, nev, dokumentum) select id, 'Tarján', '{\"verzio\":1}' from szervezet; select verzio from projekt;"
ellenoriz "Cecil látja az iroda projektjét" "1" $C "select count(*) from projekt;"
ellenoriz "Béla nem látja" "0" $B "select count(*) from projekt;"
ellenoriz "Béla nem írhat Anna irodájába" "ERROR" $B "insert into projekt (szervezet_id, nev, dokumentum) values ('$IA', 'x', '{}');"
ellenoriz "Mentés a várt verzióra: verzió 2" "2" $C "update projekt set nev = 'Tarján 2' where verzio = 1; select verzio from projekt;"
ellenoriz "Elavult verzióra mentés: 0 sor" "0" $A "with u as (update projekt set nev = 'ütköző' where verzio = 1 returning 1) select count(*) from u;"
ellenoriz "Módosító rögzítve" "$C" $A "select modositotta from projekt;"
ellenoriz "Számítás rögzítése" "1" $A "insert into szamitas (projekt_id, projekt_verzio, modszer_verzio, mag_verzio, bemenet, eredmeny) select id, verzio, 'EKM-2023.07.27', '0.2', '{}', '{}' from projekt; select count(*) from szamitas;"
ellenoriz "Rögzített számítás nem törölhető" "0" $A "with u as (delete from szamitas returning 1) select count(*) from u;"

echo "--- Könyvtár"
ellenoriz "Anna saját anyagot visz fel" "1" $A "insert into anyag (szervezet_id, nev, kategoria, lambda, forras, forras_hivatkozas) select id, 'Saját EPS', 'Hőszigetelés', 0.031, 'termekadat', 'TNY 2024' from szervezet; select count(*) from anyag where szervezet_id is not null;"
ellenoriz "Béla nem látja Anna anyagát" "13" $B "select count(*) from anyag;"
ellenoriz "Béla nem módosíthat globális anyagot" "0" $B "with u as (update anyag set lambda = 9 returning 1) select count(*) from u;"
ellenoriz "Béla nem vihet fel globális anyagot" "ERROR" $B "insert into anyag (nev, kategoria, lambda, forras, forras_hivatkozas) values ('x', 'y', 1, 'felhasznaloi', '');"
ellenoriz "Anna rétegrendet ment a könyvtárba" "1" $A "insert into retegrend (szervezet_id, nev, szerep, kovetelmeny_kod, adat) select id, 'Fal', 'fal', 'homlokzati_fal', '{}' from szervezet; select count(*) from retegrend;"
ellenoriz "Béla nem látja Anna rétegrendjét" "0" $B "select count(*) from retegrend;"
ellenoriz "Bejelentkezés nélkül a projekt nem olvasható" "ERROR" $A "reset role; set role anon; select count(*) from projekt;"

echo "--- Eredmény: $ok rendben, $hiba hibás"
[[ $hiba -eq 0 ]]
