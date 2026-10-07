-- GoalGrid Phase 8: stored predictions, accuracy tracking, moderation audit, email.
create table public.prediction_snapshots (match_id text primary key, match_date date not null, league_slug text not null, home_name text not null, away_name text not null, kickoff_utc timestamptz not null,
  p_home numeric(5,4) not null, p_draw numeric(5,4) not null, p_away numeric(5,4) not null, xg_home numeric(4,2), xg_away numeric(4,2), btts numeric(5,4), over25 numeric(5,4), confidence int, models_used int,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index on public.prediction_snapshots (kickoff_utc);
create table public.prediction_results (match_id text primary key references public.prediction_snapshots(match_id) on delete cascade, outcome text not null check (outcome in ('home','draw','away')), home_goals int not null, away_goals int not null,
  log_loss numeric(7,4) not null, brier numeric(7,4) not null, correct boolean not null, btts_correct boolean, over25_correct boolean, evaluated_at timestamptz not null default now());
create table public.moderation_actions (id bigserial primary key, post_id uuid references public.posts(id) on delete set null, admin_email text not null, action text not null check (action in ('restore','remove')), created_at timestamptz not null default now());
create table public.email_subscribers (email text primary key check (email = lower(email)), confirmed_at timestamptz, unsubscribed_at timestamptz, created_at timestamptz not null default now());
create table public.email_log (id bigserial primary key, kind text not null, recipient text not null, status text not null check (status in ('sent','failed')), error text, created_at timestamptz not null default now());
create index on public.email_log (kind, created_at desc);
alter table public.prediction_snapshots enable row level security; alter table public.prediction_results enable row level security; alter table public.moderation_actions enable row level security;
alter table public.email_subscribers enable row level security; alter table public.email_log enable row level security;
-- All tables above are service role only. The accuracy page reads this view, which exposes no personal data.
create view public.prediction_eval as select s.match_id, s.league_slug, s.home_name, s.away_name, s.kickoff_utc, s.p_home, s.p_draw, s.p_away, s.btts, s.over25, r.outcome, r.home_goals, r.away_goals, r.log_loss, r.brier, r.correct, r.btts_correct, r.over25_correct
  from public.prediction_snapshots s join public.prediction_results r using (match_id);
grant select on public.prediction_eval to anon, authenticated;
