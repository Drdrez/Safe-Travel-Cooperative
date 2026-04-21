-- 001_production_schema.sql

create extension if not exists "uuid-ossp";

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

alter table public.profiles
  add column if not exists role        text default 'customer',
  add column if not exists full_name   text,
  add column if not exists email       text,
  add column if not exists contact_number text,
  add column if not exists address     text,
  add column if not exists photo_url   text,
  add column if not exists created_at  timestamptz default now();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, email, contact_number, address)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'customer'),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'contact_number',
    new.raw_user_meta_data->>'address'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.billings
  add column if not exists refund_status       text,
  add column if not exists refund_processed_at timestamptz,
  add column if not exists payment_method      text,
  add column if not exists reference_id        text,
  add column if not exists paid_at             timestamptz,
  add column if not exists confirmed_by        uuid references auth.users(id),
  add column if not exists confirmed_at        timestamptz;

alter table public.billings drop constraint if exists billings_status_check;
alter table public.billings drop constraint if exists billing_status_check;
alter table public.billings
  add constraint billings_status_check
  check (status in (
    'Pending',
    'Pending Confirmation',
    'Paid',
    'Overdue',
    'Cancelled',
    'Refunded'
  ));

alter table public.billings drop constraint if exists billings_refund_status_check;
alter table public.billings
  add constraint billings_refund_status_check
  check (refund_status is null or refund_status in (
    'Pending',
    'Processing',
    'Completed',
    'Denied'
  ));

update public.reservations set status = 'Confirmed'   where status in ('Approved');
update public.reservations set status = 'In Progress' where status in ('Active', 'Processing');

alter table public.reservations drop constraint if exists reservations_status_check;
alter table public.reservations drop constraint if exists reservation_status_check;
alter table public.reservations
  add constraint reservations_status_check
  check (status in (
    'Pending',
    'Confirmed',
    'In Progress',
    'Completed',
    'Cancelled'
  ));

create or replace function public.handle_reservation_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'Confirmed' and (old.status is distinct from 'Confirmed') then
    insert into public.billings (reservation_id, customer_id, amount_cents, status, due_date)
    select new.id,
           new.customer_id,
           coalesce(new.estimated_cost_cents, 0),
           'Pending',
           coalesce(new.end_date::date, (now() + interval '7 days')::date)
    where not exists (
      select 1 from public.billings b where b.reservation_id = new.id
    );
  end if;

  if new.status = 'Cancelled' and (old.status is distinct from 'Cancelled') then
    update public.billings
      set status = 'Cancelled'
      where reservation_id = new.id
        and status in ('Pending', 'Pending Confirmation');
  end if;

  return new;
end;
$$;

drop trigger if exists reservations_status_change on public.reservations;
create trigger reservations_status_change
  after update of status on public.reservations
  for each row execute function public.handle_reservation_status_change();

create table if not exists public.app_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz default now(),
  updated_by  uuid references auth.users(id)
);

insert into public.app_settings (key, value) values
  ('coop_info', jsonb_build_object(
     'name',    'Safe Travel Cooperative',
     'email',   'admin@safetravel.coop',
     'phone',   '(555) 000-0000',
     'address', '123 Main Street, City, State 12345',
     'logo_url', ''
  )),
  ('op_prefs', jsonb_build_object(
     'currency',      'PHP',
     'tax_rate',      12,
     'buffer_minutes',60,
     'default_daily_rate', 3500,
     'cancellation_fee_pct', 10,
     'cancellation_window_hours', 2
  ))
on conflict (key) do nothing;

create table if not exists public.support_tickets (
  id              uuid primary key default uuid_generate_v4(),
  customer_id     uuid not null references auth.users(id) on delete cascade,
  subject         text not null,
  message         text not null,
  status          text not null default 'Open',
  admin_reply     text,
  replied_by      uuid references auth.users(id),
  replied_at      timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists support_tickets_customer_id_idx
  on public.support_tickets (customer_id);
create index if not exists support_tickets_status_idx
  on public.support_tickets (status);

alter table public.support_tickets
  drop constraint if exists support_tickets_customer_id_fkey;

alter table public.support_tickets
  add constraint support_tickets_customer_id_fkey
  foreign key (customer_id) references public.profiles(id) on delete cascade;

alter table public.support_tickets
  add column if not exists reservation_id uuid references public.reservations(id) on delete set null;

create index if not exists support_tickets_reservation_id_idx
  on public.support_tickets (reservation_id);

notify pgrst, 'reload schema';

create table if not exists public.audit_log (
  id         bigserial primary key,
  actor_id   uuid references auth.users(id),
  action     text not null,
  target     text,
  details    jsonb,
  created_at timestamptz default now()
);

create index if not exists audit_log_actor_idx on public.audit_log (actor_id);
create index if not exists audit_log_created_idx on public.audit_log (created_at desc);

create table if not exists public.notifications (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null,
  title       text not null,
  body        text,
  link        text,
  payload     jsonb,
  read_at     timestamptz,
  created_at  timestamptz default now()
);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, read_at) where read_at is null;
create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create or replace function public.emit_reservation_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ref text := coalesce(new.reservation_id_str, new.id::text);
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'Confirmed' then
      insert into public.notifications (user_id, kind, title, body, link)
      values (new.customer_id, 'reservation.confirmed',
              'Booking confirmed',
              format('Your trip %s has been confirmed.', ref),
              '/customer/reservations');
    elsif new.status = 'In Progress' then
      insert into public.notifications (user_id, kind, title, body, link)
      values (new.customer_id, 'reservation.in_progress',
              'Trip in progress',
              format('Your trip %s is now underway.', ref),
              '/customer/reservations');
    elsif new.status = 'Completed' then
      insert into public.notifications (user_id, kind, title, body, link)
      values (new.customer_id, 'reservation.completed',
              'Trip completed',
              format('Trip %s is complete. Thank you for travelling with us!', ref),
              '/customer/reservations');
    elsif new.status = 'Cancelled' then
      insert into public.notifications (user_id, kind, title, body, link)
      values (new.customer_id, 'reservation.cancelled',
              'Booking cancelled',
              format('Trip %s has been cancelled.', ref),
              '/customer/reservations');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists reservations_notify on public.reservations;
create trigger reservations_notify
  after update of status on public.reservations
  for each row execute function public.emit_reservation_notification();

create or replace function public.emit_billing_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ref text := coalesce(new.billing_id_str, new.id::text);
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'Paid' then
      insert into public.notifications (user_id, kind, title, body, link)
      values (new.customer_id, 'billing.paid',
              'Payment confirmed',
              format('We''ve confirmed payment for invoice %s. Thank you!', ref),
              '/customer/billing');
    elsif new.status = 'Pending Confirmation' and old.status <> 'Pending Confirmation' then
      insert into public.notifications (user_id, kind, title, body, link)
      values (new.customer_id, 'billing.submitted',
              'Payment submitted',
              format('We received your payment for %s and it is awaiting admin confirmation.', ref),
              '/customer/billing');
    elsif new.status = 'Overdue' then
      insert into public.notifications (user_id, kind, title, body, link)
      values (new.customer_id, 'billing.overdue',
              'Invoice overdue',
              format('Invoice %s is past due. Please settle it to avoid service disruption.', ref),
              '/customer/billing');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists billings_notify on public.billings;
create trigger billings_notify
  after update of status on public.billings
  for each row execute function public.emit_billing_notification();

create or replace function public.notify_admins(
  p_kind text,
  p_title text,
  p_body text,
  p_link text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, kind, title, body, link)
  select id, p_kind, p_title, p_body, p_link
  from public.profiles
  where role = 'admin';
end;
$$;

create or replace function public.emit_reservation_created_admin()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ref text := coalesce(new.reservation_id_str, new.id::text);
begin
  perform public.notify_admins(
    'admin.reservation.new',
    'New booking received',
    format('Reservation %s is awaiting approval.', ref),
    '/admin/reservations'
  );
  return new;
end;
$$;

drop trigger if exists reservations_notify_admin on public.reservations;
create trigger reservations_notify_admin
  after insert on public.reservations
  for each row execute function public.emit_reservation_created_admin();

create or replace function public.emit_billing_admin_notification()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ref text := coalesce(new.billing_id_str, new.id::text);
begin
  if tg_op = 'UPDATE'
     and new.status = 'Pending Confirmation'
     and old.status is distinct from 'Pending Confirmation' then
    perform public.notify_admins(
      'admin.billing.submitted',
      'Payment awaiting confirmation',
      format('A customer submitted payment for invoice %s.', ref),
      '/admin/billing'
    );
  end if;
  if tg_op = 'UPDATE'
     and new.refund_status = 'Pending'
     and old.refund_status is distinct from 'Pending' then
    perform public.notify_admins(
      'admin.billing.refund',
      'Refund request',
      format('A refund has been requested for invoice %s.', ref),
      '/admin/billing'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists billings_notify_admin on public.billings;
create trigger billings_notify_admin
  after update on public.billings
  for each row execute function public.emit_billing_admin_notification();

create or replace function public.emit_ticket_admin_notification()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_admins(
    'admin.ticket.new',
    'New support ticket',
    coalesce(new.subject, 'A customer sent a support message.'),
    '/admin/support'
  );
  return new;
end;
$$;

drop trigger if exists support_tickets_notify_admin on public.support_tickets;
create trigger support_tickets_notify_admin
  after insert on public.support_tickets
  for each row execute function public.emit_ticket_admin_notification();

create or replace function public.audit_reservation_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (actor_id, action, target, details)
    values (new.customer_id, 'reservation.created', 'reservation:' || new.id::text,
            jsonb_build_object('ref', new.reservation_id_str, 'status', new.status));
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      insert into public.audit_log (actor_id, action, target, details)
      values (auth.uid(), 'reservation.status_changed', 'reservation:' || new.id::text,
              jsonb_build_object('from', old.status, 'to', new.status));
    end if;
    if new.vehicle_id is distinct from old.vehicle_id then
      insert into public.audit_log (actor_id, action, target, details)
      values (auth.uid(), 'reservation.vehicle_changed', 'reservation:' || new.id::text,
              jsonb_build_object('from', old.vehicle_id, 'to', new.vehicle_id));
    end if;
    if new.driver_id is distinct from old.driver_id then
      insert into public.audit_log (actor_id, action, target, details)
      values (auth.uid(), 'reservation.driver_changed', 'reservation:' || new.id::text,
              jsonb_build_object('from', old.driver_id, 'to', new.driver_id));
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists reservations_audit on public.reservations;
create trigger reservations_audit
  after insert or update on public.reservations
  for each row execute function public.audit_reservation_change();

create or replace function public.audit_billing_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  res_id uuid := coalesce(new.reservation_id, old.reservation_id);
begin
  if res_id is null then return coalesce(new, old); end if;
  if tg_op = 'INSERT' then
    insert into public.audit_log (actor_id, action, target, details)
    values (auth.uid(), 'billing.created', 'reservation:' || res_id::text,
            jsonb_build_object('billing_id', new.id, 'status', new.status, 'amount_cents', new.amount_cents));
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      insert into public.audit_log (actor_id, action, target, details)
      values (auth.uid(), 'billing.status_changed', 'reservation:' || res_id::text,
              jsonb_build_object('billing_id', new.id, 'from', old.status, 'to', new.status));
    end if;
    if coalesce(new.refund_status,'') is distinct from coalesce(old.refund_status,'') then
      insert into public.audit_log (actor_id, action, target, details)
      values (auth.uid(), 'billing.refund_status_changed', 'reservation:' || res_id::text,
              jsonb_build_object('billing_id', new.id, 'from', old.refund_status, 'to', new.refund_status));
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists billings_audit on public.billings;
create trigger billings_audit
  after insert or update on public.billings
  for each row execute function public.audit_billing_change();

alter table public.notifications enable row level security;

drop policy if exists "notif self read"  on public.notifications;
drop policy if exists "notif self ack"   on public.notifications;
drop policy if exists "notif admin all"  on public.notifications;

create policy "notif self read"
  on public.notifications for select
  using (user_id = auth.uid() or public.is_admin());

create policy "notif self ack"
  on public.notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "notif admin all"
  on public.notifications for all
  using (public.is_admin())
  with check (public.is_admin());

update public.notifications
   set link = '/customer/reservations'
 where link = '/customer/my-reservations';


alter table public.profiles enable row level security;

drop policy if exists "profiles self read"            on public.profiles;
drop policy if exists "profiles admin read"           on public.profiles;
drop policy if exists "profiles self update"          on public.profiles;
drop policy if exists "profiles admin update"         on public.profiles;
drop policy if exists "profiles admin insert"         on public.profiles;
drop policy if exists "profiles admin delete"         on public.profiles;

create policy "profiles self read"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

create policy "profiles self update"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and (role is not distinct from (select role from public.profiles where id = auth.uid()))
  );

create policy "profiles admin update"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "profiles admin insert"
  on public.profiles for insert
  with check (public.is_admin() or auth.uid() = id);

create policy "profiles admin delete"
  on public.profiles for delete
  using (public.is_admin());

alter table public.vehicles enable row level security;

drop policy if exists "vehicles read all"     on public.vehicles;
drop policy if exists "vehicles admin write"  on public.vehicles;

create policy "vehicles read all"
  on public.vehicles for select
  using (auth.role() = 'authenticated');

create policy "vehicles admin write"
  on public.vehicles for all
  using (public.is_admin())
  with check (public.is_admin());

alter table public.reservations enable row level security;

drop policy if exists "reservations customer read"   on public.reservations;
drop policy if exists "reservations admin read"      on public.reservations;
drop policy if exists "reservations customer insert" on public.reservations;
drop policy if exists "reservations customer update" on public.reservations;
drop policy if exists "reservations admin write"     on public.reservations;

create policy "reservations customer read"
  on public.reservations for select
  using (customer_id = auth.uid() or public.is_admin());

create policy "reservations customer insert"
  on public.reservations for insert
  with check (customer_id = auth.uid() and status = 'Pending');

create policy "reservations customer update"
  on public.reservations for update
  using (customer_id = auth.uid())
  with check (
    customer_id = auth.uid()
    and status in ('Pending', 'Cancelled')
  );

create policy "reservations admin write"
  on public.reservations for all
  using (public.is_admin())
  with check (public.is_admin());

alter table public.billings enable row level security;

drop policy if exists "billings customer read"    on public.billings;
drop policy if exists "billings customer request" on public.billings;
drop policy if exists "billings admin write"      on public.billings;

create policy "billings customer read"
  on public.billings for select
  using (customer_id = auth.uid() or public.is_admin());

create policy "billings customer request"
  on public.billings for update
  using (customer_id = auth.uid())
  with check (
    customer_id = auth.uid()
    and status in ('Pending', 'Pending Confirmation')
  );

create policy "billings admin write"
  on public.billings for all
  using (public.is_admin())
  with check (public.is_admin());

alter table public.app_settings enable row level security;

drop policy if exists "app_settings read"   on public.app_settings;
drop policy if exists "app_settings write"  on public.app_settings;

create policy "app_settings read"
  on public.app_settings for select
  using (auth.role() = 'authenticated');

create policy "app_settings write"
  on public.app_settings for all
  using (public.is_admin())
  with check (public.is_admin());

alter table public.support_tickets enable row level security;

drop policy if exists "tickets customer read"   on public.support_tickets;
drop policy if exists "tickets customer insert" on public.support_tickets;
drop policy if exists "tickets admin write"     on public.support_tickets;

create policy "tickets customer read"
  on public.support_tickets for select
  using (customer_id = auth.uid() or public.is_admin());

create policy "tickets customer insert"
  on public.support_tickets for insert
  with check (customer_id = auth.uid() and status = 'Open');

create policy "tickets admin write"
  on public.support_tickets for all
  using (public.is_admin())
  with check (public.is_admin());

alter table public.audit_log enable row level security;

drop policy if exists "audit_log admin read"    on public.audit_log;
drop policy if exists "audit_log system insert" on public.audit_log;

create policy "audit_log admin read"
  on public.audit_log for select
  using (public.is_admin());

create policy "audit_log system insert"
  on public.audit_log for insert
  with check (auth.uid() is not null);


create or replace view public.v_revenue_by_day as
  select
    date_trunc('day', coalesce(end_date::timestamptz, created_at)) as day,
    sum(coalesce(estimated_cost_cents, 0))                         as revenue_cents,
    count(*)                                                       as completed_trips
  from public.reservations
  where status = 'Completed'
  group by 1
  order by 1 desc;

grant select on public.v_revenue_by_day to authenticated;


do $$
declare
  t text;
begin
  foreach t in array array[
    'reservations',
    'billings',
    'vehicles',
    'drivers',
    'profiles',
    'support_tickets',
    'notifications',
    'audit_log',
    'app_settings'
  ]
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception
      when duplicate_object then null;
      when undefined_table  then null;
    end;
  end loop;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'reservations','billings','vehicles','drivers','profiles',
    'support_tickets','notifications','audit_log','app_settings'
  ]
  loop
    begin
      execute format('alter table public.%I replica identity full', t);
    exception when undefined_table then null;
    end;
  end loop;
end;
$$;


