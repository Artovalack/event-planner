import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

type SupabaseCookie = {
    name: string;
    value: string;
    options: CookieOptions;
};

export async function middleware(request: NextRequest) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        return NextResponse.json(
            { error: 'Supabase is not configured. Check the public Supabase URL and anon key.' },
            { status: 500 },
        );
    }

    let response = NextResponse.next({ request });
    const refreshedCookies: SupabaseCookie[] = [];
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
            getAll() {
                return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
                refreshedCookies.push(...cookiesToSet);
                cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
                response = NextResponse.next({ request });
                cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
            },
        },
    });

    const { data, error } = await supabase.auth.getUser();

    if (error && error.name !== 'AuthSessionMissingError') {
        return NextResponse.json(
            { error: `Unable to verify your session: ${error.message}` },
            { status: 503 },
        );
    }

    if (!data.user) {
        if (request.nextUrl.pathname.startsWith('/api/')) {
            return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
        }

        const loginUrl = new URL('/login', request.url);
        const redirectResponse = NextResponse.redirect(loginUrl);
        refreshedCookies.forEach(({ name, value, options }) => redirectResponse.cookies.set(name, value, options));
        return redirectResponse;
    }

    const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError) {
        return NextResponse.json(
            { error: `Unable to verify multi-factor authentication: ${assuranceError.message}` },
            { status: 503 },
        );
    }

    if (assurance.currentLevel === 'aal1' && assurance.nextLevel === 'aal2' && !request.nextUrl.pathname.startsWith('/mfa')) {
        if (request.nextUrl.pathname.startsWith('/api/')) {
            return NextResponse.json({ error: 'Complete authenticator verification to continue.' }, { status: 403 });
        }
        const challengeUrl = new URL('/mfa', request.url);
        challengeUrl.searchParams.set('mode', 'challenge');
        challengeUrl.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`);
        const challengeResponse = NextResponse.redirect(challengeUrl);
        refreshedCookies.forEach(({ name, value, options }) => challengeResponse.cookies.set(name, value, options));
        return challengeResponse;
    }

    return response;
}

export const config = {
    matcher: ['/events/:path*', '/dashboard/:path*', '/tasks/:path*', '/guests/:path*', '/budget/:path*', '/vendors/:path*', '/mfa/:path*', '/api/:path*'],
};