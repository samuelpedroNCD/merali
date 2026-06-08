-- Property photo gallery + move-in/move-out inspections.

-- Public-read bucket so <img> tags render without a signed token.
insert into storage.buckets (id, name, public)
values ('property-photos', 'property-photos', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'merali_property_photos_auth'
  ) then
    create policy merali_property_photos_auth on storage.objects for all to authenticated
      using (bucket_id = 'property-photos')
      with check (bucket_id = 'property-photos');
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'merali_property_photos_public'
  ) then
    create policy merali_property_photos_public on storage.objects for select to anon
      using (bucket_id = 'property-photos');
  end if;
end $$;

create table if not exists property_photo (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references property(id) on delete cascade,
  url text not null,
  path text,
  caption text,
  uploaded_by uuid references staff_user(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists property_photo_property_idx on property_photo (property_id);

create table if not exists inspection (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references property(id) on delete cascade,
  lease_id uuid references lease(id) on delete set null,
  type text not null default 'Routine',           -- Move-in | Move-out | Routine
  inspection_date date,
  inspector_id uuid references staff_user(id) on delete set null,
  notes text,
  photos jsonb not null default '[]'::jsonb,        -- array of public URLs
  created_at timestamptz not null default now()
);
create index if not exists inspection_property_idx on inspection (property_id);

alter table property_photo enable row level security;
alter table inspection enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'property_photo' and policyname = 'merali_auth_property_photo') then
    create policy merali_auth_property_photo on property_photo for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'inspection' and policyname = 'merali_auth_inspection') then
    create policy merali_auth_inspection on inspection for all to authenticated using (true) with check (true);
  end if;
end $$;
