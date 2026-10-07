'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export async function updateProfile(displayNameValue: string) {
    if (typeof displayNameValue !== 'string') throw new Error('Enter a valid display name.');
    const displayName = displayNameValue.trim();
    if (displayName.length < 1 || displayName.length > 80) {
        throw new Error('Display name must be between 1 and 80 characters.');
    }

    const supabase = getSupabaseServerClient();
    const { data, error: authError } = await supabase.auth.getUser();
    if (authError || !data.user) throw new Error('Authentication required.');

    const { error } = await supabase.auth.updateUser({
        data: { ...data.user.user_metadata, display_name: displayName },
    });
    if (error) throw new Error(`Unable to update profile: ${error.message}`);

    revalidatePath('/settings/account');
    revalidatePath('/dashboard', 'layout');
    return { displayName };
}
