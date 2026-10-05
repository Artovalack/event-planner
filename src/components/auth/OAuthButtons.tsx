'use client';

import { useState } from 'react';
import { signInWithOAuth, type OAuthProvider } from '@/lib/supabase/auth';

export default function OAuthButtons() {
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState<OAuthProvider | null>(null);

    const handleSignIn = async (provider: OAuthProvider) => {
        setPending(provider);
        setError(null);
        try {
            const { error: authError } = await signInWithOAuth(provider);
            if (authError) setError(authError.message);
        } catch (caughtError) {
            setError(caughtError instanceof Error ? caughtError.message : 'Unable to start social sign-in.');
        } finally {
            setPending(null);
        }
    };

    return (
        <div className="oauth-section">
            <div className="auth-divider"><span>or continue with</span></div>
            <div className="oauth-buttons">
                <button type="button" className="oauth-button" disabled={pending !== null} onClick={() => void handleSignIn('google')}>
                    {pending === 'google' ? 'Connecting…' : 'Continue with Google'}
                </button>
                <button type="button" className="oauth-button" disabled={pending !== null} onClick={() => void handleSignIn('facebook')}>
                    {pending === 'facebook' ? 'Connecting…' : 'Continue with Facebook'}
                </button>
            </div>
            {error && <p className="auth-error" role="alert">{error}</p>}
        </div>
    );
}
