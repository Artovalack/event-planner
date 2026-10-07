'use client';

import { useState, type FormEvent } from 'react';
import { deleteScheduleItem, saveScheduleItem } from '@/actions/planner';
import ScheduleGenerator from '@/components/timeline/ScheduleGenerator';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { formatTimeInTimezone, zonedDateTimeInput, zonedDateTimeToIso } from '@/lib/timezone';
import type { ScheduleItemRow } from '@/types/database';

type FormState = {
    title: string;
    description: string;
    starts_at: string;
    ends_at: string;
    location: string;
    responsible_person: string;
};

const emptyForm: FormState = { title: '', description: '', starts_at: '', ends_at: '', location: '', responsible_person: '' };

export default function RunOfShowEditor({ eventId, eventDate, timezone, venue, items, readOnly = false }: { eventId: string; eventDate: string | null; timezone: string; venue: string | null; items: ScheduleItemRow[]; readOnly?: boolean }) {
    const [form, setForm] = useState<FormState>(emptyForm);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [itemPendingDelete, setItemPendingDelete] = useState<ScheduleItemRow | null>(null);

    const edit = (item: ScheduleItemRow) => {
        setEditingId(item.id);
        setForm({
            title: item.title,
            description: item.description ?? '',
            starts_at: zonedDateTimeInput(item.starts_at, timezone),
            ends_at: item.ends_at ? zonedDateTimeInput(item.ends_at, timezone) : '',
            location: item.location ?? '',
            responsible_person: item.responsible_person ?? '',
        });
        setNotice(null);
        setError(null);
    };

    const cancel = () => {
        setEditingId(null);
        setForm(emptyForm);
        setError(null);
    };

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setSaving(true);
        setError(null);
        setNotice(null);
        try {
            const [startDate, startTime] = form.starts_at.split('T');
            const [endDate, endTime] = form.ends_at.split('T');
            await saveScheduleItem(eventId, {
                title: form.title.trim(),
                description: form.description.trim() || null,
                starts_at: zonedDateTimeToIso(startDate, startTime, timezone),
                ends_at: form.ends_at ? zonedDateTimeToIso(endDate, endTime, timezone) : null,
                location: form.location.trim() || null,
                responsible_person: form.responsible_person.trim() || null,
                sort_order: items.find((item) => item.id === editingId)?.sort_order ?? items.length,
            }, editingId ?? undefined);
            setNotice(editingId ? 'Schedule item updated.' : 'Schedule item added.');
            setEditingId(null);
            setForm(emptyForm);
        } catch (caughtError) {
            setError(caughtError instanceof Error ? caughtError.message : 'Unable to save the schedule item.');
        } finally {
            setSaving(false);
        }
    };

    const remove = (item: ScheduleItemRow) => {
        setItemPendingDelete(item);
    };

    const confirmRemove = async () => {
        if (!itemPendingDelete) return false;
        const item = itemPendingDelete;
        setError(null);
        setNotice(null);
        try {
            await deleteScheduleItem(eventId, item.id);
            if (editingId === item.id) cancel();
            setNotice('Schedule item deleted.');
            return true;
        } catch (caughtError) {
            setError(caughtError instanceof Error ? caughtError.message : 'Unable to delete the schedule item.');
            return false;
        }
    };

    const exportCsv = () => {
        const rows = [
            ['Start', 'End', 'Title', 'Location', 'Responsible person', 'Description'],
            ...items.map((item) => [item.starts_at, item.ends_at ?? '', item.title, item.location ?? '', item.responsible_person ?? '', item.description ?? '']),
        ];
        const csv = rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(',')).join('\r\n');
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = 'run-of-show.csv';
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="timeline-layout">
            {!readOnly && <ScheduleGenerator eventId={eventId} eventDate={eventDate} timezone={timezone} venue={venue} existingItems={items} />}
            {!readOnly && <section className="planner-form-card">
                <div className="planner-form-heading"><h2>{editingId ? 'Edit schedule item' : 'Add a schedule item'}</h2></div>
                <form className="planner-form-grid" onSubmit={submit}>
                    <label className="planner-form-wide">Title<input required maxLength={160} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
                    <label>Start time<input required type="datetime-local" value={form.starts_at} onChange={(event) => setForm({ ...form, starts_at: event.target.value })} /></label>
                    <label>End time<input type="datetime-local" min={form.starts_at || undefined} value={form.ends_at} onChange={(event) => setForm({ ...form, ends_at: event.target.value })} /></label>
                    <label>Location<input maxLength={160} value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label>
                    <label>Responsible person<input maxLength={120} value={form.responsible_person} onChange={(event) => setForm({ ...form, responsible_person: event.target.value })} /></label>
                    <label className="planner-form-wide">Notes<textarea rows={3} maxLength={2000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
                    <div className="planner-form-wide event-form-actions">
                        <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Save changes' : 'Add to timeline'}</button>
                        {editingId && <button className="secondary-button" type="button" onClick={cancel} disabled={saving}>Cancel</button>}
                    </div>
                    {error && <p className="auth-error planner-form-wide" role="alert">{error}</p>}
                    {notice && <p className="auth-success planner-form-wide" role="status">{notice}</p>}
                </form>
            </section>}

            <section className="timeline-list-card">
                <header className="timeline-list-header">
                    <div><p className="eyebrow">EVENT DAY</p><h2>Run of show</h2></div>
                    <button className="secondary-button" type="button" onClick={exportCsv} disabled={!items.length}>Export CSV</button>
                </header>
                {!items.length ? <p className="timeline-empty">No items yet. Add the first event-day activity above.</p> : (
                    <ol className="timeline-list">
                        {items.map((item) => (
                            <li key={item.id}>
                                <div className="timeline-time">{formatTimeInTimezone(item.starts_at, timezone)}{item.ends_at && <small>to {formatTimeInTimezone(item.ends_at, timezone)}</small>}</div>
                                <div className="timeline-marker" aria-hidden="true" />
                                <article className="timeline-item">
                                    <div className="timeline-item-heading"><h3>{item.title}</h3>{!readOnly && <div className="planner-card-actions"><button className="text-button" type="button" onClick={() => edit(item)}>Edit</button><button className="text-button timeline-delete" type="button" onClick={() => void remove(item)}>Delete</button></div>}</div>
                                    {(item.location || item.responsible_person) && <p className="timeline-meta">{[item.location, item.responsible_person].filter(Boolean).join(' · ')}</p>}
                                    {item.description && <p className="timeline-description">{item.description}</p>}
                                </article>
                            </li>
                        ))}
                    </ol>
                )}
            </section>
            {itemPendingDelete && <ConfirmDialog
                title="Delete this schedule item?"
                description={<><strong>{itemPendingDelete.title}</strong> will be removed from the run of show.</>}
                confirmLabel="Delete schedule item"
                error={error}
                onConfirm={confirmRemove}
                onClose={() => setItemPendingDelete(null)}
            />}
        </div>
    );
}
