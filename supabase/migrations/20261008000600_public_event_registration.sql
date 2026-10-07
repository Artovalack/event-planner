alter table public.events
  add column if not exists public_registration_token_hash text;

alter table public.events
  drop constraint if exists events_public_registration_token_hash_format,
  add constraint events_public_registration_token_hash_format
    check (
      public_registration_token_hash is null
      or public_registration_token_hash ~ '^[0-9a-f]{64}$'
    );

create table if not exists public.event_registration_requests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 160),
  email text not null check (length(trim(email)) between 3 and 320),
  companion_adults integer not null default 0 check (companion_adults between 0 and 50),
  companion_children integer not null default 0 check (companion_children between 0 and 50),
  companion_babies integer not null default 0 check (companion_babies between 0 and 50),
  note text check (note is null or length(note) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists event_registration_requests_event_status_idx
  on public.event_registration_requests(event_id, status, created_at desc);

create unique index if not exists event_registration_requests_active_email_uidx
  on public.event_registration_requests(event_id, lower(email))
  where status in ('pending', 'approved');

alter table public.event_registration_requests enable row level security;

drop policy if exists "Event editors can view registration requests" on public.event_registration_requests;
create policy "Event editors can view registration requests"
  on public.event_registration_requests for select to authenticated
  using (public.has_event_role(event_id, array['admin', 'collaborator']::text[]));

revoke all on public.event_registration_requests from anon, authenticated;
grant select on public.event_registration_requests to authenticated;

create or replace function public.get_public_event_registration(
  p_event_id uuid,
  p_token text
)
returns table (
  event_title text,
  event_date text,
  venue_name text,
  venue_address text
)
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select e.title::text, e.date::text, e.venue_name, e.venue_address
  from public.events e
  where e.id = p_event_id
    and p_token ~ '^[A-Za-z0-9_-]{43}$'
    and e.public_registration_token_hash =
      encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;

create or replace function public.submit_public_event_registration(
  p_event_id uuid,
  p_token text,
  p_name text,
  p_email text,
  p_companion_adults integer,
  p_companion_children integer,
  p_companion_babies integer,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  request_id uuid;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception 'This registration link is invalid or no longer active.';
  end if;

  if not exists (
    select 1
    from public.events e
    where e.id = p_event_id
      and e.public_registration_token_hash =
        encode(extensions.digest(p_token, 'sha256'), 'hex')
  ) then
    raise exception 'This registration link is invalid or no longer active.';
  end if;

  if p_name is null or length(trim(p_name)) not between 1 and 160 then
    raise exception 'Enter your name (up to 160 characters).';
  end if;

  if p_email is null
     or length(trim(p_email)) not between 3 and 320
     or trim(p_email) !~* '^[A-Z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
    raise exception 'Enter a valid email address.';
  end if;

  if p_companion_adults is null or p_companion_adults not between 0 and 50 then
    raise exception 'Additional adult count must be between 0 and 50.';
  end if;

  if p_companion_children is null or p_companion_children not between 0 and 50 then
    raise exception 'Child count must be between 0 and 50.';
  end if;

  if p_companion_babies is null or p_companion_babies not between 0 and 50 then
    raise exception 'Baby count must be between 0 and 50.';
  end if;

  if length(coalesce(p_note, '')) > 1000 then
    raise exception 'Your note must be 1000 characters or fewer.';
  end if;

  insert into public.event_registration_requests (
    event_id,
    name,
    email,
    companion_adults,
    companion_children,
    companion_babies,
    note
  )
  values (
    p_event_id,
    trim(p_name),
    trim(p_email),
    p_companion_adults,
    p_companion_children,
    p_companion_babies,
    nullif(trim(p_note), '')
  )
  returning id into request_id;

  return request_id;
exception
  when unique_violation then
    raise exception 'A registration request for this email is already pending or approved.';
end;
$$;

create or replace function public.set_event_registration_token(
  p_event_id uuid,
  p_token_hash text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null
     or not public.has_event_role(p_event_id, array['admin', 'collaborator']::text[]) then
    raise exception 'You do not have permission to manage this event registration link.';
  end if;

  if p_token_hash is not null and p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid registration link token.';
  end if;

  update public.events
  set public_registration_token_hash = p_token_hash
  where id = p_event_id;

  if not found then
    raise exception 'The selected event is not available.';
  end if;
end;
$$;

create or replace function public.review_event_registration_request(
  p_event_id uuid,
  p_request_id uuid,
  p_status text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  registration public.event_registration_requests%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if p_status is null or p_status not in ('approved', 'declined') then
    raise exception 'Choose approve or decline.';
  end if;

  select r.* into registration
  from public.event_registration_requests r
  where r.id = p_request_id
    and r.event_id = p_event_id
  for update;

  if not found
     or not public.has_event_role(registration.event_id, array['admin', 'collaborator']::text[]) then
    raise exception 'This registration request is not available.';
  end if;

  if registration.status <> 'pending' then
    raise exception 'This registration request has already been reviewed.';
  end if;

  if p_status = 'approved' then
    if exists (
      select 1
      from public.guests g
      where g.event_id = registration.event_id
        and lower(g.email) = lower(registration.email)
    ) then
      raise exception 'A guest with this email is already on the guest list.';
    end if;

    insert into public.guests (
      event_id,
      name,
      email,
      guest_tag,
      invitation_status,
      companion_adults,
      companion_children,
      companion_babies
    )
    values (
      registration.event_id,
      registration.name,
      registration.email,
      'guest',
      'not_sent',
      registration.companion_adults,
      registration.companion_children,
      registration.companion_babies
    );
  end if;

  update public.event_registration_requests
  set status = p_status,
      reviewed_at = now()
  where id = registration.id;

  return p_status;
exception
  when unique_violation then
    raise exception 'A guest with this email is already on the guest list.';
end;
$$;

revoke all on function public.get_public_event_registration(uuid, text) from public, anon, authenticated;
revoke all on function public.submit_public_event_registration(uuid, text, text, text, integer, integer, integer, text) from public, anon, authenticated;
revoke all on function public.set_event_registration_token(uuid, text) from public, anon, authenticated;
revoke all on function public.review_event_registration_request(uuid, uuid, text) from public, anon, authenticated;

grant execute on function public.get_public_event_registration(uuid, text) to anon, authenticated;
grant execute on function public.submit_public_event_registration(uuid, text, text, text, integer, integer, integer, text) to anon, authenticated;
grant execute on function public.set_event_registration_token(uuid, text) to authenticated;
grant execute on function public.review_event_registration_request(uuid, uuid, text) to authenticated;
