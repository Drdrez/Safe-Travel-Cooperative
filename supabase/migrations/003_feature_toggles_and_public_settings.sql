-- 003_feature_toggles_and_public_settings.sql

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

drop policy if exists "app_settings read"      on public.app_settings;
drop policy if exists "app_settings read anon" on public.app_settings;

create policy "app_settings read"
  on public.app_settings for select
  using (true);


notify pgrst, 'reload schema';

