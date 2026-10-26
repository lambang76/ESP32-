-- Run this in Supabase SQL Editor so the browser dashboard requires a login
-- before reading the device list.
alter table public.devices enable row level security;

drop policy if exists "Public can read devices" on public.devices;
drop policy if exists "Authenticated can read devices" on public.devices;

grant select on public.devices to authenticated;

create policy "Authenticated can read devices"
on public.devices
for select
to authenticated
using (true);
