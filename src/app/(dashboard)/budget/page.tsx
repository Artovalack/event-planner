import PlannerSection from '@/components/planner/PlannerSection';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getActiveEvent } from '@/lib/planner';
import type { BudgetItemRow } from '@/types/database';

export default async function BudgetPage() {
    const event = await getActiveEvent();
    if (!event) return <section className="planner-page"><div className="empty-state"><h1>Select an event to get started</h1><p>Create an event before tracking a budget.</p><a className="primary-button" href="/events">Go to events</a></div></section>;

    const { data, error } = await getSupabaseServerClient()
        .from('budget_items').select('*').eq('event_id', event.id).order('item_name');
    if (error) throw new Error(`Unable to load budget items: ${error.message}`);
    return <PlannerSection kind="budget" event={event} budgetItems={(data ?? []) as BudgetItemRow[]} />;
}
