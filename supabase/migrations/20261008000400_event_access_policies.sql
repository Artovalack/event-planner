alter table public.events enable row level security;

drop policy if exists "Authenticated users can view events" on public.events;
drop policy if exists "Event members can view events" on public.events;
create policy "Event members can view events"
  on public.events for select to authenticated
  using (public.has_event_role(id, array['admin', 'collaborator', 'viewer']::text[]));

drop policy if exists "Authenticated users can create events" on public.events;
drop policy if exists "Event owners can create events" on public.events;
create policy "Event owners can create events"
  on public.events for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Authenticated users can update events" on public.events;
drop policy if exists "Event admins can update events" on public.events;
create policy "Event admins can update events"
  on public.events for update to authenticated
  using (public.has_event_role(id, array['admin']::text[]))
  with check (public.has_event_role(id, array['admin']::text[]) and user_id = auth.uid());

drop policy if exists "Authenticated users can delete events" on public.events;
drop policy if exists "Event admins can delete events" on public.events;
create policy "Event admins can delete events"
  on public.events for delete to authenticated
  using (public.has_event_role(id, array['admin']::text[]));
