import EventSettingsForm from '@/components/settings/EventSettingsForm';
import { getActiveEvent } from '@/lib/planner';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export default async function EventSettingsPage() {
    const event = await getActiveEvent();
    if (!event) {
        return <section className="planner-page"><div className="empty-state"><h1>Event Settings</h1><p>Create an event before changing event preferences.</p><a className="primary-button" href="/events">Create an event</a></div></section>;
    }

    const supabase = getSupabaseServerClient();
    const { data: role, error: roleError } = await supabase.rpc('get_event_role', { p_event_id: event.id });
    if (roleError) throw new Error(`Unable to load event settings permissions: ${roleError.message}`);
    if (role !== 'admin') {
        return <section className="planner-page"><div className="empty-state"><h1>Event Settings</h1><p>Only the event owner (Admin) can change event settings.</p></div></section>;
    }

    const bannerUrl = event.banner_path
        ? supabase.storage.from('event-banners').getPublicUrl(event.banner_path).data.publicUrl
        : null;

    return (
        <section className="planner-page">
            <header className="page-heading"><div><p className="eyebrow">SYSTEM / PREFERENCES</p><h1>Event Settings</h1><p className="page-subtitle">Set the currency, timezone, venue, and banner for {event.title}.</p></div></header>
            <EventSettingsForm event={event} bannerUrl={bannerUrl} />
        </section>
    );
}
