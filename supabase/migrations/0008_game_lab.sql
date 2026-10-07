-- Game Intelligence Lab data foundation. Observations are append only and deduplicated; reads are Premium only; writes are server only.
create table public.games (id text primary key check (id ~ '^[a-z0-9-]{2,40}$'), name text not null, value_label text not null default 'value', active boolean not null default true, created_at timestamptz not null default now());
create table public.game_sources (id text primary key check (id ~ '^[a-z0-9-]{2,40}$'), game_id text not null references public.games(id) on delete cascade, name text not null, licence_note text, active boolean not null default true, created_at timestamptz not null default now());
create table public.game_observations (id bigserial primary key, game_id text not null references public.games(id), source_id text not null references public.game_sources(id), external_round_id text, observed_at timestamptz not null,
  value double precision not null check (value >= 0 and value <= 1e7), raw_value text, sequence bigint, data_quality text not null default 'observed' check (data_quality in ('verified','observed','partial')), collection_latency_ms int, created_at timestamptz not null default now());
create unique index game_obs_round on public.game_observations (game_id, source_id, external_round_id) where external_round_id is not null;
create unique index game_obs_time_value on public.game_observations (game_id, source_id, observed_at, value) where external_round_id is null;
create index game_obs_series on public.game_observations (game_id, source_id, observed_at desc);
create function public.observations_append_only() returns trigger language plpgsql as $$ begin raise exception 'game_observations is append only'; end $$;
create trigger game_observations_no_change before update or delete on public.game_observations for each row execute function public.observations_append_only();
create table public.collection_health (source_id text primary key references public.game_sources(id) on delete cascade, last_success_at timestamptz, last_error_at timestamptz, last_error text, observations_24h int not null default 0, updated_at timestamptz not null default now());
create table public.analysis_runs (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, game_id text not null, source_id text not null, params jsonb not null, result jsonb not null, engine_version text not null, observation_count int not null, created_at timestamptz not null default now());
create index on public.analysis_runs (user_id, created_at desc);
alter table public.games enable row level security; alter table public.game_sources enable row level security; alter table public.game_observations enable row level security; alter table public.collection_health enable row level security; alter table public.analysis_runs enable row level security;
create function public.is_premium() returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from public.user_entitlements e where e.user_id = auth.uid() and e.tier = 'premium' and (e.expires_at is null or e.expires_at > now())) $$;
grant execute on function public.is_premium() to authenticated; revoke execute on function public.is_premium() from anon, public;
create policy "premium reads games" on public.games for select to authenticated using (public.is_premium());
create policy "premium reads sources" on public.game_sources for select to authenticated using (public.is_premium());
create policy "premium reads observations" on public.game_observations for select to authenticated using (public.is_premium());
create policy "premium reads health" on public.collection_health for select to authenticated using (public.is_premium());
create policy "own analysis runs" on public.analysis_runs for select to authenticated using (auth.uid() = user_id and public.is_premium());
revoke all on public.games, public.game_sources, public.game_observations, public.collection_health, public.analysis_runs from anon;
revoke insert, update, delete on public.games, public.game_sources, public.game_observations, public.collection_health, public.analysis_runs from authenticated;
