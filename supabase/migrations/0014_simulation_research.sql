-- Simulation research tools: more run kinds, and a strategy library. Shares hold a stored run's settings, never code.
alter table public.simulation_runs drop constraint if exists simulation_runs_kind_check;
alter table public.simulation_runs add constraint simulation_runs_kind_check check (kind in ('match','multi','season','experiment','fictional','multiplier','risk','backtest'));
create table public.simulation_shares (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, run_id uuid references public.simulation_runs(id) on delete set null,
  title text not null check (char_length(title) between 3 and 80), summary text not null check (char_length(summary) between 20 and 300), method text check (method is null or char_length(method) <= 600), kind text not null, configuration jsonb not null, seed text not null, sample_size int not null default 0,
  status text not null default 'active' check (status in ('active','hidden','removed')), created_at timestamptz not null default now());
create index on public.simulation_shares (created_at desc);
create table public.simulation_share_likes (share_id uuid not null references public.simulation_shares(id) on delete cascade, user_id uuid not null references auth.users on delete cascade, primary key (share_id, user_id));
create table public.simulation_share_reports (share_id uuid not null references public.simulation_shares(id) on delete cascade, reporter_id uuid not null references auth.users on delete cascade, reason text check (reason is null or char_length(reason) <= 200), created_at timestamptz not null default now(), primary key (share_id, reporter_id));
alter table public.simulation_shares enable row level security; alter table public.simulation_share_likes enable row level security; alter table public.simulation_share_reports enable row level security;
create policy "read active shares" on public.simulation_shares for select to authenticated using (status = 'active' and public.is_pro());
revoke all on public.simulation_shares, public.simulation_share_likes, public.simulation_share_reports from anon; revoke insert, update, delete on public.simulation_shares, public.simulation_share_likes, public.simulation_share_reports from authenticated; revoke all on public.simulation_share_likes, public.simulation_share_reports from authenticated;
alter table public.moderation_actions drop constraint if exists moderation_actions_action_check;
alter table public.moderation_actions add constraint moderation_actions_action_check check (action in ('restore','remove','hide','warn','suspend','ban','unban','review','verify','reject'));
