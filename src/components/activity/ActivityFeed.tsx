'use client';

import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import type { ActivityRow } from '@/types/database';

const MAX_ACTIVITY_ITEMS = 100;

function activityMessage(activity: ActivityRow) {
    const actor = activity.actor_email ?? 'A guest or workspace member';
    const verb = activity.action === 'created'
        ? 'added'
        : activity.action === 'updated'
            ? 'updated'
            : 'removed';
    return `${actor} ${verb} a ${activity.entity_type}`;
}

export default function ActivityFeed({
    eventId,
    initialActivity,
}: {
    eventId: string;
    initialActivity: ActivityRow[];
}) {
    const [activities, setActivities] = useState(initialActivity);
    const [isLive, setIsLive] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);

    useEffect(() => {
        const supabase = getSupabaseClient();
        const channel = supabase
            .channel(`event-activity-${eventId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'event_activity',
                    filter: `event_id=eq.${eventId}`,
                },
                (payload) => {
                    const incoming = payload.new as ActivityRow;
                    setActivities((current) => [
                        incoming,
                        ...current.filter((activity) => activity.id !== incoming.id),
                    ].slice(0, MAX_ACTIVITY_ITEMS));
                },
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    setIsLive(true);
                    setConnectionError(null);
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    setIsLive(false);
                    setConnectionError('Live updates are unavailable. Reload this page to check for newer activity.');
                } else if (status === 'CLOSED') {
                    setIsLive(false);
                }
            });

        return () => {
            void supabase.removeChannel(channel);
        };
    }, [eventId]);

    return (
        <section className="activity-feed" aria-label="Workspace activity">
            <div className="activity-feed-status">
                <span className={`activity-live-indicator ${isLive ? 'activity-live' : ''}`} aria-hidden="true" />
                <span>{isLive ? 'Live updates on' : 'Connecting to live updates…'}</span>
            </div>
            {connectionError && <p className="form-message form-message-error" role="status">{connectionError}</p>}
            {activities.length === 0
                ? <div className="empty-state"><h2>No activity yet</h2><p>Workspace changes will appear here as they happen.</p></div>
                : <ol className="activity-list">
                    {activities.map((activity) => (
                        <li className="activity-item" key={activity.id}>
                            <span className="activity-dot" aria-hidden="true" />
                            <div className="activity-item-content">
                                <p>{activityMessage(activity)}</p>
                                <time dateTime={activity.created_at}>{new Date(activity.created_at).toLocaleString()}</time>
                            </div>
                            <span className="activity-entity">{activity.entity_type}</span>
                        </li>
                    ))}
                </ol>}
        </section>
    );
}
