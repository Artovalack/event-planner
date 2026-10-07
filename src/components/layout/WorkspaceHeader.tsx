'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { setActiveEvent } from '@/actions/planner';
import { useTheme } from '@/components/settings/ThemeProvider';
import type { EventRow } from '@/types/database';
import { ChevronDown, Moon, Sun } from 'lucide-react';

const routeLabels: Record<string, string> = {
    dashboard: 'Dashboard',
    activity: 'Activity',
    notifications: 'Notifications',
    calendar: 'Events & Calendar',
    timeline: 'Timeline',
    tasks: 'Tasks',
    guests: 'Guests & Seating',
    budget: 'Budget',
    vendors: 'Vendors',
    events: 'Events',
    settings: 'Settings',
    account: 'Account',
    team: 'Team',
    event: 'Event settings',
    mfa: 'Security',
};

export default function WorkspaceHeader({ events, activeEventId }: { events: EventRow[]; activeEventId: string | null }) {
    const pathname = usePathname();
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const [switchingEvent, startSwitch] = useTransition();
    const { theme, setTheme } = useTheme();
    const currentRoute = pathname.split('/').filter(Boolean);
    const currentLabel = routeLabels[currentRoute[0]] ?? 'Workspace';

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

    return (
        <header className="workspace-header">
            <div className="workspace-breadcrumbs" aria-label="Breadcrumb">
                <span>Workspace</span>
                <span className="breadcrumb-divider" aria-hidden="true">/</span>
                <span className="breadcrumb-current">{currentLabel}</span>
            </div>
            <div className="workspace-header-actions">
                {error && <span className="workspace-header-error" role="alert">{error}</span>}
                <label className="workspace-event-select">
                    <span className="workspace-event-dot" aria-hidden="true" />
                    <select
                        aria-label="Active event"
                        value={activeEventId ?? ''}
                        onChange={(event) => handleEventChange(event.target.value)}
                        disabled={!events.length || switchingEvent}
                    >
                        {!events.length && <option value="">Create an event first</option>}
                        {events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}
                    </select>
                    <ChevronDown size={14} aria-hidden="true" />
                </label>
                <button
                    className="header-icon-button"
                    type="button"
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
                    title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
                >
                    {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
                </button>
                <Link className="workspace-avatar" href="/settings/account" aria-label="Open profile and preferences">EP</Link>
            </div>
        </header>
    );
}
