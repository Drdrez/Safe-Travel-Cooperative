-- ============================================================================
-- Customer profile delete: align FKs so admin can remove a customer profile
-- after reservations/billings cascade, without violating reservations_customer_id_fkey.
-- Run in Supabase SQL Editor or via supabase db push.
-- ============================================================================

-- 1) Reservations: when a profile row is removed, remove their reservations.
alter table public.reservations
  drop constraint if exists reservations_customer_id_fkey;

alter table public.reservations
  add constraint reservations_customer_id_fkey
  foreign key (customer_id) references public.profiles(id) on delete cascade;

-- 2) Billings tied to a reservation: when the reservation row is removed, remove the invoice.
-- (Needed after (1), because deleting a profile cascades to reservations first.)
alter table public.billings
  drop constraint if exists billings_reservation_id_fkey;

alter table public.billings
  add constraint billings_reservation_id_fkey
  foreign key (reservation_id) references public.reservations(id) on delete cascade;

-- 3) Billings tied to a customer: when the profile is removed, remove billing rows for that customer.
-- Repoints FK to profiles so CASCADE applies on profile delete (same UUID as auth.users for members).
alter table public.billings
  drop constraint if exists billings_customer_id_fkey;

alter table public.billings
  add constraint billings_customer_id_fkey
  foreign key (customer_id) references public.profiles(id) on delete cascade;
