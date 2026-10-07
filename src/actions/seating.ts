'use server';

import { revalidatePath } from 'next/cache';
import { getActiveEvent } from '@/lib/planner';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import type { SeatingTableRow } from '@/types/database';

type SeatingTableInput = Pick<SeatingTableRow, 'name' | 'capacity' | 'shape' | 'sort_order'>;

async function requireActiveEvent(eventId: string) {
    const activeEvent = await getActiveEvent();
    if (!activeEvent || activeEvent.id !== eventId) {
        throw new Error('This action is limited to the currently selected event.');
    }
    return getSupabaseServerClient();
}

function refreshSeating() {
    revalidatePath('/guests');
    revalidatePath('/guests/seating');
}

export async function saveSeatingTable(eventId: string, input: SeatingTableInput, tableId?: string) {
    const supabase = await requireActiveEvent(eventId);
    const name = input.name.trim();
    if (!name || name.length > 80) throw new Error('Table name must be between 1 and 80 characters.');
    if (!Number.isInteger(input.capacity) || input.capacity < 1 || input.capacity > 500) {
        throw new Error('Table capacity must be a whole number between 1 and 500.');
    }
    if (input.shape !== 'round' && input.shape !== 'rectangle') throw new Error('Choose a valid table shape.');

    const payload = { name, capacity: input.capacity, shape: input.shape, sort_order: input.sort_order };
    const query = tableId
        ? supabase.from('seating_tables').update(payload).eq('id', tableId).eq('event_id', eventId).select('id').single()
        : supabase.from('seating_tables').insert({ ...payload, event_id: eventId }).select('id').single();
    const { error } = await query;
    if (error) throw new Error(`Unable to save seating table: ${error.message}`);
    refreshSeating();
}

export async function deleteSeatingTable(eventId: string, tableId: string) {
    const supabase = await requireActiveEvent(eventId);
    const { error } = await supabase.from('seating_tables')
        .delete().eq('id', tableId).eq('event_id', eventId).select('id').single();
    if (error) throw new Error(`Unable to delete seating table: ${error.message}`);
    refreshSeating();
}

export async function assignGuestToTable(eventId: string, guestId: string, tableId: string | null) {
    const supabase = await requireActiveEvent(eventId);
    const { error } = await supabase.rpc('assign_guest_to_seating_table', {
        p_event_id: eventId,
        p_guest_id: guestId,
        p_seating_table_id: tableId,
    });
    if (error) throw new Error(`Unable to update seating assignment: ${error.message}`);
    refreshSeating();
}
