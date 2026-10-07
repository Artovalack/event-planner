'use client';

import { useMemo, useState } from 'react';
import type { CalendarItem } from '@/types/database';

type ViewMode = 'month' | 'week' | 'agenda';
const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dateKey(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function itemDate(item: CalendarItem) {
    return item.allDay ? new Date(`${item.startsAt.slice(0, 10)}T00:00:00`) : new Date(item.startsAt);
}

function monthTitle(date: Date) {
    return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export default function CalendarView({ items }: { items: CalendarItem[] }) {
    const [view, setView] = useState<ViewMode>('month');
    const [cursor, setCursor] = useState(() => startOfDay(new Date()));
    const [selectedDay, setSelectedDay] = useState(() => dateKey(new Date()));
    const itemsByDay = useMemo(() => {
        const grouped = new Map<string, CalendarItem[]>();
        for (const item of items) {
            const key = dateKey(itemDate(item));
            grouped.set(key, [...(grouped.get(key) ?? []), item]);
        }
        for (const dayItems of grouped.values()) {
            dayItems.sort((a, b) => itemDate(a).getTime() - itemDate(b).getTime());
        }
        return grouped;
    }, [items]);
    const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const monthOffset = monthStart.getDay();
    const monthGridStart = new Date(monthStart.getTime() - monthOffset * DAY_MS);
    const monthDays = Array.from({ length: 42 }, (_, index) => new Date(monthGridStart.getTime() + index * DAY_MS));
    const weekStart = new Date(startOfDay(cursor).getTime() - cursor.getDay() * DAY_MS);
    const weekDays = Array.from({ length: 7 }, (_, index) => new Date(weekStart.getTime() + index * DAY_MS));
    const displayedDays = view === 'week' ? weekDays : monthDays;
    const agendaItems = items.filter((item) => {
        const date = itemDate(item);
        return date.getFullYear() === cursor.getFullYear() && date.getMonth() === cursor.getMonth();
    }).sort((a, b) => itemDate(a).getTime() - itemDate(b).getTime());

    const moveCursor = (direction: number) => {
        setCursor((current) => {
            const next = new Date(current);
            if (view === 'week') next.setDate(next.getDate() + direction * 7);
            else next.setMonth(next.getMonth() + direction);
            return next;
        });
    };

    const selectDate = (date: Date) => {
        setSelectedDay(dateKey(date));
        setCursor(date);
    };

    return (
        <section className="calendar-panel" aria-label="Event calendar">
            <header className="calendar-toolbar">
                <div className="calendar-date-controls">
                    <button className="secondary-button" type="button" onClick={() => moveCursor(-1)} aria-label="Previous period">←</button>
                    <button className="secondary-button" type="button" onClick={() => { const today = startOfDay(new Date()); setCursor(today); setSelectedDay(dateKey(today)); }}>Today</button>
                    <button className="secondary-button" type="button" onClick={() => moveCursor(1)} aria-label="Next period">→</button>
                    <h2>{monthTitle(cursor)}</h2>
                </div>
                <div className="calendar-view-switch" role="group" aria-label="Calendar view">
                    {(['month', 'week', 'agenda'] as const).map((mode) => (
                        <button
                            className={view === mode ? 'calendar-view-active' : ''}
                            type="button"
                            aria-pressed={view === mode}
                            key={mode}
                            onClick={() => setView(mode)}
                        >
                            {mode[0].toUpperCase() + mode.slice(1)}
                        </button>
                    ))}
                </div>
            </header>

            {view !== 'agenda' ? (
                <div className={`calendar-grid ${view === 'week' ? 'calendar-week-grid' : ''}`}>
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <div className="calendar-weekday" key={day}>{day}</div>)}
                    {displayedDays.map((day) => {
                        const key = dateKey(day);
                        const dayItems = itemsByDay.get(key) ?? [];
                        return (
                            <button
                                type="button"
                                className={`calendar-day ${day.getMonth() !== cursor.getMonth() && view === 'month' ? 'calendar-day-muted' : ''} ${selectedDay === key ? 'calendar-day-selected' : ''}`}
                                key={key}
                                onClick={() => selectDate(day)}
                                aria-label={`${day.toLocaleDateString()}${dayItems.length ? `, ${dayItems.length} items` : ''}`}
                            >
                                <span className="calendar-day-number">{day.getDate()}</span>
                                {dayItems.slice(0, 3).map((item) => (
                                    <span className={`calendar-event-chip calendar-event-${item.kind}`} key={`${item.kind}-${item.id}`} title={`${item.title} · ${item.eventTitle}`}>
                                        {item.title}
                                    </span>
                                ))}
                                {dayItems.length > 3 && <span className="calendar-overflow">+{dayItems.length - 3} more</span>}
                            </button>
                        );
                    })}
                </div>
            ) : (
                <div className="calendar-agenda">
                    {!agendaItems.length && <p className="calendar-empty">No scheduled items in {monthTitle(cursor)}.</p>}
                    {agendaItems.map((item) => (
                        <article className="calendar-agenda-item" key={`${item.kind}-${item.id}`}>
                            <time dateTime={item.startsAt}>{itemDate(item).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</time>
                            <span className={`calendar-kind-dot calendar-event-${item.kind}`} aria-hidden="true" />
                            <div><strong>{item.title}</strong><small>{item.eventTitle}{item.allDay ? '' : ` · ${itemDate(item).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}</small></div>
                            <span className="calendar-kind-label">{item.kind}</span>
                        </article>
                    ))}
                </div>
            )}
            {view !== 'agenda' && (
                <div className="calendar-selection">
                    <h3>{new Date(`${selectedDay}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
                    {(itemsByDay.get(selectedDay) ?? []).length === 0
                        ? <p>No items for this day.</p>
                        : (itemsByDay.get(selectedDay) ?? []).map((item) => (
                            <p key={`${item.kind}-${item.id}`}><strong>{item.title}</strong><span>{item.eventTitle} · {item.kind}</span></p>
                        ))}
                </div>
            )}
            <footer className="calendar-legend">
                {(['event', 'task', 'payment', 'schedule'] as const).map((kind) => <span key={kind}><i className={`calendar-kind-dot calendar-event-${kind}`} />{kind === 'payment' ? 'Vendor payment' : kind === 'schedule' ? 'Run of show' : kind[0].toUpperCase() + kind.slice(1)}</span>)}
            </footer>
        </section>
    );
}
