'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase/client';

type TotpFactor = {
    id: string;
    friendly_name?: string | null;
    status: 'verified' | 'unverified';
};

type Enrollment = {
    id: string;
    qrCode: string;
    secret: string;
};

function getNextPath(): string {
    const value = new URLSearchParams(window.location.search).get('next');
    if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/events';
    return value;
}

export default function MfaManager({ initialChallenge = false }: { initialChallenge?: boolean }) {
    const router = useRouter();
    const [factors, setFactors] = useState<TotpFactor[]>([]);
    const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
    const [challengeFactorId, setChallengeFactorId] = useState('');
    const [challengeMode, setChallengeMode] = useState(initialChallenge);
    const [code, setCode] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const loadFactors = async () => {
        const supabase = getSupabaseClient();
        const [{ data: factorData, error: factorError }, { data: assurance, error: assuranceError }] = await Promise.all([
            supabase.auth.mfa.listFactors(),
            supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        ]);
        if (factorError) throw factorError;
        if (assuranceError) throw assuranceError;
        const verified = (factorData.totp ?? []).filter((factor) => factor.status === 'verified') as TotpFactor[];
        setFactors(verified);
        setChallengeMode(initialChallenge || (assurance.currentLevel === 'aal1' && assurance.nextLevel === 'aal2'));
        setChallengeFactorId(verified[0]?.id ?? '');
    };

    useEffect(() => {
        void loadFactors().catch((caughtError: unknown) => {
            setError(caughtError instanceof Error ? caughtError.message : 'Unable to load authenticator settings.');
        });
    }, []);

    const beginEnrollment = async () => {
        setBusy(true);
        setError(null);
        setNotice(null);
        try {
            const supabase = getSupabaseClient();
            const { data: factorData, error: factorError } = await supabase.auth.mfa.listFactors();
            if (factorError) throw factorError;

            const unfinishedFactors = factorData.all.filter(
                (factor) => factor.factor_type === 'totp' && factor.status === 'unverified',
            );
            const cleanupResults = await Promise.all(
                unfinishedFactors.map(({ id }) => supabase.auth.mfa.unenroll({ factorId: id })),
            );
            const cleanupError = cleanupResults.find((result) => result.error)?.error;
            if (cleanupError) throw cleanupError;

            const existingNames = new Set(
                factorData.all
                    .filter((factor) => !unfinishedFactors.some(({ id }) => id === factor.id))
                    .map((factor) => factor.friendly_name)
                    .filter((name): name is string => Boolean(name)),
            );
            let friendlyName = 'Authenticator app';
            let suffix = 2;
            while (existingNames.has(friendlyName)) {
                friendlyName = `Authenticator app ${suffix}`;
                suffix += 1;
            }

            const { data, error: enrollError } = await supabase.auth.mfa.enroll({
                factorType: 'totp',
                friendlyName,
            });
            if (enrollError) throw enrollError;
            setEnrollment({
                id: data.id,
                qrCode: data.totp.qr_code,
                secret: data.totp.secret,
            });
            setCode('');
        } catch (caughtError) {
            setError(caughtError instanceof Error ? caughtError.message : 'Unable to start authenticator setup.');
        } finally {
            setBusy(false);
        }
    };

    const verifyCode = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setBusy(true);
        setError(null);
        setNotice(null);
        try {
            const factorId = enrollment?.id ?? challengeFactorId;
            if (!factorId) throw new Error('No authenticator factor is available.');
            const { error: verifyError } = await getSupabaseClient().auth.mfa.challengeAndVerify({
                factorId,
                code: code.trim(),
            });
            if (verifyError) throw verifyError;

            if (enrollment) {
                setEnrollment(null);
                setCode('');
                await loadFactors();
                setNotice('Authenticator app enabled. Keep your recovery options safe.');
            } else {
                router.replace(getNextPath());
                router.refresh();
            }
        } catch (caughtError) {
            setError(caughtError instanceof Error ? caughtError.message : 'The authenticator code could not be verified.');
        } finally {
            setBusy(false);
        }
    };

    const removeFactor = async (factorId: string) => {
        if (!window.confirm('Remove this authenticator from your account?')) return;
        setBusy(true);
        setError(null);
        setNotice(null);
        try {
            const { error: unenrollError } = await getSupabaseClient().auth.mfa.unenroll({ factorId });
            if (unenrollError) throw unenrollError;
            await loadFactors();
            setNotice('Authenticator removed.');
        } catch (caughtError) {
            setError(caughtError instanceof Error ? caughtError.message : 'Unable to remove this authenticator.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <main className="auth-page mfa-auth-page">
            <section className="auth-card mfa-card">
                {!challengeMode && (
                    <Link className="mfa-back-link" href="/settings/account">
                        <ArrowLeft size={16} aria-hidden="true" />
                        Back to profile &amp; preferences
                    </Link>
                )}
                <h1>{challengeMode ? 'Two-step verification' : 'Authenticator security'}</h1>
                <p className="auth-description">
                    {challengeMode
                        ? 'Enter the current 6-digit code from your authenticator app to continue.'
                        : 'Use a TOTP app such as Google Authenticator or Authy to protect your account.'}
                </p>

                {!challengeMode && !enrollment && (
                    <div className="mfa-factor-list">
                        {factors.map((factor) => (
                            <div className="mfa-factor-row" key={factor.id}>
                                <span>{factor.friendly_name || 'Authenticator app'} <small>Enabled</small></span>
                                <button type="button" className="danger-button" disabled={busy} onClick={() => void removeFactor(factor.id)}>Remove</button>
                            </div>
                        ))}
                        {!factors.length && <p className="auth-description">No authenticator app is currently enabled.</p>}
                        <button className="auth-button" type="button" disabled={busy} onClick={() => void beginEnrollment()}>
                            {busy ? 'Preparing…' : factors.length ? 'Add another authenticator' : 'Set up authenticator'}
                        </button>
                    </div>
                )}

                {enrollment && (
                    <div className="mfa-enrollment">
                        <ol>
                            <li>Open your authenticator app and scan this QR code.</li>
                            <li>If scanning is unavailable, enter the setup key manually.</li>
                            <li>Enter the current code from the app to finish setup.</li>
                        </ol>
                        <img className="mfa-qr-code" src={enrollment.qrCode} alt="Authenticator enrollment QR code" />
                        <p className="mfa-secret"><strong>Setup key:</strong> <code>{enrollment.secret}</code></p>
                    </div>
                )}

                {(challengeMode || enrollment) && <form className="auth-form" onSubmit={verifyCode}>
                    {challengeMode && factors.length > 1 && <div className="auth-field">
                        <label htmlFor="factor">Authenticator</label>
                        <select id="factor" value={challengeFactorId} onChange={(event) => setChallengeFactorId(event.target.value)}>
                            {factors.map((factor) => <option key={factor.id} value={factor.id}>{factor.friendly_name || 'Authenticator app'}</option>)}
                        </select>
                    </div>}
                    <div className="auth-field">
                        <label htmlFor="mfa-code">6-digit authenticator code</label>
                        <input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} />
                    </div>
                    {error && <p className="auth-error" role="alert">{error}</p>}
                    {notice && <p className="auth-success" role="status">{notice}</p>}
                    <button className="auth-button" type="submit" disabled={busy}>{busy ? 'Verifying…' : enrollment ? 'Enable authenticator' : 'Verify and continue'}</button>
                    {enrollment && <button className="auth-secondary-action" type="button" disabled={busy} onClick={() => { setEnrollment(null); setCode(''); }}>Cancel setup</button>}
                </form>}

                {!challengeMode && !enrollment && notice && <p className="auth-success" role="status">{notice}</p>}
                {!challengeMode && !enrollment && error && <p className="auth-error" role="alert">{error}</p>}
            </section>
        </main>
    );
}
