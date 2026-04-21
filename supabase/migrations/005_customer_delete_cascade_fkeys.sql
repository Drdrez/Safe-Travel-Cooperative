-- 005_customer_delete_cascade_fkeys.sql

alter table public.reservations
  drop constraint if exists reservations_customer_id_fkey;

alter table public.reservations
  add constraint reservations_customer_id_fkey
  foreign key (customer_id) references public.profiles(id) on delete cascade;

alter table public.billings
  drop constraint if exists billings_reservation_id_fkey;

alter table public.billings
  add constraint billings_reservation_id_fkey
  foreign key (reservation_id) references public.reservations(id) on delete cascade;

alter table public.billings
  drop constraint if exists billings_customer_id_fkey;

alter table public.billings
  add constraint billings_customer_id_fkey
  foreign key (customer_id) references public.profiles(id) on delete cascade;

