'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import BrandLockup from '@/components/layout/BrandLockup';
import {
    Activity, CalendarDays, CheckSquare, CircleDollarSign, LayoutDashboard,
    ListTodo, LogOut, Settings2, ShieldCheck, Sparkles, Users, UsersRound,
    Bell, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';

const links = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/activity', label: 'Activity', icon: Activity },
    { href: '/notifications', label: 'Notifications', icon: Bell },
    { href: '/calendar', label: 'Events & Calendar', icon: CalendarDays },
    { href: '/timeline', label: 'Timeline', icon: ListTodo },
    { href: '/tasks', label: 'Tasks', icon: CheckSquare },
    { href: '/guests', label: 'Guests & Seating', icon: UsersRound },
    { href: '/budget', label: 'Budget', icon: CircleDollarSign },
    { href: '/vendors', label: 'Vendors', icon: Users },
];

export default function Sidebar({ activeRole, isViewer }: { activeRole: string | null; isViewer: boolean }) {
    const router = useRouter();
    const pathname = usePathname();
    const [pendingPath, setPendingPath] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [signingOut, setSigningOut] = useState(false);
    const [collapsed, setCollapsed] = useState(false);
    const previousPathname = useRef(pathname);

    useEffect(() => {
        if (previousPathname.current !== pathname) {
            previousPathname.current = pathname;
            setPendingPath(null);
        }
    }, [pathname]);

    const handleNavigationClick = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
        if (
            event.defaultPrevented
            || event.button !== 0
            || event.metaKey
            || event.ctrlKey
            || event.shiftKey
            || event.altKey
            || event.currentTarget.target === '_blank'
        ) {
            return;
        }

        if (pathname !== href) setPendingPath(href);
    };

    const isHighlighted = (href: string) => pendingPath
        ? pendingPath === href
        : pathname === href || pathname.startsWith(`${href}/`);

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
        <aside className={`sidebar${collapsed ? ' sidebar-collapsed' : ''}`}>
            <div className="sidebar-header">
                <Link href="/dashboard" className="sidebar-brand" aria-label="Event Planner dashboard">
                    <BrandLockup compact={collapsed} />
                </Link>
                <button
                    className="sidebar-collapse"
                    type="button"
                    onClick={() => setCollapsed((value) => !value)}
                    aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
                </button>
            </div>
            <nav className="sidebar-nav" aria-label="Workspace">
                {!collapsed && <span className="sidebar-section-label">WORKSPACE</span>}
                {links.filter(({ href }) => !(isViewer && href === '/vendors')).map(({ href, label, icon: Icon }) => (
                    <Link
                        href={href}
                        className="sidebar-link"
                        onClick={(event) => handleNavigationClick(event, href)}
                        title={collapsed ? label : undefined}
                        aria-label={collapsed ? label : undefined}
                        aria-current={isHighlighted(href) ? 'page' : undefined}
                        aria-busy={pendingPath === href ? true : undefined}
                        key={href}
                    >
                        <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                        {!collapsed && <span>{label}</span>}
                    </Link>
                ))}
                {activeRole === 'admin' && <Link href="/events" className="sidebar-link" onClick={(event) => handleNavigationClick(event, '/events')} aria-current={isHighlighted('/events') ? 'page' : undefined} aria-busy={pendingPath === '/events' ? true : undefined}>
                    <CalendarDays size={18} strokeWidth={1.8} aria-hidden="true" />
                    {!collapsed && <span>Manage events</span>}
                </Link>}
                {!collapsed && <span className="sidebar-section-label sidebar-section-spaced">PREFERENCES</span>}
                {activeRole === 'admin' && <Link href="/settings/event" className="sidebar-link" onClick={(event) => handleNavigationClick(event, '/settings/event')} aria-current={isHighlighted('/settings/event') ? 'page' : undefined} aria-busy={pendingPath === '/settings/event' ? true : undefined}>
                    <Settings2 size={18} strokeWidth={1.8} aria-hidden="true" />
                    {!collapsed && <span>Event Settings</span>}
                </Link>}
                <Link href="/settings/team" className="sidebar-link" onClick={(event) => handleNavigationClick(event, '/settings/team')} aria-current={isHighlighted('/settings/team') ? 'page' : undefined} aria-busy={pendingPath === '/settings/team' ? true : undefined}>
                    <Users size={18} strokeWidth={1.8} aria-hidden="true" />
                    {!collapsed && <span>Account &amp; Team</span>}
                </Link>
                <Link href="/settings/account" className="sidebar-link" onClick={(event) => handleNavigationClick(event, '/settings/account')} aria-current={isHighlighted('/settings/account') ? 'page' : undefined} aria-busy={pendingPath === '/settings/account' ? true : undefined}>
                    <Sparkles size={18} strokeWidth={1.8} aria-hidden="true" />
                    {!collapsed && <span>Profile &amp; Preferences</span>}
                </Link>
                <Link href="/mfa" className="sidebar-link" onClick={(event) => handleNavigationClick(event, '/mfa')} aria-current={isHighlighted('/mfa') ? 'page' : undefined} aria-busy={pendingPath === '/mfa' ? true : undefined}>
                    <ShieldCheck size={18} strokeWidth={1.8} aria-hidden="true" />
                    {!collapsed && <span>Security</span>}
                </Link>
            </nav>
            <div className="sidebar-bottom">
                {error && <p className="sidebar-error" role="alert">{error}</p>}
                <button className="sidebar-signout" type="button" onClick={handleSignOut} disabled={signingOut}>
                    <LogOut size={18} aria-hidden="true" />
                    {!collapsed && <span>{signingOut ? 'Signing out…' : 'Sign out'}</span>}
                </button>
            </div>
        </aside>
    );
}
