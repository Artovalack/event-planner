'use client';

import { getSupabaseClient } from '@/lib/supabase/client';

export type OAuthProvider = 'google' | 'facebook';

export function getAuthErrorMessage(error: unknown, fallback: string): string {
    const message = error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
            ? error.message
            : typeof error === 'string'
                ? error
                : fallback;

    if (/failed to fetch|fetch failed|networkerror/i.test(message)) {
        return "Can't connect to Supabase Auth. Check your internet connection, browser/network settings, and Supabase project URL.";
    }

    if (/error sending magic link email/i.test(message)) {
        return 'Supabase Auth could not send the sign-in email. Check the Magic Link email template, SMTP settings, and email provider logs in your Supabase project.';
    }

    return message || fallback;
}

export async function signInWithOAuth(provider: OAuthProvider) {
    const requestedNext = new URLSearchParams(window.location.search).get('next');
    const nextPath = requestedNext && requestedNext.startsWith('/') && !requestedNext.startsWith('//') && !requestedNext.includes('\\')
        ? requestedNext
        : '/events';
    return getSupabaseClient().auth.signInWithOAuth({
        provider,
        options: {
            redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        },
    });
}
