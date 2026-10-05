import PlannerSection from '@/components/planner/PlannerSection';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getActiveEvent } from '@/lib/planner';
import type { VendorRow } from '@/types/database';

export default async function VendorsPage() {
    const event = await getActiveEvent();
    if (!event) return <section className="planner-page"><div className="empty-state"><h1>Select an event to get started</h1><p>Create an event before adding vendors.</p><a className="primary-button" href="/events">Go to events</a></div></section>;

    const { data, error } = await getSupabaseServerClient()
        .from('vendors').select('*').eq('event_id', event.id).order('vendor_name');
    if (error) throw new Error(`Unable to load vendors: ${error.message}`);
    return <PlannerSection kind="vendors" event={event} vendors={(data ?? []) as VendorRow[]} />;
}
