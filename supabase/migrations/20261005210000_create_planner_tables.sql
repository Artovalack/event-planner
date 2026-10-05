create extension if not exists "pgcrypto";

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  category text not null default 'General',
  due_date date,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  is_completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  email text,
  invitation_status text not null default 'not_sent' check (invitation_status in ('sent', 'not_sent')),
  companion_adults integer not null default 0 check (companion_adults >= 0),
  companion_children integer not null default 0 check (companion_children >= 0),
  companion_babies integer not null default 0 check (companion_babies >= 0),
  total_companions integer generated always as (
    companion_adults + companion_children + companion_babies
  ) stored,
  created_at timestamptz not null default now()
);

create table if not exists public.budget_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  item_name text not null check (length(trim(item_name)) > 0),
  category text not null default 'General',
  estimated_cost numeric(12, 2) not null default 0 check (estimated_cost >= 0),
  actual_cost numeric(12, 2) not null default 0 check (actual_cost >= 0),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'completed')),
  created_at timestamptz not null default now()
);

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  vendor_name text not null check (length(trim(vendor_name)) > 0),
  category text not null default 'General',
  contact_person text,
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists tasks_event_id_idx on public.tasks(event_id);
create index if not exists subtasks_task_id_idx on public.subtasks(task_id);
create index if not exists guests_event_id_idx on public.guests(event_id);
create index if not exists budget_items_event_id_idx on public.budget_items(event_id);
create index if not exists vendors_event_id_idx on public.vendors(event_id);

alter table public.tasks enable row level security;
alter table public.subtasks enable row level security;
alter table public.guests enable row level security;
alter table public.budget_items enable row level security;
alter table public.vendors enable row level security;

drop policy if exists "Authenticated users can manage tasks" on public.tasks;
create policy "Authenticated users can manage tasks" on public.tasks
  for all to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can manage subtasks" on public.subtasks;
create policy "Authenticated users can manage subtasks" on public.subtasks
  for all to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can manage guests" on public.guests;
create policy "Authenticated users can manage guests" on public.guests
  for all to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can manage budget items" on public.budget_items;
create policy "Authenticated users can manage budget items" on public.budget_items
  for all to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can manage vendors" on public.vendors;
create policy "Authenticated users can manage vendors" on public.vendors
  for all to authenticated using (true) with check (true);

create or replace function public.save_task_with_subtasks(
  p_event_id uuid,
  p_task_id uuid,
  p_title text,
  p_category text,
  p_due_date date,
  p_notes text,
  p_subtasks jsonb
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  saved_task_id uuid;
begin
  if p_task_id is null then
    insert into public.tasks (event_id, title, category, due_date, notes)
    values (p_event_id, trim(p_title), coalesce(nullif(trim(p_category), ''), 'General'), p_due_date, p_notes)
    returning id into saved_task_id;
  else
    update public.tasks
    set title = trim(p_title),
        category = coalesce(nullif(trim(p_category), ''), 'General'),
        due_date = p_due_date,
        notes = p_notes
    where id = p_task_id and event_id = p_event_id
    returning id into saved_task_id;

    if saved_task_id is null then
      raise exception 'The selected task is not available for this event.';
    end if;

    delete from public.subtasks where task_id = saved_task_id;
  end if;

  insert into public.subtasks (task_id, title, is_completed)
  select saved_task_id, trim(item.title), coalesce(item.is_completed, false)
  from jsonb_to_recordset(coalesce(p_subtasks, '[]'::jsonb)) as item(title text, is_completed boolean)
  where length(trim(item.title)) > 0;

  return saved_task_id;
end;
$$;

revoke all on function public.save_task_with_subtasks(uuid, uuid, text, text, date, text, jsonb) from public, anon;
grant execute on function public.save_task_with_subtasks(uuid, uuid, text, text, date, text, jsonb) to authenticated;
