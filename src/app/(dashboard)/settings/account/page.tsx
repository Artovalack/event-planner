import NotificationPreferencesForm from '@/components/settings/NotificationPreferencesForm';
import AccountDetailsForm from '@/components/settings/AccountDetailsForm';
import { defaultNotificationPreferences, type NotificationPreferences } from '@/lib/preferences';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export default async function AccountPreferencesPage() {
    const supabase = getSupabaseServerClient();
    const [{ data: { user }, error: authError }] = await Promise.all([supabase.auth.getUser()]);
    if (authError || !user) throw new Error('Authentication required.');

    const { data, error } = await supabase
        .from('user_notification_preferences')
        .select('email_deadlines, in_app_deadlines, email_guest_rsvps, in_app_guest_rsvps')
        .eq('user_id', user.id)
        .maybeSingle();
    if (error) throw new Error(`Unable to load notification preferences: ${error.message}`);

    const preferences: NotificationPreferences = data
        ? {
            email_deadlines: data.email_deadlines,
            in_app_deadlines: data.in_app_deadlines,
            email_guest_rsvps: data.email_guest_rsvps,
            in_app_guest_rsvps: data.in_app_guest_rsvps,
        }
        : defaultNotificationPreferences;

    return (
        <section className="planner-page">
            <header className="page-heading">
                <div>
                    <p className="eyebrow">SYSTEM / PREFERENCES</p>
                    <h1>Account Preferences</h1>
                    <p className="page-subtitle">Manage your profile, appearance, and notification preferences.</p>
                </div>
            </header>
            <AccountDetailsForm
                email={user.email ?? ''}
                initialDisplayName={typeof user.user_metadata?.display_name === 'string'
                    ? user.user_metadata.display_name
                    : typeof user.user_metadata?.full_name === 'string'
                        ? user.user_metadata.full_name
                        : ''}
            />
            <NotificationPreferencesForm initialPreferences={preferences} />
        </section>
    );
}
