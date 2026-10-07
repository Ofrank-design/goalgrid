-- GoalGrid Phase 2: normalized football core. Public read, service-role write.
create table public.leagues (slug text primary key, name text not null, country text, created_at timestamptz not null default now());
create table public.teams (slug text primary key, name text not null, short_name text, created_at timestamptz not null default now());
create table public.provider_entities (provider text not null, entity_type text not null check (entity_type in ('league','team','match')), provider_id text not null, goalgrid_key text not null, primary key (provider, entity_type, provider_id));
create table public.matches (
  id text primary key, league_slug text not null references public.leagues(slug), home_slug text not null references public.teams(slug), away_slug text not null references public.teams(slug),
  kickoff_utc timestamptz not null, status text not null check (status in ('scheduled','live','finished','postponed','cancelled','unknown')),
  home_goals int check (home_goals >= 0), away_goals int check (away_goals >= 0), matchday int,
  source text not null, retrieved_at timestamptz not null, source_timestamp timestamptz, expires_at timestamptz not null, check (home_slug <> away_slug));
create index on public.matches (kickoff_utc);
create index on public.matches (league_slug, kickoff_utc);
alter table public.leagues enable row level security; alter table public.teams enable row level security;
alter table public.matches enable row level security; alter table public.provider_entities enable row level security;
create policy "public read leagues" on public.leagues for select using (true);
create policy "public read teams" on public.teams for select using (true);
create policy "public read matches" on public.matches for select using (true);
-- provider_entities: RLS on, no policies = service role only. Writes to all four tables go through the server.
insert into public.leagues (slug, name, country) values ('premier-league','Premier League','England'),('la-liga','LaLiga','Spain'),('serie-a','Serie A','Italy'),('bundesliga','Bundesliga','Germany'),('ligue-1','Ligue 1','France') on conflict do nothing;
