-- 014_booking_dispatch_and_messages.sql
-- Structured renter–dispatch communication plus vehicle handover / return documentation.

create table if not exists public.reservation_messages (
  id               uuid primary key default uuid_generate_v4(),
  reservation_id   uuid not null references public.reservations(id) on delete cascade,
  author_id        uuid not null references public.profiles(id) on delete cascade,
  body             text not null check (char_length(trim(body)) between 1 and 8000),
  is_staff         boolean not null default false,
  created_at       timestamptz not null default now()
);

create index if not exists reservation_messages_reservation_id_created_at_idx
  on public.reservation_messages (reservation_id, created_at);

-- Fuel gauge levels (consistent with common vehicle checkout sheets)
alter table public.reservations drop constraint if exists reservations_dispatch_fuel_level_check;
alter table public.reservations drop constraint if exists reservations_return_fuel_level_check;

alter table public.reservations
  add column if not exists customer_special_requests text;

alter table public.reservations
  add column if not exists dispatch_odometer_km integer
    check (dispatch_odometer_km is null or dispatch_odometer_km >= 0);
alter table public.reservations
  add column if not exists dispatch_fuel_level text;
alter table public.reservations
  add column if not exists dispatch_condition_notes text;
alter table public.reservations
  add column if not exists dispatch_recorded_at timestamptz;
alter table public.reservations
  add column if not exists dispatch_recorded_by uuid references public.profiles(id) on delete set null;

alter table public.reservations
  add column if not exists return_odometer_km integer
    check (return_odometer_km is null or return_odometer_km >= 0);
alter table public.reservations
  add column if not exists return_fuel_level text;
alter table public.reservations
  add column if not exists return_condition_notes text;
alter table public.reservations
  add column if not exists return_recorded_at timestamptz;
alter table public.reservations
  add column if not exists return_recorded_by uuid references public.profiles(id) on delete set null;

alter table public.reservations
  add constraint reservations_dispatch_fuel_level_check
  check (
    dispatch_fuel_level is null
    or dispatch_fuel_level in (
      'Full', '7/8', '3/4', '5/8', '1/2', '3/8', '1/4', '1/8', 'Empty'
    )
  );

alter table public.reservations
  add constraint reservations_return_fuel_level_check
  check (
    return_fuel_level is null
    or return_fuel_level in (
      'Full', '7/8', '3/4', '5/8', '1/2', '3/8', '1/4', '1/8', 'Empty'
    )
  );

-- Computed distance (odometer delta); non-negative for display safety
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'reservations'
      and column_name = 'km_driven'
  ) then
    alter table public.reservations
      add column km_driven integer generated always as (
        case
          when return_odometer_km is not null and dispatch_odometer_km is not null
          then greatest(0, return_odometer_km - dispatch_odometer_km)
          else null
        end
      ) stored;
  end if;
end $$;

alter table public.reservation_messages enable row level security;

drop policy if exists "reservation_messages_select" on public.reservation_messages;
drop policy if exists "reservation_messages_insert_customer" on public.reservation_messages;
drop policy if exists "reservation_messages_insert_staff" on public.reservation_messages;

create policy "reservation_messages_select"
  on public.reservation_messages for select
  to authenticated
  using (
    exists (
      select 1 from public.reservations r
      where r.id = reservation_messages.reservation_id
        and (
          r.customer_id = auth.uid()
          or public.is_admin()
          or public.is_operations_staff()
        )
    )
  );

create policy "reservation_messages_insert_customer"
  on public.reservation_messages for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and is_staff = false
    and exists (
      select 1 from public.reservations r
      where r.id = reservation_id
        and r.customer_id = auth.uid()
    )
  );

create policy "reservation_messages_insert_staff"
  on public.reservation_messages for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and is_staff = true
    and (public.is_admin() or public.is_operations_staff())
    and exists (
      select 1 from public.reservations r
      where r.id = reservation_id
    )
  );

grant select, insert on public.reservation_messages to authenticated;

-- Dispatchers need to read/update reservations without being full DB admins
drop policy if exists "reservations operations_staff read" on public.reservations;
drop policy if exists "reservations operations_staff update" on public.reservations;

create policy "reservations operations_staff read"
  on public.reservations for select
  to authenticated
  using (public.is_operations_staff());

create policy "reservations operations_staff update"
  on public.reservations for update
  to authenticated
  using (public.is_operations_staff())
  with check (public.is_operations_staff());

do $$
begin
  begin
    execute 'alter publication supabase_realtime add table public.reservation_messages';
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end;
$$;

notify pgrst, 'reload schema';
