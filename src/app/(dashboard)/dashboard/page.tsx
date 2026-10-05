import { getActiveEvent } from '@/lib/planner';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import PrintButton from '@/components/planner/PrintButton';

function Metric({ label, value, detail }: { label: string; value: string | number; detail: string }) {
    return <article className="metric-card"><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

export default async function DashboardPage() {
    const activeEvent = await getActiveEvent();
    if (!activeEvent) return <section className="planner-page"><div className="empty-state"><h1>Your event dashboard</h1><p>Create an event to see your planning progress and summaries.</p><a className="primary-button" href="/events">Create an event</a></div></section>;

    const supabase = getSupabaseServerClient();
    const [tasksResult, guestsResult, budgetResult] = await Promise.all([
        supabase.from('tasks').select('id, status, subtasks(id, is_completed)').eq('event_id', activeEvent.id),
        supabase.from('guests').select('id, invitation_status').eq('event_id', activeEvent.id),
        supabase.from('budget_items').select('id, payment_status').eq('event_id', activeEvent.id),
    ]);
    if (tasksResult.error) throw new Error(`Unable to load task summary: ${tasksResult.error.message}`);
    if (guestsResult.error) throw new Error(`Unable to load guest summary: ${guestsResult.error.message}`);
    if (budgetResult.error) throw new Error(`Unable to load budget summary: ${budgetResult.error.message}`);

    const tasks = tasksResult.data ?? [];
    const guests = guestsResult.data ?? [];
    const items = budgetResult.data ?? [];
    const subtasks = tasks.flatMap((task) => task.subtasks ?? []);
    const completedTasks = tasks.filter((task) => task.status === 'completed').length;
    const sentInvitations = guests.filter((guest) => guest.invitation_status === 'sent').length;
    const completedPayments = items.filter((item) => item.payment_status === 'completed').length;
    const upcomingEvent = activeEvent.date && new Date(activeEvent.date).getTime() >= Date.now()
        ? activeEvent
        : null;
    const daysUntil = upcomingEvent?.date
        ? Math.max(0, Math.ceil((new Date(upcomingEvent.date).getTime() - Date.now()) / 86_400_000))
        : null;
    const completedSubtasks = subtasks.filter((item) => item.is_completed).length;

    return <section className="planner-page">
        <header className="page-heading"><div><p className="eyebrow">YOUR WORKSPACE</p><h1>Dashboard</h1><p className="page-subtitle">A quick look at {activeEvent.title}.</p></div><PrintButton /></header>
        <section className="countdown-card">
            <div><p className="eyebrow">UP NEXT</p><h2>{upcomingEvent?.title ?? 'No upcoming event'}</h2><p>{upcomingEvent?.date ? new Date(upcomingEvent.date).toLocaleDateString(undefined, { dateStyle: 'long' }) : 'Add a future event date to start the countdown.'}</p></div>
            {daysUntil !== null && <strong><span>{daysUntil}</span>{daysUntil === 1 ? 'day to go' : 'days to go'}</strong>}
        </section>
        <h2 className="dashboard-group-heading">Tasks & subtasks</h2>
        <div className="metric-grid">
            <Metric label="Tasks completed" value={completedTasks} detail={`${tasks.length - completedTasks} pending of ${tasks.length}`} />
            <Metric label="Subtasks completed" value={completedSubtasks} detail={`${subtasks.length - completedSubtasks} pending of ${subtasks.length}`} />
        </div>
        <h2 className="dashboard-group-heading">Guests & invitations</h2>
        <div className="metric-grid">
            <Metric label="Invitations sent" value={sentInvitations} detail={`${guests.length - sentInvitations} pending of ${guests.length}`} />
            <Metric label="Invitations pending" value={guests.length - sentInvitations} detail={`${guests.length} total guests`} />
        </div>
        <h2 className="dashboard-group-heading">Budget payments</h2>
        <div className="metric-grid">
            <Metric label="Payments completed" value={completedPayments} detail={`${items.length - completedPayments} pending of ${items.length}`} />
            <Metric label="Payments pending" value={items.length - completedPayments} detail={`${items.length} total budget items`} />
        </div>
        <nav className="dashboard-shortcuts" aria-label="Event reports">
            <span>Printable reports</span>
            <PrintButton label="Event summary" />
            <a className="text-button" href="/guests">Guest list</a>
            <a className="text-button" href="/tasks">Task summary</a>
        </nav>
    </section>;
}
