-- Notification hardening: durable delivery bookkeeping and security notification immutability.
alter table public.notifications add column if not exists delivered_at timestamptz;
alter table public.notifications add column if not exists delivery_attempts int not null default 0;
alter table public.notifications add column if not exists last_delivery_error text;
alter table public.notifications add column if not exists dedupe_key text;
create unique index if not exists notifications_dedupe_idx on public.notifications(user_id, dedupe_key) where dedupe_key is not null;
create index if not exists notifications_delivery_idx on public.notifications(delivered_at, created_at) where delivered_at is null;

create or replace function public.protect_security_notification() returns trigger
language plpgsql as $$
begin
  if old.type = 'security' and (new.type is distinct from old.type or new.user_id is distinct from old.user_id or new.title is distinct from old.title or new.body is distinct from old.body or new.metadata is distinct from old.metadata) then
    raise exception 'security notification content is immutable';
  end if;
  return new;
end; $$;
drop trigger if exists notification_security_protect on public.notifications;
create trigger notification_security_protect before update on public.notifications for each row execute function public.protect_security_notification();
