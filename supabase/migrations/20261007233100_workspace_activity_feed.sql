create table if not exists public.event_activity (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  actor_id uuid,
  actor_email text,
  action text not null check (action in ('created', 'updated', 'deleted')),
  entity_type text not null,
  created_at timestamptz not null default now()
);

create index if not exists event_activity_event_created_idx
  on public.event_activity(event_id, created_at desc, id desc);

alter table public.event_activity enable row level security;

revoke all on public.event_activity from anon, authenticated;
grant select on public.event_activity to authenticated;

create policy "Event members can read activity"
  on public.event_activity for select to authenticated
  using (public.has_event_role(event_id, array['admin', 'collaborator', 'viewer']::text[]));

create or replace function public.record_event_activity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  row_data jsonb;
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
    selected_action := 'updated';
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

revoke all on function public.record_event_activity() from public, anon, authenticated;

create trigger event_activity_events
  after insert or update on public.events
  for each row execute function public.record_event_activity('event');

create trigger event_activity_tasks
  after insert or update or delete on public.tasks
  for each row execute function public.record_event_activity('task');

create trigger event_activity_subtasks
  after insert or update or delete on public.subtasks
  for each row execute function public.record_event_activity('subtask');

create trigger event_activity_guests
  after insert or update or delete on public.guests
  for each row execute function public.record_event_activity('guest');

create trigger event_activity_budget_items
  after insert or update or delete on public.budget_items
  for each row execute function public.record_event_activity('budget item');

create trigger event_activity_vendors
  after insert or update or delete on public.vendors
  for each row execute function public.record_event_activity('vendor');

create trigger event_activity_vendor_payment_milestones
  after insert or update or delete on public.vendor_payment_milestones
  for each row execute function public.record_event_activity('vendor payment milestone');

create trigger event_activity_schedule_items
  after insert or update or delete on public.event_schedule_items
  for each row execute function public.record_event_activity('schedule item');

create trigger event_activity_seating_tables
  after insert or update or delete on public.seating_tables
  for each row execute function public.record_event_activity('seating table');

create trigger event_activity_guest_seating_assignments
  after insert or update or delete on public.guest_seating_assignments
  for each row execute function public.record_event_activity('seating assignment');

create trigger event_activity_vendor_contracts
  after insert or update or delete on public.vendor_contracts
  for each row execute function public.record_event_activity('vendor contract');

create trigger event_activity_event_members
  after insert or update or delete on public.event_members
  for each row execute function public.record_event_activity('team membership');

create trigger event_activity_event_invitations
  after insert or update or delete on public.event_invitations
  for each row execute function public.record_event_activity('invitation');

do $$
begin
  if exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_catalog.pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'event_activity'
     ) then
    execute 'alter publication supabase_realtime add table public.event_activity';
  end if;
end;
$$;
