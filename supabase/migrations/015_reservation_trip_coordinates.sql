-- Geocoded pickup / destination for maps (Track My Trip, admin fleet). Filled on booking or backfilled in UI.

alter table public.reservations
  add column if not exists pickup_lat double precision,
  add column if not exists pickup_lng double precision,
  add column if not exists destination_lat double precision,
  add column if not exists destination_lng double precision;

comment on column public.reservations.pickup_lat is 'WGS84 latitude from geocoded pickup_location';
comment on column public.reservations.pickup_lng is 'WGS84 longitude from geocoded pickup_location';
comment on column public.reservations.destination_lat is 'WGS84 latitude from geocoded destination';
comment on column public.reservations.destination_lng is 'WGS84 longitude from geocoded destination';
