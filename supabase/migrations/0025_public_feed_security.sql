-- Recreate the public feed so private-circle posts can never leak through the SECURITY DEFINER view from migration 0004.
drop view if exists public.posts_feed;
create view public.posts_feed with (security_invoker = true) as
select p.id, p.match_id, p.parent_id, p.body, p.created_at, pr.username,
       (select count(*) from public.post_likes l where l.post_id = p.id)::int as likes
from public.posts p
join public.profiles pr on pr.id = p.user_id
where p.status = 'visible' and p.circle_id is null and pr.username is not null;
grant select on public.posts_feed to anon, authenticated;
