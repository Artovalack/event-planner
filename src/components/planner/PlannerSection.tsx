'use client';

import { useMemo, useState, useTransition } from 'react';
import {
    deleteBudgetItem,
    deleteGuest,
    deleteTask,
    deleteVendor,
    saveBudgetItem,
    saveGuest,
    saveTask,
    saveVendor,
    setSubtaskStatus,
    setTaskStatus,
} from '@/actions/planner';
import PrintButton from '@/components/planner/PrintButton';
import type { BudgetItemRow, EventRow, GuestRow, TaskRow, VendorRow } from '@/types/database';

type Kind = 'tasks' | 'guests' | 'budget' | 'vendors';

type Props = {
    kind: Kind;
    event: EventRow;
    tasks?: TaskRow[];
    guests?: GuestRow[];
    budgetItems?: BudgetItemRow[];
    vendors?: VendorRow[];
};

const money = (amount: number) => new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
}).format(Number(amount) || 0);

export default function PlannerSection(props: Props) {
    if (props.kind === 'tasks') return <TasksSection event={props.event} tasks={props.tasks ?? []} />;
    if (props.kind === 'guests') return <GuestsSection event={props.event} guests={props.guests ?? []} />;
    if (props.kind === 'budget') return <BudgetSection event={props.event} items={props.budgetItems ?? []} />;
    return <VendorsSection event={props.event} vendors={props.vendors ?? []} />;
}

function TasksSection({ event, tasks }: { event: EventRow; tasks: TaskRow[] }) {
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('all');
    const [category, setCategory] = useState('all');
    const [sort, setSort] = useState('due');
    const [editing, setEditing] = useState<TaskRow | null>(null);
    const [subtaskDraft, setSubtaskDraft] = useState<{ title: string; is_completed: boolean }[]>([]);
    const [formOpen, setFormOpen] = useState(false);
    const [error, setError] = useState('');
    const [busy, startTransition] = useTransition();
    const categories = [...new Set(tasks.map((task) => task.category))].sort();
    const filteredTasks = useMemo(() => tasks
        .filter((task) => task.title.toLowerCase().includes(search.toLowerCase()))
        .filter((task) => status === 'all' || task.status === status)
        .filter((task) => category === 'all' || task.category === category)
        .sort((a, b) => {
            const left = a.due_date ?? '9999-12-31';
            const right = b.due_date ?? '9999-12-31';
            return sort === 'due-desc' ? right.localeCompare(left) : left.localeCompare(right);
        }), [tasks, search, status, category, sort]);

    const submit = (formData: FormData) => {
        setError('');
        const input = {
            title: String(formData.get('title') ?? '').trim(),
            category: String(formData.get('category') ?? 'General').trim() || 'General',
            due_date: String(formData.get('due_date') ?? '') || null,
            notes: String(formData.get('notes') ?? '').trim() || null,
            subtasks: formData.getAll('subtask_title').map((title, index) => ({
                title: String(title),
                is_completed: formData.getAll('subtask_completed')[index] === 'true',
            })),
        };
        startTransition(async () => {
            try {
                await saveTask(event.id, input, editing?.id);
                setEditing(null);
                setFormOpen(false);
            } catch (caughtError) {
                setError(caughtError instanceof Error ? caughtError.message : 'Unable to save task.');
            }
        });
    };

    const openEdit = (task: TaskRow) => {
        setEditing(task);
        setSubtaskDraft(task.subtasks?.map(({ title, is_completed }) => ({ title, is_completed })) ?? []);
        setFormOpen(true);
        setError('');
    };

    return (
        <section className="planner-page">
            <header className="page-heading">
                <div><p className="eyebrow">{event.title}</p><h1>Tasks</h1><p className="page-subtitle">Keep every planning detail and deadline on track.</p></div>
                <div className="planner-header-actions"><PrintButton /><button className="primary-button" type="button" onClick={() => { setEditing(null); setSubtaskDraft([]); setFormOpen(true); setError(''); }}>+ Add task</button></div>
            </header>
            <div className="planner-toolbar">
                <input aria-label="Search tasks" placeholder="Search tasks…" value={search} onChange={(e) => setSearch(e.target.value)} />
                <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="all">All statuses</option><option value="pending">Pending</option><option value="completed">Completed</option>
                </select>
                <select aria-label="Filter by category" value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="all">All categories</option>{categories.map((value) => <option key={value}>{value}</option>)}
                </select>
                <select aria-label="Sort tasks" value={sort} onChange={(e) => setSort(e.target.value)}>
                    <option value="due">Due date: earliest</option><option value="due-desc">Due date: latest</option>
                </select>
            </div>
            {formOpen && <form className="planner-form-card" action={submit}>
                <div className="planner-form-heading"><h2>{editing ? 'Edit task' : 'New task'}</h2><button type="button" className="text-button" onClick={() => { setFormOpen(false); setEditing(null); }}>Close</button></div>
                <div className="planner-form-grid">
                    <label>Task title<input name="title" required maxLength={160} defaultValue={editing?.title ?? ''} /></label>
                    <label>Category<input name="category" maxLength={80} defaultValue={editing?.category ?? ''} placeholder="e.g. Photographer" /></label>
                    <label>Due date<input type="date" name="due_date" defaultValue={editing?.due_date ?? ''} /></label>
                    <label className="planner-form-wide">Notes<textarea name="notes" rows={2} defaultValue={editing?.notes ?? ''} /></label>
                    <div className="planner-form-wide planner-subtasks-field"><span>Subtasks</span>{subtaskDraft.map((subtask, index) => <div className="subtask-input-row" key={`${editing?.id ?? 'new'}-${index}`}><input aria-label={`Subtask ${index + 1}`} name="subtask_title" value={subtask.title} onChange={(change) => setSubtaskDraft((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, title: change.target.value } : item))} /><input type="hidden" name="subtask_completed" value={String(subtask.is_completed)} /><button className="text-button" type="button" aria-label={`Remove subtask ${index + 1}`} onClick={() => setSubtaskDraft((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></div>)}<button className="text-button add-subtask-button" type="button" onClick={() => setSubtaskDraft((current) => [...current, { title: '', is_completed: false }])}>+ Add subtask</button></div>
                </div>
                {error && <p role="alert" className="form-message form-message-error">{error}</p>}
                <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Create task'}</button>
            </form>}
            <div className="planner-card-list">
                {filteredTasks.map((task) => {
                    const subtasks = task.subtasks ?? [];
                    const completedCount = subtasks.filter((item) => item.is_completed).length;
                    return <article className="planner-card task-card" key={task.id}>
                        <div className="planner-card-main">
                            <span className="category-badge"><span aria-hidden="true">◈</span>{task.category || 'General'}</span>
                            <h2>{task.title}</h2>
                            {task.notes && <p>{task.notes}</p>}
                            <div className="planner-meta"><span>Due {task.due_date ? new Date(`${task.due_date}T12:00:00`).toLocaleDateString() : 'No date set'}</span><span>Subtasks: {completedCount}/{subtasks.length}</span></div>
                            {!!subtasks.length && <ul className="subtask-list">{subtasks.map((item) => <li key={item.id}><label><input type="checkbox" checked={item.is_completed} disabled={busy} onChange={(change) => {
                                const isCompleted = change.currentTarget.checked;
                                startTransition(async () => {
                                try { await setSubtaskStatus(event.id, task.id, item.id, isCompleted); }
                                catch (caughtError) { setError(caughtError instanceof Error ? caughtError.message : 'Unable to update subtask.'); }
                            });
                            }} />{item.title}</label></li>)}</ul>}
                        </div>
                        <div className="planner-card-actions">
                            <button type="button" className={`status-pill ${task.status}`} disabled={busy} onClick={() => startTransition(async () => {
                                try { await setTaskStatus(event.id, task.id, task.status === 'completed' ? 'pending' : 'completed'); }
                                catch (caughtError) { setError(caughtError instanceof Error ? caughtError.message : 'Unable to update task.'); }
                            })}>{task.status === 'completed' ? 'Completed' : 'Mark complete'}</button>
                            <button type="button" className="text-button" onClick={() => openEdit(task)}>Edit</button>
                            <button type="button" className="danger-button" disabled={busy} onClick={() => startTransition(async () => {
                                try { await deleteTask(event.id, task.id); }
                                catch (caughtError) { setError(caughtError instanceof Error ? caughtError.message : 'Unable to delete task.'); }
                            })}>Delete</button>
                        </div>
                    </article>;
                })}
                {!filteredTasks.length && <p className="empty-state">{tasks.length ? 'No tasks match these filters.' : 'No tasks yet. Add a task to start planning.'}</p>}
            </div>
            {error && !formOpen && <p role="alert" className="form-message form-message-error">{error}</p>}
        </section>
    );
}

function GuestsSection({ event, guests }: { event: EventRow; guests: GuestRow[] }) {
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all');
    const [editing, setEditing] = useState<GuestRow | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [error, setError] = useState('');
    const [busy, startTransition] = useTransition();
    const visible = guests.filter((guest) => `${guest.name} ${guest.email ?? ''}`.toLowerCase().includes(search.toLowerCase()))
        .filter((guest) => filter === 'all' || guest.invitation_status === filter);
    const companions = guests.reduce((sum, guest) => ({
        adults: sum.adults + guest.companion_adults,
        children: sum.children + guest.companion_children,
        babies: sum.babies + guest.companion_babies,
    }), { adults: 0, children: 0, babies: 0 });

    const submit = (formData: FormData) => {
        setError('');
        const input = {
            name: String(formData.get('name') ?? '').trim(),
            email: String(formData.get('email') ?? '').trim() || null,
            invitation_status: String(formData.get('invitation_status') ?? 'not_sent') as GuestRow['invitation_status'],
            companion_adults: Number(formData.get('companion_adults') ?? 0),
            companion_children: Number(formData.get('companion_children') ?? 0),
            companion_babies: Number(formData.get('companion_babies') ?? 0),
        };
        startTransition(async () => {
            try {
                await saveGuest(event.id, input, editing?.id);
                setEditing(null);
                setFormOpen(false);
            } catch (caughtError) { setError(caughtError instanceof Error ? caughtError.message : 'Unable to save guest.'); }
        });
    };

    return <section className="planner-page">
        <header className="page-heading"><div><p className="eyebrow">{event.title}</p><h1>Guests</h1><p className="page-subtitle">Manage invitations and keep track of everyone attending.</p></div><div className="planner-header-actions"><PrintButton /><button className="primary-button" type="button" onClick={() => { setEditing(null); setFormOpen(true); setError(''); }}>+ Add guest</button></div></header>
        <div className="metric-grid metric-grid-compact">
            <Metric label="Guests" value={guests.length} detail="In this event" />
            <Metric label="Adults" value={companions.adults} detail="Companions" />
            <Metric label="Children" value={companions.children} detail="Companions" />
            <Metric label="Babies" value={companions.babies} detail="Companions" />
        </div>
        <div className="planner-toolbar"><input aria-label="Search guests" placeholder="Search guests…" value={search} onChange={(e) => setSearch(e.target.value)} /><select aria-label="Filter invitations" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">All invitation statuses</option><option value="sent">Invitation sent</option><option value="not_sent">Not sent</option></select></div>
        {formOpen && <form className="planner-form-card" action={submit}><div className="planner-form-heading"><h2>{editing ? 'Edit guest' : 'Add guest'}</h2><button type="button" className="text-button" onClick={() => { setFormOpen(false); setEditing(null); }}>Close</button></div>
            <div className="planner-form-grid">
                <label>Name<input name="name" required maxLength={160} defaultValue={editing?.name ?? ''} /></label>
                <label>Email<input type="email" name="email" defaultValue={editing?.email ?? ''} /></label>
                <label>Invitation status<select name="invitation_status" defaultValue={editing?.invitation_status ?? 'not_sent'}><option value="not_sent">Not sent</option><option value="sent">Sent</option></select></label>
                <label>Companion adults<input type="number" name="companion_adults" min="0" step="1" defaultValue={editing?.companion_adults ?? 0} /></label>
                <label>Companion children<input type="number" name="companion_children" min="0" step="1" defaultValue={editing?.companion_children ?? 0} /></label>
                <label>Companion babies<input type="number" name="companion_babies" min="0" step="1" defaultValue={editing?.companion_babies ?? 0} /></label>
            </div>
            {error && <p role="alert" className="form-message form-message-error">{error}</p>}<button className="primary-button" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add guest'}</button>
        </form>}
        <div className="planner-card-list">{visible.map((guest) => <article className="planner-card guest-card" key={guest.id}>
            <div className="planner-card-main"><div className="planner-card-title"><h2>{guest.name}</h2><span className={`status-pill ${guest.invitation_status === 'sent' ? 'completed' : 'pending'}`}>Invitation {guest.invitation_status === 'sent' ? 'Sent' : 'Not Sent'}</span></div><p>{guest.email || 'No email provided'}</p><div className="companion-breakdown"><span>Adults <b>{guest.companion_adults}</b></span><span>Children <b>{guest.companion_children}</b></span><span>Babies <b>{guest.companion_babies}</b></span><strong>Total companions: {guest.total_companions}</strong></div></div>
            <div className="planner-card-actions"><button type="button" className="text-button" onClick={() => { setEditing(guest); setFormOpen(true); setError(''); }}>Edit</button><button type="button" className="danger-button" disabled={busy} onClick={() => startTransition(async () => { try { await deleteGuest(event.id, guest.id); } catch (caughtError) { setError(caughtError instanceof Error ? caughtError.message : 'Unable to delete guest.'); } })}>Delete</button></div>
        </article>)}{!visible.length && <p className="empty-state">{guests.length ? 'No guests match this search.' : 'No guests have been added yet.'}</p>}</div>
        {error && !formOpen && <p role="alert" className="form-message form-message-error">{error}</p>}
    </section>;
}

function BudgetSection({ event, items }: { event: EventRow; items: BudgetItemRow[] }) {
    const [editing, setEditing] = useState<BudgetItemRow | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [error, setError] = useState('');
    const [busy, startTransition] = useTransition();
    const estimated = items.reduce((sum, item) => sum + Number(item.estimated_cost), 0);
    const spent = items.reduce((sum, item) => sum + Number(item.actual_cost), 0);
    const pending = items.filter((item) => item.payment_status === 'pending').length;
    const submit = (formData: FormData) => {
        setError('');
        const input = {
            item_name: String(formData.get('item_name') ?? '').trim(),
            category: String(formData.get('category') ?? 'General').trim() || 'General',
            estimated_cost: Number(formData.get('estimated_cost') ?? 0),
            actual_cost: Number(formData.get('actual_cost') ?? 0),
            payment_status: String(formData.get('payment_status') ?? 'pending') as BudgetItemRow['payment_status'],
        };
        startTransition(async () => {
            try { await saveBudgetItem(event.id, input, editing?.id); setEditing(null); setFormOpen(false); }
            catch (caughtError) { setError(caughtError instanceof Error ? caughtError.message : 'Unable to save budget item.'); }
        });
    };
    return <section className="planner-page">
        <header className="page-heading"><div><p className="eyebrow">{event.title}</p><h1>Budget</h1><p className="page-subtitle">Monitor estimates, actual costs, and outstanding payments.</p></div><div className="planner-header-actions"><PrintButton /><button className="primary-button" type="button" onClick={() => { setEditing(null); setFormOpen(true); setError(''); }}>+ Add item</button></div></header>
        <div className="metric-grid">
            <Metric label="Estimated budget" value={money(estimated)} detail={`${items.length} budget items`} />
            <Metric label="Total spent" value={money(spent)} detail={`${items.length - pending} completed payments`} />
            <Metric label="Remaining" value={money(estimated - spent)} detail="Estimate minus actual cost" />
            <Metric label="Pending payments" value={pending} detail={`${items.length} total items`} />
        </div>
        {formOpen && <form className="planner-form-card" action={submit}><div className="planner-form-heading"><h2>{editing ? 'Edit budget item' : 'Add budget item'}</h2><button type="button" className="text-button" onClick={() => { setFormOpen(false); setEditing(null); }}>Close</button></div>
            <div className="planner-form-grid"><label>Item name<input name="item_name" required maxLength={160} defaultValue={editing?.item_name ?? ''} /></label><label>Category<input name="category" defaultValue={editing?.category ?? ''} placeholder="e.g. Venue" /></label><label>Estimated cost<input type="number" name="estimated_cost" min="0" step="0.01" defaultValue={editing?.estimated_cost ?? 0} /></label><label>Actual cost<input type="number" name="actual_cost" min="0" step="0.01" defaultValue={editing?.actual_cost ?? 0} /></label><label>Payment status<select name="payment_status" defaultValue={editing?.payment_status ?? 'pending'}><option value="pending">Pending</option><option value="completed">Completed</option></select></label></div>
            {error && <p role="alert" className="form-message form-message-error">{error}</p>}<button className="primary-button" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add item'}</button>
        </form>}
        <div className="planner-card-list">{items.map((item) => <article className="planner-card budget-card" key={item.id}><div className="planner-card-main"><div className="planner-card-title"><h2>{item.item_name}</h2><span className={`status-pill ${item.payment_status}`}>{item.payment_status}</span></div><p className="category-label">{item.category}</p><div className="budget-amounts"><span>Estimated <b>{money(item.estimated_cost)}</b></span><span>Actual <b>{money(item.actual_cost)}</b></span></div></div><div className="planner-card-actions"><button type="button" className="text-button" onClick={() => { setEditing(item); setFormOpen(true); setError(''); }}>Edit</button><button type="button" className="danger-button" disabled={busy} onClick={() => startTransition(async () => { try { await deleteBudgetItem(event.id, item.id); } catch (caughtError) { setError(caughtError instanceof Error ? caughtError.message : 'Unable to delete budget item.'); } })}>Delete</button></div></article>)}{!items.length && <p className="empty-state">No budget items yet. Add your first estimate.</p>}</div>
        {error && !formOpen && <p role="alert" className="form-message form-message-error">{error}</p>}
    </section>;
}

function VendorsSection({ event, vendors }: { event: EventRow; vendors: VendorRow[] }) {
    const [search, setSearch] = useState('');
    const [editing, setEditing] = useState<VendorRow | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [error, setError] = useState('');
    const [busy, startTransition] = useTransition();
    const visible = vendors.filter((vendor) => `${vendor.vendor_name} ${vendor.category} ${vendor.contact_person ?? ''}`.toLowerCase().includes(search.toLowerCase()));
    const submit = (formData: FormData) => {
        setError('');
        const input = {
            vendor_name: String(formData.get('vendor_name') ?? '').trim(),
            category: String(formData.get('category') ?? 'General').trim() || 'General',
            contact_person: String(formData.get('contact_person') ?? '').trim() || null,
            phone: String(formData.get('phone') ?? '').trim() || null,
            email: String(formData.get('email') ?? '').trim() || null,
            notes: String(formData.get('notes') ?? '').trim() || null,
        };
        startTransition(async () => {
            try { await saveVendor(event.id, input, editing?.id); setEditing(null); setFormOpen(false); }
            catch (caughtError) { setError(caughtError instanceof Error ? caughtError.message : 'Unable to save vendor.'); }
        });
    };
    return <section className="planner-page">
        <header className="page-heading"><div><p className="eyebrow">{event.title}</p><h1>Vendors</h1><p className="page-subtitle">Keep supplier contacts and services in one place.</p></div><button className="primary-button" type="button" onClick={() => { setEditing(null); setFormOpen(true); setError(''); }}>+ Add vendor</button></header>
        <div className="planner-toolbar"><input aria-label="Search vendors" placeholder="Search vendors or services…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        {formOpen && <form className="planner-form-card" action={submit}><div className="planner-form-heading"><h2>{editing ? 'Edit vendor' : 'Add vendor'}</h2><button type="button" className="text-button" onClick={() => { setFormOpen(false); setEditing(null); }}>Close</button></div>
            <div className="planner-form-grid"><label>Vendor name<input name="vendor_name" required maxLength={160} defaultValue={editing?.vendor_name ?? ''} /></label><label>Service / category<input name="category" defaultValue={editing?.category ?? ''} placeholder="e.g. Catering" /></label><label>Contact person<input name="contact_person" defaultValue={editing?.contact_person ?? ''} /></label><label>Phone<input type="tel" name="phone" defaultValue={editing?.phone ?? ''} /></label><label>Email<input type="email" name="email" defaultValue={editing?.email ?? ''} /></label><label className="planner-form-wide">Notes<textarea name="notes" rows={2} defaultValue={editing?.notes ?? ''} /></label></div>
            {error && <p role="alert" className="form-message form-message-error">{error}</p>}<button className="primary-button" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add vendor'}</button>
        </form>}
        <div className="planner-card-list">{visible.map((vendor) => <article className="planner-card" key={vendor.id}><div className="planner-card-main"><span className="category-badge">{vendor.category}</span><h2>{vendor.vendor_name}</h2><div className="vendor-details"><span>{vendor.contact_person || 'No contact person'}</span>{vendor.phone && <a href={`tel:${vendor.phone}`}>{vendor.phone}</a>}{vendor.email && <a href={`mailto:${vendor.email}`}>{vendor.email}</a>}</div>{vendor.notes && <p>{vendor.notes}</p>}</div><div className="planner-card-actions"><button type="button" className="text-button" onClick={() => { setEditing(vendor); setFormOpen(true); setError(''); }}>Edit</button><button type="button" className="danger-button" disabled={busy} onClick={() => startTransition(async () => { try { await deleteVendor(event.id, vendor.id); } catch (caughtError) { setError(caughtError instanceof Error ? caughtError.message : 'Unable to delete vendor.'); } })}>Delete</button></div></article>)}{!visible.length && <p className="empty-state">{vendors.length ? 'No vendors match your search.' : 'No vendors added yet.'}</p>}</div>
        {error && !formOpen && <p role="alert" className="form-message form-message-error">{error}</p>}
    </section>;
}

function Metric({ label, value, detail }: { label: string; value: string | number; detail: string }) {
    return <article className="metric-card"><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}
