-- Simulation Lab. Synthetic runs live in their own table and never touch matches, predictions, leaderboards, trophies or challenges.
create function public.is_pro() returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from public.user_entitlements e where e.user_id = auth.uid() and e.tier in ('pro','premium') and (e.expires_at is null or e.expires_at > now())) $$;
grant execute on function public.is_pro() to authenticated; revoke execute on function public.is_pro() from anon, public;
create table public.simulation_runs (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, kind text not null check (kind in ('match','multi','season')),
  league_slug text not null, configuration jsonb not null, seed text not null check (seed ~ '^[A-Za-z0-9]{1,16}$'), engine_version text not null, model_version text not null, result jsonb not null, events jsonb, record_count int not null default 1, created_at timestamptz not null default now());
create index on public.simulation_runs (user_id, created_at desc);
create trigger simulation_runs_no_change before update on public.simulation_runs for each row execute function public.audit_is_append_only();
alter table public.simulation_runs enable row level security;
create policy "own simulation runs" on public.simulation_runs for select to authenticated using (auth.uid() = user_id and public.is_pro());
revoke all on public.simulation_runs from anon; revoke insert, update, delete on public.simulation_runs from authenticated;
