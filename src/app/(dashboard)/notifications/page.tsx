import NotificationsInbox from '@/components/notifications/NotificationsInbox';
import { defaultNotificationPreferences } from '@/lib/preferences';
import { getPlannerEvents } from '@/lib/planner';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import type { EventRow } from '@/types/database';

function dateInTimezone(date: Date, timeZone: string) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
}

export default async function NotificationsPage() {
    const events = await getPlannerEvents();
    if (!events.length) {
        return <section className="planner-page"><div className="empty-state"><h1>Notifications</h1><p>Create or join an event to see reminders and RSVP updates.</p><a className="primary-button" href="/events">Go to events</a></div></section>;
    }

    const supabase = getSupabaseServerClient();
    const eventIds = events.map((event) => event.id);
    const eventById = new Map(events.map((event: EventRow) => [event.id, event]));
    const [{ data: userData, error: userError }, preferencesResult, activityResult] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('user_notification_preferences')
            .select('in_app_deadlines, in_app_guest_rsvps')
            .maybeSingle(),
        supabase.from('event_activity')
            .select('id, event_id, actor_email, action, entity_type, created_at')
            .in('event_id', eventIds)
            .eq('entity_type', 'guest RSVP')
            .order('created_at', { ascending: false })
            .limit(100),
    ]);
    if (userError || !userData.user) throw new Error('Authentication required.');
    if (preferencesResult.error) throw new Error(`Unable to load notification preferences: ${preferencesResult.error.message}`);
    if (activityResult.error) throw new Error(`Unable to load RSVP notifications: ${activityResult.error.message}`);

    const preferences = preferencesResult.data ?? defaultNotificationPreferences;
    const eventActivities = preferences.in_app_guest_rsvps
        ? (activityResult.data ?? []).flatMap((activity) => {
            const event = eventById.get(activity.event_id);
            if (!event) return [];
            return [{
                id: activity.id,
                kind: 'rsvp' as const,
                title: activity.action === 'created' ? 'Guest RSVP received' : 'Guest RSVP updated',
                detail: activity.actor_email ? `${activity.actor_email} responded to the invitation.` : 'A guest responded to the invitation.',
                eventTitle: event.title,
                createdAt: activity.created_at,
                href: '/guests',
            }];
        })
        : [];

    let deadlineItems: {
        id: string;
        event_id: string;
        title: string;
        due_date: string;
    }[] = [];
    if (preferences.in_app_deadlines) {
        const utcToday = new Date();
        utcToday.setUTCHours(0, 0, 0, 0);
        utcToday.setUTCDate(utcToday.getUTCDate() - 1);
        const utcLastDay = new Date(utcToday);
        utcLastDay.setUTCDate(utcLastDay.getUTCDate() + 9);
        const { data, error } = await supabase.from('tasks')
            .select('id, event_id, title, due_date')
            .in('event_id', eventIds)
            .gte('due_date', utcToday.toISOString().slice(0, 10))
            .lte('due_date', utcLastDay.toISOString().slice(0, 10))
            .not('due_date', 'is', null)
            .neq('status', 'completed')
            .order('due_date', { ascending: true })
            .limit(300);
        if (error) throw new Error(`Unable to load upcoming task reminders: ${error.message}`);
        deadlineItems = (data ?? []) as typeof deadlineItems;
    }

    const deadlines = deadlineItems.flatMap((task) => {
        const event = eventById.get(task.event_id);
        if (!event || !task.due_date) return [];
        const timeZone = event.timezone ?? 'UTC';
        const today = dateInTimezone(new Date(), timeZone);
        const lastDate = new Date(`${today}T00:00:00Z`);
        lastDate.setUTCDate(lastDate.getUTCDate() + 7);
        const lastDay = lastDate.toISOString().slice(0, 10);
        if (task.due_date < today || task.due_date > lastDay) return [];
        return [{
            id: `deadline-${task.id}`,
            kind: 'deadline' as const,
            title: task.due_date === today ? 'Task due today' : 'Upcoming task deadline',
            detail: `${task.title} · ${new Date(`${task.due_date}T12:00:00Z`).toLocaleDateString(undefined, { timeZone: 'UTC' })}`,
            eventTitle: event.title,
            createdAt: `${task.due_date}T00:00:00.000Z`,
            href: '/tasks',
        }];
    });

    const initialNotifications = [...eventActivities, ...deadlines]
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, 100);

    return (
        <section className="planner-page">
            <header className="page-heading">
                <div><p className="eyebrow">SYSTEM / PREFERENCES</p><h1>Notifications</h1><p className="page-subtitle">Recent RSVP activity and tasks due within the next seven days.</p></div>
            </header>
            <NotificationsInbox
                key={userData.user.id}
                userId={userData.user.id}
                eventIds={eventIds}
                eventTitles={Object.fromEntries(events.map((event) => [event.id, event.title]))}
                rsvpNotificationsEnabled={preferences.in_app_guest_rsvps}
                initialNotifications={initialNotifications}
            />
        </section>
    );
}
