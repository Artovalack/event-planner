import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabase: SupabaseClient | undefined;

export function getSupabaseClient(): SupabaseClient {
    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error(
            'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
        );
    }

    if (!supabase) {
        supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
    }

    return supabase;
}
