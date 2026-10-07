-- Security assertions. Any failure raises an exception and stops the run (ON_ERROR_STOP).
create schema if not exists t;
create or replace function t.ok(cond boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAILED: %', msg; end if; end $$;
-- Passes only when the statement is rejected with insufficient_privilege (also what a row level security violation raises).
create or replace function t.denied(stmt text, msg text) returns void language plpgsql as $$
begin
  begin execute stmt; exception when insufficient_privilege then return; end;
  raise exception 'FAILED (statement was allowed): %', msg;
end $$;
grant usage on schema t to public;

-- Seed (as the superuser running this script).
insert into auth.users(id,email) values ('11111111-1111-1111-1111-111111111111','a@example.com'),('22222222-2222-2222-2222-222222222222','b@example.com');
update public.profiles set username='alice' where id='11111111-1111-1111-1111-111111111111';
update public.profiles set username='bob' where id='22222222-2222-2222-2222-222222222222';
insert into public.posts(id,user_id,body) values ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Arsenal look strong, 100% sure'),
  ('aaaaaaaa-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222','plain post');
insert into public.private_circles(id,owner_id,name) values ('cccccccc-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Secret');
insert into public.posts(id,user_id,body,circle_id) values ('aaaaaaaa-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','PRIVATE circle post','cccccccc-0000-0000-0000-000000000001');
insert into public.post_likes values ('aaaaaaaa-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222');

-- Schema-wide guards: these fail the build when a future migration forgets RLS or leaves default grants in place.
select t.ok(not exists (select 1 from pg_tables where schemaname = 'public' and not rowsecurity),
  'every public table has row level security: ' || coalesce((select string_agg(tablename, ', ') from pg_tables where schemaname = 'public' and not rowsecurity), ''));
select t.ok(not exists (select 1 from information_schema.role_table_grants where grantee in ('anon','authenticated') and table_schema = 'public'
  and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE')),
  'anon and authenticated hold no write grants on public tables or views: ' || coalesce((select string_agg(distinct table_name, ', ') from information_schema.role_table_grants where grantee in ('anon','authenticated') and table_schema = 'public' and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE')), ''));
-- A table created after the migrations (as a later migration would) must not get write grants by default.
create table public._grant_probe (id int);
select t.ok(not has_table_privilege('anon', 'public._grant_probe', 'INSERT, UPDATE, DELETE') and not has_table_privilege('authenticated', 'public._grant_probe', 'INSERT, UPDATE, DELETE'),
  'new tables do not inherit write grants for anon or authenticated');
drop table public._grant_probe;

-- Free for everyone: any signed-in user passes is_pro() and is_premium(), whatever their old entitlement row says; anonymous visitors do not.
-- Both users hold only the default 'free' entitlement created at sign-up.
select t.ok((select count(*) from public.user_entitlements where tier = 'free') = 2, 'test users hold only the free entitlement');
insert into public.simulation_runs(user_id, kind, league_slug, configuration, seed, engine_version, model_version, result)
  values ('22222222-2222-2222-2222-222222222222', 'match', 'premier-league', '{}', 'abc', 'e', 'm', '{}');

-- Public feed: visible to everyone, never includes private circle posts.
set role anon;
select t.ok((select count(*) from public.posts_feed) = 2, 'anon sees the two public posts in the feed');
select t.ok((select likes from public.posts_feed where username = 'alice') = 1, 'feed like counts work for anon');
select t.ok(not exists (select 1 from public.posts_feed where body like 'PRIVATE%'), 'private circle posts never appear in the feed');
select t.denied('select * from public.profiles', 'anon cannot read profiles');
select t.denied('select * from public.post_likes', 'anon cannot read who liked what');
select t.denied('select * from public.simulation_slots', 'anon cannot read simulation slots');
select t.denied('select * from public.notifications', 'anon cannot read notifications');
select t.denied($$insert into public.simulation_slots(user_id,kind,expires_at) values ('11111111-1111-1111-1111-111111111111','match', now() + interval '1 hour')$$, 'anon cannot fill slots');
select t.denied($$select public.take_rate_limit('x', 1, 1)$$, 'anon cannot call take_rate_limit');
select t.denied('select public.is_pro()', 'anon cannot call is_pro');
select t.denied('select public.is_premium()', 'anon cannot call is_premium');
select t.denied('select * from public.simulation_runs', 'anon cannot read simulation runs');
select t.denied($$select public.try_acquire_simulation_slot('11111111-1111-1111-1111-111111111111','match',2,60)$$, 'anon cannot acquire slots');
select t.denied('select * from public.engine_cache', 'anon cannot read the engine cache');
select t.denied('select * from public.rate_events', 'anon cannot read rate limit events');
reset role;

-- Signed-in users: reads follow the policies, writes are not possible from the client at all.
set role authenticated; set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select t.ok((select count(*) from public.posts_feed) = 2, 'signed-in user sees the same public feed');
select t.ok(public.is_pro() and public.is_premium(), 'every signed-in user has Pro and Premium access');
select t.ok((select count(*) from public.simulation_runs) = 1, 'a free-entitlement user reads their own simulation runs');
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select t.ok((select count(*) from public.simulation_runs) = 0, 'and other users still cannot read them');
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select t.denied($$update public.profiles set username = 'hacked' where id = '11111111-1111-1111-1111-111111111111'$$, 'clients cannot update profiles');
select t.denied($$insert into public.notification_preferences(user_id) values ('22222222-2222-2222-2222-222222222222')$$, 'clients cannot write notification preferences');
select t.denied('select * from public.engine_cache', 'signed-in users cannot read the engine cache');
select t.denied($$delete from public.posts where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$, 'clients cannot delete posts');
reset role;

-- Service role (the server): de-duplicated notifications and slot limits.
set role service_role;
insert into public.notifications(user_id,type,title,body,dedupe_key) values ('11111111-1111-1111-1111-111111111111','system','t','b','k1') on conflict (user_id,dedupe_key) do nothing;
insert into public.notifications(user_id,type,title,body,dedupe_key) values ('11111111-1111-1111-1111-111111111111','system','t','b','k1') on conflict (user_id,dedupe_key) do nothing;
insert into public.notifications(user_id,type,title,body) values ('11111111-1111-1111-1111-111111111111','system','t','b'),('11111111-1111-1111-1111-111111111111','system','t','b');
select t.ok((select count(*) from public.notifications where dedupe_key = 'k1') = 1, 'the same dedupe key creates one notification');
select t.ok((select count(*) from public.notifications where dedupe_key is null) = 2, 'notifications without a key are never merged');
select t.ok(public.try_acquire_simulation_slot('11111111-1111-1111-1111-111111111111','match',2,60) is not null, 'first slot is granted');
select t.ok(public.try_acquire_simulation_slot('11111111-1111-1111-1111-111111111111','match',2,60) is not null, 'second slot is granted');
select t.ok(public.try_acquire_simulation_slot('11111111-1111-1111-1111-111111111111','match',2,60) is null, 'third slot is refused at the limit');
insert into public.engine_cache(key, payload, engine_version) values ('prediction:m1', '{"ok":true}', 'v1') on conflict (key) do update set payload = excluded.payload;
select t.ok((select payload->>'ok' from public.engine_cache where key = 'prediction:m1') = 'true', 'service role stores and reads engine cache rows');
select t.ok(public.try_acquire_simulation_slot('22222222-2222-2222-2222-222222222222','compare',2,60) is not null, 'compare is an accepted slot kind');
select t.ok((select count(*) from public.take_rate_limit('ip:search:abc', 2, 60) where allowed) = 1, 'ip style keys work with the shared limiter');
select t.ok((select allowed from public.take_rate_limit('probe', 1, 60)), 'first rate limit hit is allowed');
select t.ok(not (select allowed from public.take_rate_limit('probe', 1, 60)), 'second hit inside the window is refused');
reset role;
-- An unknown slot kind is still rejected by the table constraint.
set role service_role;
do $$ begin
  begin perform public.try_acquire_simulation_slot('22222222-2222-2222-2222-222222222222','bogus',2,60); raise exception 'FAILED: bogus slot kind accepted';
  exception when check_violation then null; end;
end $$;
reset role;
\echo security assertions passed
