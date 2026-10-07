-- GoalGrid Phase 9: defence in depth. Row level security stays on; these grants make the database safe even if a policy is ever added by mistake.
-- Likes were readable by anyone with the public key, which exposed who liked what. Counts still come from the posts_feed view.
drop policy if exists "read likes" on public.post_likes;
-- Server only tables: no direct access for the public or signed in roles at all. The service role (our server) is unaffected.
revoke all on public.post_likes, public.post_reports, public.unlock_attempts, public.moderation_actions, public.email_subscribers, public.email_log, public.provider_health, public.ingestion_jobs, public.system_logs, public.provider_entities, public.prediction_snapshots, public.prediction_results from anon, authenticated;
-- Read only for clients: every write goes through our server, which validates it first.
revoke insert, update, delete on public.posts, public.user_predictions, public.user_entitlements, public.leagues, public.teams, public.matches, public.odds_snapshots, public.weather_snapshots, public.news_articles, public.news_match_links from anon, authenticated;
-- Profiles are created by a trigger. Signed in users may read and update only their own row (policies), never create or delete one, and the public role gets nothing.
revoke insert, delete on public.profiles from anon, authenticated; revoke all on public.profiles from anon;
