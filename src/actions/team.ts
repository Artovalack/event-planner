'use server';

import { createHash, randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { getActiveEvent } from '@/lib/planner';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export async function createWorkspaceInvitation(eventId: string, emailValue: string, role: 'collaborator' | 'viewer') {
    const event = await getActiveEvent();
    if (!event || event.id !== eventId) throw new Error('Select this event before inviting a teammate.');
    const email = emailValue.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
        throw new Error('Enter a valid email address.');
    }
    if (role !== 'collaborator' && role !== 'viewer') throw new Error('Choose a valid workspace role.');

    const supabase = getSupabaseServerClient();
    const { data: currentUser, error: userError } = await supabase.auth.getUser();
    if (userError || !currentUser.user) throw new Error('Authentication required.');
    if (currentUser.user.email?.toLowerCase() === email) throw new Error('You cannot invite your own email address.');

    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const { error: insertError } = await supabase.from('event_invitations').insert({
        event_id: eventId,
        email,
        role,
        token_hash: tokenHash,
        invited_by: currentUser.user.id,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    if (insertError) throw new Error(`Unable to create invitation: ${insertError.message}`);

    revalidatePath('/settings/team');
    return { token };
}

export async function revokeWorkspaceInvitation(eventId: string, invitationId: string) {
    const event = await getActiveEvent();
    if (!event || event.id !== eventId) throw new Error('Select this event before revoking an invitation.');
    const { error } = await getSupabaseServerClient().from('event_invitations')
        .delete().eq('id', invitationId).eq('event_id', eventId).select('id').single();
    if (error) throw new Error(`Unable to revoke invitation: ${error.message}`);
    revalidatePath('/settings/team');
}

export async function removeWorkspaceMember(eventId: string, memberId: string) {
    const event = await getActiveEvent();
    if (!event || event.id !== eventId) throw new Error('Select this event before changing workspace access.');
    const { error } = await getSupabaseServerClient().from('event_members')
        .delete().eq('event_id', eventId).eq('user_id', memberId).select('user_id').single();
    if (error) throw new Error(`Unable to remove workspace member: ${error.message}`);
    revalidatePath('/settings/team');
}

export async function acceptWorkspaceInvitation(eventId: string, token: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error('This invitation link is invalid or expired.');
    const { data, error } = await getSupabaseServerClient().rpc('accept_workspace_invitation', {
        p_event_id: eventId,
        p_token: token,
    });
    if (error) throw new Error(error.message);
    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.accepted_event_id) throw new Error('The invitation could not be accepted. Please try again.');
    return { eventId: result.accepted_event_id as string };
}
