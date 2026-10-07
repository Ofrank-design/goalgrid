-- GoalGrid Phase 1: identity, entitlements, operations. Football, prediction and community tables arrive with their phases.
create table public.profiles (id uuid primary key references auth.users on delete cascade, username text unique, display_name text, avatar_url text, created_at timestamptz not null default now());
create table public.user_preferences (user_id uuid primary key references auth.users on delete cascade, favorite_leagues text[] not null default '{}', email_updates boolean not null default false, updated_at timestamptz not null default now());
create table public.user_entitlements (user_id uuid primary key references auth.users on delete cascade, tier text not null check (tier in ('free','pro','premium')), source text not null, expires_at timestamptz, updated_at timestamptz not null default now());
create table public.unlock_attempts (id bigserial primary key, user_id uuid not null references auth.users on delete cascade, tier text not null, success boolean not null, created_at timestamptz not null default now());
create index on public.unlock_attempts (user_id, created_at desc);
create table public.provider_health (provider text primary key, status text not null check (status in ('ok','degraded','down')), last_ok_at timestamptz, last_error_kind text, latency_ms int, updated_at timestamptz not null default now());
create table public.ingestion_jobs (id bigserial primary key, job text not null, provider text, status text not null check (status in ('queued','running','succeeded','failed')), started_at timestamptz, finished_at timestamptz, detail jsonb not null default '{}', created_at timestamptz not null default now());
create table public.system_logs (id bigserial primary key, level text not null, message text not null, context jsonb not null default '{}', created_at timestamptz not null default now());

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.user_entitlements enable row level security;
alter table public.unlock_attempts enable row level security;
alter table public.provider_health enable row level security;
alter table public.ingestion_jobs enable row level security;
alter table public.system_logs enable row level security;

create policy "own profile read" on public.profiles for select using (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id);
create policy "own prefs all" on public.user_preferences for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Users may read their own entitlement. Only the server (service role) writes it, so a tier can never be self-granted.
create policy "own entitlement read" on public.user_entitlements for select using (auth.uid() = user_id);
-- unlock_attempts, provider_health, ingestion_jobs, system_logs: RLS on with no policies = service role only.

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id);
  insert into public.user_entitlements (user_id, tier, source) values (new.id, 'free', 'signup');
  insert into public.user_preferences (user_id) values (new.id);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
