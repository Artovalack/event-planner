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

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('error', 'Unable to load your account. Please try again.');
        return NextResponse.redirect(loginUrl);
    }

    const accountCreatedAt = user?.created_at ? new Date(user.created_at).getTime() : Number.NaN;
    const accountAgeMs = Date.now() - accountCreatedAt;
    const onboardingTour = user?.user_metadata?.onboarding_tour;
    if (user && onboardingTour === undefined && accountAgeMs >= 0 && accountAgeMs < 5 * 60 * 1000) {
        const { error: onboardingError } = await supabase.auth.updateUser({
            data: { ...user.user_metadata, onboarding_tour: 'pending' },
        });
        if (onboardingError) {
            const loginUrl = new URL('/login', request.url);
            loginUrl.searchParams.set('error', 'Your account was created, but setup could not be completed. Please sign in again.');
            return NextResponse.redirect(loginUrl);
        }
    }

    return NextResponse.redirect(new URL(next, request.url));
}
