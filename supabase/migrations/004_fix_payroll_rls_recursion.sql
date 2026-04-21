-- 004_fix_payroll_rls_recursion.sql

create or replace function public.payroll_user_has_item_in_period(p_period_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $func$
  select exists (
    select 1
      from public.payroll_items
     where period_id   = p_period_id
       and employee_id = auth.uid()
  );
$func$;

create or replace function public.payroll_period_is_posted(p_period_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $func$
  select exists (
    select 1
      from public.payroll_periods
     where id     = p_period_id
       and status = 'Posted'
  );
$func$;

grant execute on function public.payroll_user_has_item_in_period(uuid) to authenticated;
grant execute on function public.payroll_period_is_posted(uuid)        to authenticated;


drop policy if exists "payroll_periods self read" on public.payroll_periods;
drop policy if exists "payroll_items self read"   on public.payroll_items;

create policy "payroll_periods self read"
  on public.payroll_periods
  as permissive
  for select
  using (
    status = 'Posted'
    and public.payroll_user_has_item_in_period(id)
  );

create policy "payroll_items self read"
  on public.payroll_items
  as permissive
  for select
  using (
    employee_id = auth.uid()
    and public.payroll_period_is_posted(period_id)
  );

notify pgrst, 'reload schema';

