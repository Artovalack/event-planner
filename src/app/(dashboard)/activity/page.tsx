import ActivityFeed from '@/components/activity/ActivityFeed';
import { getActiveEvent, getEventRole } from '@/lib/planner';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import type { ActivityRow } from '@/types/database';

export default async function ActivityPage() {
    const event = await getActiveEvent();
    if (!event) {
        return <section className="planner-page"><div className="empty-state"><h1>Activity</h1><p>Create or select an event to view workspace activity.</p><a className="primary-button" href="/events">Go to events</a></div></section>;
    }
    const role = await getEventRole(event.id);
    if (!role) throw new Error('You do not have access to this event.');

    const { data, error } = await getSupabaseServerClient()
        .from('event_activity')
        .select('id, event_id, actor_id, actor_email, action, entity_type, created_at')
        .eq('event_id', event.id)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(100);
    if (error) throw new Error(`Unable to load workspace activity: ${error.message}`);

    return (
        <section className="planner-page">
            <header className="page-heading">
                <div><p className="eyebrow">WORKSPACE</p><h1>Activity</h1><p className="page-subtitle">A live history of changes to {event.title}.</p></div>
            </header>
            <ActivityFeed key={event.id} eventId={event.id} initialActivity={(data ?? []) as ActivityRow[]} />
        </section>
    );
}
