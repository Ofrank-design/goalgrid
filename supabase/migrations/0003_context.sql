-- GoalGrid Phase 3: market, weather and news snapshots. Server-written, public read.
create table public.odds_snapshots (id bigserial primary key, match_id text not null references public.matches(id) on delete cascade, bookmakers int not null, implied_home numeric(5,4) not null, implied_draw numeric(5,4) not null, implied_away numeric(5,4) not null, best_home numeric(6,2), best_draw numeric(6,2), best_away numeric(6,2), overround numeric(5,4), over25 numeric(5,4), under25 numeric(5,4), source text not null, retrieved_at timestamptz not null, expires_at timestamptz not null);
create table public.weather_snapshots (id bigserial primary key, match_id text not null references public.matches(id) on delete cascade, temp_c numeric(4,1) not null, humidity_pct int, wind_kmh numeric(5,1), rain_chance_pct int, forecast_for_utc timestamptz not null, source text not null, retrieved_at timestamptz not null, expires_at timestamptz not null);
create table public.news_articles (id text primary key, title text not null, source text not null, url text not null unique, published_at timestamptz, snippet text, retrieved_at timestamptz not null default now());
create table public.news_match_links (match_id text not null references public.matches(id) on delete cascade, article_id text not null references public.news_articles(id) on delete cascade, primary key (match_id, article_id));
create index on public.odds_snapshots (match_id, retrieved_at desc);
create index on public.weather_snapshots (match_id, retrieved_at desc);
alter table public.odds_snapshots enable row level security; alter table public.weather_snapshots enable row level security; alter table public.news_articles enable row level security; alter table public.news_match_links enable row level security;
create policy "public read odds" on public.odds_snapshots for select using (true);
create policy "public read weather" on public.weather_snapshots for select using (true);
create policy "public read news" on public.news_articles for select using (true);
create policy "public read news links" on public.news_match_links for select using (true);
