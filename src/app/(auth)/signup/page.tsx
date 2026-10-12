'use client';

import { FormEvent, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseClient } from '../../../lib/supabase/client';
import { getAuthErrorMessage } from '@/lib/supabase/auth';
import OAuthButtons from '@/components/auth/OAuthButtons';
import BrandLockup from '@/components/layout/BrandLockup';
import { ArrowUpRight, CalendarDays, Check, Circle, Eye, EyeOff, LockKeyhole, Mail, Users, WalletCards } from 'lucide-react';

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
    const policyConsentRef = useRef<HTMLInputElement>(null);
    const passwordRequirements = getPasswordRequirements(password);
    const passedRequirementCount = passwordRequirements.filter((requirement) => requirement.valid).length;
    const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
    const confirmationMismatch = confirmPassword.length > 0 && password !== confirmPassword;

    const validatePolicyConsent = () => {
        const checkbox = policyConsentRef.current;
        if (!checkbox) return false;
        if (checkbox.checked) return true;
        checkbox.reportValidity();
        return false;
    };

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
            <div className="signup-layout">
                <section className="signup-form-panel" aria-labelledby="signup-title">
                    <header className="signup-topbar">
                        <Link href="/" className="signup-brand" aria-label="Event Planner home"><BrandLockup /></Link>
                        <p>Already have an account? <Link href={`/login${nextPath === '/events' ? '' : `?next=${encodeURIComponent(nextPath)}`}`}>Log in <ArrowUpRight size={15} aria-hidden="true" /></Link></p>
                    </header>
                    <div className="signup-form-heading">
                        <h1 id="signup-title">Create your account</h1>
                        <p>One calm place for every detail. Start planning in minutes.</p>
                    </div>
                    <div className="signup-form-content">
                        <form className="auth-form" onSubmit={handleSignup}>
                            <div className="auth-field">
                                <label htmlFor="email">Email address</label>
                                <div className="auth-input-wrap">
                                    <Mail size={17} aria-hidden="true" />
                                    <input type="email" id="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@example.com" required />
                                </div>
                            </div>
                            <div className="auth-field">
                                <label htmlFor="password">Create a password</label>
                                <div className="auth-input-wrap">
                                    <LockKeyhole size={17} aria-hidden="true" />
                                    <input type={showPassword ? 'text' : 'password'} id="password" value={password} onChange={(event) => {
                                        setPassword(event.target.value);
                                        setError(null);
                                    }} autoComplete="new-password" aria-describedby="password-requirements" placeholder="Choose a strong password" required />
                                    <button className="password-visibility-toggle" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>
                                        {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                                    </button>
                                </div>
                                <section className="password-requirements" id="password-requirements" aria-label="Password requirements">
                                    <div className="password-requirements-heading">
                                        <span>Password checklist</span>
                                        <span className="password-requirements-count" role="status" aria-live="polite">
                                            {password ? `${passedRequirementCount} of ${passwordRequirements.length} met` : 'As you type'}
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
                                <label htmlFor="confirm-password">Confirm your password</label>
                                <div className="auth-input-wrap">
                                    <LockKeyhole size={17} aria-hidden="true" />
                                    <input type={showConfirmPassword ? 'text' : 'password'} id="confirm-password" value={confirmPassword} onChange={(event) => {
                                        setConfirmPassword(event.target.value);
                                        setError(null);
                                    }} autoComplete="new-password" aria-invalid={confirmationMismatch} aria-describedby={confirmPassword ? 'password-match-status' : undefined} placeholder="Enter it once more" required />
                                    <button className="password-visibility-toggle" type="button" onClick={() => setShowConfirmPassword((visible) => !visible)} aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'} aria-pressed={showConfirmPassword}>
                                        {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                                    </button>
                                </div>
                                {confirmPassword && <p className={`password-match-status${passwordsMatch ? ' password-match-success' : ' password-match-error'}`} id="password-match-status" role="status">
                                    {passwordsMatch ? 'Passwords match.' : 'Passwords do not match yet.'}
                                </p>}
                            </div>
                            <label className="auth-consent">
                                <input ref={policyConsentRef} type="checkbox" checked={hasAcceptedPolicies} onChange={(event) => setHasAcceptedPolicies(event.target.checked)} required />
                                <span>I agree to the <Link href="/terms" target="_blank" rel="noreferrer">Terms of Service</Link> and acknowledge the <Link href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</Link>.</span>
                            </label>
                            {error && <p className="auth-error" role="alert">{error}</p>}
                            <button className="auth-button" type="submit" disabled={isSubmitting}>
                                {isSubmitting ? 'Creating your account…' : <>Create my account <ArrowUpRight size={17} aria-hidden="true" /></>}
                            </button>
                        </form>
                        <OAuthButtons onBeforeSignIn={validatePolicyConsent} />
                        <p className="auth-policy-hint">Accept the terms and privacy policy to continue with a social account.</p>
                    </div>
                </section>
                <aside className="signup-story-panel" aria-label="Your planning workspace preview">
                    <div className="signup-story-topline">
                        <span className="signup-preview-tag"><i /> PLANNING PREVIEW</span>
                    </div>
                    <div className="signup-story-copy">
                        <p className="eyebrow">LESS COORDINATING. MORE CELEBRATING.</p>
                        <h2>Make it a day<br /><em>worth remembering.</em></h2>
                        <p>Bring the schedule, the people, and all the little details together.</p>
                    </div>
                    <div className="signup-preview-card">
                        <div className="signup-preview-card-header">
                            <span>YOUR NEXT EVENT</span>
                            <span className="signup-preview-date">SAT <b>18</b> JUL</span>
                        </div>
                        <h2>A day worth<br />remembering.</h2>
                        <div className="signup-preview-progress">
                            <span>YOUR PLAN</span><b>IN GOOD SHAPE</b>
                            <div><i /></div>
                        </div>
                        <div className="signup-preview-agenda">
                            <div><span>09:30</span><i className="signup-agenda-dot signup-agenda-dot-blue" /><b>Welcome &amp; settle in</b></div>
                            <div><span>12:00</span><i className="signup-agenda-dot signup-agenda-dot-yellow" /><b>Gather around the table</b></div>
                            <div><span>16:00</span><i className="signup-agenda-dot signup-agenda-dot-mint" /><b>Make a little more magic</b></div>
                        </div>
                        <div className="signup-preview-footer">
                            <span className="signup-avatar-stack"><i>A</i><i>M</i><i>J</i></span>
                            <span>YOUR PEOPLE, ALL HERE</span>
                            <Users size={16} aria-hidden="true" />
                        </div>
                    </div>
                    <div className="signup-story-features">
                        <span><CalendarDays size={15} aria-hidden="true" /> Timelines that make sense</span>
                        <span><Users size={15} aria-hidden="true" /> A team on the same page</span>
                        <span><WalletCards size={15} aria-hidden="true" /> Budgets without the guesswork</span>
                    </div>
                </aside>
            </div>
        </main>
    );
};

export default SignupPage;