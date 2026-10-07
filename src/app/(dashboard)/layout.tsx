import type { ReactNode } from 'react';
import Sidebar from '../../components/layout/Sidebar';
import WorkspaceHeaderLoader from '../../components/layout/WorkspaceHeaderLoader';
import EventChatbot from '../../components/ai/EventChatbot';
import OnboardingTourLoader from '@/components/layout/OnboardingTourLoader';
import { Inter } from 'next/font/google';
import { cookies } from 'next/headers';
import { getPlannerEvents, getCurrentUserId, getActiveEventCookieName } from '@/lib/planner';
import { getSupabaseServerClient } from '@/lib/supabase/server';

const inter = Inter({ subsets: ['latin'] });

const DashboardLayout = async ({ children }: { children: ReactNode }) => {
    const userId = await getCurrentUserId();
    const events = await getPlannerEvents();
    const requestedEventId = cookies().get(getActiveEventCookieName(userId))?.value;
    const activeEvent = events.find((event) => event.id === requestedEventId)
        ?? events.find((event) => event.date && new Date(event.date).getTime() >= Date.now())
        ?? events[0]
        ?? null;
    const { data: activeRole, error: roleError } = activeEvent
        ? await getSupabaseServerClient().rpc('get_event_role', { p_event_id: activeEvent.id })
        : { data: null, error: null };
    if (roleError) throw new Error(`Unable to load active event role: ${roleError.message}`);
    const isViewer = activeRole === 'viewer';

    return (
        <div className={`dashboard-shell ${inter.className}`}>
            <Sidebar activeRole={activeRole} isViewer={isViewer} />
            <div className="dashboard-main">
                <WorkspaceHeaderLoader events={events} activeEventId={activeEvent?.id ?? null} />
                <main className="dashboard-content">{children}</main>
            </div>
            <EventChatbot />
            <OnboardingTourLoader />
        </div>
    );
};

export default DashboardLayout;