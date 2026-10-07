import PlannerSection from '@/components/planner/PlannerSection';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getActiveEvent, getEventRole } from '@/lib/planner';
import type { GuestRow } from '@/types/database';

export default async function GuestsPage() {
    const event = await getActiveEvent();
    if (!event) return <section className="planner-page"><div className="empty-state"><h1>Select an event to get started</h1><p>Create an event before adding guests.</p><a className="primary-button" href="/events">Go to events</a></div></section>;
    const role = await getEventRole(event.id);
    if (!role) throw new Error('You do not have access to this event.');

    const { data, error } = await getSupabaseServerClient()
        .from('guests')
        .select('id, event_id, name, email, guest_tag, invitation_status, rsvp_status, companion_adults, companion_children, companion_babies, total_companions, rsvp_companion_adults, rsvp_companion_children, rsvp_companion_babies, meal_preference, allergies, rsvp_updated_at, created_at')
        .eq('event_id', event.id)
        .order('name');
    if (error) throw new Error(`Unable to load guests: ${error.message}`);
    return <PlannerSection kind="guests" event={event} canEdit={role !== 'viewer'} guests={(data ?? []) as GuestRow[]} />;
}
