-- ============================================================================
-- 004_fix_payroll_rls_recursion.sql
--
-- Fixes: "infinite recursion detected in policy for relation payroll_periods"
--        "infinite recursion detected in policy for relation payroll_items"
--
-- Cause: the two "self read" policies referenced each other:
--   payroll_periods.self_read  -> checked payroll_items
--   payroll_items.self_read    -> checked payroll_periods
-- Postgres evaluates policies recursively, so the moment an employee reads
-- either table, RLS loops.
--
-- Fix: replace cross-table EXISTS subqueries with SECURITY DEFINER helper
-- functions that internally bypass RLS (their owner is the superuser and
-- they mark the relation as safe). The policies then only look at their own
-- table's columns plus the helper's boolean result.
--
-- Safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Helper functions. STABLE + SECURITY DEFINER so they:
--    - execute as the function owner (bypassing RLS on the queried table)
--    - are cacheable within a single query
-- ---------------------------------------------------------------------------

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

-- Both helpers should be callable by any authenticated user. They do NOT
-- expose data directly; they only return a boolean.
grant execute on function public.payroll_user_has_item_in_period(uuid) to authenticated;
grant execute on function public.payroll_period_is_posted(uuid)        to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Rebuild the recursive policies using the helpers.
-- ---------------------------------------------------------------------------

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
