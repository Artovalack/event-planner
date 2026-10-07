alter table public.events
  add column if not exists currency_code text not null default 'PHP',
  add column if not exists timezone text not null default 'Asia/Manila',
  add column if not exists venue_name text,
  add column if not exists venue_address text,
  add column if not exists banner_path text;

alter table public.events
  drop constraint if exists events_currency_code_format,
  add constraint events_currency_code_format
    check (currency_code ~ '^[A-Z]{3}$'),
  drop constraint if exists events_timezone_not_blank,
  add constraint events_timezone_not_blank
    check (length(trim(timezone)) > 0);

create index if not exists events_date_idx
  on public.events(date);

create index if not exists tasks_event_due_date_idx
  on public.tasks(event_id, due_date)
  where due_date is not null;

create unique index if not exists vendors_id_event_id_uidx
  on public.vendors(id, event_id);

create unique index if not exists budget_items_id_event_id_uidx
  on public.budget_items(id, event_id);

create table if not exists public.vendor_payment_milestones (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  vendor_id uuid not null,
  budget_item_id uuid,
  label text not null check (length(trim(label)) > 0),
  amount numeric(12, 2) not null default 0 check (amount >= 0),
  due_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'cancelled')),
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vendor_payment_milestones_paid_at_status
    check ((status = 'paid') = (paid_at is not null)),
  constraint vendor_payment_milestones_vendor_event_fk
    foreign key (vendor_id, event_id)
    references public.vendors(id, event_id)
    on delete cascade,
  constraint vendor_payment_milestones_budget_event_fk
    foreign key (budget_item_id, event_id)
    references public.budget_items(id, event_id)
);

create index if not exists vendor_payment_milestones_event_due_idx
  on public.vendor_payment_milestones(event_id, due_at);

create index if not exists vendor_payment_milestones_vendor_idx
  on public.vendor_payment_milestones(vendor_id);

create index if not exists vendor_payment_milestones_budget_item_idx
  on public.vendor_payment_milestones(budget_item_id)
  where budget_item_id is not null;

alter table public.vendor_payment_milestones enable row level security;

drop policy if exists "Event owners can manage vendor payment milestones"
  on public.vendor_payment_milestones;
create policy "Event owners can manage vendor payment milestones"
  on public.vendor_payment_milestones
  for all to authenticated
  using (
    exists (
      select 1
      from public.events e
      where e.id = vendor_payment_milestones.event_id
        and e.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.events e
      where e.id = vendor_payment_milestones.event_id
        and e.user_id = auth.uid()
    )
  );

create table if not exists public.event_schedule_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  responsible_person text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_schedule_items_valid_time
    check (ends_at is null or ends_at > starts_at)
);

create index if not exists event_schedule_items_event_start_idx
  on public.event_schedule_items(event_id, starts_at, sort_order);

alter table public.event_schedule_items enable row level security;

drop policy if exists "Event owners can manage schedule items"
  on public.event_schedule_items;
create policy "Event owners can manage schedule items"
  on public.event_schedule_items
  for all to authenticated
  using (
    exists (
      select 1
      from public.events e
      where e.id = event_schedule_items.event_id
        and e.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.events e
      where e.id = event_schedule_items.event_id
        and e.user_id = auth.uid()
    )
  );

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists vendor_payment_milestones_set_updated_at
  on public.vendor_payment_milestones;
create trigger vendor_payment_milestones_set_updated_at
  before update on public.vendor_payment_milestones
  for each row execute function public.set_updated_at();

drop trigger if exists event_schedule_items_set_updated_at
  on public.event_schedule_items;
create trigger event_schedule_items_set_updated_at
  before update on public.event_schedule_items
  for each row execute function public.set_updated_at();
