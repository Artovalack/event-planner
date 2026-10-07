import TeamManager from '@/components/team/TeamManager';
import { getActiveEvent } from '@/lib/planner';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export default async function TeamSettingsPage() {
    const event = await getActiveEvent();
    if (!event) {
        return <section className="planner-page"><div className="empty-state"><h1>Account &amp; Team</h1><p>Create or join an event to see its workspace team.</p><a className="primary-button" href="/events">Go to events</a></div></section>;
    }

    const supabase = getSupabaseServerClient();
    const [roleResult, membersResult, invitationsResult] = await Promise.all([
        supabase.rpc('get_event_role', { p_event_id: event.id }),
        supabase.from('event_members').select('user_id, email, role, joined_at').eq('event_id', event.id).order('joined_at'),
        supabase.from('event_invitations')
            .select('id, email, role, created_at, expires_at')
            .eq('event_id', event.id)
            .is('accepted_at', null)
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false }),
    ]);
    if (roleResult.error) throw new Error(`Unable to load workspace role: ${roleResult.error.message}`);
    if (membersResult.error) throw new Error(`Unable to load workspace members: ${membersResult.error.message}`);
    if (invitationsResult.error) throw new Error(`Unable to load invitations: ${invitationsResult.error.message}`);
    if (!roleResult.data) throw new Error('You do not have access to this workspace.');

    return (
        <section className="planner-page">
            <header className="page-heading"><div><p className="eyebrow">SYSTEM / PREFERENCES</p><h1>Account &amp; Team</h1><p className="page-subtitle">Manage access to {event.title}.</p></div></header>
            <TeamManager
                eventId={event.id}
                eventTitle={event.title}
                membershipRole={roleResult.data}
                isAdmin={roleResult.data === 'admin'}
                members={membersResult.data ?? []}
                invitations={roleResult.data === 'admin' ? invitationsResult.data ?? [] : []}
            />
        </section>
    );
}
