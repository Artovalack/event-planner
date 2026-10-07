'use client';

import { useMemo, useState, useTransition, type DragEvent, type FormEvent } from 'react';
import { assignGuestToTable, deleteSeatingTable, saveSeatingTable } from '@/actions/seating';
import type { GuestRow, SeatingAssignmentRow, SeatingTableRow } from '@/types/database';

type TableForm = { name: string; capacity: string; shape: 'round' | 'rectangle' };
const emptyForm: TableForm = { name: '', capacity: '8', shape: 'round' };

function guestSeatCount(guest: GuestRow) {
    if (guest.rsvp_status === 'declined') return 0;
    if (guest.rsvp_status !== 'confirmed') return 1;
    return 1 + (guest.rsvp_companion_adults ?? 0) + (guest.rsvp_companion_children ?? 0) + (guest.rsvp_companion_babies ?? 0);
}

function rsvpLabel(guest: GuestRow) {
    return guest.rsvp_status === 'confirmed' ? 'Confirmed' : guest.rsvp_status === 'declined' ? 'Declined' : 'Awaiting RSVP';
}

function SeatingGuestCard({
    guest,
    tables,
    tableId,
    busy,
    canEdit,
    dragging,
    onAssign,
    onDragStart,
    onDragEnd,
}: {
    guest: GuestRow;
    tables: SeatingTableRow[];
    tableId: string;
    busy: boolean;
    canEdit: boolean;
    dragging: boolean;
    onAssign: (_guestId: string, _tableId: string | null) => void;
    onDragStart: (_guestId: string, _event: DragEvent<HTMLElement>) => void;
    onDragEnd: () => void;
}) {
    const seats = guestSeatCount(guest);
    return (
        <article
            className={`seating-guest-chip ${dragging ? 'seating-guest-dragging' : ''}`}
            draggable={canEdit && !busy}
            onDragStart={(event) => onDragStart(guest.id, event)}
            onDragEnd={onDragEnd}
        >
            <div className="seating-guest-details">
                <strong>{guest.name}{guest.guest_tag && guest.guest_tag !== 'guest' && <span className={`guest-tag guest-tag-${guest.guest_tag}`}>{guest.guest_tag === 'vip' ? 'VIP' : guest.guest_tag[0].toUpperCase() + guest.guest_tag.slice(1)}</span>}</strong>
                <span>{rsvpLabel(guest)} · {seats} {seats === 1 ? 'seat' : 'seats'}</span>
                {guest.meal_preference && <span>Meal: {guest.meal_preference}</span>}
                {guest.allergies && <span className="seating-allergy">Dietary: {guest.allergies}</span>}
            </div>
            <label className="seating-assign-select">
                <span className="sr-only">Assign {guest.name} to a table</span>
                <select
                    aria-label={`Assign ${guest.name} to a table`}
                    value={tableId}
                    disabled={busy || !canEdit}
                    onChange={(event) => onAssign(guest.id, event.target.value || null)}
                >
                    <option value="">Unassigned</option>
                    {tables.map((table) => <option value={table.id} key={table.id}>{table.name}</option>)}
                </select>
            </label>
        </article>
    );
}

export default function SeatingPlanner({
    eventId,
    tables,
    guests,
    assignments,
    canEdit = true,
}: {
    eventId: string;
    tables: SeatingTableRow[];
    guests: GuestRow[];
    assignments: SeatingAssignmentRow[];
    canEdit?: boolean;
}) {
    const [form, setForm] = useState<TableForm>(emptyForm);
    const [editingTable, setEditingTable] = useState<SeatingTableRow | null>(null);
    const [search, setSearch] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [busy, startTransition] = useTransition();
    const [draggingGuestId, setDraggingGuestId] = useState<string | null>(null);
    const assignedTableByGuest = useMemo(
        () => new Map(assignments.map((assignment) => [assignment.guest_id, assignment.seating_table_id])),
        [assignments],
    );
    const guestById = useMemo(() => new Map(guests.map((guest) => [guest.id, guest])), [guests]);
    const searchableGuests = guests.filter((guest) => guest.rsvp_status !== 'declined')
        .filter((guest) => `${guest.name} ${guest.email ?? ''}`.toLowerCase().includes(search.toLowerCase()));
    const assignedGuests = searchableGuests.filter((guest) => assignedTableByGuest.has(guest.id));
    const unassignedGuests = searchableGuests.filter((guest) => !assignedTableByGuest.has(guest.id));
    const declinedGuests = guests.filter((guest) => guest.rsvp_status === 'declined')
        .filter((guest) => `${guest.name} ${guest.email ?? ''}`.toLowerCase().includes(search.toLowerCase()));

    const clearMessages = () => {
        setError(null);
        setNotice(null);
    };

    const dropOnTable = (event: DragEvent<HTMLElement>, tableId: string) => {
        event.preventDefault();
        const guestId = event.dataTransfer.getData('text/plain') || draggingGuestId;
        setDraggingGuestId(null);
        if (!guestId) return;
        void moveGuest(guestId, tableId || null);
    };

    const startDragging = (guestId: string, event: DragEvent<HTMLElement>) => {
        event.dataTransfer.setData('text/plain', guestId);
        event.dataTransfer.effectAllowed = 'move';
        setDraggingGuestId(guestId);
    };

    const moveGuest = async (guestId: string, tableId: string | null) => {
        clearMessages();
        const guest = guestById.get(guestId);
        if (!guest || guest.rsvp_status === 'declined') {
            setError('This guest cannot be assigned to a table.');
            return;
        }
        try {
            await assignGuestToTable(eventId, guestId, tableId);
            setNotice(`${guest.name} ${tableId ? 'assigned to the selected table' : 'moved to the unassigned list'}.`);
        } catch (caughtError) {
            setError(caughtError instanceof Error ? caughtError.message : 'Unable to update the seating assignment.');
        }
    };

    const submitTable = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        clearMessages();
        const capacity = Number(form.capacity);
        startTransition(async () => {
            try {
                await saveSeatingTable(eventId, {
                    name: form.name,
                    capacity,
                    shape: form.shape,
                    sort_order: editingTable?.sort_order ?? tables.length,
                }, editingTable?.id);
                setNotice(editingTable ? 'Table updated.' : 'Table added.');
                setEditingTable(null);
                setForm(emptyForm);
            } catch (caughtError) {
                setError(caughtError instanceof Error ? caughtError.message : 'Unable to save table.');
            }
        });
    };

    const editTable = (table: SeatingTableRow) => {
        setEditingTable(table);
        setForm({ name: table.name, capacity: String(table.capacity), shape: table.shape });
        clearMessages();
    };

    const removeTable = (table: SeatingTableRow) => {
        if (!window.confirm(`Delete ${table.name}? Its guest assignments will become unassigned.`)) return;
        clearMessages();
        startTransition(async () => {
            try {
                await deleteSeatingTable(eventId, table.id);
                if (editingTable?.id === table.id) {
                    setEditingTable(null);
                    setForm(emptyForm);
                }
                setNotice(`${table.name} deleted.`);
            } catch (caughtError) {
                setError(caughtError instanceof Error ? caughtError.message : 'Unable to delete table.');
            }
        });
    };

    const tableSeats = (tableId: string) => assignments.reduce((total, assignment) => {
        if (assignment.seating_table_id !== tableId) return total;
        const guest = guestById.get(assignment.guest_id);
        return total + (guest ? guestSeatCount(guest) : 0);
    }, 0);

    return (
        <div className="seating-planner">
            {canEdit && <section className="planner-form-card seating-table-form-card">
                <div className="planner-form-heading"><h2>{editingTable ? `Edit ${editingTable.name}` : 'Add a table'}</h2></div>
                <form className="seating-table-form" onSubmit={submitTable}>
                    <label>Table name<input required maxLength={80} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Table 1" /></label>
                    <label>Seat capacity<input required type="number" min="1" max="500" step="1" value={form.capacity} onChange={(event) => setForm({ ...form, capacity: event.target.value })} /></label>
                    <label>Shape<select value={form.shape} onChange={(event) => setForm({ ...form, shape: event.target.value as TableForm['shape'] })}><option value="round">Round</option><option value="rectangle">Rectangle</option></select></label>
                    <div className="event-form-actions">
                        <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Saving…' : editingTable ? 'Save table' : 'Add table'}</button>
                        {editingTable && <button className="secondary-button" type="button" onClick={() => { setEditingTable(null); setForm(emptyForm); }}>Cancel</button>}
                    </div>
                </form>
            </section>}

            {error && <p className="form-message form-message-error" role="alert">{error}</p>}
            {notice && <p className="form-message form-message-success" role="status">{notice}</p>}

            <div className="planner-toolbar seating-toolbar">
                <input aria-label="Search seating guests" placeholder="Search guests…" value={search} onChange={(event) => setSearch(event.target.value)} />
                <span>{assignedGuests.length} assigned · {unassignedGuests.length} unassigned · {declinedGuests.length} declined</span>
            </div>

            <div className="seating-board">
                <section
                    className={`seating-unassigned ${canEdit && draggingGuestId ? 'seating-drop-active' : ''}`}
                    onDragOver={(event) => { if (canEdit) event.preventDefault(); }}
                    onDrop={(event) => { if (canEdit) dropOnTable(event, ''); }}
                    aria-label="Unassigned guests drop zone"
                >
                    <header className="seating-section-heading"><div><p className="eyebrow">DRAG GUESTS FROM HERE</p><h2>Unassigned</h2></div><span>{unassignedGuests.length}</span></header>
                    <p className="seating-instructions">Drag a guest onto a table, or choose a table from the guest card.</p>
                    <div className="seating-guest-list">
                        {!unassignedGuests.length && <p className="seating-empty">{searchableGuests.length ? 'All matching guests are assigned.' : 'No eligible guests match this search.'}</p>}
                        {unassignedGuests.map((guest) => <SeatingGuestCard
                            guest={guest}
                            tables={tables}
                            tableId=""
                            busy={busy}
                            canEdit={canEdit}
                            dragging={draggingGuestId === guest.id}
                            onAssign={moveGuest}
                            onDragStart={startDragging}
                            onDragEnd={() => setDraggingGuestId(null)}
                            key={guest.id}
                        />)}
                    </div>
                    {declinedGuests.length > 0 && <details className="seating-declined"><summary>Declined ({declinedGuests.length})</summary><p>Guests who declined are not assignable.</p>{declinedGuests.map((guest) => <div className="seating-declined-name" key={guest.id}>{guest.name}</div>)}</details>}
                </section>

                <section className="seating-tables" aria-label="Seating tables">
                    {!tables.length && <div className="empty-state"><h3>No tables yet</h3><p>Add a table above to start assigning guests.</p></div>}
                    {tables.map((table) => {
                        const tableAssignments = assignments.filter((assignment) => assignment.seating_table_id === table.id);
                            const tableGuests = tableAssignments.map((assignment) => guestById.get(assignment.guest_id)).filter((guest): guest is GuestRow => Boolean(guest))
                            .filter((guest) => `${guest.name} ${guest.email ?? ''}`.toLowerCase().includes(search.toLowerCase()));
                        const occupied = tableSeats(table.id);
                        const overCapacity = occupied > table.capacity;
                        return (
                            <article
                                className={`seating-table-card seating-table-${table.shape} ${canEdit && draggingGuestId ? 'seating-drop-active' : ''}`}
                                key={table.id}
                                onDragOver={(event) => { if (canEdit) event.preventDefault(); }}
                                onDrop={(event) => { if (canEdit) dropOnTable(event, table.id); }}
                            >
                                <header className="seating-table-header">
                                    <div><span className="seating-table-icon" aria-hidden="true">◉</span><div><h2>{table.name}</h2><p>{occupied} / {table.capacity} seats{overCapacity ? ' · over capacity' : ''}</p></div></div>
                                    {canEdit && <div className="planner-card-actions"><button type="button" className="text-button" onClick={() => editTable(table)}>Edit</button><button type="button" className="danger-button" onClick={() => removeTable(table)}>Delete</button></div>}
                                </header>
                                <div className="seating-capacity-track" aria-label={`${occupied} of ${table.capacity} seats occupied`}><span className={overCapacity ? 'seating-capacity-over' : ''} style={{ width: `${Math.min(100, (occupied / table.capacity) * 100)}%` }} /></div>
                                <div className="seating-guest-list">
                                    {!tableGuests.length && <p className="seating-empty">{tableAssignments.length ? 'No matching guests at this table.' : 'Drop guests here to assign seats.'}</p>}
                                    {tableGuests.map((guest) => <SeatingGuestCard
                                        guest={guest}
                                        tables={tables}
                                        tableId={table.id}
                                        busy={busy}
                                        canEdit={canEdit}
                                        dragging={draggingGuestId === guest.id}
                                        onAssign={moveGuest}
                                        onDragStart={startDragging}
                                        onDragEnd={() => setDraggingGuestId(null)}
                                        key={guest.id}
                                    />)}
                                </div>
                            </article>
                        );
                    })}
                </section>
            </div>
        </div>
    );
}
