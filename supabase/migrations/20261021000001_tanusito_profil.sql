-- Tanúsítói profil: a tanúsító adatai a felhasználóhoz kötve (nem projektenként).
-- Kamarai névjegyzéki szám nélkül (próba): legfeljebb 1 saját projekt, tanúsítvány nem rögzíthető.
-- Jogosultság: „TÉ 11-0296” (épületenergetikai tanúsító, 176/2008 Korm. r.)
--              „SZÉS6 11-0296” (épületenergetikai szakértő, 1. mell. SZÉS6 részszakterület).

create table if not exists tanusito_profil (
  felhasznalo_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  nev text not null,
  kamara text not null default 'MEK' check (kamara in ('MEK', 'MMK')),
  jogosultsag text check (jogosultsag is null or jogosultsag ~ '^(TÉ|SZÉS6) [0-9]{2}-[0-9]{4,5}$'),
  email text,
  telefon text,
  cim jsonb,
  ellenorzes jsonb,
  modositva timestamptz not null default now()
);
alter table tanusito_profil enable row level security;
drop policy if exists profil_sajat on tanusito_profil;
create policy profil_sajat on tanusito_profil for all to authenticated
  using (felhasznalo_id = (select auth.uid())) with check (felhasznalo_id = (select auth.uid()));

create or replace function tanusito_jogosult(u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from tanusito_profil where felhasznalo_id = u and jogosultsag is not null)
$$;

-- Szám nélkül legfeljebb 1 saját projekt.
create or replace function projekt_korlat() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not tanusito_jogosult(auth.uid()) and (select count(*) from projekt where letrehozta = auth.uid()) >= 1 then
    raise exception 'TANUSITO_SZAM_KELL' using errcode = 'P0001',
      hint = 'Kamarai tanúsítói vagy szakértői szám nélkül legfeljebb 1 projekt hozható létre.';
  end if;
  return new;
end $$;
drop trigger if exists projekt_korlat on projekt;
create trigger projekt_korlat before insert on projekt for each row execute function projekt_korlat();

-- Tanúsítvány csak névjegyzéki számmal rögzíthető.
drop policy if exists tanusitvany_beszur on tanusitvany;
create policy tanusitvany_beszur on tanusitvany for insert to authenticated
  with check (projekt_sajat(projekt_id) and tanusito_jogosult((select auth.uid())));

-- Regisztráció: a profil a regisztrációs űrlap adataiból (user metadata) jön létre.
create or replace function uj_felhasznalo_profil() returns trigger
language plpgsql security definer set search_path = public as $$
declare j text := nullif(trim(new.raw_user_meta_data->>'jogosultsag'), '');
begin
  if coalesce(new.raw_user_meta_data->>'tanusito_nev', '') <> '' then
    if j is not null and j !~ '^(TÉ|SZÉS6) [0-9]{2}-[0-9]{4,5}$' then j := null; end if;
    insert into tanusito_profil (felhasznalo_id, nev, kamara, jogosultsag, email)
    values (new.id, new.raw_user_meta_data->>'tanusito_nev',
            case when new.raw_user_meta_data->>'kamara' = 'MMK' then 'MMK' else 'MEK' end, j, new.email)
    on conflict (felhasznalo_id) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists uj_felhasznalo_profil on auth.users;
create trigger uj_felhasznalo_profil after insert on auth.users for each row execute function uj_felhasznalo_profil();
