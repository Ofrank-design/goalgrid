-- Prediction versioning. Every material change to a match prediction becomes a new numbered version; versions are append only.
-- A prediction freezes 15 minutes before kickoff: the job stops writing versions then, and the last version is the one judged afterwards.
create table public.prediction_versions (id bigserial primary key, match_id text not null, version int not null check (version >= 1), engine_version text not null, kickoff_utc timestamptz not null, created_at timestamptz not null default now(),
  p_home numeric(5,4) not null, p_draw numeric(5,4) not null, p_away numeric(5,4) not null, xg_home numeric(4,2), xg_away numeric(4,2), btts numeric(5,4), over25 numeric(5,4), confidence int, models_used int, conformal jsonb, unique (match_id, version));
create index on public.prediction_versions (match_id, version desc); create index on public.prediction_versions (kickoff_utc);
create trigger prediction_versions_no_change before update or delete on public.prediction_versions for each row execute function public.audit_is_append_only();
alter table public.prediction_versions enable row level security; revoke all on public.prediction_versions from anon, authenticated;
