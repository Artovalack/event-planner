create or replace function public.create_event_for_current_user(
  p_title text,
  p_description text,
  p_date timestamptz,
  p_location text
)
returns setof public.events
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  caller_id uuid := auth.uid();
  created_event public.events;
begin
  if caller_id is null then
    raise exception using
      errcode = '28000',
      message = 'Authentication required to create an event.';
  end if;

  if nullif(btrim(p_title), '') is null then
    raise exception using
      errcode = '22023',
      message = 'Event title is required.';
  end if;

  insert into public.events (user_id, title, description, date, location)
  values (caller_id, btrim(p_title), p_description, p_date, p_location)
  returning * into created_event;

  return next created_event;
end;
$$;

revoke all on function public.create_event_for_current_user(text, text, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.create_event_for_current_user(text, text, timestamptz, text)
  to authenticated;
