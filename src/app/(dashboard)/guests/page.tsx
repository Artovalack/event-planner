import PlannerSection from '@/components/planner/PlannerSection';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getActiveEvent } from '@/lib/planner';
import type { GuestRow } from '@/types/database';

export default async function GuestsPage() {
    const event = await getActiveEvent();
    if (!event) return <section className="planner-page"><div className="empty-state"><h1>Select an event to get started</h1><p>Create an event before adding guests.</p><a className="primary-button" href="/events">Go to events</a></div></section>;

    const { data, error } = await getSupabaseServerClient()
        .from('guests').select('*').eq('event_id', event.id).order('name');
    if (error) throw new Error(`Unable to load guests: ${error.message}`);
    return <PlannerSection kind="guests" event={event} guests={(data ?? []) as GuestRow[]} />;
}
