import { getSupabaseClient } from '../lib/supabase/client';
import type { EventInput, EventRow } from '../types/database';

function eventActionError(message: string, code?: string): Error {
    if (code === '42501' || /row-level security policy/i.test(message)) {
        return new Error(
            'Supabase blocked this event action with row-level security. In Supabase SQL Editor, run the event access policies from the README while signed in to your app.',
        );
    }

    return new Error(message);
}

async function getCurrentUserId() {
    const { data: { user }, error } = await getSupabaseClient().auth.getUser();
    if (error || !user) throw new Error('Authentication required.');
    return user.id;
}

export const createEvent = async (eventData: EventInput): Promise<EventRow> => {
    const userId = await getCurrentUserId();
    const { data, error } = await getSupabaseClient()
        .from('events')
        .insert({ ...eventData, user_id: userId })
        .select()
        .single();

    if (error) throw eventActionError(error.message, error.code);
    return data;
};

export const updateEvent = async (eventId: string, eventData: EventInput): Promise<EventRow> => {
    const userId = await getCurrentUserId();
    const { data, error } = await getSupabaseClient()
        .from('events')
        .update(eventData)
        .eq('id', eventId)
        .eq('user_id', userId)
        .select()
        .single();

    if (error) throw eventActionError(error.message, error.code);
    return data;
};

export const deleteEvent = async (eventId: string) => {
    const userId = await getCurrentUserId();
    const { data, error } = await getSupabaseClient()
        .from('events')
        .delete()
        .eq('id', eventId)
        .eq('user_id', userId)
        .select('id')
        .single();

    if (error) throw eventActionError(error.message, error.code);
    return data;
};

export const getEvents = async () => {
    const userId = await getCurrentUserId();
    const { data, error } = await getSupabaseClient()
        .from('events')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: true, nullsFirst: false });

    if (error) throw new Error(error.message);
    return data;
};

export const getEventById = async (eventId: string) => {
    const userId = await getCurrentUserId();
    const { data, error } = await getSupabaseClient()
        .from('events')
        .select('*')
        .eq('id', eventId)
        .eq('user_id', userId)
        .single();

    if (error) throw new Error(error.message);
    return data;
};