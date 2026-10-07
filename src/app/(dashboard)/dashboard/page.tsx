import { getActiveEvent } from '@/lib/planner';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import PrintButton from '@/components/planner/PrintButton';
import type { ReactNode } from 'react';
import { ArrowRight, CheckCheck, ClipboardCheck, CreditCard, UsersRound } from 'lucide-react';

function Metric({ label, value, detail, progress, icon }: { label: string; value: string | number; detail: string; progress: number; icon: ReactNode }) {
    return <article className="metric-card">
        <div className="metric-card-heading"><span>{label}</span><span className="metric-card-icon">{icon}</span></div>
        <strong>{value}</strong>
        <div className="metric-progress" role="progressbar" aria-label={`${label} progress`} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${progress}%` }} />
        </div>
        <small>{detail}</small>
    </article>;
}

const progressPercent = (completed: number, total: number) => total ? Math.round((completed / total) * 100) : 0;

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
    const sentInvitations = guests.filter((guest) => guest.invitation_status !== 'not_sent').length;
    const completedPayments = items.filter((item) => item.payment_status === 'completed').length;
    const upcomingEvent = activeEvent.date && new Date(activeEvent.date).getTime() >= Date.now()
        ? activeEvent
        : null;
    const daysUntil = upcomingEvent?.date
        ? Math.max(0, Math.ceil((new Date(upcomingEvent.date).getTime() - Date.now()) / 86_400_000))
        : null;
    const completedSubtasks = subtasks.filter((item) => item.is_completed).length;

    return <section className="planner-page dashboard-page">
        <header className="page-heading"><div><p className="eyebrow">YOUR WORKSPACE</p><h1>Dashboard</h1><p className="page-subtitle">A quick look at {activeEvent.title}.</p></div><PrintButton /></header>
        <section className="countdown-card">
            <div className="countdown-copy"><p className="eyebrow">YOUR NEXT MILESTONE</p><h2>{upcomingEvent?.title ?? 'No upcoming event'}</h2><p>{upcomingEvent?.date ? new Date(upcomingEvent.date).toLocaleDateString(undefined, { dateStyle: 'long' }) : 'Add a future event date to start the countdown.'}</p></div>
            {daysUntil !== null && <strong><span>{daysUntil}</span><small>{daysUntil === 1 ? 'day to go' : 'days to go'}</small></strong>}
        </section>
        <h2 className="dashboard-group-heading">Tasks & subtasks</h2>
        <div className="metric-grid">
            <Metric label="Tasks completed" value={completedTasks} detail={`${tasks.length - completedTasks} pending of ${tasks.length}`} progress={progressPercent(completedTasks, tasks.length)} icon={<ClipboardCheck size={18} />} />
            <Metric label="Subtasks completed" value={completedSubtasks} detail={`${subtasks.length - completedSubtasks} pending of ${subtasks.length}`} progress={progressPercent(completedSubtasks, subtasks.length)} icon={<CheckCheck size={18} />} />
        </div>
        <h2 className="dashboard-group-heading">Guests & invitations</h2>
        <div className="metric-grid">
            <Metric label="Invitations sent" value={sentInvitations} detail={`${guests.length - sentInvitations} pending of ${guests.length}`} progress={progressPercent(sentInvitations, guests.length)} icon={<UsersRound size={18} />} />
            <Metric label="Invitations pending" value={guests.length - sentInvitations} detail={`${guests.length} total guests`} progress={progressPercent(guests.length - sentInvitations, guests.length)} icon={<UsersRound size={18} />} />
        </div>
        <h2 className="dashboard-group-heading">Budget payments</h2>
        <div className="metric-grid">
            <Metric label="Payments completed" value={completedPayments} detail={`${items.length - completedPayments} pending of ${items.length}`} progress={progressPercent(completedPayments, items.length)} icon={<CreditCard size={18} />} />
            <Metric label="Payments pending" value={items.length - completedPayments} detail={`${items.length} total budget items`} progress={progressPercent(items.length - completedPayments, items.length)} icon={<CreditCard size={18} />} />
        </div>
        <nav className="dashboard-shortcuts" aria-label="Event reports">
            <span>Printable reports</span>
            <PrintButton label="Event summary" />
            <a className="text-button" href="/guests">Guest list</a>
            <a className="text-button" href="/tasks">Task summary <ArrowRight size={14} /></a>
        </nav>
    </section>;
}
