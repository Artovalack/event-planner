'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '../../../lib/supabase/client';
import { getAuthErrorMessage } from '@/lib/supabase/auth';
import OAuthButtons from '@/components/auth/OAuthButtons';
import { LockKeyhole, Mail, Sparkles } from 'lucide-react';
import BrandLockup from '@/components/layout/BrandLockup';

const LoginPage = () => {
    const nextPath = (() => {
        const value = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search).get('next');
        return value && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') ? value : '/events';
    })();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        if (new URLSearchParams(window.location.search).get('error') === 'oauth') {
            setError('Unable to complete social sign-in. Please try again.');
        }
    }, []);

    const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);
        setIsSubmitting(true);

        try {
            const { error } = await getSupabaseClient().auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                setError(getAuthErrorMessage(error, 'Unable to log in.'));
                return;
            }

            window.location.assign(nextPath);
        } catch (loginError) {
            setError(getAuthErrorMessage(loginError, 'Unable to log in.'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <main className="auth-page">
            <aside className="auth-brand-panel" aria-label="Event Planner">
                <Link href="/" className="auth-brand"><BrandLockup /></Link>
                <div className="auth-brand-copy">
                    <p className="eyebrow">PLAN WITH CLARITY</p>
                    <h2>Every detail,<br />beautifully in place.</h2>
                    <p>Bring your team, timeline, guests, and budget together in one calm workspace.</p>
                </div>
                <span className="auth-brand-footnote"><Sparkles size={14} /> Made for the moments that matter</span>
            </aside>
            <section className="auth-card">
                <div className="auth-card-heading"><p className="eyebrow">WELCOME BACK</p><h1>Log in</h1><p>Enter your details to access your workspace.</p></div>
                <form onSubmit={handleLogin} className="auth-form">
                    <div className="auth-field">
                        <label htmlFor="email">Email</label>
                        <div className="auth-input-wrap">
                            <Mail size={17} aria-hidden="true" />
                            <input type="email" id="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
                        </div>
                    </div>
                    <div className="auth-field">
                        <label htmlFor="password">Password</label>
                        <div className="auth-input-wrap">
                            <LockKeyhole size={17} aria-hidden="true" />
                            <input type="password" id="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
                        </div>
                    </div>
                    {error && <p className="auth-error" role="alert">{error}</p>}
                    {notice && <p className="auth-success" role="status">{notice}</p>}
                    <button className="auth-button" type="submit" disabled={isSubmitting}>
                        {isSubmitting ? 'Logging in…' : 'Log in'}
                    </button>
                </form>
                <button className="auth-secondary-action" type="button" disabled={isSubmitting || !email.trim()} onClick={async () => {
                    setError(null);
                    setNotice(null);
                    setIsSubmitting(true);
                    try {
                        const { error: otpError } = await getSupabaseClient().auth.signInWithOtp({
                            email: email.trim(),
                            options: { shouldCreateUser: false },
                        });
                        if (otpError) setError(getAuthErrorMessage(otpError, 'Unable to send a sign-in code.'));
                        else router.push(`/verify-otp?email=${encodeURIComponent(email.trim())}&type=email&next=${encodeURIComponent(nextPath)}`);
                    } catch (caughtError) {
                        setError(getAuthErrorMessage(caughtError, 'Unable to send a sign-in code.'));
                    } finally {
                        setIsSubmitting(false);
                    }
                }}>Email me a sign-in code</button>
                <OAuthButtons />
                <p className="auth-footer">
                    Don&apos;t have an account? <Link href={`/signup${nextPath === '/events' ? '' : `?next=${encodeURIComponent(nextPath)}`}`}>Sign up</Link>
                </p>
            </section>
        </main>
    );
};

export default LoginPage;