'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabase/client';
import { getAuthErrorMessage } from '@/lib/supabase/auth';

export default function VerifyOtpPage({ searchParams }: { searchParams: { email?: string; type?: string; next?: string } }) {
    const initialEmail = searchParams.email ?? '';
    const type: 'email' | 'signup' = searchParams.type === 'email' ? 'email' : 'signup';
    const nextPath = searchParams.next && searchParams.next.startsWith('/') && !searchParams.next.startsWith('//') && !searchParams.next.includes('\\')
        ? searchParams.next
        : '/events';
    const [email, setEmail] = useState(initialEmail);
    const [token, setToken] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const verify = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setBusy(true);
        setError(null);
        setNotice(null);
        try {
            const { error: verifyError } = await getSupabaseClient().auth.verifyOtp({
                email: email.trim(),
                token: token.trim(),
                type,
            });
            if (verifyError) {
                setError(getAuthErrorMessage(verifyError, 'Unable to verify this code.'));
                return;
            }
            window.location.replace(nextPath);
        } catch (caughtError) {
            setError(getAuthErrorMessage(caughtError, 'Unable to verify this code.'));
        } finally {
            setBusy(false);
        }
    };

    const resend = async () => {
        setBusy(true);
        setError(null);
        setNotice(null);
        try {
            const supabase = getSupabaseClient();
            const { error: resendError } = type === 'email'
                ? await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false } })
                : await supabase.auth.resend({ type: 'signup', email: email.trim() });
            if (resendError) setError(getAuthErrorMessage(resendError, 'Unable to resend the verification code.'));
            else setNotice('Supabase accepted the request. Check your spam or promotions folder; if the email still does not arrive, the project administrator should check the Supabase Auth logs and SMTP settings.');
        } catch (caughtError) {
            setError(getAuthErrorMessage(caughtError, 'Unable to resend the verification code.'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <main className="auth-page">
            <section className="auth-card">
                <h1>Verify your email</h1>
                <p className="auth-description">Enter the 6-digit code sent to your email address.</p>
                <form onSubmit={verify} className="auth-form">
                    <div className="auth-field">
                        <label htmlFor="email">Email</label>
                        <input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
                    </div>
                    <div className="auth-field">
                        <label htmlFor="token">6-digit verification code</label>
                        <input id="token" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={token} onChange={(event) => setToken(event.target.value.replace(/\D/g, '').slice(0, 6))} />
                    </div>
                    {error && <p className="auth-error" role="alert">{error}</p>}
                    {notice && <p className="auth-success" role="status">{notice}</p>}
                    <button className="auth-button" type="submit" disabled={busy}>{busy ? 'Verifying…' : 'Verify email'}</button>
                </form>
                <button className="auth-secondary-action" type="button" disabled={busy || !email.trim()} onClick={() => void resend()}>
                    Resend code
                </button>
                <p className="auth-footer"><Link href="/login">Back to log in</Link></p>
            </section>
        </main>
    );
}
