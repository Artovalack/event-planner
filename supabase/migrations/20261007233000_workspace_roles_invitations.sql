create table if not exists public.event_members (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  role text not null check (role in ('collaborator', 'viewer')),
  joined_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index if not exists event_members_user_idx
  on public.event_members(user_id, event_id);

create table if not exists public.event_invitations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  email text not null check (length(trim(email)) between 3 and 320),
  role text not null check (role in ('collaborator', 'viewer')),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  invited_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  constraint event_invitations_expiry_check check (expires_at > created_at)
);

create index if not exists event_invitations_event_email_idx
  on public.event_invitations(event_id, lower(email), expires_at desc)
  where accepted_at is null;

create or replace function public.has_event_role(p_event_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1 from public.events e
    where e.id = p_event_id and e.user_id = auth.uid() and 'admin' = any(p_roles)
  ) or exists (
    select 1 from public.event_members m
    where m.event_id = p_event_id
      and m.user_id = auth.uid()
      and m.role = any(p_roles)
  );
$$;

create or replace function public.get_event_role(p_event_id uuid)
returns text
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select case
    when exists (
      select 1 from public.events e
      where e.id = p_event_id and e.user_id = auth.uid()
    ) then 'admin'
    else (
      select m.role from public.event_members m
      where m.event_id = p_event_id and m.user_id = auth.uid()
    )
  end;
$$;

alter table public.event_members enable row level security;
alter table public.event_invitations enable row level security;

drop policy if exists "Members can view their event membership" on public.event_members;
create policy "Members can view their event membership"
  on public.event_members for select to authenticated
  using (
    user_id = auth.uid()
    or public.has_event_role(event_id, array['admin']::text[])
  );

drop policy if exists "Event admins can manage memberships" on public.event_members;
create policy "Event admins can manage memberships"
  on public.event_members for all to authenticated
  using (public.has_event_role(event_id, array['admin']::text[]))
  with check (public.has_event_role(event_id, array['admin']::text[]));

drop policy if exists "Event admins can view invitations" on public.event_invitations;
create policy "Event admins can view invitations"
  on public.event_invitations for select to authenticated
  using (public.has_event_role(event_id, array['admin']::text[]));

drop policy if exists "Event admins can create invitations" on public.event_invitations;
create policy "Event admins can create invitations"
  on public.event_invitations for insert to authenticated
  with check (
    public.has_event_role(event_id, array['admin']::text[])
    and invited_by = auth.uid()
  );

drop policy if exists "Event admins can revoke invitations" on public.event_invitations;
create policy "Event admins can revoke invitations"
  on public.event_invitations for delete to authenticated
  using (public.has_event_role(event_id, array['admin']::text[]));

revoke all on public.event_members from anon, authenticated;
grant select, delete on public.event_members to authenticated;
revoke insert, update, delete on public.event_invitations from anon, authenticated;
grant select, insert, delete on public.event_invitations to authenticated;

create or replace function public.get_workspace_invitation(p_event_id uuid, p_token text)
returns table (event_title text, invite_email text, invite_role text, expires_at timestamptz)
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select e.title::text, i.email, i.role, i.expires_at
  from public.event_invitations i
  join public.events e on e.id = i.event_id
  where i.event_id = p_event_id
    and i.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and i.accepted_at is null
    and i.expires_at > now()
    and length(p_token) = 43;
$$;

create or replace function public.accept_workspace_invitation(p_event_id uuid, p_token text)
returns table (accepted_event_id uuid, event_title text)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  caller_id uuid := auth.uid();
  caller_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  invitation public.event_invitations%rowtype;
  selected_event_title text;
begin
  if caller_id is null or caller_email = '' then
    raise exception 'Sign in with the email address that received this invitation.';
  end if;

  select i.* into invitation
  from public.event_invitations i
  where i.event_id = p_event_id
    and i.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and length(p_token) = 43
    and i.accepted_at is null
    and i.expires_at > now()
  for update;

  if not found then
    raise exception 'This invitation is invalid, expired, or already used.';
  end if;

  if lower(invitation.email) <> caller_email then
    raise exception 'Sign in with the email address that received this invitation.';
  end if;

  if exists (
    select 1 from public.events e
    where e.id = p_event_id and e.user_id = caller_id
  ) then
    raise exception 'You already own this event.';
  end if;

  insert into public.event_members (event_id, user_id, email, role)
  values (p_event_id, caller_id, caller_email, invitation.role)
  on conflict (event_id, user_id) do update
    set email = excluded.email,
        role = excluded.role;

  update public.event_invitations
  set accepted_at = now()
  where id = invitation.id;

  select e.title into selected_event_title
  from public.events e
  where e.id = p_event_id;

  return query select p_event_id, selected_event_title;
end;
$$;

revoke all on function public.has_event_role(uuid, text[]) from public, anon;
revoke all on function public.get_event_role(uuid) from public, anon;
revoke all on function public.get_workspace_invitation(uuid, text) from public, anon, authenticated;
revoke all on function public.accept_workspace_invitation(uuid, text) from public, anon, authenticated;
grant execute on function public.has_event_role(uuid, text[]) to authenticated;
grant execute on function public.get_event_role(uuid) to authenticated;
grant execute on function public.get_workspace_invitation(uuid, text) to authenticated;
grant execute on function public.accept_workspace_invitation(uuid, text) to authenticated;

drop policy if exists "Authenticated users can view events" on public.events;
create policy "Event members can view events"
  on public.events for select to authenticated
  using (public.has_event_role(id, array['admin', 'collaborator', 'viewer']::text[]));

drop policy if exists "Authenticated users can update events" on public.events;
create policy "Event admins can update events"
  on public.events for update to authenticated
  using (public.has_event_role(id, array['admin']::text[]))
  with check (public.has_event_role(id, array['admin']::text[]) and user_id = auth.uid());

drop policy if exists "Authenticated users can delete events" on public.events;
create policy "Event admins can delete events"
  on public.events for delete to authenticated
  using (public.has_event_role(id, array['admin']::text[]));

drop policy if exists "Authenticated users can manage tasks" on public.tasks;
create policy "Event members can read tasks"
  on public.tasks for select to authenticated
  using (public.has_event_role(event_id, array['admin', 'collaborator', 'viewer']::text[]));
create policy "Event editors can manage tasks"
  on public.tasks for all to authenticated
  using (public.has_event_role(event_id, array['admin', 'collaborator']::text[]))
  with check (public.has_event_role(event_id, array['admin', 'collaborator']::text[]));

drop policy if exists "Authenticated users can manage subtasks" on public.subtasks;
create policy "Event members can read subtasks"
  on public.subtasks for select to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = subtasks.task_id
        and public.has_event_role(t.event_id, array['admin', 'collaborator', 'viewer']::text[])
    )
  );
create policy "Event editors can manage subtasks"
  on public.subtasks for all to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = subtasks.task_id
        and public.has_event_role(t.event_id, array['admin', 'collaborator']::text[])
    )
  )
  with check (
    exists (
      select 1 from public.tasks t
      where t.id = subtasks.task_id
        and public.has_event_role(t.event_id, array['admin', 'collaborator']::text[])
    )
  );

drop policy if exists "Authenticated users can manage guests" on public.guests;
create policy "Event members can read guests"
  on public.guests for select to authenticated
  using (public.has_event_role(event_id, array['admin', 'collaborator', 'viewer']::text[]));
create policy "Event editors can manage guests"
  on public.guests for all to authenticated
  using (public.has_event_role(event_id, array['admin', 'collaborator']::text[]))
  with check (public.has_event_role(event_id, array['admin', 'collaborator']::text[]));

drop policy if exists "Authenticated users can manage budget items" on public.budget_items;
create policy "Event members can read budget items"
  on public.budget_items for select to authenticated
  using (public.has_event_role(event_id, array['admin', 'collaborator', 'viewer']::text[]));
create policy "Event editors can manage budget items"
  on public.budget_items for all to authenticated
  using (public.has_event_role(event_id, array['admin', 'collaborator']::text[]))
  with check (public.has_event_role(event_id, array['admin', 'collaborator']::text[]));

drop policy if exists "Authenticated users can manage vendors" on public.vendors;
create policy "Event editors can manage vendors"
  on public.vendors for all to authenticated
  using (public.has_event_role(event_id, array['admin', 'collaborator']::text[]))
  with check (public.has_event_role(event_id, array['admin', 'collaborator']::text[]));

drop policy if exists "Event owners can manage vendor payment milestones" on public.vendor_payment_milestones;
create policy "Event members can read vendor payment milestones"
  on public.vendor_payment_milestones for select to authenticated
  using (public.has_event_role(event_id, array['admin', 'collaborator', 'viewer']::text[]));
create policy "Event editors can manage vendor payment milestones"
  on public.vendor_payment_milestones for all to authenticated
  using (public.has_event_role(event_id, array['admin', 'collaborator']::text[]))
  with check (public.has_event_role(event_id, array['admin', 'collaborator']::text[]));

drop policy if exists "Event owners can manage schedule items" on public.event_schedule_items;
create policy "Event members can read schedule items"
  on public.event_schedule_items for select to authenticated
  using (public.has_event_role(event_id, array['admin', 'collaborator', 'viewer']::text[]));
create policy "Event editors can manage schedule items"
  on public.event_schedule_items for all to authenticated
  using (public.has_event_role(event_id, array['admin', 'collaborator']::text[]))
  with check (public.has_event_role(event_id, array['admin', 'collaborator']::text[]));

drop policy if exists "Event owners can manage seating tables" on public.seating_tables;
create policy "Event members can read seating tables"
  on public.seating_tables for select to authenticated
  using (public.has_event_role(event_id, array['admin', 'collaborator', 'viewer']::text[]));
create policy "Event editors can manage seating tables"
  on public.seating_tables for all to authenticated
  using (public.has_event_role(event_id, array['admin', 'collaborator']::text[]))
  with check (public.has_event_role(event_id, array['admin', 'collaborator']::text[]));

drop policy if exists "Event owners can view seating assignments" on public.guest_seating_assignments;
create policy "Event members can read seating assignments"
  on public.guest_seating_assignments for select to authenticated
  using (public.has_event_role(event_id, array['admin', 'collaborator', 'viewer']::text[]));

drop policy if exists "Event owners can view vendor contracts" on public.vendor_contracts;
create policy "Event editors can view vendor contracts"
  on public.vendor_contracts for select to authenticated
  using (public.has_event_role(event_id, array['admin', 'collaborator']::text[]));

drop policy if exists "Event owners can add vendor contracts" on public.vendor_contracts;
create policy "Event editors can add vendor contracts"
  on public.vendor_contracts for insert to authenticated
  with check (public.has_event_role(event_id, array['admin', 'collaborator']::text[]));

drop policy if exists "Event owners can delete vendor contracts" on public.vendor_contracts;
create policy "Event editors can delete vendor contracts"
  on public.vendor_contracts for delete to authenticated
  using (public.has_event_role(event_id, array['admin', 'collaborator']::text[]));

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
set search_path = pg_catalog, public
as $$
declare
  saved_task_id uuid;
begin
  if not public.has_event_role(p_event_id, array['admin', 'collaborator']::text[]) then
    raise exception 'The selected event is not available for editing.';
  end if;

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

drop policy if exists "Event owners can read event banners" on storage.objects;
create policy "Event members can read event banners"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'event-banners'
    and public.has_event_role(((storage.foldername(name))[1])::uuid, array['admin', 'collaborator', 'viewer']::text[])
  );

drop policy if exists "Event owners can upload event banners" on storage.objects;
create policy "Event admins can upload event banners"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'event-banners'
    and public.has_event_role(((storage.foldername(name))[1])::uuid, array['admin']::text[])
  );

drop policy if exists "Event owners can update event banners" on storage.objects;
create policy "Event admins can update event banners"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'event-banners'
    and public.has_event_role(((storage.foldername(name))[1])::uuid, array['admin']::text[])
  )
  with check (
    bucket_id = 'event-banners'
    and public.has_event_role(((storage.foldername(name))[1])::uuid, array['admin']::text[])
  );

drop policy if exists "Event owners can delete event banners" on storage.objects;
create policy "Event admins can delete event banners"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'event-banners'
    and public.has_event_role(((storage.foldername(name))[1])::uuid, array['admin']::text[])
  );

drop policy if exists "Event owners can read contract files" on storage.objects;
create policy "Event editors can read contract files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'vendor-contracts'
    and public.has_event_role(((storage.foldername(name))[1])::uuid, array['admin', 'collaborator']::text[])
  );

drop policy if exists "Event owners can upload contract files" on storage.objects;
create policy "Event editors can upload contract files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'vendor-contracts'
    and public.has_event_role(((storage.foldername(name))[1])::uuid, array['admin', 'collaborator']::text[])
    and exists (
      select 1 from public.vendors v
      where v.id::text = (storage.foldername(name))[2]
        and v.event_id::text = (storage.foldername(name))[1]
    )
  );

drop policy if exists "Event owners can delete contract files" on storage.objects;
create policy "Event editors can delete contract files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'vendor-contracts'
    and public.has_event_role(((storage.foldername(name))[1])::uuid, array['admin', 'collaborator']::text[])
  );

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
  if not public.has_event_role(p_event_id, array['admin', 'collaborator']::text[]) then
    raise exception 'The selected event is not available for editing.';
  end if;

  select g.* into selected_guest
  from public.guests g
  where g.id = p_guest_id and g.event_id = p_event_id
  for update;

  if not found then raise exception 'The selected guest is not available for this event.'; end if;
  if selected_guest.rsvp_status = 'declined' then raise exception 'Guests who declined cannot be assigned to a table.'; end if;

  if p_seating_table_id is null then
    delete from public.guest_seating_assignments a
    where a.event_id = p_event_id and a.guest_id = p_guest_id;
    return;
  end if;

  select t.* into selected_table
  from public.seating_tables t
  where t.id = p_seating_table_id and t.event_id = p_event_id
  for update;

  if not found then raise exception 'The selected table is not available for this event.'; end if;

  select coalesce(sum(
    case
      when g.rsvp_status = 'confirmed' then 1 + g.rsvp_companion_adults + g.rsvp_companion_children + g.rsvp_companion_babies
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
  set seating_table_id = excluded.seating_table_id, assigned_at = now();
end;
$$;

revoke all on function public.save_task_with_subtasks(uuid, uuid, text, text, date, text, jsonb) from public, anon;
grant execute on function public.save_task_with_subtasks(uuid, uuid, text, text, date, text, jsonb) to authenticated;
revoke all on function public.assign_guest_to_seating_table(uuid, uuid, uuid) from public, anon;
grant execute on function public.assign_guest_to_seating_table(uuid, uuid, uuid) to authenticated;

drop policy if exists "Event owners can view event banners" on storage.objects;
