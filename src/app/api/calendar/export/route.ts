import { NextResponse } from 'next/server';
import { getPlannerEvents } from '@/lib/planner';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import type { EventRow } from '@/types/database';

export const dynamic = 'force-dynamic';

type IcsItem = {
    uid: string;
    title: string;
    eventTitle: string;
    startsAt: string;
    endsAt?: string | null;
    allDay?: boolean;
    description?: string | null;
    location?: string | null;
};

function escapeIcsText(value: string) {
    return value.replaceAll('\\', '\\\\').replaceAll('\r\n', '\\n').replaceAll('\n', '\\n')
        .replaceAll(',', '\\,').replaceAll(';', '\\;');
}

function foldIcsLine(value: string) {
    const encoder = new TextEncoder();
    const lines: string[] = [];
    let current = '';
    let byteLength = 0;
    for (const character of value) {
        const characterLength = encoder.encode(character).length;
        if (byteLength + characterLength > 75) {
            lines.push(current);
            current = ` ${character}`;
            byteLength = 1 + characterLength;
        } else {
            current += character;
            byteLength += characterLength;
        }
    }
    lines.push(current);
    return lines.join('\r\n');
}

function utcDateTime(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new Error('Calendar data contains an invalid date.');
    return date.toISOString().replaceAll('-', '').replaceAll(':', '').replace(/\.\d{3}Z$/, 'Z');
}

function utcDate(value: string) {
    const date = value.slice(0, 10);
    const parsed = new Date(`${date}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
        throw new Error('Calendar data contains an invalid all-day date.');
    }
    return date.replaceAll('-', '');
}

function eventComponent(item: IcsItem, timestamp: string) {
    const dateLine = item.allDay
        ? `DTSTART;VALUE=DATE:${utcDate(item.startsAt)}`
        : `DTSTART:${utcDateTime(item.startsAt)}`;
    const endLine = item.allDay
        ? null
        : item.endsAt
            ? `DTEND:${utcDateTime(item.endsAt)}`
            : null;
    const lines = [
        'BEGIN:VEVENT',
        `UID:${escapeIcsText(item.uid)}`,
        `DTSTAMP:${timestamp}`,
        dateLine,
        ...(endLine ? [endLine] : []),
        `SUMMARY:${escapeIcsText(item.title)}`,
        `X-EVENT-PLANNER-EVENT:${escapeIcsText(item.eventTitle)}`,
        ...(item.description ? [`DESCRIPTION:${escapeIcsText(item.description)}`] : []),
        ...(item.location ? [`LOCATION:${escapeIcsText(item.location)}`] : []),
        'END:VEVENT',
    ];
    return lines.map(foldIcsLine).join('\r\n');
}

export async function GET() {
    try {
        const events = await getPlannerEvents();
        if (!events.length) return NextResponse.json({ error: 'No events are available to export.' }, { status: 404 });

        const eventIds = events.map((event) => event.id);
        const supabase = getSupabaseServerClient();
        const [tasksResult, milestonesResult, scheduleResult] = await Promise.all([
            supabase.from('tasks').select('id, event_id, title, due_date, notes').in('event_id', eventIds).not('due_date', 'is', null),
            supabase.from('vendor_payment_milestones').select('id, event_id, label, due_at, amount, status').in('event_id', eventIds).neq('status', 'cancelled'),
            supabase.from('event_schedule_items').select('id, event_id, title, starts_at, ends_at, location, description').in('event_id', eventIds),
        ]);
        if (tasksResult.error) throw new Error(`Unable to load calendar tasks: ${tasksResult.error.message}`);
        if (milestonesResult.error) throw new Error(`Unable to load payment milestones: ${milestonesResult.error.message}`);
        if (scheduleResult.error) throw new Error(`Unable to load run-of-show items: ${scheduleResult.error.message}`);

        const eventTitles = new Map(events.map((event: EventRow) => [event.id, event.title]));
        const items: IcsItem[] = [
            ...events.filter((event) => event.date).map((event) => ({
                uid: `${event.id}@event-planner`,
                title: event.title,
                eventTitle: event.title,
                startsAt: event.date!,
                allDay: true,
                description: event.description ?? null,
                location: event.venue_name ?? event.venue_address ?? event.location ?? null,
            })),
            ...(tasksResult.data ?? []).map((task) => ({
                uid: `${task.id}@event-planner`,
                title: `Task deadline: ${task.title}`,
                eventTitle: eventTitles.get(task.event_id) ?? 'Event',
                startsAt: task.due_date!,
                allDay: true,
                description: task.notes,
            })),
            ...(milestonesResult.data ?? []).map((milestone) => ({
                uid: `${milestone.id}@event-planner`,
                title: `Payment: ${milestone.label}`,
                eventTitle: eventTitles.get(milestone.event_id) ?? 'Event',
                startsAt: milestone.due_at,
                description: `Amount: ${milestone.amount} · Status: ${milestone.status}`,
            })),
            ...(scheduleResult.data ?? []).map((schedule) => ({
                uid: `${schedule.id}@event-planner`,
                title: schedule.title,
                eventTitle: eventTitles.get(schedule.event_id) ?? 'Event',
                startsAt: schedule.starts_at,
                endsAt: schedule.ends_at,
                description: schedule.description,
                location: schedule.location,
            })),
        ].sort((left, right) => left.startsAt.localeCompare(right.startsAt));

        const timestamp = new Date().toISOString().replaceAll('-', '').replaceAll(':', '').replace(/\.\d{3}Z$/, 'Z');
        const calendar = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Event Planner//Calendar Export//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            ...items.map((item) => eventComponent(item, timestamp)),
            'END:VCALENDAR',
            '',
        ].map(foldIcsLine).join('\r\n');

        return new Response(calendar, {
            headers: {
                'Content-Type': 'text/calendar; charset=utf-8',
                'Content-Disposition': 'attachment; filename="event-planner-calendar.ics"',
                'Cache-Control': 'private, no-store',
            },
        });
    } catch (error) {
        console.error('Unable to export the calendar:', error);
        return NextResponse.json({ error: 'Unable to export the calendar.' }, { status: 500 });
    }
}
