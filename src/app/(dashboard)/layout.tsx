import type { ReactNode } from 'react';
import Sidebar from '../../components/layout/Sidebar';
import EventChatbot from '../../components/ai/EventChatbot';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

const DashboardLayout = ({ children }: { children: ReactNode }) => {
    return (
        <div className={`flex min-h-screen ${inter.className}`}>
            <Sidebar />
            <main className="flex-1 p-4">
                {children}
            </main>
            <EventChatbot />
        </div>
    );
};

export default DashboardLayout;