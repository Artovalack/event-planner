import RunOfShowEditor from '@/components/timeline/RunOfShowEditor';
import PrintButton from '@/components/planner/PrintButton';
import { getActiveEvent, getEventRole } from '@/lib/planner';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import type { ScheduleItemRow } from '@/types/database';

export default async function TimelinePage() {
    const event = await getActiveEvent();
    if (!event) {
        return <section className="planner-page"><div className="empty-state"><h1>Run of show</h1><p>Create or select an event before building its event-day schedule.</p><a className="primary-button" href="/events">Go to events</a></div></section>;
    }
    const role = await getEventRole(event.id);
    if (!role) throw new Error('You do not have access to this event.');

    const { data, error } = await getSupabaseServerClient()
        .from('event_schedule_items')
        .select('*')
        .eq('event_id', event.id)
        .order('starts_at', { ascending: true })
        .order('sort_order', { ascending: true });
    if (error) throw new Error(`Unable to load the run of show: ${error.message}`);

    return (
        <section className="planner-page">
            <header className="page-heading"><div><p className="eyebrow">EVENT-DAY COORDINATION</p><h1>Timeline</h1><p className="page-subtitle">Build a minute-by-minute schedule for {event.title}.</p></div><PrintButton label="Print / Save PDF" /></header>
            <RunOfShowEditor
                eventId={event.id}
                eventDate={event.date ?? null}
                timezone={event.timezone ?? 'UTC'}
                venue={event.venue_name ?? event.location ?? null}
                items={(data ?? []) as ScheduleItemRow[]}
                readOnly={role === 'viewer'}
            />
        </section>
    );
}
