'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseClient } from '../../../../lib/supabase/client';
import type { EventRow } from '../../../../types/database';

const EventPage = () => {
    const params = useParams<{ eventId: string }>();
    const eventId = params?.eventId;
    const [event, setEvent] = useState<EventRow | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchEvent = async () => {
            if (!eventId) return;

            try {
                const { data: { user }, error: userError } = await getSupabaseClient().auth.getUser();
                if (userError || !user) {
                    throw new Error('Authentication required.');
                }

                const { data, error } = await getSupabaseClient()
                    .from('events')
                    .select('*')
                    .eq('id', eventId)
                    .eq('user_id', user.id)
                    .single();

                if (error) throw error;

                setEvent(data);
            } catch (caughtError) {
                const message = caughtError instanceof Error ? caughtError.message : 'Unknown error';
                setError(message);
            } finally {
                setLoading(false);
            }
        };

        fetchEvent();
    }, [eventId]);

    if (loading) return <div className="event-detail">Loading event…</div>;
    if (error) return <div className="event-detail" role="alert">Unable to load event: {error}</div>;
    if (!event) return <div className="event-detail">Event not found.</div>;

    return (
        <article className="event-detail">
            <Link href="/events" className="event-detail-back">← Back to events</Link>
            <section className="event-detail-card">
                <p className="eyebrow">EVENT DETAILS</p>
                <h1>{event.title}</h1>
                <p>{event.description || 'No description provided.'}</p>
                <div className="event-card-meta">
                    <p><span>Date</span>{event.date ? new Date(event.date).toLocaleDateString() : 'Not set'}</p>
                    <p><span>Location</span>{event.location || 'Not set'}</p>
                </div>
            </section>
        </article>
    );
};

export default EventPage;