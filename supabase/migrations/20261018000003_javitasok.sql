-- Supabase advisor javítások (2026-10-18)
-- 1) A SQL Editor „RLS automatikus bekapcsolása” opciója által létrehozott segédfüggvény ne legyen hívható az API-n át.
do $$ begin
  if exists (select 1 from pg_proc where proname = 'rls_auto_enable' and pronamespace = 'public'::regnamespace) then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
-- 2) Idegen kulcsok indexei
create index if not exists anyag_letrehozta_idx on anyag (letrehozta);
create index if not exists retegrend_letrehozta_idx on retegrend (letrehozta);
create index if not exists nyilaszaro_tipus_letrehozta_idx on nyilaszaro_tipus (letrehozta);
create index if not exists szervezet_meghivo_meghivta_idx on szervezet_meghivo (meghivta);
