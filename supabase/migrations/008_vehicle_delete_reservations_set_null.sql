-- ============================================================================
-- Admin cannot delete a vehicle while reservations still reference it:
--   update or delete on "vehicles" violates FK "reservations_vehicle_id_fkey"
--
-- Keep reservation rows for history; when a vehicle row is removed, clear the link.
-- ============================================================================

alter table public.reservations
  alter column vehicle_id drop not null;

alter table public.reservations
  drop constraint if exists reservations_vehicle_id_fkey;

alter table public.reservations
  add constraint reservations_vehicle_id_fkey
  foreign key (vehicle_id) references public.vehicles(id) on delete set null;
