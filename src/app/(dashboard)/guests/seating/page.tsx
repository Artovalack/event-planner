import Link from 'next/link';
import SeatingPlanner from '@/components/seating/SeatingPlanner';
import { getActiveEvent, getEventRole } from '@/lib/planner';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import type { GuestRow, SeatingAssignmentRow, SeatingTableRow } from '@/types/database';

export default async function SeatingPage() {
    const event = await getActiveEvent();
    if (!event) {
        return <section className="planner-page"><div className="empty-state"><h1>Guests &amp; Seating</h1><p>Create or select an event before assigning guests to tables.</p><a className="primary-button" href="/events">Go to events</a></div></section>;
    }
    const role = await getEventRole(event.id);
    if (!role) throw new Error('You do not have access to this event.');

    const supabase = getSupabaseServerClient();
    const [tablesResult, guestsResult, assignmentsResult] = await Promise.all([
        supabase.from('seating_tables').select('*').eq('event_id', event.id).order('sort_order').order('name'),
        supabase.from('guests')
            .select('id, event_id, name, email, guest_tag, invitation_status, rsvp_status, companion_adults, companion_children, companion_babies, total_companions, rsvp_companion_adults, rsvp_companion_children, rsvp_companion_babies, meal_preference, allergies')
            .eq('event_id', event.id)
            .order('name'),
        supabase.from('guest_seating_assignments').select('event_id, guest_id, seating_table_id, assigned_at').eq('event_id', event.id),
    ]);
    if (tablesResult.error) throw new Error(`Unable to load seating tables: ${tablesResult.error.message}`);
    if (guestsResult.error) throw new Error(`Unable to load guests for seating: ${guestsResult.error.message}`);
    if (assignmentsResult.error) throw new Error(`Unable to load seating assignments: ${assignmentsResult.error.message}`);

    return (
        <section className="planner-page seating-page">
            <header className="page-heading">
                <div><p className="eyebrow">{event.title}</p><h1>Guests &amp; Seating</h1><p className="page-subtitle">Create tables and assign invited guests. Confirmed companions count toward capacity.</p></div>
                <Link className="secondary-button" href="/guests">Manage guests</Link>
            </header>
            <SeatingPlanner
                eventId={event.id}
                canEdit={role !== 'viewer'}
                tables={(tablesResult.data ?? []) as SeatingTableRow[]}
                guests={(guestsResult.data ?? []) as GuestRow[]}
                assignments={(assignmentsResult.data ?? []) as SeatingAssignmentRow[]}
            />
        </section>
    );
}
