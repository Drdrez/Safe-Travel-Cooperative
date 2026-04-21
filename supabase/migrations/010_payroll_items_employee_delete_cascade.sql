-- 010_payroll_items_employee_delete_cascade.sql

alter table public.payroll_items
  drop constraint if exists payroll_items_employee_id_fkey;

alter table public.payroll_items
  add constraint payroll_items_employee_id_fkey
  foreign key (employee_id) references public.profiles(id) on delete cascade;

