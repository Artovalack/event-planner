alter table public.guests
  add column if not exists guest_tag text not null default 'guest';

alter table public.guests
  drop constraint if exists guests_guest_tag_check,
  add constraint guests_guest_tag_check
    check (guest_tag in ('guest', 'vip', 'family', 'vendor', 'sponsor'));

create index if not exists guests_event_tag_idx
  on public.guests(event_id, guest_tag);
