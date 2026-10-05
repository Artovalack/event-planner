'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { setActiveEvent } from '@/actions/planner';
import type { EventRow } from '@/types/database';

const links = [
    { href: '/events', label: 'Events', icon: '▦' },
    { href: '/tasks', label: 'Tasks', icon: '✓' },
    { href: '/guests', label: 'Guests', icon: '♙' },
    { href: '/budget', label: 'Budget', icon: '$' },
    { href: '/vendors', label: 'Vendors', icon: '⌂' },
    { href: '/dashboard', label: 'Dashboard', icon: '◫' },
];

export default function Sidebar({ events, activeEventId }: { events: EventRow[]; activeEventId: string | null }) {
    const router = useRouter();
    const pathname = usePathname();
    const [error, setError] = useState<string | null>(null);
    const [signingOut, setSigningOut] = useState(false);
    const [switchingEvent, startSwitch] = useTransition();

    const handleEventChange = (eventId: string) => {
        setError(null);
        startSwitch(async () => {
            try {
                await setActiveEvent(eventId);
                router.refresh();
            } catch (caughtError) {
                setError(caughtError instanceof Error ? caughtError.message : 'Unable to select this event.');
            }
        });
    };

    const handleSignOut = async () => {
        setSigningOut(true);
        setError(null);

        try {
            const { error: signOutError } = await getSupabaseClient().auth.signOut();
            if (signOutError) {
                setError(signOutError.message);
                return;
            }

            router.replace('/login');
            router.refresh();
        } catch (signOutError) {
            setError(signOutError instanceof Error ? signOutError.message : 'Unable to sign out.');
        } finally {
            setSigningOut(false);
        }
    };

    return (
        <aside className="sidebar">
            <Link href="/dashboard" className="sidebar-brand">
                <span className="brand-mark" aria-hidden="true">E</span>
                <span>Event Planner</span>
            </Link>
            <label className="active-event-field">
                <span>ACTIVE EVENT</span>
                <select
                    value={activeEventId ?? ''}
                    onChange={(event) => handleEventChange(event.target.value)}
                    disabled={!events.length || switchingEvent}
                >
                    {!events.length && <option value="">Create an event first</option>}
                    {events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}
                </select>
            </label>
            <nav className="sidebar-nav" aria-label="Workspace">
                <span className="sidebar-section-label">WORKSPACE</span>
                {links.map(({ href, label, icon }) => (
                    <Link
                        href={href}
                        className="sidebar-link"
                        aria-current={pathname === href || (href !== '/events' && pathname.startsWith(`${href}/`)) ? 'page' : undefined}
                        key={href}
                    >
                        <span aria-hidden="true">{icon}</span>
                        {label}
                    </Link>
                ))}
            </nav>
            <div className="sidebar-bottom">
                {error && <p className="sidebar-error" role="alert">{error}</p>}
                <Link href="/mfa" className="sidebar-signout">Authenticator security</Link>
                <button className="sidebar-signout" type="button" onClick={handleSignOut} disabled={signingOut}>
                    <span aria-hidden="true">↪</span>
                    {signingOut ? 'Signing out…' : 'Sign out'}
                </button>
            </div>
        </aside>
    );
}
