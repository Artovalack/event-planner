import Link from 'next/link';
import type { EventRow } from '../../types/database';

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
                <span className="event-card-label">EVENT</span>
                <Link href={`/events/${event.id}`} className="event-title-link">
                    {event.title}
                </Link>
            </div>
            {event.description && <p className="event-card-description">{event.description}</p>}
            <div className="event-card-meta">
                <p><span>Date</span>{event.date ? new Date(event.date).toLocaleDateString() : 'Not set'}</p>
                <p><span>Location</span>{event.location || 'Not set'}</p>
            </div>
            <div className="event-card-actions">
                <Link href={`/events/${event.id}`} className="text-button">View details</Link>
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
