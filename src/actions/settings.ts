'use server';

import { revalidatePath } from 'next/cache';
import { getActiveEvent } from '@/lib/planner';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export type EventSettingsInput = {
    currency_code: string;
    timezone: string;
    venue_name: string | null;
    venue_address: string | null;
};

function validateSettings(input: EventSettingsInput) {
    const currencyCode = input.currency_code.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currencyCode)) throw new Error('Choose a valid three-letter currency code.');

    const timezone = input.timezone.trim();
    if (!timezone) throw new Error('Select a timezone.');
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    } catch {
        throw new Error('Select a valid timezone.');
    }

    return {
        currency_code: currencyCode,
        timezone,
        venue_name: input.venue_name?.trim() || null,
        venue_address: input.venue_address?.trim() || null,
    };
}

export async function saveEventSettings(eventId: string, input: EventSettingsInput, bannerPath?: string) {
    const activeEvent = await getActiveEvent();
    if (!activeEvent || activeEvent.id !== eventId) {
        throw new Error('Settings can only be changed for the currently selected event.');
    }

    if (bannerPath && (!bannerPath.startsWith(`${eventId}/`) || bannerPath.slice(eventId.length + 1).includes('/'))) {
        throw new Error('The selected banner path is not valid for this event.');
    }

    const updates = validateSettings(input);
    const supabase = getSupabaseServerClient();

    const { data, error } = await supabase
        .from('events')
        .update({ ...updates, ...(bannerPath ? { banner_path: bannerPath } : {}) })
        .eq('id', eventId)
        .select('id, banner_path')
        .single();

    if (error) throw new Error(`Unable to save event settings: ${error.message}`);

    const previousPath = activeEvent.banner_path;
    let warning: string | null = null;
    if (bannerPath && previousPath && previousPath !== bannerPath) {
        const { error: removeError } = await supabase.storage.from('event-banners').remove([previousPath]);
        if (removeError) warning = `Settings were saved, but the previous banner could not be removed: ${removeError.message}`;
    }

    revalidatePath('/settings/event');
    revalidatePath('/calendar');
    revalidatePath('/events');
    return { bannerPath: data.banner_path, warning };
}
