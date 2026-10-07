create table if not exists public.user_notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_deadlines boolean not null default false,
  in_app_deadlines boolean not null default true,
  email_guest_rsvps boolean not null default false,
  in_app_guest_rsvps boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.user_notification_preferences enable row level security;

revoke all on public.user_notification_preferences from anon, authenticated;
grant select, insert, update on public.user_notification_preferences to authenticated;

drop policy if exists "Users can manage their notification preferences"
  on public.user_notification_preferences;
create policy "Users can manage their notification preferences"
  on public.user_notification_preferences for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
