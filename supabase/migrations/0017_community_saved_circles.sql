-- Community v3: saved matches and private discussion circles.
create table if not exists public.saved_matches (
  user_id uuid not null references auth.users on delete cascade,
  match_id text not null references public.matches(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, match_id)
);
create index if not exists saved_matches_user_created_idx on public.saved_matches(user_id, created_at desc);

create table if not exists public.private_circles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users on delete cascade,
  name text not null check (char_length(name) between 3 and 60),
  description text check (description is null or char_length(description) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists private_circles_owner_idx on public.private_circles(owner_id, created_at desc);

create table if not exists public.private_circle_members (
  circle_id uuid not null references public.private_circles(id) on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);
create index if not exists private_circle_members_user_idx on public.private_circle_members(user_id, joined_at desc);

alter table public.posts add column if not exists circle_id uuid references public.private_circles(id) on delete cascade;
create index if not exists posts_circle_created_idx on public.posts(circle_id, created_at desc);

alter table public.saved_matches enable row level security;
alter table public.private_circles enable row level security;
alter table public.private_circle_members enable row level security;

create policy "own saved matches" on public.saved_matches for select to authenticated using (auth.uid() = user_id);
create policy "read circles as member" on public.private_circles for select to authenticated using (exists (select 1 from public.private_circle_members m where m.circle_id = id and m.user_id = auth.uid()));
create policy "read own circles" on public.private_circles for select to authenticated using (owner_id = auth.uid());
create policy "read own circle membership" on public.private_circle_members for select to authenticated using (user_id = auth.uid());
create policy "read circle posts as member" on public.posts for select to authenticated using (circle_id is not null and exists (select 1 from public.private_circle_members m where m.circle_id = posts.circle_id and m.user_id = auth.uid()) and status = 'visible');

revoke all on public.saved_matches, public.private_circles, public.private_circle_members from anon;
revoke insert, update, delete on public.saved_matches, public.private_circles, public.private_circle_members from authenticated;

create or replace view public.posts_feed as
select p.id, p.match_id, p.parent_id, p.body, p.created_at, pr.username,
  (select count(*) from public.post_likes l where l.post_id = p.id)::int as likes
from public.posts p
join public.profiles pr on pr.id = p.user_id
where p.status = 'visible' and p.circle_id is null and pr.username is not null;

grant select on public.posts_feed to anon, authenticated;
