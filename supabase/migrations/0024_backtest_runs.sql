-- Persistent, auditable real-football walk-forward backtests. Results are immutable research records.
create table if not exists public.backtest_runs (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  league_slug text not null,
  folds int not null check (folds between 2 and 6),
  start_fraction numeric not null check (start_fraction > 0 and start_fraction < 1),
  model_ids text[] not null default '{}',
  result jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists backtest_runs_created_idx on public.backtest_runs(created_at desc);
create index if not exists backtest_runs_creator_idx on public.backtest_runs(created_by, created_at desc);
alter table public.backtest_runs enable row level security;
-- Backtests can expose aggregate metrics but not private account data.
-- All access is served by the server-side admin route through the service role.
-- RLS remains enabled with no client policies, so anon/authenticated clients cannot read or mutate these rows.
revoke all on public.backtest_runs from anon, authenticated;
