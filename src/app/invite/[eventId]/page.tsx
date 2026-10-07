import AcceptInvitation from '@/components/team/AcceptInvitation';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function AcceptWorkspaceInvitePage({
    params,
    searchParams,
}: {
    params: { eventId: string };
    searchParams: { token?: string };
}) {
    const token = searchParams.token;
    if (!/^[0-9a-f-]{36}$/i.test(params.eventId) || typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
        return <InvalidInvitation />;
    }

    const supabase = getSupabaseServerClient();
    const [{ data: userData, error: userError }, invitationResult] = await Promise.all([
        supabase.auth.getUser(),
        supabase.rpc('get_workspace_invitation', { p_event_id: params.eventId, p_token: token }),
    ]);
    if (userError || !userData.user) throw new Error('Authentication required.');
    if (invitationResult.error) throw new Error(`Unable to load workspace invitation: ${invitationResult.error.message}`);
    const invitation = Array.isArray(invitationResult.data) ? invitationResult.data[0] : undefined;

    if (!invitation) return <InvalidInvitation />;
    if (invitation.invite_email.toLowerCase() !== userData.user.email?.toLowerCase()) {
        return (
            <main className="public-rsvp-page">
                <section className="public-rsvp-card team-accept-card">
                    <p className="eyebrow">WORKSPACE INVITATION</p>
                    <h1>Use the invited account</h1>
                    <p>This link was issued to <strong>{invitation.invite_email}</strong>. Sign out and sign in with that email address to continue.</p>
                </section>
            </main>
        );
    }

    return <AcceptInvitation
        eventId={params.eventId}
        token={token}
        eventTitle={invitation.event_title}
        invitedEmail={invitation.invite_email}
        role={invitation.invite_role}
    />;
}

function InvalidInvitation() {
    return (
        <main className="public-rsvp-page">
            <section className="public-rsvp-card team-accept-card">
                <p className="eyebrow">WORKSPACE INVITATION</p>
                <h1>Invitation unavailable</h1>
                <p>This link is invalid, expired, or already used. Ask the event owner to create a new invitation.</p>
            </section>
        </main>
    );
}
