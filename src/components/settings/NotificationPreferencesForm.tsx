'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { saveNotificationPreferences } from '@/actions/preferences';
import type { NotificationPreferences } from '@/lib/preferences';

const preferenceFields: {
    key: keyof NotificationPreferences;
    label: string;
    description: string;
}[] = [
    {
        key: 'email_deadlines',
        label: 'Email reminders',
        description: 'Receive email notifications for upcoming task deadlines.',
    },
    {
        key: 'in_app_deadlines',
        label: 'In-app reminders',
        description: 'Show task deadline reminders inside the app.',
    },
    {
        key: 'email_guest_rsvps',
        label: 'Email RSVP updates',
        description: 'Receive email notifications when a guest submits an RSVP.',
    },
    {
        key: 'in_app_guest_rsvps',
        label: 'In-app RSVP updates',
        description: 'Show guest RSVP updates inside the app.',
    },
];

export default function NotificationPreferencesForm({
    initialPreferences,
}: {
    initialPreferences: NotificationPreferences;
}) {
    const [preferences, setPreferences] = useState(initialPreferences);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [busy, startTransition] = useTransition();

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError('');
        setNotice('');
        startTransition(async () => {
            try {
                await saveNotificationPreferences(preferences);
                setNotice('Notification preferences saved.');
            } catch (caughtError) {
                setError(caughtError instanceof Error ? caughtError.message : 'Unable to save notification preferences.');
            }
        });
    };

    return (
        <form className="planner-form-card notification-preferences-form" onSubmit={submit}>
            <div className="planner-form-heading">
                <div><h2>Notification preferences</h2><span className="event-settings-name">Your settings apply to all workspaces.</span></div>
            </div>
            <p className="notification-preferences-note">
                These choices are saved to your account. Email and in-app notification delivery is not enabled yet.
            </p>
            <div className="notification-preference-list">
                {preferenceFields.map(({ key, label, description }) => (
                    <label className="notification-preference" key={key}>
                        <span><strong>{label}</strong><small>{description}</small></span>
                        <input
                            type="checkbox"
                            checked={preferences[key]}
                            disabled={busy}
                            onChange={(event) => setPreferences((current) => ({ ...current, [key]: event.target.checked }))}
                        />
                    </label>
                ))}
            </div>
            {error && <p className="form-message form-message-error" role="alert">{error}</p>}
            {notice && <p className="form-message form-message-success" role="status">{notice}</p>}
            <button className="primary-button" type="submit" disabled={busy}>
                {busy ? 'Saving…' : 'Save preferences'}
            </button>
        </form>
    );
}
