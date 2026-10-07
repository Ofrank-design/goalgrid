-- Optional extra picks next to the 1X2 pick: BTTS, over/under 2.5 and exact score. One per match per type, locked at kickoff, scored on the server only.
create table public.user_market_picks (user_id uuid not null references auth.users on delete cascade, match_id text not null, market text not null check (market in ('btts','over25','exact')), value text not null check (char_length(value) <= 8),
  match_date date not null, kickoff_utc timestamptz not null, points int, correct boolean, settled_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), primary key (user_id, match_id, market));
create index on public.user_market_picks (kickoff_utc) where settled_at is null; create index on public.user_market_picks (user_id, settled_at);
alter table public.user_market_picks enable row level security;
create policy "own market picks" on public.user_market_picks for select to authenticated using (auth.uid() = user_id);
revoke all on public.user_market_picks from anon; revoke insert, update, delete on public.user_market_picks from authenticated;
