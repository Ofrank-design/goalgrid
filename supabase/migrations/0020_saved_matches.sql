-- Saved match retention metadata.
alter table public.saved_matches add column if not exists match_date date;
create index if not exists saved_matches_user_date_idx on public.saved_matches(user_id, match_date, created_at desc);
