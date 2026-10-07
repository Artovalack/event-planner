import PublicRegistrationForm, { type PublicRegistrationEvent } from '@/components/rsvp/PublicRegistrationForm';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function PublicRegistrationPage({
    params,
    searchParams,
}: {
    params: { eventId: string };
    searchParams: { token?: string };
}) {
    const token = searchParams.token;
    if (!/^[0-9a-f-]{36}$/i.test(params.eventId)
        || typeof token !== 'string'
        || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
        return <InvalidRegistrationLink />;
    }

    const { data, error } = await getSupabaseServerClient().rpc('get_public_event_registration', {
        p_event_id: params.eventId,
        p_token: token,
    });
    if (error) throw new Error(`Unable to load public registration: ${error.message}`);

    const event = Array.isArray(data) ? data[0] as PublicRegistrationEvent | undefined : undefined;
    if (!event) return <InvalidRegistrationLink />;

    return <PublicRegistrationForm eventId={params.eventId} token={token} event={event} />;
}

function InvalidRegistrationLink() {
    return (
        <main className="public-rsvp-page">
            <article className="public-rsvp-card public-rsvp-invalid">
                <p className="eyebrow">EVENT REGISTRATION</p>
                <h1>Registration link unavailable</h1>
                <p>This link is invalid or no longer active. Please contact the event organizer for a current link.</p>
            </article>
        </main>
    );
}
