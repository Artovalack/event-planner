'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveScheduleItem } from '@/actions/planner';
import { formatTimeInTimezone, zonedDateFromIso, zonedDateTimeToIso } from '@/lib/timezone';
import type { ScheduleItemRow } from '@/types/database';

type ScheduleIdea = {
    title: string;
    startTime: string;
    endTime: string;
    location: string;
    responsiblePerson: string;
    description: string;
};

export default function ScheduleGenerator({
    eventId,
    eventDate,
    timezone,
    venue,
    existingItems,
}: {
    eventId: string;
    eventDate: string | null;
    timezone: string;
    venue: string | null;
    existingItems: ScheduleItemRow[];
}) {
    const router = useRouter();
    const [eventType, setEventType] = useState('');
    const [startTime, setStartTime] = useState('08:00');
    const [endTime, setEndTime] = useState('22:00');
    const [notes, setNotes] = useState('');
    const [ideas, setIdeas] = useState<ScheduleIdea[]>([]);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [busy, startTransition] = useTransition();
    const localDate = zonedDateFromIso(eventDate, timezone);

    const generate = (formData: FormData) => {
        setError('');
        setNotice('');
        setIdeas([]);
        const formEventType = String(formData.get('eventType') ?? '').trim();
        const formStartTime = String(formData.get('startTime') ?? '');
        const formEndTime = String(formData.get('endTime') ?? '');
        const formNotes = String(formData.get('notes') ?? '').trim();
        startTransition(async () => {
            try {
                const response = await fetch('/api/ai/schedule-generator', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        eventType: formEventType,
                        startTime: formStartTime,
                        endTime: formEndTime,
                        notes: formNotes,
                    }),
                });
                const result = await response.json() as { error?: string; ideas?: ScheduleIdea[] };
                if (!response.ok) throw new Error(result.error ?? 'Unable to generate a schedule.');
                if (!Array.isArray(result.ideas) || !result.ideas.length) {
                    throw new Error('The AI returned no schedule items. Please try again.');
                }
                setIdeas(result.ideas);
            } catch (caughtError) {
                setError(caughtError instanceof Error ? caughtError.message : 'Unable to generate a schedule.');
            }
        });
    };

    const addIdea = (idea: ScheduleIdea) => {
        if (!localDate) {
            setError('Set the event date before adding schedule items.');
            return;
        }
        setError('');
        setNotice('');
        startTransition(async () => {
            try {
                const start = zonedDateTimeToIso(localDate, idea.startTime, timezone);
                const end = zonedDateTimeToIso(localDate, idea.endTime, timezone);
                await saveScheduleItem(eventId, {
                    title: idea.title,
                    description: idea.description || null,
                    starts_at: start,
                    ends_at: end,
                    location: idea.location || null,
                    responsible_person: idea.responsiblePerson || null,
                    sort_order: existingItems.length,
                });
                setIdeas((current) => current.filter((item) => item !== idea));
                setNotice(`“${idea.title}” was added to the run of show.`);
                router.refresh();
            } catch (caughtError) {
                setError(caughtError instanceof Error ? caughtError.message : `Unable to add ${idea.title}.`);
            }
        });
    };

    return (
        <section className="schedule-generator planner-form-card">
            <div className="planner-form-heading">
                <div><p className="eyebrow">AI SCHEDULE GENERATOR</p><h2>Draft an event-day schedule</h2></div>
            </div>
            <p className="schedule-generator-description">
                {localDate
                    ? `Suggestions use ${localDate} in ${timezone}${venue ? ` at ${venue}` : ''}. Review the draft and add items individually.`
                    : 'Set an event date in event settings before generating a schedule.'}
            </p>
            <form className="schedule-generator-form" action={generate}>
                <label>Event type<input name="eventType" required maxLength={120} value={eventType} onChange={(event) => setEventType(event.target.value)} placeholder="e.g. wedding, conference, birthday" /></label>
                <label>Start time<input name="startTime" type="time" required value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label>
                <label>End time<input name="endTime" type="time" required value={endTime} onChange={(event) => setEndTime(event.target.value)} /></label>
                <label className="schedule-generator-notes">Important details<textarea name="notes" maxLength={1000} rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ceremony, speeches, setup requirements, breaks…" /></label>
                <button className="secondary-button" type="submit" disabled={busy || !localDate}>{busy ? 'Generating…' : 'Generate draft'}</button>
            </form>
            {error && <p className="form-message form-message-error" role="alert">{error}</p>}
            {notice && <p className="form-message form-message-success" role="status">{notice}</p>}
            {ideas.length > 0 && (
                <ol className="schedule-idea-list">
                    {ideas.map((idea, index) => (
                        <li className="schedule-idea" key={`${idea.startTime}-${idea.title}-${index}`}>
                            <time>{formatTimeInTimezone(zonedDateTimeToIso(localDate, idea.startTime, timezone), timezone)}–{formatTimeInTimezone(zonedDateTimeToIso(localDate, idea.endTime, timezone), timezone)}</time>
                            <div className="schedule-idea-main">
                                <strong>{idea.title}</strong>
                                {(idea.location || idea.responsiblePerson) && <span>{[idea.location, idea.responsiblePerson].filter(Boolean).join(' · ')}</span>}
                                {idea.description && <p>{idea.description}</p>}
                            </div>
                            <button className="text-button" type="button" disabled={busy} onClick={() => addIdea(idea)}>Add item</button>
                        </li>
                    ))}
                </ol>
            )}
        </section>
    );
}
