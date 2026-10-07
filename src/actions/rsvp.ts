'use server';

import { createHash, randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { getActiveEvent } from '@/lib/planner';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export async function createGuestRsvpLink(eventId: string, guestId: string) {
    const event = await getActiveEvent();
    if (!event || event.id !== eventId) {
        throw new Error('Select this event before creating an RSVP link.');
    }

    const supabase = getSupabaseServerClient();
    const { data: guest, error: guestError } = await supabase
        .from('guests')
        .select('id, rsvp_status')
        .eq('id', guestId)
        .eq('event_id', eventId)
        .single();
    if (guestError || !guest) throw new Error('The selected guest is not available.');

    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const { error } = await supabase
        .from('guests')
        .update({
            rsvp_token_hash: tokenHash,
            invitation_status: guest.rsvp_status === 'confirmed' || guest.rsvp_status === 'declined'
                ? guest.rsvp_status
                : 'sent',
        })
        .eq('id', guestId)
        .eq('event_id', eventId);
    if (error) throw new Error(`Unable to create the RSVP link: ${error.message}`);

    revalidatePath('/guests');
    return { token };
}

export type PublicRsvpInput = {
    rsvp_status: 'confirmed' | 'declined';
    companion_adults: number;
    companion_children: number;
    companion_babies: number;
    meal_preference: string;
    allergies: string;
};

export async function submitPublicRsvp(eventId: string, token: string, input: PublicRsvpInput) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
        throw new Error('This RSVP link is invalid or expired. Contact the event organizer for a new link.');
    }
    if (!input || typeof input !== 'object' || !['confirmed', 'declined'].includes(input.rsvp_status)) {
        throw new Error('Choose whether you can attend.');
    }
    const counts = [input.companion_adults, input.companion_children, input.companion_babies];
    if (counts.some((count) => !Number.isInteger(count) || count < 0 || count > 50)) {
        throw new Error('Companion counts must be whole numbers between 0 and 50.');
    }
    if (typeof input.meal_preference !== 'string' || input.meal_preference.length > 120
        || typeof input.allergies !== 'string' || input.allergies.length > 1000) {
        throw new Error('Meal preference or allergy notes are too long.');
    }

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.rpc('submit_public_guest_rsvp', {
        p_event_id: eventId,
        p_token: token,
        p_rsvp_status: input.rsvp_status,
        p_companion_adults: input.companion_adults,
        p_companion_children: input.companion_children,
        p_companion_babies: input.companion_babies,
        p_meal_preference: input.meal_preference,
        p_allergies: input.allergies,
    });
    if (error) {
        if (error.message.includes('invalid or companion counts exceed')) {
            throw new Error('This RSVP link is invalid, or your companion counts are above the invitation limit.');
        }
        if (error.message.includes('invalid or expired')) {
            throw new Error('This RSVP link is invalid or expired. Contact the event organizer for a new link.');
        }
        throw new Error(`Unable to save your RSVP: ${error.message}`);
    }

    const result = Array.isArray(data) ? data[0] : data;
    if (!result) throw new Error('Your RSVP could not be saved. Please try again.');
    return { status: result.saved_rsvp_status as 'confirmed' | 'declined' };
}
