'use server';

import { revalidatePath } from 'next/cache';
import { getActiveEvent } from '@/lib/planner';
import { getSupabaseServerClient } from '@/lib/supabase/server';

async function getEventClient(eventId: string) {
    const event = await getActiveEvent();
    if (!event || event.id !== eventId) throw new Error('This action is limited to the currently selected event.');
    return getSupabaseServerClient();
}

function refreshVendorViews() {
    for (const path of ['/vendors', '/budget', '/calendar']) revalidatePath(path);
}

export async function saveVendorPaymentMilestone(
    eventId: string,
    vendorId: string,
    input: {
        label: string;
        amount: number;
        due_at: string;
        budget_item_id: string | null;
        notes: string | null;
    },
    milestoneId?: string,
) {
    const supabase = await getEventClient(eventId);
    const label = input.label.trim();
    if (!label || label.length > 120) throw new Error('Payment milestone name must be between 1 and 120 characters.');
    if (!Number.isFinite(input.amount) || input.amount < 0 || input.amount > 9999999999.99) {
        throw new Error('Enter a valid non-negative payment amount.');
    }
    const dueAt = new Date(input.due_at);
    if (!Number.isFinite(dueAt.getTime())) throw new Error('Enter a valid payment due date.');

    const payload = {
        label,
        amount: input.amount,
        due_at: dueAt.toISOString(),
        budget_item_id: input.budget_item_id || null,
        notes: input.notes?.trim() || null,
    };
    const query = milestoneId
        ? supabase.from('vendor_payment_milestones').update(payload)
            .eq('id', milestoneId).eq('event_id', eventId).eq('vendor_id', vendorId).select('id').single()
        : supabase.from('vendor_payment_milestones').insert({ ...payload, event_id: eventId, vendor_id: vendorId }).select('id').single();
    const { error } = await query;
    if (error) throw new Error(`Unable to save payment milestone: ${error.message}`);
    refreshVendorViews();
}

export async function setVendorPaymentStatus(
    eventId: string,
    vendorId: string,
    milestoneId: string,
    status: 'pending' | 'paid' | 'cancelled',
) {
    const supabase = await getEventClient(eventId);
    const { error } = await supabase
        .from('vendor_payment_milestones')
        .update({ status, paid_at: status === 'paid' ? new Date().toISOString() : null })
        .eq('id', milestoneId)
        .eq('vendor_id', vendorId)
        .eq('event_id', eventId)
        .select('id')
        .single();
    if (error) throw new Error(`Unable to update payment status: ${error.message}`);
    refreshVendorViews();
}

export async function deleteVendorPaymentMilestone(eventId: string, vendorId: string, milestoneId: string) {
    const supabase = await getEventClient(eventId);
    const { error } = await supabase.from('vendor_payment_milestones')
        .delete().eq('id', milestoneId).eq('vendor_id', vendorId).eq('event_id', eventId).select('id').single();
    if (error) throw new Error(`Unable to delete payment milestone: ${error.message}`);
    refreshVendorViews();
}

export async function saveVendorContract(
    eventId: string,
    vendorId: string,
    input: { storage_path: string; file_name: string; content_type: string; file_size: number },
) {
    const supabase = await getEventClient(eventId);
    const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    const pathPrefix = `${eventId}/${vendorId}/`;
    if (!input.storage_path.startsWith(pathPrefix) || input.storage_path.slice(pathPrefix.length).includes('/')) {
        throw new Error('The uploaded contract path is not valid for this vendor.');
    }
    if (!input.file_name.trim() || input.file_name.length > 255) throw new Error('Contract file name is invalid.');
    if (!allowedTypes.includes(input.content_type)) throw new Error('Contract must be a PDF, DOC, or DOCX file.');
    if (!Number.isInteger(input.file_size) || input.file_size < 1 || input.file_size > 20 * 1024 * 1024) {
        throw new Error('Contract file must be 20 MB or smaller.');
    }

    const { error } = await supabase.from('vendor_contracts').insert({
        event_id: eventId,
        vendor_id: vendorId,
        storage_path: input.storage_path,
        file_name: input.file_name.trim(),
        content_type: input.content_type,
        file_size: input.file_size,
    });
    if (error) throw new Error(`Unable to save contract details: ${error.message}`);
    refreshVendorViews();
}

export async function deleteVendorContract(eventId: string, vendorId: string, contractId: string) {
    const supabase = await getEventClient(eventId);
    const { data, error } = await supabase.from('vendor_contracts')
        .delete()
        .eq('id', contractId)
        .eq('vendor_id', vendorId)
        .eq('event_id', eventId)
        .select('storage_path')
        .single();
    if (error) throw new Error(`Unable to remove contract details: ${error.message}`);
    refreshVendorViews();
    return { storagePath: data.storage_path as string };
}
