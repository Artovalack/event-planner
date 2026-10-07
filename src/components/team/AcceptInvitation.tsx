'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { acceptWorkspaceInvitation } from '@/actions/team';

export default function AcceptInvitation({
    eventId,
    token,
    eventTitle,
    invitedEmail,
    role,
}: {
    eventId: string;
    token: string;
    eventTitle: string;
    invitedEmail: string;
    role: 'collaborator' | 'viewer';
}) {
    const router = useRouter();
    const [error, setError] = useState('');
    const [busy, startTransition] = useTransition();

    const accept = () => {
        setError('');
        startTransition(async () => {
            try {
                await acceptWorkspaceInvitation(eventId, token);
                router.replace('/dashboard');
                router.refresh();
            } catch (caughtError) {
                setError(caughtError instanceof Error ? caughtError.message : 'Unable to accept this invitation.');
            }
        });
    };

    return (
        <main className="public-rsvp-page">
            <section className="public-rsvp-card team-accept-card">
                <p className="eyebrow">WORKSPACE INVITATION</p>
                <h1>Join {eventTitle}</h1>
                <p>You were invited as a <strong>{role === 'viewer' ? 'Viewer / Client' : 'Collaborator'}</strong>.</p>
                <p>Accept using the signed-in account <strong>{invitedEmail}</strong>. The invitation is tied to this email address.</p>
                {error && <p className="auth-error" role="alert">{error}</p>}
                <button className="primary-button" type="button" onClick={accept} disabled={busy}>{busy ? 'Joining…' : 'Accept invitation'}</button>
            </section>
        </main>
    );
}
