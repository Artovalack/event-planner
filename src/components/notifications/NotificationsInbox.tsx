'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';

type AppNotification = {
    id: string;
    kind: 'rsvp' | 'deadline';
    title: string;
    detail: string;
    eventTitle: string;
    createdAt: string;
    href: string;
};

const MAX_NOTIFICATIONS = 100;

function storageKey(userId: string) {
    return `event-planner-notifications-read-${userId}`;
}

export default function NotificationsInbox({
    userId,
    eventIds,
    eventTitles,
    rsvpNotificationsEnabled,
    initialNotifications,
}: {
    userId: string;
    eventIds: string[];
    eventTitles: Record<string, string>;
    rsvpNotificationsEnabled: boolean;
    initialNotifications: AppNotification[];
}) {
    const [notifications, setNotifications] = useState(initialNotifications);
    const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
    const [isLive, setIsLive] = useState(false);
    const [connectionError, setConnectionError] = useState('');

    useEffect(() => {
        const savedReadIds = window.localStorage.getItem(storageKey(userId));
        if (savedReadIds) {
            try {
                const parsed: unknown = JSON.parse(savedReadIds);
                if (Array.isArray(parsed) && parsed.every((id) => typeof id === 'string')) {
                    setReadNotificationIds(parsed);
                }
            } catch {
                window.localStorage.removeItem(storageKey(userId));
            }
        }

        const supabase = getSupabaseClient();
        if (!rsvpNotificationsEnabled) {
            setIsLive(false);
            return;
        }
        const channel = supabase.channel(`notifications-${userId}`);
        eventIds.forEach((eventId) => {
            channel.on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'event_activity',
                filter: `event_id=eq.${eventId}`,
            }, (payload) => {
                const row = payload.new as {
                    id: string;
                    event_id: string;
                    action: 'created' | 'updated' | 'deleted';
                    entity_type: string;
                    actor_email: string | null;
                    created_at: string;
                };
                if (row.entity_type !== 'guest RSVP') return;
                const incoming: AppNotification = {
                    id: row.id,
                    kind: 'rsvp',
                    title: row.action === 'created' ? 'Guest RSVP received' : 'Guest RSVP updated',
                    detail: row.actor_email ? `${row.actor_email} responded to the invitation.` : 'A guest responded to the invitation.',
                    eventTitle: eventTitles[row.event_id] ?? 'Your event',
                    createdAt: row.created_at,
                    href: '/guests',
                };
                setNotifications((current) => [
                    incoming,
                    ...current.filter((notification) => notification.id !== incoming.id),
                ].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, MAX_NOTIFICATIONS));
            });
        });
        channel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                setIsLive(true);
                setConnectionError('');
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                setIsLive(false);
                setConnectionError('Live RSVP updates are unavailable. Reload this page to check for newer notifications.');
            } else if (status === 'CLOSED') {
                setIsLive(false);
            }
        });

        return () => {
            void supabase.removeChannel(channel);
        };
    }, [eventIds, eventTitles, rsvpNotificationsEnabled, userId]);

    const readIds = new Set(readNotificationIds);
    const unreadCount = notifications.filter((notification) => !readIds.has(notification.id)).length;

    const markAllRead = () => {
        const ids = notifications.map((notification) => notification.id);
        window.localStorage.setItem(storageKey(userId), JSON.stringify(ids));
        setReadNotificationIds(ids);
    };

    return (
        <section className="notifications-inbox">
            <div className="notifications-inbox-status">
                <span className={`activity-live-indicator ${isLive ? 'activity-live' : ''}`} aria-hidden="true" />
                <span>{!rsvpNotificationsEnabled ? 'RSVP notifications are turned off in your preferences.' : isLive ? 'Live RSVP updates on' : 'Connecting to RSVP updates…'}</span>
                {unreadCount > 0 && <span className="notifications-unread-count">{unreadCount} unread</span>}
                <button className="text-button" type="button" onClick={markAllRead} disabled={!unreadCount}>Mark all read</button>
            </div>
            {connectionError && <p className="form-message form-message-error" role="status">{connectionError}</p>}
            {!notifications.length
                ? <div className="empty-state"><h2>You’re all caught up</h2><p>New RSVP updates and task deadline reminders will appear here.</p></div>
                : <ol className="notifications-list">
                    {notifications.map((notification) => {
                        const isUnread = !readIds.has(notification.id);
                        return (
                            <li className={`notification-row ${isUnread ? 'notification-row-unread' : ''}`} key={notification.id}>
                                <span className={`notification-kind notification-kind-${notification.kind}`} aria-hidden="true">
                                    {notification.kind === 'rsvp' ? 'RSVP' : 'Due'}
                                </span>
                                <div className="notification-row-main">
                                    <strong>{notification.title}</strong>
                                    <p>{notification.detail}</p>
                                    <small>{notification.eventTitle} · {new Date(notification.createdAt).toLocaleString()}</small>
                                </div>
                                <Link className="text-button" href={notification.href}>View</Link>
                            </li>
                        );
                    })}
                </ol>}
        </section>
    );
}
