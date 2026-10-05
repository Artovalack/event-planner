'use client';

import { getSupabaseClient } from '@/lib/supabase/client';

export type OAuthProvider = 'google' | 'facebook';

export async function signInWithOAuth(provider: OAuthProvider) {
    return getSupabaseClient().auth.signInWithOAuth({
        provider,
        options: {
            redirectTo: `${window.location.origin}/auth/callback`,
        },
    });
}
