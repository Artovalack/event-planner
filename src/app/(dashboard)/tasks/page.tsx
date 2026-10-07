import PlannerSection from '@/components/planner/PlannerSection';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getActiveEvent, getEventRole } from '@/lib/planner';
import type { TaskRow } from '@/types/database';

export default async function TasksPage() {
    const event = await getActiveEvent();
    if (!event) return <section className="planner-page"><div className="empty-state"><h1>Select an event to get started</h1><p>Create an event before adding tasks.</p><a className="primary-button" href="/events">Go to events</a></div></section>;
    const role = await getEventRole(event.id);
    if (!role) throw new Error('You do not have access to this event.');

    const { data, error } = await getSupabaseServerClient()
        .from('tasks').select('*, subtasks(*)').eq('event_id', event.id).order('due_date', { ascending: true, nullsFirst: false });
    if (error) throw new Error(`Unable to load tasks: ${error.message}`);
    return <PlannerSection kind="tasks" event={event} canEdit={role !== 'viewer'} tasks={(data ?? []) as TaskRow[]} />;
}
