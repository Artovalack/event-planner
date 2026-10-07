create extension if not exists pgcrypto;

alter table public.guests
  drop constraint if exists guests_invitation_status_check,
  add constraint guests_invitation_status_check
    check (invitation_status in ('not_sent', 'sent', 'opened', 'confirmed', 'declined')),
  add column if not exists rsvp_token_hash text,
  add column if not exists rsvp_status text not null default 'pending',
  add column if not exists rsvp_companion_adults integer not null default 0,
  add column if not exists rsvp_companion_children integer not null default 0,
  add column if not exists rsvp_companion_babies integer not null default 0,
  add column if not exists meal_preference text,
  add column if not exists allergies text,
  add column if not exists rsvp_updated_at timestamptz;

alter table public.guests
  add constraint guests_rsvp_status_check
    check (rsvp_status in ('pending', 'confirmed', 'declined')),
  add constraint guests_rsvp_token_hash_format
    check (rsvp_token_hash is null or rsvp_token_hash ~ '^[0-9a-f]{64}$'),
  add constraint guests_rsvp_companion_adults_check
    check (rsvp_companion_adults between 0 and companion_adults),
  add constraint guests_rsvp_companion_children_check
    check (rsvp_companion_children between 0 and companion_children),
  add constraint guests_rsvp_companion_babies_check
    check (rsvp_companion_babies between 0 and companion_babies),
  add constraint guests_rsvp_status_invitation_check
    check (
      (rsvp_status = 'pending' and invitation_status in ('not_sent', 'sent', 'opened'))
      or (rsvp_status = 'confirmed' and invitation_status = 'confirmed')
      or (rsvp_status = 'declined' and invitation_status = 'declined')
    );

create unique index if not exists guests_rsvp_token_hash_uidx
  on public.guests(rsvp_token_hash)
  where rsvp_token_hash is not null;

create or replace function public.get_public_guest_rsvp(
  p_event_id uuid,
  p_token text
)
returns table (
  event_title text,
  event_date text,
  venue_name text,
  venue_address text,
  guest_name text,
  invitation_status text,
  rsvp_status text,
  companion_adults integer,
  companion_children integer,
  companion_babies integer,
  rsvp_companion_adults integer,
  rsvp_companion_children integer,
  rsvp_companion_babies integer,
  meal_preference text,
  allergies text
)
language plpgsql
security definer
set search_path = pg_catalog, extensions, public
as $$
begin
  if p_token is null or length(p_token) < 32 or length(p_token) > 128 then
    return;
  end if;

  return query
  with matched_guest as (
    update public.guests g
    set invitation_status = case
      when g.invitation_status = 'sent' and g.rsvp_status = 'pending' then 'opened'
      else g.invitation_status
    end
    where g.event_id = p_event_id
      and g.rsvp_token_hash = encode(digest(p_token, 'sha256'), 'hex')
    returning g.*
  )
  select
    e.title::text,
    e.date::text,
    e.venue_name,
    e.venue_address,
    g.name,
    g.invitation_status,
    g.rsvp_status,
    g.companion_adults,
    g.companion_children,
    g.companion_babies,
    g.rsvp_companion_adults,
    g.rsvp_companion_children,
    g.rsvp_companion_babies,
    g.meal_preference,
    g.allergies
  from matched_guest g
  join public.events e on e.id = g.event_id;
end;
$$;

create or replace function public.submit_public_guest_rsvp(
  p_event_id uuid,
  p_token text,
  p_rsvp_status text,
  p_companion_adults integer,
  p_companion_children integer,
  p_companion_babies integer,
  p_meal_preference text,
  p_allergies text
)
returns table (
  saved_rsvp_status text,
  saved_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, extensions, public
as $$
begin
  if p_token is null or length(p_token) < 32 or length(p_token) > 128 then
    raise exception 'This RSVP link is invalid or expired.';
  end if;

  if p_rsvp_status is null or p_rsvp_status not in ('confirmed', 'declined') then
    raise exception 'Choose whether you can attend.';
  end if;

  if coalesce(p_companion_adults, -1) < 0
     or coalesce(p_companion_children, -1) < 0
     or coalesce(p_companion_babies, -1) < 0
     or p_companion_adults > 50
     or p_companion_children > 50
     or p_companion_babies > 50 then
    raise exception 'Companion counts must be between 0 and 50.';
  end if;

  if length(coalesce(p_meal_preference, '')) > 120 then
    raise exception 'Meal preference must be 120 characters or fewer.';
  end if;

  if length(coalesce(p_allergies, '')) > 1000 then
    raise exception 'Allergy notes must be 1000 characters or fewer.';
  end if;

  return query
  update public.guests g
  set rsvp_status = p_rsvp_status,
      invitation_status = p_rsvp_status,
      rsvp_companion_adults = case when p_rsvp_status = 'confirmed' then p_companion_adults else 0 end,
      rsvp_companion_children = case when p_rsvp_status = 'confirmed' then p_companion_children else 0 end,
      rsvp_companion_babies = case when p_rsvp_status = 'confirmed' then p_companion_babies else 0 end,
      meal_preference = case when p_rsvp_status = 'confirmed' then nullif(trim(p_meal_preference), '') else null end,
      allergies = case when p_rsvp_status = 'confirmed' then nullif(trim(p_allergies), '') else null end,
      rsvp_updated_at = now()
  where g.event_id = p_event_id
    and g.rsvp_token_hash = encode(digest(p_token, 'sha256'), 'hex')
    and g.rsvp_companion_adults <= g.companion_adults
    and g.rsvp_companion_children <= g.companion_children
    and g.rsvp_companion_babies <= g.companion_babies
    and p_companion_adults <= g.companion_adults
    and p_companion_children <= g.companion_children
    and p_companion_babies <= g.companion_babies
  returning g.rsvp_status, g.rsvp_updated_at;

  if not found then
    raise exception 'This RSVP link is invalid or companion counts exceed the invitation.';
  end if;
end;
$$;

revoke all on function public.get_public_guest_rsvp(uuid, text) from public, anon, authenticated;
revoke all on function public.submit_public_guest_rsvp(uuid, text, text, integer, integer, integer, text, text) from public, anon, authenticated;
grant execute on function public.get_public_guest_rsvp(uuid, text) to anon, authenticated;
grant execute on function public.submit_public_guest_rsvp(uuid, text, text, integer, integer, integer, text, text) to anon, authenticated;
