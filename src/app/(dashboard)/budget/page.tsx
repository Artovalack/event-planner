import PlannerSection from '@/components/planner/PlannerSection';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getActiveEvent, getEventRole } from '@/lib/planner';
import type { BudgetItemRow, VendorPaymentMilestoneRow } from '@/types/database';

export default async function BudgetPage() {
    const event = await getActiveEvent();
    if (!event) return <section className="planner-page"><div className="empty-state"><h1>Select an event to get started</h1><p>Create an event before tracking a budget.</p><a className="primary-button" href="/events">Go to events</a></div></section>;
    const role = await getEventRole(event.id);
    if (!role) throw new Error('You do not have access to this event.');

    const supabase = getSupabaseServerClient();
    const [itemsResult, milestonesResult] = await Promise.all([
        supabase.from('budget_items').select('*').eq('event_id', event.id).order('item_name'),
        supabase.from('vendor_payment_milestones').select('*').eq('event_id', event.id).neq('status', 'cancelled').order('due_at'),
    ]);
    if (itemsResult.error) throw new Error(`Unable to load budget items: ${itemsResult.error.message}`);
    if (milestonesResult.error) throw new Error(`Unable to load scheduled vendor payments: ${milestonesResult.error.message}`);
    return <PlannerSection
        kind="budget"
        event={event}
        canEdit={role !== 'viewer'}
        budgetItems={(itemsResult.data ?? []) as BudgetItemRow[]}
        paymentMilestones={(milestonesResult.data ?? []) as VendorPaymentMilestoneRow[]}
    />;
}
