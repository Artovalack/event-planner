create table if not exists public.seating_tables (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  capacity integer not null check (capacity between 1 and 500),
  shape text not null default 'round' check (shape in ('round', 'rectangle')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (id, event_id)
);

create index if not exists seating_tables_event_order_idx
  on public.seating_tables(event_id, sort_order, name);

create unique index if not exists guests_id_event_id_uidx
  on public.guests(id, event_id);

create table if not exists public.guest_seating_assignments (
  event_id uuid not null references public.events(id) on delete cascade,
  guest_id uuid not null,
  seating_table_id uuid not null,
  assigned_at timestamptz not null default now(),
  primary key (guest_id),
  constraint guest_seating_assignments_guest_event_fk
    foreign key (guest_id, event_id)
    references public.guests(id, event_id)
    on delete cascade,
  constraint guest_seating_assignments_table_event_fk
    foreign key (seating_table_id, event_id)
    references public.seating_tables(id, event_id)
    on delete cascade
);

create index if not exists guest_seating_assignments_event_table_idx
  on public.guest_seating_assignments(event_id, seating_table_id);

alter table public.seating_tables enable row level security;
alter table public.guest_seating_assignments enable row level security;

drop policy if exists "Event owners can manage seating tables" on public.seating_tables;
create policy "Event owners can manage seating tables"
  on public.seating_tables
  for all to authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = seating_tables.event_id and e.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.events e
      where e.id = seating_tables.event_id and e.user_id = auth.uid()
    )
  );

drop policy if exists "Event owners can view seating assignments" on public.guest_seating_assignments;
create policy "Event owners can view seating assignments"
  on public.guest_seating_assignments
  for select to authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = guest_seating_assignments.event_id and e.user_id = auth.uid()
    )
  );

revoke insert, update, delete on public.guest_seating_assignments from anon, authenticated;
grant select on public.guest_seating_assignments to authenticated;
grant select, insert, update, delete on public.seating_tables to authenticated;

create or replace function public.assign_guest_to_seating_table(
  p_event_id uuid,
  p_guest_id uuid,
  p_seating_table_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  selected_guest public.guests%rowtype;
  selected_table public.seating_tables%rowtype;
  occupied_seats integer;
begin
  if auth.uid() is null or not exists (
    select 1 from public.events e
    where e.id = p_event_id and e.user_id = auth.uid()
  ) then
    raise exception 'The selected event is not available.';
  end if;

  select g.* into selected_guest
  from public.guests g
  where g.id = p_guest_id and g.event_id = p_event_id
  for update;

  if not found then
    raise exception 'The selected guest is not available for this event.';
  end if;

  if selected_guest.rsvp_status = 'declined' then
    raise exception 'Guests who declined cannot be assigned to a table.';
  end if;

  if p_seating_table_id is null then
    delete from public.guest_seating_assignments a
    where a.event_id = p_event_id and a.guest_id = p_guest_id;
    return;
  end if;

  select t.* into selected_table
  from public.seating_tables t
  where t.id = p_seating_table_id and t.event_id = p_event_id
  for update;

  if not found then
    raise exception 'The selected table is not available for this event.';
  end if;

  select coalesce(sum(
    case
      when g.rsvp_status = 'confirmed' then
        1 + g.rsvp_companion_adults + g.rsvp_companion_children + g.rsvp_companion_babies
      when g.rsvp_status = 'declined' then 0
      else 1
    end
  ), 0)::integer into occupied_seats
  from public.guest_seating_assignments a
  join public.guests g on g.id = a.guest_id and g.event_id = a.event_id
  where a.event_id = p_event_id
    and a.seating_table_id = p_seating_table_id
    and a.guest_id <> p_guest_id;

  if occupied_seats + (case
    when selected_guest.rsvp_status = 'confirmed' then
      1 + selected_guest.rsvp_companion_adults + selected_guest.rsvp_companion_children + selected_guest.rsvp_companion_babies
    else 1
  end) > selected_table.capacity then
    raise exception 'This table does not have enough seats for this guest party.';
  end if;

  insert into public.guest_seating_assignments (event_id, guest_id, seating_table_id)
  values (p_event_id, p_guest_id, p_seating_table_id)
  on conflict (guest_id) do update
  set event_id = excluded.event_id,
      seating_table_id = excluded.seating_table_id,
      assigned_at = now();
end;
$$;

revoke all on function public.assign_guest_to_seating_table(uuid, uuid, uuid) from public, anon;
grant execute on function public.assign_guest_to_seating_table(uuid, uuid, uuid) to authenticated;

create or replace function public.check_guest_seating_capacity()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
declare
  table_capacity integer;
  occupied_seats integer;
  guest_seats integer;
begin
  if tg_op = 'UPDATE' and new.rsvp_status = old.rsvp_status
     and new.rsvp_companion_adults = old.rsvp_companion_adults
     and new.rsvp_companion_children = old.rsvp_companion_children
     and new.rsvp_companion_babies = old.rsvp_companion_babies then
    return new;
  end if;

  select t.capacity into table_capacity
  from public.guest_seating_assignments a
  join public.seating_tables t on t.id = a.seating_table_id and t.event_id = a.event_id
  where a.guest_id = new.id and a.event_id = new.event_id
  for update of t;

  if not found then
    return new;
  end if;

  if new.rsvp_status = 'declined' then
    guest_seats := 0;
  elsif new.rsvp_status = 'confirmed' then
    guest_seats := 1 + new.rsvp_companion_adults + new.rsvp_companion_children + new.rsvp_companion_babies;
  else
    guest_seats := 1;
  end if;

  select coalesce(sum(
    case
      when g.rsvp_status = 'confirmed' then
        1 + g.rsvp_companion_adults + g.rsvp_companion_children + g.rsvp_companion_babies
      when g.rsvp_status = 'declined' then 0
      else 1
    end
  ), 0)::integer into occupied_seats
  from public.guest_seating_assignments a
  join public.guests g on g.id = a.guest_id and g.event_id = a.event_id
  where a.seating_table_id = (
    select a2.seating_table_id from public.guest_seating_assignments a2
    where a2.guest_id = new.id and a2.event_id = new.event_id
  )
    and a.event_id = new.event_id
    and a.guest_id <> new.id;

  if occupied_seats + guest_seats > table_capacity then
    raise exception 'This RSVP would exceed the capacity of the assigned table. Please contact the event organizer.';
  end if;

  return new;
end;
$$;

drop trigger if exists guests_check_seating_capacity on public.guests;
create trigger guests_check_seating_capacity
  before update of rsvp_status, rsvp_companion_adults, rsvp_companion_children, rsvp_companion_babies
  on public.guests
  for each row execute function public.check_guest_seating_capacity();

create or replace function public.check_seating_table_capacity()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
declare
  occupied_seats integer;
begin
  if new.capacity >= old.capacity then
    return new;
  end if;

  select coalesce(sum(
    case
      when g.rsvp_status = 'confirmed' then
        1 + g.rsvp_companion_adults + g.rsvp_companion_children + g.rsvp_companion_babies
      when g.rsvp_status = 'declined' then 0
      else 1
    end
  ), 0)::integer into occupied_seats
  from public.guest_seating_assignments a
  join public.guests g on g.id = a.guest_id and g.event_id = a.event_id
  where a.seating_table_id = old.id and a.event_id = old.event_id;

  if occupied_seats > new.capacity then
    raise exception 'Table capacity cannot be lower than the number of assigned seats.';
  end if;

  return new;
end;
$$;

drop trigger if exists seating_tables_check_capacity on public.seating_tables;
create trigger seating_tables_check_capacity
  before update of capacity on public.seating_tables
  for each row execute function public.check_seating_table_capacity();
