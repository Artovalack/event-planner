'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getSupabaseClient } from '../../lib/supabase/client';

export default function Sidebar() {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const [signingOut, setSigningOut] = useState(false);

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
        <aside className="sidebar w-64 min-h-screen border-r bg-slate-50 p-4">
            <Link href="/events" className="sidebar-brand">
                <span className="brand-mark" aria-hidden="true">E</span>
                <span>Event Planner</span>
            </Link>
            <nav className="sidebar-nav">
                <span className="sidebar-section-label">WORKSPACE</span>
                <Link href="/events" className="sidebar-link" aria-current="page">
                    <span aria-hidden="true">▦</span>
                    Events
                </Link>
            </nav>
            <div className="sidebar-bottom">
                {error && <p className="sidebar-error" role="alert">{error}</p>}
                <button className="sidebar-signout" type="button" onClick={handleSignOut} disabled={signingOut}>
                    <span aria-hidden="true">↪</span>
                    {signingOut ? 'Signing out…' : 'Sign out'}
                </button>
            </div>
        </aside>
    );
}
