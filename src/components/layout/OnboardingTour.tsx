'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, CalendarDays, Check, Download, UsersRound, Wallet, Workflow } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase/client';

const steps = [
    {
        eyebrow: 'YOUR WORKSPACE',
        title: 'Plan your event in one place',
        description: 'Your dashboard gives you a quick overview of what is coming up and what still needs attention.',
        icon: CalendarDays,
        highlights: ['Create and switch between events', 'Set your event date, venue, timezone, and currency', 'Use the dashboard for a quick progress check'],
    },
    {
        eyebrow: 'PLAN THE DETAILS',
        title: 'Stay on top of tasks and timing',
        description: 'Turn a big plan into manageable steps, then keep the schedule moving.',
        icon: Workflow,
        highlights: ['Track tasks, deadlines, and subtasks', 'See event dates and milestones on the calendar', 'Build a detailed event-day run of show'],
    },
    {
        eyebrow: 'PEOPLE',
        title: 'Manage guests and your team',
        description: 'Keep guest details organized, collect RSVPs, and arrange seating as responses arrive.',
        icon: UsersRound,
        highlights: ['Create private RSVP links for invited guests', 'Share public registration for attendance requests', 'Review requests and organize seating', 'Invite collaborators or give clients read-only access'],
    },
    {
        eyebrow: 'EVENT OPERATIONS',
        title: 'Keep costs and suppliers together',
        description: 'Track the money and supplier details alongside the rest of your plan.',
        icon: Wallet,
        highlights: ['Estimate and track your event budget', 'Record vendor payment milestones', 'Keep supplier contracts in the private vault'],
    },
    {
        eyebrow: 'TEAM & TOOLS',
        title: 'Get help and share the plan',
        description: 'Bring your team into the workspace and use built-in tools to make planning easier.',
        icon: Download,
        highlights: ['Ask the assistant questions about your event', 'Export guest, vendor, and schedule details', 'Review workspace activity and manage account preferences'],
    },
];

export default function OnboardingTour() {
    const [checking, setChecking] = useState(true);
    const [portalReady, setPortalReady] = useState(false);
    const [visible, setVisible] = useState(false);
    const [stepIndex, setStepIndex] = useState(0);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const dialogRef = useRef<HTMLElement>(null);

    useEffect(() => {
        setPortalReady(true);
        let active = true;
        void getSupabaseClient().auth.getUser()
            .then(({ data, error: authError }) => {
                if (!active) return;
                if (!authError && data.user?.user_metadata?.onboarding_tour === 'pending') {
                    setVisible(true);
                }
            })
            .finally(() => {
                if (active) setChecking(false);
            });
        return () => {
            active = false;
        };
    }, []);

    const dismiss = useCallback(async () => {
        if (busy) return;
        setBusy(true);
        setError('');
        try {
            const supabase = getSupabaseClient();
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError) throw userError;
            if (!user) throw new Error('Your session has expired. Sign in again to finish this step.');
            const { error: updateError } = await supabase.auth.updateUser({
                data: { ...user.user_metadata, onboarding_tour: 'completed' },
            });
            if (updateError) throw updateError;
            setVisible(false);
        } catch (caughtError) {
            setError(caughtError instanceof Error ? caughtError.message : 'Unable to save your onboarding preference.');
        } finally {
            setBusy(false);
        }
    }, [busy]);

    useEffect(() => {
        if (!visible) return;
        dialogRef.current?.focus();
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                void dismiss();
                return;
            }
            if (event.key === 'Tab') {
                const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
                    'button:not(:disabled)',
                );
                if (!focusable?.length) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [dismiss, visible]);

    if (checking || !visible || !portalReady) return null;

    const step = steps[stepIndex];
    const StepIcon = step.icon;
    const isLastStep = stepIndex === steps.length - 1;

    return createPortal(
        <div className="onboarding-backdrop">
            <section
                ref={dialogRef}
                className="onboarding-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="onboarding-title"
                aria-describedby="onboarding-description"
                tabIndex={-1}
            >
                <header className="onboarding-header">
                    <div className="onboarding-brand-mark" aria-hidden="true">✦</div>
                    <button type="button" className="text-button onboarding-skip" onClick={() => void dismiss()} disabled={busy}>
                        Skip tour
                    </button>
                </header>
                <div className="onboarding-progress" aria-label={`Step ${stepIndex + 1} of ${steps.length}`}>
                    {steps.map((item, index) => <span className={index <= stepIndex ? 'onboarding-progress-active' : ''} key={item.eyebrow} />)}
                </div>
                <div className="onboarding-content">
                    <div className="onboarding-step-icon"><StepIcon size={24} aria-hidden="true" /></div>
                    <p className="eyebrow">{step.eyebrow} · {stepIndex + 1} OF {steps.length}</p>
                    <h1 id="onboarding-title">{step.title}</h1>
                    <p className="onboarding-description" id="onboarding-description">{step.description}</p>
                    <ul className="onboarding-highlights">
                        {step.highlights.map((highlight) => <li key={highlight}><Check size={16} aria-hidden="true" /><span>{highlight}</span></li>)}
                    </ul>
                </div>
                {error && <p className="form-message form-message-error onboarding-error" role="alert">{error}</p>}
                <footer className="onboarding-actions">
                    <button
                        type="button"
                        className="secondary-button"
                        onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
                        disabled={busy || stepIndex === 0}
                    >
                        <ArrowLeft size={15} aria-hidden="true" /> Back
                    </button>
                    {isLastStep ? (
                        <button type="button" className="primary-button" onClick={() => void dismiss()} disabled={busy}>
                            {busy ? 'Saving…' : 'Get started'} <Check size={15} aria-hidden="true" />
                        </button>
                    ) : (
                        <button type="button" className="primary-button" onClick={() => setStepIndex((current) => current + 1)} disabled={busy}>
                            Next <ArrowRight size={15} aria-hidden="true" />
                        </button>
                    )}
                </footer>
            </section>
        </div>,
        document.body,
    );
}
