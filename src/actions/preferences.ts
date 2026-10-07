'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import type { NotificationPreferences } from '@/lib/preferences';

export async function saveNotificationPreferences(input: NotificationPreferences) {
    if (
        typeof input !== 'object' ||
        input === null ||
        typeof input.email_deadlines !== 'boolean' ||
        typeof input.in_app_deadlines !== 'boolean' ||
        typeof input.email_guest_rsvps !== 'boolean' ||
        typeof input.in_app_guest_rsvps !== 'boolean'
    ) {
        throw new Error('Choose valid notification preferences.');
    }

    const supabase = getSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('Authentication required.');

    const { error } = await supabase.from('user_notification_preferences').upsert({
        user_id: user.id,
        ...input,
        updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (error) throw new Error(`Unable to save notification preferences: ${error.message}`);

    revalidatePath('/settings/account');
}
