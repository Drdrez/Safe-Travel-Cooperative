-- Rich repair records: what failed, who pays, who fixed, work summary (for ops / demos / audits).

alter table public.maintenance_records
  add column if not exists issue_description text,
  add column if not exists cost_responsibility text,
  add column if not exists repaired_by text,
  add column if not exists work_completed_summary text;

alter table public.maintenance_records
  drop constraint if exists maintenance_records_cost_resp_check;

alter table public.maintenance_records
  add constraint maintenance_records_cost_resp_check
  check (
    cost_responsibility is null
    or cost_responsibility in (
      'Cooperative', 'Customer', 'Insurance', 'Warranty', 'Split', 'TBD'
    )
  );

comment on column public.maintenance_records.issue_description is 'What is wrong / damage (reported when repair starts).';
comment on column public.maintenance_records.cost_responsibility is 'Who bears cost: Cooperative, Customer, Insurance, etc.';
comment on column public.maintenance_records.repaired_by is 'Shop, mechanic, or internal person who performed the fix.';
comment on column public.maintenance_records.work_completed_summary is 'What was done to return the unit to service.';

notify pgrst, 'reload schema';
