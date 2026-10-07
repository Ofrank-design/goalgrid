-- Precomputed engine output. The cron refresh job fits the ensembles and writes predictions and model libraries here; request handlers
-- read these rows instead of fitting models themselves. Server only: the service role reads and writes, clients get nothing.
create table public.engine_cache (
  key text primary key,
  payload jsonb not null,
  engine_version text not null,
  built_at timestamptz not null default now()
);
create index engine_cache_built_idx on public.engine_cache (built_at);
alter table public.engine_cache enable row level security;
revoke all on public.engine_cache from anon, authenticated;
