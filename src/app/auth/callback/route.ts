import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';

function safeNextPath(value: string | null): string {
    if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/events';
    return value;
}

export async function GET(request: NextRequest) {
    const code = request.nextUrl.searchParams.get('code');
    const next = safeNextPath(request.nextUrl.searchParams.get('next'));
    if (!code) {
        return NextResponse.redirect(new URL('/login?error=oauth', request.url));
    }

    const supabase = getSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('error', 'Unable to complete sign-in. Please try again.');
        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.redirect(new URL(next, request.url));
}
