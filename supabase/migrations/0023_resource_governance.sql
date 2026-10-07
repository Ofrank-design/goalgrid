-- GoalGrid resource governance: DB-backed per-user simulation concurrency slots and centralized model caps.
create table if not exists public.simulation_slots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('match','multi','season','experiment')),
  acquired_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists simulation_slots_user_idx on public.simulation_slots(user_id, expires_at);

drop function if exists public.try_acquire_simulation_slot(uuid,int,int);
create function public.try_acquire_simulation_slot(p_user_id uuid, p_kind text, p_max_slots int, p_ttl_seconds int)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_slot uuid;
begin
  if p_max_slots < 1 or p_ttl_seconds < 1 then return null; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  delete from public.simulation_slots where expires_at <= now();
  select count(*) into v_count from public.simulation_slots where user_id = p_user_id and expires_at > now();
  if v_count >= p_max_slots then return null; end if;
  insert into public.simulation_slots(user_id, kind, expires_at)
  values (p_user_id, p_kind, now() + make_interval(secs => p_ttl_seconds))
  returning id into v_slot;
  return v_slot;
end;
$$;

create or replace function public.release_simulation_slot(p_slot_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_deleted int;
begin
  delete from public.simulation_slots where id = p_slot_id;
  get diagnostics v_deleted = row_count;
  return v_deleted = 1;
end;
$$;
revoke all on function public.try_acquire_simulation_slot(uuid,text,int,int) from anon, authenticated, public;
revoke all on function public.release_simulation_slot(uuid) from anon, authenticated, public;

insert into public.resource_limits(key,max_value,window_seconds,scope,note) values
 ('model.candidate_max',30,null,'global','Maximum model candidates executed per ensemble build.'),
 ('model.active_max',15,null,'global','Maximum active models contributing to one prediction.'),
 ('simulation.concurrent_per_user',2,null,'user','Maximum concurrently running simulation requests per user.')
on conflict (key) do update set max_value=excluded.max_value,note=excluded.note,updated_at=now();
