import { cookies } from 'next/headers';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import type { EventRow } from '@/types/database';

export const ACTIVE_EVENT_COOKIE = 'planner_active_event';

export async function getPlannerEvents(): Promise<EventRow[]> {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('date', { ascending: true, nullsFirst: false });

    if (error) throw new Error(`Unable to load events: ${error.message}`);
    return (data ?? []) as EventRow[];
}

export async function getActiveEvent(): Promise<EventRow | null> {
    const events = await getPlannerEvents();
    const requestedId = cookies().get(ACTIVE_EVENT_COOKIE)?.value;
    const selected = events.find((event) => event.id === requestedId);
    if (selected) return selected;

    return events.find((event) => event.date && new Date(event.date).getTime() >= Date.now()) ?? events[0] ?? null;
}
