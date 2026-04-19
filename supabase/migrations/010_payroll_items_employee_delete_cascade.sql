-- ============================================================================
-- Auth user delete can fail after profiles CASCADE: payroll_items.employee_id
-- referenced public.profiles(id) ON DELETE RESTRICT, blocking profile removal.
-- Cascading payroll line items when the employee profile row is removed matches
-- "remove this person" deletes (adjust if you must retain payroll for legal holds).
-- ============================================================================

alter table public.payroll_items
  drop constraint if exists payroll_items_employee_id_fkey;

alter table public.payroll_items
  add constraint payroll_items_employee_id_fkey
  foreign key (employee_id) references public.profiles(id) on delete cascade;
