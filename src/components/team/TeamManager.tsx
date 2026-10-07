'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createWorkspaceInvitation, removeWorkspaceMember, revokeWorkspaceInvitation } from '@/actions/team';

type TeamMember = { user_id: string; email: string; role: 'collaborator' | 'viewer'; joined_at: string };
type Invitation = { id: string; email: string; role: 'collaborator' | 'viewer'; created_at: string; expires_at: string };

export default function TeamManager({
    eventId,
    eventTitle,
    membershipRole,
    isAdmin,
    members,
    invitations,
}: {
    eventId: string;
    eventTitle: string;
    membershipRole: string;
    isAdmin: boolean;
    members: TeamMember[];
    invitations: Invitation[];
}) {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<'collaborator' | 'viewer'>('collaborator');
    const [inviteUrl, setInviteUrl] = useState('');
    const [notice, setNotice] = useState('');
    const [error, setError] = useState('');
    const [busy, startTransition] = useTransition();

    const createInvite = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError('');
        setNotice('');
        setInviteUrl('');
        startTransition(async () => {
            try {
                const { token } = await createWorkspaceInvitation(eventId, email, role);
                const url = new URL(`/invite/${eventId}`, window.location.origin);
                url.searchParams.set('token', token);
                const inviteLink = url.toString();
                setInviteUrl(inviteLink);
                try {
                    await navigator.clipboard.writeText(inviteLink);
                    setNotice('Invitation created and link copied. Send it to the invitee; it expires in 7 days.');
                } catch {
                    setNotice('Invitation created. Copy the link below and send it to the invitee; it expires in 7 days.');
                }
                setEmail('');
                router.refresh();
            } catch (caughtError) {
                setError(caughtError instanceof Error ? caughtError.message : 'Unable to create invitation.');
            }
        });
    };

    const revoke = (invitation: Invitation) => {
        if (!window.confirm(`Revoke the invitation for ${invitation.email}?`)) return;
        setError('');
        setNotice('');
        startTransition(async () => {
            try {
                await revokeWorkspaceInvitation(eventId, invitation.id);
                setNotice(`Invitation for ${invitation.email} revoked.`);
                router.refresh();
            } catch (caughtError) {
                setError(caughtError instanceof Error ? caughtError.message : 'Unable to revoke invitation.');
            }
        });
    };

    const removeMember = (member: TeamMember) => {
        if (!window.confirm(`Remove ${member.email} from ${eventTitle}?`)) return;
        setError('');
        setNotice('');
        startTransition(async () => {
            try {
                await removeWorkspaceMember(eventId, member.user_id);
                setNotice(`${member.email} no longer has access.`);
                router.refresh();
            } catch (caughtError) {
                setError(caughtError instanceof Error ? caughtError.message : 'Unable to remove workspace member.');
            }
        });
    };

    const copyLink = () => {
        void navigator.clipboard.writeText(inviteUrl)
            .then(() => setNotice('Invitation link copied.'))
            .catch(() => setNotice('Clipboard unavailable. Select and copy the invitation link manually.'));
    };

    return (
        <div className="team-page-content">
            <section className="planner-form-card team-role-guide">
                <div className="planner-form-heading"><h2>Your access</h2><span className={`status-pill ${isAdmin ? 'completed' : 'pending'}`}>{isAdmin ? 'Admin' : 'Collaborator / Viewer'}</span></div>
                <p>{isAdmin
                    ? 'As the event owner, you have full access to event data and team management.'
                    : `Your current role is ${membershipRole}. The event owner controls invitations and membership.`}</p>
                <div className="team-role-grid">
                    <div><strong>Admin</strong><span>Full access, settings, and team management. The event owner is the admin.</span></div>
                    <div><strong>Collaborator</strong><span>Can edit planning content, including tasks, guests, seating, budget, vendors, and schedule.</span></div>
                    <div><strong>Viewer / Client</strong><span>Read-only access to event details, tasks, schedule, budget, guests, and seating.</span></div>
                </div>
            </section>

            {isAdmin && <section className="planner-form-card">
                <div className="planner-form-heading"><h2>Invite someone to {eventTitle}</h2></div>
                <form className="team-invite-form" onSubmit={createInvite}>
                    <label>Email address<input type="email" required maxLength={320} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" /></label>
                    <label>Role<select value={role} onChange={(event) => setRole(event.target.value as 'collaborator' | 'viewer')}><option value="collaborator">Collaborator — can edit</option><option value="viewer">Viewer / Client — read-only</option></select></label>
                    <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create invite link'}</button>
                </form>
                <p className="team-help">The link is shown only once, expires in 7 days, and can be accepted only by signing in with the invited email. Copy and send it through your email client.</p>
            </section>}

            {inviteUrl && <section className="team-invite-result"><label>Private invitation link<input readOnly value={inviteUrl} onFocus={(event) => event.currentTarget.select()} /></label><button className="secondary-button" type="button" onClick={copyLink}>Copy link</button></section>}
            {error && <p className="form-message form-message-error" role="alert">{error}</p>}
            {notice && <p className="form-message form-message-success" role="status">{notice}</p>}

            <section className="planner-form-card team-list-card">
                <div className="planner-form-heading"><h2>Workspace members</h2><span className="event-settings-name">{members.length + 1} including you</span></div>
                <div className="team-member-row team-owner-row"><div><strong>Event owner</strong><span>Full access</span></div><span className="status-pill completed">Admin</span></div>
                {!members.length && <p className="vendor-operation-empty">No collaborators have accepted an invitation.</p>}
                {members.map((member) => <div className="team-member-row" key={member.user_id}><div><strong>{member.email}</strong><span>Joined {new Date(member.joined_at).toLocaleDateString()}</span></div><span className="status-pill pending">{member.role}</span>{isAdmin && <button className="danger-button" type="button" disabled={busy} onClick={() => removeMember(member)}>Remove</button>}</div>)}
            </section>

            {isAdmin && <section className="planner-form-card team-list-card">
                <div className="planner-form-heading"><h2>Pending invitations</h2><span className="event-settings-name">{invitations.length}</span></div>
                {!invitations.length && <p className="vendor-operation-empty">No pending invitations.</p>}
                {invitations.map((invitation) => <div className="team-member-row" key={invitation.id}><div><strong>{invitation.email}</strong><span>{invitation.role} · expires {new Date(invitation.expires_at).toLocaleDateString()}</span></div><button className="danger-button" type="button" disabled={busy} onClick={() => revoke(invitation)}>Revoke</button></div>)}
            </section>}
        </div>
    );
}
