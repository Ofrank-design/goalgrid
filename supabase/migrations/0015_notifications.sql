-- GoalGrid notification centre: durable in-app notifications plus per-category preferences.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('prediction','match','simulation','challenge','community','follow','like','comment','system','security')),
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 500),
  href text,
  actor_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);
create index if not exists notifications_user_unread_idx on public.notifications(user_id, read_at, created_at desc);

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  in_app boolean not null default true,
  email boolean not null default false,
  push boolean not null default false,
  prediction boolean not null default true,
  match boolean not null default true,
  simulation boolean not null default true,
  challenge boolean not null default true,
  community boolean not null default true,
  follow boolean not null default true,
  "like" boolean not null default true,
  comment boolean not null default true,
  system boolean not null default true,
  security boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
create policy "read own notifications" on public.notifications for select to authenticated using (auth.uid() = user_id);
create policy "update own notification read state" on public.notifications for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "read own notification preferences" on public.notification_preferences for select to authenticated using (auth.uid() = user_id);
create policy "insert own notification preferences" on public.notification_preferences for insert to authenticated with check (auth.uid() = user_id);
create policy "update own notification preferences" on public.notification_preferences for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
revoke all on public.notifications from anon;
revoke insert, delete on public.notifications from authenticated;
revoke all on public.notification_preferences from anon;

create or replace function public.touch_notification_preferences() returns trigger
language plpgsql security invoker set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists notification_preferences_touch on public.notification_preferences;
create trigger notification_preferences_touch before update on public.notification_preferences for each row execute function public.touch_notification_preferences();
