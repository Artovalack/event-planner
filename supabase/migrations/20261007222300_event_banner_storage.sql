insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-banners',
  'event-banners',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Event owners can upload event banners" on storage.objects;
create policy "Event owners can upload event banners"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'event-banners'
    and exists (
      select 1
      from public.events e
      where e.id::text = (storage.foldername(name))[1]
        and e.user_id = auth.uid()
    )
  );

drop policy if exists "Event owners can update event banners" on storage.objects;
create policy "Event owners can update event banners"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'event-banners'
    and exists (
      select 1
      from public.events e
      where e.id::text = (storage.foldername(name))[1]
        and e.user_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'event-banners'
    and exists (
      select 1
      from public.events e
      where e.id::text = (storage.foldername(name))[1]
        and e.user_id = auth.uid()
    )
  );

drop policy if exists "Event owners can delete event banners" on storage.objects;
create policy "Event owners can delete event banners"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'event-banners'
    and exists (
      select 1
      from public.events e
      where e.id::text = (storage.foldername(name))[1]
        and e.user_id = auth.uid()
    )
  );
