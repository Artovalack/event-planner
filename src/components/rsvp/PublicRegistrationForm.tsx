'use client';

import { useState, type FormEvent } from 'react';
import { submitPublicEventRegistration } from '@/actions/rsvp';

export type PublicRegistrationEvent = {
    event_title: string;
    event_date: string | null;
    venue_name: string | null;
    venue_address: string | null;
};

export default function PublicRegistrationForm({
    eventId,
    token,
    event,
}: {
    eventId: string;
    token: string;
    event: PublicRegistrationEvent;
}) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [companionAdults, setCompanionAdults] = useState(0);
    const [companionChildren, setCompanionChildren] = useState(0);
    const [companionBabies, setCompanionBabies] = useState(0);
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [submitted, setSubmitted] = useState(false);

    const submit = async (formEvent: FormEvent<HTMLFormElement>) => {
        formEvent.preventDefault();
        setSaving(true);
        setError(null);
        try {
            await submitPublicEventRegistration(eventId, token, {
                name,
                email,
                companionAdults,
                companionChildren,
                companionBabies,
                note,
            });
            setSubmitted(true);
        } catch (caughtError) {
            setError(caughtError instanceof Error ? caughtError.message : 'Unable to submit your request. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <main className="public-rsvp-page">
            <article className="public-rsvp-card">
                <p className="eyebrow">OPEN EVENT REGISTRATION</p>
                <h1>{event.event_title}</h1>
                {event.event_date && <p className="public-rsvp-detail">{new Date(`${event.event_date.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, { dateStyle: 'long' })}</p>}
                {(event.venue_name || event.venue_address) && <p className="public-rsvp-detail">{[event.venue_name, event.venue_address].filter(Boolean).join(' · ')}</p>}
                {submitted ? (
                    <div className="registration-success" role="status">
                        <h2>Thanks for your interest!</h2>
                        <p>Your request has been sent to the event organizer for review. This is not yet a confirmed RSVP.</p>
                    </div>
                ) : (
                    <>
                        <p className="public-registration-intro">Interested in attending? Share your details and the organizer will review your request. Sending this form does not confirm your attendance.</p>
                        <form className="public-rsvp-form" onSubmit={submit}>
                            <label className="public-rsvp-field">Your name
                                <input required maxLength={160} autoComplete="name" value={name} onChange={(change) => setName(change.target.value)} />
                            </label>
                            <label className="public-rsvp-field">Email address
                                <input required type="email" maxLength={320} autoComplete="email" value={email} onChange={(change) => setEmail(change.target.value)} />
                            </label>
                            <label className="public-rsvp-field">Additional adults joining you
                                <input type="number" min="0" max="50" value={companionAdults} onChange={(change) => setCompanionAdults(Number(change.target.value))} />
                            </label>
                            <label className="public-rsvp-field">Children joining you
                                <input type="number" min="0" max="50" value={companionChildren} onChange={(change) => setCompanionChildren(Number(change.target.value))} />
                            </label>
                            <label className="public-rsvp-field">Babies joining you
                                <input type="number" min="0" max="50" value={companionBabies} onChange={(change) => setCompanionBabies(Number(change.target.value))} />
                            </label>
                            <label className="public-rsvp-field">Note for the organizer <span className="public-rsvp-hint">Optional</span>
                                <textarea maxLength={1000} rows={3} value={note} onChange={(change) => setNote(change.target.value)} placeholder="Anything the organizer should know?" />
                            </label>
                            {error && <p className="auth-error" role="alert">{error}</p>}
                            <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Sending request…' : 'Request to attend'}</button>
                        </form>
                    </>
                )}
                <p className="public-rsvp-footer">Your details will be shared with the event organizer to review your request.</p>
            </article>
        </main>
    );
}
