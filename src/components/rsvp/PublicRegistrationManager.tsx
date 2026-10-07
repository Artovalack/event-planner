'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
    createPublicRegistrationLink,
    disablePublicRegistrationLink,
    reviewPublicEventRegistration,
} from '@/actions/rsvp';
import type { EventRegistrationRequestRow } from '@/types/database';

export default function PublicRegistrationManager({
    eventId,
    enabled,
    requests,
}: {
    eventId: string;
    enabled: boolean;
    requests: EventRegistrationRequestRow[];
}) {
    const router = useRouter();
    const [link, setLink] = useState('');
    const [linkEnabled, setLinkEnabled] = useState(enabled);
    const [working, setWorking] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    const createLink = async () => {
        setWorking(true);
        setError('');
        setNotice('');
        try {
            const { token } = await createPublicRegistrationLink(eventId);
            const url = new URL(`/register/${eventId}`, window.location.origin);
            url.searchParams.set('token', token);
            setLink(url.toString());
            setLinkEnabled(true);
            setNotice('Registration link created. Copy and share it with anyone who may be interested.');
        } catch (caughtError) {
            setError(caughtError instanceof Error ? caughtError.message : 'Unable to create the registration link.');
        } finally {
            setWorking(false);
        }
    };

    const disableLink = async () => {
        setWorking(true);
        setError('');
        setNotice('');
        try {
            await disablePublicRegistrationLink(eventId);
            setLink('');
            setLinkEnabled(false);
            setNotice('The public registration link has been disabled.');
            router.refresh();
        } catch (caughtError) {
            setError(caughtError instanceof Error ? caughtError.message : 'Unable to disable the registration link.');
        } finally {
            setWorking(false);
        }
    };

    const reviewRequest = async (requestId: string, status: 'approved' | 'declined') => {
        setWorking(true);
        setError('');
        setNotice('');
        try {
            await reviewPublicEventRegistration(eventId, requestId, status);
            setNotice(status === 'approved'
                ? 'Request approved and added to your guest list. Send them an RSVP link to confirm.'
                : 'Request declined.');
            router.refresh();
        } catch (caughtError) {
            setError(caughtError instanceof Error ? caughtError.message : 'Unable to review this request.');
        } finally {
            setWorking(false);
        }
    };

    const copyLink = () => {
        void navigator.clipboard.writeText(link)
            .then(() => setNotice('Registration link copied.'))
            .catch(() => setNotice('Clipboard unavailable. Select and copy the link manually.'));
    };

    return (
        <section className="planner-form-card public-registration-manager">
            <div className="planner-form-heading">
                <div>
                    <h2>Public registration</h2>
                    <p>Share one link so people can request to join this event.</p>
                </div>
                {requests.length > 0 && <span className="status-pill pending">{requests.length} pending</span>}
            </div>
            <div className="public-registration-link-actions">
                <button className="secondary-button" type="button" onClick={() => void createLink()} disabled={working}>
                    {working ? 'Working…' : linkEnabled ? 'Create a new link' : 'Create registration link'}
                </button>
                {linkEnabled && <button className="danger-button" type="button" onClick={() => void disableLink()} disabled={working}>Disable link</button>}
            </div>
            {link && <div className="guest-rsvp-link">
                <label>Anyone with this link can submit an attendance request<input readOnly value={link} onFocus={(event) => event.currentTarget.select()} /></label>
                <button type="button" className="secondary-button" onClick={copyLink}>Copy link</button>
            </div>}
            {notice && <p className="form-message form-message-success" role="status">{notice}</p>}
            {error && <p className="form-message form-message-error" role="alert">{error}</p>}

            {requests.length > 0 && <div className="public-registration-requests">
                <h3>Requests awaiting review</h3>
                {requests.map((request) => <article className="public-registration-request" key={request.id}>
                    <div>
                        <strong>{request.name}</strong>
                        <a href={`mailto:${request.email}`}>{request.email}</a>
                        <span>
                            {1 + request.companion_adults + request.companion_children + request.companion_babies} attendees requested
                            {' · '}{request.companion_adults} adults, {request.companion_children} children, {request.companion_babies} babies
                            {' · Submitted '}{new Date(request.created_at).toLocaleDateString()}
                        </span>
                        {request.note && <p>{request.note}</p>}
                    </div>
                    <div className="planner-card-actions">
                        <button className="primary-button" type="button" disabled={working} onClick={() => void reviewRequest(request.id, 'approved')}>Approve</button>
                        <button className="danger-button" type="button" disabled={working} onClick={() => void reviewRequest(request.id, 'declined')}>Decline</button>
                    </div>
                </article>)}
            </div>}
        </section>
    );
}
