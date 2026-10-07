-- GoalGrid security layer: durable per-user rate limits, an append-only audit log, and a fixed set of report reasons.
-- Server only: the service role calls these. No client policies are added.
create table public.rate_events (key text not null, hit_at timestamptz not null default now());
create index on public.rate_events (key, hit_at desc);
alter table public.rate_events enable row level security;
revoke all on public.rate_events from anon, authenticated;
-- Counts events for a key inside a window and records a new one in the same call, so two requests cannot both slip under the limit.
create function public.take_rate_limit(p_key text, p_max int, p_window_seconds int) returns table (allowed boolean, retry_after_seconds int)
language plpgsql security definer set search_path = public as $$
declare n int; oldest timestamptz;
begin
  perform pg_advisory_xact_lock(hashtext(p_key));
  select count(*), min(hit_at) into n, oldest from public.rate_events where key = p_key and hit_at > now() - make_interval(secs => p_window_seconds);
  if n >= p_max then return query select false, greatest(1, ceil(extract(epoch from (oldest + make_interval(secs => p_window_seconds) - now())))::int); return; end if;
  insert into public.rate_events (key) values (p_key);
  return query select true, 0;
end $$;
revoke all on function public.take_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.take_rate_limit(text, int, int) to service_role;
create function public.prune_rate_events() returns void language sql security definer set search_path = public as $$ delete from public.rate_events where hit_at < now() - interval '2 days' $$;
revoke all on function public.prune_rate_events() from public, anon, authenticated; grant execute on function public.prune_rate_events() to service_role;
-- Audit records are append only: nobody, including the service role in normal code paths, can change or remove one.
alter table public.moderation_actions add column if not exists prior_state text, add column if not exists new_state text, add column if not exists reason text;
create function public.audit_is_append_only() returns trigger language plpgsql as $$ begin raise exception 'moderation_actions is append only'; end $$;
create trigger moderation_actions_no_update before update or delete on public.moderation_actions for each row execute function public.audit_is_append_only();
-- Reports use a fixed list of reasons so they can be sorted and counted.
alter table public.post_reports add column if not exists category text not null default 'other' check (category in ('spam','misleading','harassment','hate','impersonation','inappropriate','scam','abuse','other'));
