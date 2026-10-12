import type { ReactNode } from 'react';
import ThemeProvider from '@/components/settings/ThemeProvider';
import './globals.css';

export const metadata = {
    title: {
        default: 'Event Planner',
        template: '%s | Event Planner',
    },
    description: 'Plan and manage your events seamlessly.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en" data-theme="tempo" suppressHydrationWarning>
            <body>
                <ThemeProvider>{children}</ThemeProvider>
            </body>
        </html>
    );
}