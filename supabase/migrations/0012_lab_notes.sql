-- Research notes: Premium users keep notes against a game, time range, saved run or metric. Notes never touch observations.
create table public.lab_notes (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, game_id text not null, time_range text, run_id uuid references public.analysis_runs(id) on delete set null, metric text check (metric is null or char_length(metric) <= 40),
  body text not null check (char_length(body) between 1 and 500), created_at timestamptz not null default now());
create index on public.lab_notes (user_id, game_id, created_at desc);
alter table public.lab_notes enable row level security;
create policy "own notes" on public.lab_notes for select to authenticated using (auth.uid() = user_id and public.is_premium());
revoke all on public.lab_notes from anon; revoke insert, update, delete on public.lab_notes from authenticated;
