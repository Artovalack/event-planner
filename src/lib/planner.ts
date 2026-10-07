import { cookies } from 'next/headers';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import type { EventRow } from '@/types/database';

export const ACTIVE_EVENT_COOKIE = 'planner_active_event';

export function getActiveEventCookieName(userId?: string) {
    return userId ? `planner_active_event_${userId}` : ACTIVE_EVENT_COOKIE;
}

export async function getCurrentUserId() {
    const supabase = getSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw new Error('Authentication required.');
    return user.id;
}

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
    const userId = await getCurrentUserId();
    const events = await getPlannerEvents();
    const requestedId = cookies().get(getActiveEventCookieName(userId))?.value;
    const selected = events.find((event) => event.id === requestedId);
    if (selected) return selected;

    return events.find((event) => event.date && new Date(event.date).getTime() >= Date.now()) ?? events[0] ?? null;
}

export async function getEventRole(eventId: string): Promise<'admin' | 'collaborator' | 'viewer' | null> {
    const { data, error } = await getSupabaseServerClient().rpc('get_event_role', { p_event_id: eventId });
    if (error) throw new Error(`Unable to load event permissions: ${error.message}`);
    if (data === 'admin' || data === 'collaborator' || data === 'viewer') return data;
    return null;
}
