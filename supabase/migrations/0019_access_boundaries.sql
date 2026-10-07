-- Public feed vs private-circle post access boundary.
drop policy if exists "read visible posts" on public.posts;
create policy "read public visible posts" on public.posts for select to anon, authenticated using (status = 'visible' and circle_id is null);
create policy "read member circle posts" on public.posts for select to authenticated using (status = 'visible' and circle_id is not null and exists (select 1 from public.private_circle_members m where m.circle_id=public.posts.circle_id and m.user_id=auth.uid()));
