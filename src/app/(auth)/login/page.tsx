'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseClient } from '../../../lib/supabase/client';

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const router = useRouter();

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
                setError(error.message);
                return;
            }

            router.push('/events');
        } catch (loginError) {
            const message = loginError instanceof Error ? loginError.message : 'Unable to log in.';
            setError(
                /failed to fetch|fetch failed|networkerror/i.test(message)
                    ? 'Unable to reach Supabase. Check your project URL and network connection.'
                    : message,
            );
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
                    <button className="auth-button" type="submit" disabled={isSubmitting}>
                        {isSubmitting ? 'Logging in…' : 'Log in'}
                    </button>
                </form>
                <p className="auth-footer">
                    Don&apos;t have an account? <Link href="/signup">Sign up</Link>
                </p>
            </section>
        </main>
    );
};

export default LoginPage;