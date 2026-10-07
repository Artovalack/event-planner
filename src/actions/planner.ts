'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { ACTIVE_EVENT_COOKIE, getActiveEventCookieName } from '@/lib/planner';
import type { BudgetItemRow, GuestRow, ScheduleItemRow, VendorRow } from '@/types/database';

type TaskInput = {
    title: string;
    category: string;
    due_date: string | null;
    notes: string | null;
    subtasks: { title: string; is_completed: boolean }[];
};

type GuestInput = Pick<GuestRow, 'name' | 'email' | 'guest_tag' | 'companion_adults' | 'companion_children' | 'companion_babies'>;
type BudgetInput = Omit<BudgetItemRow, 'id' | 'event_id' | 'created_at'>;
type VendorInput = Omit<VendorRow, 'id' | 'event_id' | 'created_at'>;
type ScheduleItemInput = Omit<ScheduleItemRow, 'id' | 'event_id' | 'created_at' | 'updated_at'>;

async function getCurrentUserId() {
    const supabase = getSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw new Error('Authentication required.');
    return user.id;
}

async function assertEventAvailable(eventId: string) {
    const supabase = getSupabaseServerClient();
    await getCurrentUserId();
    const { data, error } = await supabase.from('events').select('id').eq('id', eventId).single();
    if (error || !data) throw new Error('The selected event is not available.');
    return supabase;
}

async function requireEvent(eventId: string) {
    const supabase = getSupabaseServerClient();
    const userId = await getCurrentUserId();
    const { data: events, error } = await supabase
        .from('events')
        .select('id, date')
        .order('date', { ascending: true, nullsFirst: false });
    if (error) throw new Error(`Unable to validate the active event: ${error.message}`);
    const requestedId = cookies().get(getActiveEventCookieName(userId))?.value;
    const activeEvent = events?.find((event) => event.id === requestedId)
        ?? events?.find((event) => event.date && new Date(event.date).getTime() >= Date.now())
        ?? events?.[0];
    if (!activeEvent || activeEvent.id !== eventId) {
        throw new Error('This action is limited to the currently selected event.');
    }
    return supabase;
}

function refreshPlanner() {
    for (const path of ['/dashboard', '/tasks', '/guests', '/budget', '/vendors', '/calendar', '/timeline']) {
        revalidatePath(path);
    }
}

export async function setActiveEvent(eventId: string) {
    const userId = await getCurrentUserId();
    await assertEventAvailable(eventId);
    cookies().set(getActiveEventCookieName(userId), eventId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
    });
    if (cookies().has(ACTIVE_EVENT_COOKIE)) {
        cookies().delete(ACTIVE_EVENT_COOKIE);
    }
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
    const guestTag = input.guest_tag ?? 'guest';
    if (!['guest', 'vip', 'family', 'vendor', 'sponsor'].includes(guestTag)) {
        throw new Error('Choose a valid guest tag.');
    }
    const guestData = {
        name: input.name.trim(),
        email: input.email?.trim() || null,
        guest_tag: guestTag,
        companion_adults: input.companion_adults,
        companion_children: input.companion_children,
        companion_babies: input.companion_babies,
    };
    const query = guestId
        ? supabase.from('guests').update(guestData).eq('id', guestId).eq('event_id', eventId).select('id').single()
        : supabase.from('guests').insert({ ...guestData, invitation_status: 'not_sent', event_id: eventId }).select('id').single();
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
    const { error: unlinkError } = await supabase
        .from('vendor_payment_milestones')
        .update({ budget_item_id: null })
        .eq('event_id', eventId)
        .eq('budget_item_id', itemId);
    if (unlinkError) throw new Error(`Unable to unlink scheduled payments from this budget item: ${unlinkError.message}`);
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
    const { data: contracts, error: contractsError } = await supabase
        .from('vendor_contracts')
        .select('storage_path')
        .eq('vendor_id', vendorId)
        .eq('event_id', eventId);
    if (contractsError) throw new Error(`Unable to load vendor contracts before deletion: ${contractsError.message}`);
    const { error } = await supabase.from('vendors').delete().eq('id', vendorId).eq('event_id', eventId).select('id').single();
    if (error) throw new Error(`Unable to delete vendor: ${error.message}`);
    const paths = (contracts ?? []).map((contract) => contract.storage_path);
    if (paths.length) {
        const { error: storageError } = await supabase.storage.from('vendor-contracts').remove(paths);
        if (storageError) throw new Error(`Vendor deleted, but contract file cleanup failed: ${storageError.message}`);
    }
    refreshPlanner();
}

export async function saveScheduleItem(eventId: string, input: ScheduleItemInput, itemId?: string) {
    const supabase = await requireEvent(eventId);
    const payload = {
        title: input.title.trim(),
        description: input.description?.trim() || null,
        starts_at: input.starts_at,
        ends_at: input.ends_at,
        location: input.location?.trim() || null,
        responsible_person: input.responsible_person?.trim() || null,
        sort_order: input.sort_order,
    };
    const query = itemId
        ? supabase.from('event_schedule_items').update(payload).eq('id', itemId).eq('event_id', eventId).select('id').single()
        : supabase.from('event_schedule_items').insert({ ...payload, event_id: eventId }).select('id').single();
    const { error } = await query;
    if (error) throw new Error(`Unable to save schedule item: ${error.message}`);
    refreshPlanner();
}

export async function deleteScheduleItem(eventId: string, itemId: string) {
    const supabase = await requireEvent(eventId);
    const { error } = await supabase.from('event_schedule_items')
        .delete().eq('id', itemId).eq('event_id', eventId).select('id').single();
    if (error) throw new Error(`Unable to delete schedule item: ${error.message}`);
    refreshPlanner();
}
