-- Model comparison fits a full ensemble, so it now takes a concurrency slot like the other heavy simulation tools.
alter table public.simulation_slots drop constraint if exists simulation_slots_kind_check;
alter table public.simulation_slots add constraint simulation_slots_kind_check check (kind in ('match','multi','season','experiment','compare'));
