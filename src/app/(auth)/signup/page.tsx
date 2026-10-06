'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseClient } from '../../../lib/supabase/client';
import { getAuthErrorMessage } from '@/lib/supabase/auth';
import OAuthButtons from '@/components/auth/OAuthButtons';

const SignupPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const router = useRouter();

    const handleSignup = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);
        setIsSubmitting(true);

        try {
            const { data, error } = await getSupabaseClient().auth.signUp({
                email,
                password,
            });

            if (error) {
                setError(getAuthErrorMessage(error, 'Unable to create your account.'));
                return;
            }

            if (data.session) {
                router.replace('/events');
                router.refresh();
            } else {
                router.push(`/verify-otp?email=${encodeURIComponent(email.trim())}`);
            }
        } catch (signupError) {
            setError(getAuthErrorMessage(signupError, 'Unable to create your account.'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <main className="auth-page">
            <section className="auth-card">
                <h1>Sign Up</h1>
                <form className="auth-form" onSubmit={handleSignup}>
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
                        {isSubmitting ? 'Creating account…' : 'Sign Up'}
                    </button>
                </form>
                <OAuthButtons />
                <p className="auth-footer">
                    Already have an account? <Link href="/login">Log in</Link>
                </p>
            </section>
        </main>
    );
};

export default SignupPage;