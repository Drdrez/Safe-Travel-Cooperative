-- Incident reports: comprehensive operational / safety / service incident logging.
-- Categories cover collisions, mechanical, people, security, property, ops, environment, compliance, and other.

create or replace function public.is_operations_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'dispatcher')
  );
$$;

grant execute on function public.is_operations_staff() to anon, authenticated;

create sequence if not exists public.incident_report_number_seq;

create table if not exists public.incident_reports (
  id                      uuid primary key default uuid_generate_v4(),
  report_number           text unique,
  reporter_id             uuid not null references public.profiles(id) on delete cascade,
  occurred_at             timestamptz not null default now(),

  category                text not null,
  subcategory_detail      text,

  severity                text not null default 'Minor',
  status                  text not null default 'Submitted',
  trip_phase              text,

  title                   text not null,
  description             text not null,

  location_description    text,
  latitude                double precision,
  longitude               double precision,

  reservation_id          uuid references public.reservations(id) on delete set null,
  vehicle_id              uuid references public.vehicles(id) on delete set null,
  driver_id               uuid references public.profiles(id) on delete set null,

  injuries_involved       boolean not null default false,
  police_notified         boolean not null default false,
  police_reference        text,
  insurance_reference     text,
  witnesses_summary       text,
  property_damage_summary text,
  immediate_actions       text,

  resolution_summary      text,
  resolved_at             timestamptz,
  resolved_by             uuid references public.profiles(id) on delete set null,

  attachment_urls         jsonb not null default '[]'::jsonb,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint incident_reports_severity_check
    check (severity in (
      'Info', 'Minor', 'Moderate', 'Major', 'Critical'
    )),

  constraint incident_reports_status_check
    check (status in (
      'Draft', 'Submitted', 'Under Review', 'Resolved', 'Closed', 'Escalated'
    )),

  constraint incident_reports_trip_phase_check
    check (trip_phase is null or trip_phase in (
      'Not Applicable', 'Pre-Trip', 'En Route', 'Pickup', 'Drop-off', 'Post-Trip'
    )),

  constraint incident_reports_category_check
    check (category in (
      'collision_multi_vehicle',
      'collision_fixed_object',
      'single_vehicle_runoff',
      'vehicle_mechanical_motion',
      'vehicle_breakdown_stranded',
      'passenger_injury',
      'passenger_medical',
      'driver_injury_medical',
      'security_threat_violence',
      'harassment_discrimination',
      'theft_loss_property',
      'property_damage_coop_vehicle',
      'property_damage_third_party',
      'service_accessibility',
      'customer_dispute_conduct',
      'operational_dispatch_error',
      'booking_conflict',
      'delay_schedule_failure',
      'route_road_hazard',
      'weather_environmental',
      'near_miss_hazard',
      'fuel_energy',
      'maintenance_premises',
      'it_system_data',
      'regulatory_inspection',
      'billing_payment_dispute',
      'cooperative_governance',
      'wildlife_environmental',
      'other'
    ))
);

create index if not exists incident_reports_reporter_id_idx on public.incident_reports (reporter_id);
create index if not exists incident_reports_status_idx on public.incident_reports (status);
create index if not exists incident_reports_occurred_at_idx on public.incident_reports (occurred_at desc);
create index if not exists incident_reports_reservation_id_idx on public.incident_reports (reservation_id);
create index if not exists incident_reports_category_idx on public.incident_reports (category);

create or replace function public.set_incident_report_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.report_number is null or trim(new.report_number) = '' then
    new.report_number := 'INC-' ||
      to_char(coalesce(new.occurred_at, now()) at time zone 'utc', 'YYYY') || '-' ||
      lpad(nextval('public.incident_report_number_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_incident_report_number on public.incident_reports;
create trigger trg_incident_report_number
  before insert on public.incident_reports
  for each row execute function public.set_incident_report_number();

create or replace function public.incident_reports_touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_incident_reports_updated on public.incident_reports;
create trigger trg_incident_reports_updated
  before update on public.incident_reports
  for each row execute function public.incident_reports_touch_updated_at();

create table if not exists public.incident_staff_notes (
  id           uuid primary key default uuid_generate_v4(),
  incident_id  uuid not null references public.incident_reports(id) on delete cascade,
  author_id    uuid references public.profiles(id) on delete set null,
  body         text not null,
  created_at   timestamptz not null default now()
);

create index if not exists incident_staff_notes_incident_id_idx
  on public.incident_staff_notes (incident_id, created_at desc);

alter table public.incident_reports enable row level security;
alter table public.incident_staff_notes enable row level security;

drop policy if exists "incident_reports select own or staff" on public.incident_reports;
drop policy if exists "incident_reports insert self" on public.incident_reports;
drop policy if exists "incident_reports insert" on public.incident_reports;
drop policy if exists "incident_reports update reporter draft" on public.incident_reports;
drop policy if exists "incident_reports update staff" on public.incident_reports;
drop policy if exists "incident_reports delete admin" on public.incident_reports;

create policy "incident_reports select own or staff"
  on public.incident_reports for select
  to authenticated
  using (
    reporter_id = auth.uid()
    or public.is_operations_staff()
    or public.is_admin()
  );

create policy "incident_reports insert"
  on public.incident_reports for insert
  to authenticated
  with check (
    reporter_id = auth.uid()
    or public.is_admin()
  );

create policy "incident_reports update reporter draft"
  on public.incident_reports for update
  to authenticated
  using (reporter_id = auth.uid() and status = 'Draft')
  with check (reporter_id = auth.uid());

create policy "incident_reports update staff"
  on public.incident_reports for update
  to authenticated
  using (public.is_operations_staff() or public.is_admin())
  with check (public.is_operations_staff() or public.is_admin());

create policy "incident_reports delete admin"
  on public.incident_reports for delete
  to authenticated
  using (public.is_admin());

drop policy if exists "incident_staff_notes staff select" on public.incident_staff_notes;
drop policy if exists "incident_staff_notes staff insert" on public.incident_staff_notes;

create policy "incident_staff_notes staff select"
  on public.incident_staff_notes for select
  to authenticated
  using (public.is_operations_staff() or public.is_admin());

create policy "incident_staff_notes staff insert"
  on public.incident_staff_notes for insert
  to authenticated
  with check (
    (public.is_operations_staff() or public.is_admin())
    and author_id = auth.uid()
  );

grant select, insert, update, delete on public.incident_reports to authenticated;
grant select, insert on public.incident_staff_notes to authenticated;

do $$
begin
  begin
    execute 'alter publication supabase_realtime add table public.incident_reports';
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end;
$$;

notify pgrst, 'reload schema';
