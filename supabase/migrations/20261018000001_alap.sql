-- =============================================================================================
-- ÉKM energetikai számító és tanúsító – alapséma
-- 9/2023. (V. 25.) ÉKM rendelet, 176/2008. (VI. 30.) Korm. rendelet
--
-- Elv: a hivatalos számítási táblázatok (1–2. függelék) a számítómagban élnek, verziózva a
-- számítási módszer közzétételéhez. Az adatbázisban a szerkeszthető katalógusok és a projektek vannak.
-- Minden katalógussor forrással: honnan származik az érték, és ellenőrizte-e valaki.
-- =============================================================================================


-- ---------------------------------------------------------------------------------------------
-- Közös típusok

create type forras_tipus as enum (
  'rendelet',          -- jogszabály vagy annak függeléke (pl. 2. függ. 4.6. táblázat)
  'szabvany',          -- MSZ / MSZ EN szabvány
  'termekadat',        -- gyártói teljesítménynyilatkozat, ErP adatlap
  'szakirodalom',      -- tipológia, tankönyv, kutatás
  'tanusitoi_ertek',   -- más programból / tanúsítói gyakorlatból átvett érték (pl. WinWatt jegyzőkönyv)
  'felhasznaloi'       -- a felhasználó saját felvitele
);

create type hoaram_irany as enum ('felfele', 'vizszintes', 'lefele');
create type kulso_oldal as enum ('kulso', 'futetlen', 'belso', 'talaj');
create type kovetelmeny_szint as enum ('kozel_nulla', 'jelentos_felujitas', 'meglevo');


-- ---------------------------------------------------------------------------------------------
-- Felhasználói kör: szervezet (iroda), tagság, meghívó. A katalógusok lehetnek globálisak
-- (szervezet = null, csak seed/migráció írja) vagy egy irodáé.

create table szervezet (
  id uuid primary key default gen_random_uuid(),
  nev text not null check (length(trim(nev)) > 0),
  letrehozva timestamptz not null default now()
);

create table szervezet_tag (
  szervezet_id uuid not null references szervezet(id) on delete cascade,
  felhasznalo_id uuid not null references auth.users(id) on delete cascade,
  szerep text not null default 'tag' check (szerep in ('tulajdonos', 'admin', 'tag')),
  email text,                                 -- megjelenítéshez (a csatlakozáskor rögzítve)
  csatlakozott timestamptz not null default now(),
  primary key (szervezet_id, felhasznalo_id)
);
create index on szervezet_tag (felhasznalo_id);

create table szervezet_meghivo (
  szervezet_id uuid not null references szervezet(id) on delete cascade,
  email text not null check (email = lower(trim(email)) and email like '%@%'),
  szerep text not null default 'tag' check (szerep in ('admin', 'tag')),
  meghivta uuid default auth.uid() references auth.users(id) on delete set null,
  letrehozva timestamptz not null default now(),
  primary key (szervezet_id, email)
);

create or replace function sajat_szervezetek() returns setof uuid
language sql stable security definer set search_path = public as $$
  select szervezet_id from szervezet_tag where felhasznalo_id = (select auth.uid())
$$;

create or replace function sajat_admin_szervezetek() returns setof uuid
language sql stable security definer set search_path = public as $$
  select szervezet_id from szervezet_tag where felhasznalo_id = (select auth.uid()) and szerep in ('tulajdonos', 'admin')
$$;

-- Új iroda: a létrehozó lesz a tulajdonos.
create or replace function szervezet_letrehoz(p_nev text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if auth.uid() is null then raise exception 'Bejelentkezés szükséges'; end if;
  insert into szervezet (nev) values (trim(p_nev)) returning id into v;
  insert into szervezet_tag (szervezet_id, felhasznalo_id, szerep, email)
    values (v, auth.uid(), 'tulajdonos', lower(auth.jwt() ->> 'email'));
  return v;
end $$;

-- Belépés után: a felhasználó e-mail címére szóló meghívók elfogadása. Visszaadja, hány irodához csatlakozott.
create or replace function meghivok_elfogadasa() returns integer
language plpgsql security definer set search_path = public as $$
declare v_email text := lower(auth.jwt() ->> 'email'); n integer;
begin
  if auth.uid() is null or v_email is null then return 0; end if;
  -- csak megerősített e-mail címmel (Supabase: email_confirmed_at) – különben bárki regisztrálhatna más címére
  if not exists (select 1 from auth.users u where u.id = auth.uid() and u.email_confirmed_at is not null) then return 0; end if;
  insert into szervezet_tag (szervezet_id, felhasznalo_id, szerep, email)
    select m.szervezet_id, auth.uid(), m.szerep, v_email from szervezet_meghivo m where m.email = v_email
    on conflict do nothing;
  get diagnostics n = row_count;
  delete from szervezet_meghivo where email = v_email;
  return n;
end $$;

-- Tag eltávolítása / kilépés. Az utolsó tulajdonos nem távolítható el.
create or replace function tag_eltavolit(p_szervezet uuid, p_felhasznalo uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_felhasznalo <> auth.uid() and p_szervezet not in (select sajat_admin_szervezetek()) then
    raise exception 'Nincs jogosultság';
  end if;
  if exists (select 1 from szervezet_tag where szervezet_id = p_szervezet and felhasznalo_id = p_felhasznalo and szerep = 'tulajdonos')
     and (select count(*) from szervezet_tag where szervezet_id = p_szervezet and szerep = 'tulajdonos') = 1 then
    raise exception 'Az iroda utolsó tulajdonosa nem távolítható el';
  end if;
  delete from szervezet_tag where szervezet_id = p_szervezet and felhasznalo_id = p_felhasznalo;
end $$;

revoke execute on function szervezet_letrehoz(text), meghivok_elfogadasa(), tag_eltavolit(uuid, uuid),
  sajat_szervezetek(), sajat_admin_szervezetek() from public, anon;
grant execute on function szervezet_letrehoz(text), meghivok_elfogadasa(), tag_eltavolit(uuid, uuid),
  sajat_szervezetek(), sajat_admin_szervezetek() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Katalógus: anyagok

create table anyag (
  id uuid primary key default gen_random_uuid(),
  -- A felület ezzel hivatkozik az anyagra. Beépítettnél beszédes kód (alapkatalogus.ts), irodainál az id.
  kod text not null unique default gen_random_uuid()::text,
  szervezet_id uuid references szervezet(id) on delete cascade,  -- null = globális
  nev text not null,
  kategoria text not null,             -- pl. 'Falazat', 'Hőszigetelés', 'Vakolat'
  sraffozas text not null default 'vakolat'
    check (sraffozas in ('falazat', 'beton', 'hoszigeteles_hab', 'hoszigeteles_szalas', 'vakolat', 'fa', 'folia', 'burkolat', 'legreteg')),
  lambda numeric(8,4) check (lambda > 0),            -- tervezési hővezetési tényező [W/mK]
  rho numeric(8,1),                    -- testsűrűség [kg/m³]
  c numeric(8,1),                      -- fajhő [J/kgK]
  mu numeric(10,2),                    -- páradiffúziós ellenállási szám [–]
  -- Ismert hővezetési ellenállású termék adott vastagságnál (pl. üreges kerámia blokk)
  R_termek numeric(8,4) check (R_termek > 0),        -- [m²K/W]
  d_termek numeric(6,3) check (d_termek > 0),        -- [m]
  forras forras_tipus not null,
  forras_hivatkozas text not null,     -- pl. „Teljesítménynyilatkozat XY-2024” vagy „MSZ 24140 M2.”
  ellenorzott boolean not null default false,
  megjegyzes text,
  letrehozva timestamptz not null default now(),
  letrehozta uuid default auth.uid() references auth.users(id) on delete set null,
  check (lambda is not null or (R_termek is not null and d_termek is not null))
);
create index on anyag (szervezet_id);

-- ---------------------------------------------------------------------------------------------
-- Katalógus: rétegrendek és nyílászáró-típusok (irodai könyvtár).
-- A tartalom a felület modelljében (Retegrend / NyilaszaroTipus), jsonb-ben: így egy könyvtári elem
-- egy az egyben bemásolható a projektbe. A kereséshez szükséges mezők külön oszlopban.

create table retegrend (
  id uuid primary key default gen_random_uuid(),
  szervezet_id uuid references szervezet(id) on delete cascade,
  nev text not null,
  szerep text not null check (szerep in ('fal', 'padlas', 'teto', 'pincefodem', 'padlo', 'belso')),
  kovetelmeny_kod text not null,       -- 9/2023 ÉKM 1. melléklet 1.1. sorkód (U_KOVETELMENYEK.kod)
  u_ertek numeric(6,4),                -- mentéskori U (listához; a számítás mindig újraszámol)
  adat jsonb not null,                 -- Retegrend (a felület modellje)
  anyagok jsonb not null default '[]', -- a benne használt nem beépített anyagok pillanatképe
  forras forras_tipus not null default 'felhasznaloi',
  forras_hivatkozas text not null default '',
  megjegyzes text,
  letrehozva timestamptz not null default now(),
  letrehozta uuid default auth.uid() references auth.users(id) on delete set null
);
create index on retegrend (szervezet_id);

create table nyilaszaro_tipus (
  id uuid primary key default gen_random_uuid(),
  szervezet_id uuid references szervezet(id) on delete cascade,
  nev text not null,
  kovetelmeny_kod text not null,       -- 'ablak_fa_pvc', 'ablak_fem', 'ajto', 'tetosik_ablak', 'kapu'
  uw numeric(5,3),
  adat jsonb not null,                 -- NyilaszaroTipus
  forras forras_tipus not null default 'felhasznaloi',
  forras_hivatkozas text not null default '',
  letrehozva timestamptz not null default now(),
  letrehozta uuid default auth.uid() references auth.users(id) on delete set null
);
create index on nyilaszaro_tipus (szervezet_id);

-- ---------------------------------------------------------------------------------------------
-- Katalógus: épülettipológia (meglévő épületekhez tippelt szerkezetek)

create table epulettipus (
  id uuid primary key default gen_random_uuid(),
  kod text not null unique,            -- pl. 'panel_gyor_1984'
  csoport text not null,               -- 'panel', 'kockahaz', 'blokkos', 'parasztház', 'polgari_berhaz', ...
  nev text not null,
  epitesi_ev_tol smallint,
  epitesi_ev_ig smallint,
  leiras text,
  forras forras_tipus not null,
  forras_hivatkozas text not null
);

create table epulettipus_szerkezet (
  id uuid primary key default gen_random_uuid(),
  epulettipus_id uuid not null references epulettipus(id) on delete cascade,
  szerep text not null,                -- 'homlokzati_fal', 'padlasfodem', 'pincefodem', 'ablak', ...
  retegrend_id uuid references retegrend(id),
  nyilaszaro_tipus_id uuid references nyilaszaro_tipus(id),
  -- ha a forrás csak átlagos U-t ad (pl. 2. függ. 4.6. táblázat panelok)
  u_ertek numeric(6,3),
  u_tartalmaz_csatlakozasi_hohidat boolean not null default false,
  kiegeszito_hoszigeteles_cm smallint,
  forras forras_tipus not null,
  forras_hivatkozas text not null,
  check (retegrend_id is not null or nyilaszaro_tipus_id is not null or u_ertek is not null)
);
create index on epulettipus_szerkezet (epulettipus_id);
create index on epulettipus_szerkezet (retegrend_id);
create index on epulettipus_szerkezet (nyilaszaro_tipus_id);

-- ---------------------------------------------------------------------------------------------
-- Katalógus: gépészeti szettek (a leggyakoribb beállítások egy kattintással)

create table gepeszeti_szett (
  id uuid primary key default gen_random_uuid(),
  szervezet_id uuid references szervezet(id) on delete cascade,
  kod text not null,
  nev text not null,
  leiras text,
  -- A számítómag FutesiAlrendszer / HmvRendszer típusainak sablonja (Arszr, AN nélkül – a projektből jön)
  futes jsonb,
  hmv jsonb,
  jellemzo_epuletek text[],            -- pl. {'panel', 'kockahaz'}
  forras forras_tipus not null,
  forras_hivatkozas text not null,
  letrehozva timestamptz not null default now(),
  unique nulls not distinct (szervezet_id, kod)
);

-- ---------------------------------------------------------------------------------------------
-- Projektek. A projekt a felület dokumentuma (jsonb): helyiségek, rétegrendek, nyílászárók, felületek,
-- gépészet. A listázáshoz szükséges adatok külön oszlopban, az eredmény összesítője az `osszesito`-ben.
-- Egyidejű szerkesztés ellen: a `verzio` minden mentéskor nő, a kliens a várt verzióra feltételesen ment.

create table projekt (
  id uuid primary key default gen_random_uuid(),
  szervezet_id uuid not null references szervezet(id) on delete cascade,
  letrehozta uuid default auth.uid() references auth.users(id) on delete set null,
  modositotta uuid default auth.uid() references auth.users(id) on delete set null,
  nev text not null,
  cim text,                            -- kereséshez: irsz, település, közterület, házszám
  statusz text not null default 'vazlat' check (statusz in ('vazlat', 'szamitva', 'tanusitva', 'archiv')),
  dokumentum jsonb not null,
  dokumentum_verzio smallint not null default 1,   -- a dokumentum sémájának verziója (Projekt.verzio)
  osszesito jsonb,                     -- {AN, Enren, osztaly, ECO2, qm}
  verzio integer not null default 1,
  letrehozva timestamptz not null default now(),
  modositva timestamptz not null default now()
);
create index on projekt (szervezet_id, modositva desc);
create index on projekt (letrehozta);
create index on projekt (modositotta);

create or replace function projekt_mentes_elott() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    new.verzio := old.verzio + 1;
    new.letrehozva := old.letrehozva;
    new.letrehozta := old.letrehozta;
  end if;
  if tg_op = 'INSERT' then new.letrehozta := coalesce(auth.uid(), new.letrehozta); new.verzio := 1; end if;
  new.modositva := now();
  new.modositotta := coalesce(auth.uid(), new.modositotta);
  return new;
end $$;
create trigger projekt_mentes before insert or update on projekt for each row execute function projekt_mentes_elott();

-- Minden rögzített számítás visszakereshető pillanatképe (bemenet + eredmény + módszerverzió).
create table szamitas (
  id uuid primary key default gen_random_uuid(),
  projekt_id uuid not null references projekt(id) on delete cascade,
  projekt_verzio integer not null,
  modszer_verzio text not null,        -- pl. 'EKM-2023.07.27' (kormany.hu közzététel)
  mag_verzio text not null,
  bemenet jsonb not null,
  eredmeny jsonb not null,
  figyelmeztetesek jsonb not null default '[]',
  letrehozva timestamptz not null default now(),
  letrehozta uuid default auth.uid() references auth.users(id) on delete set null
);
create index on szamitas (projekt_id, letrehozva desc);
create index on szamitas (letrehozta);

create table tanusitvany (
  id uuid primary key default gen_random_uuid(),
  projekt_id uuid not null references projekt(id) on delete cascade,
  szamitas_id uuid not null references szamitas(id),
  tanusito_nev text not null,
  tanusito_jogosultsag text not null,  -- pl. 'TÉ 11-0296'
  energetikai_osztaly text not null,
  co2_osztaly text not null,
  xml_tarolo_utvonal text,             -- Supabase Storage
  pdf_tarolo_utvonal text,
  het_kod text,                        -- e-tanúsítás által adott Hiteles Energetikai Tanúsítvány kód
  feltoltve timestamptz,
  letrehozva timestamptz not null default now()
);
create index on tanusitvany (projekt_id);
create index on tanusitvany (szamitas_id);

-- ---------------------------------------------------------------------------------------------
-- RLS

alter table szervezet enable row level security;
alter table szervezet_tag enable row level security;
alter table szervezet_meghivo enable row level security;
create policy szervezet_olvas on szervezet for select to authenticated using (id in (select sajat_szervezetek()));
create policy szervezet_atnevez on szervezet for update to authenticated
  using (id in (select sajat_admin_szervezetek())) with check (id in (select sajat_admin_szervezetek()));
create policy tag_olvas on szervezet_tag for select to authenticated using (szervezet_id in (select sajat_szervezetek()));
create policy tag_szerep on szervezet_tag for update to authenticated
  using (szervezet_id in (select sajat_admin_szervezetek()) and szerep <> 'tulajdonos') with check (szervezet_id in (select sajat_admin_szervezetek()) and szerep <> 'tulajdonos');
create policy meghivo_admin on szervezet_meghivo for all to authenticated
  using (szervezet_id in (select sajat_admin_szervezetek())) with check (szervezet_id in (select sajat_admin_szervezetek()));

do $$
declare t text;
begin
  foreach t in array array['anyag', 'retegrend', 'nyilaszaro_tipus', 'gepeszeti_szett'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %1$s_olvas on %1$I for select to authenticated using (szervezet_id is null or szervezet_id in (select sajat_szervezetek()))', t);
    execute format('create policy %1$s_beszur on %1$I for insert to authenticated with check (szervezet_id in (select sajat_szervezetek()))', t);
    execute format('create policy %1$s_modosit on %1$I for update to authenticated using (szervezet_id in (select sajat_szervezetek())) with check (szervezet_id in (select sajat_szervezetek()))', t);
    execute format('create policy %1$s_torol on %1$I for delete to authenticated using (szervezet_id in (select sajat_szervezetek()))', t);
  end loop;
end $$;

alter table epulettipus enable row level security;
alter table epulettipus_szerkezet enable row level security;
create policy tipologia_olvas on epulettipus for select to authenticated using (true);
create policy tipologia_szerk_olvas on epulettipus_szerkezet for select to authenticated using (true);

alter table projekt enable row level security;
create policy projekt_olvas on projekt for select to authenticated using (szervezet_id in (select sajat_szervezetek()));
create policy projekt_beszur on projekt for insert to authenticated with check (szervezet_id in (select sajat_szervezetek()));
create policy projekt_modosit on projekt for update to authenticated
  using (szervezet_id in (select sajat_szervezetek())) with check (szervezet_id in (select sajat_szervezetek()));
create policy projekt_torol on projekt for delete to authenticated using (szervezet_id in (select sajat_szervezetek()));

create or replace function projekt_sajat(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from projekt where id = p and szervezet_id in (select sajat_szervezetek()))
$$;
revoke execute on function projekt_sajat(uuid) from public, anon;
grant execute on function projekt_sajat(uuid) to authenticated;

alter table szamitas enable row level security;
create policy szamitas_olvas on szamitas for select to authenticated using (projekt_sajat(projekt_id));
create policy szamitas_beszur on szamitas for insert to authenticated with check (projekt_sajat(projekt_id));
-- a rögzített számítás nem módosítható, nem törölhető (csak a projekttel együtt)

alter table tanusitvany enable row level security;
create policy tanusitvany_olvas on tanusitvany for select to authenticated using (projekt_sajat(projekt_id));
create policy tanusitvany_beszur on tanusitvany for insert to authenticated with check (projekt_sajat(projekt_id));
create policy tanusitvany_modosit on tanusitvany for update to authenticated using (projekt_sajat(projekt_id)) with check (projekt_sajat(projekt_id));
