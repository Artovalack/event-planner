insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vendor-contracts',
  'vendor-contracts',
  false,
  20971520,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.vendor_contracts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  vendor_id uuid not null,
  storage_path text not null unique,
  file_name text not null check (length(trim(file_name)) between 1 and 255),
  content_type text not null check (
    content_type in (
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
  ),
  file_size bigint not null check (file_size between 1 and 20971520),
  uploaded_at timestamptz not null default now(),
  constraint vendor_contracts_vendor_event_fk
    foreign key (vendor_id, event_id)
    references public.vendors(id, event_id)
    on delete cascade,
  constraint vendor_contracts_storage_path_scope
    check (storage_path like event_id::text || '/' || vendor_id::text || '/%')
);

create index if not exists vendor_contracts_vendor_uploaded_idx
  on public.vendor_contracts(event_id, vendor_id, uploaded_at desc);

alter table public.vendor_contracts enable row level security;

drop policy if exists "Event owners can view vendor contracts" on public.vendor_contracts;
create policy "Event owners can view vendor contracts"
  on public.vendor_contracts for select to authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = vendor_contracts.event_id and e.user_id = auth.uid()
    )
  );

drop policy if exists "Event owners can add vendor contracts" on public.vendor_contracts;
create policy "Event owners can add vendor contracts"
  on public.vendor_contracts for insert to authenticated
  with check (
    exists (
      select 1 from public.events e
      where e.id = vendor_contracts.event_id and e.user_id = auth.uid()
    )
  );

drop policy if exists "Event owners can delete vendor contracts" on public.vendor_contracts;
create policy "Event owners can delete vendor contracts"
  on public.vendor_contracts for delete to authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = vendor_contracts.event_id and e.user_id = auth.uid()
    )
  );

drop policy if exists "Event owners can read contract files" on storage.objects;
create policy "Event owners can read contract files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'vendor-contracts'
    and exists (
      select 1
      from public.vendors v
      join public.events e on e.id = v.event_id
      where e.user_id = auth.uid()
        and e.id::text = (storage.foldername(name))[1]
        and v.id::text = (storage.foldername(name))[2]
    )
  );

drop policy if exists "Event owners can upload contract files" on storage.objects;
create policy "Event owners can upload contract files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'vendor-contracts'
    and exists (
      select 1
      from public.vendors v
      join public.events e on e.id = v.event_id
      where e.user_id = auth.uid()
        and e.id::text = (storage.foldername(name))[1]
        and v.id::text = (storage.foldername(name))[2]
    )
  );

drop policy if exists "Event owners can delete contract files" on storage.objects;
create policy "Event owners can delete contract files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'vendor-contracts'
    and exists (
      select 1
      from public.events e
      where e.user_id = auth.uid()
        and e.id::text = (storage.foldername(name))[1]
    )
  );
