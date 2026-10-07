import CalendarView from '@/components/calendar/CalendarView';
import { getPlannerEvents } from '@/lib/planner';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import type { CalendarItem, EventRow } from '@/types/database';

export default async function CalendarPage() {
    const events = await getPlannerEvents();
    if (!events.length) {
        return <section className="planner-page"><div className="empty-state"><h1>Events &amp; Calendar</h1><p>Create an event to see its important dates and planning deadlines here.</p><a className="primary-button" href="/events">Create an event</a></div></section>;
    }

    const eventIds = events.map((event) => event.id);
    const supabase = getSupabaseServerClient();
    const [tasksResult, milestonesResult, scheduleResult] = await Promise.all([
        supabase.from('tasks').select('id, event_id, title, due_date').in('event_id', eventIds).not('due_date', 'is', null),
        supabase.from('vendor_payment_milestones').select('id, event_id, label, due_at').in('event_id', eventIds).neq('status', 'cancelled'),
        supabase.from('event_schedule_items').select('id, event_id, title, starts_at').in('event_id', eventIds),
    ]);
    if (tasksResult.error) throw new Error(`Unable to load calendar tasks: ${tasksResult.error.message}`);
    if (milestonesResult.error) throw new Error(`Unable to load calendar payments: ${milestonesResult.error.message}`);
    if (scheduleResult.error) throw new Error(`Unable to load calendar schedule: ${scheduleResult.error.message}`);

    const eventTitles = new Map(events.map((event: EventRow) => [event.id, event.title]));
    const items: CalendarItem[] = [
        ...events.filter((event) => event.date).map((event) => ({
            id: event.id,
            title: event.title,
            startsAt: event.date!,
            allDay: true,
            kind: 'event' as const,
            eventTitle: event.title,
        })),
        ...(tasksResult.data ?? []).map((task) => ({
            id: task.id,
            title: task.title,
            startsAt: task.due_date!,
            allDay: true,
            kind: 'task' as const,
            eventTitle: eventTitles.get(task.event_id) ?? 'Event',
        })),
        ...(milestonesResult.data ?? []).map((milestone) => ({
            id: milestone.id,
            title: `Payment: ${milestone.label}`,
            startsAt: milestone.due_at,
            allDay: false,
            kind: 'payment' as const,
            eventTitle: eventTitles.get(milestone.event_id) ?? 'Event',
        })),
        ...(scheduleResult.data ?? []).map((schedule) => ({
            id: schedule.id,
            title: schedule.title,
            startsAt: schedule.starts_at,
            allDay: false,
            kind: 'schedule' as const,
            eventTitle: eventTitles.get(schedule.event_id) ?? 'Event',
        })),
    ];

    return (
        <section className="planner-page">
            <header className="page-heading"><div><p className="eyebrow">WORKSPACE</p><h1>Events &amp; Calendar</h1><p className="page-subtitle">See event dates, task deadlines, vendor payments, and run-of-show items together.</p></div><a className="secondary-button" href="/api/calendar/export" download>Export calendar (.ics)</a></header>
            <CalendarView items={items} />
        </section>
    );
}
