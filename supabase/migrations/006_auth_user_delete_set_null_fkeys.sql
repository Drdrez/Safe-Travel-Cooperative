-- ============================================================================
-- Supabase Dashboard: "Failed to delete selected users: Database error deleting user"
--
-- Deleting an auth user removes the row in auth.users. Any public table with
-- FK -> auth.users(id) and default NO ACTION will block the delete if rows
-- still reference that UUID. Nullable "who did this" columns should use
-- ON DELETE SET NULL so historical rows stay but the user id is cleared.
--
-- notifications.user_id already uses ON DELETE CASCADE in 001 — not listed here.
-- Run in Supabase SQL Editor after earlier migrations.
-- ============================================================================

-- audit_log: keep rows, drop actor link when user is removed
alter table public.audit_log
  drop constraint if exists audit_log_actor_id_fkey;
alter table public.audit_log
  add constraint audit_log_actor_id_fkey
  foreign key (actor_id) references auth.users(id) on delete set null;

-- app_settings
alter table public.app_settings
  drop constraint if exists app_settings_updated_by_fkey;
alter table public.app_settings
  add constraint app_settings_updated_by_fkey
  foreign key (updated_by) references auth.users(id) on delete set null;

-- billings
alter table public.billings
  drop constraint if exists billings_confirmed_by_fkey;
alter table public.billings
  add constraint billings_confirmed_by_fkey
  foreign key (confirmed_by) references auth.users(id) on delete set null;

-- support_tickets (replied_by only; customer_id -> profiles is separate)
alter table public.support_tickets
  drop constraint if exists support_tickets_replied_by_fkey;
alter table public.support_tickets
  add constraint support_tickets_replied_by_fkey
  foreign key (replied_by) references auth.users(id) on delete set null;

-- payroll / loans / maintenance (002)
alter table public.payroll_periods
  drop constraint if exists payroll_periods_posted_by_fkey;
alter table public.payroll_periods
  add constraint payroll_periods_posted_by_fkey
  foreign key (posted_by) references auth.users(id) on delete set null;

alter table public.member_contributions
  drop constraint if exists member_contributions_recorded_by_fkey;
alter table public.member_contributions
  add constraint member_contributions_recorded_by_fkey
  foreign key (recorded_by) references auth.users(id) on delete set null;

alter table public.loan_requests
  drop constraint if exists loan_requests_decided_by_fkey;
alter table public.loan_requests
  add constraint loan_requests_decided_by_fkey
  foreign key (decided_by) references auth.users(id) on delete set null;

alter table public.loan_payments
  drop constraint if exists loan_payments_recorded_by_fkey;
alter table public.loan_payments
  add constraint loan_payments_recorded_by_fkey
  foreign key (recorded_by) references auth.users(id) on delete set null;

alter table public.maintenance_records
  drop constraint if exists maintenance_records_created_by_fkey;
alter table public.maintenance_records
  add constraint maintenance_records_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;
