-- 009_is_customer_portal_locked.sql

create or replace function public.is_customer_portal_locked()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and deactivated_at is not null
  );
$$;

grant execute on function public.is_customer_portal_locked() to authenticated;

comment on function public.is_customer_portal_locked() is
  'True when the signed-in user''s profile has deactivated_at set (customer self-deactivation).';

