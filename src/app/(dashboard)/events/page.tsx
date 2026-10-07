'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import EventCard from '../../../components/events/EventCard';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import { createEvent, deleteEvent, getEvents, updateEvent } from '../../../actions/events';
import type { EventInput, EventRow } from '../../../types/database';
import { CalendarPlus, ChevronDown, Plus, RefreshCw } from 'lucide-react';

type EventFormValues = {
    title: string;
    description: string;
    date: string;
    location: string;
};

const emptyForm: EventFormValues = {
    title: '',
    description: '',
    date: '',
    location: '',
};

const EventsPage = () => {
    const [events, setEvents] = useState<EventRow[]>([]);
    const [form, setForm] = useState<EventFormValues>(emptyForm);
    const [editingEvent, setEditingEvent] = useState<EventRow | null>(null);
    const [eventPendingDelete, setEventPendingDelete] = useState<EventRow | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const loadEvents = useCallback(async () => {
        try {
            setError(null);
            setEvents(await getEvents());
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Unable to load events.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadEvents();
    }, [loadEvents]);

    const updateFormField = (field: keyof EventFormValues, value: string) => {
        setForm((currentForm) => ({ ...currentForm, [field]: value }));
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setSaving(true);
        setError(null);
        setNotice(null);

        const eventInput: EventInput = {
            title: form.title.trim(),
            description: form.description.trim() || null,
            date: form.date ? new Date(`${form.date}T12:00:00`).toISOString() : null,
            location: form.location.trim() || null,
        };

        try {
            if (editingEvent) {
                await updateEvent(editingEvent.id, eventInput);
                setNotice('Event updated.');
            } else {
                await createEvent(eventInput);
                setNotice('Event created.');
            }
            setForm(emptyForm);
            setEditingEvent(null);
            await loadEvents();
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : 'Unable to save this event.');
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (event: EventRow) => {
        setEditingEvent(event);
        setForm({
            title: event.title,
            description: event.description ?? '',
            date: event.date?.slice(0, 10) ?? '',
            location: event.location ?? '',
        });
        setNotice(null);
        setError(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = (event: EventRow) => {
        setEventPendingDelete(event);
    };

    const confirmDelete = async () => {
        if (!eventPendingDelete) return false;
        const event = eventPendingDelete;

        setDeletingEventId(event.id);
        setError(null);
        setNotice(null);

        try {
            await deleteEvent(event.id);
            if (editingEvent?.id === event.id) {
                setEditingEvent(null);
                setForm(emptyForm);
            }
            setNotice('Event deleted.');
            await loadEvents();
            return true;
        } catch (deleteError) {
            const message = deleteError instanceof Error ? deleteError.message : 'Unable to delete this event.';
            setError(message);
            return false;
        } finally {
            setDeletingEventId(null);
        }
    };

    const cancelEdit = () => {
        setEditingEvent(null);
        setForm(emptyForm);
        setError(null);
        setNotice(null);
    };

    return (
        <section className="events-page">
            <header className="page-heading">
                <div>
                    <p className="eyebrow">YOUR WORKSPACE</p>
                    <h1>Upcoming events</h1>
                    <p className="page-subtitle">Plan the details and keep everyone on the same page.</p>
                </div>
                <span className="event-count"><CalendarPlus size={15} />{events.length} {events.length === 1 ? 'event' : 'events'}</span>
            </header>

            <details className="event-form-card event-form-disclosure" open={editingEvent ? true : undefined}>
                <summary>
                    <span className="event-form-summary-icon"><Plus size={17} /></span>
                    <span className="event-form-summary-copy">
                        <strong id="event-form-title">{editingEvent ? 'Edit event' : 'Create an event'}</strong>
                        <small>{editingEvent ? 'Update the event details below.' : 'Add a new event to your workspace.'}</small>
                    </span>
                    <ChevronDown className="event-form-summary-chevron" size={18} />
                </summary>
                <form className="event-form" onSubmit={handleSubmit}>
                    <label className="event-field event-field-wide">
                        <span>Event name</span>
                        <input
                            type="text"
                            value={form.title}
                            onChange={(event) => updateFormField('title', event.target.value)}
                            placeholder="e.g. Product launch"
                            maxLength={160}
                            required
                        />
                    </label>
                    <label className="event-field">
                        <span>Date</span>
                        <input
                            type="date"
                            value={form.date}
                            onChange={(event) => updateFormField('date', event.target.value)}
                        />
                    </label>
                    <label className="event-field">
                        <span>Location</span>
                        <input
                            type="text"
                            value={form.location}
                            onChange={(event) => updateFormField('location', event.target.value)}
                            placeholder="Add a location"
                            maxLength={200}
                        />
                    </label>
                    <label className="event-field event-field-wide">
                        <span>Description</span>
                        <textarea
                            value={form.description}
                            onChange={(event) => updateFormField('description', event.target.value)}
                            placeholder="What should attendees know?"
                            rows={3}
                        />
                    </label>
                    {error && <p className="form-message form-message-error" role="alert">{error}</p>}
                    {notice && <p className="form-message form-message-success" role="status">{notice}</p>}
                    <div className="event-form-actions event-field-wide">
                        <button className="primary-button" type="submit" disabled={saving}>
                            {saving ? 'Saving…' : editingEvent ? 'Save changes' : 'Create event'}
                        </button>
                        {editingEvent && (
                            <button className="secondary-button" type="button" onClick={cancelEdit} disabled={saving}>
                                Cancel
                            </button>
                        )}
                    </div>
                </form>
            </details>

            <div className="events-section-heading">
                <div>
                    <h2>All events</h2>
                    <p>Browse and manage your planned events.</p>
                </div>
                <button className="text-button event-refresh" type="button" onClick={() => void loadEvents()} disabled={loading}>
                    <RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh
                </button>
            </div>

            {loading ? (
                <div className="event-grid" aria-label="Loading events">
                    {[0, 1, 2].map((item) => <div className="event-card event-skeleton" key={item}><span /><span /><span /></div>)}
                </div>
            ) : error && events.length === 0 ? (
                <p className="form-message form-message-error" role="alert">{error}</p>
            ) : events.length === 0 ? (
                <div className="empty-state">
                    <h3>No events yet</h3>
                    <p>Create your first event above to get started.</p>
                </div>
            ) : (
                <>
                    {error && <p className="form-message form-message-error" role="alert">{error}</p>}
                    <div className="event-grid">
                        {events.map((event) => (
                            <EventCard
                                key={event.id}
                                event={event}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                                isDeleting={deletingEventId === event.id}
                            />
                        ))}
                    </div>
                </>
            )}
            {eventPendingDelete && <ConfirmDialog
                title="Delete this event?"
                description={<><strong>{eventPendingDelete.title}</strong> will be permanently deleted. This action cannot be undone.</>}
                confirmLabel="Delete event"
                error={error}
                onConfirm={confirmDelete}
                onClose={() => setEventPendingDelete(null)}
            />}
        </section>
    );
};

export default EventsPage;
