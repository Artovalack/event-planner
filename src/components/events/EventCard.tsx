import Link from 'next/link';
import type { EventRow } from '../../types/database';
import { ArrowUpRight, CalendarDays, MapPin } from 'lucide-react';

type EventCardProps = {
    event: EventRow;
    onEdit: (_event: EventRow) => void;
    onDelete: (_event: EventRow) => void;
    isDeleting: boolean;
};

export default function EventCard({ event, onEdit, onDelete, isDeleting }: EventCardProps) {
    return (
        <article className="event-card">
            <div className="event-card-topline">
                <span className="event-card-label"><span className="event-card-status-dot" />EVENT</span>
                <Link href={`/events/${event.id}`} className="event-title-link">
                    {event.title}
                </Link>
            </div>
            {event.description && <p className="event-card-description">{event.description}</p>}
            <div className="event-card-meta">
                <p><CalendarDays size={15} aria-hidden="true" /><span>{event.date ? new Date(event.date).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'Date not set'}</span></p>
                <p><MapPin size={15} aria-hidden="true" /><span>{event.location || 'Location not set'}</span></p>
            </div>
            <div className="event-card-actions">
                <Link href={`/events/${event.id}`} className="text-button">View details <ArrowUpRight size={14} /></Link>
                <button className="text-button" type="button" onClick={() => onEdit(event)}>Edit</button>
                <button
                    className="danger-button"
                    type="button"
                    onClick={() => onDelete(event)}
                    disabled={isDeleting}
                >
                    {isDeleting ? 'Deleting…' : 'Delete'}
                </button>
            </div>
        </article>
    );
}
