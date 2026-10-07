-- GoalGrid control plane: centralized feature flags, resource limits, model/provider registry metadata and AI budgets.
create table if not exists public.feature_flags (
  key text primary key check (key ~ '^[a-z0-9][a-z0-9_.-]{1,80}$'),
  enabled boolean not null default false,
  rollout_percent int not null default 100 check (rollout_percent between 0 and 100),
  note text,
  updated_at timestamptz not null default now()
);

create table if not exists public.resource_limits (
  key text primary key,
  max_value numeric not null check (max_value >= 0),
  window_seconds int,
  scope text not null default 'global' check (scope in ('global','user','ip','job')),
  note text,
  updated_at timestamptz not null default now()
);

create table if not exists public.model_registry (
  model_id text primary key,
  name text not null,
  version text not null,
  status text not null check (status in ('research','shadow','candidate','production','degraded','retired')),
  tier text not null check (tier in ('A','B','C','D')),
  purpose text,
  owner text,
  training_dataset text,
  training_period text,
  feature_version text,
  supported_competitions text[] not null default '{}',
  supported_markets text[] not null default '{}',
  required_features text[] not null default '{}',
  minimum_sample_size int not null default 0 check (minimum_sample_size >= 0),
  calibration_version text,
  recent_performance jsonb not null default '{}',
  calibration_score numeric,
  health_score numeric,
  compute_cost numeric,
  latency_cost numeric,
  known_failure_modes text[] not null default '{}',
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  retired_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.provider_registry (
  provider_id text primary key,
  name text not null,
  kind text not null,
  status text not null default 'unknown' check (status in ('ok','degraded','down','unknown')),
  base_url text,
  version text,
  supported_capabilities text[] not null default '{}',
  last_ok_at timestamptz,
  last_error_at timestamptz,
  latency_ms int,
  error_rate numeric,
  quota_note text,
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_budget_profiles (
  key text primary key,
  requests_per_hour int not null check (requests_per_hour >= 0),
  tokens_per_hour int not null check (tokens_per_hour >= 0),
  max_output_tokens int not null check (max_output_tokens >= 0),
  note text,
  updated_at timestamptz not null default now()
);

alter table public.feature_flags enable row level security;
alter table public.resource_limits enable row level security;
alter table public.model_registry enable row level security;
alter table public.provider_registry enable row level security;
alter table public.ai_budget_profiles enable row level security;

revoke all on public.feature_flags, public.resource_limits, public.model_registry, public.provider_registry, public.ai_budget_profiles from anon, authenticated;
revoke all on public.feature_flags, public.resource_limits, public.model_registry, public.provider_registry, public.ai_budget_profiles from public;

insert into public.feature_flags(key, enabled, rollout_percent, note) values
 ('simulation.addendum', false, 0, 'Optional research-only addendum; never part of the core football Simulation Lab.'),
 ('simulation.experiments', true, 100, 'Premium experiment workspace.'),
 ('community.private_circles', true, 100, 'Authenticated private discussion circles.'),
 ('notifications.delivery', true, 100, 'Durable in-app notification delivery.')
on conflict (key) do nothing;

insert into public.resource_limits(key, max_value, window_seconds, scope, note) values
 ('simulation.match_per_hour', 60, 3600, 'user', 'Interactive simulated matches.'),
 ('simulation.season_per_hour', 10, 3600, 'user', 'Season simulations.'),
 ('simulation.multi_pro', 1000, null, 'user', 'Maximum matches in one Pro batch.'),
 ('simulation.multi_premium', 10000, null, 'user', 'Maximum matches in one Premium batch.'),
 ('simulation.season_pro', 200, null, 'user', 'Maximum seasons in one Pro request.'),
 ('simulation.season_premium', 2000, null, 'user', 'Maximum seasons in one Premium request.'),
 ('community.posts_per_hour', 20, 3600, 'user', 'General community posts.'),
 ('community.comments_per_hour', 20, 3600, 'user', 'Comments/replies.'),
 ('community.likes_per_hour', 60, 3600, 'user', 'Likes.'),
 ('community.reports_per_day', 10, 86400, 'user', 'Reports.'),
 ('community.follows_per_hour', 30, 3600, 'user', 'Follow actions.'),
 ('uploads.proof_per_day', 5, 86400, 'user', 'Proof image uploads.'),
 ('ai.requests_per_hour', 10, 3600, 'user', 'LLM-backed interactive requests.'),
 ('system.max_job_duration_ms', 60000, null, 'job', 'Default application job ceiling.'),
 ('system.max_queue_depth', 1000, null, 'global', 'Alert/observability threshold.')
on conflict (key) do nothing;

insert into public.ai_budget_profiles(key, requests_per_hour, tokens_per_hour, max_output_tokens, note) values
 ('default', 10, 120000, 2500, 'Conservative interactive budget.'),
 ('premium', 30, 500000, 5000, 'Premium research budget.')
on conflict (key) do nothing;
