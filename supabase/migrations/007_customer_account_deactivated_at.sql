-- 007_customer_account_deactivated_at.sql

alter table public.profiles
  add column if not exists deactivated_at timestamptz;

comment on column public.profiles.deactivated_at is
  'When set, customer portal login is refused until cleared by the member (e.g. via cooperative support).';

create index if not exists profiles_deactivated_at_idx
  on public.profiles (deactivated_at)
  where deactivated_at is not null;

