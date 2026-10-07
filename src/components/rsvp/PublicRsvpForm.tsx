'use client';

import { useState, type FormEvent } from 'react';
import { submitPublicRsvp, type PublicRsvpInput } from '@/actions/rsvp';

export type PublicGuestRsvp = {
    event_title: string;
    event_date: string | null;
    venue_name: string | null;
    venue_address: string | null;
    guest_name: string;
    rsvp_status: 'pending' | 'confirmed' | 'declined';
    companion_adults: number;
    companion_children: number;
    companion_babies: number;
    rsvp_companion_adults: number;
    rsvp_companion_children: number;
    rsvp_companion_babies: number;
    meal_preference: string | null;
    allergies: string | null;
};

export default function PublicRsvpForm({ eventId, token, guest }: { eventId: string; token: string; guest: PublicGuestRsvp }) {
    const [answer, setAnswer] = useState<'confirmed' | 'declined'>(guest.rsvp_status === 'declined' ? 'declined' : 'confirmed');
    const [adults, setAdults] = useState(guest.rsvp_companion_adults);
    const [children, setChildren] = useState(guest.rsvp_companion_children);
    const [babies, setBabies] = useState(guest.rsvp_companion_babies);
    const [meal, setMeal] = useState(guest.meal_preference ?? '');
    const [allergies, setAllergies] = useState(guest.allergies ?? '');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const submit = async (formEvent: FormEvent<HTMLFormElement>) => {
        formEvent.preventDefault();
        setSaving(true);
        setError(null);
        setNotice(null);
        const input: PublicRsvpInput = {
            rsvp_status: answer,
            companion_adults: answer === 'confirmed' ? adults : 0,
            companion_children: answer === 'confirmed' ? children : 0,
            companion_babies: answer === 'confirmed' ? babies : 0,
            meal_preference: answer === 'confirmed' ? meal : '',
            allergies: answer === 'confirmed' ? allergies : '',
        };
        try {
            const result = await submitPublicRsvp(eventId, token, input);
            setNotice(result.status === 'confirmed' ? 'Thanks! Your attendance is confirmed.' : 'Your response has been recorded. We are sorry you cannot make it.');
        } catch (caughtError) {
            setError(caughtError instanceof Error ? caughtError.message : 'Unable to save your RSVP. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <main className="public-rsvp-page">
            <article className="public-rsvp-card">
                <p className="eyebrow">YOU’RE INVITED</p>
                <h1>{guest.event_title}</h1>
                <p className="public-rsvp-greeting">Hello, {guest.guest_name}.</p>
                {guest.event_date && <p className="public-rsvp-detail">{new Date(`${guest.event_date.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, { dateStyle: 'long' })}</p>}
                {(guest.venue_name || guest.venue_address) && <p className="public-rsvp-detail">{[guest.venue_name, guest.venue_address].filter(Boolean).join(' · ')}</p>}

                <form className="public-rsvp-form" onSubmit={submit}>
                    <fieldset>
                        <legend>Can you make it?</legend>
                        <label className="public-rsvp-choice"><input type="radio" name="answer" value="confirmed" checked={answer === 'confirmed'} onChange={() => setAnswer('confirmed')} /> Yes, I’ll be there</label>
                        <label className="public-rsvp-choice"><input type="radio" name="answer" value="declined" checked={answer === 'declined'} onChange={() => setAnswer('declined')} /> Sorry, I can’t make it</label>
                    </fieldset>
                    {answer === 'confirmed' && (
                        <>
                            <fieldset>
                                <legend>Guests joining you</legend>
                                <p className="public-rsvp-hint">Your invitation is for you and up to the number of companions shown.</p>
                                <div className="public-rsvp-counts">
                                    <label>Adult companions<span className="public-rsvp-hint">You are included separately · up to {guest.companion_adults}</span><input type="number" min="0" max={guest.companion_adults} value={adults} onChange={(event) => setAdults(Number(event.target.value))} /></label>
                                    <label>Child companions<span className="public-rsvp-hint">Up to {guest.companion_children}</span><input type="number" min="0" max={guest.companion_children} value={children} onChange={(event) => setChildren(Number(event.target.value))} /></label>
                                    <label>Baby companions<span className="public-rsvp-hint">Up to {guest.companion_babies}</span><input type="number" min="0" max={guest.companion_babies} value={babies} onChange={(event) => setBabies(Number(event.target.value))} /></label>
                                </div>
                            </fieldset>
                            <label className="public-rsvp-field">Meal preference
                                <select value={meal} onChange={(event) => setMeal(event.target.value)}>
                                    <option value="">No preference / not specified</option>
                                    <option value="Standard">Standard</option>
                                    <option value="Vegetarian">Vegetarian</option>
                                    <option value="Vegan">Vegan</option>
                                    <option value="Pescatarian">Pescatarian</option>
                                    <option value="Halal">Halal</option>
                                    <option value="Other">Other (add a note below)</option>
                                </select>
                            </label>
                            <label className="public-rsvp-field">Food allergies or dietary notes
                                <textarea maxLength={1000} rows={3} value={allergies} onChange={(event) => setAllergies(event.target.value)} placeholder="Please share any allergies or dietary requirements." />
                            </label>
                        </>
                    )}
                    {error && <p className="auth-error" role="alert">{error}</p>}
                    {notice && <p className="auth-success" role="status">{notice}</p>}
                    <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Send RSVP'}</button>
                </form>
                <p className="public-rsvp-footer">Need to change your response? You can submit this form again using this invitation link.</p>
            </article>
        </main>
    );
}
