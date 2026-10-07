'use server';

import { createHash, randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { getActiveEvent, getEventRole } from '@/lib/planner';
import { getSupabaseServerClient } from '@/lib/supabase/server';

async function requireEventEditor(eventId: string) {
    const event = await getActiveEvent();
    if (!event || event.id !== eventId) {
        throw new Error('Select this event before managing its public registration.');
    }
    const role = await getEventRole(eventId);
    if (role !== 'admin' && role !== 'collaborator') {
        throw new Error('You do not have permission to manage public registration for this event.');
    }
    return getSupabaseServerClient();
}

export async function createPublicRegistrationLink(eventId: string) {
    const supabase = await requireEventEditor(eventId);
    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const { error } = await supabase.rpc('set_event_registration_token', {
        p_event_id: eventId,
        p_token_hash: tokenHash,
    });
    if (error) throw new Error(`Unable to create the public registration link: ${error.message}`);

    return { token };
}

export async function disablePublicRegistrationLink(eventId: string) {
    const supabase = await requireEventEditor(eventId);
    const { error } = await supabase.rpc('set_event_registration_token', {
        p_event_id: eventId,
        p_token_hash: null,
    });
    if (error) throw new Error(`Unable to disable the public registration link: ${error.message}`);
    revalidatePath('/guests');
}

export async function submitPublicEventRegistration(
    eventId: string,
    token: string,
    input: {
        name: string;
        email: string;
        companionAdults: number;
        companionChildren: number;
        companionBabies: number;
        note: string;
    },
) {
    if (!/^[0-9a-f-]{36}$/i.test(eventId) || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
        throw new Error('This registration link is invalid or no longer active.');
    }
    if (!input || typeof input !== 'object'
        || typeof input.name !== 'string' || input.name.trim().length < 1 || input.name.length > 160
        || typeof input.email !== 'string' || input.email.trim().length > 320
        || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())
        || !Number.isInteger(input.companionAdults) || input.companionAdults < 0 || input.companionAdults > 50
        || !Number.isInteger(input.companionChildren) || input.companionChildren < 0 || input.companionChildren > 50
        || !Number.isInteger(input.companionBabies) || input.companionBabies < 0 || input.companionBabies > 50
        || typeof input.note !== 'string' || input.note.length > 1000) {
        throw new Error('Check your name, email, adult, child and baby counts, and note, then try again.');
    }

    const { error } = await getSupabaseServerClient().rpc('submit_public_event_registration', {
        p_event_id: eventId,
        p_token: token,
        p_name: input.name.trim(),
        p_email: input.email.trim(),
        p_companion_adults: input.companionAdults,
        p_companion_children: input.companionChildren,
        p_companion_babies: input.companionBabies,
        p_note: input.note.trim(),
    });
    if (error) {
        if (error.message.includes('already pending or approved')) {
            throw new Error('A request with this email is already pending or approved.');
        }
        if (error.message.includes('invalid or no longer active')) {
            throw new Error('This registration link is invalid or no longer active.');
        }
        throw new Error(`Unable to submit your request: ${error.message}`);
    }
}

export async function reviewPublicEventRegistration(eventId: string, requestId: string, status: 'approved' | 'declined') {
    const supabase = await requireEventEditor(eventId);
    const { data, error } = await supabase.rpc('review_event_registration_request', {
        p_event_id: eventId,
        p_request_id: requestId,
        p_status: status,
    });
    if (error) throw new Error(`Unable to ${status === 'approved' ? 'approve' : 'decline'} registration: ${error.message}`);
    if (data !== status) throw new Error('The registration request could not be updated.');
    revalidatePath('/guests');
}

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
