'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition, type KeyboardEvent } from 'react';
import { setActiveEvent } from '@/actions/planner';
import { useTheme } from '@/components/settings/ThemeProvider';
import type { EventRow } from '@/types/database';
import { CalendarDays, Check, ChevronDown, Moon, Sun } from 'lucide-react';

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
    const [eventMenuOpen, setEventMenuOpen] = useState(false);
    const { theme, setTheme } = useTheme();
    const eventPickerRef = useRef<HTMLDivElement>(null);
    const eventTriggerRef = useRef<HTMLButtonElement>(null);
    const eventOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const currentRoute = pathname.split('/').filter(Boolean);
    const currentLabel = routeLabels[currentRoute[0]] ?? 'Workspace';
    const activeEvent = events.find((event) => event.id === activeEventId) ?? null;

    useEffect(() => {
        if (!eventMenuOpen) return;

        const handlePointerDown = (event: PointerEvent) => {
            if (event.target instanceof Node && !eventPickerRef.current?.contains(event.target)) {
                setEventMenuOpen(false);
            }
        };
        const handleEscape = (event: globalThis.KeyboardEvent) => {
            if (event.key === 'Escape') {
                setEventMenuOpen(false);
                eventTriggerRef.current?.focus();
            }
        };

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [eventMenuOpen]);

    const handleEventChange = (eventId: string) => {
        if (eventId === activeEventId) {
            setEventMenuOpen(false);
            eventTriggerRef.current?.focus();
            return;
        }

        setError(null);
        setEventMenuOpen(false);
        startSwitch(async () => {
            try {
                await setActiveEvent(eventId);
                router.refresh();
            } catch (caughtError) {
                setError(caughtError instanceof Error ? caughtError.message : 'Unable to select this event.');
            } finally {
                setEventMenuOpen(false);
                eventTriggerRef.current?.focus();
            }
        });
    };

    const focusEventOption = (index: number) => {
        const optionCount = events.length;
        if (!optionCount) return;
        const wrappedIndex = (index + optionCount) % optionCount;
        eventOptionRefs.current[wrappedIndex]?.focus();
    };

    const handlePickerKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!eventMenuOpen) {
                setEventMenuOpen(true);
                requestAnimationFrame(() => {
                    const selectedIndex = events.findIndex((item) => item.id === activeEventId);
                    focusEventOption(selectedIndex < 0 ? 0 : selectedIndex);
                });
                return;
            }

            const focusedIndex = eventOptionRefs.current.findIndex((option) => option === document.activeElement);
            focusEventOption(focusedIndex + (event.key === 'ArrowDown' ? 1 : -1));
        } else if (event.key === 'Home' && eventMenuOpen) {
            event.preventDefault();
            focusEventOption(0);
        } else if (event.key === 'End' && eventMenuOpen) {
            event.preventDefault();
            focusEventOption(events.length - 1);
        } else if (event.key === 'Tab' && eventMenuOpen) {
            setEventMenuOpen(false);
        }
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
                <div className="workspace-event-picker" ref={eventPickerRef} onKeyDown={handlePickerKeyDown}>
                    <span className="workspace-event-caption" id="workspace-active-event-label">ACTIVE EVENT</span>
                    <button
                        ref={eventTriggerRef}
                        id="workspace-active-event"
                        className="workspace-event-select"
                        type="button"
                        aria-labelledby="workspace-active-event-label workspace-active-event-name"
                        aria-haspopup="menu"
                        aria-expanded={eventMenuOpen}
                        aria-controls="workspace-event-menu"
                        disabled={!events.length || switchingEvent}
                        onClick={() => setEventMenuOpen((open) => !open)}
                    >
                        <span className="workspace-event-dot" aria-hidden="true" />
                        <span className="workspace-event-value">
                            <span className="workspace-event-value-title" id="workspace-active-event-name">
                                {switchingEvent ? 'Switching event…' : activeEvent?.title ?? 'Create an event first'}
                            </span>
                        </span>
                        <ChevronDown className={eventMenuOpen ? 'workspace-event-chevron-open' : ''} size={16} aria-hidden="true" />
                    </button>
                    {eventMenuOpen && (
                        <div className="workspace-event-menu" id="workspace-event-menu">
                            <p className="workspace-event-menu-heading">Switch event</p>
                            <div role="menu" aria-label="Choose active event">
                                {events.map((event, index) => {
                                    const isActive = event.id === activeEventId;
                                    const eventDate = event.date
                                        ? new Date(event.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                                        : 'Date not set';
                                    return (
                                        <button
                                            ref={(element) => { eventOptionRefs.current[index] = element; }}
                                            className={`workspace-event-option${isActive ? ' workspace-event-option-active' : ''}`}
                                            type="button"
                                            role="menuitemradio"
                                            aria-checked={isActive}
                                            disabled={switchingEvent}
                                            key={event.id}
                                            onClick={() => handleEventChange(event.id)}
                                        >
                                            <span className="workspace-event-option-icon"><CalendarDays size={16} aria-hidden="true" /></span>
                                            <span className="workspace-event-option-copy">
                                                <span>{event.title}</span>
                                                <small>{eventDate}{event.location ? ` · ${event.location}` : ''}</small>
                                            </span>
                                            {isActive && <Check className="workspace-event-option-check" size={17} aria-hidden="true" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
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
