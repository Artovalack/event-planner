import PlannerSection from '@/components/planner/PlannerSection';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getActiveEvent, getEventRole } from '@/lib/planner';
import type { EventRegistrationRequestRow, GuestRow } from '@/types/database';

export default async function GuestsPage() {
    const event = await getActiveEvent();
    if (!event) return <section className="planner-page"><div className="empty-state"><h1>Select an event to get started</h1><p>Create an event before adding guests.</p><a className="primary-button" href="/events">Go to events</a></div></section>;
    const role = await getEventRole(event.id);
    if (!role) throw new Error('You do not have access to this event.');

    const supabase = getSupabaseServerClient();
    const guestsQuery = supabase
        .from('guests')
        .select('id, event_id, name, email, guest_tag, invitation_status, rsvp_status, companion_adults, companion_children, companion_babies, total_companions, rsvp_companion_adults, rsvp_companion_children, rsvp_companion_babies, meal_preference, allergies, rsvp_updated_at, created_at')
        .eq('event_id', event.id)
        .order('name');
    const registrationSettingsQuery = supabase
        .from('events')
        .select('public_registration_token_hash')
        .eq('id', event.id)
        .single();
    const requestsQuery = role !== 'viewer'
        ? supabase
            .from('event_registration_requests')
            .select('id, event_id, name, email, companion_adults, companion_children, companion_babies, note, status, created_at, reviewed_at')
            .eq('event_id', event.id)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null });
    const [{ data: guests, error: guestsError }, { data: settings, error: settingsError }, { data: requests, error: requestsError }] = await Promise.all([
        guestsQuery,
        registrationSettingsQuery,
        requestsQuery,
    ]);
    if (guestsError) throw new Error(`Unable to load guests: ${guestsError.message}`);
    if (settingsError) throw new Error(`Unable to load public registration settings: ${settingsError.message}`);
    if (requestsError) throw new Error(`Unable to load registration requests: ${requestsError.message}`);
    return <PlannerSection
        kind="guests"
        event={{ ...event, public_registration_enabled: Boolean(settings.public_registration_token_hash) }}
        canEdit={role !== 'viewer'}
        guests={(guests ?? []) as GuestRow[]}
        registrationRequests={(requests ?? []) as EventRegistrationRequestRow[]}
    />;
}
