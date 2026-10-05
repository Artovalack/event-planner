import type { ReactNode } from 'react';
import Sidebar from '../../components/layout/Sidebar';
import EventChatbot from '../../components/ai/EventChatbot';
import { Inter } from 'next/font/google';
import { cookies } from 'next/headers';
import { getPlannerEvents, ACTIVE_EVENT_COOKIE } from '@/lib/planner';

const inter = Inter({ subsets: ['latin'] });

const DashboardLayout = async ({ children }: { children: ReactNode }) => {
    const events = await getPlannerEvents();
    const requestedEventId = cookies().get(ACTIVE_EVENT_COOKIE)?.value;
    const activeEvent = events.find((event) => event.id === requestedEventId)
        ?? events.find((event) => event.date && new Date(event.date).getTime() >= Date.now())
        ?? events[0]
        ?? null;

    return (
        <div className={`flex min-h-screen flex-col md:flex-row ${inter.className}`}>
            <Sidebar events={events} activeEventId={activeEvent?.id ?? null} />
            <main className="flex-1 p-4">
                {children}
            </main>
            <EventChatbot />
        </div>
    );
};

export default DashboardLayout;