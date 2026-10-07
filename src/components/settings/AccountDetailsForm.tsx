'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { updateProfile } from '@/actions/profile';
import { useTheme, type Theme } from '@/components/settings/ThemeProvider';

export default function AccountDetailsForm({
    email,
    initialDisplayName,
}: {
    email: string;
    initialDisplayName: string;
}) {
    const [displayName, setDisplayName] = useState(initialDisplayName);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [busy, startTransition] = useTransition();
    const { theme, setTheme } = useTheme();

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError('');
        setNotice('');
        startTransition(async () => {
            try {
                const result = await updateProfile(displayName);
                setDisplayName(result.displayName);
                setNotice('Profile updated.');
            } catch (caughtError) {
                setError(caughtError instanceof Error ? caughtError.message : 'Unable to update profile.');
            }
        });
    };

    return (
        <>
            <form className="planner-form-card account-details-form" onSubmit={submit}>
                <div className="planner-form-heading"><div><h2>Profile details</h2><span className="event-settings-name">Shown as your account name in the workspace.</span></div></div>
                <label>Display name<input required maxLength={80} value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
                <label>Email address<input type="email" value={email} readOnly disabled /><small>Managed by your sign-in provider; email changes require a separate verification flow.</small></label>
                {error && <p className="form-message form-message-error" role="alert">{error}</p>}
                {notice && <p className="form-message form-message-success" role="status">{notice}</p>}
                <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>
            </form>
            <section className="planner-form-card theme-preferences-card">
                <div className="planner-form-heading"><div><h2>Appearance</h2><span className="event-settings-name">Choose the display theme for this browser.</span></div></div>
                <div className="theme-choice-group" role="group" aria-label="Color theme">
                    {(['light', 'dark'] as const).map((choice: Theme) => (
                        <button
                            className={`theme-choice ${theme === choice ? 'theme-choice-active' : ''}`}
                            type="button"
                            aria-pressed={theme === choice}
                            key={choice}
                            onClick={() => setTheme(choice)}
                        >
                            <span aria-hidden="true">{choice === 'light' ? '☀' : '☾'}</span>
                            {choice === 'light' ? 'Light' : 'Dark'}
                        </button>
                    ))}
                </div>
                <p className="notification-preferences-note">Your selection is saved in this browser and applies across the app on this device.</p>
            </section>
        </>
    );
}
