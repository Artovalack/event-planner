import PublicRsvpForm, { type PublicGuestRsvp } from '@/components/rsvp/PublicRsvpForm';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type RsvpPageProps = {
    params: { eventId: string };
    searchParams: { token?: string };
};

export default async function PublicRsvpPage({ params, searchParams }: RsvpPageProps) {
    const token = searchParams.token;
    if (!/^[0-9a-f-]{36}$/i.test(params.eventId) || typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
        return <InvalidRsvpLink />;
    }

    const { data, error } = await getSupabaseServerClient().rpc('get_public_guest_rsvp', {
        p_event_id: params.eventId,
        p_token: token,
    });
    if (error) throw new Error(`Unable to load RSVP invitation: ${error.message}`);

    const guest = Array.isArray(data) ? data[0] as PublicGuestRsvp | undefined : undefined;
    if (!guest) return <InvalidRsvpLink />;

    return <PublicRsvpForm eventId={params.eventId} token={token} guest={guest} />;
}

function InvalidRsvpLink() {
    return (
        <main className="public-rsvp-page">
            <article className="public-rsvp-card public-rsvp-invalid">
                <p className="eyebrow">INVITATION</p>
                <h1>RSVP link unavailable</h1>
                <p>This invitation link is invalid. Please contact the event organizer for a new link.</p>
            </article>
        </main>
    );
}
