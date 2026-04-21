-- 002_extended_modules.sql

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'dispatcher', 'customer', 'driver'));

alter table public.profiles
  add column if not exists hire_date           date,
  add column if not exists job_title           text,
  add column if not exists employment_status   text default 'Active',
  add column if not exists license_number      text,
  add column if not exists license_expiry      date,
  add column if not exists emergency_contact   text,
  add column if not exists base_rate_cents     integer default 0,
  add column if not exists rate_period         text    default 'monthly';

alter table public.profiles drop constraint if exists profiles_employment_status_check;
alter table public.profiles
  add constraint profiles_employment_status_check
  check (employment_status is null or employment_status in (
    'Active', 'Probationary', 'Suspended', 'Terminated', 'Resigned'
  ));

alter table public.profiles drop constraint if exists profiles_rate_period_check;
alter table public.profiles
  add constraint profiles_rate_period_check
  check (rate_period is null or rate_period in ('daily', 'monthly', 'hourly'));

create table if not exists public.payroll_periods (
  id            uuid primary key default uuid_generate_v4(),
  period_start  date not null,
  period_end    date not null,
  status        text not null default 'Draft',
  notes         text,
  posted_at     timestamptz,
  posted_by     uuid references auth.users(id),
  created_at    timestamptz default now(),
  constraint payroll_periods_range_check check (period_end >= period_start),
  constraint payroll_periods_status_check check (status in ('Draft', 'Posted', 'Cancelled'))
);

create index if not exists payroll_periods_status_idx on public.payroll_periods (status);
create index if not exists payroll_periods_range_idx  on public.payroll_periods (period_start, period_end);

create table if not exists public.payroll_items (
  id                    uuid primary key default uuid_generate_v4(),
  period_id             uuid not null references public.payroll_periods(id) on delete cascade,
  employee_id           uuid not null references public.profiles(id)        on delete restrict,
  base_pay_cents        integer not null default 0,
  overtime_hours        numeric(6,2) default 0,
  overtime_pay_cents    integer not null default 0,
  allowances_cents      integer not null default 0,
  deductions_cents      integer not null default 0,
  net_pay_cents         integer generated always as
    (base_pay_cents + overtime_pay_cents + allowances_cents - deductions_cents) stored,
  remarks               text,
  created_at            timestamptz default now(),
  unique (period_id, employee_id)
);

create index if not exists payroll_items_employee_idx on public.payroll_items (employee_id);
create index if not exists payroll_items_period_idx   on public.payroll_items (period_id);

create table if not exists public.cooperative_members (
  id                    uuid primary key default uuid_generate_v4(),
  profile_id            uuid not null references public.profiles(id) on delete cascade,
  member_number         text unique,
  membership_date       date not null default current_date,
  membership_status     text not null default 'Active',
  share_capital_cents   integer not null default 0,
  notes                 text,
  created_at            timestamptz default now(),
  unique (profile_id)
);

alter table public.cooperative_members drop constraint if exists cooperative_members_status_check;
alter table public.cooperative_members
  add constraint cooperative_members_status_check
  check (membership_status in ('Active', 'Inactive', 'Suspended', 'Terminated'));

create or replace function public.assign_member_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
declare
  next_seq bigint;
  yr       text := to_char(now(), 'YYYY');
begin
  if new.member_number is null or new.member_number = '' then
    next_seq := (
      select coalesce(
               max(substring(member_number from '[0-9]+$')::bigint),
               0
             ) + 1
        from public.cooperative_members
       where member_number ~ ('^MBR-' || yr || '-[0-9]+$')
    );
    new.member_number := format('MBR-%s-%s', yr, lpad(next_seq::text, 5, '0'));
  end if;
  return new;
end;
$func$;

drop trigger if exists cooperative_members_assign_number on public.cooperative_members;
create trigger cooperative_members_assign_number
  before insert on public.cooperative_members
  for each row execute function public.assign_member_number();

create table if not exists public.member_contributions (
  id              uuid primary key default uuid_generate_v4(),
  member_id       uuid not null references public.cooperative_members(id) on delete cascade,
  contributed_on  date not null default current_date,
  amount_cents    integer not null check (amount_cents > 0),
  kind            text not null default 'Monthly Dues',
  reference       text,
  recorded_by     uuid references auth.users(id),
  notes           text,
  created_at      timestamptz default now()
);

alter table public.member_contributions drop constraint if exists member_contributions_kind_check;
alter table public.member_contributions
  add constraint member_contributions_kind_check
  check (kind in ('Monthly Dues', 'Share Capital', 'Special Assessment', 'Other'));

create index if not exists member_contributions_member_idx on public.member_contributions (member_id, contributed_on desc);

create table if not exists public.loan_requests (
  id                    uuid primary key default uuid_generate_v4(),
  member_id             uuid not null references public.cooperative_members(id) on delete cascade,
  loan_number           text unique,
  principal_cents       integer not null check (principal_cents > 0),
  interest_rate_pct     numeric(5,2) not null default 0,
  term_months           integer not null check (term_months > 0),
  purpose               text,
  status                text not null default 'Pending',
  decided_at            timestamptz,
  decided_by            uuid references auth.users(id),
  decision_notes        text,
  disbursed_at          timestamptz,
  disbursed_amount_cents integer,
  balance_cents         integer not null default 0,
  created_at            timestamptz default now()
);

alter table public.loan_requests drop constraint if exists loan_requests_status_check;
alter table public.loan_requests
  add constraint loan_requests_status_check
  check (status in ('Pending', 'Approved', 'Rejected', 'Disbursed', 'Repaying', 'Closed', 'Defaulted', 'Cancelled'));

create index if not exists loan_requests_member_idx  on public.loan_requests (member_id);
create index if not exists loan_requests_status_idx  on public.loan_requests (status);

create or replace function public.assign_loan_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
declare
  next_seq bigint;
  yr       text := to_char(now(), 'YYYY');
begin
  if new.loan_number is null or new.loan_number = '' then
    next_seq := (
      select coalesce(
               max(substring(loan_number from '[0-9]+$')::bigint),
               0
             ) + 1
        from public.loan_requests
       where loan_number ~ ('^LN-' || yr || '-[0-9]+$')
    );
    new.loan_number := format('LN-%s-%s', yr, lpad(next_seq::text, 5, '0'));
  end if;
  return new;
end;
$func$;

drop trigger if exists loan_requests_assign_number on public.loan_requests;
create trigger loan_requests_assign_number
  before insert on public.loan_requests
  for each row execute function public.assign_loan_number();

create or replace function public.on_loan_disbursed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.status = 'Disbursed' and old.status is distinct from 'Disbursed' then
    new.disbursed_at := coalesce(new.disbursed_at, now());
    new.disbursed_amount_cents := coalesce(new.disbursed_amount_cents, new.principal_cents);
    new.balance_cents := coalesce(new.disbursed_amount_cents, new.principal_cents);
  end if;
  return new;
end;
$$;

drop trigger if exists loan_requests_on_disburse on public.loan_requests;
create trigger loan_requests_on_disburse
  before update of status on public.loan_requests
  for each row execute function public.on_loan_disbursed();

create table if not exists public.loan_payments (
  id              uuid primary key default uuid_generate_v4(),
  loan_id         uuid not null references public.loan_requests(id) on delete cascade,
  paid_on         date not null default current_date,
  amount_cents    integer not null check (amount_cents > 0),
  method          text,
  reference       text,
  recorded_by     uuid references auth.users(id),
  notes           text,
  created_at      timestamptz default now()
);

create index if not exists loan_payments_loan_idx on public.loan_payments (loan_id, paid_on desc);

create or replace function public.apply_loan_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance integer;
begin
  if tg_op = 'INSERT' then
    update public.loan_requests
       set balance_cents = greatest(0, balance_cents - new.amount_cents),
           status = case
             when status in ('Approved', 'Disbursed') then 'Repaying'
             else status
           end
     where id = new.loan_id
     returning balance_cents into new_balance;

    if new_balance is not null and new_balance = 0 then
      update public.loan_requests
         set status = 'Closed'
       where id = new.loan_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists loan_payments_apply on public.loan_payments;
create trigger loan_payments_apply
  after insert on public.loan_payments
  for each row execute function public.apply_loan_payment();

create table if not exists public.maintenance_records (
  id              uuid primary key default uuid_generate_v4(),
  vehicle_id      uuid not null references public.vehicles(id) on delete cascade,
  service_type    text not null,
  scheduled_for   date,
  completed_on    date,
  odometer_km     integer,
  cost_cents      integer not null default 0,
  status          text not null default 'Scheduled',
  notes           text,
  created_by      uuid references auth.users(id),
  created_at      timestamptz default now()
);

alter table public.maintenance_records drop constraint if exists maintenance_records_status_check;
alter table public.maintenance_records
  add constraint maintenance_records_status_check
  check (status in ('Scheduled', 'In Progress', 'Completed', 'Cancelled'));

create index if not exists maintenance_records_vehicle_idx on public.maintenance_records (vehicle_id, created_at desc);
create index if not exists maintenance_records_status_idx  on public.maintenance_records (status);

create or replace function public.sync_vehicle_maintenance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.status in ('Scheduled', 'In Progress') then
    update public.vehicles
       set status = 'Maintenance'
     where id = new.vehicle_id
       and status in ('Available');
  elsif tg_op = 'UPDATE' then
    if new.status in ('Scheduled', 'In Progress') and old.status not in ('Scheduled', 'In Progress') then
      update public.vehicles
         set status = 'Maintenance'
       where id = new.vehicle_id
         and status = 'Available';
    elsif new.status in ('Completed', 'Cancelled') and old.status in ('Scheduled', 'In Progress') then
      if not exists (
        select 1 from public.maintenance_records
         where vehicle_id = new.vehicle_id
           and id <> new.id
           and status in ('Scheduled', 'In Progress')
      ) then
        update public.vehicles
           set status = 'Available'
         where id = new.vehicle_id
           and status = 'Maintenance';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists maintenance_records_sync on public.maintenance_records;
create trigger maintenance_records_sync
  after insert or update on public.maintenance_records
  for each row execute function public.sync_vehicle_maintenance();

create or replace view public.v_driver_performance as
  select p.id                                                         as driver_id,
         p.full_name,
         count(r.*)                                                   as total_trips,
         count(r.*) filter (where r.status = 'Completed')             as completed_trips,
         count(r.*) filter (where r.status = 'Cancelled')             as cancelled_trips,
         count(r.*) filter (where r.status = 'In Progress')           as in_progress_trips,
         coalesce(sum(r.estimated_cost_cents) filter (where r.status = 'Completed'), 0) as revenue_cents,
         max(r.end_date)                                              as last_trip_on
    from public.profiles p
    left join public.reservations r on r.driver_id = p.id
   where p.role in ('driver', 'dispatcher')
   group by p.id, p.full_name;

grant select on public.v_driver_performance to authenticated;


alter table public.payroll_periods enable row level security;
alter table public.payroll_items   enable row level security;

drop policy if exists "payroll_periods admin all"   on public.payroll_periods;
drop policy if exists "payroll_periods self read"   on public.payroll_periods;
drop policy if exists "payroll_items admin all"     on public.payroll_items;
drop policy if exists "payroll_items self read"     on public.payroll_items;

create policy "payroll_periods admin all"
  on public.payroll_periods
  as permissive
  for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "payroll_periods self read"
  on public.payroll_periods
  as permissive
  for select
  using (
    status = 'Posted' and exists (
      select 1 from public.payroll_items i
      where i.period_id = payroll_periods.id
        and i.employee_id = auth.uid()
    )
  );

create policy "payroll_items admin all"
  on public.payroll_items
  as permissive
  for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "payroll_items self read"
  on public.payroll_items
  as permissive
  for select
  using (
    employee_id = auth.uid()
    and exists (
      select 1 from public.payroll_periods p
      where p.id = payroll_items.period_id and p.status = 'Posted'
    )
  );

alter table public.cooperative_members   enable row level security;
alter table public.member_contributions  enable row level security;
alter table public.loan_requests         enable row level security;
alter table public.loan_payments         enable row level security;

drop policy if exists "members admin all"  on public.cooperative_members;
drop policy if exists "members self read"  on public.cooperative_members;
create policy "members admin all"
  on public.cooperative_members for all
  using (public.is_admin()) with check (public.is_admin());
create policy "members self read"
  on public.cooperative_members for select
  using (profile_id = auth.uid());

drop policy if exists "contrib admin all"  on public.member_contributions;
drop policy if exists "contrib self read"  on public.member_contributions;
create policy "contrib admin all"
  on public.member_contributions for all
  using (public.is_admin()) with check (public.is_admin());
create policy "contrib self read"
  on public.member_contributions for select
  using (
    exists (
      select 1 from public.cooperative_members m
      where m.id = member_contributions.member_id
        and m.profile_id = auth.uid()
    )
  );

drop policy if exists "loans admin all"         on public.loan_requests;
drop policy if exists "loans self read"         on public.loan_requests;
drop policy if exists "loans self insert"       on public.loan_requests;
create policy "loans admin all"
  on public.loan_requests for all
  using (public.is_admin()) with check (public.is_admin());
create policy "loans self read"
  on public.loan_requests for select
  using (
    exists (
      select 1 from public.cooperative_members m
      where m.id = loan_requests.member_id
        and m.profile_id = auth.uid()
    )
  );
create policy "loans self insert"
  on public.loan_requests for insert
  with check (
    status = 'Pending'
    and exists (
      select 1 from public.cooperative_members m
      where m.id = loan_requests.member_id
        and m.profile_id = auth.uid()
    )
  );

drop policy if exists "loan_payments admin all"  on public.loan_payments;
drop policy if exists "loan_payments self read"  on public.loan_payments;
create policy "loan_payments admin all"
  on public.loan_payments for all
  using (public.is_admin()) with check (public.is_admin());
create policy "loan_payments self read"
  on public.loan_payments for select
  using (
    exists (
      select 1
        from public.loan_requests l
        join public.cooperative_members m on m.id = l.member_id
       where l.id = loan_payments.loan_id
         and m.profile_id = auth.uid()
    )
  );

alter table public.maintenance_records enable row level security;
drop policy if exists "maint admin all"   on public.maintenance_records;
drop policy if exists "maint auth read"   on public.maintenance_records;
create policy "maint admin all"
  on public.maintenance_records for all
  using (public.is_admin()) with check (public.is_admin());
create policy "maint auth read"
  on public.maintenance_records for select
  using (auth.role() = 'authenticated');


create or replace function public.emit_loan_decision_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
declare
  target_profile uuid;
  loan_ref       text := coalesce(new.loan_number, new.id::text);
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    target_profile := (
      select profile_id
        from public.cooperative_members
       where id = new.member_id
    );
    if target_profile is null then
      return new;
    end if;

    if new.status = 'Approved' then
      insert into public.notifications (user_id, kind, title, body, link)
      values (target_profile, 'loan.approved',
              'Loan approved',
              format('Your loan application %s has been approved.', loan_ref),
              '/customer/membership');
    elsif new.status = 'Rejected' then
      insert into public.notifications (user_id, kind, title, body, link)
      values (target_profile, 'loan.rejected',
              'Loan application rejected',
              format('Your loan application %s was rejected.', loan_ref),
              '/customer/membership');
    elsif new.status = 'Disbursed' then
      insert into public.notifications (user_id, kind, title, body, link)
      values (target_profile, 'loan.disbursed',
              'Loan disbursed',
              format('Loan %s has been disbursed. Check your repayment schedule.', loan_ref),
              '/customer/membership');
    elsif new.status = 'Closed' then
      insert into public.notifications (user_id, kind, title, body, link)
      values (target_profile, 'loan.closed',
              'Loan fully paid',
              format('Loan %s is now fully paid. Thank you!', loan_ref),
              '/customer/membership');
    end if;
  end if;
  return new;
end;
$func$;

drop trigger if exists loan_decision_notify on public.loan_requests;
create trigger loan_decision_notify
  after update of status on public.loan_requests
  for each row execute function public.emit_loan_decision_notification();

create or replace function public.emit_loan_request_admin_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
declare
  member_name text;
begin
  member_name := (
    select p.full_name
      from public.cooperative_members m
      left join public.profiles p on p.id = m.profile_id
     where m.id = new.member_id
  );

  perform public.notify_admins(
    'admin.loan.new',
    'New loan application',
    format('%s submitted loan %s for review.',
           coalesce(member_name, 'A member'),
           coalesce(new.loan_number, '(pending number)')),
    '/admin/loans'
  );
  return new;
end;
$func$;

drop trigger if exists loan_request_notify_admin on public.loan_requests;
create trigger loan_request_notify_admin
  after insert on public.loan_requests
  for each row execute function public.emit_loan_request_admin_notification();

create or replace function public.emit_payroll_posted_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
begin
  if tg_op = 'UPDATE' and new.status = 'Posted' and old.status is distinct from 'Posted' then
    for rec in
      select employee_id from public.payroll_items where period_id = new.id
    loop
      insert into public.notifications (user_id, kind, title, body, link)
      values (rec.employee_id, 'payroll.posted',
              'New payslip available',
              format('Your payslip for %s — %s is ready.', to_char(new.period_start, 'Mon DD'), to_char(new.period_end, 'Mon DD, YYYY')),
              '/admin/payroll');
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists payroll_post_notify on public.payroll_periods;
create trigger payroll_post_notify
  after update of status on public.payroll_periods
  for each row execute function public.emit_payroll_posted_notification();

create or replace function public.audit_maintenance_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (actor_id, action, target, details)
    values (auth.uid(), 'maintenance.created',
            'vehicle:' || new.vehicle_id::text,
            jsonb_build_object('record_id', new.id, 'service_type', new.service_type, 'status', new.status));
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.audit_log (actor_id, action, target, details)
    values (auth.uid(), 'maintenance.status_changed',
            'vehicle:' || new.vehicle_id::text,
            jsonb_build_object('record_id', new.id, 'old', old.status, 'new', new.status));
  end if;
  return new;
end;
$$;

drop trigger if exists maintenance_records_audit on public.maintenance_records;
create trigger maintenance_records_audit
  after insert or update on public.maintenance_records
  for each row execute function public.audit_maintenance_change();

create or replace function public.audit_loan_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (actor_id, action, target, details)
    values (auth.uid(), 'loan.created',
            'loan:' || new.id::text,
            jsonb_build_object('loan_number', new.loan_number, 'principal_cents', new.principal_cents, 'member_id', new.member_id));
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.audit_log (actor_id, action, target, details)
    values (auth.uid(), 'loan.status_changed',
            'loan:' || new.id::text,
            jsonb_build_object('loan_number', new.loan_number, 'old', old.status, 'new', new.status));
  end if;
  return new;
end;
$$;

drop trigger if exists loan_requests_audit on public.loan_requests;
create trigger loan_requests_audit
  after insert or update on public.loan_requests
  for each row execute function public.audit_loan_change();

do $$
declare
  t text;
begin
  foreach t in array array[
    'payroll_periods','payroll_items',
    'cooperative_members','member_contributions',
    'loan_requests','loan_payments',
    'maintenance_records'
  ]
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception
      when duplicate_object then null;
      when undefined_table  then null;
    end;
    begin
      execute format('alter table public.%I replica identity full', t);
    exception when undefined_table then null;
    end;
  end loop;
end;
$$;

notify pgrst, 'reload schema';

