'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseClient } from '../../../lib/supabase/client';
import { getAuthErrorMessage } from '@/lib/supabase/auth';
import OAuthButtons from '@/components/auth/OAuthButtons';
import BrandLockup from '@/components/layout/BrandLockup';
import { Check, Circle, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';

function getPasswordRequirements(password: string) {
    return [
        { id: 'length', label: 'At least 8 characters', valid: Array.from(password).length >= 8 },
        { id: 'lowercase', label: 'A lowercase letter', valid: /\p{Ll}/u.test(password) },
        { id: 'uppercase', label: 'An uppercase letter', valid: /\p{Lu}/u.test(password) },
        { id: 'number', label: 'A number', valid: /\p{N}/u.test(password) },
        { id: 'symbol', label: 'A symbol (such as !, @, or #)', valid: /[\p{P}\p{S}]/u.test(password) },
    ];
}

const SignupPage = () => {
    const nextPath = (() => {
        const value = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search).get('next');
        return value && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') ? value : '/events';
    })();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [hasAcceptedPolicies, setHasAcceptedPolicies] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const router = useRouter();
    const passwordRequirements = getPasswordRequirements(password);
    const passedRequirementCount = passwordRequirements.filter((requirement) => requirement.valid).length;
    const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
    const confirmationMismatch = confirmPassword.length > 0 && password !== confirmPassword;

    const handleSignup = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);

        if (!passwordRequirements.every((requirement) => requirement.valid)) {
            setError('Your password does not meet all the requirements yet.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setIsSubmitting(true);

        try {
            const { data, error } = await getSupabaseClient().auth.signUp({
                email,
                password,
                options: {
                    data: { onboarding_tour: 'pending' },
                },
            });

            if (error) {
                setError(getAuthErrorMessage(error, 'Unable to create your account.'));
                return;
            }

            if (data.session) {
                router.replace(nextPath);
                router.refresh();
            } else {
                router.push(`/verify-otp?email=${encodeURIComponent(email.trim())}&next=${encodeURIComponent(nextPath)}`);
            }
        } catch (signupError) {
            setError(getAuthErrorMessage(signupError, 'Unable to create your account.'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <main className="auth-page auth-signup-page">
            <aside className="auth-brand-panel" aria-label="Event Planner">
                <Link href="/" className="auth-brand"><BrandLockup /></Link>
                <div className="auth-brand-copy">
                    <p className="eyebrow">PLAN WITH CLARITY</p>
                    <h2>Every detail,<br />beautifully in place.</h2>
                    <p>Bring your team, timeline, guests, and budget together in one calm workspace.</p>
                </div>
                <span className="auth-brand-footnote">Create your workspace and start planning.</span>
            </aside>
            <section className="auth-card">
                <div className="auth-card-heading"><p className="eyebrow">GET STARTED</p><h1>Create your account</h1><p>Sign up to start planning your events.</p></div>
                <form className="auth-form" onSubmit={handleSignup}>
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
                            <input type={showPassword ? 'text' : 'password'} id="password" value={password} onChange={(event) => {
                                setPassword(event.target.value);
                                setError(null);
                            }} autoComplete="new-password" aria-describedby="password-requirements" required />
                            <button className="password-visibility-toggle" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>
                                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                            </button>
                        </div>
                        <section className="password-requirements" id="password-requirements" aria-label="Password requirements">
                            <div className="password-requirements-heading">
                                <span>Password requirements</span>
                                <span className="password-requirements-count" role="status" aria-live="polite">
                                    {password ? `${passedRequirementCount} of ${passwordRequirements.length} met` : 'Check as you type'}
                                </span>
                            </div>
                            <div className={`password-requirements-track${passedRequirementCount === passwordRequirements.length ? ' password-requirements-complete' : ''}`} aria-hidden="true">
                                <span style={{ width: `${(passedRequirementCount / passwordRequirements.length) * 100}%` }} />
                            </div>
                            <ul className="password-requirements-list">
                                {passwordRequirements.map((requirement) => (
                                    <li className={requirement.valid ? 'password-requirement password-requirement-met' : 'password-requirement'} key={requirement.id}>
                                        <span className="password-requirement-icon" aria-hidden="true">
                                            {requirement.valid ? <Check size={13} strokeWidth={2.5} /> : <Circle size={12} strokeWidth={1.8} />}
                                        </span>
                                        <span>{requirement.label}</span>
                                        <span className="password-requirement-state">{requirement.valid ? 'Met' : 'Needed'}</span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    </div>
                    <div className="auth-field">
                        <label htmlFor="confirm-password">Confirm password</label>
                        <div className="auth-input-wrap">
                            <LockKeyhole size={17} aria-hidden="true" />
                            <input type={showConfirmPassword ? 'text' : 'password'} id="confirm-password" value={confirmPassword} onChange={(event) => {
                                setConfirmPassword(event.target.value);
                                setError(null);
                            }} autoComplete="new-password" aria-invalid={confirmationMismatch} aria-describedby={confirmPassword ? 'password-match-status' : undefined} required />
                            <button className="password-visibility-toggle" type="button" onClick={() => setShowConfirmPassword((visible) => !visible)} aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'} aria-pressed={showConfirmPassword}>
                                {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                            </button>
                        </div>
                        {confirmPassword && <p className={`password-match-status${passwordsMatch ? ' password-match-success' : ' password-match-error'}`} id="password-match-status" role="status">
                            {passwordsMatch ? 'Passwords match.' : 'Passwords do not match yet.'}
                        </p>}
                    </div>
                    <label className="auth-consent">
                        <input type="checkbox" checked={hasAcceptedPolicies} onChange={(event) => setHasAcceptedPolicies(event.target.checked)} required />
                        <span>I agree to the <Link href="/terms" target="_blank" rel="noreferrer">Terms of Service</Link> and acknowledge the <Link href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</Link>.</span>
                    </label>
                    {error && <p className="auth-error" role="alert">{error}</p>}
                    <button className="auth-button" type="submit" disabled={isSubmitting}>
                        {isSubmitting ? 'Creating account…' : 'Sign Up'}
                    </button>
                </form>
                <OAuthButtons disabled={!hasAcceptedPolicies} />
                {!hasAcceptedPolicies && <p className="auth-policy-hint">Accept the terms and privacy policy to continue with a social account.</p>}
                <p className="auth-footer">
                    Already have an account? <Link href={`/login${nextPath === '/events' ? '' : `?next=${encodeURIComponent(nextPath)}`}`}>Log in</Link>
                </p>
            </section>
        </main>
    );
};

export default SignupPage;