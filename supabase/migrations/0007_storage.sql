-- Storage buckets for uploads + policies. avatars is public-read (so <img>
-- URLs work without a token); documents/maintenance are authenticated-only.
insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('documents', 'documents', false),
  ('maintenance', 'maintenance', false)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'merali_auth_all'
  ) then
    create policy merali_auth_all on storage.objects for all to authenticated
      using (bucket_id in ('avatars', 'documents', 'maintenance'))
      with check (bucket_id in ('avatars', 'documents', 'maintenance'));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'merali_public_avatars'
  ) then
    create policy merali_public_avatars on storage.objects for select to anon
      using (bucket_id = 'avatars');
  end if;
end $$;
