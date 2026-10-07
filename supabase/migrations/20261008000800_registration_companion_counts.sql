alter table public.event_registration_requests
  add column if not exists companion_children integer not null default 0
    check (companion_children between 0 and 50),
  add column if not exists companion_babies integer not null default 0
    check (companion_babies between 0 and 50);

drop function if exists public.submit_public_event_registration(uuid, text, text, text, integer, text);
drop function if exists public.submit_public_event_registration(uuid, text, text, text, integer, integer, integer, text);

create function public.submit_public_event_registration(
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

revoke all on function public.submit_public_event_registration(uuid, text, text, text, integer, integer, integer, text) from public, anon, authenticated;
grant execute on function public.submit_public_event_registration(uuid, text, text, text, integer, integer, integer, text) to anon, authenticated;
