create or replace function public.record_event_activity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  row_data jsonb;
  old_row_data jsonb;
  new_row_data jsonb;
  selected_event_id uuid;
  selected_actor_id uuid := auth.uid();
  selected_action text;
  selected_entity_type text := tg_argv[0];
begin
  if tg_op = 'DELETE' then
    row_data := to_jsonb(old);
    selected_action := 'deleted';
  elsif tg_op = 'UPDATE' then
    row_data := to_jsonb(new);
    old_row_data := to_jsonb(old);
    new_row_data := row_data;
    selected_action := 'updated';

    if selected_entity_type = 'guest' and (
      old_row_data -> 'rsvp_status' is distinct from new_row_data -> 'rsvp_status'
      or old_row_data -> 'rsvp_companion_adults' is distinct from new_row_data -> 'rsvp_companion_adults'
      or old_row_data -> 'rsvp_companion_children' is distinct from new_row_data -> 'rsvp_companion_children'
      or old_row_data -> 'rsvp_companion_babies' is distinct from new_row_data -> 'rsvp_companion_babies'
      or old_row_data -> 'meal_preference' is distinct from new_row_data -> 'meal_preference'
      or old_row_data -> 'allergies' is distinct from new_row_data -> 'allergies'
      or old_row_data -> 'rsvp_updated_at' is distinct from new_row_data -> 'rsvp_updated_at'
    ) then
      selected_entity_type := 'guest RSVP';
    end if;
  else
    row_data := to_jsonb(new);
    selected_action := 'created';
  end if;

  selected_event_id := nullif(row_data ->> 'event_id', '')::uuid;
  if selected_event_id is null and selected_entity_type = 'event' then
    selected_event_id := nullif(row_data ->> 'id', '')::uuid;
  elsif selected_event_id is null and selected_entity_type = 'subtask' then
    select t.event_id into selected_event_id
    from public.tasks t
    where t.id = nullif(row_data ->> 'task_id', '')::uuid;
  end if;

  if selected_event_id is not null and exists (
    select 1 from public.events e where e.id = selected_event_id
  ) then
    insert into public.event_activity (
      event_id,
      actor_id,
      actor_email,
      action,
      entity_type
    )
    values (
      selected_event_id,
      selected_actor_id,
      nullif(auth.jwt() ->> 'email', ''),
      selected_action,
      selected_entity_type
    );
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
