-- Clients never write directly: every write goes through the server with the service role (the app has no browser-side table writes).
-- Supabase grants every new table to anon and authenticated by default, which left RLS as the only barrier. Close that for existing
-- tables and for tables created by later migrations. SELECT stays governed by RLS and the grants made in each migration.
revoke insert, update, delete, truncate, references, trigger on all tables in schema public from anon, authenticated;
alter default privileges for role postgres in schema public revoke insert, update, delete, truncate, references, trigger on tables from anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'supabase_admin') then
    alter default privileges for role supabase_admin in schema public revoke insert, update, delete, truncate, references, trigger on tables from anon, authenticated;
  end if;
end $$;
