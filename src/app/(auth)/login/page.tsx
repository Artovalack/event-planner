'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '../../../lib/supabase/client';
import { getAuthErrorMessage } from '@/lib/supabase/auth';
import OAuthButtons from '@/components/auth/OAuthButtons';

const LoginPage = () => {
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

            window.location.assign('/events');
        } catch (loginError) {
            setError(getAuthErrorMessage(loginError, 'Unable to log in.'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <main className="auth-page">
            <section className="auth-card">
                <h1>Log in</h1>
                <form onSubmit={handleLogin} className="auth-form">
                    <div className="auth-field">
                        <label htmlFor="email">Email</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            required
                        />
                    </div>
                    <div className="auth-field">
                        <label htmlFor="password">Password</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            required
                        />
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
                        else router.push(`/verify-otp?email=${encodeURIComponent(email.trim())}&type=email`);
                    } catch (caughtError) {
                        setError(getAuthErrorMessage(caughtError, 'Unable to send a sign-in code.'));
                    } finally {
                        setIsSubmitting(false);
                    }
                }}>Email me a sign-in code</button>
                <OAuthButtons />
                <p className="auth-footer">
                    Don&apos;t have an account? <Link href="/signup">Sign up</Link>
                </p>
            </section>
        </main>
    );
};

export default LoginPage;