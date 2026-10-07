-- Community v2: roles and account status, booking-code shares, follows, blocks, mutes, trophies, moderation audit.
-- Every write goes through the server (service role). Clients can read only what the policies and views expose.
alter table public.profiles add column role text not null default 'user' check (role in ('user','moderator','admin')),
  add column account_status text not null default 'active' check (account_status in ('active','warned','suspended','banned')),
  add column suspended_until timestamptz, add column bio text check (bio is null or char_length(bio) <= 160);
-- A signed in user can edit their own row, but never role, status or suspension.
create function public.protect_profile_fields() returns trigger language plpgsql as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and (new.role is distinct from old.role or new.account_status is distinct from old.account_status or new.suspended_until is distinct from old.suspended_until) then
    raise exception 'role and account status can only be changed by staff actions'; end if;
  return new;
end $$;
create trigger profiles_protect_fields before update on public.profiles for each row execute function public.protect_profile_fields();

create table public.community_booking_posts (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
  booking_code text not null check (char_length(booking_code) between 3 and 100), bookmaker text check (bookmaker is null or char_length(bookmaker) between 2 and 40), match_id text, odds numeric(7,2) check (odds is null or (odds >= 1.01 and odds <= 10000)),
  note text check (note is null or char_length(note) <= 300), proof_path text,
  verification_status text not null default 'unverified' check (verification_status in ('unverified','pending_review','verified','rejected','expired')), verified_at timestamptz, verified_by uuid references auth.users,
  moderation_status text not null default 'active' check (moderation_status in ('active','hidden','removed','under_review')), moderation_reason text,
  visibility text not null default 'public' check (visibility in ('public','followers','private')), created_at timestamptz not null default now());
create unique index booking_no_duplicates on public.community_booking_posts (user_id, lower(booking_code), coalesce(lower(bookmaker), ''));
create index on public.community_booking_posts (created_at desc); create index on public.community_booking_posts (user_id, created_at desc);
create table public.community_booking_comments (id uuid primary key default gen_random_uuid(), post_id uuid not null references public.community_booking_posts(id) on delete cascade, user_id uuid not null references auth.users on delete cascade,
  body text not null check (char_length(body) between 1 and 300), status text not null default 'visible' check (status in ('visible','hidden','removed')), created_at timestamptz not null default now());
create table public.community_booking_likes (post_id uuid not null references public.community_booking_posts(id) on delete cascade, user_id uuid not null references auth.users on delete cascade, primary key (post_id, user_id));
create table public.community_booking_reports (post_id uuid not null references public.community_booking_posts(id) on delete cascade, reporter_id uuid not null references auth.users on delete cascade,
  category text not null check (category in ('spam','misleading','harassment','hate','impersonation','inappropriate','scam','abuse','other')), reason text check (reason is null or char_length(reason) <= 200), created_at timestamptz not null default now(), primary key (post_id, reporter_id));
create table public.booking_verification_audits (id bigserial primary key, post_id uuid references public.community_booking_posts(id) on delete set null, actor_id uuid references auth.users, prior_state text not null, new_state text not null, reason text, created_at timestamptz not null default now());

create table public.follows (follower_id uuid not null references auth.users on delete cascade, followee_id uuid not null references auth.users on delete cascade, created_at timestamptz not null default now(), primary key (follower_id, followee_id), check (follower_id <> followee_id));
create table public.blocks (blocker_id uuid not null references auth.users on delete cascade, blocked_id uuid not null references auth.users on delete cascade, created_at timestamptz not null default now(), primary key (blocker_id, blocked_id), check (blocker_id <> blocked_id));
create table public.mutes (muter_id uuid not null references auth.users on delete cascade, muted_id uuid not null references auth.users on delete cascade, created_at timestamptz not null default now(), primary key (muter_id, muted_id), check (muter_id <> muted_id));

create table public.trophies (code text primary key, name text not null, description text not null, sort int not null default 0);
create table public.user_trophies (user_id uuid not null references auth.users on delete cascade, code text not null references public.trophies(code), awarded_at timestamptz not null default now(), primary key (user_id, code));
create table public.trophy_award_audits (id bigserial primary key, user_id uuid not null, code text not null, basis jsonb not null, created_at timestamptz not null default now());
insert into public.trophies (code, name, description, sort) values
 ('first-kick','First Kick','Submitted a first GoalGrid prediction',1),('ten-match-analyst','Ten Match Analyst','Reached 10 evaluated predictions',2),('form-finder','Form Finder','60% accuracy across at least 20 evaluated predictions',3),
 ('three-streak','Three Match Streak','Three correct predictions in a row',4),('five-streak','Five Match Streak','Five correct predictions in a row',5),('exact-eye','Exact Eye','Three exact scores',6),
 ('community-scout','Community Scout','Five active community posts',7),('matchday-voice','Matchday Voice','20 likes on active posts',8),('top-table','Top Table','Top 10 in a verified leaderboard period',9);

-- Moderation: more actions, and who the action targeted. Rows stay append only (trigger from migration 0007).
alter table public.moderation_actions drop constraint if exists moderation_actions_action_check;
alter table public.moderation_actions add column if not exists actor_id uuid, add column if not exists target_type text, add column if not exists target_id text, add column if not exists target_user_id uuid;
alter table public.moderation_actions alter column admin_email drop not null;
alter table public.moderation_actions add constraint moderation_actions_action_check check (action in ('restore','remove','hide','warn','suspend','ban','unban','review','verify','reject'));
create table public.moderation_notes (id bigserial primary key, target_type text not null, target_id text not null, author_id uuid not null, note text not null check (char_length(note) <= 1000), created_at timestamptz not null default now());

-- Public views: usernames and counts only, never user ids, proof paths or internal state.
create view public.booking_posts_feed as select b.id, b.booking_code, b.bookmaker, b.match_id, b.odds, b.note, (b.proof_path is not null) as has_proof, b.verification_status, b.created_at, pr.username,
  (select count(*) from public.community_booking_likes l where l.post_id = b.id)::int as likes, (select count(*) from public.community_booking_comments c where c.post_id = b.id and c.status = 'visible')::int as comments
  from public.community_booking_posts b join public.profiles pr on pr.id = b.user_id where b.moderation_status = 'active' and b.visibility = 'public' and pr.username is not null and pr.account_status <> 'banned';
create view public.trophies_public as select pr.username, t.code, t.name, t.description, ut.awarded_at from public.user_trophies ut join public.trophies t on t.code = ut.code join public.profiles pr on pr.id = ut.user_id where pr.username is not null and pr.account_status <> 'banned';
grant select on public.booking_posts_feed, public.trophies_public to anon, authenticated;

alter table public.community_booking_posts enable row level security; alter table public.community_booking_comments enable row level security; alter table public.community_booking_likes enable row level security; alter table public.community_booking_reports enable row level security;
alter table public.booking_verification_audits enable row level security; alter table public.follows enable row level security; alter table public.blocks enable row level security; alter table public.mutes enable row level security;
alter table public.trophies enable row level security; alter table public.user_trophies enable row level security; alter table public.trophy_award_audits enable row level security; alter table public.moderation_notes enable row level security;
create policy "own booking posts" on public.community_booking_posts for select to authenticated using (auth.uid() = user_id);
create policy "own follows" on public.follows for select to authenticated using (auth.uid() = follower_id);
create policy "own blocks" on public.blocks for select to authenticated using (auth.uid() = blocker_id);
create policy "own mutes" on public.mutes for select to authenticated using (auth.uid() = muter_id);
create policy "trophy list" on public.trophies for select using (true);
revoke all on public.community_booking_posts, public.community_booking_comments, public.community_booking_likes, public.community_booking_reports, public.booking_verification_audits, public.follows, public.blocks, public.mutes, public.user_trophies, public.trophy_award_audits, public.moderation_notes from anon;
revoke insert, update, delete on public.community_booking_posts, public.community_booking_comments, public.community_booking_likes, public.community_booking_reports, public.booking_verification_audits, public.follows, public.blocks, public.mutes, public.trophies, public.user_trophies, public.trophy_award_audits, public.moderation_notes from authenticated;
revoke all on public.community_booking_comments, public.community_booking_likes, public.community_booking_reports, public.booking_verification_audits, public.user_trophies, public.trophy_award_audits, public.moderation_notes from authenticated;
create trigger audits_no_change before update or delete on public.booking_verification_audits for each row execute function public.audit_is_append_only();
create trigger trophy_audits_no_change before update or delete on public.trophy_award_audits for each row execute function public.audit_is_append_only();
-- Proof images live in a private bucket and are shown only through short lived signed links created on the server.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('proofs', 'proofs', false, 1000000, array['image/jpeg','image/png','image/webp']) on conflict (id) do nothing;
