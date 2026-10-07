import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import ThemeProvider from '@/components/settings/ThemeProvider';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
    title: {
        default: 'Event Planner',
        template: '%s | Event Planner',
    },
    description: 'Plan and manage your events seamlessly.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={inter.className}>
                <ThemeProvider>{children}</ThemeProvider>
            </body>
        </html>
    );
}