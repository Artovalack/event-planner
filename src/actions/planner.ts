'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { ACTIVE_EVENT_COOKIE } from '@/lib/planner';
import type { BudgetItemRow, GuestRow, VendorRow } from '@/types/database';

type TaskInput = {
    title: string;
    category: string;
    due_date: string | null;
    notes: string | null;
    subtasks: { title: string; is_completed: boolean }[];
};

type GuestInput = Omit<GuestRow, 'id' | 'event_id' | 'total_companions' | 'created_at'>;
type BudgetInput = Omit<BudgetItemRow, 'id' | 'event_id' | 'created_at'>;
type VendorInput = Omit<VendorRow, 'id' | 'event_id' | 'created_at'>;

async function assertEventAvailable(eventId: string) {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.from('events').select('id').eq('id', eventId).single();
    if (error || !data) throw new Error('The selected event is not available.');
    return supabase;
}

async function requireEvent(eventId: string) {
    const supabase = getSupabaseServerClient();
    const { data: events, error } = await supabase
        .from('events').select('id, date').order('date', { ascending: true, nullsFirst: false });
    if (error) throw new Error(`Unable to validate the active event: ${error.message}`);
    const requestedId = cookies().get(ACTIVE_EVENT_COOKIE)?.value;
    const activeEvent = events?.find((event) => event.id === requestedId)
        ?? events?.find((event) => event.date && new Date(event.date).getTime() >= Date.now())
        ?? events?.[0];
    if (!activeEvent || activeEvent.id !== eventId) {
        throw new Error('This action is limited to the currently selected event.');
    }
    return supabase;
}

function refreshPlanner() {
    for (const path of ['/dashboard', '/tasks', '/guests', '/budget', '/vendors']) {
        revalidatePath(path);
    }
}

export async function setActiveEvent(eventId: string) {
    await assertEventAvailable(eventId);
    cookies().set(ACTIVE_EVENT_COOKIE, eventId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
    });
    refreshPlanner();
}

export async function saveTask(eventId: string, input: TaskInput, taskId?: string) {
    const supabase = await requireEvent(eventId);
    const cleanSubtasks = input.subtasks
        .map((subtask) => ({ ...subtask, title: subtask.title.trim() }))
        .filter((subtask) => subtask.title);
    const { error } = await supabase.rpc('save_task_with_subtasks', {
        p_event_id: eventId,
        p_task_id: taskId ?? null,
        p_title: input.title.trim(),
        p_category: input.category,
        p_due_date: input.due_date,
        p_notes: input.notes,
        p_subtasks: cleanSubtasks,
    });
    if (error) throw new Error(`Unable to save task and subtasks: ${error.message}`);
    refreshPlanner();
}

export async function setTaskStatus(eventId: string, taskId: string, status: 'pending' | 'completed') {
    const supabase = await requireEvent(eventId);
    const { error } = await supabase.from('tasks').update({ status }).eq('id', taskId).eq('event_id', eventId).select('id').single();
    if (error) throw new Error(`Unable to update task status: ${error.message}`);
    refreshPlanner();
}

export async function setSubtaskStatus(eventId: string, taskId: string, subtaskId: string, isCompleted: boolean) {
    const supabase = await requireEvent(eventId);
    const { data: task, error: taskError } = await supabase
        .from('tasks').select('id').eq('id', taskId).eq('event_id', eventId).single();
    if (taskError || !task) throw new Error('The selected task is not available for this event.');
    const { error } = await supabase.from('subtasks')
        .update({ is_completed: isCompleted })
        .eq('id', subtaskId)
        .eq('task_id', taskId)
        .select('id')
        .single();
    if (error) throw new Error(`Unable to update subtask: ${error.message}`);
    refreshPlanner();
}

export async function deleteTask(eventId: string, taskId: string) {
    const supabase = await requireEvent(eventId);
    const { error } = await supabase.from('tasks').delete().eq('id', taskId).eq('event_id', eventId).select('id').single();
    if (error) throw new Error(`Unable to delete task: ${error.message}`);
    refreshPlanner();
}

export async function saveGuest(eventId: string, input: GuestInput, guestId?: string) {
    const supabase = await requireEvent(eventId);
    const query = guestId
        ? supabase.from('guests').update(input).eq('id', guestId).eq('event_id', eventId).select('id').single()
        : supabase.from('guests').insert({ ...input, event_id: eventId }).select('id').single();
    const { error } = await query;
    if (error) throw new Error(`Unable to save guest: ${error.message}`);
    refreshPlanner();
}

export async function deleteGuest(eventId: string, guestId: string) {
    const supabase = await requireEvent(eventId);
    const { error } = await supabase.from('guests').delete().eq('id', guestId).eq('event_id', eventId).select('id').single();
    if (error) throw new Error(`Unable to delete guest: ${error.message}`);
    refreshPlanner();
}

export async function saveBudgetItem(eventId: string, input: BudgetInput, itemId?: string) {
    const supabase = await requireEvent(eventId);
    const query = itemId
        ? supabase.from('budget_items').update(input).eq('id', itemId).eq('event_id', eventId).select('id').single()
        : supabase.from('budget_items').insert({ ...input, event_id: eventId }).select('id').single();
    const { error } = await query;
    if (error) throw new Error(`Unable to save budget item: ${error.message}`);
    refreshPlanner();
}

export async function deleteBudgetItem(eventId: string, itemId: string) {
    const supabase = await requireEvent(eventId);
    const { error } = await supabase.from('budget_items').delete().eq('id', itemId).eq('event_id', eventId).select('id').single();
    if (error) throw new Error(`Unable to delete budget item: ${error.message}`);
    refreshPlanner();
}

export async function saveVendor(eventId: string, input: VendorInput, vendorId?: string) {
    const supabase = await requireEvent(eventId);
    const query = vendorId
        ? supabase.from('vendors').update(input).eq('id', vendorId).eq('event_id', eventId).select('id').single()
        : supabase.from('vendors').insert({ ...input, event_id: eventId }).select('id').single();
    const { error } = await query;
    if (error) throw new Error(`Unable to save vendor: ${error.message}`);
    refreshPlanner();
}

export async function deleteVendor(eventId: string, vendorId: string) {
    const supabase = await requireEvent(eventId);
    const { error } = await supabase.from('vendors').delete().eq('id', vendorId).eq('event_id', eventId).select('id').single();
    if (error) throw new Error(`Unable to delete vendor: ${error.message}`);
    refreshPlanner();
}
