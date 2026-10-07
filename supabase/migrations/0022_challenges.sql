-- GoalGrid weekly prediction challenges. Challenge standings derive from the same immutable user_predictions records.
create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'active' check (status in ('scheduled','active','closed')),
  created_at timestamptz not null default now()
);
create table if not exists public.challenge_matches (
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  position smallint not null check (position between 1 and 20),
  match_id text not null,
  match_date date not null,
  kickoff_utc timestamptz not null,
  league_slug text not null,
  home_name text not null,
  away_name text not null,
  primary key (challenge_id, match_id),
  unique (challenge_id, position)
);
create index if not exists challenge_matches_kickoff_idx on public.challenge_matches (challenge_id, kickoff_utc);
create table if not exists public.challenge_entries (
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (challenge_id, user_id)
);
create index if not exists challenge_entries_user_idx on public.challenge_entries (user_id, joined_at desc);
alter table public.challenges enable row level security;
alter table public.challenge_matches enable row level security;
alter table public.challenge_entries enable row level security;
drop policy if exists "read visible challenges" on public.challenges;
create policy "read visible challenges" on public.challenges for select using (status in ('scheduled','active','closed'));
drop policy if exists "read challenge matches" on public.challenge_matches;
create policy "read challenge matches" on public.challenge_matches for select using (exists (select 1 from public.challenges c where c.id = challenge_id and c.status in ('scheduled','active','closed')));
drop policy if exists "own challenge entries" on public.challenge_entries;
create policy "own challenge entries" on public.challenge_entries for select using (auth.uid() = user_id);

grant select on public.challenges, public.challenge_matches to anon, authenticated;
