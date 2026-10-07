-- Pro and Premium are free for everyone with an account. The row level security policies on simulation runs, shares, analysis runs,
-- lab notes and the game tables call these two functions, so redefining them opens those tables to every signed-in user without touching
-- each policy. Anonymous visitors still get nothing: execute stays revoked from anon, and auth.uid() is null for them.
-- user_entitlements and unlock_attempts are left in place (history, and nothing reads them any more).
create or replace function public.is_pro() returns boolean language sql stable security definer set search_path = public as $$ select auth.uid() is not null $$;
create or replace function public.is_premium() returns boolean language sql stable security definer set search_path = public as $$ select auth.uid() is not null $$;
