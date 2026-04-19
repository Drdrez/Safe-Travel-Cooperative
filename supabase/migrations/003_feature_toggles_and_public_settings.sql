-- ============================================================================
-- 003_feature_toggles_and_public_settings.sql
--
-- Delta migration for two things:
--   1. Backfill the new feature-toggle keys into the existing op_prefs row so
--      the admin Settings UI and the customer useOpPrefs() hook see sensible
--      defaults without having to hit the DEFAULT_OP_PREFS client fallback.
--   2. Open `app_settings` SELECT to anonymous visitors so the public landing
--      page's maintenance banner can actually fire for logged-out users.
--      Writes remain admin-only.
--
-- Safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Backfill feature-toggle keys on op_prefs
-- ---------------------------------------------------------------------------
update public.app_settings
set value = coalesce(value, '{}'::jsonb)
  || jsonb_build_object(
       'online_payments_enabled',
         coalesce((value ->> 'online_payments_enabled')::boolean, true),
       'enforce_cancellation_fee',
         coalesce((value ->> 'enforce_cancellation_fee')::boolean, true),
       'accept_member_applications',
         coalesce((value ->> 'accept_member_applications')::boolean, true),
       'accept_loan_applications',
         coalesce((value ->> 'accept_loan_applications')::boolean, true),
       'maintenance_mode',
         coalesce((value ->> 'maintenance_mode')::boolean, false)
     )
where key = 'op_prefs';

-- In case no op_prefs row exists yet, create a fully-populated default row.
insert into public.app_settings (key, value)
select 'op_prefs', jsonb_build_object(
  'currency', 'PHP',
  'tax_rate', 12,
  'buffer_minutes', 60,
  'default_daily_rate', 3500,
  'cancellation_fee_pct', 10,
  'cancellation_window_hours', 2,
  'online_payments_enabled', true,
  'enforce_cancellation_fee', true,
  'accept_member_applications', true,
  'accept_loan_applications', true,
  'maintenance_mode', false
)
where not exists (select 1 from public.app_settings where key = 'op_prefs');

-- ---------------------------------------------------------------------------
-- 2. Allow anon SELECT on app_settings (reads only; writes stay admin-only)
--    This is required for the public landing page to surface the maintenance
--    banner and to use the cooperative name/logo without forcing login.
-- ---------------------------------------------------------------------------
drop policy if exists "app_settings read"      on public.app_settings;
drop policy if exists "app_settings read anon" on public.app_settings;

-- Replace the authenticated-only read policy with one that allows any visitor,
-- logged-in or not, to read settings. The table only holds non-secret
-- cooperative-wide config (branding, operational rules, feature flags).
create policy "app_settings read"
  on public.app_settings for select
  using (true);

-- Writes stay admin-only — policy "app_settings write" created in 001 remains.

notify pgrst, 'reload schema';
