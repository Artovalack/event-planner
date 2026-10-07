import { getSupabaseClient } from '../lib/supabase/client';
import type { EventInput, EventRow } from '../types/database';

function isEventRow(value: unknown): value is EventRow {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    const row = value as Record<string, unknown>;
    if (typeof row.id !== 'string' || typeof row.title !== 'string') return false;

    const nullableStringFields = ['user_id', 'description', 'date', 'location', 'venue_name', 'venue_address', 'banner_path'];
    const stringFields = ['currency_code', 'timezone', 'created_at'];
    return nullableStringFields.every((field) => !(field in row) || row[field] === null || typeof row[field] === 'string')
        && stringFields.every((field) => !(field in row) || typeof row[field] === 'string');
}

function eventActionError(action: 'create' | 'update' | 'delete', message: string, code?: string): Error {
    if (code === '42501' || /row-level security policy/i.test(message)) {
        return new Error(
            `Supabase rejected the event ${action} (code ${code ?? 'unknown'}): ${message} Check the events table ${action === 'create' ? 'INSERT' : action.toUpperCase()} policy and confirm the signed-in user's id matches the row owner. Required migration: 20261008000400_event_access_policies.sql.`,
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
    await getCurrentUserId();
    const { data, error } = await getSupabaseClient()
        .rpc('create_event_for_current_user', {
            p_title: eventData.title,
            p_description: eventData.description,
            p_date: eventData.date,
            p_location: eventData.location,
        })
        .single();

    if (error) {
        if (error.code === '42883' || /function .*create_event_for_current_user.* does not exist/i.test(error.message)) {
            throw new Error('The event-creation database function is not installed. Apply supabase/migrations/20261008000500_create_event_for_current_user.sql, then retry.');
        }
        throw eventActionError('create', error.message, error.code);
    }
    if (!isEventRow(data)) throw new Error('Event creation returned an invalid event record.');
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

    if (error) throw eventActionError('update', error.message, error.code);
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

    if (error) throw eventActionError('delete', error.message, error.code);
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