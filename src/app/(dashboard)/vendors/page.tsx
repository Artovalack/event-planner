import PlannerSection from '@/components/planner/PlannerSection';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getActiveEvent, getEventRole } from '@/lib/planner';
import type { BudgetItemRow, VendorContractRow, VendorPaymentMilestoneRow, VendorRow } from '@/types/database';

export default async function VendorsPage() {
    const event = await getActiveEvent();
    if (!event) return <section className="planner-page"><div className="empty-state"><h1>Select an event to get started</h1><p>Create an event before adding vendors.</p><a className="primary-button" href="/events">Go to events</a></div></section>;
    const role = await getEventRole(event.id);
    if (!role) throw new Error('You do not have access to this event.');
    if (role === 'viewer') {
        return <section className="planner-page"><div className="empty-state"><h1>Vendors</h1><p>Vendor contacts and contracts are not included in the Viewer / Client role.</p></div></section>;
    }

    const supabase = getSupabaseServerClient();
    const [vendorsResult, milestonesResult, contractsResult, budgetItemsResult] = await Promise.all([
        supabase.from('vendors').select('*').eq('event_id', event.id).order('vendor_name'),
        supabase.from('vendor_payment_milestones').select('*').eq('event_id', event.id).order('due_at'),
        supabase.from('vendor_contracts').select('*').eq('event_id', event.id).order('uploaded_at', { ascending: false }),
        supabase.from('budget_items').select('*').eq('event_id', event.id).order('item_name'),
    ]);
    if (vendorsResult.error) throw new Error(`Unable to load vendors: ${vendorsResult.error.message}`);
    if (milestonesResult.error) throw new Error(`Unable to load vendor payment milestones: ${milestonesResult.error.message}`);
    if (contractsResult.error) throw new Error(`Unable to load vendor contracts: ${contractsResult.error.message}`);
    if (budgetItemsResult.error) throw new Error(`Unable to load budget items: ${budgetItemsResult.error.message}`);
    return <PlannerSection
        kind="vendors"
        event={event}
        vendors={(vendorsResult.data ?? []) as VendorRow[]}
        paymentMilestones={(milestonesResult.data ?? []) as VendorPaymentMilestoneRow[]}
        vendorContracts={(contractsResult.data ?? []) as VendorContractRow[]}
        budgetItems={(budgetItemsResult.data ?? []) as BudgetItemRow[]}
    />;
}
