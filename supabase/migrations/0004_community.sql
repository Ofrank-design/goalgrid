-- GoalGrid Phase 7: community, match threads, prediction challenges, leaderboard.
-- All writes go through the server (service role). Clients can only read what the policies and views below expose.
alter table public.profiles add constraint username_format check (username is null or username ~ '^[a-z0-9_]{3,20}$');
create table public.posts (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, match_id text, parent_id uuid references public.posts(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500), status text not null default 'visible' check (status in ('visible','hidden','removed')), created_at timestamptz not null default now());
create index on public.posts (match_id, created_at desc); create index on public.posts (user_id, created_at desc);
create table public.post_likes (post_id uuid not null references public.posts(id) on delete cascade, user_id uuid not null references auth.users on delete cascade, primary key (post_id, user_id));
create table public.post_reports (post_id uuid not null references public.posts(id) on delete cascade, reporter_id uuid not null references auth.users on delete cascade, reason text check (char_length(reason) <= 200), created_at timestamptz not null default now(), primary key (post_id, reporter_id));
create table public.user_predictions (user_id uuid not null references auth.users on delete cascade, match_id text not null, match_date date not null, league_slug text not null, home_name text not null, away_name text not null, kickoff_utc timestamptz not null,
  pick text not null check (pick in ('home','draw','away')), confidence int not null check (confidence between 40 and 95), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  settled_at timestamptz, outcome text check (outcome in ('home','draw','away','void')), points int, primary key (user_id, match_id));
create index on public.user_predictions (kickoff_utc) where settled_at is null; create index on public.user_predictions (settled_at);
alter table public.posts enable row level security; alter table public.post_likes enable row level security; alter table public.post_reports enable row level security; alter table public.user_predictions enable row level security;
create policy "read visible posts" on public.posts for select using (status = 'visible');
create policy "read likes" on public.post_likes for select using (true);
create policy "own predictions" on public.user_predictions for select using (auth.uid() = user_id);
-- post_reports: no policies, service role only.
-- Public views run with the owner's rights on purpose. They expose usernames and aggregates, never user ids or emails.
create view public.posts_feed as select p.id, p.match_id, p.parent_id, p.body, p.created_at, pr.username, (select count(*) from public.post_likes l where l.post_id = p.id)::int as likes
  from public.posts p join public.profiles pr on pr.id = p.user_id where p.status = 'visible' and pr.username is not null;
create view public.leaderboard_all as select pr.username, count(*)::int as picks, sum(up.points)::int as points, round(100.0 * avg((up.outcome = up.pick)::int))::int as accuracy
  from public.user_predictions up join public.profiles pr on pr.id = up.user_id where up.settled_at is not null and up.outcome <> 'void' and pr.username is not null group by pr.username having count(*) >= 3;
create view public.leaderboard_week as select pr.username, count(*)::int as picks, sum(up.points)::int as points, round(100.0 * avg((up.outcome = up.pick)::int))::int as accuracy
  from public.user_predictions up join public.profiles pr on pr.id = up.user_id where up.settled_at > now() - interval '7 days' and up.outcome <> 'void' and pr.username is not null group by pr.username having count(*) >= 3;
grant select on public.posts_feed, public.leaderboard_all, public.leaderboard_week to anon, authenticated;
