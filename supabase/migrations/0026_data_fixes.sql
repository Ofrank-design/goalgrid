-- Fixes found by applying the migrations to a real Postgres and exercising them as the anon and authenticated roles.

-- 1. Public feed. Migration 0025 recreated posts_feed with security_invoker = true, so the view ran with the caller's rights.
--    profiles is revoked from anon and only readable by its owner, and post_likes has no read policy (0006), so the feed was
--    empty or erroring for everyone. The view runs with its owner's rights again. Private circle posts stay out because the
--    view filters on circle_id is null (0017), and it exposes only username and aggregates, never user ids or emails.
--    security_barrier stops filters pushed in through the API from being evaluated before the view's own conditions.
drop view if exists public.posts_feed;
create view public.posts_feed with (security_invoker = false, security_barrier = true) as
select p.id, p.match_id, p.parent_id, p.body, p.created_at, pr.username,
       (select count(*) from public.post_likes l where l.post_id = p.id)::int as likes
from public.posts p
join public.profiles pr on pr.id = p.user_id
where p.status = 'visible' and p.circle_id is null and pr.username is not null;
grant select on public.posts_feed to anon, authenticated;

-- 2. Notification de-duplication. ON CONFLICT (user_id, dedupe_key) cannot use a partial index, so every de-duplicated insert
--    failed. A plain unique index gives the same guarantee: NULL keys are never equal, so notifications without a key are unaffected.
drop index if exists public.notifications_dedupe_idx;
create unique index notifications_dedupe_idx on public.notifications(user_id, dedupe_key);

-- 3. Simulation concurrency slots were the one table without row level security or revokes. With the public key anyone could
--    read, insert or delete slots, including filling another user's slots. Only the SECURITY DEFINER functions and the service role use it.
alter table public.simulation_slots enable row level security;
revoke all on public.simulation_slots from anon, authenticated;

-- 4. Defence in depth. Supabase grants every new table to anon and authenticated by default, and later migrations did not revoke
--    those grants, so only RLS stood between the public key and writes. All writes go through the server's service role, and the
--    only direct client writes are the own-row policies on profiles, user_preferences, notification_preferences and notifications.
--    Anonymous visitors never write, and nobody writes through the read-only views.
revoke insert, update, delete, truncate, references, trigger on all tables in schema public from anon;
revoke insert, update, delete, truncate, references, trigger on public.posts_feed, public.booking_posts_feed, public.leaderboard_all,
  public.leaderboard_week, public.prediction_eval, public.trophies_public from authenticated;
