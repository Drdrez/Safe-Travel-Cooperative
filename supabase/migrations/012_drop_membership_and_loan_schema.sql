-- Drop cooperative membership + loan modules (tables, triggers, notification helpers).
-- Tables are dropped in FK order; publication membership is removed automatically when a table is dropped.

drop table if exists public.loan_payments        cascade;
drop table if exists public.loan_requests        cascade;
drop table if exists public.member_contributions cascade;
drop table if exists public.cooperative_members  cascade;

-- Loan / member–specific trigger functions (no longer referenced).
drop function if exists public.assign_member_number() cascade;
drop function if exists public.assign_loan_number() cascade;
drop function if exists public.on_loan_disbursed() cascade;
drop function if exists public.apply_loan_payment() cascade;
drop function if exists public.emit_loan_decision_notification() cascade;
drop function if exists public.emit_loan_request_admin_notification() cascade;
drop function if exists public.audit_loan_change() cascade;

-- Remove stale in-app notifications tied to removed flows.
delete from public.notifications
where kind in (
  'admin.loan.new',
  'loan.approved',
  'loan.rejected',
  'loan.disbursed',
  'loan.closed'
)
or kind like 'loan.%';

-- Strip obsolete keys from operational preferences JSON.
update public.app_settings
set value = coalesce(value, '{}'::jsonb) - 'accept_member_applications' - 'accept_loan_applications'
where key = 'op_prefs';

notify pgrst, 'reload schema';
