'use client';

import dynamic from 'next/dynamic';

const EventsPageClient = dynamic(() => import('./EventsPageClient'), {
    ssr: false,
});

export default function EventsPageLoader() {
    return <EventsPageClient />;
}
